import React, { useState } from 'react'
import { Search, Zap, TrendingUp, MessageSquare, Target, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { researchAudience } from '../lib/api'

const EMOTION_COLORS = {
  frustrated: 'bg-red-900/40 text-red-300 border-red-800',
  anxious:    'bg-orange-900/40 text-orange-300 border-orange-800',
  hopeful:    'bg-green-900/40 text-green-300 border-green-800',
  confused:   'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  exhausted:  'bg-purple-900/40 text-purple-300 border-purple-800',
  excited:    'bg-blue-900/40 text-blue-300 border-blue-800',
}

const FREQ_COLORS = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-gray-500',
}

export default function ResearchPanel() {
  const { brandContext, setBrandContext, insights, setInsights, isResearching, setIsResearching, setActiveTab } = useAdStore()
  const [form, setForm] = useState({
    product:        brandContext.product || '',
    targetAudience: brandContext.targetAudience || '',
  })

  const handleResearch = async () => {
    if (!form.product || !form.targetAudience) {
      toast.error('Fill in product and target audience first')
      return
    }
    setIsResearching(true)
    try {
      setBrandContext({ product: form.product, targetAudience: form.targetAudience })
      const data = await researchAudience({
        product:        form.product,
        targetAudience: form.targetAudience,
        brandName:      brandContext.brandName,
      })
      setInsights(data.insights)
      toast.success(data.mock ? 'Loaded demo insights (add Perplexity key for live data)' : 'Audience research complete!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsResearching(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Audience Research</h2>
        <p className="text-gray-400 mt-1">
          Scan Reddit &amp; YouTube to find the exact pain points your audience is talking about right now.
        </p>
      </div>

      {/* Input card */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Target size={16} className="text-brand-500" />
          What are you advertising?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Product / Service</label>
            <input
              className="input"
              placeholder="e.g. AI-powered Facebook ad generator"
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Target Audience</label>
            <input
              className="input"
              placeholder="e.g. e-commerce entrepreneurs, coaches"
              value={form.targetAudience}
              onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
            />
          </div>
        </div>
        <button
          className="btn-primary w-full sm:w-auto"
          onClick={handleResearch}
          disabled={isResearching}
        >
          {isResearching ? (
            <><RefreshCw size={16} className="animate-spin" /> Scanning Reddit &amp; YouTube…</>
          ) : (
            <><Search size={16} /> Research Audience</>
          )}
        </button>
      </div>

      {/* Results */}
      {insights && (
        <div className="space-y-4">
          {/* Pain Points */}
          <div className="card">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400" />
              Pain Points
              <span className="badge bg-red-900/50 text-red-300">{insights.painPoints?.length}</span>
            </h3>
            <div className="space-y-2">
              {insights.painPoints?.map((p, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-xl">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${FREQ_COLORS[p.frequency] || 'bg-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 text-sm">{p.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`badge border ${EMOTION_COLORS[p.emotion] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {p.emotion}
                      </span>
                      <span className="text-xs text-gray-500">{p.source}</span>
                      <span className="text-xs text-gray-500 capitalize">{p.frequency} frequency</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Desired Outcomes */}
            <div className="card">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-400" />
                Desired Outcomes
              </h3>
              <ul className="space-y-2">
                {insights.desiredOutcomes?.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5">✓</span>
                    {o.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Objections */}
            <div className="card">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <MessageSquare size={16} className="text-yellow-400" />
                Objections to Address
              </h3>
              <ul className="space-y-2">
                {insights.objections?.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-yellow-400 mt-0.5">!</span>
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Trigger Phrases */}
          <div className="card">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Zap size={16} className="text-brand-500" />
              Trigger Phrases
              <span className="text-xs text-gray-500">— use these in your ad copy</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {insights.triggerPhrases?.map((phrase, i) => (
                <span key={i} className="px-3 py-1.5 bg-brand-500/10 border border-brand-500/30 text-brand-400 rounded-full text-sm font-medium">
                  "{phrase}"
                </span>
              ))}
            </div>
          </div>

          {/* Tone + Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-white mb-2 text-sm">Tone Insights</h3>
              <p className="text-gray-400 text-sm">{insights.toneInsights}</p>
            </div>
            <div className="card">
              <h3 className="font-semibold text-white mb-2 text-sm">Top Keywords</h3>
              <div className="flex flex-wrap gap-1.5">
                {insights.topKeywords?.map((kw, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-800 text-gray-300 rounded-lg text-xs">{kw}</span>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={() => setActiveTab('generate')}
            >
              <Zap size={16} />
              Generate Ad Copy with These Insights
            </button>
          </div>
        </div>
      )}

      {!insights && !isResearching && (
        <div className="card text-center py-16">
          <Search size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500">Enter your product and audience above to begin research</p>
        </div>
      )}
    </div>
  )
}
