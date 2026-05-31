import React from 'react'
import { Info, Stethoscope, Calendar, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react'

const RISK_CONFIG = {
  Critical: { bar: 'bg-red-500',    bg: 'bg-red-50 border-red-200',    text: 'text-red-700',    icon: ShieldAlert,   label: 'Nguy cơ Nghiêm trọng' },
  High:     { bar: 'bg-orange-500', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: AlertTriangle, label: 'Nguy cơ Cao' },
  Medium:   { bar: 'bg-yellow-500', bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: Info,          label: 'Nguy cơ Trung bình' },
  Low:      { bar: 'bg-green-500',  bg: 'bg-green-50 border-green-200',  text: 'text-green-700',  icon: CheckCircle,   label: 'Nguy cơ Thấp' },
}

export default function DiseaseDetails({ disease }) {
  if (!disease) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 min-h-[250px] text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Info className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-gray-400 text-sm">Chọn một bệnh từ danh sách xếp hạng để xem chi tiết</p>
      </div>
    )
  }

  const risk    = RISK_CONFIG[disease.risk_level] || RISK_CONFIG.Low
  const RiskIcon = risk.icon

  return (
    <div className="card space-y-5 animate-fade-in">

      {/* Header */}
      <div className="pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              {disease.code}
            </span>
            <span className="text-xs font-bold text-white bg-blue-600 px-2.5 py-0.5 rounded-full">
              {disease.confidence_pct}% xác suất
            </span>
          </div>
          <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 flex-shrink-0 ${risk.bg}`}>
            <RiskIcon className={`w-3.5 h-3.5 ${risk.text}`} />
            <span className={`text-xs font-semibold ${risk.text}`}>{risk.label}</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-900">{disease.name_en}</h3>
        <p className="text-gray-500 text-sm">{disease.name_vi}</p>
      </div>

      {/* Description */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
          <Info className="w-3.5 h-3.5" />
          Mô tả lâm sàng
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{disease.description || '—'}</p>
      </section>

      {/* Recommendation */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
          <Stethoscope className="w-3.5 h-3.5" />
          Khuyến nghị điều trị
        </div>
        <div className={`text-sm text-gray-700 leading-relaxed border rounded-xl p-4 ${risk.bg}`}>
          {disease.recommendation || '—'}
        </div>
      </section>

      {/* Follow-up */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
          <Calendar className="w-3.5 h-3.5" />
          Lịch tái khám
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{disease.follow_up || '—'}</p>
      </section>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Kết quả AI chỉ mang tính tham khảo nghiên cứu. Không thay thế chẩn đoán của bác sĩ da liễu chuyên khoa.
        </p>
      </div>
    </div>
  )
}
