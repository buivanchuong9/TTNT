import React, { useState, useCallback } from 'react'
import Header from './components/Header'
import HeroSection from './components/HeroSection'
import UploadZone from './components/UploadZone'
import ProcessingPipeline from './components/ProcessingPipeline'
import ResultDashboard from './components/ResultDashboard'
import LoadingState from './components/LoadingState'
import ErrorState from './components/ErrorState'
import { analyzeImage } from './services/api'

/**
 * App state machine:
 *   idle → uploading → analyzing → results
 *                               ↘ error
 *   (error) → idle (via retry)
 *   (results) → idle (via new analysis)
 *
 * WHY A CLEAN STATE MACHINE:
 *   Using a single `appState` string prevents impossible combinations
 *   (e.g. showing both UploadZone and ErrorState simultaneously).
 *   Each render branch is exclusive.
 */

export default function App() {
  const [appState,  setAppState]  = useState('idle')
  const [result,    setResult]    = useState(null)
  const [preview,   setPreview]   = useState(null)
  const [errorMsg,  setErrorMsg]  = useState('')
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
      await new Promise(r => setTimeout(r, 500))

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
                || 'Connection error — is the backend running?'
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

  const showHero   = appState === 'idle'
  const showUpload = appState === 'idle'
  const showLoader = appState === 'uploading' || appState === 'analyzing'
  const showError  = appState === 'error'
  const showResult = appState === 'results'

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero / landing section */}
      {showHero && <HeroSection />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {showUpload && (
          <UploadZone onFileSelect={handleFileSelect} disabled={false} />
        )}

        {showLoader && (
          <LoadingState stage={appState} uploadPct={uploadPct} previewSrc={preview} />
        )}

        {showError && (
          <>
            <ErrorState message={errorMsg} partialResult={result} onRetry={handleReset} />
            {/* Allow re-upload after error */}
            <div className="pt-4">
              <UploadZone onFileSelect={handleFileSelect} disabled={false} />
            </div>
          </>
        )}

        {showResult && result && (
          <>
            <ProcessingPipeline images={result.images} />
            <ResultDashboard result={result} onNewAnalysis={handleReset} />
          </>
        )}

      </main>

      <footer className="mt-16 border-t border-gray-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm">
          <div className="text-gray-700 font-bold">
            Derm<span className="text-blue-600">AI</span>
            <span className="text-gray-400 font-normal ml-2">— Skin Lesion Analysis Platform v2</span>
          </div>
          <div className="text-gray-400 text-xs text-center">
            UNet++ · EfficientNet-B2 · Temperature Calibration · FastAPI · React
          </div>
          <div className="text-orange-600 text-xs max-w-xs text-center md:text-right font-medium">
            For research use only. Not a substitute for professional medical diagnosis.
          </div>
        </div>
      </footer>
    </div>
  )
}
