import React from 'react'
import { Trophy, Medal } from 'lucide-react'

const RISK_BADGE = {
  Critical: 'badge-risk-critical',
  High:     'badge-risk-high',
  Medium:   'badge-risk-medium',
  Low:      'badge-risk-low',
}

const RISK_MAP = {
  Critical: 'Nguy Hiểm',
  High: 'Cao',
  Medium: 'Trung bình',
  Low: 'Thấp'
}

const RANK_STYLE = [
  { bg: 'bg-amber-50 border-amber-200',    num: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-slate-50 border-slate-200',    num: 'bg-slate-100 text-slate-600' },
  { bg: 'bg-orange-50/60 border-orange-100', num: 'bg-orange-100 text-orange-600' },
]

export default function DiseaseRanking({ predictions, onSelect, selected }) {
  if (!predictions?.length) return null

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Xếp hạng bệnh lý Top-K</h3>
          <p className="text-xs text-gray-400">Xếp hạng theo độ tin cậy</p>
        </div>
        <span className="ml-auto text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
          Top-{predictions.length}
        </span>
      </div>

      <div className="space-y-2">
        {predictions.map((disease, i) => {
          const style      = RANK_STYLE[i] || { bg: 'bg-white border-gray-200', num: 'bg-gray-100 text-gray-500' }
          const isTop      = i === 0
          const isSelected = selected?.disease_id === disease.disease_id

          return (
            <button
              key={disease.disease_id}
              onClick={() => onSelect(disease)}
              className={`
                w-full text-left rounded-xl p-3 border-2 transition-all duration-150
                ${isSelected
                  ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-100 shadow-sm'
                  : `${style.bg} hover:border-blue-300 hover:shadow-sm`
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* Rank number */}
                <div className={`
                  w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0
                  ${isSelected ? 'bg-blue-100 text-blue-700' : style.num}
                `}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-xs font-bold text-gray-900 truncate">{disease.name_en}</span>
                    <span className={RISK_BADGE[disease.risk_level] || 'badge-risk-low'}>
                      {RISK_MAP[disease.risk_level] || disease.risk_level}
                    </span>
                    {isTop && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-full">
                        Phù hợp nhất
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 truncate mb-1.5">{disease.name_vi} · {disease.code}</p>

                  {/* Confidence bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${disease.confidence_pct}%`,
                          backgroundColor: isSelected ? '#2563eb' : (disease.color || '#3b82f6'),
                        }}
                      />
                    </div>
                    <span className={`text-xs font-bold font-mono flex-shrink-0 w-10 text-right ${isTop ? 'text-gray-900' : 'text-gray-500'}`}>
                      {disease.confidence_pct}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
