import React, { useEffect, useState } from 'react'
import { Microscope, Brain, Shield, TrendingUp, ArrowRight, Zap, Award } from 'lucide-react'
import { getAnalytics } from '../services/api'

const PIPELINE_STEPS = [
  { label: 'Quality Check',     color: 'from-slate-500 to-slate-600' },
  { label: 'Segmentation',      color: 'from-blue-500 to-blue-600' },
  { label: 'Mask Refinement',   color: 'from-indigo-500 to-indigo-600' },
  { label: 'ROI Extraction',    color: 'from-violet-500 to-violet-600' },
  { label: 'Classification',    color: 'from-purple-500 to-purple-600' },
  { label: 'Calibration',       color: 'from-fuchsia-500 to-fuchsia-600' },
  { label: 'Top-K Ranking',     color: 'from-rose-500 to-rose-600' },
  { label: 'Explainability',    color: 'from-orange-500 to-orange-600' },
]

function StatCard({ value, label, icon: Icon, color }) {
  return (
    <div className={`rounded-2xl border p-5 bg-white shadow-sm flex items-center gap-4`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${color} shadow-sm flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  )
}

export default function HeroSection() {
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    getAnalytics().then(setAnalytics).catch(() => null)
  }, [])

  const totalAnalyses = analytics?.total_analyses ?? '—'
  const avgConf       = analytics?.avg_confidence_pct ? `${analytics.avg_confidence_pct}%` : '—'
  const avgTime       = analytics?.avg_inference_time_ms
    ? `${(analytics.avg_inference_time_ms / 1000).toFixed(1)}s`
    : '—'

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white py-20 px-4">

      {/* Background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '32px 32px' }}
      />

      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/20 blur-3xl rounded-full pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">

        {/* Badge */}
        <div className="flex justify-center mb-8">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/30 px-4 py-2 rounded-full tracking-wider uppercase">
            <Microscope className="w-3.5 h-3.5" />
            Next-Generation AI Dermatology Platform
          </span>
        </div>

        {/* Headline */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-4">
            Phân Tích Tổn Thương Da
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Bằng Trí Tuệ Nhân Tạo
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Hệ thống 9 giai đoạn: kiểm tra chất lượng, phân đoạn UNet++,
            tinh chỉnh mặt nạ, trích xuất ROI, phân loại EfficientNet,
            hiệu chỉnh độ tin cậy, xếp hạng Top-K và giải thích lâm sàng.
          </p>
        </div>

        {/* Pipeline steps visualization */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {PIPELINE_STEPS.map((step, i) => (
            <React.Fragment key={step.label}>
              <span className={`
                text-xs font-semibold px-3 py-1.5 rounded-full
                bg-gradient-to-r ${step.color} text-white shadow-sm
              `}>
                {i + 1}. {step.label}
              </span>
              {i < PIPELINE_STEPS.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 self-center flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          <StatCard
            value={totalAnalyses}
            label="Total Analyses"
            icon={Brain}
            color="from-blue-500 to-blue-600"
          />
          <StatCard
            value={avgConf}
            label="Avg. Confidence"
            icon={TrendingUp}
            color="from-indigo-500 to-indigo-600"
          />
          <StatCard
            value={avgTime}
            label="Avg. Inference Time"
            icon={Zap}
            color="from-violet-500 to-violet-600"
          />
          <StatCard
            value="44"
            label="Disease Knowledge Base"
            icon={Award}
            color="from-purple-500 to-purple-600"
          />
        </div>

        {/* Disclaimer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
            <Shield className="inline w-3 h-3 mr-1 text-yellow-500" />
            <strong className="text-yellow-400">Lưu ý lâm sàng:</strong>{' '}
            Hệ thống này phục vụ mục đích nghiên cứu và hỗ trợ ra quyết định.
            Không thay thế chẩn đoán của bác sĩ chuyên khoa da liễu có chứng chỉ hành nghề.
          </p>
        </div>

      </div>
    </section>
  )
}
