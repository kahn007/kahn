import React, { useState, useEffect, useRef } from 'react'
import {
  Phone, Plus, Trash2, Wand2, Globe, Copy, Download,
  Check, AlertCircle, Loader2, RefreshCw, MessageSquare,
  Code2, Play, Server, X, Mic, Zap, Building2, Search,
  PhoneCall, ExternalLink,
} from 'lucide-react'
import { useAdStore } from '../store/adStore'
import { getKey } from '../lib/keys'
import {
  syncVapiAssistant, triggerVapiCall,
  testAgentConversation, listElevenLabsVoices,
  listTwilioNumbers, fetchGHLCalendars, fetchGHLPipelines,
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
  llmModel: 'claude-sonnet-4-6',
  voiceProvider: 'elevenlabs', // only option
  voiceId: '',
  voiceName: '',
  firstMessage: '',
  systemPrompt: '',
  websiteUrl: '',
  scrapedServices: [],
  selectedServices: [],
  companyName: '',
  twilio: { accountSid: '', authToken: '', phoneNumber: '' },
  ghl: { token: '', locationId: '', calendarId: '', pipelineId: '', capabilities: ['contacts', 'calendar'] },
  vapiAssistantId: '',
  createdAt: new Date().toISOString(),
})

const LLM_MODELS = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 — Most capable' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — Best balance' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — Fastest' },
]
const GHL_CAPS = [
  { id: 'contacts', label: 'Contacts', desc: 'Find / create contacts' },
  { id: 'calendar', label: 'Calendar', desc: 'Book appointments' },
  { id: 'pipeline', label: 'Pipeline', desc: 'Move deal stages' },
  { id: 'notes',    label: 'Notes',    desc: 'Log call notes' },
]
const TABS = ['Setup','Voice','Credentials','Test Chat','Calls']

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
  const [scraping,   setScraping]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [scrapeErr,  setScrapeErr]  = useState('')

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
      const r = await generateAgentPromptFromServices({
        companyName: agent.companyName, services: svcs,
        callDirection: agent.callDirection, firstMessage: agent.firstMessage, language: agent.language,
      })
      update({ systemPrompt: r.systemPrompt, firstMessage: r.firstMessage || agent.firstMessage })
    } catch(e) { alert(e.message) }
    finally { setGenerating(false) }
  }

  function toggleSvc(id) {
    update({ selectedServices: agent.selectedServices.includes(id)
      ? agent.selectedServices.filter(x=>x!==id)
      : [...agent.selectedServices, id] })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Agent Name">
          <input className="input" placeholder="e.g. Sarah — Appointment Setter"
            value={agent.name} onChange={e=>update({name:e.target.value})}/>
        </Field>
        <Field label="Call Direction">
          <div className="flex gap-2">
            {['inbound','outbound'].map(d=>(
              <button key={d} onClick={()=>update({callDirection:d})}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors capitalize
                  ${agent.callDirection===d ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300'}`}>{d}</button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Opening Message" hint="What the agent says first when a call connects">
        <textarea className="input min-h-[70px] resize-none"
          placeholder={`"Hi! Thanks for calling ${agent.companyName||'us'}, this is ${agent.name||'Sarah'}. How can I help?"`}
          value={agent.firstMessage} onChange={e=>update({firstMessage:e.target.value})}/>
      </Field>

      {/* Website Scraper */}
      <div className="border border-white/[0.08] rounded-xl p-4 space-y-4 bg-surface-900/50">
        <div className="flex items-center gap-2">
          <Globe size={13} className="text-brand-400"/>
          <p className="text-sm font-semibold text-white">Website Scraper</p>
          <span className="text-xs text-zinc-600 ml-1">auto-build prompt from your site</span>
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="https://yoursite.com"
            value={agent.websiteUrl} onChange={e=>update({websiteUrl:e.target.value})}
            onKeyDown={e=>e.key==='Enter'&&handleScrape()}/>
          <button onClick={handleScrape} disabled={!agent.websiteUrl||scraping} className="btn-primary shrink-0">
            {scraping ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
            {scraping ? 'Scanning…' : 'Scan'}
          </button>
        </div>
        {scrapeErr && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11}/>{scrapeErr}</p>}

        {agent.scrapedServices.length > 0 && (
          <div className="space-y-3">
            {agent.companyName && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Building2 size={11} className="text-zinc-600"/>{agent.companyName}
              </div>
            )}
            <p className="text-xs text-zinc-500">Select services this agent handles:</p>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {agent.scrapedServices.map(svc => {
                const on = agent.selectedServices.includes(svc.id)
                return (
                  <button key={svc.id} onClick={()=>toggleSvc(svc.id)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition-colors
                      ${on ? 'bg-brand-500/15 border-brand-500/30 text-white'
                           : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]'}`}>
                    <div className="flex items-start gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5
                        ${on ? 'bg-brand-500 border-brand-500' : 'border-zinc-600'}`}>
                        {on && <Check size={9} className="text-white"/>}
                      </div>
                      <div>
                        <p className="font-medium leading-snug">{svc.name}</p>
                        {svc.description && <p className="text-zinc-600 mt-0.5 leading-snug line-clamp-1">{svc.description}</p>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <button onClick={handleGenerate} disabled={generating||!agent.selectedServices.length} className="btn-primary w-full">
              {generating ? <Loader2 size={13} className="animate-spin"/> : <Wand2 size={13}/>}
              {generating ? 'Generating Prompt…'
                : `Generate Prompt (${agent.selectedServices.length} service${agent.selectedServices.length!==1?'s':''})`}
            </button>
          </div>
        )}
      </div>

      <Field label="System Prompt" hint="Auto-generated above, or write manually">
        <textarea className="input min-h-[160px] resize-y font-mono text-xs leading-relaxed"
          placeholder="Your agent's instructions will appear here after scanning…"
          value={agent.systemPrompt} onChange={e=>update({systemPrompt:e.target.value})}/>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Language">
          <select className="input" value={agent.language} onChange={e=>update({language:e.target.value})}>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
          </select>
        </Field>
        <Field label="AI Model">
          <select className="input" value={agent.llmModel} onChange={e=>update({llmModel:e.target.value})}>
            {LLM_MODELS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label={`Max Call Duration — ${agent.maxCallMinutes} min`}>
        <input type="range" min={2} max={30} step={1} value={agent.maxCallMinutes}
          onChange={e=>update({maxCallMinutes:Number(e.target.value)})}
          className="w-full accent-brand-500"/>
      </Field>
    </div>
  )
}

// ── Voice Tab ─────────────────────────────────────────────────
function VoiceTab({ agent, update }) {
  const [voices,  setVoices]  = useState([])
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  async function loadVoices() {
    setLoading(true); setErr('')
    try {
      const k = getKey('elevenlabs')
      if (!k) throw new Error('Add your ElevenLabs key in Settings')
      const d = await listElevenLabsVoices(k)
      setVoices((d.voices||[]).map(v=>({id:v.voice_id,name:v.name,labels:v.labels})))
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400 font-medium">ElevenLabs Voices</p>
        <button onClick={loadVoices} disabled={loading} className="btn-ghost text-xs">
          {loading ? <Loader2 size={11} className="animate-spin"/> : <RefreshCw size={11}/>}
          {loading ? 'Loading…' : 'Load Voices'}
        </button>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}

      {voices.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {voices.map(v=>(
            <button key={v.id} onClick={()=>update({voiceId:v.id,voiceName:v.name})}
              className={`text-left p-2.5 rounded-lg border text-xs transition-colors
                ${agent.voiceId===v.id ? 'bg-brand-500/15 border-brand-500/30 text-white'
                : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]'}`}>
              <p className="font-medium">{v.name}</p>
              {v.labels && <p className="text-zinc-600 mt-0.5">{Object.values(v.labels).slice(0,2).join(', ')}</p>}
            </button>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-white/[0.08] rounded-xl p-8 text-center">
          <Mic size={20} className="text-zinc-700 mx-auto mb-2"/>
          <p className="text-xs text-zinc-600">Click "Load Voices" to browse your ElevenLabs library</p>
        </div>
      )}

      {agent.voiceId && (
        <div className="flex items-center gap-2 p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-lg">
          <Check size={12} className="text-brand-400"/>
          <span className="text-xs text-brand-300 font-medium">{agent.voiceName}</span>
          <span className="text-xs text-zinc-600 font-mono ml-auto">{agent.voiceId.slice(0,20)}…</span>
        </div>
      )}
    </div>
  )
}

// ── Credentials Tab ───────────────────────────────────────────
function CredentialsTab({ agent, update }) {
  const [twilioNums, setTwilioNums] = useState([])
  const [loadNums,   setLoadNums]   = useState(false)
  const [calendars,  setCalendars]  = useState([])
  const [pipelines,  setPipelines]  = useState([])
  const [loadCRM,    setLoadCRM]    = useState(false)
  const [crmErr,     setCrmErr]     = useState('')

  const upTw  = (k,v) => update({twilio:{...agent.twilio,[k]:v}})
  const upGHL = (k,v) => update({ghl:{...agent.ghl,[k]:v}})

  async function fetchNums() {
    if (!agent.twilio.accountSid||!agent.twilio.authToken) return
    setLoadNums(true)
    try { const d=await listTwilioNumbers(agent.twilio.accountSid,agent.twilio.authToken); setTwilioNums(d.incomingPhoneNumbers||[]) }
    catch(_) {} finally { setLoadNums(false) }
  }

  async function fetchCRM() {
    if (!agent.ghl.token||!agent.ghl.locationId){setCrmErr('Enter GHL Token and Location ID first');return}
    setLoadCRM(true); setCrmErr('')
    try {
      const [c,p]=await Promise.all([
        fetchGHLCalendars(agent.ghl.token,agent.ghl.locationId),
        fetchGHLPipelines(agent.ghl.token,agent.ghl.locationId),
      ])
      setCalendars(c.calendars||[]); setPipelines(p.pipelines||[])
    } catch(e){setCrmErr(e.message)} finally{setLoadCRM(false)}
  }

  function toggleCap(id){
    upGHL('capabilities', agent.ghl.capabilities.includes(id)
      ? agent.ghl.capabilities.filter(c=>c!==id)
      : [...agent.ghl.capabilities,id])
  }

  return (
    <div className="space-y-6">
      {/* GHL */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
            <Zap size={10} className="text-emerald-400"/>
          </div>
          <p className="text-sm font-semibold text-white">GoHighLevel</p>
          <span className="text-xs text-zinc-600">per sub-account</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Private Integration Token">
            <input className="input font-mono text-xs" placeholder="eyJhbGc…" type="password"
              value={agent.ghl.token} onChange={e=>upGHL('token',e.target.value)}/>
          </Field>
          <Field label="Location ID">
            <input className="input font-mono text-xs" placeholder="abc123xyz…"
              value={agent.ghl.locationId} onChange={e=>upGHL('locationId',e.target.value)}/>
          </Field>
        </div>
        <button onClick={fetchCRM} disabled={loadCRM} className="btn-ghost text-xs">
          {loadCRM ? <Loader2 size={11} className="animate-spin"/> : <RefreshCw size={11}/>}
          Load Calendars & Pipelines
        </button>
        {crmErr && <p className="text-xs text-red-400">{crmErr}</p>}
        {(calendars.length>0||pipelines.length>0) && (
          <div className="grid grid-cols-2 gap-3">
            {calendars.length>0 && (
              <Field label="Calendar">
                <select className="input text-xs" value={agent.ghl.calendarId} onChange={e=>upGHL('calendarId',e.target.value)}>
                  <option value="">Select…</option>
                  {calendars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            {pipelines.length>0 && (
              <Field label="Pipeline">
                <select className="input text-xs" value={agent.ghl.pipelineId} onChange={e=>upGHL('pipelineId',e.target.value)}>
                  <option value="">Select…</option>
                  {pipelines.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
          </div>
        )}
        <div>
          <p className="text-xs text-zinc-400 font-medium mb-2">CRM Capabilities</p>
          <div className="grid grid-cols-2 gap-2">
            {GHL_CAPS.map(c=>{
              const on=agent.ghl.capabilities.includes(c.id)
              return(
                <button key={c.id} onClick={()=>toggleCap(c.id)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-colors
                    ${on ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300'}`}>
                  <p className="font-medium">{c.label}</p>
                  <p className="text-zinc-600 mt-0.5">{c.desc}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Twilio */}
      <div className="space-y-4 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center">
            <Phone size={10} className="text-red-400"/>
          </div>
          <p className="text-sm font-semibold text-white">Twilio</p>
          <span className="text-xs text-zinc-600">per sub-account</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account SID">
            <input className="input font-mono text-xs" placeholder="ACxxxx…"
              value={agent.twilio.accountSid} onChange={e=>upTw('accountSid',e.target.value)}/>
          </Field>
          <Field label="Auth Token">
            <input className="input font-mono text-xs" type="password" placeholder="••••••••"
              value={agent.twilio.authToken} onChange={e=>upTw('authToken',e.target.value)}/>
          </Field>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Field label="Phone Number">
              <select className="input text-xs" value={agent.twilio.phoneNumber} onChange={e=>upTw('phoneNumber',e.target.value)}>
                <option value="">Select or type below…</option>
                {twilioNums.map(n=><option key={n.sid} value={n.phoneNumber}>{n.friendlyName||n.phoneNumber}</option>)}
              </select>
            </Field>
          </div>
          <button onClick={fetchNums} disabled={loadNums||!agent.twilio.accountSid} className="btn-ghost text-xs mb-0 shrink-0">
            {loadNums ? <Loader2 size={11} className="animate-spin"/> : <RefreshCw size={11}/>}
          </button>
        </div>
        {!twilioNums.length && (
          <input className="input text-xs" placeholder="+1234567890"
            value={agent.twilio.phoneNumber} onChange={e=>upTw('phoneNumber',e.target.value)}/>
        )}
      </div>
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
    const tw = agent.twilio || {}
    if (!tw.accountSid || !tw.authToken || !tw.phoneNumber) { setCallStatus('no_twilio'); return }
    if (!callPhone) { setCallStatus('no_phone'); return }
    setCalling(true); setCallStatus('')
    try {
      await triggerVapiCall({
        vapiKey,
        assistantId: agent.vapiAssistantId,
        toPhone: callPhone,
        fromPhone: tw.phoneNumber,
        twilioAccountSid: tw.accountSid,
        twilioAuthToken: tw.authToken,
      })
      setCallStatus('ok')
    } catch(e) { setCallStatus('err:' + e.message) }
    finally { setCalling(false) }
  }

  const ghlBody = JSON.stringify({
    assistantId: agent.vapiAssistantId || 'YOUR_ASSISTANT_ID',
    customer: { number: '{{contact.phone}}' },
    phoneNumber: {
      twilioPhoneNumber: agent.twilio?.phoneNumber || '+1...',
      twilioAccountSid: agent.twilio?.accountSid || 'AC...',
      twilioAuthToken: '{{your_twilio_auth_token}}',
    },
  }, null, 2)

  return (
    <div className="space-y-4">
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
        {callStatus === 'no_twilio'  && <p className="text-xs text-amber-400">Add Twilio credentials in the Credentials tab</p>}
        {callStatus === 'no_phone'   && <p className="text-xs text-amber-400">Enter a phone number</p>}
        {callStatus.startsWith('err:') && <p className="text-xs text-red-400">{callStatus.slice(4)}</p>}
        <p className="text-xs text-zinc-600">
          Calls from: {agent.twilio?.phoneNumber || <span className="text-amber-500">add Twilio number in Credentials</span>}
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
            {tab==='Setup'       && <SetupTab       agent={draft} update={update}/>}
            {tab==='Voice'       && <VoiceTab       agent={draft} update={update}/>}
            {tab==='Credentials' && <CredentialsTab agent={draft} update={update}/>}
            {tab==='Test Chat'   && <TestTab        agent={draft}/>}
            {tab==='Calls'       && <CallsTab       agent={draft} update={update}/>}
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
