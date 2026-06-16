import React, { useEffect, useState } from 'react'
import { Loader2, Upload, ScanSearch, Brain, Scissors, Sliders, BarChart2, Eye, FileCheck, ShieldCheck } from 'lucide-react'

const PIPELINE_STAGES = [
  { icon: ShieldCheck,  label: 'Kiểm tra chất lượng ảnh',   desc: 'Độ mờ · độ sáng · độ tương phản' },
  { icon: ScanSearch,   label: 'Phân vùng UNet++',   desc: 'Phát hiện ranh giới tổn thương' },
  { icon: Scissors,     label: 'Tinh chỉnh mặt nạ',       desc: 'LCC · bao lồi · làm mịn' },
  { icon: Upload,       label: 'Trích xuất ROI',        desc: 'Cắt vùng tổn thương có đệm' },
  { icon: Brain,        label: 'Phân loại EfficientNet', desc: 'Phân tích đặc trưng sâu' },
  { icon: Sliders,      label: 'Hiệu chỉnh độ tin cậy', desc: 'Tỷ lệ nhiệt độ T=1.3' },
  { icon: BarChart2,    label: 'Xếp hạng Top-K',         desc: 'Danh sách chẩn đoán phân biệt' },
  { icon: Eye,          label: 'Tính minh bạch',        desc: 'Tạo siêu dữ liệu lâm sàng' },
  { icon: FileCheck,    label: 'Truy xuất tri thức',  desc: 'Tra cứu cơ sở dữ liệu y khoa' },
]

export default function LoadingState({ stage, uploadPct, previewSrc }) {
  const [activeIdx, setActiveIdx] = useState(stage === 'uploading' ? 0 : 1)

  useEffect(() => {
    if (stage !== 'analyzing') return
    const id = setInterval(() => {
      setActiveIdx(prev => Math.min(prev + 1, PIPELINE_STAGES.length - 1))
    }, 280)
    return () => clearInterval(id)
  }, [stage])

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-6">
      <div className="grid md:grid-cols-2 gap-6">

        {/* Image preview with scan overlay */}
        <div className="card flex flex-col gap-4 min-h-[320px] justify-center">
          <div className="text-center">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">
              {stage === 'uploading' ? 'Đang tải ảnh lên' : 'Đang chạy quy trình AI'}
            </p>
          </div>

          {previewSrc ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
              <img
                src={previewSrc}
                alt="Preview"
                className="w-full max-h-52 object-contain"
              />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan opacity-80" />
              </div>
              {/* Corner brackets */}
              <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-blue-500 rounded-tl" />
              <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-blue-500 rounded-tr" />
              <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-blue-500 rounded-bl" />
              <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-blue-500 rounded-br" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
          )}

          {stage === 'uploading' ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Đang tải lên…</span>
                <span className="font-bold text-blue-600">{uploadPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-blue-700 bg-blue-50 rounded-xl px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">
                  {PIPELINE_STAGES[Math.min(activeIdx, PIPELINE_STAGES.length - 1)]?.label}…
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Pipeline progress steps */}
        <div className="card">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            Tiến trình AI
          </h3>
          <div className="space-y-1.5">
            {PIPELINE_STAGES.map((s, i) => {
              const Icon   = s.icon
              const done   = i < activeIdx
              const active = i === activeIdx
              const future = i > activeIdx

              return (
                <div
                  key={s.label}
                  className={`
                    flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300
                    ${active  ? 'border-blue-200 bg-blue-50 shadow-sm'
                      : done  ? 'border-green-100 bg-green-50/50'
                      : 'border-transparent'}
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                    ${active ? 'bg-blue-100 shadow-sm'
                      : done  ? 'bg-green-100'
                      : 'bg-gray-100'}
                  `}>
                    {active
                      ? <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      : done
                      ? <span className="text-green-600 font-bold text-xs">✓</span>
                      : <Icon className={`w-3.5 h-3.5 ${future ? 'text-gray-300' : 'text-gray-400'}`} />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate
                      ${active ? 'text-blue-700' : done ? 'text-green-700' : 'text-gray-400'}
                    `}>
                      {s.label}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{s.desc}</p>
                  </div>
                  {done && (
                    <span className="ml-auto text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      Xong
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
