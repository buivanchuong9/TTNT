import React, { useEffect, useState } from 'react'
import { Activity, Cpu, Shield, CheckCircle, AlertCircle, Microscope, Loader, Zap } from 'lucide-react'
import { checkHealth } from '../services/api'

export default function Header() {
  const [health, setHealth]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const check = () =>
      checkHealth()
        .then(h => { setHealth(h); setLoading(false) })
        .catch(() => { setHealth(null); setLoading(false) })
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  const ready = health?.is_ready

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Microscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900 leading-none">
                  Derm<span className="text-blue-600">AI</span>
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  v2
                </span>
              </div>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5 hidden sm:block">
                Clinical Decision Support · AI Dermatology
              </p>
            </div>
          </div>

          {/* Tech badges */}
          <div className="hidden lg:flex items-center gap-2">
            {[
              { icon: Cpu,      label: 'UNet++ · EfficientNet-B2' },
              { icon: Shield,   label: `${health?.knowledge_diseases ?? 44} Disease KB` },
              { icon: Zap,      label: health?.device ? health.device.toUpperCase() : 'CPU/GPU' },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full"
              >
                <Icon className="w-3 h-3 text-blue-500" />
                {label}
              </span>
            ))}
          </div>

          {/* System status */}
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                <Loader className="w-3 h-3 animate-spin" />
                Connecting…
              </span>
            ) : ready ? (
              <>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  AI Ready
                </span>
                {health?.model_version && (
                  <span className="hidden md:flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1.5">
                    <Activity className="w-3 h-3" />
                    {health.model_version}
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
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
