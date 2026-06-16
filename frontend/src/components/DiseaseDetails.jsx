import React from 'react'
import {
  Info, Stethoscope, Calendar, AlertTriangle, CheckCircle,
  ShieldAlert, UserCheck, AlertOctagon
} from 'lucide-react'

const RISK_CONFIG = {
  Critical: { bar: 'bg-red-500',    bg: 'bg-red-50 border-red-200',       text: 'text-red-700',    icon: ShieldAlert,    label: 'Mức độ Nguy Hiểm' },
  High:     { bar: 'bg-orange-500', bg: 'bg-orange-50 border-orange-200',  text: 'text-orange-700', icon: AlertTriangle,  label: 'Mức độ Cao' },
  Medium:   { bar: 'bg-yellow-500', bg: 'bg-yellow-50 border-yellow-200',  text: 'text-yellow-700', icon: Info,           label: 'Mức độ Trung Bình' },
  Low:      { bar: 'bg-green-500',  bg: 'bg-green-50 border-green-200',    text: 'text-green-700',  icon: CheckCircle,    label: 'Mức độ Thấp' },
}

export default function DiseaseDetails({ disease, knowledge }) {
  // Use knowledge record (full) if available, else fall back to disease candidate
  const d = knowledge || disease

  if (!d) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 min-h-[260px] text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Info className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-gray-400 text-sm">Chọn một bệnh từ bảng xếp hạng để xem chi tiết lâm sàng</p>
      </div>
    )
  }

  const risk     = RISK_CONFIG[d.risk_level] || RISK_CONFIG.Low
  const RiskIcon = risk.icon
  const redFlags = d.red_flags || []
  const icdCode  = d.icd10 || ''

  return (
    <div className="card space-y-5 animate-fade-in">

      {/* Header */}
      <div className="pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
            {d.code}
          </span>
          {icdCode && (
            <span className="text-xs font-mono text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
              ICD-10: {icdCode}
            </span>
          )}
          {disease?.confidence_pct != null && (
            <span className="text-xs font-bold text-white bg-blue-600 px-2.5 py-0.5 rounded-full">
              {disease.confidence_pct}% tin cậy
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-gray-900 leading-tight">{d.name_en}</h3>
            <p className="text-gray-500 text-sm mt-0.5">{d.name_vi}</p>
          </div>
          <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 flex-shrink-0 ${risk.bg}`}>
            <RiskIcon className={`w-3.5 h-3.5 ${risk.text}`} />
            <span className={`text-xs font-bold ${risk.text}`}>{risk.label}</span>
          </div>
        </div>
      </div>

      {/* Clinical description */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Info className="w-3.5 h-3.5" />
          Mô tả lâm sàng
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{d.description || '—'}</p>
      </section>

      {/* Recommendation */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Stethoscope className="w-3.5 h-3.5" />
          Đề xuất điều trị
        </div>
        <div className={`text-sm text-gray-700 leading-relaxed border rounded-xl p-4 ${risk.bg}`}>
          {d.recommendation || '—'}
        </div>
      </section>

      {/* Specialist referral */}
      {d.specialist_referral && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <UserCheck className="w-3.5 h-3.5" />
            Chuyên gia đề xuất
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm font-medium text-blue-800">{d.specialist_referral}</p>
          </div>
        </section>
      )}

      {/* Follow-up */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Calendar className="w-3.5 h-3.5" />
          Lịch tái khám
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{d.follow_up || '—'}</p>
      </section>

      {/* Red flags */}
      {redFlags.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest">
            <AlertOctagon className="w-3.5 h-3.5" />
            Dấu hiệu nguy hiểm — Cần chú ý ngay
          </div>
          <ul className="space-y-1.5">
            {redFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <span className="text-red-400 mt-0.5 flex-shrink-0">▸</span>
                {flag}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Kết quả từ AI chỉ mang tính chất tham khảo. Luôn tham khảo ý kiến bác sĩ chuyên khoa da liễu để chẩn đoán và điều trị chính xác.
        </p>
      </div>
    </div>
  )
}
