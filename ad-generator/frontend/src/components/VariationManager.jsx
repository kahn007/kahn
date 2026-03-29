import React, { useState } from 'react'
import { LayoutGrid, List, Trash2, CheckSquare, Square, Edit3, Copy, ChevronRight, ImagePlus, Loader, Sparkles, Video, Image, Minus, Plus, ChevronDown, Type, Zap, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { useAdStore } from '../store/adStore'
import { generateAdImage, generateAdVideo, animateAdImage, VIDEO_MODELS } from '../lib/api'
import AdPreview from './AdPreview'

const ANGLE_COLORS = {
  pain_point:   'bg-red-900/30 text-red-300 border-red-800/50',
  outcome:      'bg-green-900/30 text-green-300 border-green-800/50',
  social_proof: 'bg-blue-900/30 text-blue-300 border-blue-800/50',
  curiosity:    'bg-yellow-900/30 text-yellow-300 border-yellow-800/50',
  authority:    'bg-purple-900/30 text-purple-300 border-purple-800/50',
  fomo:         'bg-orange-900/30 text-orange-300 border-orange-800/50',
  general:      'bg-surface-800 text-zinc-400 border-white/[0.08]',
}

// ── Creative Mix selector ─────────────────────────────────────
function CreativeMix({ total, imageCount, videoCount, videoModelId, videoDuration, onChange, onModelChange, onDurationChange }) {
  const PRESETS = [
    { label: 'All Images',  images: total, videos: 0 },
    { label: `${total - 1}+1`,        images: Math.max(total - 1, 0), videos: Math.min(1, total) },
    { label: '50/50',       images: Math.ceil(total / 2), videos: Math.floor(total / 2) },
    { label: 'All Videos',  images: 0, videos: total },
  ]

  const setImages = (n) => {
    const imgs = Math.max(0, Math.min(n, total))
    onChange({ images: imgs, videos: total - imgs })
  }
  const setVideos = (n) => {
    const vids = Math.max(0, Math.min(n, total))
    onChange({ images: total - vids, videos: vids })
  }

  const currentModel = VIDEO_MODELS[videoModelId] || VIDEO_MODELS.kling3

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
          <Sparkles size={14} className="text-teal-400" />
          Creative Mix
        </h3>
        <span className="text-xs text-zinc-500">{total} variations</span>
      </div>

      {/* Presets */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange({ images: p.images, videos: p.videos })}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              imageCount === p.images && videoCount === p.videos
                ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                : 'bg-surface-800 border-white/[0.08] text-zinc-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom counters */}
      <div className="grid grid-cols-2 gap-4">
        {/* Images */}
        <div className="bg-surface-800/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Image size={15} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Images</p>
              <p className="text-zinc-500 text-xs">Nano Banana Pro · ~10s</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setImages(imageCount - 1)} disabled={imageCount === 0}
              className="w-8 h-8 rounded-xl bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors disabled:opacity-30">
              <Minus size={14} />
            </button>
            <span className="text-3xl font-bold text-white w-10 text-center">{imageCount}</span>
            <button onClick={() => setImages(imageCount + 1)} disabled={imageCount === total}
              className="w-8 h-8 rounded-xl bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors disabled:opacity-30">
              <Plus size={14} />
            </button>
          </div>
          <p className="text-zinc-600 text-xs">~$0.06 each</p>
        </div>

        {/* Videos */}
        <div className="bg-surface-800/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <Video size={15} className="text-teal-400" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Videos</p>
              <p className="text-zinc-500 text-xs">{currentModel.sublabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setVideos(videoCount - 1)} disabled={videoCount === 0}
              className="w-8 h-8 rounded-xl bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors disabled:opacity-30">
              <Minus size={14} />
            </button>
            <span className="text-3xl font-bold text-white w-10 text-center">{videoCount}</span>
            <button onClick={() => setVideos(videoCount + 1)} disabled={videoCount === total}
              className="w-8 h-8 rounded-xl bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors disabled:opacity-30">
              <Plus size={14} />
            </button>
          </div>
          {/* Video model selector */}
          <div className="relative">
            <select
              value={videoModelId}
              onChange={(e) => { onModelChange(e.target.value); onDurationChange(VIDEO_MODELS[e.target.value]?.durations[0]?.value) }}
              className="w-full appearance-none bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-2.5 py-1.5 pr-6 cursor-pointer focus:outline-none focus:border-teal-500"
            >
              {Object.values(VIDEO_MODELS).map((m) => (
                <option key={m.id} value={m.id}>{m.label} — {m.sublabel}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
          {/* Duration picker */}
          <div className="flex gap-1.5">
            {(VIDEO_MODELS[videoModelId] || VIDEO_MODELS.kling3).durations.map((d) => (
              <button
                key={d.value}
                onClick={() => onDurationChange(d.value)}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all border ${
                  videoDuration === d.value
                    ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                    : 'bg-gray-700 border-gray-600 text-zinc-400 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visual bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex rounded-full overflow-hidden h-2 bg-surface-800">
            {imageCount > 0 && <div className="bg-blue-500 transition-all duration-300" style={{ width: `${(imageCount / total) * 100}%` }} />}
            {videoCount > 0 && <div className="bg-teal-500 transition-all duration-300" style={{ width: `${(videoCount / total) * 100}%` }} />}
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />{imageCount} images · Nano Banana Pro</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />{videoCount} videos · {currentModel.label}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function VariationManager() {
  const {
    variations, selectedVariations, brandContext,
    toggleSelectVariation, selectAll, clearSelection,
    removeVariation, updateVariation, setActiveTab, addVariations,
    competitorSwipeFile,
  } = useAdStore()

  const [viewMode, setViewMode]       = useState('grid')
  const [editingId, setEditingId]     = useState(null)
  const [filterAngle, setFilterAngle] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewId, setPreviewId]     = useState(null)

  // Per-card loading states
  const [cardStatus, setCardStatus]   = useState({}) // id → { type: 'image'|'video', label }

  // Bulk generation state
  const [isBulkGen, setIsBulkGen]     = useState(false)
  const [bulkLog, setBulkLog]         = useState([])
  const [bulkDone, setBulkDone]       = useState(0)
  const [bulkTotal, setBulkTotal]     = useState(0)
  const [showMixer, setShowMixer]       = useState(false)
  const [videoModelId, setVideoModelId] = useState('kling3pro')
  const [videoDuration, setVideoDuration] = useState('5')

  // Creative mix
  const targets = selectedVariations.length > 0
    ? variations.filter((v) => selectedVariations.includes(v.id))
    : variations
  const defaultImages = targets.length
  const [mix, setMix] = useState({ images: defaultImages, videos: 0 })

  // Keep mix in sync when selection changes
  const effectiveTotal = targets.length
  const clampedImages  = Math.min(mix.images, effectiveTotal)
  const clampedVideos  = Math.min(mix.videos, effectiveTotal - clampedImages)

  const filtered = variations
    .filter((v) => filterAngle === 'all' || v.angle === filterAngle)
    .filter((v) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (v.headline || '').toLowerCase().includes(q) ||
             (v.primaryText || '').toLowerCase().includes(q) ||
             (v.angle || '').toLowerCase().includes(q)
    })
  const allAngles = ['all', ...new Set(variations.map((v) => v.angle))]

  const handleDuplicate = (v) => {
    addVariations([{ ...v, id: crypto.randomUUID(), index: variations.length + 1, imageUrl: null, videoUrl: null }])
    toast.success('Variation duplicated')
  }
  const handleDelete = (id) => { removeVariation(id); toast.success('Removed') }

  const setCard = (id, status) => setCardStatus((s) => ({ ...s, [id]: status }))
  const clearCard = (id) => setCardStatus((s) => { const n = { ...s }; delete n[id]; return n })

  // CSV export
  const exportCsv = () => {
    const toExport = selectedVariations.length > 0
      ? variations.filter((v) => selectedVariations.includes(v.id))
      : variations
    if (!toExport.length) { toast.error('No variations to export'); return }

    const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`
    const headers = ['#', 'Headline', 'Primary Text', 'Description', 'CTA', 'Angle', 'Format', 'Score', 'Status', 'Facebook Ad ID', 'Created At']
    const rows = toExport.map((v, i) => [
      v.index || i + 1, esc(v.headline), esc(v.primaryText), esc(v.description),
      v.cta, v.angle, v.format, v.score || '', v.status, v.facebookAdId || '',
      v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `brayne-ads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success(`Exported ${toExport.length} variations to CSV`)
  }

  // Single card image
  const handleGenImage = async (v) => {
    setCard(v.id, { type: 'image', label: 'Generating image…' })
    try {
      const result = await generateAdImage({ variation: v, brandContext, format: v.format || 'feed', competitorIntel: competitorSwipeFile || null })
      updateVariation(v.id, { imageUrl: result.imageUrl, videoUrl: null, creativePrompt: result.creativePrompt })
      toast.success('Image ready!')
    } catch (err) { toast.error(err.message) }
    finally { clearCard(v.id) }
  }

  // Animate image → video
  const handleAnimate = async (v) => {
    setCard(v.id, { type: 'animate', label: 'Queued…' })
    try {
      const result = await animateAdImage({
        variation: v, brandContext, format: v.format || 'feed',
        videoDuration,
        onProgress: (label) => setCard(v.id, { type: 'animate', label }),
      })
      updateVariation(v.id, { videoUrl: result.videoUrl })
      toast.success('Animation ready!')
    } catch (err) { toast.error(err.message) }
    finally { clearCard(v.id) }
  }

  // Bulk ZIP download
  const handleZipDownload = async () => {
    const withCreative = variations.filter((v) => v.imageUrl || v.videoUrl)
    if (!withCreative.length) { toast.error('No images or videos to download'); return }

    const toastId = toast.loading(`Packaging ${withCreative.length} files…`)
    try {
      const zip = new JSZip()
      const folder = zip.folder('brayne-ai-ads')
      for (const v of withCreative) {
        const url = v.videoUrl || v.imageUrl
        const ext = v.videoUrl ? 'mp4' : 'jpg'
        const filename = `ad-${v.index || v.id.substring(0, 6)}-${(v.headline || 'ad').replace(/[^a-z0-9]/gi, '-').substring(0, 30)}.${ext}`
        try {
          const res = await fetch(url)
          const blob = await res.blob()
          folder.file(filename, blob)
        } catch {
          // skip unreachable file
        }
      }
      const content = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(content)
      a.download = 'brayne-ai-ads.zip'
      a.click()
      toast.dismiss(toastId)
      toast.success(`Downloaded ${withCreative.length} creatives as ZIP!`)
    } catch (err) {
      toast.dismiss(toastId)
      toast.error(err.message)
    }
  }

  // Single card video
  const handleGenVideo = async (v) => {
    setCard(v.id, { type: 'video', label: 'Queued…' })
    try {
      const result = await generateAdVideo({
        variation: v, brandContext, format: v.format || 'feed',
        videoModelId, videoDuration,
        competitorIntel: competitorSwipeFile || null,
        onProgress: (label) => setCard(v.id, { type: 'video', label }),
      })
      updateVariation(v.id, { videoUrl: result.videoUrl, imageUrl: null, creativePrompt: result.creativePrompt })
      toast.success('Video ready!')
    } catch (err) { toast.error(err.message) }
    finally { clearCard(v.id) }
  }

  // Bulk generation using the mix
  const handleBulkGenerate = async () => {
    if (clampedImages + clampedVideos === 0) {
      toast.error('Set at least 1 image or video in the Creative Mix')
      return
    }

    const pool = [...targets]
    const imageSlots = pool.slice(0, clampedImages)
    const videoSlots = pool.slice(clampedImages, clampedImages + clampedVideos)
    const total = imageSlots.length + videoSlots.length

    setIsBulkGen(true)
    setBulkDone(0)
    setBulkTotal(total)
    setBulkLog([])

    const log = (msg) => setBulkLog((l) => [...l.slice(-4), msg])

    // Images first (fast ~10s each)
    for (let i = 0; i < imageSlots.length; i++) {
      const v = imageSlots[i]
      log(`🖼  Generating image ${i + 1}/${imageSlots.length} — "${v.headline?.substring(0, 30)}…"`)
      try {
        const result = await generateAdImage({ variation: v, brandContext, format: v.format || 'feed', competitorIntel: competitorSwipeFile || null })
        updateVariation(v.id, { imageUrl: result.imageUrl, videoUrl: null, creativePrompt: result.creativePrompt })
        log(`✅ Image ${i + 1} done`)
      } catch (err) {
        log(`❌ Image ${i + 1} failed: ${err.message}`)
        if (err.message.includes('fal.ai')) break
      }
      setBulkDone((d) => d + 1)
      if (i < imageSlots.length - 1) await sleep(500)
    }

    // Videos (slow ~90s each)
    for (let i = 0; i < videoSlots.length; i++) {
      const v = videoSlots[i]
      log(`🎬 Generating video ${i + 1}/${videoSlots.length} — "${v.headline?.substring(0, 30)}…"`)
      try {
        const result = await generateAdVideo({
          variation: v, brandContext, format: v.format || 'feed',
          videoModelId, videoDuration,
          competitorIntel: competitorSwipeFile || null,
          onProgress: (label) => log(`   ${label}`),
        })
        updateVariation(v.id, { videoUrl: result.videoUrl, imageUrl: null, creativePrompt: result.creativePrompt })
        log(`✅ Video ${i + 1} done`)
      } catch (err) {
        log(`❌ Video ${i + 1} failed: ${err.message}`)
      }
      setBulkDone((d) => d + 1)
    }

    setIsBulkGen(false)
    toast.success(`Done! ${clampedImages} images + ${clampedVideos} videos generated`)
  }

  const withCreatives = variations.filter((v) => v.imageUrl || v.videoUrl).length

  if (variations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="page-title">Variations</h2>
          <p className="page-subtitle">All your generated ad variations will appear here.</p>
        </div>
        <div className="card text-center py-20">
          <LayoutGrid size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-zinc-400 text-lg font-medium">No variations yet</p>
          <p className="text-zinc-600 text-sm mt-1 mb-6">Go to Generate Copy to create your first batch</p>
          <button className="btn-primary mx-auto" onClick={() => setActiveTab('generate')}>Generate Ad Copy</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">
            Variations <span className="text-lg text-zinc-500">{variations.length}</span>
          </h2>
          <p className="page-subtitle">
            {selectedVariations.length > 0 ? `${selectedVariations.length} selected · ` : ''}
            {withCreatives}/{variations.length} have creatives
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <input
              className="input text-sm pl-8 w-52"
              placeholder="Search variations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          {/* Angle filter */}
          <div className="flex items-center gap-1 bg-surface-900 border border-white/[0.06] rounded-xl p-1">
            {allAngles.map((angle) => (
              <button
                key={angle}
                onClick={() => setFilterAngle(angle)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  filterAngle === angle ? 'bg-brand-500 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {angle === 'all' ? `All (${variations.length})` : angle.replace('_', ' ')}
              </button>
            ))}
          </div>
          <button className="btn-ghost text-sm" onClick={() => selectedVariations.length === variations.length ? clearSelection() : selectAll()}>
            {selectedVariations.length === variations.length ? <CheckSquare size={14} /> : <Square size={14} />}
            {selectedVariations.length === variations.length ? 'Deselect All' : 'Select All'}
          </button>
          <button className="btn-ghost text-sm" onClick={exportCsv} title="Export to CSV">
            <Download size={14} />
            CSV
          </button>
          <div className="flex bg-surface-900 border border-white/[0.06] rounded-xl overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2.5 ${viewMode === 'grid' ? 'bg-surface-700 text-white' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={14} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2.5 ${viewMode === 'list' ? 'bg-surface-700 text-white' : 'text-zinc-500 hover:text-white'}`}><List size={14} /></button>
          </div>
        </div>
      </div>

      {/* Creative Mix toggle */}
      <div className="space-y-3">
        <button
          className="btn-secondary text-sm"
          onClick={() => setShowMixer((s) => !s)}
        >
          <Sparkles size={14} className="text-teal-400" />
          Creative Mix — {clampedImages} images + {clampedVideos} videos
          <span className="text-zinc-500 text-xs ml-1">({effectiveTotal} total)</span>
        </button>

        {showMixer && (
          <CreativeMix
            total={effectiveTotal}
            imageCount={clampedImages}
            videoCount={clampedVideos}
            videoModelId={videoModelId}
            videoDuration={videoDuration}
            onChange={(m) => setMix(m)}
            onModelChange={setVideoModelId}
            onDurationChange={setVideoDuration}
          />
        )}

        {/* Bulk generate / progress */}
        {isBulkGen ? (
          <div className="card space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 font-medium flex items-center gap-2">
                <Loader size={14} className="animate-spin text-teal-400" />
                Generating creatives…
              </span>
              <span className="text-zinc-400">{bulkDone}/{bulkTotal}</span>
            </div>
            <div className="w-full bg-surface-800 rounded-full h-2">
              <div className="bg-teal-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(bulkDone / bulkTotal) * 100}%` }} />
            </div>
            <div className="bg-surface-800/50 rounded-xl p-3 font-mono text-xs text-zinc-400 space-y-0.5 max-h-24 overflow-y-auto">
              {bulkLog.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="btn-primary text-sm"
              onClick={handleBulkGenerate}
              disabled={clampedImages + clampedVideos === 0}
            >
              <Sparkles size={14} />
              Generate {clampedImages > 0 ? `${clampedImages} image${clampedImages !== 1 ? 's' : ''}` : ''}
              {clampedImages > 0 && clampedVideos > 0 ? ' + ' : ''}
              {clampedVideos > 0 ? `${clampedVideos} video${clampedVideos !== 1 ? 's' : ''}` : ''}
            </button>
            {variations.filter((v) => v.imageUrl || v.videoUrl).length > 0 && (
              <button className="btn-secondary text-sm" onClick={handleZipDownload} title="Download all creatives as ZIP">
                <Download size={14} />
                ZIP Download
              </button>
            )}
            {selectedVariations.length > 0 && (
              <button className="btn-primary text-sm" onClick={() => setActiveTab('upload')}>
                Push {selectedVariations.length} to Facebook <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* No results */}
      {filtered.length === 0 && variations.length > 0 && (
        <div className="card">
          <div className="empty-state">
            <p className="empty-title">No matches</p>
            <p className="empty-body">Try a different search or angle filter</p>
          </div>
        </div>
      )}

      {/* Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => (
            <VariationCard
              key={v.id}
              variation={v}
              brandContext={brandContext}
              selected={selectedVariations.includes(v.id)}
              cardStatus={cardStatus[v.id]}
              onToggle={() => toggleSelectVariation(v.id)}
              onDelete={() => handleDelete(v.id)}
              onDuplicate={() => handleDuplicate(v)}
              onEdit={() => setEditingId(v.id)}
              onPreview={() => setPreviewId(v.id)}
              onGenImage={() => handleGenImage(v)}
              onGenVideo={() => handleGenVideo(v)}
              onAnimate={() => handleAnimate(v)}
              editing={editingId === v.id}
              onSave={(updates) => { updateVariation(v.id, updates); setEditingId(null) }}
              onCancelEdit={() => setEditingId(null)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <ListRow
              key={v.id}
              variation={v}
              selected={selectedVariations.includes(v.id)}
              cardStatus={cardStatus[v.id]}
              onToggle={() => toggleSelectVariation(v.id)}
              onDelete={() => handleDelete(v.id)}
              onPreview={() => setPreviewId(v.id)}
              onGenImage={() => handleGenImage(v)}
              onGenVideo={() => handleGenVideo(v)}
            />
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewId && (() => {
        const v = variations.find((x) => x.id === previewId)
        return v ? (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
            <div onClick={(e) => e.stopPropagation()} className="space-y-4 max-h-[90vh] overflow-y-auto">
              {v.videoUrl ? (
                <div className="bg-black rounded-2xl overflow-hidden max-w-sm mx-auto">
                  <video src={v.videoUrl} controls autoPlay loop className="w-full" />
                </div>
              ) : (
                <AdPreview variation={v} brandContext={brandContext} format={v.format || 'feed'} />
              )}
              {v.creativePrompt && (
                <div className="bg-surface-900 border border-white/[0.06] rounded-xl p-3 max-w-sm">
                  <p className="text-xs text-zinc-500 font-medium mb-1">Creative prompt used</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{v.creativePrompt}</p>
                </div>
              )}
              <button className="btn-secondary w-full justify-center" onClick={() => setPreviewId(null)}>Close</button>
            </div>
          </div>
        ) : null
      })()}
    </div>
  )
}

// ── Copy overlay — headline + CTA on top of image/video ───────
function CopyOverlay({ variation }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-end pointer-events-none rounded-xl overflow-hidden">
      {/* Dark gradient from bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {/* Text content */}
      <div className="relative z-10 p-3 space-y-2">
        <p className="text-white font-bold text-sm leading-tight drop-shadow-lg line-clamp-2">
          {variation.headline}
        </p>
        {variation.description && (
          <p className="text-white/80 text-xs leading-snug line-clamp-1 drop-shadow">
            {variation.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-[10px]">{variation.primaryText?.substring(0, 45)}…</span>
          <span className="bg-white text-gray-900 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap flex-shrink-0">
            {variation.cta || 'Learn More'}
          </span>
        </div>
      </div>
    </div>
  )
}

function VariationCard({ variation, brandContext, selected, cardStatus, onToggle, onDelete, onDuplicate, onEdit, onPreview, onGenImage, onGenVideo, onAnimate, editing, onSave, onCancelEdit }) {
  const [draft, setDraft] = useState({ ...variation })
  const [showOverlay, setShowOverlay] = useState(false)
  const isLoading = !!cardStatus
  const hasCreative = !!(variation.imageUrl || variation.videoUrl)

  if (editing) {
    return (
      <div className="card border-brand-500/50 space-y-3">
        <div><label className="text-xs text-zinc-400 mb-1 block">Headline</label>
          <input className="input text-sm" value={draft.headline} onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))} /></div>
        <div><label className="text-xs text-zinc-400 mb-1 block">Primary Text</label>
          <textarea className="textarea text-sm" rows={4} value={draft.primaryText} onChange={(e) => setDraft((d) => ({ ...d, primaryText: e.target.value }))} /></div>
        <div><label className="text-xs text-zinc-400 mb-1 block">Description</label>
          <input className="input text-sm" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} /></div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1 justify-center text-sm" onClick={() => onSave(draft)}>Save</button>
          <button className="btn-secondary flex-1 justify-center text-sm" onClick={onCancelEdit}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`card relative flex flex-col transition-all duration-200 hover:border-gray-600 ${selected ? 'border-brand-500/70 bg-brand-500/5' : ''}`}>
      <button className="absolute top-3 left-3 z-10" onClick={onToggle}>
        {selected ? <CheckSquare size={18} className="text-brand-400" /> : <Square size={18} className="text-zinc-600 hover:text-zinc-400" />}
      </button>
      <div className="absolute top-3 right-3 text-xs text-zinc-600 font-mono">#{variation.index}</div>

      {/* Creative area */}
      <div className="mt-4 mb-3 relative cursor-pointer" onClick={onPreview}>
        {isLoading ? (
          <div className="aspect-[1.91/1] rounded-xl bg-surface-800 flex flex-col items-center justify-center gap-2">
            <Loader size={20} className="animate-spin text-teal-400" />
            <p className="text-xs text-zinc-400 text-center px-4">{cardStatus.label}</p>
          </div>
        ) : variation.videoUrl ? (
          <div className="aspect-[1.91/1] rounded-xl overflow-hidden relative group">
            <video src={variation.videoUrl} loop muted autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/60 px-2 py-1 rounded-lg flex items-center gap-1">
                <Video size={11} /> Preview
              </span>
            </div>
            <div className="absolute bottom-2 left-2 bg-black/60 rounded-lg px-1.5 py-0.5 flex items-center gap-1">
              <Video size={10} className="text-teal-400" />
              <span className="text-teal-300 text-[10px] font-semibold">VIDEO</span>
            </div>
            {showOverlay && <CopyOverlay variation={variation} />}
          </div>
        ) : variation.imageUrl ? (
          <div className="aspect-[1.91/1] rounded-xl overflow-hidden relative group">
            <img src={variation.imageUrl} alt="Ad creative" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-lg">Preview</span>
            </div>
            {showOverlay && <CopyOverlay variation={variation} />}
          </div>
        ) : (
          <AdPreview variation={variation} brandContext={brandContext} format={variation.format} compact />
        )}
      </div>

      {/* Copy */}
      <div className="space-y-1 px-1 flex-1">
        <p className="font-semibold text-white text-sm leading-tight line-clamp-2">{variation.headline}</p>
        {variation.targetSegment && (
          <p className="text-teal-400/70 text-[10px] font-medium truncate">→ {variation.targetSegment}</p>
        )}
        <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">{variation.primaryText}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
        <span className={`badge border text-xs ${ANGLE_COLORS[variation.angle] || ANGLE_COLORS.general}`}>
          {variation.angle?.replace('_', ' ')}
        </span>
        <div className="flex gap-1">
          <button className={`p-1.5 rounded-lg transition-colors ${variation.imageUrl ? 'text-blue-500 hover:text-blue-400' : 'text-zinc-500 hover:text-blue-400'} hover:bg-blue-900/20`} onClick={onGenImage} disabled={isLoading} title="Generate image">
            {cardStatus?.type === 'image' ? <Loader size={13} className="animate-spin" /> : <Image size={13} />}
          </button>
          <button className={`p-1.5 rounded-lg transition-colors ${variation.videoUrl ? 'text-teal-500 hover:text-teal-400' : 'text-zinc-500 hover:text-teal-400'} hover:bg-teal-900/20`} onClick={onGenVideo} disabled={isLoading} title="Generate video">
            {cardStatus?.type === 'video' ? <Loader size={13} className="animate-spin" /> : <Video size={13} />}
          </button>
          {variation.imageUrl && !variation.videoUrl && (
            <button
              className="p-1.5 rounded-lg transition-colors text-zinc-500 hover:text-purple-400 hover:bg-purple-900/20"
              onClick={onAnimate}
              disabled={isLoading}
              title="Animate image → video (Kling)"
            >
              {cardStatus?.type === 'animate' ? <Loader size={13} className="animate-spin text-purple-400" /> : <Zap size={13} />}
            </button>
          )}
          {hasCreative && (
            <button
              className={`p-1.5 rounded-lg transition-colors ${showOverlay ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-900/20'}`}
              onClick={(e) => { e.stopPropagation(); setShowOverlay((s) => !s) }}
              title="Toggle copy overlay"
            >
              <Type size={13} />
            </button>
          )}
          <button className="p-1.5 rounded-lg hover:bg-surface-800 text-zinc-500 hover:text-zinc-300" onClick={onEdit} title="Edit"><Edit3 size={13} /></button>
          <button className="p-1.5 rounded-lg hover:bg-surface-800 text-zinc-500 hover:text-zinc-300" onClick={onDuplicate} title="Duplicate"><Copy size={13} /></button>
          <button className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-500 hover:text-red-400" onClick={onDelete} title="Delete"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}

function ListRow({ variation, selected, cardStatus, onToggle, onDelete, onPreview, onGenImage, onGenVideo }) {
  const isLoading = !!cardStatus
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${selected ? 'bg-brand-500/5 border-brand-500/40' : 'bg-surface-900 border-white/[0.06] hover:border-white/[0.08]'}`}>
      <button onClick={onToggle}>
        {selected ? <CheckSquare size={16} className="text-brand-400" /> : <Square size={16} className="text-zinc-600" />}
      </button>
      <span className="text-xs text-zinc-600 font-mono w-6">#{variation.index}</span>

      {/* Thumbnail */}
      <div className="w-14 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-surface-800 flex items-center justify-center">
        {variation.videoUrl ? (
          <video src={variation.videoUrl} muted loop autoPlay playsInline className="w-full h-full object-cover" />
        ) : variation.imageUrl ? (
          <img src={variation.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-zinc-600 text-xs">none</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white text-sm truncate">{variation.headline}</p>
          {variation.videoUrl && <span className="badge bg-teal-900/40 text-teal-300 text-[10px]">VIDEO</span>}
          {variation.imageUrl && <span className="badge bg-blue-900/40 text-blue-300 text-[10px]">IMG</span>}
        </div>
        <p className="text-zinc-500 text-xs truncate mt-0.5">{variation.primaryText?.substring(0, 90)}…</p>
      </div>

      <span className={`badge border text-xs flex-shrink-0 ${ANGLE_COLORS[variation.angle] || ANGLE_COLORS.general}`}>{variation.angle?.replace('_', ' ')}</span>

      <div className="flex gap-1 flex-shrink-0">
        {isLoading
          ? <span className="text-xs text-teal-400 flex items-center gap-1"><Loader size={12} className="animate-spin" />{cardStatus.label?.substring(0, 20)}</span>
          : <>
              <button className={`p-1.5 rounded-lg ${variation.imageUrl ? 'text-blue-500 hover:text-blue-400' : 'text-zinc-500 hover:text-blue-400'} hover:bg-blue-900/20`} onClick={onGenImage} title="Image"><Image size={13} /></button>
              <button className={`p-1.5 rounded-lg ${variation.videoUrl ? 'text-teal-500 hover:text-teal-400' : 'text-zinc-500 hover:text-teal-400'} hover:bg-teal-900/20`} onClick={onGenVideo} title="Video"><Video size={13} /></button>
              <button className="p-1.5 rounded-lg hover:bg-surface-800 text-zinc-500 hover:text-zinc-300" onClick={onPreview}>👁</button>
              <button className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-500 hover:text-red-400" onClick={onDelete}><Trash2 size={13} /></button>
            </>
        }
      </div>
    </div>
  )
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
