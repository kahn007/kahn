import { getKey } from './keys'
import { v4 as uuidv4 } from 'uuid'
import { renderLandingPage } from './landingTemplate'

// ── Perplexity — audience research ───────────────────────────
export async function researchAudience({ product, targetAudience, brandName }) {
  const key = getKey('perplexity')
  if (!key) return { insights: getMockInsights(product, targetAudience), mock: true }

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a market research analyst. Return responses as valid JSON only, no markdown fences.',
        },
        { role: 'user', content: buildResearchPrompt(product, targetAudience, brandName) },
      ],
      max_tokens: 2000,
      temperature: 0.2,
      search_domain_filter: ['reddit.com', 'youtube.com'],
      search_recency_filter: 'month',
    }),
  })

  if (!res.ok) throw new Error(`Perplexity: ${res.status} ${await res.text()}`)
  const data = await res.json()

  try {
    return { insights: JSON.parse(data.choices[0].message.content) }
  } catch {
    return { insights: getMockInsights(product, targetAudience), mock: true }
  }
}

// ── Claude — bulk variation generation ───────────────────────
export async function generateVariations({ brandContext, insights, competitorIntel, count = 10, formats = ['feed'] }) {
  const key = getKey('anthropic')
  const total = Math.min(count, 100)

  if (!key) {
    const mocks = Array.from({ length: total }, (_, i) =>
      buildVariationObject(getMockCopy(brandContext, formats[i % formats.length]), brandContext, formats[i % formats.length], i)
    )
    return { variations: mocks, mock: true }
  }

  const batchSizes = []
  for (let i = 0; i < total; i += 10) batchSizes.push(Math.min(10, total - i))

  const allVariations = []
  for (const batchSize of batchSizes) {
    const prompt = buildBatchPrompt(brandContext, insights, batchSize, formats, competitorIntel)
    const raw = await callClaude(key, prompt)

    let parsed = []
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed)) parsed = parsed.variations || []
    } catch { /* ignore */ }

    const batch = parsed.map((item, i) =>
      buildVariationObject(item, brandContext, formats[i % formats.length], allVariations.length + i)
    )
    allVariations.push(...batch)
  }

  return { variations: allVariations }
}

// ── Facebook — push ad drafts ─────────────────────────────────
export async function pushAdsDraft({ adAccountId, adSetId, pageId, variations }) {
  const token = getKey('facebook')
  if (!token) {
    const results = variations.map((v) => ({
      variationId: v.id,
      facebookAdId: `MOCK_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: 'DRAFT',
      success: true,
    }))
    return { results, mock: true }
  }

  const results = []
  const errors = []
  const FB = 'https://graph.facebook.com/v19.0'
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  for (const v of variations) {
    try {
      // 1. Create creative
      const creativeRes = await fetch(`${FB}/${accountId}/adcreatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `BrayneAI — ${v.id}`,
          object_story_spec: {
            page_id: pageId,
            link_data: {
              message: v.primaryText,
              name: v.headline,
              description: v.description,
              call_to_action: { type: ctaTypeMap(v.cta), value: { link: v.landingPageUrl } },
            },
          },
          access_token: token,
        }),
      })
      const creative = await creativeRes.json()
      if (creative.error) throw new Error(creative.error.message)

      // 2. Create ad (paused)
      const adRes = await fetch(`${FB}/${accountId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `BrayneAI — ${v.headline?.substring(0, 30)}`,
          adset_id: adSetId,
          creative: { creative_id: creative.id },
          status: 'PAUSED',
          access_token: token,
        }),
      })
      const ad = await adRes.json()
      if (ad.error) throw new Error(ad.error.message)

      results.push({ variationId: v.id, facebookAdId: ad.id, status: 'PAUSED', success: true })
    } catch (err) {
      errors.push({ variationId: v.id, error: err.message })
    }
    await sleep(120) // respect FB rate limits
  }

  return { results, errors }
}

// ── Facebook — load ad sets ───────────────────────────────────
export async function getFacebookAdSets(adAccountId) {
  const token = getKey('facebook')
  if (!token) return { adSets: getMockAdSets() }

  // Facebook Graph API requires act_ prefix for ad account IDs
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${accountId}/adsets?fields=id,name,status,daily_budget&access_token=${token}`
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return { adSets: data.data }
}

// ── Facebook — analytics ──────────────────────────────────────
// datePreset: Facebook date_preset value (last_7d, last_14d, last_30d, last_90d, last_year, lifetime)
// since/until: YYYY-MM-DD strings for custom ranges
export async function getAnalytics(adAccountId, { since, until, datePreset } = {}) {
  const token = getKey('facebook')
  if (!token) return { data: getMockAnalytics(), mock: true }

  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const FB = 'https://graph.facebook.com/v19.0'

  try {
    // 1. Fetch all ads (names + statuses) — no date filter so we always see every ad
    const adsRes = await fetch(
      `${FB}/${accountId}/ads?fields=id,name,status&limit=500&access_token=${token}`
    )
    const adsData = await adsRes.json()

    if (adsData.error) {
      // Permissions / token errors → surface clearly
      throw new Error(`Facebook Ads error (${adsData.error.code}): ${adsData.error.message}`)
    }

    const ads = adsData.data || []
    if (ads.length === 0) return { data: [], empty: true }

    // 2. Fetch metrics via the /insights endpoint at ad level
    //    Prefer date_preset (more reliable) over time_range JSON for standard periods
    const insightsQuery = new URLSearchParams({
      level: 'ad',
      fields: 'ad_id,ad_name,impressions,clicks,spend,ctr,cpc,reach',
      limit: 500,
      access_token: token,
    })
    if (datePreset) {
      insightsQuery.set('date_preset', datePreset)
    } else if (since && until) {
      // Build time_range manually to avoid double-encoding issues with URLSearchParams
      insightsQuery.set('time_range', `{"since":"${since}","until":"${until}"}`)
    } else {
      insightsQuery.set('date_preset', 'last_30d')
    }

    const insightsRes = await fetch(`${FB}/${accountId}/insights?${insightsQuery}`)
    const insightsData = await insightsRes.json()

    if (insightsData.error) {
      // Insights error — still return the ad list with 0 metrics but surface the reason
      console.error('Facebook Insights error:', insightsData.error)
      const merged = ads.map((ad) => ({
        id: ad.id, name: ad.name, status: ad.status, angle: 'general',
        insights: { impressions: '0', clicks: '0', spend: '0', ctr: '0', cpc: '0', reach: '0' },
      }))
      return { data: merged, insightsError: insightsData.error.message }
    }

    // Build a quick-lookup map by ad_id
    const insightsMap = {}
    for (const ins of insightsData.data || []) {
      insightsMap[ins.ad_id] = ins
    }

    // 3. Merge — show ALL ads, attach metrics where the period had delivery
    const merged = ads.map((ad) => {
      const ins = insightsMap[ad.id] || {}
      return {
        id:     ad.id,
        name:   ad.name,
        status: ad.status,
        angle:  'general', // enriched by TrackingDashboard using local uploadResults
        insights: {
          impressions: ins.impressions || '0',
          clicks:      ins.clicks      || '0',
          spend:       ins.spend       || '0',
          ctr:         ins.ctr         || '0',
          cpc:         ins.cpc         || '0',
          reach:       ins.reach       || '0',
        },
      }
    })

    return { data: merged }
  } catch (err) {
    throw err
  }
}

// ── fal.ai helpers ────────────────────────────────────────────
const FAL_BASE  = 'https://fal.run'
const FAL_QUEUE = 'https://queue.fal.run'

const AD_ASPECT_RATIOS = {
  feed:   '16:9',
  square: '1:1',
  story:  '9:16',
}

// ── Video model registry ──────────────────────────────────────
export const VIDEO_MODELS = {
  kling3pro: {
    id:        'kling3pro',
    label:     'Kling 3.0 Pro',
    sublabel:  'Best quality · pro grade',
    durations: [{ value: '5', label: '5s' }, { value: '10', label: '10s' }],
    endpoint:  'fal-ai/kling-video/v3/pro/text-to-video',
    buildBody: (prompt, ratio, dur) => ({ prompt, aspect_ratio: ratio, duration: dur || '5', cfg_scale: 0.5, generate_audio: false }),
    getUrl:    (r) => r.video?.url,
  },
  kling3: {
    id:        'kling3',
    label:     'Kling 3.0 Standard',
    sublabel:  'High quality · ~90s',
    durations: [{ value: '5', label: '5s' }, { value: '10', label: '10s' }],
    endpoint:  'fal-ai/kling-video/v3/standard/text-to-video',
    buildBody: (prompt, ratio, dur) => ({ prompt, aspect_ratio: ratio, duration: dur || '5', cfg_scale: 0.5, generate_audio: false }),
    getUrl:    (r) => r.video?.url,
  },
  luma: {
    id:        'luma',
    label:     'Luma Ray 2',
    sublabel:  'Cinematic',
    durations: [{ value: '5s', label: '5s' }, { value: '9s', label: '9s' }],
    endpoint:  'fal-ai/luma-dream-machine/ray-2',
    buildBody: (prompt, ratio, dur) => ({ prompt, aspect_ratio: ratio, duration: dur || '5s' }),
    getUrl:    (r) => r.video?.url,
  },
  hailuo: {
    id:        'hailuo',
    label:     'Hailuo-02 Pro',
    sublabel:  '1080p · fastest',
    durations: [{ value: '6', label: '6s' }, { value: '10', label: '10s' }],
    endpoint:  'fal-ai/minimax/hailuo-02/pro/text-to-video',
    buildBody: (prompt, ratio, dur) => ({ prompt, aspect_ratio: ratio, duration: dur || '6', prompt_optimizer: true }),
    getUrl:    (r) => r.video?.url,
  },
  kling16: {
    id:        'kling16',
    label:     'Kling 1.6',
    sublabel:  'Legacy',
    durations: [{ value: '5', label: '5s' }, { value: '10', label: '10s' }],
    endpoint:  'fal-ai/kling-video/v1.6/standard/text-to-video',
    buildBody: (prompt, ratio, dur) => ({ prompt, duration: dur || '5', aspect_ratio: ratio }),
    getUrl:    (r) => r.video?.url,
  },
}

// Angle-specific creative direction
const ANGLE_CREATIVE_DIRECTION = {
  pain_point: 'Show a person visibly stressed, frustrated, or overwhelmed — expression tight, environment chaotic. The pain must feel real and relatable. Dark or harsh lighting enhances the tension.',
  outcome:    'Show a person looking genuinely ecstatic — fist pump, huge smile, eyes wide with excitement. Bright energetic lighting. The result has arrived. Pure emotional payoff.',
  social_proof: 'Show a confident successful person in a professional environment with visible results — packed calendar, positive metrics on a screen, or a group of satisfied people.',
  curiosity:  'Intriguing, slightly unexpected scene. Something is off or surprising — creates visual tension that makes you want to know more. Unusual composition or juxtaposition.',
  authority:  'Clean, expert-looking professional environment. Person looks highly competent and in command. Premium lighting, sharp focus, signals credibility.',
  fomo:       'High-energy scene: something big is happening RIGHT NOW and others are already in. Celebration, momentum, rapid positive change. Urgency visible in the frame.',
  general:    'Clean modern workspace, confident professional, bright open environment. Aspirational but relatable.',
}

// Angle-specific fallback prompts (no Claude key)
const ANGLE_FALLBACK = {
  pain_point:   'Stressed entrepreneur at cluttered desk staring at phone with missed calls, visibly exhausted, harsh overhead light casting shadows, shallow depth of field on stressed face — photorealistic DSLR, no text, no logos',
  outcome:      'Excited business owner pumping fist at clean desk with laptop showing fully booked calendar, bright modern office, golden hour light, candid emotion — photorealistic DSLR, no text, no logos',
  social_proof: 'Confident professional in modern office reviewing impressive charts on dual monitors, clean background, soft professional lighting, looking directly at camera with subtle smile — photorealistic DSLR, no text, no logos',
  curiosity:    'Split dramatic composition: left side chaotic and dark, right side bright and organized, one person crossing the threshold from chaos to clarity, cinematic lighting — photorealistic DSLR, no text, no logos',
  authority:    'Expert-looking person confidently presenting to attentive colleagues in sleek boardroom, premium lighting, sharp focus, commands the room — photorealistic DSLR, no text, no logos',
  fomo:         'Group of energetic entrepreneurs celebrating breakthrough results around a bright screen showing impressive numbers, dynamic movement, high energy — photorealistic DSLR, no text, no logos',
  general:      'Focused entrepreneur working confidently in bright modern workspace, natural light, calm and in control — photorealistic DSLR, no text, no logos',
}

// Build creative prompt via Claude (or fallback)
// competitorIntel is optional — when present, visual direction exploits market gaps
async function buildCreativePrompt(variation, brandContext, format, type, durationSeconds, competitorIntel) {
  const anthropicKey = getKey('anthropic')
  const angle = variation.angle || 'general'
  const audience = variation.targetSegment || brandContext.targetAudience || 'business owner'

  if (!anthropicKey) {
    const base = ANGLE_FALLBACK[angle] || ANGLE_FALLBACK.general
    return `${base}. Scene is relevant to: ${brandContext.product} for ${audience}.`
  }

  const formatLabel = format === 'story' ? '9:16 vertical portrait' : format === 'square' ? '1:1 square' : '16:9 landscape widescreen'
  const isVideo = type === 'video'
  const dur = parseInt(durationSeconds) || 5

  // Scale scene complexity to duration
  const videoStructure = dur <= 5
    ? `ONE single beat — one person, one emotion, one camera movement. The entire scene is a single sustained moment. No cuts, no transitions, no story arc. Just the purest possible expression of the emotion in ${dur} seconds.
Example structure: "[Subject doing X] — [static/slow push-in/slow pan], holding on [emotion] for full duration"`
    : `A mini story with a beginning, development and payoff across ${dur} seconds. Two beats max — setup (${Math.round(dur * 0.4)}s) then emotional resolution (${Math.round(dur * 0.6)}s). One location, simple camera movement.
Example structure: "[Subject doing X showing tension] — [camera slowly pushes in] — [subject reacts to Y, emotion shifts to Z]"`

  // Competitor creative gap direction
  let competitorCreativeNote = ''
  if (competitorIntel) {
    const gaps = competitorIntel.gapOpportunities?.slice(0, 2) || []
    const themes = competitorIntel.competitors?.flatMap((c) => c.themes || []).slice(0, 4) || []
    if (gaps.length || themes.length) {
      competitorCreativeNote = `\n- Market gap to exploit visually: ${gaps.join('; ')}. Make the visual fill this gap that competitors are ignoring.`
    }
  }

  const prompt = `You are a top direct-response creative director at a performance marketing agency. You write AI generation prompts that produce scroll-stopping Facebook ad visuals rated 9/10 or higher by creative directors.

THE AD:
- Target: ${audience}
- Product: ${brandContext.product}
- Headline: "${variation.headline}"
- Copy snippet: "${variation.primaryText?.substring(0, 200)}"
- Emotional angle: ${angle} — ${ANGLE_CREATIVE_DIRECTION[angle] || ANGLE_CREATIVE_DIRECTION.general}${competitorCreativeNote}
- Format: ${formatLabel}${isVideo ? `, ${dur}-second video` : ', still image'}

YOUR TASK:
Write ONE generation prompt for ${isVideo ? 'AI video generation' : 'Flux Pro image generation'} that will make the target audience STOP SCROLLING because they feel seen.

The scene must:
1. Feature a real person who LOOKS EXACTLY LIKE the target audience (infer their age, style, environment from "${audience}")
2. Capture the SPECIFIC MOMENT described by the ad copy — not a generic "stressed person" but the exact scenario (e.g. if copy mentions missed calls, show the phone screen; if it mentions booked appointments, show the calendar)
3. Use the physical environment that audience lives in (a real estate agent = open-plan office with property flyers; a contractor = job site or truck; a solar rep = suburban driveway with panels visible in background)
4. Show ONE ultra-specific facial expression + body language that encodes the exact emotion
5. Use cinematic lighting that amplifies the emotion (harsh tungsten for pain/exhaustion, warm golden for wins, bright clean studio for authority/trust)
${isVideo ? `6. Scene structure for ${dur}s:\n${videoStructure}` : '6. Sharp subject on rule-of-thirds, background slightly blurred (f/2 depth of field), environment adds context without distracting'}

HARD RULES:
- Zero text, words, signs, digits, logos, UI overlays — none
- Photorealistic only — no illustration, 3D render, painting
- Camera: ${isVideo ? 'cinema lens, ARRI ALEXA quality' : 'Sony A7R IV, 85mm f/1.8, editorial photography quality'}
- No stock photo look — candid, authentic, raw emotion
- ${isVideo ? `CRITICAL: The entire prompt must describe ONLY what fits in ${dur} seconds. Do NOT describe more story than the duration allows.` : 'Single decisive moment, not a composite'}

Return ONLY the prompt. No explanation. Max 160 words.`

  const raw = await callClaude(anthropicKey, prompt)
  return raw.trim()
}

// ── Nano Banana Pro — image generation ───────────────────────
export async function generateAdImage({ variation, brandContext, format = 'feed', competitorIntel }) {
  const falKey = getKey('falai')
  if (!falKey) throw new Error('Add your fal.ai key in Settings to generate images')

  const creativePrompt = await buildCreativePrompt(variation, brandContext, format, 'image', null, competitorIntel)

  const res = await fetch(`${FAL_BASE}/fal-ai/nano-banana-pro`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt:           creativePrompt,
      aspect_ratio:     AD_ASPECT_RATIOS[format] || '16:9',
      num_images:       1,
      output_format:    'jpeg',
      safety_tolerance: '2',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || `fal.ai image error ${res.status}`)
  }

  const data = await res.json()
  const imageUrl = data.images?.[0]?.url
  if (!imageUrl) throw new Error('No image URL in fal.ai response')
  return { imageUrl, creativePrompt }
}

// ── Video generation — async queue (any model) ───────────────
export async function generateAdVideo({ variation, brandContext, format = 'feed', onProgress, videoModelId = 'kling3', videoDuration, competitorIntel }) {
  const falKey = getKey('falai')
  if (!falKey) throw new Error('Add your fal.ai key in Settings to generate videos')

  const model = VIDEO_MODELS[videoModelId] || VIDEO_MODELS.kling3
  const ratio = AD_ASPECT_RATIOS[format] || '16:9'
  const dur = videoDuration || model.durations[0].value
  const creativePrompt = await buildCreativePrompt(variation, brandContext, format, 'video', dur, competitorIntel)

  // 1. Submit to queue
  let submitData
  try {
    const submitRes = await fetch(`${FAL_QUEUE}/${model.endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(model.buildBody(creativePrompt, ratio, dur)),
    })
    submitData = await submitRes.json()
    if (!submitRes.ok) {
      const msg = submitData?.detail || submitData?.message || submitData?.error || `fal.ai status ${submitRes.status}`
      throw new Error(msg)
    }
  } catch (err) {
    console.error('[fal.ai Kling] submit failed:', err)
    throw new Error(`Kling submit failed: ${err.message}`)
  }

  // fal.ai returns pre-built URLs — use them directly (more reliable than building manually)
  const { request_id, status_url, response_url } = submitData
  const statusUrl = status_url || `${FAL_QUEUE}/${model.endpoint}/requests/${request_id}/status`
  const resultUrl = response_url || `${FAL_QUEUE}/${model.endpoint}/requests/${request_id}`

  onProgress?.(`Queued (${model.label} · id: ${String(request_id).substring(0, 8)}…)`)

  // 2. Poll until done (videos take 60-120s)
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(3000)

    let status
    try {
      const statusRes = await fetch(`${statusUrl}?logs=1`, { headers: { Authorization: `Key ${falKey}` } })
      status = await statusRes.json()
    } catch (err) {
      console.warn('[fal.ai Kling] status poll error:', err)
      continue
    }

    if (status.status === 'COMPLETED') {
      onProgress?.('Fetching video…')
      let result
      try {
        const resultRes = await fetch(resultUrl, { headers: { Authorization: `Key ${falKey}` } })
        result = await resultRes.json()
      } catch (err) {
        throw new Error(`Kling result fetch failed: ${err.message}`)
      }
      // fal.ai may return video at different paths
      const videoUrl = model.getUrl(result)
        || result.output?.video?.url
        || result.videos?.[0]?.url
        || status.output?.video?.url
      if (!videoUrl) {
        console.error(`[fal.ai ${model.label}] Unexpected result shape:`, JSON.stringify(result).substring(0, 500))
        throw new Error(`Video URL missing in ${model.label} response — check browser console for details`)
      }
      onProgress?.('Done!')
      return { videoUrl, creativePrompt }
    }

    if (status.status === 'FAILED') {
      const reason = status.error || status.detail || 'unknown error'
      throw new Error(`Kling generation failed: ${reason}`)
    }

    const pct = Math.round((attempt / 40) * 100)
    onProgress?.(`${model.label} generating… ${Math.min(pct, 95)}% (${attempt * 3}s)`)
  }

  throw new Error(`${model.label} timed out after 3 minutes — try again`)
}

// ── Kling image-to-video (animate) ───────────────────────────
export async function animateAdImage({ variation, brandContext, format = 'feed', videoDuration = '5', onProgress }) {
  const falKey = getKey('falai')
  if (!falKey) throw new Error('Add your fal.ai key in Settings to animate images')
  if (!variation.imageUrl) throw new Error('No image to animate — generate an image first')

  const ratio = AD_ASPECT_RATIOS[format] || '16:9'
  const endpoint = 'fal-ai/kling-video/v3/pro/image-to-video'
  const prompt = `${variation.headline}. Subtle cinematic motion, photorealistic, professional brand ad. ${variation.primaryText?.substring(0, 80)}`

  const submitRes = await fetch(`${FAL_QUEUE}/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: variation.imageUrl, prompt, duration: videoDuration, aspect_ratio: ratio, cfg_scale: 0.5 }),
  })
  const submitData = await submitRes.json()
  if (!submitRes.ok) throw new Error(submitData?.detail || submitData?.message || `fal.ai status ${submitRes.status}`)

  const { request_id, status_url, response_url } = submitData
  const statusUrl = status_url || `${FAL_QUEUE}/${endpoint}/requests/${request_id}/status`
  const resultUrl = response_url || `${FAL_QUEUE}/${endpoint}/requests/${request_id}`
  onProgress?.(`Queued (id: ${String(request_id).substring(0, 8)}…)`)

  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(3000)
    const statusRes = await fetch(`${statusUrl}?logs=1`, { headers: { Authorization: `Key ${falKey}` } })
    const status = await statusRes.json()
    if (status.status === 'COMPLETED') {
      onProgress?.('Fetching video…')
      const resultRes = await fetch(resultUrl, { headers: { Authorization: `Key ${falKey}` } })
      const result = await resultRes.json()
      const videoUrl = result.video?.url || result.output?.video?.url || result.videos?.[0]?.url || status.output?.video?.url
      if (!videoUrl) throw new Error('Video URL missing in animate response')
      onProgress?.('Done!')
      return { videoUrl }
    }
    if (status.status === 'FAILED') throw new Error(`Animation failed: ${status.error || 'unknown'}`)
    onProgress?.(`Animating… ${Math.min(Math.round((attempt / 40) * 100), 95)}% (${attempt * 3}s)`)
  }
  throw new Error('Animation timed out after 3 minutes')
}

// ── Perplexity — competitor spy ───────────────────────────────
export async function spyCompetitorAds({ product, targetAudience, competitors = '' }) {
  const key = getKey('perplexity')
  if (!key) return { ads: getMockCompetitorAds(product), mock: true }

  const competitorNote = competitors
    ? `Focus on these specific brands: ${competitors}.`
    : `Find the top 4-5 direct competitors for "${product}" targeting "${targetAudience}".`

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: 'You are a competitive intelligence analyst. Return valid JSON only, no markdown fences.' },
        { role: 'user', content: `Research Facebook ads being run by competitors in the "${product}" space for "${targetAudience}". ${competitorNote}

Search the Facebook Ad Library and recent marketing content.

Return JSON:
{
  "competitors": [{"name":"","angle":"pain_point|outcome|social_proof|curiosity|authority|fomo","headline":"","hooks":["",""],"themes":["",""],"weaknesses":""}],
  "winningAngles": ["",""],
  "gapOpportunities": ["",""],
  "suggestedDifferentiators": [""]
}

Find 3-5 competitors with 2-3 hooks each.` }
      ],
      max_tokens: 2000, temperature: 0.2,
      search_domain_filter: ['facebook.com', 'adspy.com'],
      search_recency_filter: 'month',
    }),
  })
  if (!res.ok) throw new Error(`Perplexity: ${res.status} ${await res.text()}`)
  const data = await res.json()
  try {
    return { ads: JSON.parse(data.choices[0].message.content) }
  } catch {
    return { ads: getMockCompetitorAds(product), mock: true }
  }
}

// ── Claude — score copy variations ───────────────────────────
export async function scoreCopyVariations(variations, brandContext) {
  const key = getKey('anthropic')
  if (!key) {
    return variations.map((v) => ({ id: v.id, score: Math.floor(Math.random() * 3) + 6, rationale: 'Add Anthropic key for AI scoring' }))
  }
  const varList = variations.map((v, i) =>
    `${i + 1}. Headline: "${v.headline}" | Angle: ${v.angle} | Copy: "${v.primaryText?.substring(0, 100)}"`
  ).join('\n')

  const prompt = `Rate each Facebook ad 1-10 on: hook strength, specificity, clarity, emotion, CTA alignment.
Brand: ${brandContext.brandName} | Product: ${brandContext.product} | Audience: ${brandContext.targetAudience}

Variations:
${varList}

Return ONLY JSON: [{"id_index":1,"score":8,"rationale":"max 12 words"}, ...]`

  const raw = await callClaude(key, prompt)
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const scores = JSON.parse(cleaned)
    return variations.map((v, i) => {
      const s = scores.find((x) => x.id_index === i + 1) || { score: 7, rationale: '' }
      return { id: v.id, score: s.score, rationale: s.rationale }
    })
  } catch {
    return variations.map((v) => ({ id: v.id, score: 7, rationale: '' }))
  }
}

// ── Claude — retargeting variants ────────────────────────────
export async function generateRetargetingVariations(variations, brandContext) {
  const key = getKey('anthropic')
  const total = Math.min(variations.length, 10)

  if (!key) {
    return variations.slice(0, total).map((v, i) => buildVariationObject({
      headline: 'Still thinking it over?',
      primaryText: `You already know about ${brandContext.product}. Here is what most people realize just before they finally take action: the window closes. Others are moving forward right now.`,
      description: 'Last chance',
      cta: brandContext.cta || 'Learn More',
      angle: 'fomo',
      targetSegment: `retargeting — ${v.targetSegment || brandContext.targetAudience}`,
    }, brandContext, v.format || 'feed', 1000 + i))
  }

  const varSummaries = variations.slice(0, total).map((v, i) =>
    `${i + 1}. "${v.headline}" | angle: ${v.angle} | audience: ${v.targetSegment || brandContext.targetAudience}`
  ).join('\n')

  const prompt = `Rewrite these cold-traffic Facebook ads as RETARGETING ads for warm audiences who saw the brand but did not convert.

Original ads:
${varSummaries}

Brand: ${brandContext.brandName} | Product: ${brandContext.product}

Rules:
- Open with acknowledgement they already saw this ("Still thinking about it?", "You left before the best part…")
- Use urgency, scarcity, stronger social proof, or address the #1 objection
- NEVER use em dashes (—) or en dashes (–)

Return ONLY a JSON array with exactly ${total} objects:
[{"headline":"max 40 chars","primaryText":"90-150 words retargeting copy","description":"max 25 chars","cta":"${brandContext.cta || 'Learn More'}","angle":"fomo|social_proof|authority|outcome","targetSegment":"retargeting — [audience]"}]`

  const raw = await callClaude(key, prompt)
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) parsed = parsed.variations || []
    return parsed.map((item, i) => buildVariationObject(item, brandContext, variations[i]?.format || 'feed', 1000 + i))
  } catch {
    throw new Error('Failed to parse retargeting variations — try again')
  }
}

// ── Claude — landing page generator ──────────────────────────
export async function generateLandingPage({ variation, brandContext, insights, competitorIntel, pageConfig }) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings to generate landing pages')

  // ── Extract context ──────────────────────────────────────────
  const pc = pageConfig || {}
  const brand    = pc.companyName || brandContext.brandName || 'Our Solution'
  const audience = variation.targetSegment || brandContext.targetAudience || 'professionals'
  const ctaText  = variation.cta || 'Get Started'
  const ctaUrl   = pc.ctaUrl || brandContext.landingPageUrl || '#'
  const tagline  = pc.tagline || ''
  const trust    = pc.trustMetric || '2,400+ customers'

  const painPoints = insights?.painPoints?.slice(0, 4).map((p) => p.text) || [
    `Wasting hours on ${brandContext.product} with no results`,
    `No idea which approach actually converts`,
    `Spending money without knowing what works`,
    `Falling behind while competitors scale`,
  ]
  const outcomes = insights?.desiredOutcomes?.slice(0, 3).map((o) => o.text) || [
    'Get measurable results fast',
    'Know exactly what works before spending big',
    'Scale confidently',
  ]
  const objections = insights?.objections?.slice(0, 3) || [
    'Is this right for my situation?',
    'How long does it take to see results?',
    'What if it doesn\'t work for me?',
  ]

  const competitorEdge = competitorIntel
    ? `Competitor intel — position us as superior:
- Market gaps to exploit: ${competitorIntel.gapOpportunities?.join('; ')}
- Our differentiators: ${competitorIntel.suggestedDifferentiators?.join('; ')}
- Competitor weaknesses: ${competitorIntel.competitors?.map((c) => c.weaknesses).filter(Boolean).join('; ')}`
    : ''

  // ── Content generation prompt ────────────────────────────────
  // Claude generates ONLY the content JSON — not HTML.
  // The pre-built template handles all design.
  const prompt = `You are a direct-response copywriter. Write landing page content for the product below.
Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

PRODUCT & AUDIENCE
Brand: ${brand}
Product: ${brandContext.product}
Audience: ${audience}
Ad headline (mirror this closely): "${variation.headline}"
Ad body copy: "${variation.primaryText}"
CTA button text: "${ctaText}"
${tagline ? `Tagline: "${tagline}"` : ''}
Social proof: "${trust}"
Pain points: ${painPoints.join(' · ')}
Desired outcomes: ${outcomes.join(' · ')}
Objections to handle: ${objections.join(' · ')}
${competitorEdge}

WRITING RULES — non-negotiable:
- Every line of copy must be specific to this product and this audience. No filler. No "transform your workflow." No "all-in-one solution."
- Write like a real person who understands the problem — not like a marketer.
- Stats and metrics must be concrete and plausible. Real numbers only.
- Testimonial quotes must sound like actual people. Include a specific outcome or number in every quote.
- Hero headline must closely mirror the ad headline. Wrap 1–3 key words in <span class="g"> for gradient styling.
- Pain items should articulate exact frustrations ${audience} feel daily — visceral and specific, not vague.
- Feature descriptions: what it actually does, not abstract benefits.
- FAQ answers: direct and reassuring — handle real objections listed above.
- heroPill: a short, concrete label (no exclamation marks, no fluff) — 6 words max, uppercase style.
- ctaHeadline: confident and specific. Wrap 2–3 words in <span class="g">.

Return this exact JSON shape (fill every field, no nulls):
{
  "pageTitle": "${brand} — [headline text, max 50 chars]",
  "headlinePlain": "[headline without HTML tags]",
  "headlineHtml": "[headline with <span class=\\"g\\">key words</span> and a <br> for rhythm where natural]",
  "heroPill": "[SHORT UPPERCASE LABEL — e.g. 'For Real Estate Agents' or 'Response Time Guaranteed']",
  "subheadline": "[2 sentences. Expand the ad promise then name the core pain. Specific, not generic.]",
  "ctaText": "${ctaText}",
  "avatarInitials": ["AB","CD","EF","GH","IJ"],
  "trustCompanies": ["Co1","Co2","Co3","Co4","Co5"],
  "stats": [
    {"value": "[number+unit]", "label": "[short label]", "sub": "[context, 4 words max]"},
    {"value": "[number+unit]", "label": "[short label]", "sub": "[context]"},
    {"value": "[number+unit]", "label": "[short label]", "sub": "[context]"},
    {"value": "[number+unit]", "label": "[short label]", "sub": "[context]"}
  ],
  "painHeadline": "[The actual frustration ${audience} feels — not 'The problem with X', the raw feeling itself]",
  "painBody": "[1-2 sentences. Conversational, specific. Like you've lived it.]",
  "painQuote": "[A frustrated-customer quote that captures the feeling in one sentence]",
  "painItems": [
    {"headline": "[pain title]", "body": "[1-2 specific sentences for ${audience}]"},
    {"headline": "[pain title]", "body": "[1-2 specific sentences]"},
    {"headline": "[pain title]", "body": "[1-2 specific sentences]"}
  ],
  "featuresHeadline": "[Bold, specific headline that positions ${brand} as the answer to the pain above]",
  "featuresSub": "[One clear, concrete promise sentence]",
  "features": [
    {"icon": "[lucide icon name — pick from: zap, shield-check, trending-up, clock, users, target, message-square, check-circle-2, bar-chart-2, settings-2, globe, lock, sparkles, layers, refresh-cw, bell, search, phone, mail, calendar, dollar-sign, cpu, eye, rocket, award, activity, send, timer, bolt]", "headline": "[feature name]", "body": "[2-3 sentences, what it does and why it matters for ${audience}]"},
    {"icon": "[pick best matching icon]", "headline": "[feature name]", "body": "[2-3 sentences]"},
    {"icon": "[pick best matching icon]", "headline": "[feature name]", "body": "[2-3 sentences]"},
    {"icon": "[pick best matching icon]", "headline": "[feature name]", "body": "[2-3 sentences]"},
    {"icon": "[pick best matching icon]", "headline": "[feature name]", "body": "[2-3 sentences]"},
    {"icon": "[pick best matching icon]", "headline": "[feature name]", "body": "[2-3 sentences]"}
  ],
  "howItWorksHeadline": "[Specific headline about speed/simplicity, e.g. 'From sign-up to your first result in under 10 minutes']",
  "howItWorksSub": "[One concrete reassurance. No jargon.]",
  "steps": [
    {"num": "01", "headline": "[step title]", "body": "[2 sentences. What happens and why it matters.]"},
    {"num": "02", "headline": "[step title]", "body": "[2 sentences]"},
    {"num": "03", "headline": "[step title]", "body": "[2 sentences]"}
  ],
  "featuredQuote": "[The strongest testimonial. A specific outcome with a real number. Sounds like a real person.]",
  "featuredAuthor": "[Full Name]",
  "featuredRole": "[Job Title, Company Name]",
  "testimonials": [
    {"quote": "[specific outcome with a number]", "author": "[Name]", "role": "[Title]", "initials": "[AB]"},
    {"quote": "[specific outcome with a number]", "author": "[Name]", "role": "[Title]", "initials": "[CD]"}
  ],
  "comparisonHeadline": "[What ${audience} loses by staying with current solutions — frame it as a cost]",
  "comparisonOurLabel": "${brand}",
  "comparisonThemLabel": "Without it",
  "comparisonRows": [
    {"aspect": "[meaningful capability]", "us": "[our specific answer]", "them": "[their specific limitation]"},
    {"aspect": "[meaningful capability]", "us": "[specific answer]", "them": "[limitation]"},
    {"aspect": "[meaningful capability]", "us": "[specific answer]", "them": "[limitation]"},
    {"aspect": "[meaningful capability]", "us": "[specific answer]", "them": "[limitation]"},
    {"aspect": "[meaningful capability]", "us": "[specific answer]", "them": "[limitation]"}
  ],
  "faqHeadline": "Common questions",
  "faqItems": [
    {"q": "[real objection from the list above]", "a": "[direct, reassuring 2-3 sentence answer]"},
    {"q": "[objection]", "a": "[answer]"},
    {"q": "[objection]", "a": "[answer]"},
    {"q": "[objection]", "a": "[answer]"},
    {"q": "How do I get started?", "a": "[clear next steps]"}
  ],
  "ctaHeadline": "[Confident, specific. Wrap 2-3 words in <span class=\\"g\\">. No clichés.]",
  "ctaBody": "[What happens immediately after clicking. Concrete and reassuring. 1-2 sentences.]",
  "footerTagline": "[Brand tagline — 5 words max, no punctuation]"
}`

  const raw = await callClaudeLarge(key, prompt)

  // Parse the content JSON
  let content
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    content = JSON.parse(cleaned)
  } catch (e) {
    // Try extracting JSON from within the response
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Failed to parse landing page content from Claude response')
    try {
      content = JSON.parse(match[0])
    } catch {
      throw new Error('Invalid JSON in Claude response for landing page content')
    }
  }

  // Render the page using the pre-built template
  return renderLandingPage(content, pc)
}


// ── Claude helpers ────────────────────────────────────────────
async function callClaude(key, prompt) {
  return _claudeCall(key, prompt, 4096)
}

// Higher token limit for landing page generation
async function callClaudeLarge(key, prompt) {
  return _claudeCall(key, prompt, 16000)
}

async function _claudeCall(key, prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.content[0].text
}

// ── Prompt builders ───────────────────────────────────────────
function buildResearchPrompt(product, targetAudience, brandName) {
  return `Search Reddit and YouTube for the MOST RECENT discussions about "${product}" targeting "${targetAudience}".

Return a JSON object with this exact shape:
{
  "painPoints": [{ "text": "...", "source": "reddit|youtube", "frequency": "high|medium|low", "emotion": "frustrated|anxious|hopeful|..." }],
  "desiredOutcomes": [{ "text": "...", "source": "reddit|youtube" }],
  "triggerPhrases": ["phrase1", "phrase2"],
  "objections": ["objection1"],
  "toneInsights": "What tone resonates",
  "topKeywords": ["keyword1"]
}

Find 6-8 pain points, 4-6 desired outcomes, 8-10 trigger phrases, 3-5 objections, 6-8 keywords.`
}

function buildBatchPrompt(brandContext, insights, count, formats, competitorIntel) {
  const { brandName, product, targetAudience, cta, landingPageUrl } = brandContext
  const insightsSummary = insights
    ? `Pain points: ${insights.painPoints?.slice(0, 3).map((p) => p.text).join('; ')}
Desired outcomes: ${insights.desiredOutcomes?.slice(0, 3).map((o) => o.text).join('; ')}
Trigger phrases: ${insights.triggerPhrases?.slice(0, 5).join(', ')}`
    : ''

  // Competitor intelligence block
  let competitorBlock = ''
  if (competitorIntel) {
    const { competitors = [], winningAngles = [], gapOpportunities = [], suggestedDifferentiators = [] } = competitorIntel
    const provenHooks = competitors.flatMap((c) => c.hooks || []).slice(0, 8)
    const weaknesses = competitors.map((c) => c.weaknesses).filter(Boolean).slice(0, 3)

    competitorBlock = `
COMPETITOR INTELLIGENCE (use this to make ads that can't lose):
- Winning angles in this market that CONVERT: ${winningAngles.join(', ')} — bias your variations toward these
- Proven hook structures competitors use (inspire from, do NOT copy verbatim): ${provenHooks.join(' | ')}
- What competitors are FAILING at (exploit these gaps): ${gapOpportunities.join('; ')}
- Competitor weaknesses to beat: ${weaknesses.join('; ')}
- Your differentiators to hammer: ${suggestedDifferentiators.join('; ')}

CRITICAL: Generate ads that fill the gaps competitors are missing. If competitors ignore a niche or angle, target it.`
  }

  // If multiple audiences are listed, distribute them across variations
  const audienceList = targetAudience.split(/[,;\/]+/).map((a) => a.trim()).filter(Boolean)
  const audienceNote = audienceList.length > 1
    ? `IMPORTANT: Multiple audience segments are listed (${audienceList.join(', ')}). Each variation must target EXACTLY ONE specific audience segment. Speak directly to that one person — never combine audiences in a single ad. Rotate through segments across variations.`
    : `Audience: ${targetAudience}`

  return `You are a world-class Facebook ad copywriter for ${brandName} (${landingPageUrl}).
Product: ${product} | CTA: ${cta}
${audienceNote}
${insightsSummary}
${competitorBlock}

Generate EXACTLY ${count} unique Facebook ad variations using different angles: pain_point, outcome, social_proof, curiosity, authority, fomo.

Rules:
- Each ad speaks to ONE specific person, not a list of industries
- Copy is direct, conversational, specific — no corporate fluff
- Headlines are punchy and under 40 characters
- NEVER use em dashes (—) or en dashes (–) anywhere in the copy
${competitorIntel ? '- Prioritize angles and themes proven to convert in this market from the competitor intel above' : ''}

Return ONLY a valid JSON array with exactly ${count} objects:
[{
  "headline": "max 40 chars",
  "primaryText": "90-150 words, conversational, speaks to ONE audience segment",
  "description": "max 25 chars",
  "cta": "${cta}",
  "angle": "pain_point|outcome|social_proof|curiosity|authority|fomo",
  "targetSegment": "the specific audience this ad targets"
}]`
}

// ── Object builders ───────────────────────────────────────────
function buildVariationObject(item, brandContext, format, index) {
  return {
    id: uuidv4(),
    index: index + 1,
    headline: item.headline || `Ad Variation ${index + 1}`,
    primaryText: item.primaryText || item.body || '',
    description: item.description || '',
    cta: item.cta || brandContext.cta || 'Learn More',
    angle: item.angle || 'general',
    targetSegment: item.targetSegment || null,
    format: item.format || format,
    status: 'draft',
    facebookAdId: null,
    createdAt: new Date().toISOString(),
    imageUrl: null,
    videoUrl: null,
  }
}

// ── Mock data (works without any keys) ───────────────────────
function getMockInsights(product, targetAudience) {
  return {
    painPoints: [
      { text: `Spending hours creating ${product} content with no results`, source: 'reddit', frequency: 'high', emotion: 'frustrated' },
      { text: `Can't figure out what actually converts for ${targetAudience}`, source: 'reddit', frequency: 'high', emotion: 'anxious' },
      { text: `Wasting ad budget on creatives that don't resonate`, source: 'youtube', frequency: 'high', emotion: 'frustrated' },
      { text: `Testing 10 ads manually takes forever`, source: 'reddit', frequency: 'medium', emotion: 'exhausted' },
      { text: `No idea which copy angle to use`, source: 'youtube', frequency: 'medium', emotion: 'confused' },
      { text: `Agency quotes are way too expensive`, source: 'reddit', frequency: 'high', emotion: 'frustrated' },
    ],
    desiredOutcomes: [
      { text: `Launch 100 ad variations in under an hour`, source: 'youtube' },
      { text: `Know exactly which ad is converting before spending big`, source: 'reddit' },
      { text: `Automate the boring parts of ad creation`, source: 'reddit' },
      { text: `Scale winning ads without hiring a team`, source: 'youtube' },
    ],
    triggerPhrases: ['stop guessing', 'finally found something that works', 'scaled to 6 figures', 'without an agency', 'in minutes not hours', 'I wish I knew sooner', 'game changer', 'does it actually work'],
    objections: ['Too expensive for my budget', 'Worried about the learning curve', 'Not sure if AI copy sounds natural', 'What if Facebook disapproves the ads?'],
    toneInsights: `${targetAudience} responds best to direct, results-first copy. Avoid hype — lead with specific outcomes and social proof.`,
    topKeywords: [product, targetAudience, 'Facebook ads', 'ad creative', 'conversion rate', 'AI marketing', 'scale ads'],
  }
}

function getMockCopy(brandContext, format) {
  const { brandName = 'Brayne AI', product = 'AI tool', targetAudience = 'entrepreneurs' } = brandContext
  const copies = [
    { headline: 'Stop guessing. Start converting.', primaryText: `Most ${targetAudience} spend hours writing ads that never convert. ${brandName} changes that. Our AI analyzes what your audience actually cares about — then writes the copy for you. In minutes, not weeks.`, description: 'Try free today', cta: 'Learn More', angle: 'pain_point' },
    { headline: '100 ads. 30 minutes. Real results.', primaryText: `What if you could test 100 ad variations this week — without hiring a copywriter or agency? ${brandName} makes it possible. Just enter your product, your audience, and let the AI do the heavy lifting.`, description: 'No credit card needed', cta: 'Get Started', angle: 'outcome' },
    { headline: `The ${product} tool that actually works`, primaryText: `Over 1,000 ${targetAudience} use ${brandName} to bulk-generate Facebook ads that convert. We scan Reddit and YouTube to find exactly what your audience is saying — then turn those words into ads that hit different.`, description: 'Join 1,000+ users', cta: 'See How It Works', angle: 'social_proof' },
  ]
  return copies[Math.floor(Math.random() * copies.length)]
}

function getMockAdSets() {
  return [
    { id: 'adset_001', name: 'Brayne AI — Cold Traffic', status: 'ACTIVE', daily_budget: '5000' },
    { id: 'adset_002', name: 'Brayne AI — Retargeting', status: 'ACTIVE', daily_budget: '2000' },
  ]
}

function getMockCompetitorAds(product) {
  return {
    competitors: [
      { name: 'CompetitorA', angle: 'pain_point', headline: `Tired of ${product} that falls short?`, hooks: ['Get results in 24h', 'No contracts'], themes: ['Speed', 'Simplicity'], weaknesses: 'No social proof, generic copy targeting everyone' },
      { name: 'CompetitorB', angle: 'social_proof', headline: '10,000+ businesses trust us', hooks: ['Join 10K+ users', 'As seen on Forbes'], themes: ['Scale', 'Authority'], weaknesses: 'Ignores specific audience pain points, no niche targeting' },
      { name: 'CompetitorC', angle: 'outcome', headline: '3x your ROI guaranteed', hooks: ['ROI guarantee', '30-day free trial'], themes: ['ROI', 'Risk-free offer'], weaknesses: 'Vague promise with no specificity about how results are achieved' },
    ],
    winningAngles: ['social_proof', 'outcome'],
    gapOpportunities: ['No competitor targets specific niches directly', 'Nobody shows before/after comparisons', 'No competitor addresses the time-savings angle'],
    suggestedDifferentiators: [`Be hyper-specific about ${product} outcomes`, 'Target one niche at a time with personalized copy', 'Lead with speed — how fast results happen'],
  }
}

function getMockAnalytics() {
  const angles = ['pain_point', 'outcome', 'social_proof', 'curiosity', 'authority', 'fomo']
  return Array.from({ length: 20 }, (_, i) => {
    const impressions = Math.floor(Math.random() * 50000) + 5000
    const clicks = Math.floor(impressions * (Math.random() * 0.04 + 0.01))
    const spend = parseFloat((clicks * (Math.random() * 1.5 + 0.5)).toFixed(2))
    return {
      id: `MOCK_AD_${i + 1}`,
      name: `BrayneAI Ad Variation ${i + 1}`,
      angle: angles[i % angles.length],
      status: i < 15 ? 'ACTIVE' : 'PAUSED',
      insights: {
        impressions: impressions.toString(),
        clicks: clicks.toString(),
        spend: spend.toString(),
        ctr: ((clicks / impressions) * 100).toFixed(2),
        cpc: (spend / clicks).toFixed(2),
      },
    }
  }).sort((a, b) => parseFloat(b.insights.ctr) - parseFloat(a.insights.ctr))
}

function ctaTypeMap(cta) {
  return ({ 'Learn More': 'LEARN_MORE', 'Sign Up': 'SIGN_UP', 'Get Started': 'GET_STARTED', 'Shop Now': 'SHOP_NOW', 'Download': 'DOWNLOAD', 'Contact Us': 'CONTACT_US' })[cta] || 'LEARN_MORE'
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// ── Multi-platform adapter ─────────────────────────────────────
const PLATFORM_SPECS = {
  google: {
    name: 'Google Ads',
    format: `Responsive Search Ad:
- headline1: max 30 chars (primary benefit)
- headline2: max 30 chars (differentiator)
- headline3: max 30 chars (CTA or brand)
- description1: max 90 chars (problem + solution)
- description2: max 90 chars (social proof or offer)
All headlines must work in any combination. Count characters including spaces.`,
    fields: ['headline1', 'headline2', 'headline3', 'description1', 'description2'],
  },
  tiktok: {
    name: 'TikTok Ad',
    format: `TikTok video ad script:
- hook: First 3 seconds — 1-2 punchy sentences that stop the scroll immediately
- story: 15-20 seconds — problem → solution hint → one proof point (natural, not salesy)
- cta: Last 5 seconds — one clear action (direct, urgent)
- caption: 100-130 chars for the post text
- hashtags: Array of 5 relevant hashtags (strings without #)`,
    fields: ['hook', 'story', 'cta', 'caption', 'hashtags'],
  },
  linkedin: {
    name: 'LinkedIn Ad',
    format: `LinkedIn Single Image Ad:
- headline: max 70 chars — professional, outcome-focused
- intro: max 150 chars — hook that speaks to a professional pain point
- body: 200-280 words — professional tone, B2B framing, concrete ROI/outcome language
- ctaButton: 2-4 words (e.g. "Download Guide", "Get Demo", "Start Free")`,
    fields: ['headline', 'intro', 'body', 'ctaButton'],
  },
  twitter: {
    name: 'Twitter / X Thread',
    format: `5-tweet thread (each max 280 chars):
- tweet1: The bold claim or provocative question — makes them stop
- tweet2: The problem — make the pain real and specific
- tweet3: The shift — insight, reframe, or surprising truth
- tweet4: The proof — specific outcome, social proof, or data point
- tweet5: The CTA — single clear action with a link placeholder [link]`,
    fields: ['tweet1', 'tweet2', 'tweet3', 'tweet4', 'tweet5'],
  },
  youtube: {
    name: 'YouTube Pre-Roll',
    format: `30-second YouTube pre-roll script:
- hook: 0-5s — must earn the skip (viewer decides before skip button appears)
- problem: 5-15s — agitate the specific pain; speak directly to them
- solution: 15-25s — what changes for them; tease the result not the mechanism
- cta: 25-30s — single action with mild urgency
- fullScript: Complete word-for-word script with [0s] [5s] [15s] [25s] timestamps`,
    fields: ['hook', 'problem', 'solution', 'cta', 'fullScript'],
  },
}

export async function adaptToPlatform({ variations, brandContext, platform, insights }) {
  const key = getKey('anthropic')
  const spec = PLATFORM_SPECS[platform]
  if (!key) throw new Error('Add your Anthropic key in Settings to use Multi-Platform')
  if (!spec) throw new Error(`Unknown platform: ${platform}`)

  const items = variations.slice(0, 5)
  if (!items.length) throw new Error('No variations to adapt — generate some copy first')

  const painPts = insights?.painPoints?.slice(0, 3).map((p) => p.text).join('; ') || ''
  const triggers = insights?.triggerPhrases?.slice(0, 5).join(', ') || ''

  const prompt = `You are an expert multi-platform ad copywriter. Adapt these Facebook ad variations to ${spec.name} format.

BRAND: ${brandContext.brandName || 'Brand'} | PRODUCT: ${brandContext.product || 'Product'} | AUDIENCE: ${brandContext.targetAudience || 'General'}
${painPts ? `PAIN POINTS: ${painPts}` : ''}
${triggers ? `TRIGGER PHRASES: ${triggers}` : ''}

${spec.name.toUpperCase()} FORMAT:
${spec.format}

SOURCE VARIATIONS:
${items.map((v, i) => `${i + 1}. Headline: "${v.headline}" | Angle: ${v.angle}
Copy: "${v.primaryText?.substring(0, 200)}"`).join('\n\n')}

Return ONLY valid JSON array with exactly ${items.length} objects. Each object must have these fields: ${spec.fields.join(', ')}.
${platform === 'tiktok' ? 'hashtags must be a JSON array of strings.' : ''}
${platform === 'twitter' ? 'All tweets must be under 280 characters.' : ''}
${platform === 'google' ? 'All headlines must be under 30 characters. All descriptions under 90 characters.' : ''}`

  const raw = await callClaudeLarge(key, prompt)
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(cleaned)
  return {
    adaptations: Array.isArray(parsed) ? parsed : [],
    platform,
    platformName: spec.name,
    fields: spec.fields,
    sourceVariations: items,
  }
}

// ── Email sequence generator ──────────────────────────────────
const EMAIL_SEQUENCE_SPECS = {
  welcome: {
    label: 'Welcome Sequence',
    count: 3,
    description: '3 emails for new leads. Deliver value first, introduce the offer last.',
    plan: `Email 1 (Day 0): Warm welcome. Deliver one immediately useful insight. Zero selling.
Email 2 (Day 2): Your single best tip for their problem. Pure value, end with a soft mention.
Email 3 (Day 5): Natural offer introduction. "Here's what I built to solve this..."`,
  },
  nurture: {
    label: 'Nurture Sequence',
    count: 5,
    description: '5 emails to warm cold leads over 2 weeks.',
    plan: `Email 1 (Day 1): Pain point story — they will relate immediately
Email 2 (Day 3): The #1 mistake they are probably making (and the fix)
Email 3 (Day 7): A surprising insight that reframes their thinking
Email 4 (Day 10): Case study — how someone like them got a specific result
Email 5 (Day 14): Direct soft offer with urgency`,
  },
  sales: {
    label: 'Sales Sequence',
    count: 5,
    description: '5-email direct-response sequence with closing urgency.',
    plan: `Email 1: Problem — make the cost of inaction visceral and real
Email 2: Agitate — show what happens if they keep doing nothing
Email 3: Solution — introduce the product as the obvious next step
Email 4: Proof — specific testimonials, numbers, and outcomes
Email 5: Close — deadline, scarcity, and final call to action`,
  },
  reactivation: {
    label: 'Reactivation',
    count: 3,
    description: '3 emails to re-engage cold or dormant leads.',
    plan: `Email 1: "We have not heard from you…" — gentle re-engagement, acknowledge time passed, no selling
Email 2: Something has changed — new feature, fresh case study, or insight they missed
Email 3: The goodbye email — explicit last-chance that converts through reverse psychology`,
  },
}

export async function generateEmailSequence({ type, brandContext, insights }) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings to generate email sequences')

  const spec = EMAIL_SEQUENCE_SPECS[type]
  if (!spec) throw new Error(`Unknown sequence type: ${type}`)

  const painPts = insights?.painPoints?.slice(0, 3).map((p) => p.text).join('; ') || ''
  const outcomes = insights?.desiredOutcomes?.slice(0, 3).map((o) => o.text).join('; ') || ''
  const triggers = insights?.triggerPhrases?.slice(0, 6).join(', ') || ''
  const objections = insights?.objections?.slice(0, 3).join('; ') || ''

  const prompt = `You are a world-class email copywriter. Write a ${spec.label} for the brand below.

BRAND: ${brandContext.brandName || 'Brand'}
PRODUCT: ${brandContext.product || 'Product'}
AUDIENCE: ${brandContext.targetAudience || 'Professionals'}
LANDING URL: ${brandContext.landingPageUrl || 'https://example.com'}
${painPts   ? `PAIN POINTS: ${painPts}`      : ''}
${outcomes  ? `DESIRED OUTCOMES: ${outcomes}` : ''}
${triggers  ? `TRIGGER PHRASES (use these naturally): ${triggers}` : ''}
${objections ? `OBJECTIONS TO ADDRESS: ${objections}` : ''}

SEQUENCE PLAN:
${spec.plan}

WRITING RULES:
- Subject lines: max 48 chars, curiosity-driven, no exclamation marks
- Preview text: 80-110 chars — adds context without repeating the subject
- Body: plain conversational prose, short paragraphs (1-3 sentences each), sounds like a real person wrote it
- No em dashes, no en dashes, no brackets, no ALL CAPS except acronyms
- Each email ends with exactly ONE link — use the landing URL
- Sequence must feel cohesive — each email references or builds on the last

Return ONLY valid JSON array with exactly ${spec.count} objects:
[{
  "emailNumber": 1,
  "sendDay": 0,
  "subject": "...",
  "previewText": "...",
  "body": "full email body as plain text with real line breaks using \\n",
  "cta": { "text": "...", "url": "${brandContext.landingPageUrl || 'https://example.com'}" }
}]`

  const raw = await callClaudeLarge(key, prompt)
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(cleaned)
  return {
    id: crypto.randomUUID(),
    type,
    label: spec.label,
    emails: Array.isArray(parsed) ? parsed : [],
    product: brandContext.product,
    createdAt: new Date().toISOString(),
  }
}

export { EMAIL_SEQUENCE_SPECS, PLATFORM_SPECS }

// ── Customer Voice Mining ─────────────────────────────────────
export async function mineCustomerVoice({ text, sourceType, brandContext }) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings')

  const prompt = `You are an elite copywriter and customer research analyst.
Analyze the following customer text (source: ${sourceType}) and extract actionable insights for ad copywriting.

CUSTOMER TEXT:
"""
${text.slice(0, 8000)}
"""

Return ONLY a valid JSON object with this exact structure:
{
  "painWords": [{"word": "...", "count": 3}, ...],
  "goldPhrases": ["exact phrase 1", "exact phrase 2", ...],
  "emotionalTriggers": ["trigger 1", "trigger 2", ...],
  "transformations": [{"from": "old state", "to": "new state"}, ...],
  "jtbd": ["When I ..., I want to ..., so I can ..."],
  "objections": ["objection 1", "objection 2", ...]
}

Rules:
- painWords: top 12 pain/frustration words ranked by implied frequency, each with estimated mention count
- goldPhrases: 8-12 verbatim phrases so emotionally resonant they could be used as ad copy
- emotionalTriggers: 6-8 core emotional drivers (fears, desires, aspirations)
- transformations: 4-6 "went from X to Y" pairs capturing the transformation arc
- jtbd: 3-5 jobs-to-be-done statements in the format above
- objections: 4-6 main purchase objections to address in copy
${brandContext?.product ? `\nProduct context: ${brandContext.product}` : ''}`

  const raw = await callClaude(key, prompt)
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const analysis = JSON.parse(cleaned)
  return {
    id: crypto.randomUUID(),
    source: sourceType,
    analysis,
    createdAt: new Date().toISOString(),
  }
}

// ── Hook Lab ──────────────────────────────────────────────────
export async function generateHooks({ product, targetAudience, platform, frameworks, brandVoice, count = 20 }) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings')

  const fwDescriptions = {
    curiosity:  'Curiosity Gap — open a loop the viewer MUST close (e.g. "The thing no one tells you about X")',
    contrarian: 'Contrarian — disagree with popular belief (e.g. "Stop doing X. Here\'s why it\'s killing your Y")',
    big_stat:   'Big Stat — lead with a shocking, specific number (e.g. "87% of X waste money on Y")',
    question:   'Question — ask the exact question they\'re already asking themselves',
    threat:     'Threat/Warning — call out a costly mistake they might be making',
    story:      'Story Open — drop in mid-action, in medias res',
    social:     'Social Proof — lead with someone else\'s specific result',
    interrupt:  'Pattern Interrupt — say something unexpected, weird, or counterintuitive',
  }

  const selectedFw = frameworks.length ? frameworks : Object.keys(fwDescriptions)
  const fwList = selectedFw.map((f) => `- ${fwDescriptions[f] || f}`).join('\n')

  const platformGuide = {
    tiktok:   'TikTok/Reels: max 8 words, casual, punchy, no punctuation unless dramatic pause. Start with action word or shocking claim.',
    reels:    'Instagram Reels: slightly more polished than TikTok but still fast. Can use 2 short sentences.',
    youtube:  'YouTube: 10-15 words OK. Can be a question or bold statement. Sets up the video promise.',
    linkedin: 'LinkedIn: professional but still scroll-stopping. Can be 1-2 sentences. Lead with insight or counterintuitive take.',
    twitter:  'Twitter/X: punchy observation, hot take, or shocking stat. Under 15 words.',
  }

  const voiceContext = brandVoice ? `\nBrand voice: ${brandVoice.archetype || 'creator'}, ${brandVoice.tone < 40 ? 'formal' : brandVoice.tone > 60 ? 'casual' : 'balanced'} tone.${brandVoice.neverUse?.length ? ` Never use: ${brandVoice.neverUse.join(', ')}.` : ''}` : ''

  const prompt = `You are a world-class scroll-stopping hook writer for ${platform} video content.

Product: ${product}
Target Audience: ${targetAudience || 'general audience'}
Platform rules: ${platformGuide[platform] || platformGuide.tiktok}
${voiceContext}

Generate exactly ${count} hooks using these frameworks:
${fwList}

Return ONLY a JSON array of hook objects:
[
  {
    "id": "h1",
    "text": "The exact hook text",
    "framework": "curiosity",
    "score": 8,
    "visualConcept": "Brief visual direction for the video opener"
  },
  ...
]

Scoring (1-10): 10 = stops 95%+ of scrollers, 7 = solid, 5 = generic/forgettable
Distribute frameworks proportionally. Mix high-scoring and experimental hooks.`

  const raw = await callClaudeLarge(key, prompt)
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  let hooks = JSON.parse(cleaned)
  if (!Array.isArray(hooks)) hooks = hooks.hooks || []
  hooks = hooks.map((h, i) => ({ ...h, id: h.id || `h${i}` }))
  return { hooks, platform, createdAt: new Date().toISOString() }
}

// ── Ad Score & Optimizer ──────────────────────────────────────
export async function scoreAdCopy({ headline, body, brandContext, brandVoice }) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings')

  const voiceCtx = brandVoice?.uniqueMechanism
    ? `\nBrand context: ${brandVoice.uniqueMechanism}${brandVoice.differentiators ? '. Differentiators: ' + brandVoice.differentiators : ''}`
    : brandContext?.product ? `\nProduct: ${brandContext.product}` : ''

  const prompt = `You are a direct-response advertising expert who has reviewed thousands of ads.
Score and optimize this ad copy.

HEADLINE: ${headline || '(none)'}
BODY: ${body || '(none)'}
${voiceCtx}

Return ONLY a valid JSON object:
{
  "overall": 72,
  "grade": "B",
  "summary": "One-sentence verdict",
  "dimensions": [
    {"id": "hook",     "score": 8, "suggestion": "...", "rewrite": "Optional improved version of just this element"},
    {"id": "specific", "score": 5, "suggestion": "...", "rewrite": "..."},
    {"id": "emotion",  "score": 7, "suggestion": "...", "rewrite": "..."},
    {"id": "clarity",  "score": 9, "suggestion": "...", "rewrite": "..."},
    {"id": "cta",      "score": 6, "suggestion": "...", "rewrite": "..."},
    {"id": "trust",    "score": 4, "suggestion": "...", "rewrite": "..."}
  ],
  "strengths": ["What's working — specific"],
  "weaknesses": ["Quick win — specific fix"],
  "improvedCopy": {
    "headline": "Rewritten headline applying all improvements",
    "body": "Rewritten body applying all improvements"
  }
}

Grade: A=90-100, B=80-89, C=70-79, D=60-69, F<60
For each dimension: score 1-10, specific suggestion (not generic), rewrite for weak dimensions (score < 7).
overall = weighted average: hook×25%, specific×15%, emotion×20%, clarity×15%, cta×15%, trust×10%`

  const raw = await callClaude(key, prompt)
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

// ── Voice Agent: AI system prompt generator ───────────────────
export async function generateAgentPrompt({ agentType, callDirection, brandContext, capabilities, agentName }) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings')

  const typeGuides = {
    appointment_setter: 'Book qualified appointments. Qualify the lead, handle objections, and lock in a specific date/time.',
    lead_qualifier:     'Qualify inbound leads against BANT criteria (Budget, Authority, Need, Timeline). Score them and update CRM.',
    sales_closer:       'Handle the full sales conversation, overcome objections using feel-felt-found, and close or get a commitment.',
    customer_support:   'Resolve issues efficiently and empathetically. Escalate when needed. Leave the customer feeling heard.',
    follow_up:          'Re-engage dormant or cold leads. Acknowledge the gap, re-spark interest, and move them to next step.',
    survey:             'Collect structured feedback through natural conversation. Keep it brief, warm, and genuinely curious.',
  }

  const capList = capabilities.join(', ') || 'none'
  const brand = brandContext?.brandName || 'the company'
  const product = brandContext?.product || ''

  const prompt = `Generate a complete voice agent system prompt and first message.

Agent name: ${agentName}
Agent type: ${agentType} — ${typeGuides[agentType] || agentType}
Call direction: ${callDirection}
Company: ${brand}
Product/service: ${product}
CRM capabilities available: ${capList}

Return ONLY this JSON:
{
  "systemPrompt": "Full system prompt (400-600 words). Include: persona, goal, conversation flow (opening → qualification → value → objections → close), tone guidelines, how to use CRM capabilities, when to end the call gracefully.",
  "firstMessage": "The exact first words the agent says when the call connects (1-2 sentences, warm, clear about who they are and why they're calling)"
}`

  const raw = await callClaude(key, prompt)
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

// ── Voice providers: list voices ──────────────────────────────
export async function listElevenLabsVoices(apiKey) {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)
  const data = await res.json()
  return (data.voices || []).sort((a, b) => a.name.localeCompare(b.name))
}

export async function listCartesiaVoices(apiKey) {
  const res = await fetch('https://api.cartesia.ai/voices', {
    headers: { 'X-API-Key': apiKey, 'Cartesia-Version': '2024-06-10' },
  })
  if (!res.ok) throw new Error(`Cartesia ${res.status}`)
  const data = await res.json()
  return (Array.isArray(data) ? data : data.voices || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

// ── Twilio: list phone numbers ────────────────────────────────
export async function listTwilioNumbers(accountSid, authToken) {
  const creds = btoa(`${accountSid}:${authToken}`)
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=50`,
    { headers: { Authorization: `Basic ${creds}` } }
  )
  if (!res.ok) throw new Error(`Twilio ${res.status}`)
  const data = await res.json()
  return data.incoming_phone_numbers || []
}

// ── GHL: calendars ────────────────────────────────────────────
const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VER  = '2021-07-28'

function ghlHeaders(token) {
  return { Authorization: `Bearer ${token}`, Version: GHL_VER, 'Content-Type': 'application/json' }
}

export async function fetchGHLCalendars(token, locationId) {
  const res = await fetch(`${GHL_BASE}/calendars/?locationId=${locationId}`, { headers: ghlHeaders(token) })
  if (!res.ok) throw new Error(`GHL calendars ${res.status}`)
  const data = await res.json()
  return data.calendars || []
}

export async function fetchGHLPipelines(token, locationId) {
  const res = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers: ghlHeaders(token) })
  if (!res.ok) throw new Error(`GHL pipelines ${res.status}`)
  const data = await res.json()
  return data.pipelines || []
}

export async function createGHLContact(token, locationId, contactData) {
  const res = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(token),
    body: JSON.stringify({ locationId, ...contactData }),
  })
  if (!res.ok) throw new Error(`GHL create contact ${res.status}`)
  return res.json()
}

export async function bookGHLAppointment(token, locationId, { calendarId, contactId, startTime, endTime, title }) {
  const res = await fetch(`${GHL_BASE}/calendars/events/appointments`, {
    method: 'POST',
    headers: ghlHeaders(token),
    body: JSON.stringify({ locationId, calendarId, contactId, startTime, endTime, title }),
  })
  if (!res.ok) throw new Error(`GHL book appointment ${res.status}`)
  return res.json()
}

export async function updateGHLOpportunity(token, opportunityId, updates) {
  const res = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
    method: 'PUT',
    headers: ghlHeaders(token),
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`GHL update opportunity ${res.status}`)
  return res.json()
}

// ── Voice Agent: test conversation (text simulation) ─────────
export async function testAgentConversation({ systemPrompt, history, userMessage }) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings')
  const messages = [...history, { role: 'user', content: userMessage }]
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, system: systemPrompt, messages }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ── Voice Agent server code generator ────────────────────────
export function generateVoiceAgentServerCode({ agent }) {
  const ghl = agent.ghl || {}
  const tw  = agent.twilio || {}
  const hasGHL = ghl.capabilities?.length > 0

  const ghlTools = hasGHL ? `
// GHL tool definitions for Claude function calling
const GHL_TOOLS = [
  { name: 'create_or_find_contact', description: 'Find or create a contact in GoHighLevel by phone number',
    input_schema: { type: 'object', properties: { phone: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, email: { type: 'string' } }, required: ['phone'] } },
  { name: 'book_appointment', description: 'Book a calendar appointment for the contact',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' }, startTime: { type: 'string', description: 'ISO 8601 e.g. 2025-06-15T14:00:00Z' }, title: { type: 'string' } }, required: ['contactId', 'startTime'] } },
  { name: 'update_pipeline_stage', description: 'Move contact to a pipeline stage (new/qualified/proposal/won/lost)',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' }, stage: { type: 'string' } }, required: ['contactId', 'stage'] } },
  { name: 'log_note', description: 'Log a note on the contact record',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' }, note: { type: 'string' } }, required: ['contactId', 'note'] } },
  { name: 'end_call', description: 'End the call politely when conversation is complete',
    input_schema: { type: 'object', properties: { summary: { type: 'string' } } } },
]

// GHL REST helpers
const GHL = 'https://services.leadconnectorhq.com'
function ghlHeaders() { return { Authorization: \`Bearer \${GHL_TOKEN}\`, Version: '2021-07-28', 'Content-Type': 'application/json' } }

async function ghlFindOrCreate(phone, extra = {}) {
  const s = await fetch(\`\${GHL}/contacts/?locationId=\${GHL_LOCATION_ID}&query=\${encodeURIComponent(phone)}\`, { headers: ghlHeaders() })
  const sd = await s.json()
  if (sd.contacts?.length) return sd.contacts[0]
  const r = await fetch(\`\${GHL}/contacts/\`, { method: 'POST', headers: ghlHeaders(), body: JSON.stringify({ locationId: GHL_LOCATION_ID, phone, ...extra }) })
  return (await r.json()).contact
}

async function ghlBookAppointment(contactId, startTime, title) {
  const end = new Date(new Date(startTime).getTime() + 3600000).toISOString()
  await fetch(\`\${GHL}/calendars/events/appointments\`, {
    method: 'POST', headers: ghlHeaders(),
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, calendarId: GHL_CALENDAR_ID, contactId, startTime, endTime: end, title: title || 'Booked via Voice Agent' }),
  })
}

async function ghlCreateOpportunity(contactId, status = 'open') {
  if (!GHL_PIPELINE_ID) return
  await fetch(\`\${GHL}/opportunities/\`, {
    method: 'POST', headers: ghlHeaders(),
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, pipelineId: GHL_PIPELINE_ID, contactId, name: 'Voice Agent Lead', status }),
  })
}

async function ghlAddNote(contactId, note) {
  await fetch(\`\${GHL}/contacts/\${contactId}/notes\`, {
    method: 'POST', headers: ghlHeaders(),
    body: JSON.stringify({ body: note }),
  })
}

async function executeTool(tool, callerPhone) {
  const i = tool.input
  if (tool.name === 'create_or_find_contact') return ghlFindOrCreate(i.phone || callerPhone, { firstName: i.firstName, lastName: i.lastName, email: i.email })
  if (tool.name === 'book_appointment') { await ghlBookAppointment(i.contactId, i.startTime, i.title); return { ok: true } }
  if (tool.name === 'update_pipeline_stage') { await ghlCreateOpportunity(i.contactId, i.stage); return { ok: true } }
  if (tool.name === 'log_note') { await ghlAddNote(i.contactId, i.note); return { ok: true } }
  if (tool.name === 'end_call') return { end: true, summary: i.summary }
  return {}
}` : `
const GHL_TOOLS = []
async function executeTool() { return {} }`

  const ttsBlock = agent.voiceProvider === 'cartesia' ? `
// Cartesia TTS → pcm_mulaw 8kHz (Twilio-ready)
async function textToSpeech(text) {
  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: { 'X-API-Key': CARTESIA_KEY, 'Cartesia-Version': '2024-06-10', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: 'sonic-english', transcript: text, voice: { mode: 'id', id: VOICE_ID }, output_format: { container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 } }),
  })
  if (!res.ok) throw new Error('Cartesia TTS ' + res.status + ': ' + await res.text())
  return Buffer.from(await res.arrayBuffer())
}` : agent.voiceProvider === 'deepgram' ? `
// Deepgram Aura TTS → mulaw 8kHz (Twilio-ready)
async function textToSpeech(text) {
  const res = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000', {
    method: 'POST',
    headers: { Authorization: \`Token \${DEEPGRAM_KEY}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Deepgram TTS ' + res.status)
  return Buffer.from(await res.arrayBuffer())
}` : `
// ElevenLabs TTS → ulaw_8000 (Twilio-ready, no conversion needed)
async function textToSpeech(text) {
  const res = await fetch(\`https://api.elevenlabs.io/v1/text-to-speech/\${VOICE_ID}?output_format=ulaw_8000\`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  })
  if (!res.ok) throw new Error('ElevenLabs TTS ' + res.status + ': ' + await res.text())
  return Buffer.from(await res.arrayBuffer())
}`

  const llmProvider = agent.llmModel?.startsWith('gpt') ? 'openai'
    : agent.llmModel?.startsWith('gemini') ? 'google' : 'anthropic'

  const llmBlock = llmProvider === 'openai' ? `
// OpenAI GPT LLM
async function getLLMResponse(history) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: \`Bearer \${OPENAI_KEY}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LLM_MODEL, max_tokens: 400, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history], tools: GHL_TOOLS.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })), tool_choice: GHL_TOOLS.length ? 'auto' : undefined }),
  })
  const data = await res.json()
  const msg = data.choices[0].message
  return { text: msg.content || '', toolUse: (msg.tool_calls || []).map(tc => ({ id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) })), stopReason: data.choices[0].finish_reason }
}` : `
// Claude LLM with tool use
async function getLLMResponse(history) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LLM_MODEL, max_tokens: 400, system: SYSTEM_PROMPT, messages: history, ...(GHL_TOOLS.length ? { tools: GHL_TOOLS } : {}) }),
  })
  if (!res.ok) throw new Error('LLM error ' + res.status + ': ' + await res.text())
  const data = await res.json()
  return {
    text: data.content.filter(c => c.type === 'text').map(c => c.text).join(' '),
    toolUse: data.content.filter(c => c.type === 'tool_use').map(t => ({ id: t.id, name: t.name, input: t.input })),
    stopReason: data.stop_reason,
  }
}`

  return `// =================================================================
// Voice Agent: ${agent.name}
// Type: ${agent.type} | Direction: ${agent.callDirection}
// Voice: ${agent.voiceProvider}/${agent.voiceName || agent.voiceId}
// LLM: ${agent.llmModel}
// Generated by Brayne AI Marketing Suite
// =================================================================
// Deploy: Railway / Render / Fly.io / any Node host
// npm install && node server.js
// =================================================================

require('dotenv').config()
const express   = require('express')
const http      = require('http')
const WebSocket = require('ws')
const twilio    = require('twilio')

const app    = express()
const server = http.createServer(app)
const wss    = new WebSocket.Server({ server, path: '/stream' })

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// ── Config (all values from .env) ───────────────────────────
const AGENT_NAME    = process.env.AGENT_NAME    || '${(agent.name || '').replace(/'/g, "\'")}'
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || \`${(agent.systemPrompt || '').replace(/`/g, '\`')}\`
const FIRST_MESSAGE = process.env.FIRST_MESSAGE || \`${(agent.firstMessage || 'Hello, how can I help you today?').replace(/`/g, '\`')}\`
const LLM_MODEL     = process.env.LLM_MODEL     || '${agent.llmModel}'
const VOICE_ID      = process.env.VOICE_ID      || '${agent.voiceId || ''}'
const LANGUAGE      = process.env.LANGUAGE      || '${agent.language || 'en'}'
const MAX_MINUTES   = parseInt(process.env.MAX_MINUTES || '${agent.maxCallMinutes || 10}')

// API Keys
const ANTHROPIC_KEY  = process.env.ANTHROPIC_KEY  || ''
const OPENAI_KEY     = process.env.OPENAI_KEY     || ''
const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY || ''
const CARTESIA_KEY   = process.env.CARTESIA_KEY   || ''
const DEEPGRAM_KEY   = process.env.DEEPGRAM_KEY   || ''

// Twilio (per-agent)
const TWILIO_SID   = process.env.TWILIO_SID   || '${tw.accountSid || ''}'
const TWILIO_TOKEN = process.env.TWILIO_TOKEN || '${tw.authToken || ''}'

// GHL (per-subaccount)
const GHL_TOKEN       = process.env.GHL_TOKEN       || '${ghl.token || ''}'
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '${ghl.locationId || ''}'
const GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID || '${ghl.calendarId || ''}'
const GHL_PIPELINE_ID = process.env.GHL_PIPELINE_ID || '${ghl.pipelineId || ''}'
${ghlTools}
${ttsBlock}
${llmBlock}

// ── Twilio Voice webhook ─────────────────────────────────────
app.post('/twilio/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse()
  const connect = twiml.connect()
  connect.stream({ url: \`wss://\${req.headers.host}/stream\` })
  res.type('text/xml').send(twiml.toString())
})

app.get('/health', (_req, res) => res.json({ ok: true, agent: AGENT_NAME }))

// ── Media Stream WebSocket ───────────────────────────────────
wss.on('connection', (ws) => {
  let streamSid   = null
  let callSid     = null
  let callerPhone = ''
  let dgWs        = null
  const history   = []
  let speaking    = false
  let endPending  = false

  // Send audio buffer back to Twilio
  const sendAudio = (buf) => {
    if (ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: buf.toString('base64') } }))
  }

  // TTS → Twilio
  const speak = async (text) => {
    if (!text?.trim()) return
    console.log('[Agent]', text)
    speaking = true
    try {
      const audio = await textToSpeech(text)
      sendAudio(audio)
      // Rough duration estimate to avoid cutting off: 100ms per word, min 800ms
      await new Promise(r => setTimeout(r, Math.max(800, text.split(' ').length * 120)))
    } catch (err) { console.error('[TTS Error]', err.message) }
    speaking = false
  }

  // Handle user transcript from Deepgram
  const handleTranscript = async (transcript) => {
    if (!transcript?.trim() || speaking || endPending) return
    console.log('[User]', transcript)
    history.push({ role: 'user', content: transcript })

    let response = await getLLMResponse(history)

    // Process tool calls (GHL actions)
    while (response.toolUse?.length) {
      const toolResults = []
      for (const tool of response.toolUse) {
        console.log('[Tool]', tool.name, tool.input)
        const result = await executeTool(tool, callerPhone)
        if (result?.end) endPending = true
        toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) })
      }
      history.push({ role: 'assistant', content: response.toolUse.map(t => ({ type: 'tool_use', id: t.id, name: t.name, input: t.input })) })
      history.push({ role: 'user', content: toolResults })
      if (endPending) { await speak('Thank you so much for your time. Have a great day — goodbye!'); ws.close(); return }
      response = await getLLMResponse(history)
    }

    history.push({ role: 'assistant', content: response.text })
    await speak(response.text)
  }

  // Open Deepgram STT WebSocket
  const initDeepgram = () => {
    const url = 'wss://api.deepgram.com/v1/listen?' +
      \`encoding=mulaw&sample_rate=8000&channels=1&\` +
      \`model=nova-2&language=\${LANGUAGE}&\` +
      \`endpointing=300&utterance_end_ms=1200&\` +
      \`interim_results=true&smart_format=true\`

    const dg = new WebSocket(url, { headers: { Authorization: \`Token \${DEEPGRAM_KEY}\` } })
    dg.on('open',  () => console.log('[Deepgram] Connected'))
    dg.on('error', (e) => console.error('[Deepgram Error]', e.message))
    dg.on('close', () => console.log('[Deepgram] Disconnected'))
    dg.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw)
        if (msg.type !== 'Results') return
        const transcript = msg.channel?.alternatives?.[0]?.transcript
        if (transcript && msg.is_final) handleTranscript(transcript).catch(console.error)
      } catch {}
    })
    return dg
  }

  // Call timeout
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      speak('I need to wrap up our call now. Thank you and have a great day!').then(() => ws.close())
    }
  }, MAX_MINUTES * 60 * 1000)

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw)

      if (msg.event === 'start') {
        streamSid   = msg.start.streamSid
        callSid     = msg.start.callSid
        callerPhone = msg.start.customParameters?.callerPhone || ''
        console.log('[Call Started]', callSid)
        dgWs = initDeepgram()
        dgWs.on('open', async () => {
          await new Promise(r => setTimeout(r, 400))
          await speak(FIRST_MESSAGE)
        })
      }

      if (msg.event === 'media' && msg.media?.track === 'inbound') {
        if (dgWs?.readyState === WebSocket.OPEN) {
          dgWs.send(Buffer.from(msg.media.payload, 'base64'))
        }
      }

      if (msg.event === 'stop') {
        console.log('[Call Ended]', callSid)
        dgWs?.close()
      }
    } catch (err) { console.error('[Stream Error]', err.message) }
  })

  ws.on('close', () => dgWs?.close())
  ws.on('error', (e) => console.error('[WS Error]', e.message))
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(\`[${agent.name || 'Voice Agent'}] Running on port \${PORT}\`)
  console.log(\`Set Twilio webhook → POST https://YOUR_DOMAIN/twilio/voice\`)
})
`
}

export function generatePackageJson(agent) {
  return JSON.stringify({
    name: (agent.name || 'voice-agent').toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Voice Agent: ' + (agent.name || 'voice-agent') + ' — generated by Brayne AI',
    main: 'server.js',
    scripts: { start: 'node server.js', dev: 'node --watch server.js' },
    dependencies: {
      express: '^4.18.2',
      ws: '^8.16.0',
      twilio: '^5.0.0',
      dotenv: '^16.4.5',
    },
  }, null, 2)
}

// ── Scrape website for services/products ─────────────────────
export async function scrapeWebsiteForServices(url) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings')

  // Jina Reader converts any URL to clean markdown — no CORS issues
  const cleanUrl = url.startsWith('http') ? url : `https://${url}`
  const readerRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
    headers: { Accept: 'text/plain' },
  })
  if (!readerRes.ok) throw new Error(`Could not read website (${readerRes.status})`)
  const rawText = await readerRes.text()
  const truncated = rawText.slice(0, 7000)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Extract business information from this website and return ONLY valid JSON (no markdown, no explanation):

{
  "companyName": "string",
  "tagline": "1-sentence tagline",
  "services": [
    { "id": "svc_1", "name": "Service Name", "description": "1-2 sentence description" }
  ]
}

Include up to 12 services/products/offers. Give each a unique id like svc_1, svc_2, etc.

Website content:
${truncated}`,
      }],
    }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const data = await res.json()
  const text = data.content?.[0]?.text || '{}'
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse website data')
  return JSON.parse(match[0])
}

// ── Generate agent prompt from scraped services ───────────────
export async function generateAgentPromptFromServices({ companyName, services, callDirection, firstMessage, language }) {
  const key = getKey('anthropic')
  if (!key) throw new Error('Add your Anthropic key in Settings')

  const serviceList = services.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join('\n')
  const direction = callDirection === 'outbound' ? 'outbound (you call the lead first)' : 'inbound (the customer called in)'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Create a voice AI agent system prompt for a ${direction} call agent for "${companyName}".

Services the agent handles:
${serviceList}

Language: ${language || 'en'}
${firstMessage ? `Opening message: "${firstMessage}"` : ''}

Return ONLY valid JSON (no markdown):
{
  "systemPrompt": "Full system prompt (300-500 words, written in second person 'You are...'). Include: role, company, services they can discuss/book, how to qualify leads, when to book appointments, objection handling, call ending procedure. Keep it conversational for voice — short sentences, natural pacing.",
  "firstMessage": "Natural opening line (1-2 sentences, warm and conversational)"
}`,
      }],
    }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const data = await res.json()
  const text = data.content?.[0]?.text || '{}'
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse prompt')
  return JSON.parse(match[0])
}

export function generateEnvExample(agent) {
  const ghl = agent.ghl || {}
  const tw  = agent.twilio || {}
  return [
    '# === Voice Agent Config ===',
    `AGENT_NAME="${agent.name}"`,
    `SYSTEM_PROMPT="(paste your system prompt here)"`,
    `FIRST_MESSAGE="${agent.firstMessage || 'Hello, how can I help you today?'}"`,
    `LLM_MODEL=${agent.llmModel}`,
    `LANGUAGE=${agent.language || 'en'}`,
    `MAX_MINUTES=${agent.maxCallMinutes || 10}`,
    '',
    '# === Voice ===',
    `VOICE_ID=${agent.voiceId || 'your_voice_id'}`,
    '',
    '# === API Keys ===',
    'ANTHROPIC_KEY=sk-ant-...',
    'DEEPGRAM_KEY=your_deepgram_key',
    agent.voiceProvider === 'elevenlabs' ? 'ELEVENLABS_KEY=sk_...' : '',
    agent.voiceProvider === 'cartesia'   ? 'CARTESIA_KEY=sk_car_...' : '',
    agent.voiceProvider === 'hume'       ? 'HUME_KEY=...' : '',
    '',
    '# === Twilio (per agent) ===',
    `TWILIO_SID=${tw.accountSid || 'AC...'}`,
    `TWILIO_TOKEN=${tw.authToken || 'your_auth_token'}`,
    '',
    ghl.capabilities?.length ? '# === GoHighLevel (per subaccount) ===' : '',
    ghl.capabilities?.length ? `GHL_TOKEN=${ghl.token || 'eyJhbGci...'}` : '',
    ghl.capabilities?.length ? `GHL_LOCATION_ID=${ghl.locationId || 'your_location_id'}` : '',
    ghl.capabilities?.includes('calendar') ? `GHL_CALENDAR_ID=${ghl.calendarId || 'your_calendar_id'}` : '',
    ghl.capabilities?.includes('opportunities') ? `GHL_PIPELINE_ID=${ghl.pipelineId || 'your_pipeline_id'}` : '',
  ].filter(l => l !== null && l !== undefined).join('\n').trim()
}



// ── Vapi: sync assistant + trigger call ──────────────────────
export async function syncVapiAssistant(agent, vapiKey) {
  const voiceMap = {
    elevenlabs: { provider: '11labs',  voiceId: agent.voiceId },
    cartesia:   { provider: 'cartesia', voiceId: agent.voiceId },
    deepgram:   { provider: 'deepgram', voiceId: agent.voiceId || 'aura-asteria-en' },
  }
  const body = {
    name: agent.name || 'Voice Agent',
    firstMessage: agent.firstMessage || 'Hello! How can I help you today?',
    model: {
      provider: 'anthropic',
      model: agent.llmModel || 'claude-sonnet-4-6',
      messages: [{ role: 'system', content: agent.systemPrompt || 'You are a helpful voice assistant.' }],
    },
    voice: voiceMap[agent.voiceProvider] || voiceMap.deepgram,
    transcriber: { provider: 'deepgram', model: 'nova-2', language: agent.language || 'en' },
    maxDurationSeconds: (agent.maxCallMinutes || 10) * 60,
  }
  const method = agent.vapiAssistantId ? 'PATCH' : 'POST'
  const url = agent.vapiAssistantId
    ? `https://api.vapi.ai/assistant/${agent.vapiAssistantId}`
    : 'https://api.vapi.ai/assistant'
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Vapi ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function triggerVapiCall({ vapiKey, assistantId, toPhone, fromPhone, twilioAccountSid, twilioAuthToken }) {
  const res = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assistantId,
      customer: { number: toPhone },
      phoneNumber: {
        twilioPhoneNumber: fromPhone,
        twilioAccountSid,
        twilioAuthToken,
      },
    }),
  })
  if (!res.ok) throw new Error(`Vapi ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Twilio: trigger a call ────────────────────────────────────
export async function triggerTwilioCall({ accountSid, authToken, from, to, webhookUrl }) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`
  const body = new URLSearchParams({ From: from, To: to, Url: webhookUrl, Method: 'POST' })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Twilio ${res.status}: ${txt}`)
  }
  return res.json()
}

// ── Generate render.yaml for one-click Render deploy ─────────
export function generateRenderYaml(agent) {
  const name = (agent.name || 'voice-agent').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `services:
  - type: web
    name: ${name}
    env: node
    region: oregon
    plan: free
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: PORT
        value: 3000
      - key: AGENT_NAME
        value: ${agent.name || 'Voice Agent'}
      - key: LLM_MODEL
        value: ${agent.llmModel || 'claude-sonnet-4-6'}
      - key: VOICE_ID
        value: ${agent.voiceId || ''}
      - key: LANGUAGE
        value: ${agent.language || 'en'}
      - key: MAX_MINUTES
        value: ${agent.maxCallMinutes || 10}
      - key: ANTHROPIC_KEY
        sync: false
      - key: DEEPGRAM_KEY
        sync: false
      - key: ${agent.voiceProvider === 'elevenlabs' ? 'ELEVENLABS_KEY' : agent.voiceProvider === 'cartesia' ? 'CARTESIA_KEY' : 'DEEPGRAM_KEY'}
        sync: false
      - key: TWILIO_SID
        value: ${agent.twilio?.accountSid || ''}
      - key: TWILIO_TOKEN
        sync: false
${(agent.ghl?.capabilities?.length) ? `      - key: GHL_TOKEN
        sync: false
      - key: GHL_LOCATION_ID
        value: ${agent.ghl?.locationId || ''}
${agent.ghl?.calendarId ? `      - key: GHL_CALENDAR_ID
        value: ${agent.ghl.calendarId}` : ''}` : ''}
`
}

// LLM provider map (used by code generator)
const LLM_MODELS_MAP = {
  'claude-sonnet-4-6': 'anthropic', 'claude-opus-4-6': 'anthropic', 'claude-haiku-4-5-20251001': 'anthropic',
  'gpt-4o': 'openai', 'gpt-4o-mini': 'openai',
  'gemini-2.0-flash': 'google',
}
