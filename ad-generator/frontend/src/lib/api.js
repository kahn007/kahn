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
