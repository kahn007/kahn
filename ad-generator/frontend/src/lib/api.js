import { getKey } from './keys'
import { v4 as uuidv4 } from 'uuid'

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

  const painPoints = insights?.painPoints?.slice(0, 4).map((p) => p.text) || [
    `Wasting hours on ${brandContext.product} with no results`,
    `No idea which approach actually converts`,
    `Spending money without knowing what works`,
    `Falling behind while competitors scale`,
  ]
  const outcomes = insights?.desiredOutcomes?.slice(0, 3).map((o) => o.text) || [
    `Get measurable results fast`,
    `Know exactly what works before spending big`,
    `Scale confidently`,
  ]
  const objections = insights?.objections?.slice(0, 3) || [
    `Is this right for my situation?`,
    `How long does it take to see results?`,
    `What if it doesn't work for me?`,
  ]
  const triggers = insights?.triggerPhrases?.slice(0, 4) || []

  const competitorEdge = competitorIntel ? `
COMPETITOR INTELLIGENCE — use to position us as the superior choice:
- Market gaps our page should exploit: ${competitorIntel.gapOpportunities?.join('; ')}
- Our differentiators to highlight prominently: ${competitorIntel.suggestedDifferentiators?.join('; ')}
- Competitor weaknesses to contrast against: ${competitorIntel.competitors?.map((c) => c.weaknesses).filter(Boolean).join('; ')}` : ''

  // Use pageConfig values if provided, otherwise fall back to brandContext
  const pc = pageConfig || {}
  const ctaUrl = pc.ctaUrl || brandContext.landingPageUrl || '#'
  const brand = pc.companyName || brandContext.brandName || 'Our Solution'
  const audience = variation.targetSegment || brandContext.targetAudience || 'professionals'
  const tagline = pc.tagline || ''
  const trustMetric = pc.trustMetric || '2,400+ customers'
  const logoHtml = pc.logoSrc
    ? `<img src="${pc.logoSrc}" alt="${brand}" style="height:32px;object-fit:contain;" />`
    : `<div style="width:32px;height:32px;border-radius:8px;background:var(--accent);display:inline-block;"></div>`

  // Design system from theme
  const bgColor    = pc.bg      || '#080c14'
  const bg2Color   = pc.surface || '#0d1422'
  const bg3Color   = pc.bg3     || (pc.light ? '#f1f5f9' : '#131929')
  const accentColor  = pc.accent  || '#6c63ff'
  const accent2Color = pc.accent2 || '#8b5cf6'
  const accentGlow   = accentColor + '40'
  const textColor    = pc.textColor || '#f1f5f9'
  const mutedColor   = pc.light ? '#64748b' : '#94a3b8'
  const borderColor  = pc.light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'

  const prompt = `You are a senior conversion-rate optimization expert and award-winning web designer. Your landing pages generate 8-15% conversion rates. You are about to build a complete, pixel-perfect, professional HTML landing page.

═══════════════════════════════════════════════════════
AD TO MATCH (message-match is the #1 conversion factor)
═══════════════════════════════════════════════════════
Brand: ${brand}
Website: ${brandContext.website || ctaUrl}
Product: ${brandContext.product}
Target audience: ${audience}
Ad headline: "${variation.headline}"
Ad copy: "${variation.primaryText}"
CTA button text: "${variation.cta || 'Get Started'}"
CTA URL: ${ctaUrl}
Ad angle: ${variation.angle || 'general'}
${tagline ? `Brand tagline: "${tagline}"` : ''}
Social proof metric: "${trustMetric}"

AUDIENCE INTELLIGENCE:
Pain points: ${painPoints.join(' | ')}
Desired outcomes: ${outcomes.join(' | ')}
Objections to handle: ${objections.join(' | ')}
${triggers.length ? `Trigger phrases that resonate: ${triggers.join(', ')}` : ''}
${competitorEdge}

═══════════════════════════════════════
MANDATORY DESIGN SYSTEM (follow exactly)
═══════════════════════════════════════
Typography: Load Inter from Google Fonts (weights 400, 500, 600, 700, 800, 900)
Root CSS variables:
  --bg: ${bgColor}
  --bg2: ${bg2Color}
  --bg3: ${bg3Color}
  --border: ${borderColor}
  --accent: ${accentColor}
  --accent2: ${accent2Color}
  --accent-glow: ${accentGlow}
  --text: ${textColor}
  --muted: ${mutedColor}
  --success: #10b981
  --radius: 16px
  --radius-sm: 10px
LOGO HTML (use exactly as-is in the navbar and footer): ${logoHtml}

Max page width: 1100px, centered with auto margins
Section vertical padding: 100px top/bottom (60px mobile)
All body copy: font-size 17px, line-height 1.7, color var(--muted)
All primary headings: font-weight 800, color var(--text), letter-spacing -0.02em

═══════════════════════════════════════════════════════
SECTIONS — BUILD ALL OF THESE IN ORDER
═══════════════════════════════════════════════════════

1. STICKY NAVBAR
   - Fixed top, backdrop-filter blur(20px), bg rgba from var(--bg) at 0.85 opacity
   - Left: use the LOGO HTML provided above exactly, then brand name "${brand}" in var(--text) font-weight 700
   - Right: one ghost link "Features" + one solid accent CTA button "${variation.cta || 'Get Started'}" linking to ${ctaUrl}
   - No border bottom, subtle box-shadow

2. HERO SECTION (above-the-fold, full viewport height optional)
   - Announcement pill badge at top: small rounded pill, gradient border, text like "New · [short benefit]"
   - H1 headline: MUST mirror the ad headline closely. 52px desktop / 36px mobile. Font-weight 900. White.
   - Support headline: expand on the ad's promise in 1 sentence, 22px, --muted color
   - Short 2-line paragraph reinforcing the specific pain point from the ad copy
   - TWO buttons side by side: primary solid accent + secondary ghost (e.g. "See how it works →")
   - Social proof micro-line below buttons: avatar stack (5 colored circles with initials) + "${trustMetric}"
   - Decorative: large blurred radial gradient glow behind the headline (accent color, opacity 0.15)

3. TRUST BAR (full-width strip)
   - Subtle bg var(--bg2), border top + bottom var(--border)
   - "Trusted by teams at" label in --muted, then 5 company names in muted white, font-weight 600
   - Use plausible company names relevant to ${audience}

4. PAIN / PROBLEM SECTION
   - Section label: small uppercase tracking-widest text in accent color: "THE PROBLEM"
   - H2: "You already know the struggle." — make it feel personal to ${audience}
   - 4 pain point cards in a 2×2 grid (1-col on mobile):
     Each card: rounded-2xl, bg var(--bg3), border var(--border), padding 28px
     Icon: large emoji relevant to the pain (❌, 😤, 💸, ⏰ etc.)
     Bold title (1 line) + supporting sentence
     Use the pain points: ${painPoints.slice(0, 4).join(' | ')}

5. SOLUTION / FEATURES SECTION
   - Section label: "THE SOLUTION"
   - H2: Position ${brand} as the answer — bold and specific
   - Subheadline: one sentence promise
   - 3 feature cards in a row (stack on mobile), each with:
     Icon block: 52px square, rounded-xl, gradient accent bg, white emoji or symbol inside
     Feature title: font-weight 700, 18px
     Feature body: 2-3 sentences, specific benefit, --muted color
     Small "Learn more →" link in accent color
   - Use the desired outcomes: ${outcomes.join(' | ')}

6. HOW IT WORKS (numbered steps)
   - H2: "Up and running in minutes"
   - 3 horizontal steps on desktop (vertical on mobile), connected by dashed line
   - Each step: large number (80px, very light opacity, accent color), bold step title, 1-sentence description
   - Steps should reflect the actual product workflow

7. SOCIAL PROOF — TESTIMONIALS
   - Section label: "WHAT THEY'RE SAYING"
   - H2: Results from real ${audience}
   - 3 testimonial cards in a row (stack on mobile):
     Card bg: var(--bg3), border var(--border), rounded-2xl, padding 32px
     Top: 5 gold stars (★★★★★) in gold color (#f59e0b)
     Quote: italic, 16px, --text color, specific and credible (mention product outcomes with numbers)
     Bottom: avatar circle (48px, gradient bg, white initials) + Name (bold) + Role, Company
   - FABRICATE realistic names, roles, and specific outcome-driven quotes relevant to ${audience}
   - One quote must mention a specific number (e.g. "3x", "47%", "$12k", "saved 8 hours")

8. COMPARISON TABLE
   - H2: "Why ${brand} vs the alternatives"
   - Table with 4 rows of comparison criteria
   - Columns: Feature | ${brand} (checkmark ✓ in green) | Typical Alternatives (✗ in muted red)
   - Make the differentiators specific and meaningful to ${audience}
   - Accent the ${brand} column header with a "Recommended" badge

9. FAQ SECTION
   - H2: "Frequently Asked Questions"
   - 4 FAQ items with smooth JavaScript accordion (click to expand/collapse)
   - Each item: border-bottom separator, question in white font-weight 600, answer in --muted
   - Animated chevron rotation on open
   - Cover the objections: ${objections.join(' | ')}
   - Plus one more common question

10. FINAL CTA SECTION
    - Full-width section with radial gradient background (accent color glow)
    - H2: Urgent, specific call to action (not generic — tie it to the ad's promise)
    - Short paragraph: what happens after they click
    - Large primary CTA button (min-width 260px, height 56px) + ghost secondary
    - Small trust line below: "No credit card required · Cancel anytime" or similar
    - Subtle decorative elements (blurred circles in background)

11. FOOTER
    - bg var(--bg2), border-top var(--border), padding 48px 0
    - Left: logo + brand name + tagline (1 line, --muted)
    - Center: 3-4 nav links (Features, Pricing, About, Contact) in --muted
    - Right: copyright "© 2025 ${brand}. All rights reserved."

═══════════════════════════════════════
JAVASCRIPT REQUIREMENTS
═══════════════════════════════════════
1. FAQ accordion: click expands/collapses answer, chevron rotates 180deg, smooth max-height transition
2. Scroll animations: use IntersectionObserver — add class 'visible' to elements with class 'reveal' when they enter viewport. CSS: .reveal { opacity:0; transform:translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease } .reveal.visible { opacity:1; transform:none }
3. Smooth scroll: html { scroll-behavior: smooth }
4. Sticky nav shadow: add box-shadow on scroll past 60px

═══════════════════════════════════════
CSS REQUIREMENTS
═══════════════════════════════════════
- Full reset: *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
- body: font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased
- Primary button: gradient accent bg, white text, font-weight 600, padding 14px 32px, border-radius 12px, no border, cursor pointer, transition all 0.2s, hover: brightness(1.1) translateY(-1px), box-shadow accent glow
- Ghost button: transparent bg, 1.5px solid rgba(255,255,255,0.2), white text, same padding/radius, hover: border-color white
- All section headings: add 'reveal' class for animation
- All cards: add 'reveal' class for animation
- Grid layouts use CSS Grid (not flexbox for multi-column)
- Responsive: single breakpoint @media(max-width: 768px) collapses all grids to 1 column

CRITICAL RULES:
- Return ONLY the complete HTML. Start immediately with <!DOCTYPE html>. Zero explanation, zero markdown.
- The page must look like it was built by a $50,000/month agency. Every detail matters.
- CTA URL for ALL buttons and links: ${ctaUrl}
- The hero headline MUST closely mirror: "${variation.headline}"
- The tone MUST match the ad angle (${variation.angle}) throughout
- Include Google Fonts link tag in <head>
- All CSS in one <style> tag in <head>
- All JS in one <script> tag before </body>
- No external resources except Google Fonts`

  // Use higher token limit for landing pages
  const raw = await callClaudeLarge(key, prompt)
  const cleaned = raw.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim()
  return cleaned
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
