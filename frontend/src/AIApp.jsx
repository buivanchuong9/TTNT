import React, { useState, useCallback } from 'react'
import UploadZone from './components/UploadZone'
import ProcessingPipeline from './components/ProcessingPipeline'
import ResultDashboard from './components/ResultDashboard'
import LoadingState from './components/LoadingState'
import ErrorState from './components/ErrorState'
import { analyzeImage } from './services/api'

export default function AIApp() {
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

  const showUpload = appState === 'idle'
  const showLoader = appState === 'uploading' || appState === 'analyzing'
  const showError  = appState === 'error'
  const showResult = appState === 'results'

  return (
    <div className="space-y-8">
      {showUpload && (
        <UploadZone onFileSelect={handleFileSelect} disabled={false} />
      )}

      {showLoader && (
        <LoadingState stage={appState} uploadPct={uploadPct} previewSrc={preview} />
      )}

      {showError && (
        <>
          <ErrorState message={errorMsg} partialResult={result} onRetry={handleReset} />
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
    </div>
  )
}
