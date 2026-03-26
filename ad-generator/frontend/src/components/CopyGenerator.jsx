import React, { useState } from 'react'
import { Wand2, RefreshCw, ChevronDown, LayoutGrid, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { generateVariations } from '../lib/api'
import AdPreview from './AdPreview'

const FORMATS = [
  { id: 'feed',    label: 'Feed (1.91:1)' },
  { id: 'square',  label: 'Square (1:1)' },
  { id: 'story',   label: 'Story (9:16)' },
]

const COUNTS = [5, 10, 25, 50, 100]

const ANGLE_LABELS = {
  pain_point:   { label: 'Pain Point', color: 'text-red-400' },
  outcome:      { label: 'Outcome', color: 'text-green-400' },
  social_proof: { label: 'Social Proof', color: 'text-blue-400' },
  curiosity:    { label: 'Curiosity', color: 'text-yellow-400' },
  authority:    { label: 'Authority', color: 'text-purple-400' },
  fomo:         { label: 'FOMO', color: 'text-orange-400' },
}

export default function CopyGenerator() {
  const { brandContext, setBrandContext, insights, addVariations, setIsGenerating, isGenerating, setActiveTab } = useAdStore()

  const [count, setCount]     = useState(10)
  const [formats, setFormats] = useState(['feed'])
  const [preview, setPreview] = useState(null)
  const [progress, setProgress] = useState(0)

  const toggleFormat = (id) => {
    setFormats((f) => f.includes(id) ? (f.length > 1 ? f.filter((x) => x !== id) : f) : [...f, id])
  }

  const handleGenerate = async () => {
    if (!brandContext.product) {
      toast.error('Add your product in Settings or Research panel first')
      return
    }
    setIsGenerating(true)
    setProgress(0)

    // Fake progress bar
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 90))
    }, 800)

    try {
      const data = await generateVariations({
        brandContext,
        insights,
        count,
        formats,
      })
      clearInterval(interval)
      setProgress(100)
      addVariations(data.variations)
      toast.success(
        data.variations.length === count
          ? `Generated ${count} ad variations!`
          : `Generated ${data.variations.length} variations (add Anthropic key for full generation)`
      )
      setTimeout(() => {
        setIsGenerating(false)
        setProgress(0)
        setActiveTab('variations')
      }, 600)
    } catch (err) {
      clearInterval(interval)
      toast.error(err.message)
      setIsGenerating(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Generate Ad Copy</h2>
        <p className="text-gray-400 mt-1">
          Claude reads your audience insights and bulk-generates headlines + body copy across multiple angles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config card */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold text-white text-sm">Brand Context</h3>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Product / Service</label>
              <input
                className="input"
                placeholder="AI-powered Facebook ad generator"
                value={brandContext.product}
                onChange={(e) => setBrandContext({ product: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Target Audience</label>
              <input
                className="input"
                placeholder="e-commerce entrepreneurs, coaches"
                value={brandContext.targetAudience}
                onChange={(e) => setBrandContext({ targetAudience: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">CTA Button</label>
                <select
                  className="input"
                  value={brandContext.cta}
                  onChange={(e) => setBrandContext({ cta: e.target.value })}
                >
                  {['Learn More', 'Sign Up', 'Get Started', 'Shop Now', 'Download', 'Contact Us'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Landing Page URL</label>
                <input
                  className="input"
                  placeholder="https://brayneai.com"
                  value={brandContext.landingPageUrl}
                  onChange={(e) => setBrandContext({ landingPageUrl: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold text-white text-sm">Generation Settings</h3>

            {/* Count */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Number of Variations</label>
              <div className="flex gap-2 flex-wrap">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      count === n
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Formats */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Ad Formats</label>
              <div className="flex gap-2 flex-wrap">
                {FORMATS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => toggleFormat(id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      formats.includes(id)
                        ? 'bg-brand-500/20 border border-brand-500/50 text-brand-400'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Insights badge */}
            {insights ? (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/20 border border-green-900/40 rounded-xl px-3 py-2">
                <span>✓</span>
                Using {insights.painPoints?.length} pain points + {insights.triggerPhrases?.length} trigger phrases from research
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-900/40 rounded-xl px-3 py-2">
                <span>!</span>
                No research data yet — run Research first for better copy
              </div>
            )}

            {/* Generate button */}
            {isGenerating ? (
              <div className="space-y-2">
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-center">Generating {count} variations with Claude AI…</p>
              </div>
            ) : (
              <button className="btn-primary w-full" onClick={handleGenerate}>
                <Wand2 size={16} />
                Generate {count} Variations
              </button>
            )}
          </div>
        </div>

        {/* Preview panel */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
              <LayoutGrid size={14} />
              Ad Preview
            </h3>
            <AdPreview
              variation={{
                headline:    'Stop guessing. Start converting.',
                primaryText: `Most ${brandContext.targetAudience || 'entrepreneurs'} spend hours writing ads that never convert. ${brandContext.brandName} changes that. Our AI analyzes what your audience actually cares about — then writes the copy for you. In minutes, not weeks.`,
                description: 'Try free today',
                cta:         brandContext.cta,
                imageUrl:    null,
              }}
              brandContext={brandContext}
              format="feed"
            />
          </div>

          {/* Angle guide */}
          <div className="card">
            <h3 className="font-semibold text-white text-sm mb-3">Copy Angles Claude Will Use</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ANGLE_LABELS).map(([key, { label, color }]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')}`} />
                  <span className={color}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
