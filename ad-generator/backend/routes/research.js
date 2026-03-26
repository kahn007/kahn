const express = require('express')
const axios   = require('axios')
const router  = express.Router()

/**
 * POST /api/research
 * Uses Perplexity API to scan Reddit & YouTube for audience pain points.
 *
 * Body: { product, targetAudience, brandName }
 */
router.post('/', async (req, res, next) => {
  try {
    const { product, targetAudience, brandName = 'Brayne AI' } = req.body

    if (!product || !targetAudience) {
      return res.status(400).json({ error: 'product and targetAudience are required' })
    }

    if (!process.env.PERPLEXITY_API_KEY) {
      // Return mock data so frontend still works without a key
      return res.json({ insights: getMockInsights(product, targetAudience) })
    }

    const prompt = buildResearchPrompt(product, targetAudience, brandName)

    const { data } = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content:
              'You are a market research analyst specializing in Facebook advertising. ' +
              'Return responses as valid JSON only, no markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        search_domain_filter: ['reddit.com', 'youtube.com'],
        return_related_questions: false,
        search_recency_filter: 'month',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    let insights
    try {
      insights = JSON.parse(data.choices[0].message.content)
    } catch {
      insights = getMockInsights(product, targetAudience)
    }

    res.json({ insights })
  } catch (err) {
    next(err)
  }
})

function buildResearchPrompt(product, targetAudience, brandName) {
  return `
Search Reddit and YouTube for the MOST RECENT discussions about "${product}" targeting "${targetAudience}".

Return a JSON object with this exact shape:
{
  "painPoints": [
    { "text": "...", "source": "reddit|youtube", "frequency": "high|medium|low", "emotion": "frustrated|anxious|hopeful|..." }
  ],
  "desiredOutcomes": [
    { "text": "...", "source": "reddit|youtube" }
  ],
  "triggerPhrases": ["phrase1", "phrase2", "..."],
  "objections": ["objection1", "objection2", "..."],
  "toneInsights": "What tone resonates with this audience",
  "topKeywords": ["keyword1", "keyword2", "..."]
}

Find 6-8 pain points, 4-6 desired outcomes, 8-10 trigger phrases, 3-5 objections, and 6-8 keywords.
Focus on emotional language people use when talking about ${product}.
`.trim()
}

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
    triggerPhrases: [
      'stop guessing', 'finally found something that works', 'scaled to 6 figures',
      'without an agency', 'in minutes not hours', 'I wish I knew sooner',
      'game changer', 'honest review', 'does it actually work',
    ],
    objections: [
      'Too expensive for my budget',
      'Worried about the learning curve',
      'Not sure if AI-generated copy sounds natural',
      'What if Facebook disapproves the ads?',
    ],
    toneInsights: `${targetAudience} responds best to direct, confident, results-first copy. Avoid hype — lead with specific outcomes and social proof.`,
    topKeywords: [
      product, targetAudience, 'Facebook ads', 'ad creative', 'conversion rate',
      'ad copy', 'AI marketing', 'scale ads',
    ],
  }
}

module.exports = router
