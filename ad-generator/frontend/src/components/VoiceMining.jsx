import React, { useState } from 'react'
import { Mic2, Clipboard, Trash2, Copy, Check, ChevronDown, ChevronUp, Sparkles, Tag } from 'lucide-react'
import { useAdStore } from '../store/adStore'
import { mineCustomerVoice } from '../lib/api'
import { getKey } from '../lib/keys'
import toast from 'react-hot-toast'

const SOURCES = [
  { id: 'amazon',   label: 'Amazon Reviews',  emoji: '📦' },
  { id: 'g2',       label: 'G2 / Trustpilot', emoji: '⭐' },
  { id: 'reddit',   label: 'Reddit / Forums',  emoji: '💬' },
  { id: 'support',  label: 'Support Tickets',  emoji: '🎫' },
  { id: 'survey',   label: 'Survey Answers',   emoji: '📋' },
  { id: 'sales',    label: 'Sales Call Notes', emoji: '📞' },
]

function CopyBtn({ text }) {
  const [done, setDone] = useState(false)
  const go = () => {
    navigator.clipboard.writeText(text)
    setDone(true)
    setTimeout(() => setDone(false), 1600)
  }
  return (
    <button onClick={go} className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0">
      {done ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  )
}

function ResultCard({ result, onDelete }) {
  const [open, setOpen] = useState(true)
  const src = SOURCES.find((s) => s.id === result.source)
  const a = result.analysis

  return (
    <div className="card space-y-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{src?.emoji}</span>
          <span className="text-sm font-semibold text-white">{src?.label}</span>
          <span className="text-xs text-zinc-500">{new Date(result.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onDelete(result.id) }} className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
          {open ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="space-y-4 pt-3 border-t border-white/[0.06] mt-3">

          {/* Pain Words */}
          {a.painWords?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">🔥 Pain Words <span className="text-zinc-600 normal-case font-normal">(ranked by frequency)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {a.painWords.map((w, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-500/15 text-red-300 border border-red-500/25 px-2 py-0.5 rounded-full">
                    <span className="text-[10px] text-red-500 font-bold">{w.count}×</span> {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Gold Phrases */}
          {a.goldPhrases?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">💎 Gold Phrases <span className="text-zinc-600 normal-case font-normal">(use verbatim in copy)</span></p>
              <div className="space-y-1.5">
                {a.goldPhrases.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 bg-surface-800/50 border border-white/[0.05] rounded-lg px-3 py-2">
                    <span className="text-xs text-zinc-200 flex-1 italic">"{p}"</span>
                    <CopyBtn text={p} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emotional Triggers */}
          {a.emotionalTriggers?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">💡 Emotional Triggers</p>
              <div className="flex flex-wrap gap-1.5">
                {a.emotionalTriggers.map((t, i) => (
                  <span key={i} className="text-xs bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Before / After */}
          {a.transformations?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">🔄 Transformation Language</p>
              <div className="space-y-1.5">
                {a.transformations.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-red-400/80 line-through">{t.from}</span>
                    <span className="text-zinc-500">→</span>
                    <span className="text-green-400">{t.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* JTBD */}
          {a.jtbd?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">🎯 Jobs to Be Done</p>
              <ul className="space-y-1">
                {a.jtbd.map((j, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                    <span className="text-brand-500 flex-shrink-0 mt-0.5">▸</span> {j}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Objections */}
          {a.objections?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">🛡 Objections to Address</p>
              <div className="flex flex-wrap gap-1.5">
                {a.objections.map((o, i) => (
                  <span key={i} className="text-xs bg-surface-700/60 text-zinc-400 border border-white/[0.07] px-2 py-0.5 rounded-full">{o}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function VoiceMining() {
  const { voiceMiningResults, saveVoiceMining, deleteVoiceMining, brandContext } = useAdStore()
  const [sourceId, setSourceId] = useState('amazon')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!text.trim()) { toast.error('Paste some customer text first'); return }
    if (!getKey('anthropic')) { toast.error('Add your Anthropic key in Settings'); return }
    setLoading(true)
    try {
      const result = await mineCustomerVoice({ text, sourceType: sourceId, brandContext })
      saveVoiceMining(result)
      setText('')
      toast.success('Voice of customer extracted!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="page-title">Customer Voice Mining</h2>
        <p className="page-subtitle">Paste raw customer text — reviews, Reddit posts, support tickets, survey answers. AI extracts the exact language your customers use so your copy resonates like they wrote it.</p>
      </div>

      {/* Input */}
      <div className="card space-y-4">
        <h3 className="section-title">Paste Customer Text</h3>

        {/* Source selector */}
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSourceId(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                sourceId === s.id
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                  : 'bg-surface-800/40 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        <textarea
          className="textarea font-mono text-xs"
          rows={10}
          placeholder={`Paste ${SOURCES.find((s) => s.id === sourceId)?.label.toLowerCase()} here…\n\nTip: More text = richer insights. 10–50 reviews works great.`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600">{text.length.toLocaleString()} characters</span>
          <button className="btn-primary flex items-center gap-2" onClick={run} disabled={loading}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Extracting…</>
            ) : (
              <><Mic2 size={14} /> Mine Customer Voice</>
            )}
          </button>
        </div>
      </div>

      {/* Tip */}
      {voiceMiningResults.length === 0 && (
        <div className="info-box flex items-start gap-3">
          <Tag size={14} className="text-brand-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-brand-300 mb-0.5">Why this works</p>
            <p>Top copywriters spend hours reading customer reviews before writing a single word. This tool does it in seconds — extracting exact pain language, transformation phrases, and emotional triggers that make ads feel personal.</p>
          </div>
        </div>
      )}

      {/* Results */}
      {voiceMiningResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="section-title">Extracted Insights ({voiceMiningResults.length})</h3>
          {voiceMiningResults.map((r) => (
            <ResultCard key={r.id} result={r} onDelete={deleteVoiceMining} />
          ))}
        </div>
      )}
    </div>
  )
}
