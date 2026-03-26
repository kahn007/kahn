import React, { useEffect, useState, useMemo } from 'react'
import { BarChart3, TrendingUp, DollarSign, MousePointer, RefreshCw, Trophy, Target, Zap, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { getAnalytics } from '../lib/api'

const ANGLE_COLORS = {
  pain_point:   'bg-red-500',
  outcome:      'bg-green-500',
  social_proof: 'bg-blue-500',
  curiosity:    'bg-yellow-500',
  authority:    'bg-purple-500',
  fomo:         'bg-orange-500',
  general:      'bg-gray-500',
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-400', change }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('400', '500/10')}`}>
          <Icon size={18} className={color} />
        </div>
      </div>
      {change !== undefined && (
        <p className={`text-xs mt-2 font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs last week
        </p>
      )}
    </div>
  )
}

export default function TrackingDashboard() {
  const { campaign, analytics, setAnalytics, isLoadingAnalytics, setIsLoadingAnalytics, uploadResults, variations } = useAdStore()
  const [dateRange, setDateRange]     = useState('last_30d')
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [sortBy, setSortBy]           = useState('spend')
  const [emptyReason, setEmptyReason] = useState(null)
  const [insightsError, setInsightsError] = useState(null)

  // Map our date range keys → Facebook date_preset values (more reliable than time_range JSON)
  const FB_PRESET_MAP = {
    last_7d:   'last_7d',
    last_14d:  'last_14d',
    last_30d:  'last_30d',
    last_90d:  'last_90d',
    last_365d: 'last_year',
    alltime:   'lifetime',
  }

  // Build a map: facebookAdId → variation angle (from local uploadResults + variations)
  const angleByFbId = useMemo(() => {
    const map = {}
    for (const r of uploadResults || []) {
      if (!r.facebookAdId) continue
      const variation = (variations || []).find((v) => v.id === r.variationId)
      if (variation?.angle) map[r.facebookAdId] = variation.angle
    }
    return map
  }, [uploadResults, variations])

  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true)
    setEmptyReason(null)
    setInsightsError(null)
    try {
      // Use Facebook date_preset for standard ranges (most reliable)
      // Fall back to since/until for custom ranges
      const datePreset = FB_PRESET_MAP[dateRange]
      const customRange = dateRange === 'custom'
        ? { since: customFrom || nDaysAgo(30), until: customTo || today() }
        : {}

      const data = await getAnalytics(
        campaign.adAccountId || 'act_demo',
        { datePreset, ...customRange }
      )

      // Enrich each ad with angle from local store (where we have it)
      const enriched = (data.data || []).map((ad) => ({
        ...ad,
        angle: angleByFbId[ad.id] || ad.angle || 'general',
      }))
      setAnalytics(enriched)
      if (data.mock)  setEmptyReason('no_token')
      if (data.empty) setEmptyReason('no_ads')
      if (data.insightsError) setInsightsError(data.insightsError)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  useEffect(() => {
    if (dateRange !== 'custom' || (customFrom && customTo)) loadAnalytics()
  }, [dateRange, customFrom, customTo])

  const sorted = [...analytics].sort((a, b) => {
    const ai = a.insights || {}
    const bi = b.insights || {}
    if (sortBy === 'spend')       return parseFloat(bi.spend)       - parseFloat(ai.spend)
    if (sortBy === 'impressions') return parseInt(bi.impressions)   - parseInt(ai.impressions)
    if (sortBy === 'ctr')         return parseFloat(bi.ctr)         - parseFloat(ai.ctr)
    if (sortBy === 'clicks')      return parseInt(bi.clicks)        - parseInt(ai.clicks)
    return 0
  })

  const totalSpend      = analytics.reduce((s, a) => s + parseFloat(a.insights?.spend       || 0), 0)
  const totalClicks     = analytics.reduce((s, a) => s + parseInt(a.insights?.clicks         || 0), 0)
  const totalImpressions = analytics.reduce((s, a) => s + parseInt(a.insights?.impressions   || 0), 0)
  const avgCTR          = totalImpressions
    ? ((totalClicks / totalImpressions) * 100).toFixed(2)
    : analytics.length
      ? (analytics.reduce((s, a) => s + parseFloat(a.insights?.ctr || 0), 0) / analytics.length).toFixed(2)
      : '0.00'
  const avgCPC          = totalClicks ? (totalSpend / totalClicks).toFixed(2) : '0.00'

  // Best performer: prefer highest spend (means it ran the most), fallback to impressions
  const winner = sorted[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Performance Dashboard</h2>
          <p className="text-gray-400 text-sm mt-0.5">Track which ad variations are winning</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="input w-auto"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="last_7d">Last 7 days</option>
              <option value="last_14d">Last 14 days</option>
              <option value="last_30d">Last 30 days</option>
              <option value="last_90d">Last 3 months</option>
              <option value="last_365d">Last year</option>
              <option value="alltime">All time</option>
              <option value="custom">Custom range</option>
            </select>
            {dateRange === 'custom' && (
              <>
                <input type="date" className="input w-auto text-sm" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <span className="text-gray-500 text-sm">to</span>
                <input type="date" className="input w-auto text-sm" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </>
            )}
          </div>
          <button className="btn-secondary" onClick={loadAnalytics} disabled={isLoadingAnalytics}>
            <RefreshCw size={14} className={isLoadingAnalytics ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Insights permission warning */}
      {insightsError && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4 text-sm">
          <p className="text-yellow-300 font-semibold mb-1">⚠️ Metrics unavailable</p>
          <p className="text-yellow-400/80 text-xs">{insightsError}</p>
          <p className="text-yellow-400/60 text-xs mt-1">
            Make sure your Facebook token has <strong>ads_read</strong> permission and the token hasn't expired.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BarChart3}    label="Total Ads"     value={analytics.length} sub={`${analytics.filter((a) => a.status === 'ACTIVE').length} active`} color="text-brand-400" />
        <StatCard icon={MousePointer} label="Total Clicks"  value={totalClicks.toLocaleString()} color="text-green-400" />
        <StatCard icon={TrendingUp}   label="Avg CTR"       value={`${avgCTR}%`} color="text-yellow-400" />
        <StatCard icon={DollarSign}   label="Total Spend"   value={`$${totalSpend.toFixed(2)}`} sub={`$${avgCPC} avg CPC`} color="text-purple-400" />
      </div>

      {/* Winner card */}
      {winner && (
        <div className="card border-yellow-800/50 bg-yellow-900/10">
          <div className="flex items-start gap-3">
            <Trophy size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 font-bold text-sm flex items-center gap-2">
                Winning Ad
                <span className="badge bg-yellow-900/50 text-yellow-300">#{sorted.indexOf(winner) + 1}</span>
              </p>
              <p className="text-white font-semibold mt-1">{winner.name}</p>
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                <span className="text-green-400 font-bold">{winner.insights?.ctr}% CTR</span>
                <span>{parseInt(winner.insights?.clicks || 0).toLocaleString()} clicks</span>
                <span>${parseFloat(winner.insights?.spend || 0).toFixed(2)} spend</span>
                <span>${winner.insights?.cpc} CPC</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Winning Angle Tracker */}
      {analytics.length > 0 && <AngleTracker analytics={analytics} />}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm">All Ads ({analytics.length})</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            {['spend', 'impressions', 'ctr', 'clicks'].map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all uppercase ${
                  sortBy === key ? 'bg-brand-500 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {isLoadingAnalytics ? (
          <div className="py-16 flex items-center justify-center gap-3 text-gray-500">
            <RefreshCw size={18} className="animate-spin" />
            Loading analytics…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                  {['Rank', 'Ad Name', 'Angle', 'Status', 'Impressions', 'Reach', 'Clicks', 'CTR', 'CPC', 'Spend'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((ad, i) => {
                  const ins = ad.insights || {}
                  const isWinner = i === 0
                  return (
                    <tr
                      key={ad.id}
                      className={`border-b border-gray-800/50 transition-colors ${
                        isWinner ? 'bg-yellow-900/10' : 'hover:bg-gray-800/30'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`font-bold ${isWinner ? 'text-yellow-400' : 'text-gray-500'}`}>
                          {isWinner ? '🏆' : `#${i + 1}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-white font-medium truncate">{ad.name}</p>
                        <p className="text-gray-500 text-xs font-mono">{ad.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${ANGLE_COLORS[ad.angle] || 'bg-gray-500'}`} />
                          <span className="text-gray-300 text-xs capitalize">{ad.angle?.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${ad.status === 'ACTIVE' ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                          {ad.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{parseInt(ins.impressions || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300">{parseInt(ins.reach || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300">{parseInt(ins.clicks || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <CTRBar value={parseFloat(ins.ctr || 0)} />
                      </td>
                      <td className="px-4 py-3 text-gray-300">${parseFloat(ins.cpc || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-300">${parseFloat(ins.spend || 0).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sorted.length === 0 && (
              <div className="py-16 text-center px-6">
                <Target size={36} className="mx-auto mb-3 text-gray-700" />
                {emptyReason === 'no_token' && (
                  <>
                    <p className="text-gray-400 font-medium">Showing demo data</p>
                    <p className="text-gray-600 text-sm mt-1">Add your Facebook Access Token in Settings to see real ad performance.</p>
                  </>
                )}
                {emptyReason === 'no_ads' && (
                  <>
                    <p className="text-gray-400 font-medium">No ads in your account yet</p>
                    <p className="text-gray-600 text-sm mt-2 max-w-sm mx-auto">
                      Your Facebook ad account is connected but has no ads. Generate variations → select them → push to Facebook first. Once your ads are live, data will appear here.
                    </p>
                  </>
                )}
                {!emptyReason && (
                  <>
                    <p className="text-gray-400 font-medium">No ads found</p>
                    <p className="text-gray-600 text-sm mt-1">Try a different date range, or push ads first.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AngleTracker({ analytics }) {
  // Group analytics by angle, compute avg CTR per angle
  const angleMap = {}
  for (const ad of analytics) {
    const angle = ad.angle || 'general'
    const ctr = parseFloat(ad.insights?.ctr || 0)
    if (!angleMap[angle]) angleMap[angle] = { total: 0, count: 0 }
    angleMap[angle].total += ctr
    angleMap[angle].count += 1
  }
  const angles = Object.entries(angleMap)
    .map(([angle, { total, count }]) => ({ angle, avgCtr: total / count, count }))
    .sort((a, b) => b.avgCtr - a.avgCtr)

  const maxCtr = angles[0]?.avgCtr || 1

  return (
    <div className="card">
      <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
        <Zap size={14} className="text-brand-500" />
        Winning Angle Tracker
        <span className="text-xs text-gray-500 font-normal">avg CTR by copy angle</span>
      </h3>
      <div className="space-y-3">
        {angles.map(({ angle, avgCtr, count }, i) => (
          <div key={angle} className="flex items-center gap-3">
            <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ANGLE_COLORS[angle]?.split(' ')[0] || 'bg-gray-500'}`} />
              <span className="text-gray-300 text-xs capitalize truncate">{angle.replace('_', ' ')}</span>
            </div>
            <div className="flex-1 bg-gray-800 rounded-full h-2 relative overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${ANGLE_COLORS[angle]?.split(' ')[0] || 'bg-gray-500'}`}
                style={{ width: `${(avgCtr / maxCtr) * 100}%` }}
              />
            </div>
            <div className="w-20 flex-shrink-0 flex items-center justify-end gap-2">
              <span className="text-xs font-bold text-white">{avgCtr.toFixed(2)}%</span>
              <span className="text-xs text-gray-600">({count})</span>
              {i === 0 && <span className="text-yellow-400 text-xs">🏆</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CTRBar({ value }) {
  const max = 5
  const pct = Math.min((value / max) * 100, 100)
  const color = value >= 3 ? 'bg-green-500' : value >= 1.5 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${value >= 3 ? 'text-green-400' : value >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
        {value.toFixed(2)}%
      </span>
    </div>
  )
}

function nDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function today() {
  return new Date().toISOString().split('T')[0]
}
