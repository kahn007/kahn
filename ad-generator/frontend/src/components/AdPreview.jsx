import React from 'react'
import { ThumbsUp, MessageSquare, Share2, MoreHorizontal, ImagePlus } from 'lucide-react'

const FORMAT_ASPECT = {
  feed:   'aspect-[1.91/1]',
  square: 'aspect-square',
  story:  'aspect-[9/16] max-h-96',
}

export default function AdPreview({ variation, brandContext, format = 'feed', compact = false }) {
  const { headline, primaryText, description, cta, imageUrl } = variation
  const { brandName = 'Brayne AI', website = 'brayneai.com' } = brandContext || {}

  if (compact) {
    return (
      <div className="bg-white rounded-xl overflow-hidden text-gray-900 shadow-lg w-full">
        {/* Image area */}
        <div className={`${FORMAT_ASPECT[format]} relative overflow-hidden`}>
          {imageUrl ? (
            <img src={imageUrl} alt="Ad creative" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-blue-900 flex items-center justify-center">
              <div className="text-center p-3">
                <div className="text-3xl mb-1">⚡</div>
                <p className="text-white/70 text-xs">{brandName}</p>
              </div>
            </div>
          )}
          {!imageUrl && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/50 rounded-lg px-1.5 py-0.5 flex items-center gap-1">
              <ImagePlus size={10} className="text-white/60" />
              <span className="text-white/60 text-[10px]">No image</span>
            </div>
          )}
        </div>
        {/* Text row */}
        <div className="p-2 border-t border-gray-100 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-gray-400 text-[10px] uppercase tracking-wide truncate">{website}</p>
            <p className="font-bold text-xs leading-tight line-clamp-2 text-gray-900 mt-0.5">{headline}</p>
          </div>
          <span className="flex-shrink-0 bg-gray-200 text-gray-700 text-[10px] font-semibold px-2 py-1 rounded whitespace-nowrap">
            {cta || 'Learn More'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-sm mx-auto">
      {/* FB post header */}
      <div className="p-3 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {brandName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-none">{brandName}</p>
          <p className="text-gray-500 text-xs mt-0.5">Sponsored · 🌐</p>
        </div>
        <MoreHorizontal size={18} className="text-gray-400" />
      </div>

      {/* Primary text */}
      <div className="px-3 pb-2">
        <p className="text-gray-800 text-sm leading-relaxed line-clamp-4">{primaryText}</p>
      </div>

      {/* Image */}
      <div className={`${FORMAT_ASPECT[format]} relative overflow-hidden`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Ad creative"
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-blue-900 flex flex-col items-center justify-center gap-2 p-6">
            <div className="text-5xl">⚡</div>
            <p className="text-white font-bold text-lg">{brandName}</p>
            <p className="text-white/60 text-xs">{website}</p>
            <div className="mt-2 flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
              <ImagePlus size={12} className="text-white/50" />
              <span className="text-white/50 text-xs">Add image in Variations tab</span>
            </div>
          </div>
        )}
      </div>

      {/* CTA row */}
      <div className="border-t border-gray-100 p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-gray-500 text-xs uppercase tracking-wide truncate">{website}</p>
          <p className="font-bold text-gray-900 text-sm leading-tight line-clamp-1 mt-0.5">{headline}</p>
          {description && <p className="text-gray-500 text-xs truncate mt-0.5">{description}</p>}
        </div>
        <button className="flex-shrink-0 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-xs px-3 py-1.5 rounded-md transition-colors whitespace-nowrap">
          {cta || 'Learn More'}
        </button>
      </div>

      {/* Reactions */}
      <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-4">
        {[{ icon: ThumbsUp, label: 'Like' }, { icon: MessageSquare, label: 'Comment' }, { icon: Share2, label: 'Share' }].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-xs font-medium transition-colors">
            <Icon size={14} />{label}
          </button>
        ))}
      </div>
    </div>
  )
}
