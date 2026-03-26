import React, { useState, useRef } from 'react'
import { Globe, Wand2, RefreshCw, Copy, Download, ChevronDown, LayoutTemplate, Upload, X, Palette, Link } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { generateLandingPage } from '../lib/api'

const THEMES = [
  { id: 'dark_pro',    label: 'Dark Pro',      bg: '#080c14', surface: '#0d1422', accent: '#6c63ff', accent2: '#8b5cf6', text: '#f1f5f9', preview: '#6c63ff' },
  { id: 'midnight',    label: 'Midnight Blue',  bg: '#060d1f', surface: '#0b1530', accent: '#3b82f6', accent2: '#6366f1', text: '#e2e8f0', preview: '#3b82f6' },
  { id: 'forest',      label: 'Forest',         bg: '#040d0a', surface: '#071510', accent: '#10b981', accent2: '#059669', text: '#ecfdf5', preview: '#10b981' },
  { id: 'amber',       label: 'Amber Fire',     bg: '#0c0800', surface: '#150f00', accent: '#f59e0b', accent2: '#d97706', text: '#fffbeb', preview: '#f59e0b' },
  { id: 'crimson',     label: 'Crimson',        bg: '#0f0507', surface: '#180609', accent: '#ef4444', accent2: '#dc2626', text: '#fef2f2', preview: '#ef4444' },
  { id: 'rose_gold',   label: 'Rose Gold',      bg: '#0f0810', surface: '#160d18', accent: '#ec4899', accent2: '#db2777', text: '#fdf2f8', preview: '#ec4899' },
  { id: 'cyber',       label: 'Cyber',          bg: '#02050f', surface: '#060b1a', accent: '#22d3ee', accent2: '#06b6d4', text: '#ecfeff', preview: '#22d3ee' },
  { id: 'light_clean', label: 'Light Clean',    bg: '#ffffff', surface: '#f8fafc', accent: '#6c63ff', accent2: '#8b5cf6', text: '#0f172a', preview: '#6c63ff', light: true },
]

const LOADING_MESSAGES = [
  'Writing hero section…',
  'Crafting pain point cards…',
  'Building feature grid…',
  'Writing testimonials…',
  'Building comparison table…',
  'Building FAQ accordion…',
  'Polishing final CTA…',
  'Adding animations and CSS…',
  'Almost there…',
]

export default function LandingPageGenerator() {
  const {
    variations, brandContext, researchSessions, activeResearchId, competitorSwipeFile,
    landingPageConfig, setLandingPageConfig,
  } = useAdStore()
  const activeSession = researchSessions.find((r) => r.id === activeResearchId)
  const insights = activeSession?.insights || null

  const [selectedId, setSelectedId] = useState(variations[0]?.id || '')
  const [html, setHtml] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [previewMode, setPreviewMode] = useState('preview')
  const [logoInputMode, setLogoInputMode] = useState('url')
  const [logoUrl, setLogoUrl] = useState('')

  // All config is stored in Zustand so it persists across sessions
  const themeId       = landingPageConfig.themeId       || 'dark_pro'
  const accentOverride = landingPageConfig.accentOverride || ''
  const logoSrc       = landingPageConfig.logoSrc       || ''
  const companyName   = landingPageConfig.companyName   || ''
  const tagline       = landingPageConfig.tagline       || ''
  const ctaUrl        = landingPageConfig.ctaUrl        || ''
  const trustMetric   = landingPageConfig.trustMetric   || ''

  const setThemeId       = (v) => setLandingPageConfig({ themeId: v })
  const setAccentOverride = (v) => setLandingPageConfig({ accentOverride: v })
  const setLogoSrc       = (v) => setLandingPageConfig({ logoSrc: v })
  const setCompanyName   = (v) => setLandingPageConfig({ companyName: v })
  const setTagline       = (v) => setLandingPageConfig({ tagline: v })
  const setCtaUrl        = (v) => setLandingPageConfig({ ctaUrl: v })
  const setTrustMetric   = (v) => setLandingPageConfig({ trustMetric: v })

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
    if (logoUrl.trim()) setLogoSrc(logoUrl.trim())
  }

  const pageConfig = {
    themeId,
    bg: selectedTheme.bg,
    surface: selectedTheme.surface,
    accent: effectiveAccent,
    accent2: selectedTheme.accent2,
    textColor: selectedTheme.text,
    light: selectedTheme.light || false,
    logoSrc: logoSrc || null,
    companyName: companyName || brandContext.brandName || '',
    tagline: tagline || '',
    ctaUrl: ctaUrl || brandContext.landingPageUrl || '#',
    trustMetric: trustMetric || '2,400+ customers',
  }

  const handleGenerate = async () => {
    if (!selectedVariation) { toast.error('Select an ad variation first'); return }
    if (!pageConfig.ctaUrl || pageConfig.ctaUrl === '#') {
      toast.error('Add a CTA URL — where should buttons link to?')
      return
    }
    setIsGenerating(true)
    setHtml('')
    setLoadingMsg(LOADING_MESSAGES[0])

    let msgIdx = 0
    const msgInterval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MESSAGES.length - 1)
      setLoadingMsg(LOADING_MESSAGES[msgIdx])
    }, 5000)

    try {
      const result = await generateLandingPage({
        variation: selectedVariation,
        brandContext,
        insights,
        competitorIntel: competitorSwipeFile || null,
        pageConfig,
      })
      setHtml(result)
      toast.success('Landing page generated!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      clearInterval(msgInterval)
      setIsGenerating(false)
      setLoadingMsg('')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(html)
    toast.success('HTML copied to clipboard!')
  }

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `landing-page-${(selectedVariation?.headline || 'ad').replace(/[^a-z0-9]/gi, '-').substring(0, 30)}.html`
    a.click()
    toast.success('Downloaded!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Landing Page Generator</h2>
        <p className="text-gray-400 mt-1">
          Build a complete, professional landing page that matches your ad copy. Choose a theme, add your logo, and generate.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left config panel */}
        <div className="space-y-4">

          {/* Ad variation picker */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <LayoutTemplate size={14} className="text-brand-500" />
              Ad Variation
            </h3>

            {variations.length === 0 ? (
              <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-3 text-xs text-yellow-400">
                No variations yet — generate ad copy first, then come back here.
              </div>
            ) : (
              <div>
                <div className="relative">
                  <select
                    className="input pr-8 text-sm"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {variations.map((v) => (
                      <option key={v.id} value={v.id}>
                        #{v.index} — {v.headline?.substring(0, 40)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {selectedVariation && (
              <div className="bg-gray-800/50 rounded-xl p-3 space-y-1.5">
                <p className="text-white text-sm font-semibold line-clamp-2">{selectedVariation.headline}</p>
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{selectedVariation.primaryText}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="badge bg-gray-700 text-gray-300 text-xs">{selectedVariation.angle?.replace('_', ' ')}</span>
                  {selectedVariation.targetSegment && (
                    <span className="text-teal-400/70 text-xs truncate">→ {selectedVariation.targetSegment}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme picker */}
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
                    themeId === t.id ? 'border-brand-500 scale-105' : 'border-transparent hover:border-gray-600'
                  }`}
                  style={{ background: t.bg }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ background: t.preview }}
                  />
                  <div
                    className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full"
                    style={{ background: t.preview }}
                  />
                  {themeId === t.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{selectedTheme.label}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Accent override:</span>
                <input
                  type="color"
                  value={accentOverride || selectedTheme.accent}
                  onChange={(e) => setAccentOverride(e.target.value)}
                  className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Override accent color"
                />
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
              <button
                onClick={() => setLogoInputMode('url')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${logoInputMode === 'url' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                URL
              </button>
              <button
                onClick={() => setLogoInputMode('file')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${logoInputMode === 'file' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Upload
              </button>
            </div>

            {logoInputMode === 'url' ? (
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="https://yoursite.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
                <button className="btn-secondary flex-shrink-0 text-xs" onClick={handleLogoUrlApply}>
                  Use
                </button>
              </div>
            ) : (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                <button
                  className="btn-secondary w-full text-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={13} /> Choose image file
                </button>
              </>
            )}

            {logoSrc && (
              <div className="relative bg-gray-800/50 rounded-xl p-3 flex items-center justify-center" style={{ minHeight: '64px' }}>
                <img src={logoSrc} alt="Logo preview" className="max-h-12 max-w-full object-contain" />
                <button
                  onClick={() => { setLogoSrc(''); setLogoUrl('') }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                >
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
              <input
                className="input text-sm"
                placeholder="https://yoursite.com/signup"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1">All buttons on the page link here</p>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Company Name</label>
              <input
                className="input text-sm"
                placeholder={brandContext.brandName || 'Your Company'}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Tagline</label>
              <input
                className="input text-sm"
                placeholder="The fastest way to…"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Social Proof Metric</label>
              <input
                className="input text-sm"
                placeholder="2,400+ businesses trust us"
                value={trustMetric}
                onChange={(e) => setTrustMetric(e.target.value)}
              />
            </div>
          </div>

          {/* Status badges */}
          <div className="space-y-2">
            {insights && (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <span>✓</span> Using audience research to address objections
              </p>
            )}
            {competitorSwipeFile && (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <span>✓</span> Competitor intel will position against alternatives
              </p>
            )}
          </div>

          {/* Generate button */}
          <button
            className="btn-primary w-full"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedVariation}
          >
            {isGenerating
              ? <><RefreshCw size={15} className="animate-spin" /> Generating…</>
              : <><Wand2 size={15} /> Generate Landing Page</>
            }
          </button>

          {isGenerating && (
            <div className="space-y-2">
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 bg-brand-500 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-xs text-gray-500 text-center">{loadingMsg}</p>
              <p className="text-xs text-gray-600 text-center">Building 11-section page… ~45s</p>
            </div>
          )}

          {/* Export */}
          {html && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-white text-sm">Export</h3>
              <button className="btn-secondary w-full text-sm" onClick={handleCopy}>
                <Copy size={13} /> Copy HTML
              </button>
              <button className="btn-secondary w-full text-sm" onClick={handleDownload}>
                <Download size={13} /> Download .html
              </button>
            </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-2 space-y-3">
          {html ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
                  <button
                    onClick={() => setPreviewMode('preview')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${previewMode === 'preview' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setPreviewMode('code')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${previewMode === 'code' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    HTML Code
                  </button>
                </div>
                <p className="text-xs text-gray-500">{html.length.toLocaleString()} characters</p>
              </div>

              {previewMode === 'preview' ? (
                <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-950" style={{ height: '720px' }}>
                  <iframe
                    srcDoc={html}
                    className="w-full h-full"
                    title="Landing page preview"
                    sandbox="allow-same-origin allow-scripts"
                  />
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-950" style={{ height: '720px' }}>
                  <pre className="text-xs text-gray-300 p-4 overflow-auto h-full leading-relaxed font-mono whitespace-pre-wrap">
                    {html}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center">
              {/* Theme preview card */}
              <div
                className="w-full rounded-2xl border border-gray-800 overflow-hidden"
                style={{ background: selectedTheme.bg, minHeight: '360px' }}
              >
                {/* Mock navbar */}
                <div
                  className="flex items-center justify-between px-6 py-3 border-b"
                  style={{ borderColor: 'rgba(255,255,255,0.07)', background: selectedTheme.surface }}
                >
                  <div className="flex items-center gap-2">
                    {logoSrc
                      ? <img src={logoSrc} alt="logo" className="h-6 object-contain" />
                      : <div className="w-6 h-6 rounded-md" style={{ background: effectiveAccent }} />
                    }
                    <span className="font-bold text-sm" style={{ color: selectedTheme.text }}>
                      {companyName || brandContext.brandName || 'Your Brand'}
                    </span>
                  </div>
                  <div
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: effectiveAccent, color: '#fff' }}
                  >
                    {selectedVariation?.cta || 'Get Started'}
                  </div>
                </div>

                {/* Mock hero */}
                <div className="flex flex-col items-center text-center px-8 py-12 space-y-4">
                  <div
                    className="text-xs font-semibold px-3 py-1 rounded-full border"
                    style={{ color: effectiveAccent, borderColor: effectiveAccent + '40', background: effectiveAccent + '15' }}
                  >
                    {selectedTheme.label} Theme
                  </div>
                  <p className="text-xl font-black leading-tight" style={{ color: selectedTheme.text }}>
                    {selectedVariation?.headline || 'Your ad headline will appear here'}
                  </p>
                  {tagline && (
                    <p className="text-sm" style={{ color: selectedTheme.text + 'aa' }}>{tagline}</p>
                  )}
                  <div className="flex gap-3 pt-2">
                    <div
                      className="text-xs font-semibold px-4 py-2 rounded-lg"
                      style={{ background: effectiveAccent, color: '#fff' }}
                    >
                      {selectedVariation?.cta || 'Get Started'}
                    </div>
                    <div
                      className="text-xs font-semibold px-4 py-2 rounded-lg border"
                      style={{ borderColor: 'rgba(255,255,255,0.2)', color: selectedTheme.text }}
                    >
                      See how it works →
                    </div>
                  </div>
                  <p className="text-xs mt-2" style={{ color: selectedTheme.text + '60' }}>
                    {trustMetric || '2,400+ customers trust us'}
                  </p>
                </div>
              </div>

              <div className="text-center mt-6">
                <Globe size={32} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 text-sm font-medium">Theme preview — configure above, then generate</p>
                <p className="text-gray-600 text-xs mt-1">11-section page built in ~45 seconds</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
