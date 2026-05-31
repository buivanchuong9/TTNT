import React from 'react'
import { Trophy } from 'lucide-react'

const RISK_BADGE = {
  Critical: 'badge-risk-critical',
  High:     'badge-risk-high',
  Medium:   'badge-risk-medium',
  Low:      'badge-risk-low',
}

export default function DiseaseRanking({ predictions, onSelect, selected }) {
  if (!predictions?.length) return null

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h3 className="font-bold text-gray-900">Xếp Hạng Bệnh</h3>
        <span className="ml-auto text-xs text-gray-400">Top-{predictions.length} theo xác suất</span>
      </div>

      <div className="space-y-2">
        {predictions.map((disease, i) => {
          const isTop      = i === 0
          const isSelected = selected?.disease_id === disease.disease_id

          return (
            <button
              key={disease.disease_id}
              onClick={() => onSelect(disease)}
              className={`
                w-full text-left rounded-xl p-3 border transition-all duration-150
                ${isSelected
                  ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                  : isTop
                  ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                  : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/30'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className={`
                  w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${isTop ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}
                `}>
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">{disease.name_en}</span>
                    <span className={RISK_BADGE[disease.risk_level] || 'badge-risk-low'}>{disease.risk_level}</span>
                    {isTop && (
                      <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold">
                        Phù hợp nhất
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mb-1.5">{disease.name_vi} · {disease.code}</p>

                  {/* Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
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
