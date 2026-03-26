import React, { useState } from 'react'
import { Wand2, RefreshCw, LayoutGrid, Plus, Trash2, BookMarked, Zap, Star, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { useAdStore } from '../store/adStore'
import { generateVariations, scoreCopyVariations, generateRetargetingVariations } from '../lib/api'
import AdPreview from './AdPreview'

const FORMATS = [
  { id: 'feed',    label: 'Feed (1.91:1)' },
  { id: 'square',  label: 'Square (1:1)' },
  { id: 'story',   label: 'Story (9:16)' },
]

const COUNTS = [5, 10, 25, 50, 100]

const ANGLE_LABELS = {
  pain_point:   { label: 'Pain Point', color: 'text-red-400' },
  outcome:      { label: 'Outcome', color: 'text-green-400' },
  social_proof: { label: 'Social Proof', color: 'text-blue-400' },
  curiosity:    { label: 'Curiosity', color: 'text-yellow-400' },
  authority:    { label: 'Authority', color: 'text-purple-400' },
  fomo:         { label: 'FOMO', color: 'text-orange-400' },
}

const SCORE_COLOR = (s) => s >= 8 ? 'bg-green-900/50 text-green-300 border-green-800' : s >= 6 ? 'bg-yellow-900/50 text-yellow-300 border-yellow-800' : 'bg-red-900/50 text-red-300 border-red-800'

export default function CopyGenerator() {
  const {
    brandContext, setBrandContext,
    researchSessions, activeResearchId, setActiveResearchId,
    addVariations, variations, setIsGenerating, isGenerating, setActiveTab,
    hookLibrary, addHook, removeHook,
  } = useAdStore()
  const activeSession = researchSessions.find((r) => r.id === activeResearchId)
  const insights = activeSession?.insights || null

  const [count, setCount]         = useState(10)
  const [formats, setFormats]     = useState(['feed'])
  const [progress, setProgress]   = useState(0)
  const [scores, setScores]       = useState({})     // variationId → { score, rationale }
  const [isScoring, setIsScoring] = useState(false)
  const [isRetargeting, setIsRetargeting] = useState(false)
  const [newHook, setNewHook]     = useState('')
  const [injectHook, setInjectHook] = useState(null)  // hook text to inject

  const toggleFormat = (id) => {
    setFormats((f) => f.includes(id) ? (f.length > 1 ? f.filter((x) => x !== id) : f) : [...f, id])
  }

  const handleGenerate = async () => {
    if (!brandContext.product) {
      toast.error('Add your product in Settings or Research panel first')
      return
    }
    setIsGenerating(true)
    setProgress(0)
    setScores({})

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 90))
    }, 800)

    // Inject hook into insights if one is selected
    const enrichedInsights = injectHook && insights
      ? { ...insights, triggerPhrases: [injectHook, ...(insights.triggerPhrases || [])] }
      : insights

    try {
      const data = await generateVariations({
        brandContext,
        insights: enrichedInsights,
        count,
        formats,
      })
      clearInterval(interval)
      setProgress(100)
      addVariations(data.variations)
      toast.success(
        data.variations.length === count
          ? `Generated ${count} ad variations!`
          : `Generated ${data.variations.length} variations (add Anthropic key for full generation)`
      )
      setTimeout(() => {
        setIsGenerating(false)
        setProgress(0)
        setActiveTab('variations')
      }, 600)
    } catch (err) {
      clearInterval(interval)
      toast.error(err.message)
      setIsGenerating(false)
      setProgress(0)
    }
  }

  const handleScoreAll = async () => {
    if (!variations.length) { toast.error('Generate variations first'); return }
    setIsScoring(true)
    try {
      const results = await scoreCopyVariations(variations, brandContext)
      const map = {}
      results.forEach((r) => { map[r.id] = r })
      setScores(map)
      toast.success('Copy scored!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsScoring(false)
    }
  }

  const handleRetargeting = async () => {
    if (!variations.length) { toast.error('Generate variations first'); return }
    setIsRetargeting(true)
    try {
      const retargetVars = await generateRetargetingVariations(variations.slice(0, 10), brandContext)
      addVariations(retargetVars)
      toast.success(`${retargetVars.length} retargeting variants added!`)
      setActiveTab('variations')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsRetargeting(false)
    }
  }

  const handleSaveHook = () => {
    if (!newHook.trim()) return
    addHook({ id: uuidv4(), text: newHook.trim(), createdAt: new Date().toISOString() })
    setNewHook('')
    toast.success('Hook saved!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Generate Ad Copy</h2>
        <p className="text-gray-400 mt-1">
          Claude reads your audience insights and bulk-generates headlines + body copy across multiple angles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config column */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold text-white text-sm">Brand Context</h3>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Product / Service</label>
              <input
                className="input"
                placeholder="AI-powered Facebook ad generator"
                value={brandContext.product}
                onChange={(e) => setBrandContext({ product: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Target Audience</label>
              <input
                className="input"
                placeholder="e-commerce entrepreneurs, coaches"
                value={brandContext.targetAudience}
                onChange={(e) => setBrandContext({ targetAudience: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">CTA Button</label>
                <select
                  className="input"
                  value={brandContext.cta}
                  onChange={(e) => setBrandContext({ cta: e.target.value })}
                >
                  {['Learn More', 'Sign Up', 'Get Started', 'Shop Now', 'Download', 'Contact Us'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Landing Page URL</label>
                <input
                  className="input"
                  placeholder="https://brayneai.com"
                  value={brandContext.landingPageUrl}
                  onChange={(e) => setBrandContext({ landingPageUrl: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold text-white text-sm">Generation Settings</h3>

            {/* Count */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Number of Variations</label>
              <div className="flex gap-2 flex-wrap">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      count === n
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Formats */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Ad Formats</label>
              <div className="flex gap-2 flex-wrap">
                {FORMATS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => toggleFormat(id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      formats.includes(id)
                        ? 'bg-brand-500/20 border border-brand-500/50 text-brand-400'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Research session picker */}
            {researchSessions.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 block">Research to use</label>
                <select
                  className="input text-sm"
                  value={activeResearchId || ''}
                  onChange={(e) => setActiveResearchId(e.target.value)}
                >
                  <option value="">None (generate without research)</option>
                  {researchSessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {insights && (
                  <p className="text-xs text-green-400 flex items-center gap-1.5">
                    <span>✓</span>
                    Using {insights.painPoints?.length} pain points + {insights.triggerPhrases?.length} trigger phrases
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-900/40 rounded-xl px-3 py-2">
                <span>!</span>
                No research yet — run Research first for better copy
              </div>
            )}

            {/* Hook inject picker */}
            {hookLibrary.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                  <BookMarked size={11} /> Inject winning hook
                </label>
                <select
                  className="input text-sm"
                  value={injectHook || ''}
                  onChange={(e) => setInjectHook(e.target.value || null)}
                >
                  <option value="">No hook injection</option>
                  {hookLibrary.map((h) => (
                    <option key={h.id} value={h.text}>{h.text.substring(0, 60)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Generate button */}
            {isGenerating ? (
              <div className="space-y-2">
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-center">Generating {count} variations with Claude AI…</p>
              </div>
            ) : (
              <button className="btn-primary w-full" onClick={handleGenerate}>
                <Wand2 size={16} />
                Generate {count} Variations
              </button>
            )}

            {/* Extra action buttons */}
            {variations.length > 0 && !isGenerating && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-800">
                <button
                  className="btn-secondary text-sm flex-1"
                  onClick={handleScoreAll}
                  disabled={isScoring}
                >
                  {isScoring ? <RefreshCw size={13} className="animate-spin" /> : <Star size={13} />}
                  Score All Copy
                </button>
                <button
                  className="btn-secondary text-sm flex-1"
                  onClick={handleRetargeting}
                  disabled={isRetargeting}
                >
                  {isRetargeting ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  {isRetargeting ? 'Generating…' : 'Retargeting Variants'}
                </button>
              </div>
            )}
          </div>

          {/* Score results */}
          {Object.keys(scores).length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Star size={14} className="text-yellow-400" />
                Copy Scores
                <span className="text-xs text-gray-500 font-normal">— click a variation to edit</span>
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {variations.map((v) => {
                  const s = scores[v.id]
                  if (!s) return null
                  return (
                    <div key={v.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-800/50">
                      <span className={`badge border text-xs font-bold flex-shrink-0 ${SCORE_COLOR(s.score)}`}>
                        {s.score}/10
                      </span>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-medium truncate">{v.headline}</p>
                        {s.rationale && <p className="text-gray-500 text-xs mt-0.5">{s.rationale}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Preview */}
          <div className="card">
            <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
              <LayoutGrid size={14} />
              Ad Preview
            </h3>
            <AdPreview
              variation={{
                headline:    'Stop guessing. Start converting.',
                primaryText: `Most ${brandContext.targetAudience || 'entrepreneurs'} spend hours writing ads that never convert. ${brandContext.brandName} changes that. Our AI analyzes what your audience actually cares about — then writes the copy for you. In minutes, not weeks.`,
                description: 'Try free today',
                cta:         brandContext.cta,
                imageUrl:    null,
              }}
              brandContext={brandContext}
              format="feed"
            />
          </div>

          {/* Hook library */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <BookMarked size={14} className="text-brand-500" />
              Hook Library
              <span className="text-xs text-gray-500 font-normal">— save winning headlines</span>
            </h3>
            <div className="flex gap-2">
              <input
                className="input text-sm flex-1"
                placeholder="Paste a winning headline or hook…"
                value={newHook}
                onChange={(e) => setNewHook(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveHook()}
              />
              <button className="btn-primary text-sm flex-shrink-0" onClick={handleSaveHook} disabled={!newHook.trim()}>
                <Plus size={14} />
                Save
              </button>
            </div>
            {hookLibrary.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {hookLibrary.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-800/50 group">
                    <p className="text-gray-300 text-xs flex-1 leading-relaxed">{h.text}</p>
                    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded-lg hover:bg-brand-500/20 text-gray-500 hover:text-brand-400 transition-colors text-xs"
                        onClick={() => setInjectHook(injectHook === h.text ? null : h.text)}
                        title="Inject into next generation"
                      >
                        <Zap size={12} />
                      </button>
                      <button
                        className="p-1 rounded-lg hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"
                        onClick={() => removeHook(h.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {injectHook === h.text && (
                      <span className="text-brand-400 text-[10px] font-semibold flex-shrink-0">injecting</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-xs text-center py-3">No hooks saved yet — paste a winning headline above</p>
            )}
          </div>

          {/* Angle guide */}
          <div className="card">
            <h3 className="font-semibold text-white text-sm mb-3">Copy Angles Claude Will Use</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ANGLE_LABELS).map(([key, { label, color }]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')}`} />
                  <span className={color}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
