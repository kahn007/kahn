const express = require('express')
const router  = express.Router()

/**
 * GET /api/analytics/summary
 * Returns high-level dashboard metrics.
 */
router.get('/summary', (req, res) => {
  res.json({
    totalAds:      100,
    activeAds:     68,
    totalSpend:    4218.50,
    totalClicks:   12540,
    avgCTR:        2.87,
    avgCPC:        0.34,
    topAngle:      'pain_point',
    winningAdId:   'MOCK_AD_3',
    lastUpdated:   new Date().toISOString(),
  })
})

module.exports = router
