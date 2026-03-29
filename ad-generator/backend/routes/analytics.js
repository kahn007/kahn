const express = require('express')
const axios   = require('axios')
const router  = express.Router()

const FB_BASE = 'https://graph.facebook.com/v19.0'

/**
 * GET /api/analytics/summary
 * Aggregate dashboard metrics directly from Facebook Insights.
 * Falls back to empty state (not fake data) if no token configured.
 */
router.get('/summary', async (req, res, next) => {
  try {
    const token     = process.env.FACEBOOK_ACCESS_TOKEN
    const accountId = process.env.FACEBOOK_AD_ACCOUNT_ID

    if (!token || !accountId) {
      return res.json({
        totalAds:    0,
        activeAds:   0,
        totalSpend:  0,
        totalClicks: 0,
        avgCTR:      0,
        avgCPC:      0,
        topAngle:    null,
        winningAdId: null,
        lastUpdated: new Date().toISOString(),
        mock:        true,
      })
    }

    const acctId = accountId.startsWith('act_') ? accountId : `act_${accountId}`
    const { data: adsData } = await axios.get(`${FB_BASE}/${acctId}/ads`, {
      params: { fields: 'id,name,status', limit: 500, access_token: token },
    })

    const ads = adsData.data || []
    const activeAds = ads.filter((a) => a.status === 'ACTIVE').length

    const { data: insData } = await axios.get(`${FB_BASE}/${acctId}/insights`, {
      params: {
        fields: 'ad_id,impressions,clicks,spend,ctr,cpc',
        level: 'ad',
        date_preset: 'last_30d',
        limit: 500,
        access_token: token,
      },
    })

    const ins = insData.data || []
    const totalSpend  = ins.reduce((s, i) => s + parseFloat(i.spend  || 0), 0)
    const totalClicks = ins.reduce((s, i) => s + parseInt(i.clicks  || 0), 0)
    const totalImps   = ins.reduce((s, i) => s + parseInt(i.impressions || 0), 0)
    const avgCTR      = totalImps  ? ((totalClicks / totalImps) * 100).toFixed(2) : '0.00'
    const avgCPC      = totalClicks ? (totalSpend / totalClicks).toFixed(2)       : '0.00'

    const winner = [...ins].sort((a, b) => parseFloat(b.ctr || 0) - parseFloat(a.ctr || 0))[0]

    res.json({
      totalAds:    ads.length,
      activeAds,
      totalSpend:  parseFloat(totalSpend.toFixed(2)),
      totalClicks,
      avgCTR:      parseFloat(avgCTR),
      avgCPC:      parseFloat(avgCPC),
      topAngle:    null,
      winningAdId: winner?.ad_id || null,
      lastUpdated: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
