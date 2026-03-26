const express = require('express')
const axios   = require('axios')
const { v4: uuidv4 } = require('uuid')
const router  = express.Router()

/**
 * POST /api/generate/copy
 * Generate a single ad copy using Claude.
 */
router.post('/copy', async (req, res, next) => {
  try {
    const { brandContext, insight, format = 'feed' } = req.body

    if (!brandContext) {
      return res.status(400).json({ error: 'brandContext is required' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ copy: getMockCopy(brandContext, format) })
    }

    const prompt = buildCopyPrompt(brandContext, insight, format)
    const copy = await callClaude(prompt)
    res.json({ copy })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/generate/variations
 * Bulk-generate N ad variations using insights from Perplexity.
 * Returns array of ad objects ready to push to Facebook.
 */
router.post('/variations', async (req, res, next) => {
  try {
    const { brandContext, insights, count = 10, formats = ['feed'] } = req.body

    if (!brandContext) {
      return res.status(400).json({ error: 'brandContext is required' })
    }

    const total = Math.min(count, 100)

    if (!process.env.ANTHROPIC_API_KEY) {
      const mocks = Array.from({ length: total }, (_, i) =>
        buildVariationObject(getMockCopy(brandContext, formats[i % formats.length]), brandContext, formats[i % formats.length], i)
      )
      return res.json({ variations: mocks })
    }

    // Build batches of up to 10 at a time to stay within token limits
    const batches = []
    for (let i = 0; i < total; i += 10) {
      batches.push(Math.min(10, total - i))
    }

    const allVariations = []

    for (const batchSize of batches) {
      const prompt = buildBatchPrompt(brandContext, insights, batchSize, formats)
      const raw    = await callClaude(prompt)

      let parsed
      try {
        // Claude sometimes wraps in ```json ... ```
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        parsed = JSON.parse(cleaned)
        if (!Array.isArray(parsed)) parsed = parsed.variations || []
      } catch {
        parsed = []
      }

      const batch = parsed.map((item, i) =>
        buildVariationObject(item, brandContext, formats[i % formats.length], allVariations.length + i)
      )
      allVariations.push(...batch)
    }

    res.json({ variations: allVariations })
  } catch (err) {
    next(err)
  }
})

// ── Helpers ───────────────────────────────────────────────────

async function callClaude(prompt) {
  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    }
  )
  return data.content[0].text
}

function buildCopyPrompt(brandContext, insight, format) {
  const { brandName, product, targetAudience, cta, landingPageUrl } = brandContext
  return `
You are a world-class Facebook ad copywriter for ${brandName} (${landingPageUrl}).

Product/Service: ${product}
Target Audience: ${targetAudience}
Ad Format: ${format}
${insight ? `Audience Insight: ${insight}` : ''}

Write ONE Facebook ad. Return ONLY valid JSON (no markdown):
{
  "headline": "...",
  "primaryText": "...",
  "description": "...",
  "cta": "${cta}"
}

Rules:
- Headline: max 40 chars, hook-first, no clickbait
- Primary text: 90-150 words, conversational, use the pain/outcome framework
- Description: max 25 chars, reinforce the offer
- No exclamation marks in headline
- No ALL CAPS
`.trim()
}

function buildBatchPrompt(brandContext, insights, count, formats) {
  const { brandName, product, targetAudience, cta, landingPageUrl } = brandContext

  const insightsSummary = insights
    ? `
Pain points: ${insights.painPoints?.slice(0, 3).map((p) => p.text).join('; ')}
Desired outcomes: ${insights.desiredOutcomes?.slice(0, 3).map((o) => o.text).join('; ')}
Trigger phrases: ${insights.triggerPhrases?.slice(0, 5).join(', ')}
`
    : ''

  return `
You are a world-class Facebook ad copywriter for ${brandName} (${landingPageUrl}).

Product/Service: ${product}
Target Audience: ${targetAudience}
CTA: ${cta}
${insightsSummary}

Generate EXACTLY ${count} unique Facebook ad variations. Each variation should use a different:
- Angle (pain point, outcome, social proof, curiosity, authority, FOMO)
- Opening hook style
- Copy length (short punchy vs longer story-driven)

Return ONLY a valid JSON array with exactly ${count} objects:
[
  {
    "headline": "max 40 chars",
    "primaryText": "90-150 words, conversational",
    "description": "max 25 chars",
    "cta": "${cta}",
    "angle": "pain_point|outcome|social_proof|curiosity|authority|fomo",
    "format": "${formats[0]}"
  }
]
`.trim()
}

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
    score: null,
    facebookAdId: null,
    createdAt: new Date().toISOString(),
    imageUrl: brandContext.imageUrl || null,
  }
}

function getMockCopy(brandContext, format) {
  const { brandName = 'Brayne AI', product = 'AI tool', targetAudience = 'entrepreneurs' } = brandContext
  const variations = [
    {
      headline: `Stop guessing. Start converting.`,
      primaryText: `Most ${targetAudience} spend hours writing ads that never convert. ${brandName} changes that. Our AI analyzes what your audience actually cares about — then writes the copy for you. In minutes, not weeks. Ready to launch ads that actually work?`,
      description: 'Try free today',
      cta: 'Learn More',
      angle: 'pain_point',
    },
    {
      headline: `100 ads. 30 minutes. Real results.`,
      primaryText: `What if you could test 100 ad variations this week — without hiring a copywriter or agency? ${brandName} makes it possible. Just enter your product, your audience, and let the AI do the heavy lifting. Your next winning ad is one click away.`,
      description: 'No credit card needed',
      cta: 'Get Started',
      angle: 'outcome',
    },
    {
      headline: `The ${product} tool that ${targetAudience} trust`,
      primaryText: `Over 1,000 ${targetAudience} use ${brandName} to bulk-generate Facebook ads that convert. The secret? We scan Reddit and YouTube to find exactly what your audience is saying — then turn those words into ads that hit different. See why they're switching.`,
      description: 'Join 1,000+ users',
      cta: 'See How It Works',
      angle: 'social_proof',
    },
  ]
  return variations[Math.floor(Math.random() * variations.length)]
}

module.exports = router
