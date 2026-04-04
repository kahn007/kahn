import React, { useState, useEffect, useRef } from 'react'
import {
  Phone, Plus, Trash2, Wand2, Globe, Copy,
  Check, AlertCircle, Loader2, RefreshCw, MessageSquare,
  Play, Mic, Zap, Building2, Search, PhoneCall, X, Calendar, User, Sparkles,
  ChevronDown, ChevronUp, Clock, Target, PhoneIncoming, PhoneMissed,
  Tag, FileText, Filter,
} from 'lucide-react'
import { useAdStore } from '../store/adStore'
import { getKey } from '../lib/keys'
import {
  syncVapiAssistant, triggerVapiCall,
  testAgentConversation, listElevenLabsVoices, listCartesiaVoices,
  listTwilioNumbers, fetchGHLCalendars, fetchGHLFreeSlots,
  scrapeWebsiteForServices, generateAgentPromptFromServices,
} from '../lib/api'
import { v4 as uuidv4 } from 'uuid'

// ── Constants ─────────────────────────────────────────────────
const DEFAULT_AGENT = () => ({
  id: uuidv4(),
  name: '',
  callDirection: 'inbound',
  language: 'en',
  maxCallMinutes: 10,
  llmModel: 'gpt-4o-mini',   // native OpenAI — most reliable with Vapi
  voiceId: '',
  voiceName: '',
  voiceProvider: 'elevenlabs',
  ttsModel: 'eleven_turbo_v2_5',
  firstMessage: '',
  systemPrompt: '',
  websiteUrl: '',
  scrapedServices: [],
  selectedServices: [],
  companyName: '',
  twilioPhoneNumber: '',
  vapiAssistantId: '',
  ghlCalendarId: '',
  ghlBookingWebhookUrl: '',
  agentPersonality: 'balanced',
  agentObjective: 'book_appointment',
  agentTimezone: 'America/New_York',
  createdAt: new Date().toISOString(),
})

const PERSONALITIES = [
  {
    id: 'friendly',
    label: 'Friendly Helper',
    desc: 'Warm & low-pressure — informative, approachable',
    traits: 'warm, friendly, patient, helpful, low-pressure, informative, approachable',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    desc: 'Conversational & curious — naturally guides to close',
    traits: 'conversational, naturally curious, warm but direct, focused, engaging',
  },
  {
    id: 'closer',
    label: 'Hard Closer',
    desc: 'Assertive & results-driven — handles objections firmly',
    traits: 'assertive, confident, results-driven, direct, handles objections firmly, persistent but respectful',
  },
  {
    id: 'support',
    label: 'Support Agent',
    desc: 'Patient & empathetic — solution-focused',
    traits: 'patient, empathetic, thorough, professional, solution-focused, calm under pressure',
  },
]

const OBJECTIVES = [
  { id: 'book_appointment', label: 'Book Appointment' },
  { id: 'qualify_lead',     label: 'Qualify Lead' },
  { id: 'customer_support', label: 'Customer Support' },
  { id: 'information',      label: 'Provide Info' },
  { id: 'follow_up',        label: 'Follow Up' },
  { id: 'sales',            label: 'Direct Sales' },
]

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
]

// All via OpenRouter — one key covers everything
const LLM_MODELS = [
  // xAI Grok
  { id: 'x-ai/grok-3-mini-fast', label: '🔥 Grok 3 Mini Fast — Ultra low latency' },
  { id: 'x-ai/grok-3-mini',      label: 'Grok 3 Mini — Fast + smart' },
  { id: 'x-ai/grok-3',           label: 'Grok 3 — Most capable Grok' },
  // OpenAI
  { id: 'openai/gpt-4o-mini',    label: '★ GPT-4o Mini — Best balance' },
  { id: 'openai/gpt-4o',         label: 'GPT-4o — Top OpenAI quality' },
  // Google
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash — Fast & cheap' },
  { id: 'google/gemini-1.5-flash',     label: 'Gemini 1.5 Flash — Reliable' },
  // Meta Llama
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B — Open source' },
  { id: 'meta-llama/llama-3.1-8b-instruct',  label: 'Llama 3.1 8B — Cheapest' },
  // Anthropic
  { id: 'anthropic/claude-3-5-sonnet',       label: 'Claude 3.5 Sonnet — Nuanced' },
  { id: 'anthropic/claude-3-5-haiku',        label: 'Claude 3.5 Haiku — Fast Claude' },
  { id: 'anthropic/claude-3-opus',           label: 'Claude 3 Opus — Most capable' },
]

const TIMEZONES = [
  { id: 'America/New_York',    label: 'Eastern (ET) — New York' },
  { id: 'America/Chicago',     label: 'Central (CT) — Chicago' },
  { id: 'America/Denver',      label: 'Mountain (MT) — Denver' },
  { id: 'America/Los_Angeles', label: 'Pacific (PT) — Los Angeles' },
  { id: 'America/Phoenix',     label: 'Arizona (no DST)' },
  { id: 'America/Toronto',     label: 'Toronto (ET)' },
  { id: 'America/Vancouver',   label: 'Vancouver (PT)' },
  { id: 'America/Sao_Paulo',   label: 'São Paulo (BRT)' },
  { id: 'Europe/London',       label: 'London (GMT/BST)' },
  { id: 'Europe/Paris',        label: 'Paris / Berlin (CET)' },
  { id: 'Europe/Amsterdam',    label: 'Amsterdam (CET)' },
  { id: 'Asia/Dubai',          label: 'Dubai (GST)' },
  { id: 'Asia/Kolkata',        label: 'India (IST)' },
  { id: 'Asia/Singapore',      label: 'Singapore (SGT)' },
  { id: 'Asia/Tokyo',          label: 'Tokyo (JST)' },
  { id: 'Australia/Sydney',    label: 'Sydney (AEST)' },
  { id: 'Pacific/Auckland',    label: 'New Zealand (NZST)' },
]

const TABS = ['Setup', 'Voice', 'Test Chat', 'Live Test', 'Calls']

// ── Helpers ───────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-zinc-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-600">{hint}</p>}
    </div>
  )
}

function FormSection({ num, icon: Icon, title, subtitle, children, accent }) {
  return (
    <div className={`rounded-xl border overflow-hidden ${accent ? 'border-brand-500/25' : 'border-white/[0.08]'}`}>
      <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.06] ${accent ? 'bg-brand-500/5' : 'bg-surface-900/60'}`}>
        <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {num}
        </span>
        {Icon && <Icon size={12} className="text-brand-400 flex-shrink-0"/>}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white leading-none">{title}</p>
          {subtitle && <p className="text-[10px] text-zinc-600 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {children}
      </div>
    </div>
  )
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(false),1500) }}
      className="p-1 text-zinc-500 hover:text-white transition-colors">
      {ok ? <Check size={12} className="text-green-400"/> : <Copy size={12}/>}
    </button>
  )
}

// ── Setup Tab ─────────────────────────────────────────────────
function SetupTab({ agent, update }) {
  const [scraping,    setScraping]    = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [scrapeErr,   setScrapeErr]   = useState('')
  const [showPrompt,  setShowPrompt]  = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  async function handleScrape() {
    if (!agent.websiteUrl) return
    setScraping(true); setScrapeErr('')
    try {
      const r = await scrapeWebsiteForServices(agent.websiteUrl)
      update({
        companyName: r.companyName || agent.companyName,
        scrapedServices: r.services || [],
        selectedServices: (r.services || []).map(s => s.id),
      })
    } catch(e) { setScrapeErr(e.message) }
    finally { setScraping(false) }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const svcs = agent.scrapedServices.filter(s => agent.selectedServices.includes(s.id))
      const traits = PERSONALITIES.find(p => p.id === agent.agentPersonality)?.traits
        || 'warm, professional, conversational'
      const r = await generateAgentPromptFromServices({
        companyName: agent.companyName,
        services: svcs,
        callDirection: agent.callDirection,
        firstMessage: agent.firstMessage,
        language: agent.language,
        agentName: agent.name,
        agentPersonality: traits,
        agentObjective: agent.agentObjective,
        agentVoiceSample: '',
      })
      update({ systemPrompt: r.systemPrompt, firstMessage: r.firstMessage || agent.firstMessage })
      setShowPrompt(true)
    } catch(e) { alert(e.message) }
    finally { setGenerating(false) }
  }

  function toggleSvc(id) {
    update({ selectedServices: agent.selectedServices.includes(id)
      ? agent.selectedServices.filter(x => x !== id)
      : [...agent.selectedServices, id] })
  }

  const canGenerate = !!(agent.agentObjective && (agent.selectedServices.length > 0 || agent.companyName))

  return (
    <div className="space-y-3">

      {/* ── 1. Scan Website ────────────────────────────────────── */}
      <FormSection num="1" icon={Globe} title="Scan Your Website" subtitle="We detect your company name, services and context automatically">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="https://yoursite.com"
            value={agent.websiteUrl} onChange={e => update({websiteUrl: e.target.value})}
            onKeyDown={e => e.key === 'Enter' && handleScrape()}/>
          <button onClick={handleScrape} disabled={!agent.websiteUrl || scraping}
            className="btn-primary shrink-0">
            {scraping ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
            {scraping ? 'Scanning…' : 'Scan Site'}
          </button>
        </div>
        {scrapeErr && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11}/>{scrapeErr}</p>}

        {/* Scraped result */}
        {agent.scrapedServices.length > 0 && (
          <div className="space-y-2.5">
            {agent.companyName && (
              <div className="flex items-center gap-1.5">
                <Building2 size={11} className="text-emerald-500"/>
                <span className="text-xs font-semibold text-emerald-400">{agent.companyName}</span>
                <span className="text-[10px] text-zinc-600">detected</span>
              </div>
            )}
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">What does this agent handle? Toggle to select:</p>
            <div className="grid grid-cols-2 gap-1.5">
              {agent.scrapedServices.map(svc => {
                const on = agent.selectedServices.includes(svc.id)
                return (
                  <button key={svc.id} onClick={() => toggleSvc(svc.id)}
                    className={`text-left px-3 py-2 rounded-lg border text-xs transition-all
                      ${on
                        ? 'bg-brand-500/15 border-brand-500/30 text-white shadow-sm shadow-brand-500/10'
                        : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]'}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors
                        ${on ? 'bg-brand-500 border-brand-500' : 'border-zinc-600'}`}>
                        {on && <Check size={9} className="text-white"/>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium leading-snug truncate">{svc.name}</p>
                        {svc.description && <p className="text-zinc-600 mt-0.5 leading-snug line-clamp-1 text-[10px]">{svc.description}</p>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* No scraper yet — manual company name */}
        {agent.scrapedServices.length === 0 && (
          <Field label="Or enter company name manually">
            <input className="input" placeholder="e.g. Brayne AI"
              value={agent.companyName} onChange={e => update({companyName: e.target.value})}/>
          </Field>
        )}
      </FormSection>

      {/* ── 2. Agent Identity ──────────────────────────────────── */}
      <FormSection num="2" icon={User} title="Agent Identity">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agent Name">
            <input className="input" placeholder="e.g. Jess, Marcus, Sarah"
              value={agent.name} onChange={e => update({name: e.target.value})}/>
          </Field>
          <Field label="Calls">
            <div className="flex gap-1.5 h-[38px]">
              {['inbound','outbound'].map(d => (
                <button key={d} onClick={() => update({callDirection: d})}
                  className={`flex-1 text-xs font-medium rounded-lg border transition-colors capitalize
                    ${agent.callDirection === d
                      ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                      : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300'}`}>{d}</button>
              ))}
            </div>
          </Field>
        </div>
      </FormSection>

      {/* ── 3. Personality ─────────────────────────────────────── */}
      <FormSection num="3" icon={Sparkles} title="Personality" subtitle="How the agent speaks and handles the conversation">
        <div className="grid grid-cols-2 gap-2">
          {PERSONALITIES.map(p => (
            <button key={p.id} onClick={() => update({agentPersonality: p.id})}
              className={`text-left px-3 py-2.5 rounded-xl border transition-all
                ${agent.agentPersonality === p.id
                  ? 'bg-brand-500/15 border-brand-500/30 text-white shadow-sm shadow-brand-500/10'
                  : 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300'}`}>
              <p className="font-semibold text-xs leading-none mb-1">{p.label}</p>
              <p className="text-[10px] leading-snug opacity-70">{p.desc}</p>
            </button>
          ))}
        </div>
      </FormSection>

      {/* ── 4. Call Objective ──────────────────────────────────── */}
      <FormSection num="4" icon={Target} title="Call Objective" subtitle="What is the primary goal of this agent?">
        <div className="flex flex-wrap gap-1.5">
          {OBJECTIVES.map(o => (
            <button key={o.id} onClick={() => update({agentObjective: o.id})}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
                ${agent.agentObjective === o.id
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </FormSection>

      {/* ── 5. Advanced Settings (collapsible) ─────────────────── */}
      <button onClick={() => setShowAdvanced(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1] transition-colors text-xs">
        <span className="font-medium">Advanced Settings</span>
        <span className="flex items-center gap-1.5 text-zinc-600">
          <span className="text-[10px]">Language · AI Model · Duration</span>
          {showAdvanced ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </span>
      </button>
      {showAdvanced && (
        <div className="border border-white/[0.06] rounded-xl p-4 space-y-4 -mt-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Language">
              <select className="input" value={agent.language} onChange={e => update({language: e.target.value})}>
                {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Timezone">
              <select className="input" value={agent.agentTimezone || 'America/New_York'} onChange={e => update({agentTimezone: e.target.value})}>
                {TIMEZONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
          </div>

          <ModelPicker value={agent.llmModel} onChange={v => update({llmModel: v})}/>

          <Field label={`Max Call Duration — ${agent.maxCallMinutes} min`}>
            <input type="range" min={2} max={30} step={1} value={agent.maxCallMinutes}
              onChange={e => update({maxCallMinutes: Number(e.target.value)})}
              className="w-full accent-brand-500"/>
          </Field>
        </div>
      )}

      {/* ── Generate Button ─────────────────────────────────────── */}
      <button onClick={handleGenerate} disabled={generating || !canGenerate}
        className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all
          bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white
          shadow-lg shadow-brand-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
        {generating
          ? <><Loader2 size={15} className="animate-spin"/>Building agent prompt…</>
          : <><Wand2 size={15}/>Build Agent Prompt</>}
      </button>
      {!canGenerate && (
        <p className="text-[10px] text-zinc-600 text-center -mt-1">
          Scan a site or enter company name, then select an objective
        </p>
      )}

      {/* ── Generated Prompt Preview ────────────────────────────── */}
      {agent.systemPrompt && (
        <div className="border border-emerald-500/25 rounded-xl overflow-hidden">
          <button onClick={() => setShowPrompt(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-emerald-500/5 hover:bg-emerald-500/8 transition-colors">
            <div className="flex items-center gap-2">
              <Check size={13} className="text-emerald-400"/>
              <p className="text-xs font-semibold text-emerald-300">Prompt ready</p>
              {agent.firstMessage && <span className="text-[10px] text-zinc-600">· opening message set</span>}
            </div>
            {showPrompt ? <ChevronUp size={12} className="text-zinc-500"/> : <ChevronDown size={12} className="text-zinc-500"/>}
          </button>
          {showPrompt && (
            <div className="p-3 space-y-3 bg-surface-900/40">
              {agent.firstMessage && (
                <div>
                  <p className="text-[10px] text-zinc-500 font-medium mb-1">Opening message</p>
                  <p className="text-xs text-zinc-300 italic bg-surface-900 rounded-lg px-3 py-2 border border-white/[0.06]">
                    "{agent.firstMessage}"
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-zinc-500 font-medium mb-1">System prompt — click to edit</p>
                <textarea className="input min-h-[140px] resize-y font-mono text-[10px] leading-relaxed"
                  value={agent.systemPrompt} onChange={e => update({systemPrompt: e.target.value})}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GHL Calendar ────────────────────────────────────────── */}
      <GHLCalendarPicker
        calendarId={agent.ghlCalendarId}
        webhookUrl={agent.ghlBookingWebhookUrl}
        timezone={agent.agentTimezone || 'America/New_York'}
        onChange={(cal, hook) => update({ ghlCalendarId: cal, ghlBookingWebhookUrl: hook })}
      />

      {/* ── Phone Number ────────────────────────────────────────── */}
      <PhoneNumberPicker value={agent.twilioPhoneNumber} onChange={v => update({twilioPhoneNumber: v})}/>
    </div>
  )
}

// ── Model Picker ──────────────────────────────────────────────
// Native provider models — registered directly with Vapi, no OpenRouter needed
// Key: openai → GPT | xai → Grok | openrouter → Gemini/Llama/etc
const CURATED_MODELS = [
  { id: 'gpt-4o-mini',             name: 'GPT-4o Mini',        provider: 'OpenAI', tag: 'Recommended',   tagColor: 'text-green-400  bg-green-500/10  border-green-500/20',  key: 'openai'     },
  { id: 'gpt-4o',                  name: 'GPT-4o',             provider: 'OpenAI', tag: 'Premium',       tagColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', key: 'openai'     },
  { id: 'grok-3-mini-fast-beta',   name: 'Grok 3 Mini Fast',   provider: 'xAI',    tag: 'No Thinking ⚡', tagColor: 'text-red-400    bg-red-500/10    border-red-500/20',    key: 'xai'        },
  { id: 'grok-3-fast-beta',        name: 'Grok 3 Fast',        provider: 'xAI',    tag: 'No Thinking',   tagColor: 'text-zinc-300   bg-zinc-500/10   border-zinc-500/20',   key: 'xai'        },
  { id: 'grok-beta',               name: 'Grok Beta',          provider: 'xAI',    tag: 'Stable',        tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20', key: 'xai'        },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'OpenRouter', tag: 'Best Value', tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',  key: 'openrouter' },
]

function ModelPicker({ value, onChange }) {
  const [showAll, setShowAll] = useState(false)
  const selected = LLM_MODELS.find(m => m.id === value) || CURATED_MODELS.find(m => m.id === value)
  // If selected model is not in curated list, show all
  const isCustom = value && !CURATED_MODELS.find(m => m.id === value)

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-zinc-400">AI Model</label>
      <div className="grid grid-cols-3 gap-1.5">
        {CURATED_MODELS.map(m => {
          const hasKey = !!getKey(m.key)
          return (
            <button key={m.id} onClick={() => onChange(m.id)}
              className={`text-left px-2.5 py-2 rounded-lg border transition-all relative
                ${value === m.id
                  ? 'bg-brand-500/15 border-brand-500/30 text-white'
                  : 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300'}`}>
              <p className="font-semibold text-[11px] leading-none truncate">{m.name}</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">{m.provider}</p>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-medium ${m.tagColor}`}>{m.tag}</span>
                {!hasKey && <span className="text-[8px] text-amber-500/70">needs key</span>}
              </div>
            </button>
          )
        })}
      </div>
      <button onClick={() => setShowAll(v => !v)}
        className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors">
        {showAll ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
        {showAll ? 'Show less' : 'More models (Llama, Claude, Gemini 1.5…)'}
      </button>
      {(showAll || isCustom) && (
        <select className="input text-xs" value={value} onChange={e => onChange(e.target.value)}>
          {LLM_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      )}
    </div>
  )
}

// ── GHL Calendar Picker ───────────────────────────────────────
function GHLCalendarPicker({ calendarId, webhookUrl, timezone, onChange }) {
  const [calendars,    setCalendars]    = useState([])
  const [loading,      setLoading]      = useState(false)
  const [err,          setErr]          = useState('')
  const [slots,        setSlots]        = useState([])   // [{ date, slots: [ISO] }]
  const [slotDate,     setSlotDate]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotErr,      setSlotErr]      = useState('')

  useEffect(() => { loadCalendars() }, [])

  async function loadCalendars() {
    const token      = getKey('ghl_token')
    const locationId = getKey('ghl_location_id')
    if (!token || !locationId) { setErr('Add GHL Token + Location ID in Settings first'); return }
    setLoading(true); setErr('')
    try {
      const data = await fetchGHLCalendars(token, locationId)
      // fetchGHLCalendars returns the array directly
      setCalendars(Array.isArray(data) ? data : (data.calendars || []))
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  async function loadSlots() {
    const token = getKey('ghl_token')
    if (!token || !calendarId) return
    setLoadingSlots(true); setSlotErr('')
    try {
      const start = new Date(slotDate + 'T00:00:00')
      const end   = new Date(slotDate + 'T23:59:59')
      const data  = await fetchGHLFreeSlots(token, calendarId, {
        startDate: start.getTime(),
        endDate:   end.getTime(),
        timezone:  timezone || 'America/New_York',
      })
      setSlots(data)
    } catch(e) { setSlotErr(e.message) }
    finally { setLoadingSlots(false) }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="border border-white/[0.08] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-900/60 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-emerald-400"/>
          <p className="text-xs font-semibold text-white">GHL Appointment Booking</p>
          <span className="text-[10px] text-zinc-600">optional</span>
        </div>
        <button onClick={loadCalendars} disabled={loading} className="btn-ghost text-xs">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/>Refresh
        </button>
      </div>
      <div className="p-4 space-y-3">
        {err && <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle size={11}/>{err}</p>}

        <Field label="Calendar" hint="The agent checks availability and books into this calendar">
          {calendars.length > 0 ? (
            <select className="input" value={calendarId} onChange={e => onChange(e.target.value, webhookUrl)}>
              <option value="">No booking — agent just talks</option>
              {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <div className="flex gap-2">
              <input className="input flex-1 font-mono text-xs" placeholder="Calendar ID (paste manually)"
                value={calendarId} onChange={e => onChange(e.target.value, webhookUrl)}/>
              {loading && <Loader2 size={13} className="text-zinc-600 animate-spin self-center flex-shrink-0"/>}
            </div>
          )}
        </Field>

        {/* Available slots preview */}
        {calendarId && (
          <>
            <div className="flex items-center gap-2">
              <input type="date" min={today}
                className="input flex-1 text-xs" value={slotDate}
                onChange={e => { setSlotDate(e.target.value); setSlots([]) }}/>
              <button onClick={loadSlots} disabled={loadingSlots}
                className="btn-ghost text-xs shrink-0">
                {loadingSlots
                  ? <Loader2 size={11} className="animate-spin"/>
                  : <Clock size={11}/>}
                {loadingSlots ? 'Loading…' : 'Preview Slots'}
              </button>
            </div>
            {slotErr && <p className="text-xs text-red-400">{slotErr}</p>}
            {slots.length > 0 && (
              <div className="grid grid-cols-4 gap-1">
                {slots.flatMap(d => d.slots).slice(0, 16).map((s, i) => (
                  <div key={i} className="text-[10px] font-mono text-center py-1 px-1.5 rounded-lg
                    bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    {new Date(s).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true})}
                  </div>
                ))}
                {slots.flatMap(d => d.slots).length > 16 && (
                  <div className="text-[10px] text-zinc-600 self-center col-span-4">
                    +{slots.flatMap(d => d.slots).length - 16} more slots
                  </div>
                )}
              </div>
            )}
            {slots.length === 0 && !loadingSlots && !slotErr && (
              <p className="text-[10px] text-zinc-600">Click "Preview Slots" to see live availability from your GHL calendar</p>
            )}

            {(() => {
              const backendUrl = getKey('backend_url')
              if (backendUrl) {
                return (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0"/>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-emerald-400 font-semibold">Booking auto-configured</p>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        Using your backend at <code className="text-emerald-400">{backendUrl.replace(/\/$/, '')}/api/ghl-booking</code>.
                        GHL credentials are passed securely via headers — no webhook setup needed.
                      </p>
                    </div>
                  </div>
                )
              }
              return (
                <>
                  <Field label="Booking Webhook URL"
                    hint="Vapi calls this for check_calendar and book_appointment. Or add your Backend URL in Settings to skip this.">
                    <input className="input font-mono text-xs" placeholder="https://hook.make.com/..."
                      value={webhookUrl} onChange={e => onChange(calendarId, e.target.value)}/>
                  </Field>
                  <p className="text-[10px] text-zinc-600">
                    Tip: add a <strong className="text-zinc-400">Backend URL</strong> in Settings to handle booking automatically — no webhook needed.
                  </p>
                </>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

// ── Phone Number Picker (uses global Twilio keys from Settings) ─
function PhoneNumberPicker({ value, onChange }) {
  const [nums,    setNums]    = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadNums() }, [])

  const [err, setErr] = useState('')

  async function loadNums() {
    const sid   = getKey('twilio_sid')
    const token = getKey('twilio_token')
    if (!sid || !token) { setErr('Add Twilio SID + Token in Settings first'); return }
    setLoading(true); setErr('')
    try {
      const nums = await listTwilioNumbers(sid, token)
      setNums(nums)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Field label="Twilio Phone Number" hint="Which number this agent calls from / receives on">
      {err && <p className="text-xs text-amber-400 mb-1">{err}</p>}
      {nums.length > 0 ? (
        <select className="input" value={value} onChange={e=>onChange(e.target.value)}>
          <option value="">Select number…</option>
          {nums.map(n=><option key={n.sid} value={n.phone_number}>{n.friendly_name||n.phone_number}</option>)}
        </select>
      ) : (
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="+1 (555) 000-0000" value={value} onChange={e=>onChange(e.target.value)}/>
          {loading
            ? <Loader2 size={13} className="text-zinc-600 animate-spin self-center"/>
            : <button onClick={loadNums} className="btn-ghost text-xs shrink-0"><RefreshCw size={11}/>Load</button>
          }
        </div>
      )}
    </Field>
  )
}

// ── Voice Tab ─────────────────────────────────────────────────
const CATEGORY_ORDER = { professional: 0, premade: 1, cloned: 2, generated: 3 }
const CATEGORY_BADGE = {
  professional: { label: 'Pro',    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  premade:      { label: 'Stable', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  cloned:       { label: 'Custom', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
}
const TTS_MODELS = [
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', hint: 'Best quality' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5',  hint: 'Fastest ~75ms' },
]
const VOICES_SHOWN_DEFAULT = 12

function VoiceTab({ agent, update }) {
  const [allVoices, setAllVoices] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [err,       setErr]       = useState('')
  const [playing,   setPlaying]   = useState(null)
  const [search,    setSearch]    = useState('')
  const [showAll,   setShowAll]   = useState(false)
  const audioRef  = useRef(null)
  const provider  = agent.voiceProvider || 'elevenlabs'

  useEffect(() => { load(provider) }, [provider])

  function sortVoices(list) {
    return [...list].sort((a, b) => {
      const ca = CATEGORY_ORDER[a.category] ?? 4
      const cb = CATEGORY_ORDER[b.category] ?? 4
      if (ca !== cb) return ca - cb
      return a.name.localeCompare(b.name)
    })
  }

  function playPreview(voice) {
    if (!voice.previewUrl) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (playing === voice.id) { setPlaying(null); return }
    const audio = new Audio(voice.previewUrl)
    audioRef.current = audio
    setPlaying(voice.id)
    audio.play()
    audio.onended = () => setPlaying(null)
    audio.onerror = () => setPlaying(null)
  }

  async function load(prov) {
    setAllVoices([]); setErr(''); setSearch('')
    if (prov === 'cartesia') {
      const k = getKey('cartesia')
      if (!k) { setErr('Add your Cartesia key in Settings'); return }
      setLoading(true)
      try {
        const list = await listCartesiaVoices(k)
        setAllVoices(sortVoices(list.map(v => ({
          id: v.id, name: v.name, category: v.is_public ? 'premade' : 'cloned',
          tags: v.description || '',  previewUrl: null,
        }))))
      } catch(e) { setErr(e.message) }
      finally { setLoading(false) }
    } else {
      const k = getKey('elevenlabs')
      if (!k) { setErr('Add your ElevenLabs key in Settings'); return }
      setLoading(true)
      try {
        const list = await listElevenLabsVoices(k)
        setAllVoices(sortVoices(list.map(v => ({
          id:         v.voice_id,
          name:       v.name,
          category:   v.category || 'premade',
          tags:       [v.labels?.use_case, v.labels?.accent, v.labels?.gender].filter(Boolean).join(' · '),
          previewUrl: v.preview_url,
        }))))
      } catch(e) { setErr(e.message) }
      finally { setLoading(false) }
    }
  }

  const filtered = allVoices.filter(v =>
    !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.tags.toLowerCase().includes(search.toLowerCase())
  )
  const displayed = showAll || search ? filtered : filtered.slice(0, VOICES_SHOWN_DEFAULT)
  const hasMore   = !showAll && !search && filtered.length > VOICES_SHOWN_DEFAULT

  return (
    <div className="space-y-4">

      {/* Provider cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { id: 'elevenlabs', label: 'ElevenLabs', hint: 'Highest quality · most voices' },
          { id: 'cartesia',   label: 'Cartesia',   hint: 'Fastest · ~50ms latency' },
        ].map(p => (
          <button key={p.id} onClick={() => { update({ voiceProvider: p.id, voiceId: '', voiceName: '' }) }}
            className={`px-3 py-2.5 rounded-xl border text-left transition-all
              ${provider === p.id
                ? 'bg-brand-500/15 border-brand-500/30 text-white'
                : 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300'}`}>
            <p className="font-semibold text-xs">{p.label}</p>
            <p className="text-[10px] opacity-60 mt-0.5">{p.hint}</p>
          </button>
        ))}
      </div>

      {/* ElevenLabs speed */}
      {provider === 'elevenlabs' && (
        <div className="flex gap-2">
          {TTS_MODELS.map(m => (
            <button key={m.id} onClick={() => update({ttsModel: m.id})}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs transition-colors flex justify-between items-center
                ${(agent.ttsModel || 'eleven_turbo_v2_5') === m.id
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300'}`}>
              <span className="font-medium">{m.label}</span>
              <span className="text-[10px] opacity-60">{m.hint}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + header */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"/>
          <input className="input pl-8 text-xs" placeholder="Search voices…"
            value={search} onChange={e => { setSearch(e.target.value); setShowAll(false) }}/>
        </div>
        <button onClick={() => load(provider)} disabled={loading} className="btn-ghost text-xs shrink-0">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}

      {/* Voice grid */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-zinc-600"/>
        </div>
      )}

      {!loading && allVoices.length > 0 && (
        <>
          {!search && (
            <p className="text-[10px] text-zinc-600">
              Showing {Math.min(VOICES_SHOWN_DEFAULT, filtered.length)} best voices · Pro &amp; Stable first
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {displayed.map(v => {
              const badge = CATEGORY_BADGE[v.category]
              return (
                <div key={v.id}
                  className={`rounded-xl border text-xs transition-all
                    ${agent.voiceId === v.id
                      ? 'bg-brand-500/15 border-brand-500/30 text-white shadow-sm shadow-brand-500/10'
                      : 'border-white/[0.06] text-zinc-400 hover:border-white/[0.14] hover:text-zinc-200'}`}>
                  <button className="w-full text-left p-2.5 space-y-1"
                    onClick={() => update({voiceId: v.id, voiceName: v.name})}>
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-[11px] leading-snug">{v.name}</p>
                      {badge && (
                        <span className={`flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    {v.tags && <p className="text-[10px] opacity-50 leading-none">{v.tags}</p>}
                  </button>
                  {v.previewUrl && (
                    <button onClick={() => playPreview(v)}
                      className={`w-full flex items-center justify-center gap-1 py-1.5 border-t text-[10px] font-medium transition-colors
                        ${playing === v.id
                          ? 'border-brand-500/20 text-brand-400 bg-brand-500/10'
                          : 'border-white/[0.04] text-zinc-600 hover:text-zinc-300'}`}>
                      {playing === v.id
                        ? <><Loader2 size={9} className="animate-spin"/>Playing…</>
                        : <><Play size={9}/>Preview</>}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button onClick={() => setShowAll(true)}
              className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 border border-white/[0.06] hover:border-white/[0.1] rounded-xl transition-colors">
              Show all {filtered.length} voices
            </button>
          )}
        </>
      )}

      {!loading && allVoices.length === 0 && !err && (
        <div className="border border-dashed border-white/[0.08] rounded-xl p-8 text-center">
          <Mic size={20} className="text-zinc-700 mx-auto mb-2"/>
          <p className="text-xs text-zinc-600">Add your {provider === 'cartesia' ? 'Cartesia' : 'ElevenLabs'} key in Settings</p>
        </div>
      )}

      {agent.voiceId && (
        <div className="flex items-center gap-2 p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-lg">
          <Check size={12} className="text-brand-400"/>
          <span className="text-xs text-brand-300 font-medium">{agent.voiceName}</span>
          <span className="text-[10px] text-zinc-600 ml-auto">
            {allVoices.find(v => v.id === agent.voiceId)?.tags || ''}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Test Chat Tab ─────────────────────────────────────────────
function TestTab({ agent }) {
  const [msgs,    setMsgs]    = useState([])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) }, [msgs])

  async function send() {
    if (!input.trim()||loading) return
    const userMsg = input.trim(); setInput('')
    const history = msgs.map(m=>({role:m.role,content:m.content}))
    setMsgs(p=>[...p,{role:'user',content:userMsg}])
    setLoading(true)
    try {
      const prompt = agent.systemPrompt ||
        `You are a helpful voice agent named ${agent.name||'Assistant'}. Keep responses short and conversational.`
      const reply = await testAgentConversation({systemPrompt:prompt,history,userMessage:userMsg})
      setMsgs(p=>[...p,{role:'assistant',content:reply}])
    } catch(e) {
      setMsgs(p=>[...p,{role:'assistant',content:`Error: ${e.message}`}])
    } finally { setLoading(false) }
  }

  function reset() {
    setMsgs(agent.firstMessage ? [{role:'assistant',content:agent.firstMessage}] : [])
  }

  return (
    <div className="flex flex-col" style={{height:'520px'}}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500">Text chat simulation — tests your prompt without a real call</p>
        <button onClick={reset} className="btn-ghost text-xs"><RefreshCw size={11}/>Reset</button>
      </div>
      <div className="flex-1 bg-surface-900 border border-white/[0.06] rounded-xl p-4 overflow-y-auto space-y-3 mb-3">
        {msgs.length===0 && (
          <div className="text-center py-10">
            <MessageSquare size={24} className="text-zinc-700 mx-auto mb-2"/>
            <p className="text-xs text-zinc-600">Start typing to test your agent</p>
            {agent.firstMessage && (
              <button onClick={reset} className="mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                Load opening message →
              </button>
            )}
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed
              ${m.role==='user'
                ? 'bg-brand-500/20 text-brand-100 rounded-br-sm'
                : 'bg-surface-800 text-zinc-300 rounded-bl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-800 px-3 py-2 rounded-xl rounded-bl-sm">
              <Loader2 size={12} className="animate-spin text-zinc-500"/>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Type a message…"
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} disabled={loading}/>
        <button onClick={send} disabled={loading||!input.trim()} className="btn-primary shrink-0">
          <Play size={13}/>
        </button>
      </div>
    </div>
  )
}

// ── Live Test Tab ─────────────────────────────────────────────
function LiveTestTab({ agent }) {
  const [active,    setActive]    = useState(false)
  const [status,    setStatus]    = useState('idle') // idle|ready|recording|thinking|speaking
  const [msgs,      setMsgs]      = useState([])
  const [interim,   setInterim]   = useState('')
  const activeRef = useRef(false)
  const recogRef  = useRef(null)
  const audioRef  = useRef(null)
  const msgsRef   = useRef([])
  const endRef    = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, interim])
  useEffect(() => () => stopSession(), [])

  function addMsg(msg) {
    const next = [...msgsRef.current, msg]
    msgsRef.current = next
    setMsgs([...next])
  }

  async function startSession() {
    activeRef.current = true
    setActive(true)
    msgsRef.current = []
    setMsgs([])
    if (agent.firstMessage) {
      addMsg({ role: 'assistant', content: agent.firstMessage })
      await speak(agent.firstMessage)
    }
    if (activeRef.current) setStatus('ready')
  }

  function stopSession() {
    activeRef.current = false
    setActive(false)
    setStatus('idle')
    setInterim('')
    try { recogRef.current?.abort() } catch(_) {}
    recogRef.current = null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    window.speechSynthesis?.cancel()
  }

  function startRecording() {
    if (status !== 'ready') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Speech recognition requires Chrome or Edge.'); return }

    const r = new SR()
    recogRef.current = r
    r.lang = agent.language === 'en' ? 'en-US' : (agent.language || 'en-US')
    r.interimResults = true
    r.continuous = true  // we control stop ourselves
    setStatus('recording')
    setInterim('')

    let finalText = ''
    r.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      setInterim((finalText + interim).trim())
    }
    r.onerror = e => {
      if (e.error === 'not-allowed') { alert('Mic access denied — allow microphone in your browser settings.'); stopSession() }
      else setStatus('ready')
    }
    r.onend = () => {
      setInterim('')
      const text = finalText.trim()
      if (text) handleUtterance(text)
      else if (activeRef.current) setStatus('ready')
    }
    r.start()
  }

  function stopRecording() {
    if (status !== 'recording') return
    try { recogRef.current?.stop() } catch(_) {}
  }

  async function handleUtterance(text) {
    setInterim('')
    addMsg({ role: 'user', content: text })
    setStatus('thinking')
    try {
      const history = msgsRef.current.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
      const reply = await testAgentConversation({
        systemPrompt: agent.systemPrompt ||
          `You are ${agent.name || 'a helpful voice assistant'}. Keep replies to 1-3 sentences, conversational.`,
        history,
        userMessage: text,
      })
      addMsg({ role: 'assistant', content: reply })
      await speak(reply)
      if (activeRef.current) setStatus('ready')
    } catch(e) {
      addMsg({ role: 'assistant', content: `Error: ${e.message}` })
      if (activeRef.current) setStatus('ready')
    }
  }

  async function speak(text) {
    setStatus('speaking')
    const elevenKey = getKey('elevenlabs')
    if (elevenKey && agent.voiceId) {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        })
        if (res.ok) {
          const blob  = await res.blob()
          const url   = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          await new Promise(resolve => {
            audio.play().catch(resolve)
            audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve() }
            audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve() }
          })
          return
        }
      } catch(_) {}
    }
    // Fallback: browser TTS
    await new Promise(resolve => {
      const utt = new SpeechSynthesisUtterance(text)
      utt.onend = resolve; utt.onerror = resolve
      window.speechSynthesis.speak(utt)
    })
  }

  const isBusy = status === 'thinking' || status === 'speaking'
  const canRecord = status === 'ready'

  return (
    <div className="flex flex-col gap-3" style={{ height: '520px' }}>
      {!agent.systemPrompt && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5 flex-shrink-0">
          <AlertCircle size={11}/>No system prompt yet — set one in Setup tab first
        </p>
      )}

      {/* Transcript */}
      <div className="flex-1 bg-surface-900 border border-white/[0.06] rounded-xl p-4 overflow-y-auto space-y-3 min-h-0">
        {msgs.length === 0 && !active && (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Mic size={28} className="text-zinc-700 mx-auto mb-3"/>
              <p className="text-sm font-medium text-zinc-500 mb-1">Talk to your agent</p>
              <p className="text-xs text-zinc-600">Mic → Claude → ElevenLabs voice</p>
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
              m.role === 'user'
                ? 'bg-brand-500/20 text-brand-100 rounded-br-sm'
                : 'bg-surface-800 text-zinc-300 rounded-bl-sm'
            }`}>{m.content}</div>
          </div>
        ))}
        {interim && (
          <div className="flex justify-end">
            <div className="max-w-[80%] px-3 py-2 rounded-xl text-xs bg-brand-500/10 text-brand-300 rounded-br-sm italic border border-brand-500/20">
              {interim}
            </div>
          </div>
        )}
        {isBusy && (
          <div className="flex justify-start">
            <div className="bg-surface-800 px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin text-zinc-500"/>
              <span className="text-xs text-zinc-500">{status === 'thinking' ? 'Thinking…' : 'Speaking…'}</span>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {!active ? (
          <button onClick={startSession}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-all flex items-center justify-center gap-2">
            <Mic size={14}/>Start Session
          </button>
        ) : (
          <>
            {/* Big push-to-talk button */}
            <button
              onMouseDown={startRecording} onMouseUp={stopRecording}
              onTouchStart={e=>{e.preventDefault();startRecording()}} onTouchEnd={stopRecording}
              disabled={isBusy}
              className={`flex-1 py-4 rounded-xl text-sm font-semibold border transition-all select-none flex items-center justify-center gap-2 ${
                status === 'recording'
                  ? 'bg-red-500/25 border-red-500/50 text-red-300 scale-[0.98]'
                  : isBusy
                  ? 'bg-surface-800 border-white/[0.06] text-zinc-600 cursor-not-allowed'
                  : 'bg-brand-500/15 border-brand-500/30 text-brand-300 hover:bg-brand-500/25 active:scale-[0.98]'
              }`}>
              <Mic size={15} className={status === 'recording' ? 'animate-pulse' : ''}/>
              {status === 'recording' ? 'Release to send' : isBusy ? (status === 'thinking' ? 'Thinking…' : 'Speaking…') : 'Hold to speak'}
            </button>
            <button onClick={stopSession}
              className="px-3 py-4 rounded-xl border border-white/[0.08] text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all">
              <X size={14}/>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Call Tags ─────────────────────────────────────────────────
const CALL_TAGS = [
  { id: 'booked',         label: 'Booked',         color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  { id: 'follow_up',      label: 'Follow Up',      color: 'text-yellow-400  bg-yellow-500/15  border-yellow-500/30'  },
  { id: 'voicemail',      label: 'Voicemail',      color: 'text-zinc-400    bg-zinc-500/15    border-zinc-500/30'    },
  { id: 'not_interested', label: 'Not Interested', color: 'text-red-400     bg-red-500/15     border-red-500/30'     },
  { id: 'callback',       label: 'Callback',       color: 'text-blue-400    bg-blue-500/15    border-blue-500/30'    },
  { id: 'wrong_number',   label: 'Wrong Number',   color: 'text-orange-400  bg-orange-500/15  border-orange-500/30'  },
  { id: 'no_answer',      label: 'No Answer',      color: 'text-purple-400  bg-purple-500/15  border-purple-500/30'  },
]

function tagStyle(id) {
  return CALL_TAGS.find(t => t.id === id)?.color || 'text-zinc-400 bg-zinc-500/15 border-zinc-500/30'
}

function tagLabel(id) {
  return CALL_TAGS.find(t => t.id === id)?.label || id
}

function getCallTags(agentId) {
  try { return JSON.parse(localStorage.getItem(`call_tags_${agentId}`) || '{}') } catch { return {} }
}
function saveCallTags(agentId, tags) {
  localStorage.setItem(`call_tags_${agentId}`, JSON.stringify(tags))
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

function CallLog({ agent }) {
  const [calls,      setCalls]      = useState([])
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState('')
  const [tags,       setTags]       = useState(() => getCallTags(agent.id))
  const [filterTag,  setFilterTag]  = useState('all')
  const [expanded,   setExpanded]   = useState(null)  // call id

  const vapiKey = getKey('vapi')

  useEffect(() => { if (agent.vapiAssistantId && vapiKey) fetchCalls() }, [agent.vapiAssistantId])

  async function fetchCalls() {
    if (!vapiKey || !agent.vapiAssistantId) return
    setLoading(true); setErr('')
    try {
      const res = await fetch(
        `https://api.vapi.ai/call?assistantId=${agent.vapiAssistantId}&limit=50`,
        { headers: { Authorization: `Bearer ${vapiKey}` } }
      )
      if (!res.ok) throw new Error(`Vapi ${res.status}`)
      const data = await res.json()
      setCalls(Array.isArray(data) ? data : (data.results || []))
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  function toggleTag(callId, tagId) {
    const updated = { ...tags }
    const current = updated[callId] || []
    updated[callId] = current.includes(tagId)
      ? current.filter(t => t !== tagId)
      : [...current, tagId]
    setTags(updated)
    saveCallTags(agent.id, updated)
  }

  const filtered = filterTag === 'all'
    ? calls
    : calls.filter(c => (tags[c.id] || []).includes(filterTag))

  if (!agent.vapiAssistantId) {
    return (
      <div className="border border-white/[0.06] rounded-xl p-4 text-center">
        <PhoneIncoming size={20} className="text-zinc-700 mx-auto mb-2"/>
        <p className="text-xs text-zinc-600">Sync your agent first — call history will appear here</p>
      </div>
    )
  }

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-900/60 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <PhoneIncoming size={12} className="text-brand-400"/>
          <p className="text-xs font-semibold text-white">Call Log</p>
          {calls.length > 0 && <span className="text-[10px] text-zinc-600">{calls.length} calls</span>}
        </div>
        <button onClick={fetchCalls} disabled={loading} className="btn-ghost text-xs">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/>Refresh
        </button>
      </div>

      {/* Tag filter bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.04] overflow-x-auto">
        <Filter size={10} className="text-zinc-600 shrink-0"/>
        <button onClick={() => setFilterTag('all')}
          className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border transition-all
            ${filterTag === 'all' ? 'text-white bg-white/10 border-white/20' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}>
          All
        </button>
        {CALL_TAGS.map(t => (
          <button key={t.id} onClick={() => setFilterTag(filterTag === t.id ? 'all' : t.id)}
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border transition-all
              ${filterTag === t.id ? t.color : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Call list */}
      <div className="divide-y divide-white/[0.04] max-h-[480px] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 size={14} className="animate-spin text-zinc-600"/>
            <span className="text-xs text-zinc-600">Loading calls…</span>
          </div>
        )}
        {err && <p className="text-xs text-red-400 p-4">{err}</p>}
        {!loading && !err && filtered.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-8">
            {filterTag === 'all' ? 'No calls yet' : `No calls tagged "${tagLabel(filterTag)}"`}
          </p>
        )}

        {filtered.map(call => {
          const callTags  = tags[call.id] || []
          const isOpen    = expanded === call.id
          const phone     = call.customer?.number || call.phoneNumber?.number || '—'
          const duration  = fmtDuration(call.startedAt, call.endedAt)
          const date      = fmtDate(call.startedAt)
          const ended     = call.endedReason || call.status || ''

          return (
            <div key={call.id}>
              {/* Row */}
              <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : call.id)}>
                {/* Icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                  ${ended.includes('voicemail') ? 'bg-zinc-500/10' : ended.includes('customer') ? 'bg-emerald-500/10' : 'bg-brand-500/10'}`}>
                  {ended.includes('voicemail')
                    ? <PhoneMissed size={12} className="text-zinc-500"/>
                    : <Phone size={12} className="text-brand-400"/>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-white">{phone}</span>
                    {callTags.map(t => (
                      <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${tagStyle(t)}`}>
                        {tagLabel(t)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{date} · {duration}</p>
                </div>

                {/* Chevron */}
                {isOpen ? <ChevronUp size={12} className="text-zinc-600 shrink-0"/> : <ChevronDown size={12} className="text-zinc-600 shrink-0"/>}
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-3 pb-3 space-y-2.5 bg-white/[0.01]">
                  {/* Tag buttons */}
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-1.5 flex items-center gap-1"><Tag size={9}/>Tag this call</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CALL_TAGS.map(t => (
                        <button key={t.id} onClick={() => toggleTag(call.id, t.id)}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition-all font-medium
                            ${callTags.includes(t.id) ? t.color : 'text-zinc-600 bg-transparent border-white/[0.06] hover:border-white/20'}`}>
                          {callTags.includes(t.id) ? '✓ ' : ''}{t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  {call.summary && (
                    <div className="p-2.5 bg-surface-900 rounded-lg border border-white/[0.06]">
                      <p className="text-[10px] text-zinc-500 font-semibold mb-1">Summary</p>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">{call.summary}</p>
                    </div>
                  )}

                  {/* Transcript */}
                  {call.transcript && (
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-1 flex items-center gap-1"><FileText size={9}/>Transcript</p>
                      <div className="bg-surface-900 border border-white/[0.06] rounded-lg p-2.5 max-h-48 overflow-y-auto space-y-1.5">
                        {call.transcript.split('\n').filter(Boolean).map((line, i) => {
                          const isAgent = line.toLowerCase().startsWith('assistant') || line.toLowerCase().startsWith('ai')
                          return (
                            <p key={i} className={`text-[10px] leading-relaxed ${isAgent ? 'text-brand-300' : 'text-zinc-400'}`}>
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
                      <p className="text-[10px] text-zinc-600 mb-1">Recording</p>
                      <audio controls src={call.recordingUrl} className="w-full h-8" style={{ filter: 'invert(0.85)' }}/>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex gap-3 text-[10px] text-zinc-600">
                    <span>Duration: <span className="text-zinc-400">{duration}</span></span>
                    {call.cost && <span>Cost: <span className="text-zinc-400">${call.cost.toFixed(3)}</span></span>}
                    {ended && <span>Ended: <span className="text-zinc-400">{ended.replace(/-/g,' ')}</span></span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Calls Tab ─────────────────────────────────────────────────
function CallsTab({ agent, update }) {
  const [syncing,    setSyncing]    = useState(false)
  const [syncStatus, setSyncStatus] = useState('')
  const [calling,    setCalling]    = useState(false)
  const [callPhone,  setCallPhone]  = useState('')
  const [callStatus, setCallStatus] = useState('')

  const vapiKey = getKey('vapi')

  async function syncToVapi() {
    if (!vapiKey) { setSyncStatus('no_key'); return }
    setSyncing(true); setSyncStatus('')
    try {
      const result = await syncVapiAssistant(agent, vapiKey)
      update({ vapiAssistantId: result.id })
      setSyncStatus('ok')
    } catch(e) { setSyncStatus('err:' + e.message) }
    finally { setSyncing(false) }
  }

  async function makeCall() {
    if (!vapiKey) { setCallStatus('no_key'); return }
    if (!agent.vapiAssistantId) { setCallStatus('sync_first'); return }
    const sid   = getKey('twilio_sid')
    const token = getKey('twilio_token')
    const from  = agent.twilioPhoneNumber
    if (!sid || !token || !from) { setCallStatus('no_twilio'); return }
    if (!callPhone) { setCallStatus('no_phone'); return }
    setCalling(true); setCallStatus('')
    try {
      await triggerVapiCall({
        vapiKey,
        assistantId: agent.vapiAssistantId,
        toPhone: callPhone,
        fromPhone: from,
        twilioAccountSid: sid,
        twilioAuthToken: token,
      })
      setCallStatus('ok')
    } catch(e) { setCallStatus('err:' + e.message) }
    finally { setCalling(false) }
  }

  const ghlBody = JSON.stringify({
    assistantId: agent.vapiAssistantId || 'YOUR_ASSISTANT_ID',
    customer: { number: '{{contact.phone}}' },
    phoneNumber: {
      twilioPhoneNumber: agent.twilioPhoneNumber || '+1...',
      twilioAccountSid: getKey('twilio_sid') || 'AC...',
      twilioAuthToken: getKey('twilio_token') || '...',
    },
  }, null, 2)

  return (
    <div className="space-y-4">
      {/* Call log with tags */}
      <CallLog agent={agent}/>

      {/* No Vapi key */}
      {!vapiKey && (
        <div className="bg-purple-500/10 border border-purple-500/25 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={14} className="text-purple-400 mt-0.5 flex-shrink-0"/>
          <div>
            <p className="text-sm font-semibold text-purple-300 mb-1">Add your Vapi API key first</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Vapi handles all the phone call infrastructure — no server to deploy.
              Get a free key at <strong className="text-zinc-300">dashboard.vapi.ai</strong>, then add it in Settings.
            </p>
          </div>
        </div>
      )}

      {/* Step 1: Sync */}
      <div className={`border rounded-xl p-4 space-y-3 transition-colors ${agent.vapiAssistantId ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-white/[0.06]'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">1</span>
              Sync Agent to Vapi
            </p>
            <p className="text-xs text-zinc-600 mt-1 ml-7">Uploads your prompt, voice, and settings to Vapi's servers</p>
          </div>
          {agent.vapiAssistantId && <Check size={14} className="text-emerald-400 flex-shrink-0"/>}
        </div>
        <button onClick={syncToVapi} disabled={syncing || !vapiKey} className="btn-primary w-full">
          {syncing ? <Loader2 size={13} className="animate-spin"/> : <Zap size={13}/>}
          {syncing ? 'Syncing…' : agent.vapiAssistantId ? 'Re-sync (after changes)' : 'Sync to Vapi'}
        </button>
        {syncStatus === 'ok'      && <p className="text-xs text-emerald-400">✓ Synced! ID: {agent.vapiAssistantId}</p>}
        {syncStatus === 'no_key'  && <p className="text-xs text-amber-400">Add your Vapi key in Settings first</p>}
        {syncStatus.startsWith('err:') && <p className="text-xs text-red-400">{syncStatus.slice(4)}</p>}
      </div>

      {/* Step 2: Call */}
      <div className={`border rounded-xl p-4 space-y-3 transition-colors ${!agent.vapiAssistantId ? 'opacity-50' : 'border-white/[0.06]'}`}>
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">2</span>
          Make a Call
        </p>
        <Field label="Phone number (yours or any lead's)">
          <input className="input" placeholder="+1 (555) 000-0000"
            value={callPhone} onChange={e=>setCallPhone(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&makeCall()} disabled={!agent.vapiAssistantId}/>
        </Field>
        <button onClick={makeCall} disabled={calling || !callPhone || !agent.vapiAssistantId}
          className="w-full py-3 text-sm font-semibold rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-40">
          {calling ? <Loader2 size={14} className="animate-spin"/> : <PhoneCall size={14}/>}
          {calling ? 'Calling…' : 'Call this number now'}
        </button>
        {callStatus === 'ok'         && <p className="text-xs text-green-400">✓ Calling {callPhone}… your phone will ring in seconds!</p>}
        {callStatus === 'no_key'     && <p className="text-xs text-amber-400">Add Vapi key in Settings</p>}
        {callStatus === 'sync_first' && <p className="text-xs text-amber-400">Sync the agent first (Step 1)</p>}
        {callStatus === 'no_twilio'  && <p className="text-xs text-amber-400">Add Twilio SID + Token in Settings, and select a phone number in Setup</p>}
        {callStatus === 'no_phone'   && <p className="text-xs text-amber-400">Enter a phone number</p>}
        {callStatus.startsWith('err:') && <p className="text-xs text-red-400">{callStatus.slice(4)}</p>}
        <p className="text-xs text-zinc-600">
          Calls from: {agent.twilioPhoneNumber || <span className="text-amber-500">select a phone number in Setup tab</span>}
        </p>
      </div>

      {/* Inbound */}
      <div className="border border-white/[0.06] rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">3</span>
          Inbound Calls
        </p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          For people to call YOUR Twilio number and reach this agent:
        </p>
        <ol className="space-y-2 text-xs text-zinc-500">
          <li className="flex gap-2"><span className="text-zinc-600">a.</span><span>Twilio Console → Phone Numbers → your number → Voice webhook: set to</span></li>
        </ol>
        <div className="flex items-center gap-2 bg-surface-900 border border-white/[0.06] rounded-lg px-3 py-2">
          <code className="flex-1 text-zinc-300 font-mono text-[10px]">https://api.vapi.ai/webhook/twilio</code>
          <CopyBtn text="https://api.vapi.ai/webhook/twilio"/>
        </div>
        <ol className="space-y-1 text-xs text-zinc-500" start={2}>
          <li className="flex gap-2"><span className="text-zinc-600">b.</span><span>Vapi Dashboard → Phone Numbers → Import → enter your Twilio number + SID + Auth Token → assign <strong className="text-zinc-300">{agent.name||'this assistant'}</strong></span></li>
        </ol>
      </div>

      {/* GHL automation */}
      <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
          <Zap size={11}/>GHL Workflow — Auto-call contacts
        </p>
        <p className="text-xs text-zinc-500">Add a <strong className="text-zinc-300">Custom Webhook</strong> action in any GHL workflow:</p>
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-600">URL: <code className="text-zinc-300 bg-surface-900 px-1 rounded">POST https://api.vapi.ai/call/phone</code></p>
          <p className="text-xs text-zinc-600 mb-1">Headers: <code className="text-zinc-300 bg-surface-900 px-1 rounded">Authorization: Bearer YOUR_VAPI_KEY</code></p>
          <p className="text-xs text-zinc-600">Body:</p>
          <div className="relative">
            <pre className="bg-surface-900 border border-white/[0.06] rounded-lg p-2.5 text-[10px] text-zinc-400 font-mono overflow-x-auto">{ghlBody}</pre>
            <div className="absolute top-2 right-2"><CopyBtn text={ghlBody}/></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export default function VoiceAgentBuilder() {
  const { voiceAgents, activeAgentId, saveVoiceAgent, deleteVoiceAgent, setActiveAgentId } = useAdStore()
  const [tab,   setTab]   = useState('Setup')
  const [draft, setDraft] = useState(null)

  useEffect(()=>{
    if (activeAgentId) {
      const a = voiceAgents.find(x=>x.id===activeAgentId)
      if (a) setDraft({...a})
    }
  }, [activeAgentId])

  function newAgent() {
    const a = DEFAULT_AGENT()
    saveVoiceAgent(a)
    setActiveAgentId(a.id)
    setDraft({...a})
    setTab('Setup')
  }

  function update(changes) {
    if (!draft) return
    const next = {...draft, ...changes}
    setDraft(next)
    saveVoiceAgent(next)
  }

  function remove(id) {
    deleteVoiceAgent(id)
    if (draft?.id===id) { setDraft(null); setActiveAgentId(null) }
  }

  return (
    <div className="flex gap-6 min-h-0" style={{height:'calc(100vh - 120px)'}}>
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-1 overflow-y-auto">
        <button onClick={newAgent} className="btn-primary w-full text-xs mb-2">
          <Plus size={13}/>New Agent
        </button>
        {voiceAgents.length===0 && (
          <div className="text-center py-6">
            <Phone size={20} className="text-zinc-700 mx-auto mb-2"/>
            <p className="text-xs text-zinc-600">No agents yet</p>
          </div>
        )}
        {voiceAgents.map(a=>(
          <div key={a.id}
            className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors
              ${draft?.id===a.id ? 'bg-brand-500/15 text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'}`}
            onClick={()=>{ setActiveAgentId(a.id); setDraft({...a}) }}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold
              ${draft?.id===a.id ? 'bg-brand-500/30 text-brand-300' : 'bg-white/[0.05] text-zinc-600'}`}>
              {(a.name||'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-none truncate">{a.name||'Unnamed Agent'}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5 capitalize">{a.callDirection}</p>
            </div>
            <button onClick={e=>{e.stopPropagation();remove(a.id)}}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all flex-shrink-0">
              <Trash2 size={11}/>
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      {draft ? (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <Phone size={15} className="text-brand-400"/>
            </div>
            <div className="flex-1 min-w-0">
              <input className="text-base font-bold text-white bg-transparent outline-none w-full"
                value={draft.name} onChange={e=>update({name:e.target.value})} placeholder="Agent Name"/>
              <p className="text-xs text-zinc-600 capitalize">{draft.callDirection} · {draft.voiceProvider}</p>
            </div>
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border flex-shrink-0
              ${draft.systemPrompt
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${draft.systemPrompt?'bg-emerald-400':'bg-amber-400'}`}/>
              {draft.systemPrompt ? 'Ready' : 'Setup needed'}
            </span>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 border-b border-white/[0.06] mb-4 flex-shrink-0">
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                  ${tab===t ? 'border-brand-500 text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {tab==='Setup'      && <SetupTab     agent={draft} update={update}/>}
            {tab==='Voice'      && <VoiceTab     agent={draft} update={update}/>}
            {tab==='Test Chat'  && <TestTab      agent={draft}/>}
            {tab==='Live Test'  && <LiveTestTab  agent={draft}/>}
            {tab==='Calls'      && <CallsTab     agent={draft} update={update}/>}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Phone size={32} className="text-zinc-700 mx-auto mb-3"/>
            <p className="text-sm font-semibold text-zinc-400 mb-1">No agent selected</p>
            <p className="text-xs text-zinc-600 mb-4">Create a new agent to get started</p>
            <button onClick={newAgent} className="btn-primary"><Plus size={13}/>Create Agent</button>
          </div>
        </div>
      )}
    </div>
  )
}
