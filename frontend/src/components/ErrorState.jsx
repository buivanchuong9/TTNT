import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorState({ message, partialResult, onRetry }) {
  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
      <div className="card border-red-200 bg-red-50">
        <div className="flex flex-col md:flex-row items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-bold text-red-900">Phân tích thất bại</h3>
            <p className="text-red-700 text-sm leading-relaxed">{message}</p>
            <div className="pt-2">
              <button
                onClick={onRetry}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Thử ảnh khác
              </button>
            </div>
          </div>
        </div>
      </div>

      {partialResult?.images?.original && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 opacity-70">
          {['original', 'mask', 'heatmap', 'roi'].map(key =>
            partialResult.images[key] ? (
              <div key={key} className="card p-3 space-y-2">
                <img src={partialResult.images[key]} alt={key} className="w-full h-28 object-contain rounded-lg bg-gray-50" />
                <p className="text-xs text-gray-500 text-center capitalize font-medium">{key}</p>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
