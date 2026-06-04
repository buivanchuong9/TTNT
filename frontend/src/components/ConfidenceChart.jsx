import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { BarChart2 } from 'lucide-react'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm shadow-lg z-50">
      <p className="font-bold text-gray-900">{d.name_en}</p>
      <p className="text-gray-500 text-xs">{d.name_vi} · {d.code}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
        <span className="font-mono font-bold text-gray-800">{d.pct}%</span>
      </div>
    </div>
  )
}

export default function ConfidenceChart({ predictions }) {
  if (!predictions?.length) return null

  const data = predictions.map((p, i) => ({
    code:    p.code,
    name_en: p.name_en,
    name_vi: p.name_vi,
    pct:     p.confidence_pct,
    color:   i === 0 ? '#3b82f6' : (p.color || '#94a3b8'),
    opacity: i === 0 ? 1.0 : 0.65,
  }))

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-900">Probability Distribution</h3>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barSize={24}>
          <XAxis
            dataKey="code"
            tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <ReferenceLine y={75} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'High', fontSize: 9, fill: '#10b981' }} />
          <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'Medium', fontSize: 9, fill: '#f59e0b' }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.05)', radius: 6 }} />
          <Bar dataKey="pct" radius={[5, 5, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={entry.opacity} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />≥75% High</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />45-75% Medium</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />&lt;45% Low</span>
      </div>
    </div>
  )
}
