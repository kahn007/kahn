const express = require('express')
const axios   = require('axios')
const router  = express.Router()

const FB_BASE = 'https://graph.facebook.com/v19.0'

function fbToken() {
  return process.env.FACEBOOK_ACCESS_TOKEN
}

// ── Push ad drafts ────────────────────────────────────────────
/**
 * POST /api/facebook/push-drafts
 * Body: { adAccountId, adSetId, pageId, variations: [...] }
 */
router.post('/push-drafts', async (req, res, next) => {
  try {
    const {
      adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID,
      adSetId,
      pageId = process.env.FACEBOOK_PAGE_ID,
      variations,
    } = req.body

    if (!variations?.length) {
      return res.status(400).json({ error: 'variations array is required' })
    }

    if (!fbToken()) {
      // Mock mode — return fake ad IDs
      const results = variations.map((v) => ({
        variationId: v.id,
        facebookAdId: `MOCK_AD_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        status: 'DRAFT',
        success: true,
      }))
      return res.json({ results, mock: true })
    }

    const results = []
    const errors  = []

    for (const variation of variations) {
      try {
        // 1. Create ad creative
        const creative = await createAdCreative(adAccountId, pageId, variation)

        // 2. Create ad (draft)
        const ad = await createAd(adAccountId, adSetId, creative.id, variation)

        results.push({
          variationId:  variation.id,
          facebookAdId: ad.id,
          creativeId:   creative.id,
          status: 'DRAFT',
          success: true,
        })
      } catch (err) {
        errors.push({ variationId: variation.id, error: err.message })
      }

      // Respect FB rate limits — 50 req/sec
      await sleep(100)
    }

    res.json({ results, errors })
  } catch (err) {
    next(err)
  }
})

// ── Get ad sets ───────────────────────────────────────────────
router.get('/adsets/:adAccountId', async (req, res, next) => {
  try {
    if (!fbToken()) {
      return res.json({ adSets: getMockAdSets() })
    }

    const { adAccountId } = req.params
    const { data } = await axios.get(`${FB_BASE}/${adAccountId}/adsets`, {
      params: {
        fields: 'id,name,status,daily_budget,lifetime_budget',
        access_token: fbToken(),
      },
    })
    res.json({ adSets: data.data })
  } catch (err) {
    next(err)
  }
})

// ── Analytics ─────────────────────────────────────────────────
router.get('/analytics/:adAccountId', async (req, res, next) => {
  try {
    if (!fbToken()) {
      return res.json({ data: getMockAnalytics() })
    }

    const { adAccountId } = req.params
    const { since = '2025-01-01', until = new Date().toISOString().split('T')[0] } = req.query

    const { data } = await axios.get(`${FB_BASE}/${adAccountId}/ads`, {
      params: {
        fields: 'id,name,status,insights{impressions,clicks,spend,ctr,cpc,cpp,actions}',
        time_range: JSON.stringify({ since, until }),
        access_token: fbToken(),
      },
    })
    res.json({ data: data.data })
  } catch (err) {
    next(err)
  }
})

// ── Upload image ──────────────────────────────────────────────
router.post('/upload-image', async (req, res, next) => {
  try {
    if (!fbToken()) {
      return res.json({ imageHash: 'MOCK_IMAGE_HASH', mock: true })
    }

    // Real implementation uses multipart/form-data with image file
    const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID
    const { data } = await axios.post(
      `${FB_BASE}/${adAccountId}/adimages`,
      req.body,
      { params: { access_token: fbToken() } }
    )
    res.json({ imageHash: Object.values(data.images)[0].hash })
  } catch (err) {
    next(err)
  }
})

// ── Internal helpers ──────────────────────────────────────────

async function createAdCreative(adAccountId, pageId, variation) {
  const objectStorySpec = {
    page_id: pageId,
    link_data: {
      message:     variation.primaryText,
      name:        variation.headline,
      description: variation.description,
      call_to_action: {
        type:  ctaTypeMap(variation.cta),
        value: { link: variation.landingPageUrl },
      },
      ...(variation.imageHash && { image_hash: variation.imageHash }),
    },
  }

  const { data } = await axios.post(
    `${FB_BASE}/${adAccountId}/adcreatives`,
    {
      name:               `BrayneAI Creative — ${variation.id}`,
      object_story_spec:  objectStorySpec,
      access_token:       fbToken(),
    }
  )
  return data
}

async function createAd(adAccountId, adSetId, creativeId, variation) {
  const { data } = await axios.post(
    `${FB_BASE}/${adAccountId}/ads`,
    {
      name:      `BrayneAI Ad — ${variation.headline?.substring(0, 30)}`,
      adset_id:  adSetId,
      creative:  { creative_id: creativeId },
      status:    'PAUSED', // Always create as paused draft
      access_token: fbToken(),
    }
  )
  return data
}

function ctaTypeMap(cta) {
  const map = {
    'Learn More':    'LEARN_MORE',
    'Sign Up':       'SIGN_UP',
    'Get Started':   'GET_STARTED',
    'Shop Now':      'SHOP_NOW',
    'Book Now':      'BOOK_TRAVEL',
    'Download':      'DOWNLOAD',
    'Contact Us':    'CONTACT_US',
  }
  return map[cta] || 'LEARN_MORE'
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function getMockAdSets() {
  return [
    { id: 'adset_001', name: 'Brayne AI — Cold Traffic', status: 'ACTIVE', daily_budget: '5000' },
    { id: 'adset_002', name: 'Brayne AI — Retargeting', status: 'ACTIVE', daily_budget: '2000' },
    { id: 'adset_003', name: 'Brayne AI — Lookalike 1%', status: 'PAUSED', daily_budget: '3000' },
  ]
}

function getMockAnalytics() {
  const ads = []
  const angles = ['pain_point', 'outcome', 'social_proof', 'curiosity', 'authority', 'fomo']
  for (let i = 0; i < 20; i++) {
    const impressions = Math.floor(Math.random() * 50000) + 5000
    const clicks      = Math.floor(impressions * (Math.random() * 0.04 + 0.01))
    const spend       = parseFloat((clicks * (Math.random() * 1.5 + 0.5)).toFixed(2))
    ads.push({
      id:   `MOCK_AD_${i + 1}`,
      name: `BrayneAI Ad Variation ${i + 1}`,
      angle: angles[i % angles.length],
      status: i < 15 ? 'ACTIVE' : 'PAUSED',
      insights: {
        impressions: impressions.toString(),
        clicks:      clicks.toString(),
        spend:       spend.toString(),
        ctr:         ((clicks / impressions) * 100).toFixed(2),
        cpc:         (spend / clicks).toFixed(2),
      },
    })
  }
  return ads.sort((a, b) => parseFloat(b.insights.ctr) - parseFloat(a.insights.ctr))
}

module.exports = router
