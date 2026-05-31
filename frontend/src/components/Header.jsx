import React, { useEffect, useState } from 'react'
import { Activity, Cpu, Shield, CheckCircle, AlertCircle } from 'lucide-react'
import { checkHealth } from '../services/api'

export default function Header() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkHealth()
      .then(h => { setHealth(h); setLoading(false) })
      .catch(() => { setHealth(null); setLoading(false) })
  }, [])

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow">
              <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                Derm<span className="text-blue-600">AI</span>
              </h1>
              <p className="text-xs text-gray-500 leading-none">Skin Lesion Analysis</p>
            </div>
          </div>

          {/* Badges */}
          <div className="hidden md:flex items-center gap-2">
            {[
              { label: 'UNet++ Segmentation', icon: Cpu },
              { label: 'EfficientNet-B2', icon: Activity },
              { label: '44 Disease KB', icon: Shield },
            ].map(({ label, icon: Icon }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                <Icon className="w-3 h-3" />
                {label}
              </span>
            ))}
          </div>

          {/* Status */}
          <div>
            {loading ? (
              <span className="text-xs text-gray-400 border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5">Connecting…</span>
            ) : health ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                System Ready · {health.knowledge_diseases} diseases
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Backend Offline
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
