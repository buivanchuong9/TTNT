import React, { useState } from 'react'
import { RefreshCw, XCircle, AlertTriangle, Shield, CheckCircle, Download, ExternalLink } from 'lucide-react'
import DiseaseRanking from './DiseaseRanking'
import DiseaseDetails from './DiseaseDetails'
import ConfidenceChart from './ConfidenceChart'
import ExplainabilityCard from './ExplainabilityCard'
import RiskAssessmentCard from './RiskAssessmentCard'

const RISK_CONFIG = {
  Critical: {
    bg:   'bg-red-50 border-red-200',
    text: 'text-red-800',
    sub:  'text-red-600',
    icon: XCircle,
    bar:  'bg-red-500',
    ring: 'ring-red-200',
    msg:  'Serious risk detected. Seek immediate specialist consultation for biopsy and diagnosis confirmation.',
  },
  High: {
    bg:   'bg-orange-50 border-orange-200',
    text: 'text-orange-800',
    sub:  'text-orange-600',
    icon: AlertTriangle,
    bar:  'bg-orange-500',
    ring: 'ring-orange-200',
    msg:  'High risk lesion. Schedule a dermatology appointment as soon as possible.',
  },
  Medium: {
    bg:   'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
    sub:  'text-yellow-600',
    icon: Shield,
    bar:  'bg-yellow-500',
    ring: 'ring-yellow-200',
    msg:  'Medium risk. Periodic monitoring and dermatology consultation recommended.',
  },
  Low: {
    bg:   'bg-green-50 border-green-200',
    text: 'text-green-800',
    sub:  'text-green-600',
    icon: CheckCircle,
    bar:  'bg-green-500',
    ring: 'ring-green-200',
    msg:  'Low risk. Continue annual skin checks and protect against UV exposure.',
  },
}

function ConfidenceMeter({ value, barClass, textClass }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-medium ${textClass}`}>Calibrated Confidence</span>
        <span className={`text-3xl font-black font-mono ${textClass}`}>{value}%</span>
      </div>
      <div className="bg-white/60 rounded-full h-3 overflow-hidden border border-white">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export default function ResultDashboard({ result, onNewAnalysis }) {
  const top      = result.classification?.top_prediction
  const topK     = result.classification?.top_k_predictions ?? []
  const knowledge = result.knowledge

  const [selected, setSelected] = useState(top ?? null)

  const cfg      = top ? (RISK_CONFIG[top.risk_level] ?? RISK_CONFIG.Low) : null
  const RiskIcon = cfg?.icon ?? CheckCircle

  // For DiseaseDetails: use knowledge for the top, or no knowledge for others
  const selectedKnowledge = selected?.disease_id === top?.disease_id ? knowledge : null

  return (
    <div className="space-y-6 animate-slide-up max-w-7xl mx-auto">

      {/* ── Verdict Banner ─────────────────────────────────────────────────── */}
      {top && cfg && (
        <div className={`rounded-2xl border-2 p-5 shadow-sm ${cfg.bg}`}>
          <div className="flex flex-col md:flex-row items-start gap-5">

            {/* Risk icon + disease name */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className={`w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm ring-2 ${cfg.ring}`}>
                <RiskIcon className={`w-8 h-8 ${cfg.text}`} />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${cfg.sub}`}>AI Primary Diagnosis</p>
                <h2 className={`text-2xl font-black leading-tight ${cfg.text}`}>{top.name_en}</h2>
                <p className={`text-sm font-medium ${cfg.sub}`}>{top.name_vi}</p>
                <span className={`text-[11px] font-mono bg-white/60 px-2 py-0.5 rounded border ${cfg.sub} border-current`}>
                  {top.code}
                </span>
              </div>
            </div>

            {/* Confidence meter */}
            <ConfidenceMeter value={top.confidence_pct} barClass={cfg.bar} textClass={cfg.text} />

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onNewAnalysis}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Analysis
              </button>
            </div>
          </div>

          {/* Clinical warning message */}
          <div className={`mt-4 flex items-start gap-2 text-sm font-medium ${cfg.sub}`}>
            <RiskIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {cfg.msg}
          </div>
        </div>
      )}

      {/* ── Low confidence warning ─────────────────────────────────────────── */}
      {top && result.explainability?.confidence_level === 'Low' && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">AI Confidence is Low</p>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              The model's probability for the top prediction is below the reliable threshold.
              This result should be treated as a rough indication only.
              Clinical review by a dermatologist is strongly recommended before any action.
            </p>
          </div>
        </div>
      )}

      {/* ── Main 3-column grid ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Column 1: Rankings + Chart */}
        <div className="space-y-4">
          <DiseaseRanking predictions={topK} onSelect={setSelected} selected={selected} />
          <ConfidenceChart predictions={topK} />
        </div>

        {/* Column 2: Disease Details */}
        <div>
          <DiseaseDetails disease={selected} knowledge={selectedKnowledge} />
        </div>

        {/* Column 3: Risk + Explainability */}
        <div className="space-y-4">
          <RiskAssessmentCard prediction={top} knowledge={knowledge} />
          <ExplainabilityCard
            explainability={result.explainability}
            metadata={result.metadata}
          />
        </div>

      </div>

      {/* ── Footer disclaimer ──────────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs text-slate-500">
        <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="flex-1 leading-relaxed">
          <strong className="text-slate-700">Clinical Disclaimer:</strong> This AI analysis is intended for research
          and educational purposes only. It does not constitute a medical diagnosis and must not replace evaluation
          by a licensed dermatologist or physician. Always seek professional medical advice.
        </p>
        <button
          onClick={onNewAnalysis}
          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold whitespace-nowrap transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          New Analysis
        </button>
      </div>

    </div>
  )
}
