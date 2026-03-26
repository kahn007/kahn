import React, { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader, ExternalLink, Settings, User, Globe, Zap, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { getKeys, saveKeys } from '../lib/keys'

const API_CONFIGS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    placeholder: 'sk-ant-api03-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpLabel: 'console.anthropic.com',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    icon: '🤖',
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
    icon: '🔍',
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
    icon: '📘',
    description: 'Pushes ad drafts to your Ad Account and pulls performance analytics',
    testFn: async (key) => {
      const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${key}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
    },
  },
]

export default function CampaignSettings() {
  const { brandContext, setBrandContext, campaign, setCampaign } = useAdStore()

  // Keys state
  const [keys, setKeys] = useState(() => getKeys())
  const [shown, setShown] = useState({})
  const [testing, setTesting] = useState({})
  const [testStatus, setTestStatus] = useState({})

  const updateKey = (id, value) => setKeys((k) => ({ ...k, [id]: value }))
  const toggleShow = (id) => setShown((s) => ({ ...s, [id]: !s[id] }))

  const handleSaveKeys = () => {
    saveKeys(keys)
    toast.success('API keys saved to browser storage')
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
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-gray-400 mt-1">Enter your API keys once — they're saved in your browser. Nothing is sent to any server.</p>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 bg-brand-500/5 border border-brand-500/20 rounded-2xl">
        <Shield size={16} className="text-brand-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-brand-300 font-semibold">Your keys stay in your browser</p>
          <p className="text-gray-400 mt-0.5">Keys are stored in <code className="bg-gray-800 px-1 rounded text-gray-300">localStorage</code> and sent directly from your browser to each API. No middleman, no server.</p>
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
              <div className="flex items-center gap-2">
                <span className="text-lg">{cfg.icon}</span>
                <div>
                  <p className={`font-semibold text-sm ${cfg.color}`}>{cfg.name}</p>
                  <p className="text-gray-500 text-xs">{cfg.description}</p>
                </div>
              </div>
              <a
                href={cfg.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
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

        <button className="btn-primary" onClick={handleSaveKeys}>
          <Key size={14} />
          Save All Keys
        </button>
      </div>

      {/* Brand */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <User size={14} className="text-brand-500" />
          Brand Context
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Brand Name</label>
            <input className="input" value={brandContext.brandName} onChange={(e) => setBrandContext({ brandName: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Website</label>
            <input className="input" value={brandContext.website} onChange={(e) => setBrandContext({ website: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-400 mb-1.5 block">Product / Service</label>
            <textarea className="textarea" rows={2} value={brandContext.product} onChange={(e) => setBrandContext({ product: e.target.value })} placeholder="What are you advertising?" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Target Audience</label>
            <input className="input" value={brandContext.targetAudience} onChange={(e) => setBrandContext({ targetAudience: e.target.value })} placeholder="e.g. coaches, e-commerce founders" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Default CTA</label>
            <select className="input" value={brandContext.cta} onChange={(e) => setBrandContext({ cta: e.target.value })}>
              {['Learn More', 'Sign Up', 'Get Started', 'Shop Now', 'Download', 'Contact Us'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-400 mb-1.5 block">Landing Page URL</label>
            <input className="input" value={brandContext.landingPageUrl} onChange={(e) => setBrandContext({ landingPageUrl: e.target.value })} />
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
            <label className="text-xs text-gray-400 mb-1.5 block">Ad Account ID</label>
            <input className="input" placeholder="act_123456789" value={campaign.adAccountId} onChange={(e) => setCampaign({ adAccountId: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Page ID</label>
            <input className="input" placeholder="123456789" value={campaign.pageId} onChange={(e) => setCampaign({ pageId: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  )
}
