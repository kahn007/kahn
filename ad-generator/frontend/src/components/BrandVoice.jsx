import React, { useState } from 'react'
import { Zap, Plus, X, Eye, Copy, Check } from 'lucide-react'
import { useAdStore } from '../store/adStore'
import toast from 'react-hot-toast'

const ARCHETYPES = [
  { id: 'creator',  label: 'Creator',   emoji: '🎨', desc: 'Innovative, expressive, original — builds for others to use' },
  { id: 'hero',     label: 'Hero',       emoji: '⚔️',  desc: 'Bold, courageous, results-driven — overcomes challenges' },
  { id: 'sage',     label: 'Sage',       emoji: '🦉', desc: 'Expert, data-backed, educational — helps people understand' },
  { id: 'explorer', label: 'Explorer',   emoji: '🧭', desc: 'Freedom-focused, authentic, pioneering — breaks boundaries' },
  { id: 'rebel',    label: 'Rebel',      emoji: '🔥', desc: 'Disruptive, anti-establishment, provocative — challenges norms' },
  { id: 'jester',   label: 'Jester',     emoji: '🎭', desc: 'Playful, witty, irreverent — makes marketing memorable' },
  { id: 'caregiver',label: 'Caregiver',  emoji: '💚', desc: 'Nurturing, supportive, empathetic — customers feel safe' },
  { id: 'ruler',    label: 'Ruler',      emoji: '👑', desc: 'Authoritative, premium, exclusive — commands respect' },
]

function TagInput({ tags, onAdd, onRemove, placeholder, color = 'brand' }) {
  const [val, setVal] = useState('')
  const colorMap = {
    brand: 'bg-brand-500/20 text-brand-300 border-brand-500/30',
    red:   'bg-red-500/20 text-red-300 border-red-500/30',
  }
  const submit = () => {
    const t = val.trim()
    if (t && !tags.includes(t)) { onAdd(t); setVal('') }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        />
        <button className="btn-secondary px-3 text-sm" onClick={submit} type="button">
          <Plus size={13} />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${colorMap[color]}`}>
              {t}
              <button onClick={() => onRemove(t)} className="hover:opacity-70"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BrandVoice() {
  const { brandVoice, setBrandVoice } = useAdStore()
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  const up = (k, v) => setBrandVoice({ [k]: v })

  const promptPreview = buildVoicePrompt(brandVoice)

  const copyPrompt = () => {
    navigator.clipboard.writeText(promptPreview)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
    toast.success('Voice context copied')
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="page-title">Brand Voice DNA</h2>
        <p className="page-subtitle">Define your brand's personality once. It's automatically injected into every generation to keep all copy consistent.</p>
      </div>

      {/* Archetype */}
      <div className="card space-y-4">
        <h3 className="section-title">Brand Archetype</h3>
        <div className="grid grid-cols-4 gap-2">
          {ARCHETYPES.map((a) => (
            <button
              key={a.id}
              onClick={() => up('archetype', a.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                brandVoice.archetype === a.id
                  ? 'bg-brand-500/15 border-brand-500/40 ring-1 ring-brand-500/30'
                  : 'bg-surface-800/40 border-white/[0.06] hover:border-white/[0.14]'
              }`}
            >
              <div className="text-xl mb-1">{a.emoji}</div>
              <div className={`text-xs font-bold mb-0.5 ${brandVoice.archetype === a.id ? 'text-brand-300' : 'text-zinc-300'}`}>
                {a.label}
              </div>
              <div className="text-[10px] text-zinc-500 leading-snug">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tone sliders */}
      <div className="card space-y-5">
        <h3 className="section-title">Tone Dials</h3>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Formal / Professional</span>
            <span className="text-brand-400 font-medium tabular-nums">{brandVoice.tone}%</span>
            <span className="text-zinc-400">Casual / Conversational</span>
          </div>
          <input type="range" min={0} max={100} value={brandVoice.tone}
            onChange={(e) => up('tone', +e.target.value)}
            className="w-full accent-brand-500 h-1.5 rounded-full bg-surface-700 cursor-pointer" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Calm / Measured</span>
            <span className="text-brand-400 font-medium tabular-nums">{brandVoice.energy}%</span>
            <span className="text-zinc-400">Bold / High-Energy</span>
          </div>
          <input type="range" min={0} max={100} value={brandVoice.energy}
            onChange={(e) => up('energy', +e.target.value)}
            className="w-full accent-brand-500 h-1.5 rounded-full bg-surface-700 cursor-pointer" />
        </div>
      </div>

      {/* Vocabulary */}
      <div className="card space-y-5">
        <h3 className="section-title">Vocabulary Rules</h3>
        <div>
          <label className="text-xs text-zinc-400 mb-2 block">✅ Always use these words / phrases</label>
          <TagInput
            tags={brandVoice.alwaysUse}
            onAdd={(t) => up('alwaysUse', [...brandVoice.alwaysUse, t])}
            onRemove={(t) => up('alwaysUse', brandVoice.alwaysUse.filter((x) => x !== t))}
            placeholder="e.g. results-driven, effortless…"
            color="brand"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-2 block">🚫 Never use these words / phrases</label>
          <TagInput
            tags={brandVoice.neverUse}
            onAdd={(t) => up('neverUse', [...brandVoice.neverUse, t])}
            onRemove={(t) => up('neverUse', brandVoice.neverUse.filter((x) => x !== t))}
            placeholder="e.g. cheap, basic, simple…"
            color="red"
          />
        </div>
      </div>

      {/* Unique mechanism + differentiators */}
      <div className="card space-y-4">
        <h3 className="section-title">Positioning</h3>
        <div>
          <label className="text-xs text-zinc-400 mb-1.5 block">Unique Mechanism <span className="text-zinc-600">(the HOW behind your results)</span></label>
          <input
            className="input"
            placeholder="e.g. Our 3-step AI pipeline that reduces ad spend by 40%"
            value={brandVoice.uniqueMechanism}
            onChange={(e) => up('uniqueMechanism', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1.5 block">Key Differentiators <span className="text-zinc-600">(why you vs. competitors)</span></label>
          <textarea
            className="textarea"
            rows={2}
            placeholder="e.g. Only platform that does X + Y in one place. No contracts, no agency fees."
            value={brandVoice.differentiators}
            onChange={(e) => up('differentiators', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1.5 block">Example of Great Copy <span className="text-zinc-600">(paste your best ad or email — AI learns the style)</span></label>
          <textarea
            className="textarea"
            rows={4}
            placeholder="Paste a piece of copy that perfectly represents your brand voice…"
            value={brandVoice.exampleCopy}
            onChange={(e) => up('exampleCopy', e.target.value)}
          />
        </div>
      </div>

      {/* Preview */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Live Prompt Preview</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowPreview((v) => !v)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <Eye size={12} /> {showPreview ? 'Hide' : 'Preview'}
            </button>
            <button onClick={copyPrompt} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              Copy
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500">This context block is automatically injected into every Claude generation call.</p>
        {showPreview && (
          <pre className="bg-surface-800/60 border border-white/[0.06] rounded-xl p-4 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono overflow-auto max-h-64">
            {promptPreview || '(Fill in fields above to see your brand voice context)'}
          </pre>
        )}
      </div>
    </div>
  )
}

export function buildVoicePrompt(bv) {
  if (!bv) return ''
  const parts = []
  const arch = ARCHETYPES.find((a) => a.id === bv.archetype)
  if (arch) parts.push(`Brand Archetype: ${arch.label} — ${arch.desc}`)

  const toneLabel  = bv.tone  < 33 ? 'formal and professional' : bv.tone  > 66 ? 'casual and conversational' : 'balanced (neither stiff nor slangy)'
  const energyLabel = bv.energy < 33 ? 'calm and measured'       : bv.energy > 66 ? 'bold and high-energy'       : 'steady confidence'
  parts.push(`Tone: ${toneLabel}. Energy: ${energyLabel}.`)

  if (bv.alwaysUse?.length)    parts.push(`Always use these words/phrases: ${bv.alwaysUse.join(', ')}.`)
  if (bv.neverUse?.length)     parts.push(`Never use these words/phrases: ${bv.neverUse.join(', ')}.`)
  if (bv.uniqueMechanism)      parts.push(`Unique mechanism: ${bv.uniqueMechanism}`)
  if (bv.differentiators)      parts.push(`Key differentiators: ${bv.differentiators}`)
  if (bv.exampleCopy)          parts.push(`Mirror the voice in this example copy:\n"${bv.exampleCopy}"`)

  return parts.length ? `[BRAND VOICE]\n${parts.join('\n')}` : ''
}
