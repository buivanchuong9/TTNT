import React, { useMemo } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import Highcharts3D from 'highcharts/highcharts-3d'
import { BarChart2 } from 'lucide-react'

// Initialize 3D module
if (typeof Highcharts === 'object') {
  if (typeof Highcharts3D === 'function') {
    Highcharts3D(Highcharts)
  } else if (Highcharts3D && typeof Highcharts3D.default === 'function') {
    Highcharts3D.default(Highcharts)
  }
}

export default function ConfidenceChart({ predictions }) {
  if (!predictions?.length) return null

  const options = useMemo(() => {
    const data = predictions.map((p, i) => ({
      name: p.code,
      y: p.confidence_pct,
      color: i === 0 ? '#3b82f6' : (p.color || '#94a3b8'),
      fullName: p.name_vi,
      opacity: i === 0 ? 1.0 : 0.65,
    }))

    return {
      chart: {
        type: 'column',
        options3d: {
          enabled: true,
          alpha: 15,
          beta: 15,
          depth: 50,
          viewDistance: 25
        },
        height: 220,
        backgroundColor: 'transparent',
        style: { fontFamily: 'inherit' }
      },
      title: { text: null },
      xAxis: {
        categories: data.map(d => d.name),
        labels: { style: { color: '#6b7280', fontSize: '10px', fontWeight: '600' } },
        gridLineColor: 'transparent',
      },
      yAxis: {
        min: 0,
        max: 100,
        title: { text: null },
        labels: { format: '{value}%', style: { color: '#9ca3af', fontSize: '9px' } },
        gridLineColor: 'rgba(0,0,0,0.05)',
        plotLines: [
          { value: 75, color: '#10b981', dashStyle: 'Dash', width: 1, label: { text: 'Cao', style: { color: '#10b981', fontSize: '9px' } } },
          { value: 45, color: '#f59e0b', dashStyle: 'Dash', width: 1, label: { text: 'TB', style: { color: '#f59e0b', fontSize: '9px' } } }
        ]
      },
      plotOptions: {
        column: {
          depth: 25,
          borderRadius: 2,
          colorByPoint: true,
        }
      },
      tooltip: {
        useHTML: true,
        headerFormat: '',
        pointFormatter: function() {
          return `
            <div style="font-family: inherit;">
              <p style="font-weight: bold; color: #111827; margin: 0;">${this.name}</p>
              <p style="color: #6b7280; font-size: 11px; margin: 2px 0;">${this.fullName}</p>
              <p style="font-family: monospace; font-weight: bold; margin: 4px 0 0 0; font-size: 14px;">${this.y}%</p>
            </div>
          `;
        },
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        borderRadius: 12,
        shadow: true,
      },
      legend: { enabled: false },
      series: [{
        name: 'Độ tin cậy',
        data: data
      }],
      credits: { enabled: false }
    }
  }, [predictions])

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-900">Phân bố xác suất</h3>
      </div>

      <div style={{ margin: '0 -10px' }}>
        <HighchartsReact
          highcharts={Highcharts}
          options={options}
        />
      </div>

      <div className="flex items-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />≥75% Cao</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />45-75% Trung bình</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />&lt;45% Thấp</span>
      </div>
    </div>
  )
}
