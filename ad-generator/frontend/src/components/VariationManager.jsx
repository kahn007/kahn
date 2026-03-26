import React, { useState } from 'react'
import { LayoutGrid, List, Trash2, CheckSquare, Square, Edit3, Copy, ChevronRight, ImagePlus, Loader, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { generateAdImage } from '../lib/api'
import AdPreview from './AdPreview'

const ANGLE_COLORS = {
  pain_point:   'bg-red-900/30 text-red-300 border-red-800/50',
  outcome:      'bg-green-900/30 text-green-300 border-green-800/50',
  social_proof: 'bg-blue-900/30 text-blue-300 border-blue-800/50',
  curiosity:    'bg-yellow-900/30 text-yellow-300 border-yellow-800/50',
  authority:    'bg-purple-900/30 text-purple-300 border-purple-800/50',
  fomo:         'bg-orange-900/30 text-orange-300 border-orange-800/50',
  general:      'bg-gray-800 text-gray-400 border-gray-700',
}

export default function VariationManager() {
  const {
    variations, selectedVariations, brandContext,
    toggleSelectVariation, selectAll, clearSelection,
    removeVariation, updateVariation, setActiveTab, addVariations,
  } = useAdStore()

  const [viewMode, setViewMode]       = useState('grid')
  const [editingId, setEditingId]     = useState(null)
  const [filterAngle, setFilterAngle] = useState('all')
  const [previewId, setPreviewId]     = useState(null)
  const [generatingImages, setGeneratingImages] = useState({}) // id → true
  const [bulkGenerating, setBulkGenerating]     = useState(false)
  const [bulkProgress, setBulkProgress]         = useState({ done: 0, total: 0 })

  const filtered = filterAngle === 'all'
    ? variations
    : variations.filter((v) => v.angle === filterAngle)

  const allAngles = ['all', ...new Set(variations.map((v) => v.angle))]

  const handleDuplicate = (v) => {
    const { addVariations } = useAdStore.getState()
    addVariations([{ ...v, id: crypto.randomUUID(), index: variations.length + 1, imageUrl: null }])
    toast.success('Variation duplicated')
  }

  const handleDelete = (id) => {
    removeVariation(id)
    toast.success('Removed')
  }

  // Generate image for a single variation
  const handleGenerateImage = async (variation) => {
    setGeneratingImages((g) => ({ ...g, [variation.id]: true }))
    try {
      const result = await generateAdImage({
        variation,
        brandContext,
        format: variation.format || 'feed',
      })
      updateVariation(variation.id, { imageUrl: result.imageUrl, imagePrompt: result.imagePrompt })
      toast.success('Image generated!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGeneratingImages((g) => ({ ...g, [variation.id]: false }))
    }
  }

  // Bulk generate images for all selected (or all if none selected)
  const handleBulkGenerateImages = async () => {
    const targets = selectedVariations.length > 0
      ? variations.filter((v) => selectedVariations.includes(v.id))
      : variations.slice(0, 10) // cap at 10 for bulk to save cost

    setBulkGenerating(true)
    setBulkProgress({ done: 0, total: targets.length })

    for (let i = 0; i < targets.length; i++) {
      try {
        const result = await generateAdImage({
          variation: targets[i],
          brandContext,
          format: targets[i].format || 'feed',
        })
        updateVariation(targets[i].id, { imageUrl: result.imageUrl, imagePrompt: result.imagePrompt })
      } catch (err) {
        toast.error(`Variation ${targets[i].index}: ${err.message}`)
        if (err.message.includes('OpenAI')) break // stop if no key
      }
      setBulkProgress({ done: i + 1, total: targets.length })
      // DALL-E rate limit: ~5 req/min on free, 50/min on paid
      if (i < targets.length - 1) await sleep(1200)
    }

    setBulkGenerating(false)
    toast.success(`Images generated for ${bulkProgress.done} variations`)
  }

  if (variations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Variations</h2>
          <p className="text-gray-400 mt-1">All your generated ad variations will appear here.</p>
        </div>
        <div className="card text-center py-20">
          <LayoutGrid size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg font-medium">No variations yet</p>
          <p className="text-gray-600 text-sm mt-1 mb-6">Go to Generate Copy to create your first batch</p>
          <button className="btn-primary mx-auto" onClick={() => setActiveTab('generate')}>
            Generate Ad Copy
          </button>
        </div>
      </div>
    )
  }

  const selectedCount = selectedVariations.length
  const withImages    = variations.filter((v) => v.imageUrl).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Variations <span className="text-lg text-gray-500">{variations.length}</span>
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">
            {selectedCount > 0 ? `${selectedCount} selected · ` : ''}
            {withImages}/{variations.length} have images
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Angle filter */}
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {allAngles.map((angle) => (
              <button
                key={angle}
                onClick={() => setFilterAngle(angle)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  filterAngle === angle ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {angle === 'all' ? `All (${variations.length})` : angle.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Select all */}
          <button
            className="btn-ghost text-sm"
            onClick={() => selectedCount === variations.length ? clearSelection() : selectAll()}
          >
            {selectedCount === variations.length ? <CheckSquare size={14} /> : <Square size={14} />}
            {selectedCount === variations.length ? 'Deselect All' : 'Select All'}
          </button>

          {/* View toggle */}
          <div className="flex bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Bulk image gen */}
        {bulkGenerating ? (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-teal-900/20 border border-teal-800/50 rounded-xl">
            <Loader size={14} className="animate-spin text-teal-400" />
            <span className="text-sm text-teal-300">
              Generating images… {bulkProgress.done}/{bulkProgress.total}
            </span>
            <div className="w-24 bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            className="btn-secondary text-sm"
            onClick={handleBulkGenerateImages}
          >
            <Sparkles size={14} className="text-teal-400" />
            Generate Images for {selectedCount > 0 ? `${selectedCount} Selected` : `All (max 10)`}
          </button>
        )}

        {/* Push to FB */}
        {selectedCount > 0 && (
          <button className="btn-primary text-sm" onClick={() => setActiveTab('upload')}>
            Push {selectedCount} to Facebook
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => (
            <VariationCard
              key={v.id}
              variation={v}
              brandContext={brandContext}
              selected={selectedVariations.includes(v.id)}
              isGeneratingImage={!!generatingImages[v.id]}
              onToggle={() => toggleSelectVariation(v.id)}
              onDelete={() => handleDelete(v.id)}
              onDuplicate={() => handleDuplicate(v)}
              onEdit={() => setEditingId(v.id)}
              onPreview={() => setPreviewId(v.id)}
              onGenerateImage={() => handleGenerateImage(v)}
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
              isGeneratingImage={!!generatingImages[v.id]}
              onToggle={() => toggleSelectVariation(v.id)}
              onDelete={() => handleDelete(v.id)}
              onPreview={() => setPreviewId(v.id)}
              onGenerateImage={() => handleGenerateImage(v)}
            />
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewId && (() => {
        const v = variations.find((x) => x.id === previewId)
        return v ? (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewId(null)}
          >
            <div onClick={(e) => e.stopPropagation()} className="space-y-4">
              <AdPreview variation={v} brandContext={brandContext} format={v.format || 'feed'} />
              {v.imagePrompt && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 max-w-sm">
                  <p className="text-xs text-gray-500 font-medium mb-1">Image prompt used</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{v.imagePrompt}</p>
                </div>
              )}
              <button className="btn-secondary w-full justify-center" onClick={() => setPreviewId(null)}>
                Close Preview
              </button>
            </div>
          </div>
        ) : null
      })()}
    </div>
  )
}

function VariationCard({ variation, brandContext, selected, isGeneratingImage, onToggle, onDelete, onDuplicate, onEdit, onPreview, onGenerateImage, editing, onSave, onCancelEdit }) {
  const [draft, setDraft] = useState({ ...variation })

  if (editing) {
    return (
      <div className="card border-brand-500/50 space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Headline</label>
          <input className="input text-sm" value={draft.headline} onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Primary Text</label>
          <textarea className="textarea text-sm" rows={4} value={draft.primaryText} onChange={(e) => setDraft((d) => ({ ...d, primaryText: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Description</label>
          <input className="input text-sm" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1 justify-center text-sm" onClick={() => onSave(draft)}>Save</button>
          <button className="btn-secondary flex-1 justify-center text-sm" onClick={onCancelEdit}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`card relative flex flex-col transition-all duration-200 hover:border-gray-600 ${selected ? 'border-brand-500/70 bg-brand-500/5' : ''}`}>
      {/* Select */}
      <button className="absolute top-3 left-3 z-10" onClick={onToggle}>
        {selected ? <CheckSquare size={18} className="text-brand-400" /> : <Square size={18} className="text-gray-600 hover:text-gray-400" />}
      </button>
      <div className="absolute top-3 right-3 text-xs text-gray-600 font-mono">#{variation.index}</div>

      {/* Image area */}
      <div className="mt-4 mb-3 relative" onClick={onPreview}>
        {variation.imageUrl ? (
          <div className="aspect-[1.91/1] rounded-xl overflow-hidden cursor-pointer group">
            <img src={variation.imageUrl} alt="Ad creative" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-lg">Preview</span>
            </div>
          </div>
        ) : (
          <AdPreview variation={variation} brandContext={brandContext} format={variation.format} compact />
        )}
      </div>

      {/* Copy */}
      <div className="space-y-1 px-1 flex-1">
        <p className="font-semibold text-white text-sm leading-tight line-clamp-2">{variation.headline}</p>
        <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{variation.primaryText}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
        <span className={`badge border text-xs ${ANGLE_COLORS[variation.angle] || ANGLE_COLORS.general}`}>
          {variation.angle?.replace('_', ' ')}
        </span>
        <div className="flex gap-1">
          {/* Generate image button */}
          <button
            className={`p-1.5 rounded-lg transition-colors text-xs font-medium flex items-center gap-1 ${
              variation.imageUrl
                ? 'hover:bg-gray-800 text-teal-600 hover:text-teal-400'
                : 'hover:bg-teal-900/30 text-gray-500 hover:text-teal-400'
            }`}
            onClick={onGenerateImage}
            disabled={isGeneratingImage}
            title={variation.imageUrl ? 'Regenerate image' : 'Generate image'}
          >
            {isGeneratingImage
              ? <Loader size={13} className="animate-spin" />
              : <ImagePlus size={13} />
            }
          </button>
          <button className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors" onClick={onEdit} title="Edit"><Edit3 size={13} /></button>
          <button className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors" onClick={onDuplicate} title="Duplicate"><Copy size={13} /></button>
          <button className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors" onClick={onDelete} title="Delete"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}

function ListRow({ variation, selected, isGeneratingImage, onToggle, onDelete, onPreview, onGenerateImage }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      selected ? 'bg-brand-500/5 border-brand-500/40' : 'bg-gray-900 border-gray-800 hover:border-gray-700'
    }`}>
      <button onClick={onToggle}>
        {selected ? <CheckSquare size={16} className="text-brand-400" /> : <Square size={16} className="text-gray-600" />}
      </button>

      <span className="text-xs text-gray-600 font-mono w-6">#{variation.index}</span>

      {/* Thumbnail */}
      {variation.imageUrl
        ? <img src={variation.imageUrl} alt="" className="w-12 h-8 object-cover rounded-lg flex-shrink-0" />
        : <div className="w-12 h-8 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-600 text-xs">img</div>
      }

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate">{variation.headline}</p>
        <p className="text-gray-500 text-xs truncate mt-0.5">{variation.primaryText?.substring(0, 100)}…</p>
      </div>

      <span className={`badge border text-xs flex-shrink-0 ${ANGLE_COLORS[variation.angle] || ANGLE_COLORS.general}`}>
        {variation.angle?.replace('_', ' ')}
      </span>

      <div className="flex gap-1 flex-shrink-0">
        <button
          className={`p-1.5 rounded-lg transition-colors ${variation.imageUrl ? 'text-teal-600 hover:text-teal-400' : 'text-gray-500 hover:text-teal-400'} hover:bg-teal-900/20`}
          onClick={onGenerateImage}
          disabled={isGeneratingImage}
          title={variation.imageUrl ? 'Regenerate image' : 'Generate image'}
        >
          {isGeneratingImage ? <Loader size={13} className="animate-spin" /> : <ImagePlus size={13} />}
        </button>
        <button className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300" onClick={onPreview}>👁</button>
        <button className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-500 hover:text-red-400" onClick={onDelete}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
