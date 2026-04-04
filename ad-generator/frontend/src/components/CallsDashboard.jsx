import React, { useState, useEffect } from 'react'
import {
  Phone, PhoneIncoming, PhoneMissed, RefreshCw, Loader2,
  Tag, FileText, Filter, ChevronDown, ChevronUp, AlertCircle,
  TrendingUp, Clock, DollarSign, CheckCircle, PhoneCall,
  ArrowRight, Zap, Users,
} from 'lucide-react'
import { useAdStore } from '../store/adStore'
import { getKey } from '../lib/keys'
import { triggerVapiCall } from '../lib/api'

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
  const ended      = (call.endedReason || call.status || '').toLowerCase()
  const transcript = (call.transcript || '').toLowerCase()
  const summary    = (call.summary    || '').toLowerCase()
  const text       = transcript + ' ' + summary

  const durationSecs = call.startedAt && call.endedAt
    ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
    : 0

  // ── Pipeline / system errors ─────────────────────────────────
  // Vapi couldn't start the call (bad credentials, config error, etc.)
  if (ended.includes('pipeline') || ended.includes('error') || ended.includes('failed'))
    return ['no_answer']

  // ── Voicemail ────────────────────────────────────────────────
  if (ended.includes('voicemail') || /voicemail|leave a message|after the (beep|tone)/.test(text))
    return ['voicemail']

  // ── No transcript at all → no answer / didn't connect ───────
  if (!transcript && !summary)
    return ['no_answer']

  // ── Booked — STRICT: explicit confirmation only ──────────────
  // Must have a clear "appointment confirmed / you're all set / see you [day]"
  // NOT triggered by "I want to book" or "just book appointment"
  if (/(appointment|call).{0,40}(confirmed|booked|scheduled|set up)|you.re (all set|booked in|scheduled|confirmed)|i.ve (booked|scheduled|got you|put you).{0,30}(in|down|for)|see you (on |at )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(st|nd|rd|th)?)/.test(text))
    return ['booked']

  // ── Not interested ───────────────────────────────────────────
  if (/not interested|no thank|don.t (want|need)|not for me|remove me|stop calling|take me off|not looking/.test(text))
    return ['not_interested']

  // ── Wrong number ─────────────────────────────────────────────
  if (/wrong number|wrong person|not the right (number|person)|don.t know (who|why you)/.test(text))
    return ['wrong_number']

  // ── Callback ─────────────────────────────────────────────────
  if (/call.{0,10}(me )?back|try.{0,5}again|better time|reach me later|call (me )?(tomorrow|later|tonight)/.test(text))
    return ['callback']

  // ── Engaged but didn't complete booking → Follow Up ─────────
  // Had a real conversation (30s+) and showed interest
  if (durationSecs >= 30 && /interested|sounds good|tell me more|how does|love it|that.s (great|brilliant|perfect|good)|want to|sign me up|let.s do|definitely|absolutely|for sure/.test(text))
    return ['follow_up']

  // ── Short real call with no clear outcome ────────────────────
  if (durationSecs < 20)
    return ['no_answer']

  // ── Had a conversation but no clear signal → Follow Up ───────
  if (transcript)
    return ['follow_up']

  return ['no_answer']
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

// ── Stat card ─────────────────────────────────────────────────
function Stat({ icon: Icon, label, value, sub, color = 'text-white' }) {
  return (
    <div className="border border-white/[0.06] rounded-xl p-4 space-y-1 bg-surface-900/30">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-zinc-600"/>
        <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  )
}

// ── Call row (shared by Log + Pipeline) ───────────────────────
function CallRow({ call, effectiveTags, isAutoOnly, toggleTag, onCallAgain, callingId }) {
  const [open, setOpen] = useState(false)
  const callTags = effectiveTags(call.id)
  const phone    = call.customer?.number || call.phoneNumber?.number || 'Unknown'
  const duration = fmtDuration(call.startedAt, call.endedAt)
  const date     = fmtDate(call.startedAt)
  const ended    = call.endedReason || call.status || ''
  const isCalling = callingId === call.id

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer
          ${ended.includes('voicemail') ? 'bg-zinc-500/10' : ended.includes('customer') ? 'bg-emerald-500/10' : 'bg-brand-500/10'}`}
          onClick={() => setOpen(o => !o)}>
          {ended.includes('voicemail')
            ? <PhoneMissed size={14} className="text-zinc-500"/>
            : <Phone size={14} className="text-brand-400"/>}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono text-white">{phone}</span>
            {callTags.map(t => (
              <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${tagStyle(t)}`}>
                {tagLabel(t)}
              </span>
            ))}
            {isAutoOnly(call.id) && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full border text-zinc-600 border-zinc-700/50 bg-zinc-800/30">auto</span>
            )}
          </div>
          <p className="text-xs text-zinc-600 mt-0.5 truncate">
            {date} · {duration}
            {call.summary && <span className="ml-2 text-zinc-700">— {call.summary.slice(0, 60)}…</span>}
          </p>
        </div>

        {/* Call again */}
        {onCallAgain && (
          <button onClick={() => onCallAgain(phone, call.id)}
            disabled={isCalling}
            className="shrink-0 flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-green-500/25 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
            {isCalling ? <Loader2 size={10} className="animate-spin"/> : <PhoneCall size={10}/>}
            {isCalling ? 'Calling…' : 'Call Again'}
          </button>
        )}

        <div className="cursor-pointer" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronUp size={13} className="text-zinc-600"/> : <ChevronDown size={13} className="text-zinc-600"/>}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 bg-white/[0.01] border-t border-white/[0.04]">
          {/* Tags */}
          <div className="pt-3">
            <p className="text-[10px] text-zinc-600 mb-2 flex items-center gap-1">
              <Tag size={9}/>Tag this call
              {isAutoOnly(call.id) && <span className="text-zinc-700 ml-1">— auto-tagged, click to override</span>}
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

          {call.summary && (
            <div className="p-3 bg-surface-900 rounded-xl border border-white/[0.06]">
              <p className="text-[10px] text-zinc-500 font-semibold mb-1.5">AI Summary</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{call.summary}</p>
            </div>
          )}

          {call.transcript && (
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5 flex items-center gap-1"><FileText size={9}/>Transcript</p>
              <div className="bg-surface-900 border border-white/[0.06] rounded-xl p-3 max-h-64 overflow-y-auto space-y-2">
                {call.transcript.split('\n').filter(Boolean).map((line, i) => {
                  const isAgt = line.toLowerCase().startsWith('assistant') || line.toLowerCase().startsWith('ai')
                  return <p key={i} className={`text-xs leading-relaxed ${isAgt ? 'text-brand-300' : 'text-zinc-400'}`}>{line}</p>
                })}
              </div>
            </div>
          )}

          {call.recordingUrl && (
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5">Recording</p>
              <audio controls src={call.recordingUrl} className="w-full h-9" style={{ filter: 'invert(0.85)' }}/>
            </div>
          )}

          <div className="flex gap-4 text-xs text-zinc-600">
            <span>Duration: <span className="text-zinc-400">{duration}</span></span>
            {call.cost != null && <span>Cost: <span className="text-zinc-400">${call.cost.toFixed(3)}</span></span>}
            {ended && <span>Ended: <span className="text-zinc-400">{ended.replace(/-/g,' ')}</span></span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CallsDashboard() {
  const { voiceAgents } = useAdStore()
  const vapiKey = getKey('vapi')

  const [selectedId, setSelectedId] = useState(() => voiceAgents[0]?.id || '')
  const [calls,      setCalls]      = useState([])
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState('')
  const [tags,       setTags]       = useState({})
  const [autoTags,   setAutoTags]   = useState({})
  const [filterTag,  setFilterTag]  = useState('all')
  const [view,       setView]       = useState('log')    // 'log' | 'pipeline'
  const [callingId,  setCallingId]  = useState(null)

  const agent = voiceAgents.find(a => a.id === selectedId)

  function effectiveTags(callId) {
    return tags[callId] !== undefined ? tags[callId] : (autoTags[callId] || [])
  }
  function isAutoOnly(callId) {
    return tags[callId] === undefined && (autoTags[callId] || []).length > 0
  }

  useEffect(() => { if (selectedId) setTags(getCallTags(selectedId)) }, [selectedId])
  useEffect(() => {
    setCalls([]); setAutoTags({}); setErr('')
    if (agent?.vapiAssistantId && vapiKey) fetchCalls()
  }, [selectedId])

  async function fetchCalls() {
    if (!vapiKey || !agent?.vapiAssistantId) return
    setLoading(true); setErr('')
    try {
      const res  = await fetch(`https://api.vapi.ai/call?assistantId=${agent.vapiAssistantId}&limit=100`,
        { headers: { Authorization: `Bearer ${vapiKey}` } })
      if (!res.ok) throw new Error(`Vapi ${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.results || [])
      setCalls(list)
      const computed = {}
      list.forEach(c => { computed[c.id] = autoTag(c) })
      setAutoTags(computed)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  function toggleTag(callId, tagId) {
    const base    = effectiveTags(callId)
    const updated = { ...tags }
    updated[callId] = base.includes(tagId) ? base.filter(t => t !== tagId) : [...base, tagId]
    setTags(updated)
    saveCallTags(selectedId, updated)
  }

  async function callAgain(phone, callId) {
    if (!agent?.vapiAssistantId) return
    const sid   = getKey('twilio_sid')
    const token = getKey('twilio_token')
    const from  = agent.twilioPhoneNumber
    if (!sid || !token || !from) { alert('Add Twilio credentials + phone number in Settings first'); return }
    setCallingId(callId)
    try {
      await triggerVapiCall({ vapiKey, assistantId: agent.vapiAssistantId, toPhone: phone, fromPhone: from, twilioAccountSid: sid, twilioAuthToken: token })
    } catch(e) { alert(e.message) }
    finally { setCallingId(null) }
  }

  // ── Analytics ───────────────────────────────────────────────
  const answered    = calls.filter(c => c.transcript || c.summary)
  const booked      = calls.filter(c => effectiveTags(c.id).includes('booked'))
  const totalCost   = calls.reduce((s, c) => s + (c.cost || 0), 0)
  const avgDurSecs  = answered.length
    ? Math.round(answered.reduce((s, c) => {
        if (!c.startedAt || !c.endedAt) return s
        return s + Math.round((new Date(c.endedAt) - new Date(c.startedAt)) / 1000)
      }, 0) / answered.length)
    : 0
  const avgDur = avgDurSecs >= 60 ? `${Math.floor(avgDurSecs/60)}m ${avgDurSecs%60}s` : `${avgDurSecs}s`
  const answerRate  = calls.length ? Math.round(answered.length / calls.length * 100) : 0
  const bookingRate = answered.length ? Math.round(booked.length / answered.length * 100) : 0

  // ── Pipeline leads ─────────────────────────────────────────
  const pipelineLeads = calls
    .filter(c => {
      const t = effectiveTags(c.id)
      return t.includes('follow_up') || t.includes('callback')
    })
    .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))

  const tagCounts = CALL_TAGS.reduce((acc, t) => {
    acc[t.id] = calls.filter(c => effectiveTags(c.id).includes(t.id)).length
    return acc
  }, {})

  const filtered = filterTag === 'all' ? calls : calls.filter(c => effectiveTags(c.id).includes(filterTag))

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

      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select className="input max-w-xs" value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setFilterTag('all') }}>
          {voiceAgents.map(a => <option key={a.id} value={a.id}>{a.name || 'Unnamed Agent'}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {calls.length > 0 && <span className="text-xs text-zinc-600">{calls.length} calls</span>}
          <button onClick={fetchCalls} disabled={loading} className="btn-ghost text-xs">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>
      </div>

      {/* Analytics grid */}
      {calls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={Phone}       label="Total Calls"   value={calls.length}     sub={`${answered.length} answered`}/>
          <Stat icon={TrendingUp}  label="Answer Rate"   value={`${answerRate}%`} sub="calls with transcript" color={answerRate >= 50 ? 'text-emerald-400' : 'text-white'}/>
          <Stat icon={CheckCircle} label="Booking Rate"  value={`${bookingRate}%`} sub={`${booked.length} booked`} color={bookingRate > 0 ? 'text-emerald-400' : 'text-white'}/>
          <Stat icon={Clock}       label="Avg Duration"  value={avgDur}           sub="answered calls"/>
          <Stat icon={DollarSign}  label="Total Cost"    value={`$${totalCost.toFixed(2)}`} sub={calls.length ? `$${(totalCost/calls.length).toFixed(3)}/call` : ''}/>
        </div>
      )}

      {!agent?.vapiAssistantId && (
        <div className="border border-white/[0.06] rounded-xl p-8 text-center">
          <PhoneIncoming size={24} className="text-zinc-700 mx-auto mb-3"/>
          <p className="text-sm text-zinc-500 mb-1">This agent hasn't been synced to Vapi yet</p>
          <p className="text-xs text-zinc-600">Go to Voice Agents → Calls tab → Sync to Vapi first</p>
        </div>
      )}

      {agent?.vapiAssistantId && (
        <div className="border border-white/[0.06] rounded-xl overflow-hidden">

          {/* View tabs */}
          <div className="flex items-center border-b border-white/[0.06] bg-surface-900/40">
            {[
              { id: 'log',      label: 'Call Log',  icon: FileText },
              { id: 'pipeline', label: `Pipeline`,  icon: Users,   badge: pipelineLeads.length },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => setView(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all
                  ${view === id ? 'border-brand-500 text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                <Icon size={11}/>{label}
                {badge > 0 && (
                  <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Call Log view ──────────────────────────────── */}
          {view === 'log' && (
            <>
              {/* Filter bar */}
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.04] overflow-x-auto">
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
                    {t.label}{tagCounts[t.id] > 0 && ` (${tagCounts[t.id]})`}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-white/[0.04]">
                {loading && <div className="flex items-center justify-center gap-2 py-12"><Loader2 size={16} className="animate-spin text-zinc-600"/><span className="text-sm text-zinc-600">Loading…</span></div>}
                {err && <p className="text-sm text-red-400 p-6">{err}</p>}
                {!loading && !err && filtered.length === 0 && (
                  <div className="py-12 text-center">
                    <Phone size={20} className="text-zinc-700 mx-auto mb-2"/>
                    <p className="text-sm text-zinc-600">{filterTag === 'all' ? 'No calls yet' : `No calls tagged "${tagLabel(filterTag)}"`}</p>
                  </div>
                )}
                {filtered.map(call => (
                  <CallRow key={call.id} call={call}
                    effectiveTags={effectiveTags} isAutoOnly={isAutoOnly}
                    toggleTag={toggleTag} onCallAgain={callAgain} callingId={callingId}/>
                ))}
              </div>
            </>
          )}

          {/* ── Pipeline view ──────────────────────────────── */}
          {view === 'pipeline' && (
            <div className="divide-y divide-white/[0.04]">
              {pipelineLeads.length === 0 && (
                <div className="py-12 text-center">
                  <Users size={20} className="text-zinc-700 mx-auto mb-2"/>
                  <p className="text-sm text-zinc-600">No follow-up leads yet</p>
                  <p className="text-xs text-zinc-700 mt-1">Calls tagged Follow Up or Callback appear here</p>
                </div>
              )}
              {pipelineLeads.map(call => (
                <CallRow key={call.id} call={call}
                  effectiveTags={effectiveTags} isAutoOnly={isAutoOnly}
                  toggleTag={toggleTag} onCallAgain={callAgain} callingId={callingId}/>
              ))}
              {pipelineLeads.length > 0 && (
                <div className="px-4 py-3 bg-yellow-500/5">
                  <p className="text-xs text-yellow-600">
                    {pipelineLeads.length} lead{pipelineLeads.length !== 1 ? 's' : ''} need follow-up — click <strong>Call Again</strong> to have the agent call them back instantly.
                    Mark as Booked or Not Interested once done.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
