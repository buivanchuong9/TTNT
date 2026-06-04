import React from 'react'
import { AlertTriangle, RefreshCw, ShieldX, ImageOff } from 'lucide-react'

export default function ErrorState({ message, partialResult, onRetry }) {
  const isQualityError = message?.toLowerCase().includes('blur')
    || message?.toLowerCase().includes('dark')
    || message?.toLowerCase().includes('overexpos')
    || message?.toLowerCase().includes('bright')
    || message?.toLowerCase().includes('lesion')

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-5">

      {/* Error banner */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
            {isQualityError
              ? <ImageOff className="w-6 h-6 text-red-600" />
              : <AlertTriangle className="w-6 h-6 text-red-600" />
            }
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-base font-bold text-red-900">
              {isQualityError ? 'Image Quality Rejection' : 'Analysis Failed'}
            </h3>
            <p className="text-sm text-red-700 leading-relaxed">{message}</p>
            {isQualityError && (
              <ul className="mt-2 space-y-1 text-xs text-red-600">
                <li>▸ Use a well-lit, in-focus dermoscopy image</li>
                <li>▸ Minimum recommended resolution: 600 × 450 px</li>
                <li>▸ Ensure the lesion is centred and clearly visible</li>
              </ul>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-red-200">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try a Different Image
          </button>
        </div>
      </div>

      {/* Partial images if available */}
      {partialResult?.images?.original && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 opacity-60">
          {['original', 'mask', 'heatmap', 'roi'].map(key =>
            partialResult.images?.[key] ? (
              <div key={key} className="card p-2 space-y-1.5">
                <img
                  src={partialResult.images[key]}
                  alt={key}
                  className="w-full h-28 object-contain rounded-lg bg-gray-50"
                />
                <p className="text-xs text-gray-500 text-center capitalize font-medium">{key}</p>
              </div>
            ) : null
          )}
        </div>
      )}

    </div>
  )
}
