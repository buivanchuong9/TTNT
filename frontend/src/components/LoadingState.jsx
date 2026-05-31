import React from 'react'
import { Loader2, Upload, ScanSearch, Brain, FileCheck } from 'lucide-react'

const STAGES = [
  { key: 'upload',   icon: Upload,     label: 'Tải ảnh lên',          desc: 'Đang gửi đến máy chủ AI' },
  { key: 'segment',  icon: ScanSearch, label: 'Phân đoạn UNet++',     desc: 'Xác định ranh giới tổn thương' },
  { key: 'classify', icon: Brain,      label: 'Phân loại bệnh',       desc: 'Xếp hạng các bệnh khả năng' },
  { key: 'report',   icon: FileCheck,  label: 'Tổng hợp kết quả',    desc: 'Tra cứu cơ sở tri thức y tế' },
]

export default function LoadingState({ stage, uploadPct, previewSrc }) {
  const activeIdx = stage === 'uploading' ? 0 : 2

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
      <div className="grid md:grid-cols-2 gap-6">

        {/* Preview */}
        <div className="card flex flex-col items-center justify-center gap-4 min-h-[300px]">
          {previewSrc ? (
            <div className="relative w-full overflow-hidden rounded-xl border border-gray-200">
              <img src={previewSrc} alt="Preview" className="w-full max-h-64 object-contain bg-gray-50" />
              <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                <div className="absolute left-0 right-0 h-0.5 bg-blue-500/70 animate-scan" />
              </div>
            </div>
          ) : (
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          )}
          <p className="text-gray-500 text-sm text-center">
            {stage === 'uploading' ? `Đang tải… ${uploadPct}%` : 'Đang chạy AI inference…'}
          </p>
          {stage === 'uploading' && (
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          )}
        </div>

        {/* Pipeline steps */}
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Quy trình xử lý</h3>
          {STAGES.map((s, i) => {
            const Icon   = s.icon
            const done   = i < activeIdx
            const active = i === activeIdx
            return (
              <div key={s.key} className={`
                flex items-center gap-3 p-3 rounded-xl border transition-all duration-300
                ${active  ? 'border-blue-200 bg-blue-50' : done ? 'border-gray-100 bg-gray-50' : 'border-transparent'}
              `}>
                <div className={`
                  w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                  ${done   ? 'bg-green-100' : active ? 'bg-blue-100' : 'bg-gray-100'}
                `}>
                  {active
                    ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    : done
                    ? <span className="text-green-600 font-bold text-sm">✓</span>
                    : <Icon className="w-4 h-4 text-gray-400" />
                  }
                </div>
                <div>
                  <p className={`text-sm font-semibold ${active ? 'text-blue-700' : done ? 'text-green-700' : 'text-gray-400'}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
