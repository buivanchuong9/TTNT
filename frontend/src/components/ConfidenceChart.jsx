import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const d = payload[0].payload
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm shadow-lg">
        <p className="font-bold text-gray-900">{d.name}</p>
        <p className="text-gray-500 text-xs">{d.nameVi}</p>
        <p className="text-blue-600 font-bold mt-1">{d.pct}%</p>
      </div>
    )
  }
  return null
}

export default function ConfidenceChart({ predictions }) {
  if (!predictions?.length) return null

  const data = predictions.map((p, i) => ({
    name:    p.code,
    nameVi:  p.name_vi,
    pct:     p.confidence_pct,
    color:   i === 0 ? '#2563eb' : (p.color || '#93c5fd'),
  }))

  return (
    <div className="card space-y-3">
      <h3 className="font-bold text-gray-900 text-sm">Phân Bố Xác Suất</h3>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
          <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={i === 0 ? 1 : 0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
