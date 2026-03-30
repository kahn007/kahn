import React, { useState } from 'react'
import {
  Zap, Search, Wand2, LayoutGrid, Upload, BarChart3,
  Settings, Globe, ExternalLink, ChevronRight, X,
  Key, Sparkles, ArrowRight, Layers, Mail,
} from 'lucide-react'
import { useAdStore } from './store/adStore'
import { getKey } from './lib/keys'
import ResearchPanel from './components/ResearchPanel'
import CopyGenerator from './components/CopyGenerator'
import VariationManager from './components/VariationManager'
import FacebookUploader from './components/FacebookUploader'
import TrackingDashboard from './components/TrackingDashboard'
import CampaignSettings from './components/CampaignSettings'
import LandingPageGenerator from './components/LandingPageGenerator'
import MultiPlatform from './components/MultiPlatform'
import EmailFlows from './components/EmailFlows'

const NAV_GROUPS = [
  {
    label: 'Research',
    items: [
      { id: 'research',  label: 'Audience',      icon: Search,    hint: 'Pain points & competitors' },
    ],
  },
  {
    label: 'Create',
    items: [
      { id: 'generate',  label: 'Ad Copy',        icon: Wand2,     hint: 'AI ad variations' },
      { id: 'variations',label: 'Variations',     icon: LayoutGrid,hint: 'Manage & score' },
      { id: 'multi',     label: 'Multi-Platform', icon: Layers,    hint: 'Google, TikTok, LinkedIn…' },
      { id: 'email',     label: 'Email Flows',    icon: Mail,      hint: 'Welcome, nurture, sales' },
      { id: 'landing',   label: 'Landing Pages',  icon: Globe,     hint: 'Generate funnels' },
    ],
  },
  {
    label: 'Publish',
    items: [
      { id: 'upload',    label: 'Push to FB',     icon: Upload,    hint: 'Publish drafts' },
      { id: 'dashboard', label: 'Dashboard',      icon: BarChart3, hint: 'Analytics' },
    ],
  },
]

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items)

// ── Onboarding modal ──────────────────────────────────────────
function OnboardingModal({ onDismiss }) {
  const STEPS = [
    {
      icon: Key,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
      title: 'Add your API keys',
      body: 'Go to Settings and paste your Anthropic key (required). Add Perplexity for research and fal.ai for image/video generation.',
    },
    {
      icon: Search,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      title: 'Research your audience',
      body: 'Enter your product and target audience. Perplexity scans Reddit and YouTube to surface real pain points and trigger phrases.',
    },
    {
      icon: Wand2,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      title: 'Generate across platforms',
      body: 'Claude writes Facebook ad variations. Then adapt them to Google, TikTok, LinkedIn, and Twitter in one click. Generate email sequences from the same research.',
    },
    {
      icon: Sparkles,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10',
      title: 'Add creatives and publish',
      body: 'Generate AI images or videos per variation using fal.ai, build a landing page, then push ad drafts to your Facebook Ad Account.',
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-surface-900 border border-white/[0.08] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center glow-brand">
                <Zap size={14} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Welcome to Brayne AI</p>
                <p className="text-zinc-500 text-xs">Full-stack marketing suite</p>
              </div>
            </div>
            <button onClick={onDismiss} className="text-zinc-500 hover:text-white transition-colors p-1">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {STEPS.map(({ icon: Icon, color, bg, title, body }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={14} className={color} />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-snug">
                  <span className="text-zinc-600 mr-1.5 font-normal">0{i + 1}.</span>
                  {title}
                </p>
                <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button className="btn-primary flex-1" onClick={onDismiss}>
            Get Started <ArrowRight size={14} />
          </button>
          <button className="btn-ghost text-sm" onClick={onDismiss}>Skip</button>
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const { activeTab, setActiveTab, variations, hasOnboarded, setHasOnboarded } = useAdStore()
  const [collapsed, setCollapsed] = useState(false)

  const noKeysConfigured = !getKey('anthropic') && !getKey('perplexity') && !getKey('falai')
  const showOnboarding = !hasOnboarded && noKeysConfigured

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {showOnboarding && <OnboardingModal onDismiss={() => setHasOnboarded(true)} />}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className="fixed top-0 left-0 bottom-0 z-50 flex flex-col border-r border-white/[0.06] bg-surface-950 transition-all duration-200"
        style={{ width: collapsed ? 56 : 224 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-3.5 h-[56px] border-b border-white/[0.06] flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0 glow-brand">
            <Zap size={13} className="text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white leading-none tracking-tight">Brayne AI</p>
              <p className="text-[10px] text-zinc-600 leading-none mt-0.5 tracking-wide">Marketing Suite</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-3 overflow-y-auto">
          {NAV_GROUPS.map(({ label, items }) => (
            <div key={label}>
              {!collapsed && (
                <p className="section-title px-3 pt-1 pb-1">{label}</p>
              )}
              <div className="space-y-px">
                {items.map(({ id, label: itemLabel, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    title={collapsed ? itemLabel : undefined}
                    className={`nav-item relative ${activeTab === id ? 'nav-active' : 'nav-inactive'} ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon size={15} className="flex-shrink-0" strokeWidth={activeTab === id ? 2.2 : 1.8} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{itemLabel}</span>
                        {id === 'variations' && variations.length > 0 && (
                          <span className="text-[10px] font-bold bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded-md leading-none flex-shrink-0">
                            {variations.length}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && id === 'variations' && variations.length > 0 && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/[0.06] space-y-px flex-shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            title={collapsed ? 'Settings' : undefined}
            className={`nav-item ${activeTab === 'settings' ? 'nav-active' : 'nav-inactive'} ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <Settings size={15} className="flex-shrink-0" strokeWidth={1.8} />
            {!collapsed && <span className="flex-1 truncate">Settings</span>}
          </button>

          {!collapsed && (
            <a
              href="https://www.brayneai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item nav-inactive"
            >
              <ExternalLink size={14} className="flex-shrink-0" strokeWidth={1.8} />
              <span className="flex-1 truncate text-xs">brayneai.com</span>
            </a>
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            className={`nav-item nav-inactive mt-1 ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronRight
              size={14}
              className="flex-shrink-0 transition-transform duration-200"
              style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
              strokeWidth={2}
            />
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-200"
        style={{ marginLeft: collapsed ? 56 : 224 }}
      >
        {/* Top bar */}
        <header className="h-[56px] border-b border-white/[0.06] bg-surface-950/80 backdrop-blur-md sticky top-0 z-40 flex items-center px-6 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white tracking-tight leading-none">
              {[...ALL_NAV, { id: 'settings', label: 'Settings' }].find((t) => t.id === activeTab)?.label}
            </p>
            <p className="text-xs text-zinc-600 leading-none mt-0.5">
              {ALL_NAV.find((t) => t.id === activeTab)?.hint ?? 'Configuration & API keys'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="dot-green" />
            <span className="text-[11px] font-medium text-emerald-400">Live</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-6 py-7 max-w-6xl w-full mx-auto">
          {activeTab === 'research'   && <ResearchPanel />}
          {activeTab === 'generate'   && <CopyGenerator />}
          {activeTab === 'variations' && <VariationManager />}
          {activeTab === 'multi'      && <MultiPlatform />}
          {activeTab === 'email'      && <EmailFlows />}
          {activeTab === 'landing'    && <LandingPageGenerator />}
          {activeTab === 'upload'     && <FacebookUploader />}
          {activeTab === 'dashboard'  && <TrackingDashboard />}
          {activeTab === 'settings'   && <CampaignSettings />}
        </main>
      </div>
    </div>
  )
}
