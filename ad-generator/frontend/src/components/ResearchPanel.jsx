import React, { useState } from 'react'
import { Search, Zap, TrendingUp, MessageSquare, Target, AlertCircle, RefreshCw, Plus, Trash2, ChevronRight, BookOpen, Clock, Eye, Lightbulb, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { researchAudience, spyCompetitorAds } from '../lib/api'
import { v4 as uuidv4 } from 'uuid'

const EMOTION_COLORS = {
  frustrated: 'bg-red-900/40 text-red-300 border-red-800',
  anxious:    'bg-orange-900/40 text-orange-300 border-orange-800',
  hopeful:    'bg-green-900/40 text-green-300 border-green-800',
  confused:   'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  exhausted:  'bg-purple-900/40 text-purple-300 border-purple-800',
  excited:    'bg-blue-900/40 text-blue-300 border-blue-800',
  regretful:  'bg-pink-900/40 text-pink-300 border-pink-800',
  disappointed: 'bg-gray-800 text-gray-300 border-gray-700',
}

const FREQ_COLORS = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-gray-500',
}

export default function ResearchPanel() {
  const {
    brandContext,
    researchSessions, activeResearchId,
    saveResearchSession, deleteResearchSession, setActiveResearchId,
    isResearching, setIsResearching,
    setActiveTab, saveSwipeFile, competitorSwipeFile,
  } = useAdStore()

  const [form, setForm] = useState({ product: '', targetAudience: '' })
  const [creating, setCreating] = useState(researchSessions.length === 0)
  const [activeTab, setLocalTab] = useState('audience')  // 'audience' | 'competitor'
  const [competitors, setCompetitors] = useState('')
  const [isSpying, setIsSpying] = useState(false)

  const activeSession = researchSessions.find((r) => r.id === activeResearchId)

  const handleResearch = async () => {
    if (!form.product || !form.targetAudience) {
      toast.error('Fill in product and target audience first')
      return
    }
    setIsResearching(true)
    try {
      const data = await researchAudience({
        product: form.product,
        targetAudience: form.targetAudience,
        brandName: brandContext.brandName,
      })

      const session = {
        id: uuidv4(),
        name: `${form.product} → ${form.targetAudience}`,
        product: form.product,
        targetAudience: form.targetAudience,
        insights: data.insights,
        createdAt: new Date().toISOString(),
        mock: !!data.mock,
      }

      saveResearchSession(session)
      setCreating(false)
      toast.success(data.mock ? 'Loaded demo insights (add Perplexity key for live data)' : 'Research saved!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsResearching(false)
    }
  }

  const handleDelete = (id) => {
    deleteResearchSession(id)
    if (researchSessions.length <= 1) setCreating(true)
    toast.success('Research deleted')
  }

  const handleSpy = async () => {
    if (!form.product && !brandContext.product) {
      toast.error('Enter a product first')
      return
    }
    setIsSpying(true)
    try {
      const data = await spyCompetitorAds({
        product: form.product || brandContext.product,
        targetAudience: form.targetAudience || brandContext.targetAudience,
        competitors,
      })
      saveSwipeFile(data.ads)
      toast.success(data.mock ? 'Loaded demo competitor data (add Perplexity key for live intel)' : 'Competitor intel loaded!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsSpying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Research</h2>
          <p className="text-gray-400 mt-1 text-sm">
            Audience insights and competitor ad intelligence.
          </p>
        </div>
        {activeTab === 'audience' && (
          <button
            className="btn-primary"
            onClick={() => { setCreating(true); setForm({ product: '', targetAudience: '' }) }}
          >
            <Plus size={15} />
            New Research
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setLocalTab('audience')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'audience' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Search size={13} /> Audience Research
        </button>
        <button
          onClick={() => setLocalTab('competitor')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'competitor' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Eye size={13} /> Competitor Spy
          {competitorSwipeFile && <span className="w-2 h-2 rounded-full bg-green-500" />}
        </button>
      </div>

      {/* Competitor spy tab */}
      {activeTab === 'competitor' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-400" />
              Competitor Ad Intelligence
            </h3>
            <p className="text-gray-400 text-sm">Perplexity scans the Facebook Ad Library and marketing content to surface what competitors are running.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Product / Service</label>
                <input
                  className="input"
                  placeholder={brandContext.product || 'e.g. AI SMS follow-up system'}
                  value={form.product}
                  onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Target Audience</label>
                <input
                  className="input"
                  placeholder={brandContext.targetAudience || 'e.g. real estate agents'}
                  value={form.targetAudience}
                  onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-400 mb-1.5 block">Specific competitors to spy on (optional)</label>
                <input
                  className="input"
                  placeholder="e.g. CompanyA, CompanyB, CompanyC"
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                />
              </div>
            </div>
            <button className="btn-primary" onClick={handleSpy} disabled={isSpying}>
              {isSpying
                ? <><RefreshCw size={15} className="animate-spin" /> Scanning Ad Library…</>
                : <><Eye size={15} /> Spy on Competitors</>
              }
            </button>
          </div>

          {competitorSwipeFile && <SwipeFile data={competitorSwipeFile} />}
        </div>
      )}

      {/* Audience tab */}
      {activeTab === 'audience' && (
      <div className="flex gap-6">
        {/* ── Saved sessions sidebar ── */}
        {researchSessions.length > 0 && (
          <div className="w-64 flex-shrink-0 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold px-1 flex items-center gap-1.5">
              <BookOpen size={11} /> Saved Research ({researchSessions.length})
            </p>

            {researchSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => { setActiveResearchId(session.id); setCreating(false) }}
                className={`group relative p-3 rounded-xl border cursor-pointer transition-all ${
                  activeResearchId === session.id && !creating
                    ? 'bg-brand-500/10 border-brand-500/50 text-white'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-600 text-gray-300'
                }`}
              >
                <p className="text-sm font-medium leading-snug line-clamp-2 pr-5">{session.name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Clock size={10} className="text-gray-600" />
                  <span className="text-xs text-gray-600">{formatDate(session.createdAt)}</span>
                  {session.mock && <span className="text-xs text-yellow-600">demo</span>}
                </div>

                {/* Active indicator */}
                {activeResearchId === session.id && !creating && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-brand-500 rounded-r" />
                )}

                {/* Delete button */}
                <button
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-900/30 text-gray-600 hover:text-red-400 transition-all"
                  onClick={(e) => { e.stopPropagation(); handleDelete(session.id) }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* New research form */}
          {creating && (
            <div className="card space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Target size={16} className="text-brand-500" />
                New Research
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Product / Service</label>
                  <input
                    className="input"
                    placeholder="e.g. AI SMS follow-up system"
                    value={form.product}
                    onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Target Audience</label>
                  <input
                    className="input"
                    placeholder="e.g. real estate agents, contractors"
                    value={form.targetAudience}
                    onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={handleResearch} disabled={isResearching}>
                  {isResearching
                    ? <><RefreshCw size={15} className="animate-spin" /> Scanning Reddit &amp; YouTube…</>
                    : <><Search size={15} /> Research Audience</>
                  }
                </button>
                {researchSessions.length > 0 && (
                  <button className="btn-secondary" onClick={() => setCreating(false)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Active session insights */}
          {!creating && activeSession && (
            <InsightsView
              session={activeSession}
              onUseForGeneration={() => setActiveTab('generate')}
            />
          )}

          {/* Empty state */}
          {!creating && !activeSession && (
            <div className="card text-center py-20">
              <Search size={40} className="text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">No research yet — click "New Research" to start</p>
            </div>
          )}
        </div>
      </div>
      )} {/* end audience tab */}
    </div>
  )
}

const ANGLE_BADGE = {
  pain_point:   'bg-red-900/40 text-red-300 border-red-800',
  outcome:      'bg-green-900/40 text-green-300 border-green-800',
  social_proof: 'bg-blue-900/40 text-blue-300 border-blue-800',
  curiosity:    'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  authority:    'bg-purple-900/40 text-purple-300 border-purple-800',
  fomo:         'bg-orange-900/40 text-orange-300 border-orange-800',
}

function SwipeFile({ data }) {
  if (!data) return null
  const { competitors = [], winningAngles = [], gapOpportunities = [], suggestedDifferentiators = [] } = data
  return (
    <div className="space-y-4">
      {/* Competitor cards */}
      {competitors.map((c, i) => (
        <div key={i} className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-white">{c.name}</h4>
              <p className="text-gray-400 text-xs mt-0.5 italic">"{c.headline}"</p>
            </div>
            <span className={`badge border text-xs flex-shrink-0 ${ANGLE_BADGE[c.angle] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
              {c.angle?.replace('_', ' ')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-500 mb-1.5 font-medium">Hooks they use</p>
              <ul className="space-y-1">
                {c.hooks?.map((h, j) => (
                  <li key={j} className="text-gray-300 flex items-start gap-1.5"><span className="text-brand-400 mt-0.5">•</span>{h}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-gray-500 mb-1.5 font-medium">Themes</p>
              <div className="flex flex-wrap gap-1">
                {c.themes?.map((t, j) => (
                  <span key={j} className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-lg text-xs">{t}</span>
                ))}
              </div>
            </div>
          </div>
          {c.weaknesses && (
            <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-2.5">
              <p className="text-xs text-red-300"><span className="font-semibold">Weakness:</span> {c.weaknesses}</p>
            </div>
          )}
        </div>
      ))}

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {winningAngles.length > 0 && (
          <div className="card">
            <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
              <TrendingUp size={13} className="text-green-400" /> Winning Angles
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {winningAngles.map((a, i) => (
                <span key={i} className={`badge border text-xs ${ANGLE_BADGE[a] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{a.replace('_', ' ')}</span>
              ))}
            </div>
          </div>
        )}
        {gapOpportunities.length > 0 && (
          <div className="card">
            <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
              <Lightbulb size={13} className="text-yellow-400" /> Gap Opportunities
            </h4>
            <ul className="space-y-1">
              {gapOpportunities.map((g, i) => (
                <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><span className="text-yellow-400 mt-0.5">→</span>{g}</li>
              ))}
            </ul>
          </div>
        )}
        {suggestedDifferentiators.length > 0 && (
          <div className="card">
            <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
              <Zap size={13} className="text-brand-500" /> Your Edge
            </h4>
            <ul className="space-y-1">
              {suggestedDifferentiators.map((d, i) => (
                <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><span className="text-brand-400 mt-0.5">✓</span>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function InsightsView({ session, onUseForGeneration }) {
  const { insights } = session
  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">{session.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(session.createdAt)}{session.mock ? ' · demo data' : ' · live data'}</p>
        </div>
        <button className="btn-primary text-sm" onClick={onUseForGeneration}>
          <Zap size={14} />
          Generate Ads with This
          <ChevronRight size={14} />
        </button>
      </div>

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
        <div className="card">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-400" />
            Desired Outcomes
          </h3>
          <ul className="space-y-2">
            {insights.desiredOutcomes?.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-green-400 mt-0.5">✓</span>{o.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare size={16} className="text-yellow-400" />
            Objections to Address
          </h3>
          <ul className="space-y-2">
            {insights.objections?.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-yellow-400 mt-0.5">!</span>{o}
              </li>
            ))}
          </ul>
        </div>
      </div>

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
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
