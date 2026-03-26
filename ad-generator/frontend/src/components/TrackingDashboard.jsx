import React, { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, DollarSign, MousePointer, RefreshCw, Trophy, Target, Zap } from 'lucide-react'
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
  const { campaign, analytics, setAnalytics, isLoadingAnalytics, setIsLoadingAnalytics } = useAdStore()
  const [dateRange, setDateRange] = useState('last_7d')
  const [sortBy, setSortBy]       = useState('ctr')

  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true)
    try {
      const ranges = {
        last_7d:  { since: nDaysAgo(7),  until: today() },
        last_14d: { since: nDaysAgo(14), until: today() },
        last_30d: { since: nDaysAgo(30), until: today() },
      }
      const data = await getAnalytics(
        campaign.adAccountId || 'act_demo',
        ranges[dateRange]
      )
      setAnalytics(data.data || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  useEffect(() => { loadAnalytics() }, [dateRange])

  const sorted = [...analytics].sort((a, b) => {
    const ai = a.insights || {}
    const bi = b.insights || {}
    if (sortBy === 'ctr')   return parseFloat(bi.ctr)  - parseFloat(ai.ctr)
    if (sortBy === 'clicks') return parseInt(bi.clicks) - parseInt(ai.clicks)
    if (sortBy === 'spend')  return parseFloat(bi.spend) - parseFloat(ai.spend)
    return 0
  })

  const totalSpend   = analytics.reduce((s, a) => s + parseFloat(a.insights?.spend  || 0), 0)
  const totalClicks  = analytics.reduce((s, a) => s + parseInt(a.insights?.clicks   || 0), 0)
  const avgCTR       = analytics.length
    ? (analytics.reduce((s, a) => s + parseFloat(a.insights?.ctr || 0), 0) / analytics.length).toFixed(2)
    : 0
  const avgCPC       = totalClicks ? (totalSpend / totalClicks).toFixed(2) : 0

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
          <select
            className="input w-auto"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="last_7d">Last 7 days</option>
            <option value="last_14d">Last 14 days</option>
            <option value="last_30d">Last 30 days</option>
          </select>
          <button className="btn-secondary" onClick={loadAnalytics} disabled={isLoadingAnalytics}>
            <RefreshCw size={14} className={isLoadingAnalytics ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BarChart3}    label="Active Ads"    value={analytics.filter((a) => a.status === 'ACTIVE').length}  color="text-brand-400" change={12} />
        <StatCard icon={MousePointer} label="Total Clicks"  value={totalClicks.toLocaleString()} color="text-green-400" change={8} />
        <StatCard icon={TrendingUp}   label="Avg CTR"       value={`${avgCTR}%`} color="text-yellow-400" change={-2} />
        <StatCard icon={DollarSign}   label="Total Spend"   value={`$${totalSpend.toFixed(2)}`} sub={`$${avgCPC} avg CPC`} color="text-purple-400" change={5} />
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

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm">All Ads ({analytics.length})</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            {['ctr', 'clicks', 'spend'].map((key) => (
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
                  {['Rank', 'Ad Name', 'Angle', 'Status', 'Impressions', 'Clicks', 'CTR', 'CPC', 'Spend'].map((h) => (
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
              <div className="py-16 text-center text-gray-500">
                <Target size={36} className="mx-auto mb-3 text-gray-700" />
                No ads to show. Upload ads first.
              </div>
            )}
          </div>
        )}
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
