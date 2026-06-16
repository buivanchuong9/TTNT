import React from 'react'
import { Eye, Cpu, Target, Layers, Thermometer, GitBranch, Clock, Hash, Sliders } from 'lucide-react'

function MetricRow({ icon: Icon, label, value, valueClass = 'text-gray-900', badge }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
            {badge.text}
          </span>
        )}
        <span className={`text-xs font-bold ${valueClass}`}>{value}</span>
      </div>
    </div>
  )
}

function ProgressBar({ value, max = 100, colorClass = 'bg-blue-500' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mt-1">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

const CONFIDENCE_CONFIG = {
  High:    { cls: 'bg-green-100 text-green-700 border border-green-200',   dot: 'bg-green-500' },
  Medium:  { cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200', dot: 'bg-yellow-500' },
  Low:     { cls: 'bg-red-100 text-red-700 border border-red-200',         dot: 'bg-red-500' },
  Unknown: { cls: 'bg-gray-100 text-gray-500 border border-gray-200',       dot: 'bg-gray-400' },
}

export default function ExplainabilityCard({ explainability, metadata }) {
  if (!explainability) return null

  const e    = explainability
  const conf = CONFIDENCE_CONFIG[e.confidence_level] || CONFIDENCE_CONFIG.Unknown

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Eye className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Báo cáo phân tích AI</h3>
          <p className="text-xs text-gray-400">Độ minh bạch quyết định của AI</p>
        </div>
        {e.request_id && (
          <span className="ml-auto text-[10px] font-mono text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
            REQ#{e.request_id}
          </span>
        )}
      </div>

      {/* Confidence tier */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${conf.cls}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${conf.dot} flex-shrink-0`} />
        <div>
          <p className="text-xs font-bold">Mức độ tin cậy: {e.confidence_level === 'High' ? 'Cao' : e.confidence_level === 'Medium' ? 'Trung bình' : e.confidence_level === 'Low' ? 'Thấp' : 'Chưa rõ'}</p>
          <p className="text-[11px] opacity-75">
            {e.confidence_level === 'Low'
              ? 'AI không chắc chắn — bắt buộc phải có bác sĩ xem xét trước khi quyết định.'
              : e.confidence_level === 'Medium'
              ? 'AI có độ tin cậy vừa phải — xem đây là chẩn đoán phân biệt hàng đầu, chưa phải kết luận cuối cùng.'
              : 'AI rất tự tin — tuy nhiên vẫn cần xác nhận với chuyên gia trước khi điều trị.'}
          </p>
        </div>
      </div>

      {/* Spatial coverage metrics */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chỉ số phân vùng</p>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-gray-500"><Layers className="w-3 h-3" /> Diện tích vùng tổn thương</span>
            <span className="font-bold text-gray-900">{e.lesion_area_pct?.toFixed(1) ?? 0}% ảnh</span>
          </div>
          <ProgressBar value={e.lesion_area_pct ?? 0} colorClass="bg-blue-500" />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-gray-500"><Target className="w-3 h-3" /> Độ bao phủ ROI</span>
            <span className="font-bold text-gray-900">{e.segmentation_coverage_pct?.toFixed(1) ?? 0}%</span>
          </div>
          <ProgressBar
            value={e.segmentation_coverage_pct ?? 0}
            colorClass={e.segmentation_coverage_pct >= 60 ? 'bg-green-500' : e.segmentation_coverage_pct >= 30 ? 'bg-yellow-500' : 'bg-red-500'}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            {e.segmentation_coverage_pct >= 60
              ? 'Tốt — mô hình tập trung đúng vào vùng da tổn thương.'
              : e.segmentation_coverage_pct >= 30
              ? 'Vừa phải — vùng cắt chứa một phần da bình thường.'
              : 'Thấp — vùng cắt chứa nhiều da bình thường; cần xem lại ảnh phân vùng.'}
          </p>
        </div>
      </div>

      {/* Metric table */}
      <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
        <MetricRow icon={Cpu}       label="Mô hình phân loại"         value={e.classifier_type?.replace(' (ML)', '').replace(' (clinical heuristic)', ' ⚠') || '—'} />
        <MetricRow icon={Layers}    label="Thành phần phân vùng"    value={e.num_mask_components ?? '—'}
          badge={e.num_mask_components > 1 ? { text: 'Nhiều vùng', cls: 'bg-yellow-100 text-yellow-700' } : null}
        />
        <MetricRow icon={GitBranch} label="Kích thước ROI"           value={e.roi_width && e.roi_height ? `${e.roi_width} × ${e.roi_height} px` : '—'} />
        <MetricRow icon={Sliders}   label="Hệ số bù (T)"      value={e.calibration_temperature ?? '1.0'}
          badge={e.calibration_temperature !== 1.0 ? { text: 'Đã hiệu chỉnh', cls: 'bg-purple-100 text-purple-700' } : null}
        />
        <MetricRow icon={Thermometer} label="Độ sáng ảnh" value={e.brightness ? `${e.brightness.toFixed(0)}/255` : '—'} />
        <MetricRow icon={Hash}      label="Độ sắc nét"         value={e.blur_score ? `${e.blur_score.toFixed(0)}` : '—'}
          badge={e.blur_score < 150 ? { text: 'Mờ/kém nét', cls: 'bg-orange-100 text-orange-700' } : null}
        />
        <MetricRow icon={Clock}     label="Thời gian xử lý"     value={`${e.inference_time_ms?.toFixed(0) ?? '—'} ms`} />
      </div>

      {/* Quality warnings */}
      {e.quality_warnings?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Cảnh báo chất lượng</p>
          {e.quality_warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span className="flex-shrink-0">⚠</span>
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Model version footer */}
      {e.model_version && (
        <div className="flex items-center gap-2 text-[10px] text-gray-400 border-t border-gray-100 pt-3">
          <Cpu className="w-3 h-3" />
          Phiên bản: <span className="font-mono">{e.model_version}</span>
        </div>
      )}
    </div>
  )
}
