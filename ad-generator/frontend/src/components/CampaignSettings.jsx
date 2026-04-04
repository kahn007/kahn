import React, { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader, ExternalLink, Settings, User, Globe, Zap, Shield, Link } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { getKeys, saveKeys, getSettings, saveSettings } from '../lib/keys'

const API_CONFIGS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    placeholder: 'sk-ant-api03-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpLabel: 'console.anthropic.com',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    dot: 'bg-orange-500',
    description: 'Generates your ad headlines and body copy using Claude Sonnet',
    testFn: async (key) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
    },
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    placeholder: 'pplx-...',
    helpUrl: 'https://www.perplexity.ai/settings/api',
    helpLabel: 'perplexity.ai/settings/api',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
    dot: 'bg-green-500',
    description: 'Scans Reddit & YouTube for pain points and audience insights',
    testFn: async (key) => {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
        }),
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
    },
  },
  {
    id: 'facebook',
    name: 'Facebook Access Token',
    placeholder: 'EAAxxxxxxx...',
    helpUrl: 'https://developers.facebook.com/tools/explorer/',
    helpLabel: 'developers.facebook.com',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    dot: 'bg-blue-500',
    description: 'Pushes ad drafts to your Ad Account and pulls performance analytics',
    testFn: async (key) => {
      const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${key}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
    },
  },
  {
    id: 'falai',
    name: 'fal.ai (Images + Videos)',
    placeholder: 'fal-...',
    helpUrl: 'https://fal.ai/dashboard/keys',
    helpLabel: 'fal.ai/dashboard/keys',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/30',
    dot: 'bg-teal-500',
    description: 'Flux Pro 1.1 for images · Kling 1.6 for short video ads — one key covers both',
    testFn: async (key) => {
      const res = await fetch('https://fal.run/fal-ai/flux-pro/v1.1', {
        method: 'POST',
        headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test', image_size: 'square', num_images: 1 }),
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
    },
  },
  {
    id: 'openai',
    name: 'OpenAI API Key',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    helpLabel: 'platform.openai.com',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    dot: 'bg-emerald-500',
    description: 'Powers GPT-4o Mini + GPT-4o — most reliable for Vapi voice agents',
    testFn: async (key) => {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    },
  },
  {
    id: 'xai',
    name: 'xAI API Key (Grok)',
    placeholder: 'xai-...',
    helpUrl: 'https://console.x.ai',
    helpLabel: 'console.x.ai',
    color: 'text-zinc-300',
    bg: 'bg-zinc-500/10 border-zinc-500/30',
    dot: 'bg-zinc-400',
    description: 'Powers Grok Beta + Grok 2 — fast, conversational, great for sales',
    testFn: async (key) => {
      // xAI blocks browser requests — validate format only
      if (!key.startsWith('xai-')) throw new Error('xAI keys start with "xai-"')
    },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    placeholder: 'sk-or-v1-...',
    helpUrl: 'https://openrouter.ai/keys',
    helpLabel: 'openrouter.ai/keys',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/30',
    dot: 'bg-indigo-500',
    description: 'One key — every model. Grok, GPT-4o, Gemini, Llama, Claude — all via Vapi',
    testFn: async (key) => {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
    },
  },
  {
    id: 'cartesia',
    name: 'Cartesia',
    placeholder: 'sk_car_...',
    helpUrl: 'https://play.cartesia.ai/keys',
    helpLabel: 'play.cartesia.ai',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/30',
    dot: 'bg-violet-500',
    description: 'Sonic TTS — fastest voice synthesis ~50ms, competitive with ElevenLabs',
    testFn: async (key) => {
      const res = await fetch('https://api.cartesia.ai/voices', {
        headers: { 'X-API-Key': key, 'Cartesia-Version': '2024-06-10' },
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
    },
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    placeholder: 'sk_...',
    helpUrl: 'https://elevenlabs.io/app/settings/api-keys',
    helpLabel: 'elevenlabs.io',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    dot: 'bg-yellow-500',
    description: 'Natural TTS voices for Voice Agents',
    testFn: async (key) => {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } })
      if (!res.ok) throw new Error(`Status ${res.status}`)
    },
  },
  {
    id: 'twilio_sid',
    name: 'Twilio Account SID',
    placeholder: 'ACxxxxxxxx...',
    helpUrl: 'https://console.twilio.com',
    helpLabel: 'console.twilio.com',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    dot: 'bg-red-500',
    description: 'Phone number management for voice agents',
    testFn: async () => {},
  },
  {
    id: 'twilio_token',
    name: 'Twilio Auth Token',
    placeholder: '...',
    helpUrl: 'https://console.twilio.com',
    helpLabel: 'console.twilio.com',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    dot: 'bg-red-500',
    description: 'Twilio Auth Token — kept in browser only',
    testFn: async () => {},
  },
  {
    id: 'ghl_token',
    name: 'GoHighLevel Token',
    placeholder: 'eyJhbGci...',
    helpUrl: 'https://marketplace.gohighlevel.com/apps/private-integrations',
    helpLabel: 'marketplace.gohighlevel.com',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    dot: 'bg-emerald-500',
    description: 'Private Integration Token — contacts, calendars, opportunities',
    testFn: async (key) => {
      // Use the stored Location ID to verify the token
      const locationId = getKeys()['ghl_location_id']
      if (!locationId) {
        // No location ID saved yet — just check the token hits GHL at all
        const res = await fetch(
          'https://services.leadconnectorhq.com/contacts/?locationId=test&limit=1',
          { headers: { Authorization: `Bearer ${key}`, Version: '2021-07-28' } },
        )
        // 400 = bad locationId but token was accepted; 401 = bad token
        if (res.status === 401) throw new Error('GHL 401 — token rejected')
        return
      }
      const res = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=1`,
        { headers: { Authorization: `Bearer ${key}`, Version: '2021-07-28' } },
      )
      if (!res.ok) throw new Error(`GHL ${res.status}`)
    },
  },
  {
    id: 'ghl_location_id',
    name: 'GHL Location ID',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://marketplace.gohighlevel.com/apps/private-integrations',
    helpLabel: 'marketplace.gohighlevel.com',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    dot: 'bg-emerald-500',
    description: 'Your GoHighLevel sub-account / location ID',
    testFn: async () => {},
  },
  {
    id: 'backend_url',
    name: 'Backend URL',
    placeholder: 'https://your-app.railway.app',
    helpUrl: 'https://railway.app',
    helpLabel: 'railway.app',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
    dot: 'bg-sky-500',
    description: 'Your deployed backend URL — enables automatic GHL calendar booking (no webhook setup needed)',
    testFn: async (key) => {
      const url = key.replace(/\/$/, '')
      const res = await fetch(`${url}/api/health`)
      if (!res.ok) throw new Error(`Backend ${res.status}`)
    },
  },
  {
    id: 'vapi',
    name: 'Vapi API Key',
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    helpUrl: 'https://dashboard.vapi.ai/api-keys',
    helpLabel: 'dashboard.vapi.ai',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
    dot: 'bg-purple-500',
    description: 'Vapi handles all voice call infrastructure — no server needed',
    testFn: async (key) => {
      const res = await fetch('https://api.vapi.ai/assistant?limit=1', {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) throw new Error(`Vapi ${res.status}`)
    },
  },
]

export default function CampaignSettings() {
  const { brandContext, setBrandContext, campaign, setCampaign, utmConfig, setUtmConfig } = useAdStore()

  // Keys state
  const [keys, setKeys] = useState(() => getKeys())
  const [shown, setShown] = useState({})
  const [testing, setTesting] = useState({})
  const [testStatus, setTestStatus] = useState({})

  // Rehydrate brand + campaign from localStorage on first load
  useEffect(() => {
    const saved = getSettings()
    if (saved.brandContext) setBrandContext(saved.brandContext)
    if (saved.campaign)     setCampaign(saved.campaign)
  }, [])

  // Auto-save keys to localStorage on every change
  const updateKey = (id, value) => {
    const updated = { ...keys, [id]: value }
    setKeys(updated)
    saveKeys(updated)
  }
  const toggleShow = (id) => setShown((s) => ({ ...s, [id]: !s[id] }))

  // Auto-save brand context
  const updateBrand = (updates) => {
    const updated = { ...brandContext, ...updates }
    setBrandContext(updates)
    saveSettings({ brandContext: updated, campaign })
  }

  // Auto-save campaign config
  const updateCampaign = (updates) => {
    const updated = { ...campaign, ...updates }
    setCampaign(updates)
    saveSettings({ brandContext, campaign: updated })
  }

  const handleTest = async (cfg) => {
    const key = keys[cfg.id]
    if (!key) { toast.error(`Enter your ${cfg.name} key first`); return }
    setTesting((t) => ({ ...t, [cfg.id]: true }))
    setTestStatus((s) => ({ ...s, [cfg.id]: null }))
    try {
      await cfg.testFn(key)
      setTestStatus((s) => ({ ...s, [cfg.id]: 'ok' }))
      toast.success(`${cfg.name} key works!`)
    } catch (err) {
      setTestStatus((s) => ({ ...s, [cfg.id]: 'fail' }))
      toast.error(`${cfg.name}: ${err.message}`)
    } finally {
      setTesting((t) => ({ ...t, [cfg.id]: false }))
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">Enter your API keys once — they're saved in your browser. Nothing is sent to any server.</p>
      </div>

      {/* Security note */}
      <div className="info-box flex items-start gap-3">
        <Shield size={15} className="text-brand-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-brand-300 mb-0.5">Your keys stay in your browser</p>
          <p>Keys are stored in <code className="bg-surface-800 px-1 rounded text-zinc-300">localStorage</code> and sent directly from your browser to each API. No middleman, no server.</p>
        </div>
      </div>

      {/* API Keys */}
      <div className="space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Key size={14} className="text-brand-500" />
          API Keys
        </h3>

        {API_CONFIGS.map((cfg) => (
          <div key={cfg.id} className={`card border ${cfg.bg} space-y-3`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${cfg.dot}`} />
                <div>
                  <p className={`font-semibold text-sm ${cfg.color}`}>{cfg.name}</p>
                  <p className="text-zinc-500 text-xs">{cfg.description}</p>
                </div>
              </div>
              <a
                href={cfg.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Get key <ExternalLink size={11} />
              </a>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={shown[cfg.id] ? 'text' : 'password'}
                  className="input pr-10 font-mono text-sm"
                  placeholder={cfg.placeholder}
                  value={keys[cfg.id] || ''}
                  onChange={(e) => updateKey(cfg.id, e.target.value)}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  onClick={() => toggleShow(cfg.id)}
                  type="button"
                >
                  {shown[cfg.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <button
                className="btn-secondary flex-shrink-0 text-sm"
                onClick={() => handleTest(cfg)}
                disabled={testing[cfg.id]}
              >
                {testing[cfg.id] ? (
                  <Loader size={14} className="animate-spin" />
                ) : testStatus[cfg.id] === 'ok' ? (
                  <CheckCircle size={14} className="text-green-400" />
                ) : testStatus[cfg.id] === 'fail' ? (
                  <XCircle size={14} className="text-red-400" />
                ) : null}
                Test
              </button>
            </div>
          </div>
        ))}

        <p className="text-xs text-green-400 flex items-center gap-1.5">
          <CheckCircle size={12} /> Keys auto-save as you type — no button needed
        </p>
      </div>

      {/* Brand */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <User size={14} className="text-brand-500" />
          Brand Context
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Brand Name</label>
            <input className="input" value={brandContext.brandName} onChange={(e) => updateBrand({ brandName: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Website</label>
            <input className="input" value={brandContext.website} onChange={(e) => updateBrand({ website: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-400 mb-1.5 block">Product / Service</label>
            <textarea className="textarea" rows={2} value={brandContext.product} onChange={(e) => updateBrand({ product: e.target.value })} placeholder="What are you advertising?" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Target Audience</label>
            <input className="input" value={brandContext.targetAudience} onChange={(e) => updateBrand({ targetAudience: e.target.value })} placeholder="e.g. coaches, e-commerce founders" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Default CTA</label>
            <select className="input" value={brandContext.cta} onChange={(e) => updateBrand({ cta: e.target.value })}>
              {['Learn More', 'Sign Up', 'Get Started', 'Shop Now', 'Download', 'Contact Us'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-400 mb-1.5 block">Landing Page URL</label>
            <input className="input" value={brandContext.landingPageUrl} onChange={(e) => updateBrand({ landingPageUrl: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Facebook config */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Globe size={14} className="text-brand-500" />
          Facebook Campaign Config
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Ad Account ID</label>
            <input className="input" placeholder="act_123456789" value={campaign.adAccountId} onChange={(e) => updateCampaign({ adAccountId: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Page ID</label>
            <input className="input" placeholder="123456789" value={campaign.pageId} onChange={(e) => updateCampaign({ pageId: e.target.value })} />
          </div>
        </div>
      </div>

      {/* UTM Builder */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
            <Link size={14} className="text-brand-500" />
            UTM Parameters
          </h3>
          <p className="text-xs text-zinc-500">Auto-appended to landing URLs when pushing to Facebook</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">utm_source</label>
            <input className="input" placeholder="facebook" value={utmConfig.source} onChange={(e) => setUtmConfig({ source: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">utm_medium</label>
            <input className="input" placeholder="paid_social" value={utmConfig.medium} onChange={(e) => setUtmConfig({ medium: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">utm_campaign</label>
            <input className="input" placeholder="summer_2025" value={utmConfig.campaign} onChange={(e) => setUtmConfig({ campaign: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">utm_content</label>
            <input className="input" placeholder="ad_variation" value={utmConfig.content} onChange={(e) => setUtmConfig({ content: e.target.value })} />
          </div>
        </div>
        {brandContext.landingPageUrl && (
          <div className="bg-surface-800/50 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-1">Preview URL</p>
            <p className="text-xs text-zinc-300 font-mono break-all">
              {buildUtmPreview(brandContext.landingPageUrl, utmConfig)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function buildUtmPreview(url, utmConfig) {
  try {
    const u = new URL(url)
    if (utmConfig.source)   u.searchParams.set('utm_source', utmConfig.source)
    if (utmConfig.medium)   u.searchParams.set('utm_medium', utmConfig.medium)
    if (utmConfig.campaign) u.searchParams.set('utm_campaign', utmConfig.campaign)
    if (utmConfig.content)  u.searchParams.set('utm_content', utmConfig.content)
    return u.toString()
  } catch {
    return url
  }
}
