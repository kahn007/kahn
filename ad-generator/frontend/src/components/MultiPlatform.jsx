import React, { useState } from 'react'
import {
  Layers, Search, RefreshCw, Copy, Check, ChevronDown, ChevronUp,
  AlertCircle, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { adaptToPlatform, PLATFORM_SPECS } from '../lib/api'

// ── Platform cards ────────────────────────────────────────────
const PLATFORMS = [
  {
    id: 'google',
    name: 'Google Ads',
    sub: 'Responsive Search Ads',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    activeBg: 'bg-blue-500/20 border-blue-500/50',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    sub: 'Video Ad Script',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    activeBg: 'bg-pink-500/20 border-pink-500/50',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-pink-400">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z"/>
      </svg>
    ),
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    sub: 'Single Image Ad',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    activeBg: 'bg-sky-500/20 border-sky-500/50',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    sub: '5-Tweet Thread',
    color: 'text-zinc-300',
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    activeBg: 'bg-zinc-500/20 border-zinc-500/50',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-300">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.737-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    sub: '30s Pre-Roll Script',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    activeBg: 'bg-red-500/20 border-red-500/50',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF0000">
        <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
      </svg>
    ),
  },
]

// ── Field labels per platform ─────────────────────────────────
const FIELD_LABELS = {
  google:   { headline1: 'Headline 1 (30 chars)', headline2: 'Headline 2 (30 chars)', headline3: 'Headline 3 (30 chars)', description1: 'Description 1 (90 chars)', description2: 'Description 2 (90 chars)' },
  tiktok:   { hook: 'Hook (0–3s)', story: 'Story (3–25s)', cta: 'CTA (25–30s)', caption: 'Caption', hashtags: 'Hashtags' },
  linkedin: { headline: 'Headline', intro: 'Intro Text', body: 'Body Copy', ctaButton: 'CTA Button' },
  twitter:  { tweet1: 'Tweet 1', tweet2: 'Tweet 2', tweet3: 'Tweet 3', tweet4: 'Tweet 4', tweet5: 'Tweet 5' },
  youtube:  { hook: 'Hook (0–5s)', problem: 'Problem (5–15s)', solution: 'Solution (15–25s)', cta: 'CTA (25–30s)', fullScript: 'Full Script' },
}

// ── Copy button with tick feedback ───────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    const val = Array.isArray(text) ? text.join(' ') : String(text || '')
    navigator.clipboard.writeText(val)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  )
}

// ── Adaptation card ───────────────────────────────────────────
function AdaptationCard({ adaptation, platform, fields, sourceVariation, index }) {
  const [open, setOpen] = useState(index === 0)
  const labels = FIELD_LABELS[platform] || {}

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {sourceVariation?.headline || `Variation ${index + 1}`}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5 capitalize">
            {sourceVariation?.angle?.replace('_', ' ')} angle
          </p>
        </div>
        {open ? <ChevronUp size={14} className="text-zinc-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-zinc-500 flex-shrink-0" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          {fields.map((field) => {
            const val = adaptation[field]
            if (!val) return null
            const isLong = typeof val === 'string' && val.length > 80
            const isArray = Array.isArray(val)
            return (
              <div key={field}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-zinc-500 text-xs">{labels[field] || field}</p>
                  <CopyBtn text={val} />
                </div>
                {isArray ? (
                  <div className="flex flex-wrap gap-1.5">
                    {val.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-surface-800 border border-white/[0.06] text-zinc-300 text-xs rounded-lg">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={`text-white text-sm leading-relaxed whitespace-pre-wrap ${isLong ? '' : 'font-medium'}`}>
                    {val}
                  </p>
                )}
                {platform === 'google' && (field === 'headline1' || field === 'headline2' || field === 'headline3') && (
                  <p className={`text-[10px] mt-0.5 ${val.length > 30 ? 'text-red-400' : 'text-zinc-600'}`}>
                    {val.length}/30 chars
                  </p>
                )}
                {platform === 'google' && (field === 'description1' || field === 'description2') && (
                  <p className={`text-[10px] mt-0.5 ${val.length > 90 ? 'text-red-400' : 'text-zinc-600'}`}>
                    {val.length}/90 chars
                  </p>
                )}
                {platform === 'twitter' && (
                  <p className={`text-[10px] mt-0.5 ${val.length > 280 ? 'text-red-400' : 'text-zinc-600'}`}>
                    {val.length}/280 chars
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function MultiPlatform() {
  const {
    variations, brandContext,
    researchSessions, activeResearchId,
    platformAdaptations, setPlatformAdaptations,
  } = useAdStore()

  const [selectedPlatform, setSelectedPlatform] = useState('google')
  const [isGenerating, setIsGenerating] = useState(false)

  const activeSession = researchSessions.find((r) => r.id === activeResearchId)
  const insights = activeSession?.insights || null

  const handleAdapt = async () => {
    if (!variations.length) {
      toast.error('Generate some ad copy first — go to Generate Copy tab')
      return
    }
    setIsGenerating(true)
    try {
      const result = await adaptToPlatform({
        variations,
        brandContext,
        platform: selectedPlatform,
        insights,
      })
      setPlatformAdaptations(result)
      toast.success(`Adapted ${result.adaptations.length} variations for ${result.platformName}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyAll = () => {
    if (!platformAdaptations) return
    const { adaptations, fields, sourceVariations, platform } = platformAdaptations
    const labels = FIELD_LABELS[platform] || {}
    const text = adaptations.map((a, i) => {
      const src = sourceVariations[i]
      const lines = [`=== ${src?.headline || `Variation ${i + 1}`} ===`]
      fields.forEach((f) => {
        const v = a[f]
        if (v) lines.push(`${labels[f] || f}: ${Array.isArray(v) ? v.map((t) => `#${t}`).join(' ') : v}`)
      })
      return lines.join('\n')
    }).join('\n\n')
    navigator.clipboard.writeText(text)
    toast.success('All adaptations copied to clipboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Multi-Platform</h2>
        <p className="page-subtitle">
          Adapt your Facebook ad copy to Google, TikTok, LinkedIn, Twitter/X, and YouTube — one click.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left: config */}
        <div className="space-y-4">
          {/* Platform selector */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-white text-sm">Target Platform</h3>
            <div className="space-y-2">
              {PLATFORMS.map((p) => {
                const active = selectedPlatform === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      active ? p.activeBg : `${p.bg} hover:border-white/[0.12]`
                    }`}
                  >
                    <div className="flex-shrink-0"><p.icon /></div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-zinc-300'}`}>{p.name}</p>
                      <p className="text-zinc-500 text-xs">{p.sub}</p>
                    </div>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Source summary */}
          <div className="card space-y-2">
            <h3 className="font-semibold text-white text-sm">Source</h3>
            <div className="text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Variations available</span>
                <span className="text-white font-semibold">{variations.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Will adapt</span>
                <span className="text-white">Up to 5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Research data</span>
                <span className={insights ? 'text-emerald-400' : 'text-zinc-600'}>
                  {insights ? `${insights.painPoints?.length || 0} pain points` : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {!variations.length && (
            <div className="warn-box flex items-start gap-2">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              No variations yet — generate ad copy first
            </div>
          )}

          <button
            className="btn-primary w-full"
            onClick={handleAdapt}
            disabled={isGenerating || !variations.length}
          >
            {isGenerating
              ? <><RefreshCw size={14} className="animate-spin" /> Adapting…</>
              : <><Zap size={14} /> Adapt to {PLATFORMS.find((p) => p.id === selectedPlatform)?.name}</>
            }
          </button>
        </div>

        {/* Right: output */}
        <div className="space-y-4">
          {platformAdaptations ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">
                    {platformAdaptations.platformName} — {platformAdaptations.adaptations.length} variations
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">Click each card to expand. Copy individual fields or all at once.</p>
                </div>
                <button className="btn-secondary text-sm flex-shrink-0" onClick={copyAll}>
                  <Copy size={13} /> Copy All
                </button>
              </div>

              {platformAdaptations.adaptations.map((a, i) => (
                <AdaptationCard
                  key={i}
                  index={i}
                  adaptation={a}
                  platform={platformAdaptations.platform}
                  fields={platformAdaptations.fields}
                  sourceVariation={platformAdaptations.sourceVariations[i]}
                />
              ))}
            </>
          ) : (
            <div className="card h-full min-h-[320px] flex items-center justify-center">
              <div className="empty-state">
                <div className="empty-icon"><Layers size={18} /></div>
                <p className="empty-title">No adaptations yet</p>
                <p className="empty-body">
                  Select a platform and click Adapt to convert your existing Facebook copy
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
