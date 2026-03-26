import React from 'react'
import { Settings, Key, Globe, User, Zap, ExternalLink } from 'lucide-react'
import { useAdStore } from '../store/adStore'
import toast from 'react-hot-toast'

export default function CampaignSettings() {
  const { brandContext, setBrandContext, campaign, setCampaign } = useAdStore()

  const handleSave = () => {
    toast.success('Settings saved to session')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-gray-400 mt-1">Configure your brand, campaign defaults, and API connections.</p>
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
            <label className="text-xs text-gray-400 mb-1.5 block">Product / Service Description</label>
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
            <input className="input" value={brandContext.landingPageUrl} onChange={(e) => setBrandContext({ landingPageUrl: e.target.value })} placeholder="https://www.brayneai.com" />
          </div>
        </div>
      </div>

      {/* Campaign defaults */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Globe size={14} className="text-brand-500" />
          Facebook Campaign Defaults
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 mb-1.5 block">Campaign Name</label>
            <input className="input" value={campaign.name} onChange={(e) => setCampaign({ name: e.target.value })} />
          </div>
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

      {/* API keys guide */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Key size={14} className="text-brand-500" />
          API Keys Setup
        </h3>
        <p className="text-gray-400 text-xs">
          API keys are stored server-side in <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">ad-generator/backend/.env</code>.
          Never commit your keys to git.
        </p>

        <div className="space-y-3">
          {[
            {
              name: 'Anthropic (Claude)',
              key: 'ANTHROPIC_API_KEY',
              url: 'https://console.anthropic.com/',
              desc: 'Powers bulk ad copy generation',
              color: 'text-orange-400',
            },
            {
              name: 'Perplexity',
              key: 'PERPLEXITY_API_KEY',
              url: 'https://www.perplexity.ai/settings/api',
              desc: 'Scans Reddit & YouTube for audience insights',
              color: 'text-green-400',
            },
            {
              name: 'Facebook Ads',
              key: 'FACEBOOK_ACCESS_TOKEN',
              url: 'https://developers.facebook.com/',
              desc: 'Push ad drafts + pull analytics',
              color: 'text-blue-400',
            },
          ].map(({ name, key, url, desc, color }) => (
            <div key={key} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-xl">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold text-sm ${color}`}>{name}</p>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
                    <ExternalLink size={12} />
                  </a>
                </div>
                <code className="text-xs text-gray-400 bg-gray-900 px-2 py-0.5 rounded mt-0.5 block w-fit">{key}=your_key_here</code>
                <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Railway */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Zap size={14} className="text-brand-500" />
          Deploy to Railway
        </h3>
        <p className="text-gray-400 text-xs">
          Railway hosts both your backend API and this React frontend. See <code>railway.json</code> in the project root.
        </p>
        <div className="bg-gray-800/50 rounded-xl p-3 font-mono text-xs text-green-400 space-y-1">
          <p># From ad-generator/backend/</p>
          <p>railway up</p>
          <p className="text-gray-500"># Railway auto-sets PORT + DATABASE_URL</p>
        </div>
      </div>

      <button className="btn-primary" onClick={handleSave}>
        <Settings size={14} />
        Save Settings
      </button>
    </div>
  )
}
