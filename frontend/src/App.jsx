import React, { useState, useCallback } from 'react'
import Header from './components/Header'
import UploadZone from './components/UploadZone'
import ProcessingPipeline from './components/ProcessingPipeline'
import ResultDashboard from './components/ResultDashboard'
import LoadingState from './components/LoadingState'
import ErrorState from './components/ErrorState'
import { analyzeImage } from './services/api'

export default function App() {
  const [appState, setAppState]   = useState('idle')
  const [result, setResult]       = useState(null)
  const [preview, setPreview]     = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [uploadPct, setUploadPct] = useState(0)

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setResult(null)
    setErrorMsg('')
    setUploadPct(0)
    setAppState('uploading')

    try {
      const data = await analyzeImage(file, (evt) => {
        if (evt.total) setUploadPct(Math.round((evt.loaded / evt.total) * 100))
      })

      setAppState('analyzing')
      await new Promise(r => setTimeout(r, 400))

      if (!data.success && data.error_message) {
        setErrorMsg(data.error_message)
        setResult(data)
        setAppState('error')
        return
      }

      setResult(data)
      setAppState('results')
    } catch (err) {
      const msg = err.response?.data?.detail
                || err.response?.data?.error_message
                || err.message
                || 'Lỗi kết nối — backend có đang chạy không?'
      setErrorMsg(msg)
      setAppState('error')
    }
  }, [])

  const handleReset = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setResult(null)
    setErrorMsg('')
    setUploadPct(0)
    setAppState('idle')
  }, [preview])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {(appState === 'idle' || appState === 'error') && (
          <UploadZone onFileSelect={handleFileSelect} disabled={false} />
        )}

        {(appState === 'uploading' || appState === 'analyzing') && (
          <LoadingState stage={appState} uploadPct={uploadPct} previewSrc={preview} />
        )}

        {appState === 'error' && (
          <ErrorState message={errorMsg} partialResult={result} onRetry={handleReset} />
        )}

        {appState === 'results' && result && (
          <>
            <ProcessingPipeline images={result.images} />
            <ResultDashboard result={result} onNewAnalysis={handleReset} />
          </>
        )}
      </main>

      <footer className="mt-16 border-t border-gray-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm">
          <div className="text-gray-700 font-semibold">
            Derm<span className="text-blue-600">AI</span>
            <span className="text-gray-400 font-normal ml-2">— Hệ Thống Phân Tích Tổn Thương Da 2 Giai Đoạn</span>
          </div>
          <div className="text-gray-400 text-xs">
            UNet++ · EfficientNet-B2 · FastAPI · React · Dice = 0.871
          </div>
          <div className="text-orange-600 text-xs max-w-xs text-center md:text-right">
            Chỉ dùng cho nghiên cứu. Không thay thế chẩn đoán y tế chuyên nghiệp.
          </div>
        </div>
      </footer>
    </div>
  )
}
