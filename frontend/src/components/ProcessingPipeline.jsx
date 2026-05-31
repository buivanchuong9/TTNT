import React, { useState } from 'react'
import { ChevronRight, ScanSearch, Layers, Thermometer, Crop, Brain } from 'lucide-react'

const STEPS = [
  { key: 'original', label: 'Ảnh gốc',      icon: Layers,      desc: 'Input gốc' },
  { key: 'mask',     label: 'Mặt nạ',        icon: ScanSearch,  desc: 'UNet++ mask' },
  { key: 'heatmap',  label: 'Heatmap',       icon: Thermometer, desc: 'Xác suất' },
  { key: 'roi',      label: 'ROI',           icon: Crop,        desc: 'Vùng tổn thương' },
]

export default function ProcessingPipeline({ images }) {
  const [active, setActive] = useState('original')

  return (
    <div className="card animate-slide-up max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <Brain className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">Quy Trình Xử Lý AI</h2>
        <span className="text-xs text-gray-400 ml-1">Nhấn ảnh để phóng to</span>
      </div>

      {/* Step tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isActive = active === step.key
          return (
            <React.Fragment key={step.key}>
              <button
                onClick={() => setActive(step.key)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {step.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {STEPS.map(step => (
          <button
            key={step.key}
            onClick={() => setActive(step.key)}
            className={`
              relative rounded-xl overflow-hidden border transition-all duration-200 text-left
              ${active === step.key
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-blue-300'
              }
            `}
          >
            <img
              src={images?.[step.key]}
              alt={step.label}
              className="w-full h-36 object-cover bg-gray-100"
            />
            <div className={`
              absolute bottom-0 left-0 right-0 px-2.5 py-2 text-xs font-semibold
              ${active === step.key ? 'bg-blue-600 text-white' : 'bg-white/90 text-gray-700 border-t border-gray-200'}
            `}>
              {step.label} — {step.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Large view */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
        <img
          src={images?.[active]}
          alt={active}
          className="w-full max-h-[500px] object-contain"
        />
      </div>
    </div>
  )
}
