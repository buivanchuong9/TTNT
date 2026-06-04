import React from 'react'
import { ShieldAlert, Shield, ShieldCheck, AlertTriangle, CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react'

const RISK_LEVELS = [
  { key: 'Critical', icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-600',    border: 'border-red-500',    light: 'bg-red-50 border-red-200',    desc: 'Immediate specialist referral required. Do not delay.' },
  { key: 'High',     icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-500', border: 'border-orange-400',  light: 'bg-orange-50 border-orange-200', desc: 'Urgent dermatology appointment within 2–4 weeks.' },
  { key: 'Medium',   icon: Shield,        color: 'text-yellow-600', bg: 'bg-yellow-500', border: 'border-yellow-400',  light: 'bg-yellow-50 border-yellow-200', desc: 'Schedule dermatology consultation within 1–3 months.' },
  { key: 'Low',      icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-500',  border: 'border-green-400',   light: 'bg-green-50 border-green-200',   desc: 'Annual skin check recommended. Monitor for any changes.' },
]

export default function RiskAssessmentCard({ prediction, knowledge }) {
  if (!prediction) return null

  const activeRisk = prediction.risk_level || 'Low'
  const activeIdx  = RISK_LEVELS.findIndex(r => r.key === activeRisk)
  const active     = RISK_LEVELS[activeIdx] || RISK_LEVELS[3]

  const ActiveIcon = active.icon

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${active.bg}`}>
          <ShieldAlert className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Risk Assessment</h3>
          <p className="text-xs text-gray-400">Clinical urgency classification</p>
        </div>
      </div>

      {/* Active risk banner */}
      <div className={`rounded-xl border px-4 py-4 flex items-center gap-4 ${active.light}`}>
        <div className={`w-12 h-12 rounded-2xl ${active.bg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <ActiveIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className={`text-lg font-black ${active.color}`}>{activeRisk} Risk</p>
          <p className="text-sm text-gray-600 leading-snug mt-0.5">{active.desc}</p>
        </div>
      </div>

      {/* Risk scale */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Risk Scale</p>
        <div className="space-y-1.5">
          {RISK_LEVELS.map((level, i) => {
            const Icon      = level.icon
            const isCurrent = level.key === activeRisk
            const isPast    = i > activeIdx

            return (
              <div
                key={level.key}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  isCurrent
                    ? `${level.light} ${level.border} shadow-sm`
                    : isPast
                    ? 'bg-gray-50/50 border-gray-100 opacity-40'
                    : 'bg-white border-gray-100 opacity-60'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isCurrent ? level.bg : 'bg-gray-200'}`}>
                  <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <span className={`text-xs font-semibold ${isCurrent ? level.color : 'text-gray-400'}`}>
                  {level.key}
                </span>
                {isCurrent && (
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${level.bg} text-white`}>
                    Current
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Specialist referral */}
      {knowledge?.specialist_referral && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-blue-700 mb-0.5">Recommended Specialist</p>
            <p className="text-xs text-blue-600">{knowledge.specialist_referral}</p>
          </div>
        </div>
      )}

      {/* Follow up timeline */}
      {knowledge?.follow_up && (
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          <Clock className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-gray-600 mb-0.5">Follow-Up Schedule</p>
            <p className="text-xs text-gray-500">{knowledge.follow_up}</p>
          </div>
        </div>
      )}
    </div>
  )
}
