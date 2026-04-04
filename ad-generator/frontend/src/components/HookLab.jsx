import React, { useState } from 'react'
import { Zap, Copy, Check, Bookmark, BookmarkCheck, Trash2, RefreshCw, TrendingUp } from 'lucide-react'
import { useAdStore } from '../store/adStore'
import { generateHooks } from '../lib/api'
import { getKey } from '../lib/keys'
import toast from 'react-hot-toast'

const PLATFORMS = [
  { id: 'tiktok',   label: 'TikTok',    emoji: '🎵', color: 'text-pink-400',   bg: 'bg-pink-500/15 border-pink-500/30' },
  { id: 'reels',    label: 'Reels',     emoji: '📱', color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
  { id: 'youtube',  label: 'YouTube',   emoji: '▶️',  color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
  { id: 'linkedin', label: 'LinkedIn',  emoji: '💼', color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
  { id: 'twitter',  label: 'Twitter/X', emoji: '𝕏',  color: 'text-zinc-300',   bg: 'bg-zinc-500/15 border-zinc-500/30' },
]

const FRAMEWORKS = [
  { id: 'curiosity',  label: 'Curiosity Gap',     emoji: '🤔', desc: 'Open a loop the brain must close' },
  { id: 'contrarian', label: 'Contrarian',        emoji: '🔄', desc: 'Disagree with common wisdom' },
  { id: 'big_stat',   label: 'Big Stat',          emoji: '📊', desc: 'Lead with a shocking number' },
  { id: 'question',   label: 'Question',          emoji: '❓', desc: 'Ask the exact question they have' },
  { id: 'threat',     label: 'Threat / Warning',  emoji: '⚠️',  desc: 'Call out a costly mistake' },
  { id: 'story',      label: 'Story Open',        emoji: '📖', desc: 'In medias res — drop them in' },
  { id: 'social',     label: 'Social Proof',      emoji: '👥', desc: 'Lead with someone else\'s result' },
  { id: 'interrupt',  label: 'Pattern Interrupt', emoji: '⚡', desc: 'Say something unexpected/weird' },
]

const FW_COLORS = {
  curiosity:  'bg-amber-500/20 text-amber-300',
  contrarian: 'bg-red-500/20 text-red-300',
  big_stat:   'bg-blue-500/20 text-blue-300',
  question:   'bg-purple-500/20 text-purple-300',
  threat:     'bg-orange-500/20 text-orange-300',
  story:      'bg-green-500/20 text-green-300',
  social:     'bg-teal-500/20 text-teal-300',
  interrupt:  'bg-pink-500/20 text-pink-300',
}

function ScoreBar({ score }) {
  const pct = (score / 10) * 100
  const color = score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="progress-track flex-1">
        <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${score >= 8 ? 'text-green-400' : score >= 6 ? 'text-amber-400' : 'text-red-400'}`}>
        {score}/10
      </span>
    </div>
  )
}

function HookCard({ hook, isSaved, onSave, onRemove }) {
  const [copied, setCopied] = useState(false)
  const fw = FRAMEWORKS.find((f) => f.id === hook.framework)

  const copy = () => {
    navigator.clipboard.writeText(hook.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="bg-surface-800/50 border border-white/[0.06] rounded-xl p-4 space-y-2 hover:border-white/[0.12] transition-all">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-100 leading-relaxed flex-1">{hook.text}</p>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={copy} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors">
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
          <button onClick={isSaved ? onRemove : onSave} className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 transition-colors">
            {isSaved ? <BookmarkCheck size={13} className="text-amber-400" /> : <Bookmark size={13} />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {fw && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FW_COLORS[hook.framework]}`}>
            {fw.emoji} {fw.label}
          </span>
        )}
        {hook.visualConcept && (
          <span className="text-[10px] text-zinc-500 italic">{hook.visualConcept}</span>
        )}
      </div>
      <ScoreBar score={hook.score} />
    </div>
  )
}

export default function HookLab() {
  const { brandContext, brandVoice, hookLabResults, setHookLabResults, hookLibrary, addHook, removeHook } = useAdStore()
  const [platform, setPlatform] = useState('tiktok')
  const [frameworks, setFrameworks] = useState(['curiosity', 'contrarian', 'interrupt'])
  const [count, setCount] = useState(20)
  const [customProduct, setCustomProduct] = useState('')
  const [customAudience, setCustomAudience] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleFw = (id) => setFrameworks((prev) =>
    prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
  )

  const run = async () => {
    if (!getKey('anthropic')) { toast.error('Add your Anthropic key in Settings'); return }
    const product = customProduct || brandContext.product
    if (!product) { toast.error('Enter a product description'); return }
    setLoading(true)
    try {
      const results = await generateHooks({
        product,
        targetAudience: customAudience || brandContext.targetAudience,
        platform,
        frameworks: frameworks.length ? frameworks : FRAMEWORKS.map((f) => f.id),
        brandVoice,
        count,
      })
      setHookLabResults(results)
      toast.success(`${results.hooks.length} hooks generated`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveHook = (hook) => {
    addHook({ id: hook.id, text: hook.text, framework: hook.framework, platform, createdAt: new Date().toISOString() })
    toast.success('Saved to library')
  }

  const pl = PLATFORMS.find((p) => p.id === platform)

  return (
    <div className="space-y-7">
      <div>
        <h2 className="page-title">Hook Lab</h2>
        <p className="page-subtitle">Generate scroll-stopping opening hooks for video content. The first 3 seconds win or lose the viewer — get 20+ options using proven frameworks.</p>
      </div>

      {/* Config */}
      <div className="card space-y-5">
        <h3 className="section-title">Configuration</h3>

        {/* Platform */}
        <div>
          <label className="text-xs text-zinc-400 mb-2 block">Platform</label>
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  platform === p.id ? p.bg + ' ' + p.color : 'bg-surface-800/40 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{p.emoji}</span> {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Frameworks */}
        <div>
          <label className="text-xs text-zinc-400 mb-2 block">Hook Frameworks <span className="text-zinc-600">(select any — all = include all)</span></label>
          <div className="grid grid-cols-4 gap-2">
            {FRAMEWORKS.map((fw) => (
              <button
                key={fw.id}
                onClick={() => toggleFw(fw.id)}
                className={`p-2 rounded-xl border text-left transition-all ${
                  frameworks.includes(fw.id)
                    ? 'bg-brand-500/15 border-brand-500/40'
                    : 'bg-surface-800/40 border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="text-base">{fw.emoji}</div>
                <div className={`text-[11px] font-semibold mt-0.5 ${frameworks.includes(fw.id) ? 'text-brand-300' : 'text-zinc-400'}`}>{fw.label}</div>
                <div className="text-[10px] text-zinc-600 leading-snug mt-0.5">{fw.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Product override */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Product <span className="text-zinc-600">(leave blank to use brand context)</span></label>
            <input className="input text-sm" placeholder={brandContext.product || 'Your product…'} value={customProduct} onChange={(e) => setCustomProduct(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Audience <span className="text-zinc-600">(optional override)</span></label>
            <input className="input text-sm" placeholder={brandContext.targetAudience || 'Target audience…'} value={customAudience} onChange={(e) => setCustomAudience(e.target.value)} />
          </div>
        </div>

        {/* Count */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <label className="text-zinc-400">Number of hooks</label>
            <span className="text-brand-400 font-bold">{count}</span>
          </div>
          <input type="range" min={10} max={30} step={5} value={count} onChange={(e) => setCount(+e.target.value)}
            className="w-full accent-brand-500 h-1.5 rounded-full bg-surface-700 cursor-pointer" />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1"><span>10</span><span>20</span><span>30</span></div>
        </div>

        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={run} disabled={loading}>
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating hooks…</>
          ) : (
            <><Zap size={14} /> Generate {count} {pl?.emoji} Hooks</>
          )}
        </button>
      </div>

      {/* Results */}
      {hookLabResults?.hooks?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2">
              <TrendingUp size={14} className="text-brand-500" />
              {hookLabResults.hooks.length} Hooks Generated
            </h3>
            <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5" onClick={run} disabled={loading}>
              <RefreshCw size={12} /> Regenerate
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {hookLabResults.hooks.map((hook) => (
              <HookCard
                key={hook.id}
                hook={hook}
                isSaved={hookLibrary.some((h) => h.id === hook.id)}
                onSave={() => saveHook(hook)}
                onRemove={() => removeHook(hook.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Library */}
      {hookLibrary.length > 0 && (
        <div className="space-y-3">
          <h3 className="section-title">
            Saved Hook Library <span className="text-zinc-600 font-normal text-xs">({hookLibrary.length})</span>
          </h3>
          {hookLibrary.map((hook) => (
            <div key={hook.id} className="flex items-start gap-3 bg-surface-800/40 border border-white/[0.05] rounded-xl px-4 py-3">
              <div className="flex-1">
                <p className="text-sm text-zinc-200">{hook.text}</p>
                <div className="flex gap-2 mt-1.5">
                  {hook.framework && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FW_COLORS[hook.framework] || 'bg-zinc-700 text-zinc-300'}`}>
                      {FRAMEWORKS.find((f) => f.id === hook.framework)?.emoji} {FRAMEWORKS.find((f) => f.id === hook.framework)?.label}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-600">{new Date(hook.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => removeHook(hook.id)} className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
