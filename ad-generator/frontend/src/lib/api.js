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

  const prompt = `You are the world's best conversion-focused landing page developer. Your pages look like they were built by a $200k/year agency and consistently hit 10-18% conversion rates. You write copy that makes people feel understood and creates unstoppable urgency to act. You are about to build a complete, breathtaking, professional HTML landing page.

════════════════════════════════════════════
CONTEXT — READ CAREFULLY
════════════════════════════════════════════
Brand: ${brand}
Product/Service: ${brandContext.product}
Target audience: ${audience}
Website: ${brandContext.website || ctaUrl}
${tagline ? `Tagline: "${tagline}"` : ''}

AD TO MATCH (message-match is the #1 conversion lever):
  Headline: "${variation.headline}"
  Body copy: "${variation.primaryText}"
  CTA text: "${variation.cta || 'Get Started'}"
  Ad angle: ${variation.angle || 'general'}
  CTA URL (ALL buttons link here): ${ctaUrl}

SOCIAL PROOF METRIC: "${trustMetric}"

AUDIENCE PAIN POINTS: ${painPoints.join(' · ')}
DESIRED OUTCOMES: ${outcomes.join(' · ')}
OBJECTIONS TO HANDLE: ${objections.join(' · ')}
${triggers.length ? `RESONANT PHRASES: ${triggers.join(', ')}` : ''}
${competitorEdge}

════════════════════════════════════════════
DESIGN SYSTEM — IMPLEMENT EXACTLY
════════════════════════════════════════════
Font: Inter from Google Fonts (weights 300,400,500,600,700,800,900)

CSS :root variables (bake these in):
  --bg:           ${bgColor};
  --bg2:          ${bg2Color};
  --bg3:          ${bg3Color};
  --border:       ${borderColor};
  --accent:       ${accentColor};
  --accent2:      ${accent2Color};
  --accent-glow:  ${accentGlow};
  --text:         ${textColor};
  --muted:        ${mutedColor};
  --success:      #10b981;
  --warn:         #f59e0b;
  --danger:       #ef4444;

LOGO HTML — use exactly in navbar and footer: ${logoHtml}

COMPONENT PATTERNS — use these throughout:

/* Gradient text (use on hero H1 partial words or stats numbers) */
.grad { background: linear-gradient(135deg, ${textColor} 30%, ${accentColor} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

/* Glass card */
.glass { background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%); backdrop-filter: blur(12px); border: 1px solid ${borderColor}; border-radius: 20px; }

/* Card hover lift */
.card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; }
.card-hover:hover { transform: translateY(-5px); box-shadow: 0 24px 48px rgba(0,0,0,0.35); border-color: ${accentColor}44; }

/* Gradient button */
.btn-grad { background: linear-gradient(135deg, ${accentColor} 0%, ${accent2Color} 100%); color: #fff; font-weight: 700; padding: 15px 36px; border-radius: 14px; border: none; cursor: pointer; font-size: 15px; letter-spacing: -0.01em; transition: all 0.25s ease; box-shadow: 0 4px 20px ${accentGlow}; }
.btn-grad:hover { transform: translateY(-2px); box-shadow: 0 8px 32px ${accentColor}55; filter: brightness(1.08); }

/* Ghost button */
.btn-ghost { background: transparent; color: ${textColor}; font-weight: 600; padding: 15px 36px; border-radius: 14px; border: 1.5px solid ${borderColor}; cursor: pointer; font-size: 15px; transition: all 0.2s; }
.btn-ghost:hover { border-color: ${textColor}60; background: rgba(255,255,255,0.04); }

/* Section label pill */
.label-pill { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${accentColor}; background: ${accentColor}18; border: 1px solid ${accentColor}35; padding: 5px 14px; border-radius: 100px; margin-bottom: 20px; }

/* Announcement pill (hero) */
.announce { display: inline-flex; align-items: center; gap: 8px; background: ${accentColor}12; border: 1px solid ${accentColor}30; padding: 7px 16px; border-radius: 100px; font-size: 13px; color: ${mutedColor}; margin-bottom: 32px; }
.announce-dot { width: 7px; height: 7px; border-radius: 50%; background: ${accentColor}; box-shadow: 0 0 8px ${accentColor}; flex-shrink: 0; }

/* Section spacing */
section { padding: 110px 0; }
.container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.section-center { text-align: center; max-width: 720px; margin: 0 auto 64px; }

/* Typography */
h1 { font-size: clamp(42px, 6vw, 78px); font-weight: 900; line-height: 1.05; letter-spacing: -0.03em; color: ${textColor}; }
h2 { font-size: clamp(32px, 4vw, 52px); font-weight: 800; line-height: 1.1; letter-spacing: -0.025em; color: ${textColor}; margin-bottom: 20px; }
p.lead { font-size: 19px; line-height: 1.65; color: ${mutedColor}; }

NEVER use opacity:0. NEVER hide content. Everything visible immediately on load.

════════════════════════════════════════════
BUILD ALL 12 SECTIONS IN EXACT ORDER
════════════════════════════════════════════

━━━ 1. STICKY NAVBAR ━━━
- position: fixed; top:0; left:0; right:0; z-index:1000
- background: ${bgColor}dd; backdrop-filter: blur(20px) saturate(180%); border-bottom: 1px solid ${borderColor}
- Inner flex: logo+name LEFT | nav links CENTER (Features, How it works, Testimonials) | CTA button RIGHT
- Logo: use LOGO HTML above exactly + brand name "${brand}" in ${textColor} font-weight:700 font-size:16px
- CTA button: .btn-grad style, text "${variation.cta || 'Get Started'}", links to ${ctaUrl}
- JS: on scroll past 80px, add box-shadow: 0 4px 30px rgba(0,0,0,0.4) to navbar

━━━ 2. HERO ━━━
- min-height: 100vh; display:flex; align-items:center; padding-top:80px (navbar offset)
- BACKGROUND: position:relative; overflow:hidden
  Decorative absolute positioned blobs (pointer-events:none, z-index:0):
    Blob 1: width:700px height:600px rounded-full background:radial-gradient(circle, ${accentColor}20 0%, transparent 70%) top:-200px left:-100px
    Blob 2: width:500px height:500px rounded-full background:radial-gradient(circle, ${accent2Color}15 0%, transparent 70%) bottom:-100px right:-50px
  All hero content in a relative z-index:1 container
- Announcement pill (.announce): "⚡ New · [write a 1-sentence specific benefit based on the product]"
- H1: MUST closely mirror "${variation.headline}" — can add a line break for emphasis. Apply .grad class to 1-3 key words.
- Subheadline (p.lead): one punchy sentence expanding on the ad promise, max-width:620px
- Body: 2 sentences addressing the core pain point from the ad copy
- Button row (flex gap:16px margin-top:40px): .btn-grad "${variation.cta || 'Get Started'}" href="${ctaUrl}" + .btn-ghost "See how it works →" links to #how
- SOCIAL PROOF ROW (margin-top:32px): flex align-center gap:12px
    5 avatar circles (40px, gradient bg, white initials, -8px overlap) + bold text "${trustMetric}" in ${textColor} + muted subtext "and counting"

━━━ 2b. HERO VISUAL (right side, or below on mobile) ━━━
On desktop: make hero a 2-column grid. Right column: a stylized "product dashboard" built entirely in HTML/CSS:
  A rounded-2xl container (background:${bg2Color}; border:1px solid ${borderColor}; padding:20px; max-width:480px)
  Inside: fake UI elements relevant to the product — stat cards, a mini bar chart using CSS bars, status indicators.
  Make it look like an actual product screenshot. Use the brand colors. This replaces any placeholder image.

━━━ 3. SOCIAL PROOF BAR (trust strip) ━━━
- background: ${bg2Color}; border-top/bottom: 1px solid ${borderColor}; padding: 22px 0;
- Flex, centered, gap:48px, flex-wrap:wrap
- "Trusted by 2,400+ companies including:" in ${mutedColor} + 5 recognizable company NAME ONLY (bold, ${textColor}cc, font-size:15px)
- Pick names plausible for ${audience}

━━━ 4. METRICS / STATS (new section) ━━━
- background: ${bg2Color}
- 4 stat cards in a CSS grid (4 cols desktop, 2x2 mobile), each card:
  Big number (56px, font-weight:900, .grad class): invent a believable metric related to the product (e.g. "3×", "47%", "8h", "$12k")
  Label below (14px, ${mutedColor}): what that number means
  Small description (12px, ${mutedColor}cc): one extra line of context
- Cards separated by thin vertical border (hidden on mobile)
- These stats must be SPECIFIC and CREDIBLE for ${brandContext.product} and ${audience}

━━━ 5. PAIN / PROBLEM SECTION ━━━
- background: ${bgColor}
- .label-pill "THE PROBLEM"
- H2: A bold, personal headline that makes ${audience} feel deeply understood
- Subheadline: 1 sentence that intensifies the problem
- 2×2 CSS grid of pain cards (1-col mobile), each .glass .card-hover:
  Top: emoji icon (2em) + bold title (font-weight:700, 17px)
  Body: 2 sentences, conversational, specific to this audience
  Use: ${painPoints.slice(0, 4).join(' | ')}

━━━ 6. SOLUTION / FEATURES ━━━
- background: ${bg2Color}
- .label-pill "THE SOLUTION"
- H2: Position ${brand} as the definitive answer. Bold, specific.
- Subheadline
- 3-col CSS grid (1-col mobile), each feature card .glass .card-hover:
  Icon block: 56px×56px, border-radius:16px, background: linear-gradient(135deg, ${accentColor}33, ${accent2Color}22), emoji inside (font-size:26px), margin-bottom:20px
  Feature title: 18px, font-weight:700, color:${textColor}
  Feature body: 3 sentences, benefit-focused, color:${mutedColor}
  "Learn more →" link: color:${accentColor}, font-weight:600, font-size:14px, no underline, hover underline
  Use outcomes: ${outcomes.join(' | ')}

━━━ 7. HOW IT WORKS ━━━
- background: ${bgColor}; id="how"
- .label-pill "HOW IT WORKS"
- H2: "Up and running in minutes, not months"
- 3-step horizontal layout desktop (vertical mobile), connected by CSS dashed line:
  Step number: 80px, font-weight:900, color:${accentColor}22, line-height:1, margin-bottom:8px
  Step title: 20px font-weight:700, color:${textColor}
  Step body: 2 sentences describing this step for ${brandContext.product}

━━━ 8. TESTIMONIALS ━━━
- background: ${bg2Color}
- .label-pill "SOCIAL PROOF"
- H2: "Results from real ${audience}"
- 3-col grid (1-col mobile), each card .glass .card-hover padding:36px:
  Stars row: "★★★★★" color:#f59e0b, font-size:18px, letter-spacing:2px
  Quote: font-style:italic; font-size:16px; line-height:1.65; color:${textColor}; margin:20px 0; must be SPECIFIC with real numbers
  Author row: 48px avatar (gradient bg, initials in white, font-weight:700) + Name (bold, 15px) + Role + Company
  FABRICATE 3 different realistic people from ${audience} — make each quote tell a mini success story with numbers

━━━ 9. COMPARISON ━━━
- background: ${bgColor}
- .label-pill "WHY ${brand.toUpperCase()}"
- H2: "Everything your current solution is missing"
- Styled comparison grid (NOT a plain HTML table — use CSS grid with alternating row bg):
  Header row: Feature (left) | ${brand} (center, with gradient background + "✦ Best Choice" badge) | Alternatives (right)
  5 feature rows: each row has Feature name + ✓ in ${accentColor} for us + ✗ in ${dangerColor || '#ef444480'} for them
  Make features specific and meaningful for ${audience}
  Bottom row: CTA button spanning full width, .btn-grad

━━━ 10. FAQ ━━━
- background: ${bg2Color}
- .label-pill "FAQ"
- H2: "Everything you need to know"
- 5 FAQ items, each: border-bottom:1px solid ${borderColor}; padding:24px 0;
  Question row: flex between, question text (17px, font-weight:600, color:${textColor}) + chevron div (rotate 0/180 on open)
  Answer: div with max-height:0/300px transition, overflow:hidden; content: 16px ${mutedColor}
  Cover: ${objections.join(' | ')} + one "How do I get started?" question
  JS: toggle .open class on click, rotate chevron, expand/collapse max-height

━━━ 11. FINAL CTA ━━━
- background: ${bgColor}; position:relative; overflow:hidden; text-align:center; padding:120px 0
- Background decorative: two giant blurred circles (absolute positioned, z-index:0), same technique as hero
- All text in z-index:1 container
- .label-pill "GET STARTED TODAY"
- H2: Urgent, specific headline tied to the ad's promise — make them feel like they'll miss out if they don't act now
- p.lead: what happens after clicking — be specific and reassuring
- .btn-grad (min-width:280px, height:62px, font-size:17px) + .btn-ghost side by side
- Trust line: "No credit card required · Takes 2 minutes to set up · Cancel anytime"
- Repeat social proof: "${trustMetric} · 4.9★ average rating"

━━━ 12. FOOTER ━━━
- background: ${bg2Color}; border-top:1px solid ${borderColor}; padding:60px 0 40px
- 3-column grid:
  Left: LOGO HTML + "${brand}" bold + tagline "${tagline || 'The smarter way forward'}" in ${mutedColor}
  Center: Links grid — Features, How it works, Testimonials, FAQ, Contact — in ${mutedColor}, hover:${textColor}
  Right: "© ${new Date().getFullYear()} ${brand}. All rights reserved." + privacy/terms links in ${mutedColor}cc
- Bottom strip: thin border-top, centered text in ${mutedColor}66 font-size:12px "Built with ❤️ for ${audience}"

════════════════════════════════════════════
JAVASCRIPT (one <script> tag before </body>)
════════════════════════════════════════════
1. FAQ accordion: document.querySelectorAll('.faq-item') click handler — toggle .open class, rotate chevron, expand answer via max-height
2. Navbar scroll shadow: window.addEventListener('scroll', ...) — add/remove class with box-shadow at >80px
3. Smooth scroll for anchor links
ABSOLUTELY NO opacity:0 on any element. ABSOLUTELY NO IntersectionObserver. Everything is visible by default.

════════════════════════════════════════════
FINAL OUTPUT RULES
════════════════════════════════════════════
- Start IMMEDIATELY with <!DOCTYPE html> — zero preamble, zero explanation, zero markdown fences
- Single <style> tag in <head> (complete CSS)
- Single <script> tag before </body> (complete JS)
- Load Inter: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
- ALL buttons and CTAs link to: ${ctaUrl}
- page title: "${brand} — ${variation.headline?.substring(0, 50)}"
- meta description: relevant to the ad copy
- Full mobile responsive with @media (max-width: 768px)
- The hero headline MUST closely mirror: "${variation.headline}"
- Tone throughout MUST match angle: ${variation.angle || 'general'}
- NO external images. NO placeholder divs labeled "image goes here". Use CSS-only visuals.
- This page must look indistinguishable from a page built by a world-class agency charging $200k+`

  // Use higher token limit for landing pages
  const raw = await callClaudeLarge(key, prompt)

  // Robustly extract the HTML — find the actual <!DOCTYPE start, strip any preamble or markdown fences
  let html = raw
  const doctypeIdx = raw.toLowerCase().indexOf('<!doctype')
  if (doctypeIdx > 0) html = raw.slice(doctypeIdx)
  // Strip trailing markdown fences if present
  html = html.replace(/\n?```\s*$/i, '').trim()
  return html
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
