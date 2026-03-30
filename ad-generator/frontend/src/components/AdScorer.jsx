import React, { useState } from 'react'
import { Target, Zap, Copy, Check, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useAdStore } from '../store/adStore'
import { scoreAdCopy } from '../lib/api'
import { getKey } from '../lib/keys'
import toast from 'react-hot-toast'

const DIMENSIONS = [
  { id: 'hook',      label: 'Hook Power',        desc: 'Does the first line stop the scroll?',                   color: 'text-pink-400',   bar: 'bg-pink-500' },
  { id: 'specific',  label: 'Specificity',        desc: 'Numbers, details, proof — not vague claims',             color: 'text-blue-400',   bar: 'bg-blue-500' },
  { id: 'emotion',   label: 'Emotional Pull',     desc: 'Does it tap into desires, fears, or aspirations?',       color: 'text-purple-400', bar: 'bg-purple-500' },
  { id: 'clarity',   label: 'Clarity & Flow',     desc: 'Is it instantly understandable at a glance?',            color: 'text-teal-400',   bar: 'bg-teal-500' },
  { id: 'cta',       label: 'CTA Strength',       desc: 'Is the call to action clear and compelling?',            color: 'text-amber-400',  bar: 'bg-amber-500' },
  { id: 'trust',     label: 'Trust Signals',      desc: 'Social proof, credentials, guarantees',                  color: 'text-green-400',  bar: 'bg-green-500' },
]

function ScoreRing({ score, grade }) {
  const GRADES = { A: 'text-green-400', B: 'text-teal-400', C: 'text-amber-400', D: 'text-orange-400', F: 'text-red-400' }
  const size = 120
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white leading-none">{score}</span>
          <span className={`text-base font-bold leading-none mt-0.5 ${GRADES[grade] || 'text-zinc-400'}`}>{grade}</span>
        </div>
      </div>
      <p className="text-xs text-zinc-500">Ad Score</p>
    </div>
  )
}

function DimensionRow({ dim, score, suggestion, rewrite }) {
  const [open, setOpen] = useState(false)
  const d = DIMENSIONS.find((d) => d.id === dim) || { label: dim, color: 'text-zinc-400', bar: 'bg-zinc-500', desc: '' }

  return (
    <div className="space-y-1">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${d.color}`}>{d.label}</span>
            {suggestion && <span className="text-[10px] text-zinc-600">(has suggestions)</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold tabular-nums ${d.color}`}>{score}/10</span>
            {(suggestion || rewrite) && (open ? <ChevronUp size={11} className="text-zinc-500" /> : <ChevronDown size={11} className="text-zinc-500" />)}
          </div>
        </div>
        <div className="progress-track">
          <div className={`progress-fill ${d.bar}`} style={{ width: `${(score / 10) * 100}%`, transition: 'width 0.5s ease' }} />
        </div>
      </button>
      {open && (suggestion || rewrite) && (
        <div className="ml-1 mt-2 space-y-2 text-xs">
          {suggestion && (
            <p className="text-zinc-400 leading-relaxed bg-surface-800/50 rounded-lg px-3 py-2 border border-white/[0.05]">
              💡 {suggestion}
            </p>
          )}
          {rewrite && (
            <div className="bg-brand-500/10 border border-brand-500/25 rounded-lg px-3 py-2 space-y-1.5">
              <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Suggested rewrite:</p>
              <p className="text-zinc-200 leading-relaxed italic">"{rewrite}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdScorer() {
  const { variations, adScoreResult, setAdScoreResult, brandContext, brandVoice } = useAdStore()
  const [mode, setMode] = useState('paste') // 'paste' | 'variation'
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [selectedVarId, setSelectedVarId] = useState('')
  const [loading, setLoading] = useState(false)

  const getInputText = () => {
    if (mode === 'variation' && selectedVarId) {
      const v = variations.find((v) => v.id === selectedVarId)
      return v ? { headline: v.headline, body: v.primaryText } : null
    }
    return { headline, body }
  }

  const run = async () => {
    const input = getInputText()
    if (!input?.headline && !input?.body) { toast.error('Enter some copy to score'); return }
    if (!getKey('anthropic')) { toast.error('Add your Anthropic key in Settings'); return }
    setLoading(true)
    try {
      const result = await scoreAdCopy({ ...input, brandContext, brandVoice })
      setAdScoreResult(result)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setAdScoreResult(null); setHeadline(''); setBody('') }

  const [copiedImproved, setCopiedImproved] = useState(false)
  const copyImproved = () => {
    if (!adScoreResult?.improvedCopy) return
    navigator.clipboard.writeText(`${adScoreResult.improvedCopy.headline}\n\n${adScoreResult.improvedCopy.body}`)
    setCopiedImproved(true)
    setTimeout(() => setCopiedImproved(false), 1600)
    toast.success('Improved copy copied')
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="page-title">Ad Score & Optimizer</h2>
        <p className="page-subtitle">Paste any ad copy or pick a variation. Get a 0–100 score across 6 dimensions with specific rewrite suggestions for every weak area.</p>
      </div>

      {/* Input */}
      {!adScoreResult && (
        <div className="card space-y-4">
          <div className="tab-group">
            <button className={mode === 'paste' ? 'tab-active' : 'tab-inactive'} onClick={() => setMode('paste')}>Paste Copy</button>
            <button
              className={mode === 'variation' ? 'tab-active' : 'tab-inactive'}
              onClick={() => setMode('variation')}
              disabled={!variations.length}
            >
              From Variations {variations.length > 0 && `(${variations.length})`}
            </button>
          </div>

          {mode === 'paste' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Headline / Hook</label>
                <input
                  className="input"
                  placeholder="e.g. Stop wasting money on ads that don't convert"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Body Copy / Primary Text</label>
                <textarea
                  className="textarea"
                  rows={5}
                  placeholder="Paste the full ad body here…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <select className="input" value={selectedVarId} onChange={(e) => setSelectedVarId(e.target.value)}>
              <option value="">— Pick a variation —</option>
              {variations.map((v) => (
                <option key={v.id} value={v.id}>{v.headline || v.id}</option>
              ))}
            </select>
          )}

          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={run} disabled={loading}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scoring…</>
            ) : (
              <><Target size={14} /> Score This Ad</>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {adScoreResult && (
        <div className="space-y-5">
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-bold text-base">Score Breakdown</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{adScoreResult.summary}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5" onClick={reset}>
                  <RefreshCw size={12} /> Score Another
                </button>
              </div>
            </div>

            <div className="flex gap-8 items-start">
              <ScoreRing score={adScoreResult.overall} grade={adScoreResult.grade} />
              <div className="flex-1 space-y-3.5">
                {adScoreResult.dimensions?.map((dim) => (
                  <DimensionRow key={dim.id} {...dim} />
                ))}
              </div>
            </div>
          </div>

          {/* Strengths / Weaknesses */}
          {(adScoreResult.strengths?.length > 0 || adScoreResult.weaknesses?.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card space-y-2">
                <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider">✅ What's working</h4>
                <ul className="space-y-1.5">
                  {adScoreResult.strengths?.map((s, i) => (
                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                      <span className="text-green-500 flex-shrink-0 mt-0.5">▸</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card space-y-2">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">⚠️ Quick wins</h4>
                <ul className="space-y-1.5">
                  {adScoreResult.weaknesses?.map((w, i) => (
                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                      <span className="text-red-500 flex-shrink-0 mt-0.5">▸</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Improved copy */}
          {adScoreResult.improvedCopy && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap size={13} className="text-brand-500" /> Optimized Version
                  </h4>
                  <p className="text-xs text-zinc-500 mt-0.5">All suggestions applied in one rewrite</p>
                </div>
                <button onClick={copyImproved} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                  {copiedImproved ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  Copy
                </button>
              </div>
              <div className="space-y-2 bg-surface-800/50 border border-white/[0.06] rounded-xl p-4">
                <p className="text-sm font-semibold text-white">{adScoreResult.improvedCopy.headline}</p>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{adScoreResult.improvedCopy.body}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
