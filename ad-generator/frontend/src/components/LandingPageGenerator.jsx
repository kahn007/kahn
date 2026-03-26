import React, { useState } from 'react'
import { Globe, Wand2, RefreshCw, Copy, Download, ExternalLink, ChevronDown, LayoutTemplate } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { generateLandingPage } from '../lib/api'

const LOADING_MESSAGES = [
  'Writing hero section…',
  'Crafting pain point section…',
  'Building feature grid…',
  'Writing testimonials…',
  'Building FAQ accordion…',
  'Polishing final CTA…',
  'Adding animations and CSS…',
  'Almost there…',
]

export default function LandingPageGenerator() {
  const { variations, brandContext, researchSessions, activeResearchId, competitorSwipeFile } = useAdStore()
  const activeSession = researchSessions.find((r) => r.id === activeResearchId)
  const insights = activeSession?.insights || null

  const [selectedId, setSelectedId] = useState(variations[0]?.id || '')
  const [html, setHtml] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [previewMode, setPreviewMode] = useState('preview') // 'preview' | 'code'

  const selectedVariation = variations.find((v) => v.id === selectedId)

  const handleGenerate = async () => {
    if (!selectedVariation) { toast.error('Select an ad variation first'); return }
    setIsGenerating(true)
    setHtml('')
    setLoadingMsg(LOADING_MESSAGES[0])

    // Cycle through loading messages while generating
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
          Claude writes a full HTML landing page that matches your ad copy for perfect message-match.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <LayoutTemplate size={14} className="text-brand-500" />
              Configuration
            </h3>

            {variations.length === 0 ? (
              <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-3 text-xs text-yellow-400">
                No variations yet — generate ad copy first, then come back here.
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Ad Variation to match</label>
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
                <p className="text-white text-sm font-semibold">{selectedVariation.headline}</p>
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{selectedVariation.primaryText}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="badge bg-gray-700 text-gray-300 text-xs">{selectedVariation.angle?.replace('_', ' ')}</span>
                  {selectedVariation.targetSegment && (
                    <span className="text-teal-400/70 text-xs">→ {selectedVariation.targetSegment}</span>
                  )}
                </div>
              </div>
            )}

            {insights && (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <span>✓</span>
                Using audience research to address objections
              </p>
            )}

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
                <p className="text-xs text-gray-600 text-center">Building full page with 11 sections… ~45s</p>
              </div>
            )}

            {competitorSwipeFile && (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <span>✓</span>
                Competitor intel will be used to position against alternatives
              </p>
            )}
          </div>

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

          <div className="card space-y-2">
            <h3 className="font-semibold text-white text-sm">11 sections included</h3>
            <ul className="space-y-1.5 text-xs text-gray-400">
              {[
                'Sticky navbar with CTA',
                'Hero with social proof micro-line',
                'Trust bar (company logos)',
                'Pain/problem 2×2 card grid',
                'Solution feature grid (3 cards)',
                'How it works (numbered steps)',
                '3 testimonials with star ratings',
                'Competitor comparison table',
                'FAQ with JS accordion',
                'Final CTA with gradient section',
                'Footer',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-brand-400 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Preview */}
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
                <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-950" style={{ height: '700px' }}>
                  <iframe
                    srcDoc={html}
                    className="w-full h-full"
                    title="Landing page preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-950" style={{ height: '700px' }}>
                  <pre className="text-xs text-gray-300 p-4 overflow-auto h-full leading-relaxed font-mono whitespace-pre-wrap">
                    {html}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-24 lg:py-32">
              <Globe size={48} className="text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400 text-lg font-medium">No landing page yet</p>
              <p className="text-gray-600 text-sm mt-1">Select an ad variation and click Generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
