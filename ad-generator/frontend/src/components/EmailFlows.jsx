import React, { useState } from 'react'
import {
  Mail, RefreshCw, Copy, Check, ChevronDown, ChevronUp,
  Trash2, Download, Zap, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { generateEmailSequence, EMAIL_SEQUENCE_SPECS } from '../lib/api'

const TYPE_COLORS = {
  welcome:      'text-brand-400 bg-brand-500/10 border-brand-500/20',
  nurture:      'text-green-400 bg-green-500/10 border-green-500/20',
  sales:        'text-orange-400 bg-orange-500/10 border-orange-500/20',
  reactivation: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
}

// ── Copy button ───────────────────────────────────────────────
function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
    >
      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      {label || 'Copy'}
    </button>
  )
}

// ── Single email card ─────────────────────────────────────────
function EmailCard({ email, index }) {
  const [open, setOpen] = useState(index === 0)

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-start gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="w-7 h-7 rounded-lg bg-surface-800 border border-white/[0.06] flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-400 mt-0.5">
          {email.emailNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white text-sm font-semibold leading-snug truncate">{email.subject}</p>
            {email.sendDay !== undefined && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-600 flex-shrink-0">
                <Clock size={9} />
                Day {email.sendDay}
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-xs mt-0.5 truncate">{email.previewText}</p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {open ? <ChevronUp size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
          {/* Subject + preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-surface-800/50 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-zinc-500 text-xs">Subject line</p>
                <CopyBtn text={email.subject} />
              </div>
              <p className="text-white text-sm font-medium">{email.subject}</p>
              <p className={`text-[10px] ${email.subject?.length > 48 ? 'text-amber-400' : 'text-zinc-600'}`}>
                {email.subject?.length || 0}/48 chars
              </p>
            </div>
            <div className="bg-surface-800/50 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-zinc-500 text-xs">Preview text</p>
                <CopyBtn text={email.previewText} />
              </div>
              <p className="text-zinc-300 text-sm">{email.previewText}</p>
              <p className={`text-[10px] ${email.previewText?.length > 110 ? 'text-amber-400' : 'text-zinc-600'}`}>
                {email.previewText?.length || 0}/110 chars
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-zinc-500 text-xs">Email body</p>
              <CopyBtn text={email.body} label="Copy body" />
            </div>
            <div className="bg-surface-800/30 rounded-xl p-4 border border-white/[0.04]">
              <pre className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">{email.body}</pre>
            </div>
          </div>

          {/* CTA */}
          {email.cta && (
            <div className="flex items-center gap-3 p-3 bg-surface-800/50 rounded-xl border border-white/[0.06]">
              <div className="flex-1 min-w-0">
                <p className="text-zinc-500 text-xs mb-0.5">CTA</p>
                <p className="text-white text-sm font-semibold">{email.cta.text}</p>
                {email.cta.url && email.cta.url !== '#' && (
                  <p className="text-zinc-600 text-xs font-mono truncate mt-0.5">{email.cta.url}</p>
                )}
              </div>
              <CopyBtn text={`${email.cta.text}\n${email.cta.url || ''}`} label="Copy CTA" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Saved sequence card ───────────────────────────────────────
function SavedSequenceCard({ seq, onOpen, onDelete }) {
  const color = TYPE_COLORS[seq.type] || TYPE_COLORS.welcome
  return (
    <div
      className="card card-hover cursor-pointer"
      onClick={() => onOpen(seq)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
              {seq.label}
            </span>
            <span className="text-zinc-600 text-xs">{seq.emails.length} emails</span>
          </div>
          <p className="text-white text-sm font-medium truncate">{seq.product || 'Untitled'}</p>
          <p className="text-zinc-600 text-xs mt-0.5">
            {new Date(seq.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <button
          className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(seq.id) }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── CSV export for email sequence ─────────────────────────────
function exportSequenceCsv(seq) {
  const esc = (s) => `"${String(s || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  const headers = ['Email #', 'Send Day', 'Subject', 'Preview Text', 'Body', 'CTA Text', 'CTA URL']
  const rows = seq.emails.map((e) => [
    e.emailNumber, e.sendDay, esc(e.subject), esc(e.previewText),
    esc(e.body), esc(e.cta?.text), esc(e.cta?.url),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `${seq.type}-sequence-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// ── Main component ────────────────────────────────────────────
export default function EmailFlows() {
  const {
    brandContext,
    researchSessions, activeResearchId,
    emailSequences, saveEmailSequence, deleteEmailSequence,
  } = useAdStore()

  const [selectedType, setSelectedType] = useState('welcome')
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeSeq, setActiveSeq] = useState(null)

  const activeSession = researchSessions.find((r) => r.id === activeResearchId)
  const insights = activeSession?.insights || null

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const result = await generateEmailSequence({
        type: selectedType,
        brandContext,
        insights,
      })
      saveEmailSequence(result)
      setActiveSeq(result)
      toast.success(`${result.emails.length}-email ${result.label} generated!`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = (id) => {
    deleteEmailSequence(id)
    if (activeSeq?.id === id) setActiveSeq(null)
    toast.success('Sequence deleted')
  }

  const seqToShow = activeSeq || emailSequences[0] || null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Email Flows</h2>
        <p className="page-subtitle">
          Generate full email sequences from your audience research — welcome, nurture, sales, and reactivation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: config + history */}
        <div className="space-y-4">
          {/* Sequence type */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-white text-sm">Sequence Type</h3>
            <div className="space-y-2">
              {Object.entries(EMAIL_SEQUENCE_SPECS).map(([id, spec]) => {
                const active = selectedType === id
                const color = TYPE_COLORS[id] || TYPE_COLORS.welcome
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedType(id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      active
                        ? color.replace('text-', '').replace('bg-', 'bg-').replace('border-', 'border-')
                        : 'bg-surface-800/40 border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                      active
                        ? color.split(' ')[0].replace('text-', 'bg-').replace('400', '400')
                        : 'bg-zinc-600'
                    }`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-zinc-300'}`}>
                          {spec.label}
                        </p>
                        <span className="text-zinc-600 text-xs">{spec.count} emails</span>
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{spec.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Research indicator */}
          <div className="card">
            <p className="text-zinc-500 text-xs mb-2">Research data</p>
            {insights ? (
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="dot-green" />
                  {activeSession?.name}
                </div>
                <p className="text-zinc-600">{insights.painPoints?.length} pain points · {insights.triggerPhrases?.length} trigger phrases</p>
              </div>
            ) : (
              <p className="text-zinc-600 text-xs">No research selected — run Research first for better emails</p>
            )}
          </div>

          <button
            className="btn-primary w-full"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating
              ? <><RefreshCw size={14} className="animate-spin" /> Writing sequence…</>
              : <><Zap size={14} /> Generate {EMAIL_SEQUENCE_SPECS[selectedType]?.label}</>
            }
          </button>

          {/* Saved sequences */}
          {emailSequences.length > 0 && (
            <div className="space-y-2">
              <p className="section-title">Saved Sequences ({emailSequences.length})</p>
              {emailSequences.map((seq) => (
                <SavedSequenceCard
                  key={seq.id}
                  seq={seq}
                  onOpen={(s) => setActiveSeq(s)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: output */}
        <div className="space-y-4">
          {seqToShow ? (
            <>
              {/* Sequence header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[seqToShow.type]}`}>
                      {seqToShow.label}
                    </span>
                    <span className="text-zinc-500 text-xs">{seqToShow.emails.length} emails</span>
                  </div>
                  <p className="text-white font-semibold text-sm mt-1">{seqToShow.product}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => exportSequenceCsv(seqToShow)}
                    title="Download as CSV"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => {
                      const text = seqToShow.emails.map((e) =>
                        `SUBJECT: ${e.subject}\nPREVIEW: ${e.previewText}\n\n${e.body}\n\nCTA: ${e.cta?.text}`
                      ).join('\n\n---\n\n')
                      navigator.clipboard.writeText(text)
                      toast.success('All emails copied!')
                    }}
                  >
                    <Copy size={13} /> Copy All
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative space-y-3">
                {seqToShow.emails.map((email, i) => (
                  <div key={i} className="flex gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-6 h-6 rounded-full bg-surface-800 border border-white/[0.08] flex items-center justify-center">
                        <Mail size={10} className="text-zinc-400" />
                      </div>
                      {i < seqToShow.emails.length - 1 && (
                        <div className="w-px flex-1 bg-white/[0.06] my-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-3">
                      <EmailCard email={email} index={i} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="card min-h-[320px] flex items-center justify-center">
              <div className="empty-state">
                <div className="empty-icon"><Mail size={18} /></div>
                <p className="empty-title">No sequences yet</p>
                <p className="empty-body">
                  Select a type and click Generate to create your first email sequence
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
