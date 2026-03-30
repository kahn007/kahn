import React, { useState, useEffect } from 'react'
import {
  Phone, Bot, Mic, Brain, Settings2, Code2, Play, Plus, Trash2,
  ChevronDown, ChevronUp, Copy, Check, Download, RefreshCw, Loader,
  Zap, Globe, Calendar, Users, MessageSquare, BarChart2, Shield
} from 'lucide-react'
import { useAdStore } from '../store/adStore'
import {
  generateAgentPrompt, listElevenLabsVoices, listCartesiaVoices,
  listTwilioNumbers, fetchGHLCalendars, fetchGHLPipelines,
  generateVoiceAgentServerCode,
} from '../lib/api'
import { getKey } from '../lib/keys'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'

const AGENT_TYPES = [
  { id: 'appointment_setter', label: 'Appointment Setter', emoji: '📅', desc: 'Books calls and demos into your calendar' },
  { id: 'lead_qualifier',     label: 'Lead Qualifier',     emoji: '🔍', desc: 'Scores and qualifies inbound leads' },
  { id: 'sales_closer',       label: 'Sales Closer',       emoji: '💰', desc: 'Handles objections and closes deals' },
  { id: 'customer_support',   label: 'Customer Support',   emoji: '🎧', desc: 'Answers questions and resolves issues' },
  { id: 'follow_up',          label: 'Follow-Up',          emoji: '🔁', desc: 'Re-engages cold or dormant leads' },
  { id: 'survey',             label: 'Survey / Research',  emoji: '📊', desc: 'Collects structured feedback at scale' },
]

const LLM_MODELS = [
  { id: 'claude-sonnet-4-6',       label: 'Claude Sonnet 4.6',     provider: 'anthropic', badge: '🟠 Recommended' },
  { id: 'claude-opus-4-6',         label: 'Claude Opus 4.6',       provider: 'anthropic', badge: '🟠 Most capable' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',    provider: 'anthropic', badge: '🟠 Fastest' },
  { id: 'gpt-4o',                  label: 'GPT-4o',                provider: 'openai',    badge: '🟢 OpenAI' },
  { id: 'gpt-4o-mini',             label: 'GPT-4o Mini',           provider: 'openai',    badge: '🟢 Fast + cheap' },
  { id: 'gemini-2.0-flash',        label: 'Gemini 2.0 Flash',      provider: 'google',    badge: '🔵 Google' },
]

const VOICE_PROVIDERS = [
  { id: 'elevenlabs', label: 'ElevenLabs', emoji: '🎙️', keyId: 'elevenlabs', desc: 'Most natural, 3000+ voices, multilingual' },
  { id: 'cartesia',   label: 'Cartesia',   emoji: '⚡', keyId: 'cartesia',   desc: 'Ultra-low latency, ideal for real-time' },
  { id: 'hume',       label: 'Hume EVI',   emoji: '🧠', keyId: 'hume',       desc: 'Empathic — detects and mirrors emotion' },
  { id: 'deepgram',   label: 'Deepgram',   emoji: '🔊', keyId: 'deepgram',   desc: 'Aura voices, built-in STT + TTS combo' },
]

const GHL_CAPABILITIES = [
  { id: 'contacts',      label: 'Read & create contacts',  scope: 'contacts.readonly, contacts.write',                              icon: Users },
  { id: 'conversations', label: 'Log conversations',       scope: 'conversations.readonly, conversations/message.write',            icon: MessageSquare },
  { id: 'calendar',      label: 'Book appointments',       scope: 'calendars.readonly, calendars/events.write',                     icon: Calendar },
  { id: 'opportunities', label: 'Update pipeline stages',  scope: 'opportunities.readonly, opportunities.write',                    icon: BarChart2 },
  { id: 'customFields',  label: 'Read/write custom fields',scope: 'locations/customFields.readonly, locations/customFields.write',   icon: Settings2 },
]

const TABS = ['identity', 'brain', 'voice', 'phone', 'crm', 'script', 'deploy']
const TAB_LABELS = { identity: 'Identity', brain: 'Brain', voice: 'Voice', phone: 'Phone', crm: 'CRM', script: 'Script', deploy: 'Deploy' }

const DEFAULT_AGENT = () => ({
  id: uuidv4(),
  name: 'New Voice Agent',
  type: 'appointment_setter',
  callDirection: 'inbound',
  llmModel: 'claude-sonnet-4-6',
  voiceProvider: 'elevenlabs',
  voiceId: '',
  voiceName: '',
  twilioNumber: '',
  ghlCapabilities: ['contacts', 'calendar'],
  systemPrompt: '',
  firstMessage: '',
  maxCallMinutes: 10,
  language: 'en',
  createdAt: new Date().toISOString(),
})

export default function VoiceAgentBuilder() {
  const { voiceAgents, activeAgentId, saveVoiceAgent, deleteVoiceAgent, setActiveAgentId, brandContext } = useAdStore()
  const [tab, setTab] = useState('identity')
  const [agent, setAgent] = useState(DEFAULT_AGENT)
  const [voices, setVoices] = useState([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [twilioNumbers, setTwilioNumbers] = useState([])
  const [ghlCalendars, setGhlCalendars] = useState([])
  const [ghlPipelines, setGhlPipelines] = useState([])
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [serverCode, setServerCode] = useState('')
  const [generatingCode, setGeneratingCode] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // Load active agent into editor
  useEffect(() => {
    if (activeAgentId) {
      const a = voiceAgents.find((a) => a.id === activeAgentId)
      if (a) setAgent(a)
    }
  }, [activeAgentId])

  const up = (k, v) => setAgent((a) => ({ ...a, [k]: v }))

  const save = () => {
    saveVoiceAgent({ ...agent })
    toast.success('Agent saved')
  }

  const createNew = () => {
    const a = DEFAULT_AGENT()
    setAgent(a)
    setTab('identity')
    setServerCode('')
  }

  const selectAgent = (id) => {
    setActiveAgentId(id)
    const a = voiceAgents.find((x) => x.id === id)
    if (a) { setAgent(a); setTab('identity'); setServerCode('') }
  }

  // Load voices when provider changes
  useEffect(() => {
    loadVoices()
  }, [agent.voiceProvider])

  const loadVoices = async () => {
    const key = getKey(agent.voiceProvider === 'elevenlabs' ? 'elevenlabs'
      : agent.voiceProvider === 'cartesia' ? 'cartesia'
      : agent.voiceProvider === 'hume' ? 'hume' : 'deepgram')
    if (!key) { setVoices([]); return }
    setLoadingVoices(true)
    try {
      let list = []
      if (agent.voiceProvider === 'elevenlabs') list = await listElevenLabsVoices(key)
      else if (agent.voiceProvider === 'cartesia') list = await listCartesiaVoices(key)
      else list = []
      setVoices(list)
    } catch { setVoices([]) }
    finally { setLoadingVoices(false) }
  }

  const loadTwilioNumbers = async () => {
    const sid = getKey('twilio_sid')
    const token = getKey('twilio_token')
    if (!sid || !token) { toast.error('Add Twilio SID + Auth Token in Settings'); return }
    try {
      const nums = await listTwilioNumbers(sid, token)
      setTwilioNumbers(nums)
    } catch (err) { toast.error('Twilio: ' + err.message) }
  }

  const loadGHLData = async () => {
    const token = getKey('ghl_token')
    const locId  = getKey('ghl_location_id')
    if (!token || !locId) { toast.error('Add GHL token + Location ID in Settings'); return }
    try {
      const [cals, pipes] = await Promise.all([fetchGHLCalendars(token, locId), fetchGHLPipelines(token, locId)])
      setGhlCalendars(cals)
      setGhlPipelines(pipes)
      toast.success('GHL data loaded')
    } catch (err) { toast.error('GHL: ' + err.message) }
  }

  const generatePrompt = async () => {
    if (!getKey('anthropic')) { toast.error('Add Anthropic key in Settings'); return }
    setGeneratingPrompt(true)
    try {
      const prompt = await generateAgentPrompt({
        agentType: agent.type,
        callDirection: agent.callDirection,
        brandContext,
        capabilities: agent.ghlCapabilities,
        agentName: agent.name,
      })
      up('systemPrompt', prompt.systemPrompt)
      up('firstMessage', prompt.firstMessage)
      toast.success('Prompt generated')
    } catch (err) { toast.error(err.message) }
    finally { setGeneratingPrompt(false) }
  }

  const generateCode = async () => {
    setGeneratingCode(true)
    try {
      const code = generateVoiceAgentServerCode({ agent, keys: {
        anthropic:   getKey('anthropic'),
        openai:      getKey('openai'),
        elevenlabs:  getKey('elevenlabs'),
        cartesia:    getKey('cartesia'),
        hume:        getKey('hume'),
        deepgram:    getKey('deepgram'),
        twilio_sid:  getKey('twilio_sid'),
        twilio_token: getKey('twilio_token'),
        ghl_token:   getKey('ghl_token'),
        ghl_location_id: getKey('ghl_location_id'),
      }})
      setServerCode(code)
      toast.success('Server code generated')
    } catch (err) { toast.error(err.message) }
    finally { setGeneratingCode(false) }
  }

  const downloadCode = () => {
    const blob = new Blob([serverCode], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${agent.name.replace(/\s+/g, '-').toLowerCase()}-server.js`
    a.click(); URL.revokeObjectURL(url)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(serverCode)
    setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1800)
    toast.success('Server code copied')
  }

  const toggleCap = (id) => {
    up('ghlCapabilities', agent.ghlCapabilities.includes(id)
      ? agent.ghlCapabilities.filter((c) => c !== id)
      : [...agent.ghlCapabilities, id])
  }

  return (
    <div className="space-y-0 flex gap-5 min-h-[600px]">

      {/* Agent list sidebar */}
      <div className="w-52 flex-shrink-0 space-y-2">
        <button onClick={createNew} className="btn-primary w-full flex items-center gap-2 text-sm justify-center">
          <Plus size={13} /> New Agent
        </button>
        <div className="space-y-1">
          {voiceAgents.length === 0 ? (
            <div className="empty-state py-8 text-center">
              <Bot size={22} className="text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-600">No agents yet</p>
            </div>
          ) : voiceAgents.map((a) => (
            <button
              key={a.id}
              onClick={() => selectAgent(a.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                activeAgentId === a.id
                  ? 'bg-brand-500/15 border-brand-500/40 text-white'
                  : 'bg-surface-800/40 border-white/[0.05] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.10]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium truncate">{a.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteVoiceAgent(a.id) }}
                  className="text-zinc-600 hover:text-red-400 flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {AGENT_TYPES.find((t) => t.id === a.type)?.label || a.type}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 space-y-0">
        <div className="card space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                <Bot size={16} className="text-brand-400" />
              </div>
              <div>
                <input
                  className="bg-transparent text-white font-bold text-base outline-none border-b border-transparent hover:border-white/[0.15] focus:border-brand-500/50 transition-colors pb-0.5 w-48"
                  value={agent.name}
                  onChange={(e) => up('name', e.target.value)}
                />
                <p className="text-xs text-zinc-500">{AGENT_TYPES.find((t) => t.id === agent.type)?.label}</p>
              </div>
            </div>
            <button onClick={save} className="btn-primary text-sm flex items-center gap-2">
              <Check size={13} /> Save Agent
            </button>
          </div>

          {/* Tabs */}
          <div className="tab-group">
            {TABS.map((t) => (
              <button key={t} className={tab === t ? 'tab-active' : 'tab-inactive'} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* ── Identity ── */}
          {tab === 'identity' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Agent Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {AGENT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => up('type', t.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        agent.type === t.id
                          ? 'bg-brand-500/15 border-brand-500/40'
                          : 'bg-surface-800/40 border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="text-xl mb-1">{t.emoji}</div>
                      <div className={`text-xs font-semibold ${agent.type === t.id ? 'text-brand-300' : 'text-zinc-300'}`}>{t.label}</div>
                      <div className="text-[10px] text-zinc-500 leading-snug mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Call Direction</label>
                  <select className="input text-sm" value={agent.callDirection} onChange={(e) => up('callDirection', e.target.value)}>
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Language</label>
                  <select className="input text-sm" value={agent.language} onChange={(e) => up('language', e.target.value)}>
                    {[['en','English'],['es','Spanish'],['fr','French'],['de','German'],['pt','Portuguese'],['it','Italian'],['nl','Dutch'],['ar','Arabic'],['zh','Chinese'],['ja','Japanese']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Max Call Duration</label>
                  <select className="input text-sm" value={agent.maxCallMinutes} onChange={(e) => up('maxCallMinutes', +e.target.value)}>
                    {[5,10,15,20,30,45,60].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Brain ── */}
          {tab === 'brain' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">Choose the LLM that powers the agent's reasoning and conversation.</p>
              <div className="grid grid-cols-2 gap-2">
                {LLM_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => up('llmModel', m.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      agent.llmModel === m.id
                        ? 'bg-brand-500/15 border-brand-500/40'
                        : 'bg-surface-800/40 border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-0.5 ${agent.llmModel === m.id ? 'text-brand-300' : 'text-zinc-200'}`}>{m.label}</div>
                    <div className="text-[10px] text-zinc-500">{m.badge}</div>
                  </button>
                ))}
              </div>
              <div className="info-box flex items-start gap-2">
                <Brain size={13} className="text-brand-400 flex-shrink-0 mt-0.5" />
                <p>Claude Sonnet 4.6 is recommended — best balance of speed, reasoning, and natural conversation. For high-volume outbound, Haiku reduces cost 10×.</p>
              </div>
            </div>
          )}

          {/* ── Voice ── */}
          {tab === 'voice' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Voice Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {VOICE_PROVIDERS.map((vp) => (
                    <button
                      key={vp.id}
                      onClick={() => { up('voiceProvider', vp.id); up('voiceId', ''); up('voiceName', '') }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        agent.voiceProvider === vp.id
                          ? 'bg-brand-500/15 border-brand-500/40'
                          : 'bg-surface-800/40 border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{vp.emoji}</span>
                        <span className={`text-xs font-semibold ${agent.voiceProvider === vp.id ? 'text-brand-300' : 'text-zinc-300'}`}>{vp.label}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-snug">{vp.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-zinc-400">Voice</label>
                  <button onClick={loadVoices} disabled={loadingVoices} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    {loadingVoices ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    {voices.length ? `${voices.length} voices` : 'Load voices'}
                  </button>
                </div>
                {voices.length > 0 ? (
                  <select className="input text-sm" value={agent.voiceId} onChange={(e) => {
                    const v = voices.find((v) => v.voice_id === e.target.value || v.id === e.target.value)
                    up('voiceId', e.target.value)
                    up('voiceName', v?.name || e.target.value)
                  }}>
                    <option value="">— Select a voice —</option>
                    {voices.map((v) => (
                      <option key={v.voice_id || v.id} value={v.voice_id || v.id}>
                        {v.name}{v.labels?.gender ? ` · ${v.labels.gender}` : ''}{v.labels?.accent ? ` · ${v.labels.accent}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="input text-sm text-zinc-500 cursor-default">
                    Add your {VOICE_PROVIDERS.find((p) => p.id === agent.voiceProvider)?.label} key in Settings, then click Load voices
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Phone ── */}
          {tab === 'phone' && (
            <div className="space-y-4">
              <div className="warn-box flex items-start gap-2">
                <Phone size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-300 mb-0.5">Twilio required</p>
                  <p>Add your Twilio Account SID and Auth Token in Settings. The phone number routes calls to your deployed voice agent server.</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-zinc-400">Phone Number</label>
                  <button onClick={loadTwilioNumbers} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    <RefreshCw size={11} /> Load numbers
                  </button>
                </div>
                {twilioNumbers.length > 0 ? (
                  <select className="input text-sm" value={agent.twilioNumber} onChange={(e) => up('twilioNumber', e.target.value)}>
                    <option value="">— Pick a Twilio number —</option>
                    {twilioNumbers.map((n) => (
                      <option key={n.sid} value={n.phone_number}>{n.phone_number} {n.friendly_name ? `(${n.friendly_name})` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input text-sm" placeholder="+1 555 000 0000" value={agent.twilioNumber} onChange={(e) => up('twilioNumber', e.target.value)} />
                )}
              </div>

              <div className="info-box flex items-start gap-2">
                <Globe size={13} className="text-brand-400 flex-shrink-0 mt-0.5" />
                <p>After deploying your server (Deploy tab), paste your server's public URL into the Twilio phone number's Voice webhook: <code className="bg-surface-800 px-1 rounded text-zinc-300">https://your-server.com/twilio/voice</code></p>
              </div>
            </div>
          )}

          {/* ── CRM ── */}
          {tab === 'crm' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">GoHighLevel Integration</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Add your Private Integration Token and Location ID in Settings</p>
                </div>
                <button onClick={loadGHLData} className="btn-secondary text-xs flex items-center gap-1.5">
                  <RefreshCw size={12} /> Test Connection
                </button>
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Capabilities <span className="text-zinc-600">(what the agent can do in GHL)</span></label>
                <div className="space-y-2">
                  {GHL_CAPABILITIES.map((cap) => {
                    const Icon = cap.icon
                    const active = agent.ghlCapabilities.includes(cap.id)
                    return (
                      <button
                        key={cap.id}
                        onClick={() => toggleCap(cap.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-brand-500/10 border-brand-500/30'
                            : 'bg-surface-800/30 border-white/[0.05] hover:border-white/[0.10]'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-brand-500 text-white' : 'bg-surface-700 text-zinc-500'}`}>
                          <Icon size={12} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-medium ${active ? 'text-white' : 'text-zinc-400'}`}>{cap.label}</p>
                          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{cap.scope}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${active ? 'bg-brand-500 border-brand-500' : 'border-zinc-600'}`}>
                          {active && <Check size={9} className="text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {ghlCalendars.length > 0 && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Default Calendar for Bookings</label>
                  <select className="input text-sm" value={agent.ghlCalendarId || ''} onChange={(e) => up('ghlCalendarId', e.target.value)}>
                    <option value="">— Pick calendar —</option>
                    {ghlCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {ghlPipelines.length > 0 && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Pipeline for New Opportunities</label>
                  <select className="input text-sm" value={agent.ghlPipelineId || ''} onChange={(e) => up('ghlPipelineId', e.target.value)}>
                    <option value="">— Pick pipeline —</option>
                    {ghlPipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── Script ── */}
          {tab === 'script' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">System Prompt</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Defines the agent's persona, goals, and behaviour</p>
                </div>
                <button onClick={generatePrompt} disabled={generatingPrompt} className="btn-secondary text-xs flex items-center gap-1.5">
                  {generatingPrompt ? <Loader size={12} className="animate-spin" /> : <Zap size={12} />}
                  AI Generate
                </button>
              </div>
              <textarea
                className="textarea font-mono text-xs"
                rows={10}
                placeholder="You are [Name], a friendly voice agent for [Company]. Your goal is to…"
                value={agent.systemPrompt}
                onChange={(e) => up('systemPrompt', e.target.value)}
              />

              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">First Message <span className="text-zinc-600">(what the agent says when the call connects)</span></label>
                <textarea
                  className="textarea text-sm"
                  rows={2}
                  placeholder="Hi, this is [Name] from [Company]. How can I help you today?"
                  value={agent.firstMessage}
                  onChange={(e) => up('firstMessage', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Deploy ── */}
          {tab === 'deploy' && (
            <div className="space-y-5">
              <div className="info-box flex items-start gap-2">
                <Code2 size={13} className="text-brand-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-brand-300 mb-0.5">Ready-to-run Node.js server</p>
                  <p>Click Generate to get a complete, self-contained voice agent server. Deploy it to Railway, Render, Fly.io, or any VPS. Then point your Twilio webhook at it.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Deployment checklist</h4>
                {[
                  { done: !!agent.systemPrompt, label: 'System prompt written' },
                  { done: !!agent.voiceId, label: `${VOICE_PROVIDERS.find((p) => p.id === agent.voiceProvider)?.label} voice selected` },
                  { done: !!agent.twilioNumber, label: 'Twilio phone number set' },
                  { done: !!getKey('twilio_sid'), label: 'Twilio credentials in Settings' },
                  { done: agent.ghlCapabilities.length === 0 || !!getKey('ghl_token'), label: 'GHL token in Settings (if using CRM)' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2.5 text-xs ${item.done ? 'text-green-400' : 'text-zinc-500'}`}>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500 border-green-500' : 'border-zinc-600'}`}>
                      {item.done && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    {item.label}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={generateCode} disabled={generatingCode} className="btn-primary flex items-center gap-2 text-sm">
                  {generatingCode ? <Loader size={13} className="animate-spin" /> : <Code2 size={13} />}
                  Generate Server Code
                </button>
                {serverCode && (
                  <>
                    <button onClick={copyCode} className="btn-secondary flex items-center gap-1.5 text-sm">
                      {codeCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />} Copy
                    </button>
                    <button onClick={downloadCode} className="btn-secondary flex items-center gap-1.5 text-sm">
                      <Download size={12} /> Download
                    </button>
                  </>
                )}
              </div>

              {serverCode && (
                <div className="relative">
                  <pre className="bg-surface-800/70 border border-white/[0.06] rounded-xl p-4 text-[11px] text-zinc-300 font-mono overflow-auto max-h-96 leading-relaxed">
                    {serverCode}
                  </pre>
                </div>
              )}

              {serverCode && (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p className="font-semibold text-zinc-300">Quick deploy steps:</p>
                  <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                    <li>Save the file as <code className="bg-surface-800 px-1 rounded text-zinc-200">server.js</code></li>
                    <li>Run <code className="bg-surface-800 px-1 rounded text-zinc-200">npm install express ws twilio axios dotenv</code></li>
                    <li>Deploy to Railway / Render / Fly.io (one click from GitHub)</li>
                    <li>Copy your public URL</li>
                    <li>In Twilio Console → Phone Numbers → Your number → Voice webhook: <code className="bg-surface-800 px-1 rounded text-zinc-200">https://your-url.com/twilio/voice</code></li>
                    <li>Call the number and talk to your agent 🎉</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
