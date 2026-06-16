import React, { useState } from 'react'
import { ChevronRight, Layers, ScanSearch, Thermometer, Crop, Brain, ZoomIn, ZoomOut } from 'lucide-react'

const STEPS = [
  { key: 'original', label: 'Ảnh gốc',     icon: Layers,      desc: 'Hình ảnh đầu vào',                color: 'bg-slate-600' },
  { key: 'mask',     label: 'Mặt nạ phân vùng', icon: ScanSearch,  desc: 'Tinh chỉnh UNet++ + LCC',    color: 'bg-blue-600' },
  { key: 'heatmap',  label: 'Bản đồ nhiệt',      icon: Thermometer, desc: 'Lớp phủ xác suất (JET)',  color: 'bg-orange-500' },
  { key: 'roi',      label: 'Trích xuất ROI',     icon: Crop,        desc: 'Vùng tổn thương cho bộ phân loại', color: 'bg-indigo-600' },
]

export default function ProcessingPipeline({ images }) {
  const [active, setActive]     = useState('original')
  const [zoomed, setZoomed]     = useState(false)
  const activeStep              = STEPS.find(s => s.key === active) || STEPS[0]

  return (
    <section className="card animate-slide-up max-w-7xl mx-auto" id="pipeline">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Quy trình xử lý AI</h2>
            <p className="text-xs text-gray-400">4 đầu ra trực quan · nhấp để phóng to</p>
          </div>
        </div>
        <button
          onClick={() => setZoomed(z => !z)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          {zoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
          {zoomed ? 'Thu gọn' : 'Phóng to'}
        </button>
      </div>

      {/* Step tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {STEPS.map((step, i) => {
          const Icon     = step.icon
          const isActive = active === step.key
          return (
            <React.Fragment key={step.key}>
              <button
                onClick={() => setActive(step.key)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200
                  ${isActive
                    ? `${step.color} text-white border-transparent shadow-sm`
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5" />
                {step.label}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Thumbnail strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {STEPS.map(step => (
          <button
            key={step.key}
            onClick={() => setActive(step.key)}
            className={`
              relative rounded-2xl overflow-hidden border-2 transition-all duration-200 text-left group
              ${active === step.key
                ? 'border-blue-500 ring-2 ring-blue-100 shadow-md'
                : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
              }
            `}
          >
            <img
              src={images?.[step.key]}
              alt={step.label}
              className="w-full h-32 object-cover bg-gray-50"
            />
            <div className={`
              absolute bottom-0 left-0 right-0 px-2.5 py-2 text-xs font-semibold transition-all
              ${active === step.key
                ? `${step.color} text-white`
                : 'bg-white/90 text-gray-700 border-t border-gray-100'}
            `}>
              <div className="font-bold truncate">{step.label}</div>
              <div className="opacity-75 text-[10px] truncate">{step.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Main viewer */}
      <div className={`rounded-2xl overflow-hidden border-2 border-gray-100 bg-gray-50 transition-all duration-300 ${zoomed ? 'max-h-none' : 'max-h-[480px]'}`}>
        <div className="relative">
          <img
            src={images?.[active]}
            alt={activeStep.label}
            className={`w-full object-contain transition-all duration-300 ${zoomed ? '' : 'max-h-[480px]'}`}
          />
          {/* Label overlay */}
          <div className={`absolute top-3 left-3 flex items-center gap-2 ${activeStep.color} text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm`}>
            {React.createElement(activeStep.icon, { className: 'w-3.5 h-3.5' })}
            {activeStep.label}
          </div>
        </div>
      </div>
    </section>
  )
}
