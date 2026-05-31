import React from 'react'
import { BarChart2, Clock, Ruler, Target, Cpu, CheckSquare } from 'lucide-react'

export default function MetadataPanel({ metadata, explainability, classifierType }) {
  const items = [
    {
      icon: Target,
      label: 'Diện tích tổn thương',
      value: `${metadata?.lesion_area_percent?.toFixed(1) ?? '—'}%`,
      sub: 'trên tổng diện tích ảnh',
      accent: 'blue',
    },
    {
      icon: Ruler,
      label: 'Bounding Box',
      value: (metadata?.bounding_box_width && metadata?.bounding_box_height)
               ? `${metadata.bounding_box_width} × ${metadata.bounding_box_height}`
               : '—',
      sub: 'pixel (Rộng × Cao)',
      accent: 'blue',
    },
    {
      icon: Clock,
      label: 'Thời gian xử lý',
      value: metadata?.inference_time_ms ? `${metadata.inference_time_ms.toFixed(0)} ms` : '—',
      sub: 'tổng pipeline end-to-end',
      accent: 'green',
    },
    {
      icon: CheckSquare,
      label: 'ROI được phát hiện',
      value: explainability?.roi_detected ? 'Có ✓' : 'Không',
      sub: 'vùng tổn thương xác định',
      accent: explainability?.roi_detected ? 'green' : 'red',
    },
    {
      icon: BarChart2,
      label: 'Độ tin cậy',
      value: explainability?.confidence_level ?? '—',
      sub: 'mức xác suất dự đoán',
      accent: explainability?.confidence_level === 'High' ? 'green'
            : explainability?.confidence_level === 'Medium' ? 'yellow' : 'gray',
    },
    {
      icon: Cpu,
      label: 'Bộ phân loại',
      value: classifierType?.includes('ML') ? 'ML Model' : 'Rule-Based',
      sub: classifierType ? classifierType.split('(')[0].trim() : '',
      accent: 'blue',
    },
  ]

  const ACCENT = {
    blue:   'text-blue-600 bg-blue-50',
    green:  'text-green-600 bg-green-50',
    red:    'text-red-600 bg-red-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    gray:   'text-gray-500 bg-gray-100',
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <BarChart2 className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-900">Thông Số Phân Tích</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.icon
          const ac = ACCENT[item.accent] || ACCENT.gray
          return (
            <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ac}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 font-mono leading-tight">{item.value}</p>
                <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                {item.sub && <p className="text-xs text-gray-400 truncate">{item.sub}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
