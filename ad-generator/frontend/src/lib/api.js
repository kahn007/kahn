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

  for (const v of variations) {
    try {
      // 1. Create creative
      const creativeRes = await fetch(`${FB}/${adAccountId}/adcreatives`, {
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
      const adRes = await fetch(`${FB}/${adAccountId}/ads`, {
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

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${adAccountId}/adsets?fields=id,name,status,daily_budget&access_token=${token}`
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
  try {
    const params = new URLSearchParams({
      fields: 'id,name,status,insights{impressions,clicks,spend,ctr,cpc}',
      time_range: JSON.stringify({ since, until }),
      access_token: token,
    })
    const res  = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/ads?${params}`)
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

const FLUX_SIZES = {
  feed:   'landscape_16_9',  // 1792×1024 — Facebook feed
  square: 'square_hd',       // 1024×1024 — Instagram / square
  story:  'portrait_16_9',   // 1024×1792 — Stories / Reels
}
const KLING_RATIOS = {
  feed:   '16:9',
  square: '1:1',
  story:  '9:16',
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
async function buildCreativePrompt(variation, brandContext, format, type) {
  const anthropicKey = getKey('anthropic')
  const angle = variation.angle || 'general'

  if (!anthropicKey) {
    const base = ANGLE_FALLBACK[angle] || ANGLE_FALLBACK.general
    return `${base}. Scene relates to: ${brandContext.product} helping ${brandContext.targetAudience}.`
  }

  const formatLabel = format === 'story' ? '9:16 vertical' : format === 'square' ? '1:1 square' : '16:9 landscape'
  const typeLabel   = type === 'video' ? '5-second cinematic Facebook video ad' : 'Facebook ad still image'

  const prompt = `You are a world-class direct-response Facebook ad creative director. Your job is to write scroll-stopping image/video generation prompts.

Brand: ${brandContext.brandName} | Product: ${brandContext.product}
Target audience: ${brandContext.targetAudience}
Ad headline: "${variation.headline}"
Ad angle: ${angle}
Creative format: ${typeLabel}, ${formatLabel}

Emotional direction for this angle: ${ANGLE_CREATIVE_DIRECTION[angle] || ANGLE_CREATIVE_DIRECTION.general}

Write a generation prompt for a ${typeLabel} that will make someone STOP scrolling in 0.3 seconds.

Hard rules:
- Photorealistic, ${type === 'video' ? 'cinematic' : 'DSLR editorial'} quality — no illustrations
- ZERO text, words, signs, logos, UI or overlays anywhere — Facebook adds its own text
- Feature a real person (not a product) showing a strong, specific, recognizable emotion matching the angle
- Be hyper-specific: exact facial expression, body language, clothing, environment, lighting setup, camera angle
- Lighting must serve the emotion: harsh/dark for pain, golden/bright for outcomes, premium studio for authority${type === 'video' ? `
- Describe the motion clearly: what moves, how the camera moves (slow push-in, static with subject action, etc.)
- ONE clear scene — simple motion that amplifies the emotion` : ''}
- Composition: subject sharp, rule of thirds, background supports the mood

Return ONLY the prompt text. Max 120 words.`

  const raw = await callClaude(anthropicKey, prompt)
  return raw.trim()
}

// ── Flux Pro 1.1 — image generation ──────────────────────────
export async function generateAdImage({ variation, brandContext, format = 'feed' }) {
  const falKey = getKey('falai')
  if (!falKey) throw new Error('Add your fal.ai key in Settings to generate images')

  const creativePrompt = await buildCreativePrompt(variation, brandContext, format, 'image')

  const res = await fetch(`${FAL_BASE}/fal-ai/flux-pro/v1.1`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt:      creativePrompt,
      image_size:  FLUX_SIZES[format] || 'landscape_16_9',
      num_images:  1,
      output_format: 'jpeg',
      safety_tolerance: '2',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || `fal.ai error ${res.status}`)
  }

  const data = await res.json()
  return { imageUrl: data.images[0].url, creativePrompt }
}

// ── Kling 1.6 — video generation (async queue) ───────────────
export async function generateAdVideo({ variation, brandContext, format = 'feed', onProgress }) {
  const falKey = getKey('falai')
  if (!falKey) throw new Error('Add your fal.ai key in Settings to generate videos')

  const creativePrompt = await buildCreativePrompt(variation, brandContext, format, 'video')

  // 1. Submit to queue
  const submitRes = await fetch(`${FAL_QUEUE}/fal-ai/kling-video/v1.6/standard/text-to-video`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt:       creativePrompt,
      duration:     '5',
      aspect_ratio: KLING_RATIOS[format] || '16:9',
    }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.json().catch(() => ({}))
    throw new Error(err.detail || `fal.ai error ${submitRes.status}`)
  }

  const { request_id } = await submitRes.json()
  onProgress?.('Queued — waiting for Kling to start…')

  // 2. Poll until done (videos take 60-120s)
  const statusUrl = `${FAL_QUEUE}/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${request_id}/status`
  const resultUrl = `${FAL_QUEUE}/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${request_id}`

  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(3000)
    const statusRes = await fetch(`${statusUrl}?logs=1`, { headers: { Authorization: `Key ${falKey}` } })
    const status    = await statusRes.json()

    if (status.status === 'COMPLETED') {
      onProgress?.('Fetching video…')
      const resultRes = await fetch(resultUrl, { headers: { Authorization: `Key ${falKey}` } })
      const result    = await resultRes.json()
      // fal.ai may return video at different paths depending on SDK version
      const videoUrl  = result.video?.url
        || result.output?.video?.url
        || result.videos?.[0]?.url
        || status.output?.video?.url
      if (!videoUrl) {
        console.error('[fal.ai] Unexpected Kling result shape:', JSON.stringify(result).substring(0, 400))
        throw new Error('Video URL missing in fal.ai response — check console for details')
      }
      onProgress?.('Done!')
      return { videoUrl, creativePrompt }
    }

    if (status.status === 'FAILED') {
      throw new Error(`Video generation failed: ${status.error || 'unknown error'}`)
    }

    const pct = Math.round((attempt / 40) * 100)
    onProgress?.(`Generating video… ${Math.min(pct, 95)}%`)
  }

  throw new Error('Video generation timed out — try again')
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

  return `You are a world-class Facebook ad copywriter for ${brandName} (${landingPageUrl}).
Product: ${product} | Audience: ${targetAudience} | CTA: ${cta}
${insightsSummary}

Generate EXACTLY ${count} unique Facebook ad variations using different angles: pain_point, outcome, social_proof, curiosity, authority, fomo.

Return ONLY a valid JSON array with exactly ${count} objects:
[{
  "headline": "max 40 chars",
  "primaryText": "90-150 words, conversational",
  "description": "max 25 chars",
  "cta": "${cta}",
  "angle": "pain_point|outcome|social_proof|curiosity|authority|fomo"
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
    format: item.format || format,
    status: 'draft',
    facebookAdId: null,
    createdAt: new Date().toISOString(),
    imageUrl: brandContext.imageUrl || null,
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
