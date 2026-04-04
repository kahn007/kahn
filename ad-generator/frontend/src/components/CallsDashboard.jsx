import React, { useState, useEffect } from 'react'
import {
  Phone, PhoneIncoming, PhoneMissed, RefreshCw, Loader2,
  Tag, FileText, Filter, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react'
import { useAdStore } from '../store/adStore'
import { getKey } from '../lib/keys'

const CALL_TAGS = [
  { id: 'booked',         label: 'Booked',         color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  { id: 'follow_up',      label: 'Follow Up',      color: 'text-yellow-400  bg-yellow-500/15  border-yellow-500/30'  },
  { id: 'voicemail',      label: 'Voicemail',      color: 'text-zinc-400    bg-zinc-500/15    border-zinc-500/30'    },
  { id: 'not_interested', label: 'Not Interested', color: 'text-red-400     bg-red-500/15     border-red-500/30'     },
  { id: 'callback',       label: 'Callback',       color: 'text-blue-400    bg-blue-500/15    border-blue-500/30'    },
  { id: 'wrong_number',   label: 'Wrong Number',   color: 'text-orange-400  bg-orange-500/15  border-orange-500/30'  },
  { id: 'no_answer',      label: 'No Answer',      color: 'text-purple-400  bg-purple-500/15  border-purple-500/30'  },
]

function tagStyle(id)  { return CALL_TAGS.find(t => t.id === id)?.color || 'text-zinc-400 bg-zinc-500/15 border-zinc-500/30' }
function tagLabel(id)  { return CALL_TAGS.find(t => t.id === id)?.label || id }

function getCallTags(agentId) {
  try { return JSON.parse(localStorage.getItem(`call_tags_${agentId}`) || '{}') } catch { return {} }
}
function saveCallTags(agentId, tags) {
  localStorage.setItem(`call_tags_${agentId}`, JSON.stringify(tags))
}

// Auto-tag a call based on Vapi's endedReason + transcript + summary
function autoTag(call) {
  const tags  = []
  const ended = (call.endedReason || '').toLowerCase()
  const text  = ((call.transcript || '') + ' ' + (call.summary || '')).toLowerCase()

  // Vapi-reported reasons
  if (ended.includes('voicemail'))                       tags.push('voicemail')
  if (ended === 'no-answer' || ended === 'no_answer')    tags.push('no_answer')

  // Booked / appointment confirmed
  if (/booked|appointment.{0,20}confirm|scheduled|you.re all set|i.ve got you down|see you (on|at)|you.re in/.test(text))
    tags.push('booked')

  // Not interested
  if (/not interested|no thank|don.t (want|need)|not for me|remove me|stop calling|take me off|unsubscribe/.test(text))
    tags.push('not_interested')

  // Callback requested
  if (/call.{0,10}(me )?back|try.{0,10}again|better time|reach me later|catch (me|you) later|call tomorrow/.test(text))
    tags.push('callback')

  // Wrong number
  if (/wrong number|wrong person|not the right|don.t know (who|why)|looking for someone/.test(text))
    tags.push('wrong_number')

  // Short call with no transcript → likely no answer
  const durationSecs = call.startedAt && call.endedAt
    ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
    : null
  if (!tags.length && durationSecs !== null && durationSecs < 15 && !call.transcript)
    tags.push('no_answer')

  return [...new Set(tags)]
}

function fmtDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return '—'
  const secs = Math.round((new Date(endedAt) - new Date(startedAt)) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function CallsDashboard() {
  const { voiceAgents } = useAdStore()
  const vapiKey = getKey('vapi')

  const [selectedId, setSelectedId] = useState(() => voiceAgents[0]?.id || '')
  const [calls,      setCalls]      = useState([])
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState('')
  const [tags,       setTags]       = useState({})       // { callId: string[] } — manual overrides
  const [autoTags,   setAutoTags]   = useState({})       // { callId: string[] } — computed on load
  const [filterTag,  setFilterTag]  = useState('all')
  const [expanded,   setExpanded]   = useState(null)

  const agent = voiceAgents.find(a => a.id === selectedId)

  // Effective tags = manual tags if set, otherwise auto-tags
  function effectiveTags(callId) {
    return tags[callId] !== undefined ? tags[callId] : (autoTags[callId] || [])
  }

  useEffect(() => {
    if (selectedId) setTags(getCallTags(selectedId))
  }, [selectedId])

  useEffect(() => {
    setCalls([]); setAutoTags({}); setErr('')
    if (agent?.vapiAssistantId && vapiKey) fetchCalls()
  }, [selectedId])

  async function fetchCalls() {
    if (!vapiKey || !agent?.vapiAssistantId) return
    setLoading(true); setErr('')
    try {
      const res = await fetch(
        `https://api.vapi.ai/call?assistantId=${agent.vapiAssistantId}&limit=100`,
        { headers: { Authorization: `Bearer ${vapiKey}` } }
      )
      if (!res.ok) throw new Error(`Vapi ${res.status}`)
      const data  = await res.json()
      const list  = Array.isArray(data) ? data : (data.results || [])
      setCalls(list)
      // Auto-tag every call
      const computed = {}
      list.forEach(c => { computed[c.id] = autoTag(c) })
      setAutoTags(computed)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  function toggleTag(callId, tagId) {
    // Start from effective tags so we don't lose auto-tags on first manual edit
    const base    = effectiveTags(callId)
    const updated = { ...tags }
    updated[callId] = base.includes(tagId)
      ? base.filter(t => t !== tagId)
      : [...base, tagId]
    setTags(updated)
    saveCallTags(selectedId, updated)
  }

  const filtered = filterTag === 'all'
    ? calls
    : calls.filter(c => effectiveTags(c.id).includes(filterTag))

  // Tag summary counts using effective tags
  const tagCounts = CALL_TAGS.reduce((acc, t) => {
    acc[t.id] = calls.filter(c => effectiveTags(c.id).includes(t.id)).length
    return acc
  }, {})

  if (!vapiKey) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-2">
        <AlertCircle size={24} className="text-zinc-700 mx-auto"/>
        <p className="text-sm text-zinc-500">Add your Vapi API key in Settings first</p>
      </div>
    </div>
  )

  if (voiceAgents.length === 0) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-2">
        <Phone size={24} className="text-zinc-700 mx-auto"/>
        <p className="text-sm text-zinc-500">No voice agents yet — create one in Voice Agents</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Agent picker + stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="input max-w-xs"
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setFilterTag('all'); setExpanded(null) }}>
          {voiceAgents.map(a => (
            <option key={a.id} value={a.id}>{a.name || 'Unnamed Agent'}</option>
          ))}
        </select>

        {calls.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {CALL_TAGS.filter(t => tagCounts[t.id] > 0).map(t => (
              <span key={t.id} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${t.color}`}>
                {tagCounts[t.id]} {t.label}
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {calls.length > 0 && <span className="text-xs text-zinc-600">{calls.length} calls</span>}
          <button onClick={fetchCalls} disabled={loading} className="btn-ghost text-xs">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>
      </div>

      {/* No assistant synced */}
      {!agent?.vapiAssistantId && (
        <div className="border border-white/[0.06] rounded-xl p-8 text-center">
          <PhoneIncoming size={24} className="text-zinc-700 mx-auto mb-3"/>
          <p className="text-sm text-zinc-500 mb-1">This agent hasn't been synced to Vapi yet</p>
          <p className="text-xs text-zinc-600">Go to Voice Agents → Calls tab → Sync to Vapi first</p>
        </div>
      )}

      {agent?.vapiAssistantId && (
        <div className="border border-white/[0.06] rounded-xl overflow-hidden">

          {/* Tag filter bar */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/[0.04] overflow-x-auto bg-surface-900/40">
            <Filter size={10} className="text-zinc-600 shrink-0"/>
            <button onClick={() => setFilterTag('all')}
              className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-all
                ${filterTag === 'all' ? 'text-white bg-white/10 border-white/20' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}>
              All {calls.length > 0 && `(${calls.length})`}
            </button>
            {CALL_TAGS.map(t => (
              <button key={t.id} onClick={() => setFilterTag(filterTag === t.id ? 'all' : t.id)}
                className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-all
                  ${filterTag === t.id ? t.color : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}>
                {t.label} {tagCounts[t.id] > 0 && `(${tagCounts[t.id]})`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="divide-y divide-white/[0.04]">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12">
                <Loader2 size={16} className="animate-spin text-zinc-600"/>
                <span className="text-sm text-zinc-600">Loading calls…</span>
              </div>
            )}
            {err && <p className="text-sm text-red-400 p-6">{err}</p>}
            {!loading && !err && filtered.length === 0 && (
              <div className="py-12 text-center">
                <Phone size={20} className="text-zinc-700 mx-auto mb-2"/>
                <p className="text-sm text-zinc-600">
                  {filterTag === 'all' ? 'No calls yet' : `No calls tagged "${tagLabel(filterTag)}"`}
                </p>
              </div>
            )}

            {filtered.map(call => {
              const callTags   = effectiveTags(call.id)
              const isAutoOnly = tags[call.id] === undefined && callTags.length > 0
              const isOpen     = expanded === call.id
              const phone      = call.customer?.number || call.phoneNumber?.number || 'Unknown'
              const duration   = fmtDuration(call.startedAt, call.endedAt)
              const date       = fmtDate(call.startedAt)
              const ended      = call.endedReason || call.status || ''

              return (
                <div key={call.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : call.id)}>

                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                      ${ended.includes('voicemail') ? 'bg-zinc-500/10' : ended.includes('customer') ? 'bg-emerald-500/10' : 'bg-brand-500/10'}`}>
                      {ended.includes('voicemail')
                        ? <PhoneMissed size={14} className="text-zinc-500"/>
                        : <Phone size={14} className="text-brand-400"/>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono text-white">{phone}</span>
                        {callTags.map(t => (
                          <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${tagStyle(t)}`}>
                            {tagLabel(t)}
                          </span>
                        ))}
                        {isAutoOnly && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border text-zinc-600 border-zinc-700/50 bg-zinc-800/30">
                            auto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 mt-0.5">{date} · {duration}</p>
                    </div>

                    {isOpen
                      ? <ChevronUp size={13} className="text-zinc-600 shrink-0"/>
                      : <ChevronDown size={13} className="text-zinc-600 shrink-0"/>}
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 bg-white/[0.01] border-t border-white/[0.04]">

                      {/* Tags */}
                      <div className="pt-3">
                        <p className="text-[10px] text-zinc-600 mb-2 flex items-center gap-1">
                          <Tag size={9}/>Tag this call
                          {isAutoOnly && <span className="text-zinc-700 ml-1">— auto-tagged, click to override</span>}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {CALL_TAGS.map(t => (
                            <button key={t.id} onClick={() => toggleTag(call.id, t.id)}
                              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
                                ${callTags.includes(t.id) ? t.color : 'text-zinc-500 bg-transparent border-white/[0.08] hover:border-white/20'}`}>
                              {callTags.includes(t.id) ? '✓ ' : ''}{t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Summary */}
                      {call.summary && (
                        <div className="p-3 bg-surface-900 rounded-xl border border-white/[0.06]">
                          <p className="text-[10px] text-zinc-500 font-semibold mb-1.5">AI Summary</p>
                          <p className="text-sm text-zinc-300 leading-relaxed">{call.summary}</p>
                        </div>
                      )}

                      {/* Transcript */}
                      {call.transcript && (
                        <div>
                          <p className="text-[10px] text-zinc-600 mb-1.5 flex items-center gap-1"><FileText size={9}/>Transcript</p>
                          <div className="bg-surface-900 border border-white/[0.06] rounded-xl p-3 max-h-64 overflow-y-auto space-y-2">
                            {call.transcript.split('\n').filter(Boolean).map((line, i) => {
                              const isAgent = line.toLowerCase().startsWith('assistant') || line.toLowerCase().startsWith('ai')
                              return (
                                <p key={i} className={`text-xs leading-relaxed ${isAgent ? 'text-brand-300' : 'text-zinc-400'}`}>
                                  {line}
                                </p>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recording */}
                      {call.recordingUrl && (
                        <div>
                          <p className="text-[10px] text-zinc-600 mb-1.5">Recording</p>
                          <audio controls src={call.recordingUrl} className="w-full h-9" style={{ filter: 'invert(0.85)' }}/>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex gap-4 text-xs text-zinc-600">
                        <span>Duration: <span className="text-zinc-400">{duration}</span></span>
                        {call.cost != null && <span>Cost: <span className="text-zinc-400">${call.cost.toFixed(3)}</span></span>}
                        {ended && <span>Ended: <span className="text-zinc-400">{ended.replace(/-/g,' ')}</span></span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
