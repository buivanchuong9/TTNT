import React, { useState } from 'react'
import { CheckCircle, RefreshCw, AlertTriangle, Shield, XCircle } from 'lucide-react'
import DiseaseRanking from './DiseaseRanking'
import DiseaseDetails from './DiseaseDetails'
import MetadataPanel from './MetadataPanel'
import ConfidenceChart from './ConfidenceChart'

const RISK_CONFIG = {
  Critical: {
    bg:   'bg-red-50 border-red-300',
    text: 'text-red-800',
    sub:  'text-red-600',
    icon: XCircle,
    bar:  'bg-red-500',
    msg:  'Phát hiện nguy cơ nghiêm trọng — Cần gặp bác sĩ chuyên khoa da liễu ngay lập tức để sinh thiết và xác nhận chẩn đoán.',
  },
  High: {
    bg:   'bg-orange-50 border-orange-200',
    text: 'text-orange-800',
    sub:  'text-orange-600',
    icon: AlertTriangle,
    bar:  'bg-orange-500',
    msg:  'Nguy cơ cao — Hẹn khám bác sĩ da liễu trong thời gian sớm nhất để đánh giá và điều trị.',
  },
  Medium: {
    bg:   'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
    sub:  'text-yellow-600',
    icon: Shield,
    bar:  'bg-yellow-500',
    msg:  'Nguy cơ trung bình — Theo dõi định kỳ và tham khảo ý kiến bác sĩ da liễu.',
  },
  Low: {
    bg:   'bg-green-50 border-green-200',
    text: 'text-green-800',
    sub:  'text-green-600',
    icon: CheckCircle,
    bar:  'bg-green-500',
    msg:  'Nguy cơ thấp — Tiếp tục theo dõi định kỳ hàng năm và bảo vệ da khỏi tia UV.',
  },
}

export default function ResultDashboard({ result, onNewAnalysis }) {
  const top      = result.classification?.top_prediction
  const topK     = result.classification?.top_k_predictions ?? []
  const [selected, setSelected] = useState(top ?? null)

  const cfg     = top ? (RISK_CONFIG[top.risk_level] ?? RISK_CONFIG.Low) : null
  const RiskIcon = cfg?.icon ?? CheckCircle

  return (
    <div className="space-y-6 animate-slide-up max-w-7xl mx-auto">

      {/* Verdict banner */}
      {top && cfg && (
        <div className={`rounded-2xl border p-5 ${cfg.bg}`}>
          <div className="flex flex-col md:flex-row items-start gap-4">

            {/* Icon + risk */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white flex items-center justify-center shadow-sm">
                <RiskIcon className={`w-7 h-7 ${cfg.text}`} />
              </div>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-widest ${cfg.sub}`}>Kết quả phân tích</p>
                <h2 className={`text-2xl font-bold ${cfg.text}`}>{top.name_en}</h2>
                <p className={`text-sm ${cfg.sub}`}>{top.name_vi}</p>
              </div>
            </div>

            {/* Confidence meter */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-medium ${cfg.text}`}>Xác suất</span>
                <span className={`text-2xl font-bold ${cfg.text} font-mono`}>{top.confidence_pct}%</span>
              </div>
              <div className="bg-white/60 rounded-full h-3 overflow-hidden border border-white">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${cfg.bar}`}
                  style={{ width: `${top.confidence_pct}%` }}
                />
              </div>
              <p className={`text-sm mt-2 leading-snug ${cfg.sub}`}>{cfg.msg}</p>
            </div>

            <button
              onClick={onNewAnalysis}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Phân tích mới
            </button>
          </div>
        </div>
      )}

      {/* 3-column grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <DiseaseRanking predictions={topK} onSelect={setSelected} selected={selected} />
          <ConfidenceChart predictions={topK} />
        </div>
        <div>
          <DiseaseDetails disease={selected} />
        </div>
        <div>
          <MetadataPanel
            metadata={result.metadata}
            explainability={result.explainability}
            classifierType={result.classification?.classifier_type}
          />
        </div>
      </div>
    </div>
  )
}
