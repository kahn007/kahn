import React, { useState, useRef } from 'react'
import {
  Globe, Wand2, RefreshCw, Copy, Download, ChevronDown, LayoutTemplate,
  Upload, X, Palette, Link, ExternalLink, Monitor, Smartphone, Trash2,
  Clock, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { useAdStore } from '../store/adStore'
import { generateLandingPage } from '../lib/api'

const THEMES = [
  // ── Black base ──────────────────────────────────────────────────
  { id: 'noir',     label: 'Noir / Gold',      bg: '#0A0A0A', surface: '#111111', bg3: '#1A1A1A', accent: '#C9A84C', accent2: '#E8C96A', text: '#F5F5F5', muted: '#888888', preview: '#C9A84C', serif: true },
  { id: 'onyx',     label: 'Onyx / Blue',      bg: '#06080F', surface: '#0D1220', bg3: '#131B2E', accent: '#3B82F6', accent2: '#60A5FA', text: '#F1F5FF', muted: '#8B98A8', preview: '#3B82F6' },
  { id: 'carbon',   label: 'Carbon / Teal',    bg: '#080808', surface: '#0F0F0F', bg3: '#171717', accent: '#0D9488', accent2: '#14B8A6', text: '#F5FAFA', muted: '#7A8A8A', preview: '#0D9488' },
  { id: 'obsidian', label: 'Obsidian / Rose',  bg: '#0A0607', surface: '#120A0E', bg3: '#1B1017', accent: '#D97076', accent2: '#F09BA0', text: '#FDF5F6', muted: '#8A7A7E', preview: '#D97076' },
  // ── White / Light base ──────────────────────────────────────────
  { id: 'ivory',    label: 'Ivory / Gold',     bg: '#FEFCF6', surface: '#F7F2E4', bg3: '#EDE5CC', accent: '#B8930A', accent2: '#D4A812', text: '#111111', muted: '#6B6050', preview: '#B8930A', light: true, serif: true },
  { id: 'paper',    label: 'Paper / Black',    bg: '#FAFAFA', surface: '#F2F2F2', bg3: '#E8E8E8', accent: '#111111', accent2: '#333333', text: '#0A0A0A', muted: '#666666', preview: '#111111', light: true },
  { id: 'cloud',    label: 'Cloud / Sapphire', bg: '#FFFFFF', surface: '#F5F8FF', bg3: '#EAF0FF', accent: '#1D4ED8', accent2: '#2563EB', text: '#0F172A', muted: '#5A6A8A', preview: '#1D4ED8', light: true },
  { id: 'linen',    label: 'Linen / Emerald',  bg: '#FAFDF8', surface: '#F0F7EC', bg3: '#E2EDDB', accent: '#1A6B3C', accent2: '#22854A', text: '#0D1F0D', muted: '#4A6B4A', preview: '#1A6B3C', light: true },
]

const LOADING_MESSAGES = [
  'Researching your audience…',
  'Crafting the hero section…',
  'Writing pain point copy…',
  'Building feature cards…',
  'Generating testimonials…',
  'Building comparison table…',
  'Writing FAQ answers…',
  'Polishing the CTA section…',
  'Applying design system…',
  'Almost done…',
]

export default function LandingPageGenerator() {
  const {
    variations, brandContext, researchSessions, activeResearchId, competitorSwipeFile,
    landingPageConfig, setLandingPageConfig,
    savedPages, savePage, deleteSavedPage,
  } = useAdStore()
  const activeSession = researchSessions.find((r) => r.id === activeResearchId)
  const insights = activeSession?.insights || null

  const [selectedId, setSelectedId] = useState(variations[0]?.id || '')
  const [html, setHtml] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [loadingPct, setLoadingPct] = useState(0)
  const [previewMode, setPreviewMode] = useState('preview')
  const [previewWidth, setPreviewWidth] = useState('desktop')
  const [showHistory, setShowHistory] = useState(false)
  const [logoInputMode, setLogoInputMode] = useState('url')
  const [logoUrl, setLogoUrl] = useState('')

  // All config persisted in Zustand
  const themeId        = landingPageConfig.themeId        || 'dark_pro'
  const accentOverride = landingPageConfig.accentOverride || ''
  const logoSrc        = landingPageConfig.logoSrc        || ''
  const companyName    = landingPageConfig.companyName    || ''
  const tagline        = landingPageConfig.tagline        || ''
  const ctaUrl         = landingPageConfig.ctaUrl         || ''
  const trustMetric    = landingPageConfig.trustMetric    || ''

  const setThemeId        = (v) => setLandingPageConfig({ themeId: v })
  const setAccentOverride = (v) => setLandingPageConfig({ accentOverride: v })
  const setLogoSrc        = (v) => setLandingPageConfig({ logoSrc: v })
  const setCompanyName    = (v) => setLandingPageConfig({ companyName: v })
  const setTagline        = (v) => setLandingPageConfig({ tagline: v })
  const setCtaUrl         = (v) => setLandingPageConfig({ ctaUrl: v })
  const setTrustMetric    = (v) => setLandingPageConfig({ trustMetric: v })

  const fileInputRef = useRef(null)
  const selectedVariation = variations.find((v) => v.id === selectedId)
  const selectedTheme = THEMES.find((t) => t.id === themeId) || THEMES[0]
  const effectiveAccent = accentOverride || selectedTheme.accent

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogoSrc(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleLogoUrlApply = () => {
    if (logoUrl.trim()) { setLogoSrc(logoUrl.trim()); setLogoUrl('') }
  }

  const buildPageConfig = () => ({
    themeId,
    bg:        selectedTheme.bg,
    surface:   selectedTheme.surface,
    bg3:       selectedTheme.bg3,
    accent:    effectiveAccent,
    accent2:   selectedTheme.accent2,
    textColor: selectedTheme.text,
    mutedColor: selectedTheme.muted,
    light:     selectedTheme.light || false,
    serif:     selectedTheme.serif || false,
    logoSrc:   logoSrc || null,
    companyName: companyName || brandContext.brandName || '',
    tagline,
    ctaUrl:    ctaUrl || brandContext.landingPageUrl || '',
    trustMetric: trustMetric || '2,400+ customers',
  })

  const handleGenerate = async () => {
    if (!selectedVariation) { toast.error('Select an ad variation first'); return }
    const pc = buildPageConfig()
    if (!pc.ctaUrl || pc.ctaUrl === '#') {
      toast.error('Add a CTA URL in Page Settings first')
      return
    }

    setIsGenerating(true)
    setHtml('')
    setLoadingPct(0)
    setLoadingMsg(LOADING_MESSAGES[0])

    let msgIdx = 0
    const msgInterval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MESSAGES.length - 1)
      setLoadingMsg(LOADING_MESSAGES[msgIdx])
      setLoadingPct(Math.round((msgIdx / (LOADING_MESSAGES.length - 1)) * 90))
    }, 4500)

    try {
      const result = await generateLandingPage({
        variation: selectedVariation,
        brandContext,
        insights,
        competitorIntel: competitorSwipeFile || null,
        pageConfig: pc,
      })
      setHtml(result)
      setLoadingPct(100)

      // Auto-save to history
      savePage({
        id: uuidv4(),
        headline: selectedVariation.headline?.substring(0, 60) || 'Landing Page',
        themeId,
        themeLabel: selectedTheme.label,
        html: result,
        createdAt: new Date().toISOString(),
      })
      toast.success('Landing page generated!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      clearInterval(msgInterval)
      setIsGenerating(false)
      setLoadingMsg('')
    }
  }

  const handleOpenNewTab = () => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `landing-page-${(selectedVariation?.headline || 'page').replace(/[^a-z0-9]/gi, '-').substring(0, 30)}.html`
    a.click()
    toast.success('Downloaded!')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(html)
    toast.success('HTML copied!')
  }

  const loadFromHistory = (page) => {
    setHtml(page.html)
    setThemeId(page.themeId)
    setPreviewMode('preview')
    toast.success('Loaded from history')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Landing Page Generator</h2>
        <p className="text-gray-400 mt-1">
          AI-built, agency-quality landing pages in ~60 seconds. Choose a theme, configure, and generate.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left config panel ─────────────────────────────── */}
        <div className="space-y-4">

          {/* Ad variation */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <LayoutTemplate size={14} className="text-brand-500" />
              Ad Variation
            </h3>
            {variations.length === 0 ? (
              <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-3 text-xs text-yellow-400">
                Generate ad copy first, then come back here.
              </div>
            ) : (
              <div className="relative">
                <select className="input pr-8 text-sm" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {variations.map((v) => (
                    <option key={v.id} value={v.id}>#{v.index} — {v.headline?.substring(0, 42)}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
            {selectedVariation && (
              <div className="bg-gray-800/50 rounded-xl p-3 space-y-1">
                <p className="text-white text-xs font-semibold line-clamp-2">{selectedVariation.headline}</p>
                <div className="flex items-center gap-2">
                  <span className="badge bg-gray-700 text-gray-300 text-xs">{selectedVariation.angle?.replace('_', ' ')}</span>
                  {selectedVariation.targetSegment && (
                    <span className="text-teal-400/70 text-xs truncate">→ {selectedVariation.targetSegment}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Palette size={14} className="text-brand-500" />
              Theme
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setThemeId(t.id); setAccentOverride('') }}
                  title={t.label}
                  className={`relative rounded-xl overflow-hidden h-14 border-2 transition-all ${
                    themeId === t.id ? 'border-brand-500 scale-105 shadow-lg shadow-brand-500/20' : 'border-transparent hover:border-gray-600'
                  }`}
                  style={{ background: t.bg }}
                >
                  <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: t.preview }} />
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full" style={{ background: t.preview }} />
                  {themeId === t.id && (
                    <div className="absolute inset-0 ring-2 ring-inset ring-brand-500/50 rounded-xl" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium">{selectedTheme.label}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Accent:</span>
                <input
                  type="color"
                  value={effectiveAccent}
                  onChange={(e) => setAccentOverride(e.target.value)}
                  className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Override accent colour"
                />
                {accentOverride && (
                  <button onClick={() => setAccentOverride('')} className="text-xs text-gray-500 hover:text-white">
                    reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Upload size={14} className="text-brand-500" />
              Logo
            </h3>
            <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
              {['url', 'file'].map((mode) => (
                <button key={mode} onClick={() => setLogoInputMode(mode)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${logoInputMode === mode ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {mode === 'url' ? 'Paste URL' : 'Upload File'}
                </button>
              ))}
            </div>
            {logoInputMode === 'url' ? (
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="https://yoursite.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogoUrlApply()}
                />
                <button className="btn-secondary flex-shrink-0 text-xs px-3" onClick={handleLogoUrlApply}>Use</button>
              </div>
            ) : (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                <button className="btn-secondary w-full text-sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={13} /> Choose image file
                </button>
              </>
            )}
            {logoSrc && (
              <div className="relative bg-gray-800/50 rounded-xl p-3 flex items-center justify-center min-h-[60px]">
                <img src={logoSrc} alt="logo" className="max-h-10 max-w-full object-contain" />
                <button onClick={() => { setLogoSrc(''); setLogoUrl('') }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-gray-700 hover:bg-red-900/60 transition-colors">
                  <X size={11} className="text-gray-300" />
                </button>
              </div>
            )}
          </div>

          {/* Page settings */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Link size={14} className="text-brand-500" />
              Page Settings
            </h3>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">CTA URL <span className="text-red-400">*</span></label>
              <input className="input text-sm" placeholder="https://yoursite.com/signup" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
              <p className="text-xs text-gray-600 mt-1">All buttons link here</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Company Name</label>
              <input className="input text-sm" placeholder={brandContext.brandName || 'Your Company'} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Tagline</label>
              <input className="input text-sm" placeholder="The fastest way to…" value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Social Proof Metric</label>
              <input className="input text-sm" placeholder="2,400+ businesses trust us" value={trustMetric} onChange={(e) => setTrustMetric(e.target.value)} />
            </div>
          </div>

          {/* Intel badges */}
          <div className="space-y-1.5">
            {insights && (
              <p className="text-xs text-green-400 flex items-center gap-1.5 px-1"><span>✓</span> Audience research will address objections</p>
            )}
            {competitorSwipeFile && (
              <p className="text-xs text-orange-400 flex items-center gap-1.5 px-1"><span>✓</span> Competitor intel will sharpen positioning</p>
            )}
          </div>

          {/* Generate */}
          <button className="btn-primary w-full text-base py-3" onClick={handleGenerate} disabled={isGenerating || !selectedVariation}>
            {isGenerating
              ? <><RefreshCw size={15} className="animate-spin" /> Generating…</>
              : <><Wand2 size={16} /> Generate Landing Page</>}
          </button>

          {isGenerating && (
            <div className="space-y-2">
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-700" style={{ width: `${loadingPct}%` }} />
              </div>
              <p className="text-xs text-gray-400 text-center">{loadingMsg}</p>
            </div>
          )}

          {/* History */}
          {savedPages.length > 0 && (
            <div className="card space-y-2">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setShowHistory((v) => !v)}
              >
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Clock size={13} className="text-gray-500" />
                  History ({savedPages.length})
                </h3>
                <ChevronRight size={14} className={`text-gray-500 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
              </button>
              {showHistory && (
                <div className="space-y-2 pt-1">
                  {savedPages.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-800/50 rounded-xl p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium truncate">{p.headline}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{p.themeLabel} · {new Date(p.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => loadFromHistory(p)} className="text-xs text-brand-400 hover:text-brand-300 font-medium flex-shrink-0">Load</button>
                      <button onClick={() => deleteSavedPage(p.id)} className="text-gray-600 hover:text-red-400 flex-shrink-0">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right preview panel ───────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          {html ? (
            <>
              {/* Controls bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
                  {['preview', 'code'].map((m) => (
                    <button key={m} onClick={() => setPreviewMode(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${previewMode === m ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                      {m === 'code' ? 'HTML Code' : 'Preview'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {previewMode === 'preview' && (
                    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
                      <button onClick={() => setPreviewWidth('desktop')} title="Desktop"
                        className={`p-1.5 rounded-lg transition-all ${previewWidth === 'desktop' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                        <Monitor size={13} />
                      </button>
                      <button onClick={() => setPreviewWidth('mobile')} title="Mobile (375px)"
                        className={`p-1.5 rounded-lg transition-all ${previewWidth === 'mobile' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                        <Smartphone size={13} />
                      </button>
                    </div>
                  )}
                  <button onClick={handleOpenNewTab} title="Open in new tab"
                    className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all">
                    <ExternalLink size={13} />
                  </button>
                  <button onClick={handleCopy} className="btn-secondary text-xs py-1.5 px-3">
                    <Copy size={12} /> Copy
                  </button>
                  <button onClick={handleDownload} className="btn-secondary text-xs py-1.5 px-3">
                    <Download size={12} /> .html
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600">{html.length.toLocaleString()} characters</p>

              {previewMode === 'preview' ? (
                <div className={`rounded-2xl overflow-hidden border border-gray-800 bg-gray-950 transition-all ${previewWidth === 'mobile' ? 'flex justify-center' : ''}`} style={{ height: '740px' }}>
                  {previewWidth === 'mobile' ? (
                    <div className="relative h-full flex flex-col items-center justify-start pt-3">
                      <div className="w-[375px] h-full rounded-2xl overflow-hidden border-2 border-gray-700 relative">
                        <iframe srcDoc={html} className="w-full h-full" title="Mobile preview" sandbox="allow-same-origin allow-scripts" />
                      </div>
                    </div>
                  ) : (
                    <iframe srcDoc={html} className="w-full h-full" title="Desktop preview" sandbox="allow-same-origin allow-scripts" />
                  )}
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-950" style={{ height: '740px' }}>
                  <pre className="text-xs text-gray-300 p-4 overflow-auto h-full leading-relaxed font-mono whitespace-pre-wrap">{html}</pre>
                </div>
              )}
            </>
          ) : (
            /* ── Empty state — theme preview mockup ─── */
            <div className="h-full min-h-[560px] flex flex-col gap-4">
              <div className="rounded-2xl overflow-hidden border border-gray-800 flex-1" style={{ background: selectedTheme.bg, minHeight: '420px' }}>
                {/* Mock nav */}
                <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', background: selectedTheme.surface }}>
                  <div className="flex items-center gap-2.5">
                    {logoSrc
                      ? <img src={logoSrc} alt="logo" className="h-7 object-contain" />
                      : <div className="w-7 h-7 rounded-lg" style={{ background: effectiveAccent }} />}
                    <span className="font-bold text-sm" style={{ color: selectedTheme.text }}>{companyName || brandContext.brandName || 'Your Brand'}</span>
                  </div>
                  <div className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: effectiveAccent, color: '#fff' }}>
                    {selectedVariation?.cta || 'Get Started'}
                  </div>
                </div>

                {/* Mock hero */}
                <div className="relative flex flex-col items-center text-center px-8 py-12 space-y-4 overflow-hidden">
                  {/* Background glow */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: effectiveAccent + '25' }} />

                  <div className="text-xs font-semibold px-3 py-1 rounded-full border relative z-10" style={{ color: effectiveAccent, borderColor: effectiveAccent + '50', background: effectiveAccent + '15' }}>
                    {selectedTheme.label} Theme
                  </div>
                  <p className="text-xl font-black leading-tight relative z-10 max-w-md" style={{ color: selectedTheme.text }}>
                    {selectedVariation?.headline || 'Your ad headline will appear here'}
                  </p>
                  {tagline && <p className="text-sm relative z-10" style={{ color: selectedTheme.text + '99' }}>{tagline}</p>}
                  <div className="flex gap-3 pt-1 relative z-10">
                    <div className="text-xs font-semibold px-4 py-2 rounded-xl" style={{ background: `linear-gradient(135deg, ${effectiveAccent}, ${selectedTheme.accent2})`, color: '#fff' }}>
                      {selectedVariation?.cta || 'Get Started'}
                    </div>
                    <div className="text-xs font-semibold px-4 py-2 rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.18)', color: selectedTheme.text }}>
                      See how it works →
                    </div>
                  </div>
                  <p className="text-xs relative z-10" style={{ color: selectedTheme.text + '55' }}>
                    {trustMetric || '2,400+ customers trust us'}
                  </p>
                </div>

                {/* Mock stats bar */}
                <div className="flex justify-around px-8 py-4 border-t border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: selectedTheme.surface + 'bb' }}>
                  {['3x ROI', '47% CTR', '8h Saved', '2,400+'].map((s) => (
                    <div key={s} className="text-center">
                      <p className="text-sm font-black" style={{ color: effectiveAccent }}>{s.split(' ')[0]}</p>
                      <p className="text-xs" style={{ color: selectedTheme.text + '60' }}>{s.split(' ').slice(1).join(' ')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <Globe size={28} className="text-gray-700 mx-auto mb-2" />
                <p className="text-gray-400 text-sm font-medium">Configure above and click Generate</p>
                <p className="text-gray-600 text-xs mt-1">12-section agency page · ~60 seconds</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
