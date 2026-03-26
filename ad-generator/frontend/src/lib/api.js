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
export async function generateVariations({ brandContext, insights, count = 10, formats = ['feed'] }) {
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
    const prompt = buildBatchPrompt(brandContext, insights, batchSize, formats)
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
export async function getAnalytics(adAccountId, { since, until } = {}) {
  const token = getKey('facebook')
  if (!token) return { data: getMockAnalytics(), mock: true }

  // Error #100 "nonexisting field (ads)" means no ads in the account yet — return empty gracefully
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  try {
    const params = new URLSearchParams({
      fields: 'id,name,status,insights{impressions,clicks,spend,ctr,cpc}',
      time_range: JSON.stringify({ since, until }),
      access_token: token,
    })
    const res  = await fetch(`https://graph.facebook.com/v19.0/${accountId}/ads?${params}`)
    const data = await res.json()

    if (data.error) {
      // #100 = no ads yet, #200 = permissions — return empty array instead of throwing
      if (data.error.code === 100 || data.error.code === 200) {
        return { data: [], empty: true, errorMessage: data.error.message }
      }
      throw new Error(data.error.message)
    }

    return { data: data.data || [] }
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
  veo31: {
    id:        'veo31',
    label:     'Google Veo 3.1',
    sublabel:  'Most realistic · best humans',
    durations: [{ value: '4s', label: '4s' }, { value: '6s', label: '6s' }, { value: '8s', label: '8s' }],
    endpoint:  'fal-ai/veo3.1',
    buildBody: (prompt, ratio, dur) => ({ prompt, aspect_ratio: ratio, duration: dur || '8s', generate_audio: false }),
    getUrl:    (r) => r.video?.url,
  },
  kling3: {
    id:        'kling3',
    label:     'Kling 3.0',
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
async function buildCreativePrompt(variation, brandContext, format, type, durationSeconds) {
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

  const prompt = `You are a top direct-response creative director at a performance marketing agency. You write AI generation prompts that produce scroll-stopping Facebook ad visuals rated 9/10 or higher by creative directors.

THE AD:
- Target: ${audience}
- Product: ${brandContext.product}
- Headline: "${variation.headline}"
- Copy snippet: "${variation.primaryText?.substring(0, 200)}"
- Emotional angle: ${angle} — ${ANGLE_CREATIVE_DIRECTION[angle] || ANGLE_CREATIVE_DIRECTION.general}
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

// ── Flux Pro 1.1 Ultra — image generation ────────────────────
export async function generateAdImage({ variation, brandContext, format = 'feed' }) {
  const falKey = getKey('falai')
  if (!falKey) throw new Error('Add your fal.ai key in Settings to generate images')

  const creativePrompt = await buildCreativePrompt(variation, brandContext, format, 'image')

  const res = await fetch(`${FAL_BASE}/fal-ai/flux-pro/v1.1-ultra`, {
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
export async function generateAdVideo({ variation, brandContext, format = 'feed', onProgress, videoModelId = 'kling3', videoDuration }) {
  const falKey = getKey('falai')
  if (!falKey) throw new Error('Add your fal.ai key in Settings to generate videos')

  const model = VIDEO_MODELS[videoModelId] || VIDEO_MODELS.kling3
  const ratio = AD_ASPECT_RATIOS[format] || '16:9'
  const dur = videoDuration || model.durations[0].value
  const creativePrompt = await buildCreativePrompt(variation, brandContext, format, 'video', dur)

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

// ── Claude helper ─────────────────────────────────────────────
async function callClaude(key, prompt) {
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
      max_tokens: 4096,
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

function buildBatchPrompt(brandContext, insights, count, formats) {
  const { brandName, product, targetAudience, cta, landingPageUrl } = brandContext
  const insightsSummary = insights
    ? `Pain points: ${insights.painPoints?.slice(0, 3).map((p) => p.text).join('; ')}
Desired outcomes: ${insights.desiredOutcomes?.slice(0, 3).map((o) => o.text).join('; ')}
Trigger phrases: ${insights.triggerPhrases?.slice(0, 5).join(', ')}`
    : ''

  // If multiple audiences are listed, distribute them across variations
  const audienceList = targetAudience.split(/[,;\/]+/).map((a) => a.trim()).filter(Boolean)
  const audienceNote = audienceList.length > 1
    ? `IMPORTANT: Multiple audience segments are listed (${audienceList.join(', ')}). Each variation must target EXACTLY ONE specific audience segment. Speak directly to that one person — never combine audiences in a single ad. Rotate through segments across variations.`
    : `Audience: ${targetAudience}`

  return `You are a world-class Facebook ad copywriter for ${brandName} (${landingPageUrl}).
Product: ${product} | CTA: ${cta}
${audienceNote}
${insightsSummary}

Generate EXACTLY ${count} unique Facebook ad variations using different angles: pain_point, outcome, social_proof, curiosity, authority, fomo.

Rules:
- Each ad speaks to ONE specific person, not a list of industries
- Copy is direct, conversational, specific — no corporate fluff
- Headlines are punchy and under 40 characters

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
