import React, { useRef, useState, useCallback } from 'react'
import {
  Upload, ImagePlus, AlertCircle, ArrowRight,
  CheckCircle, FileImage, Zap, Shield
} from 'lucide-react'

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp']
const ACCEPTED_EXTS = ['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp']
const MAX_MB    = 20

const TIPS = [
  { icon: Zap,       text: 'Use well-lit, in-focus dermoscopy images for best results' },
  { icon: Shield,    text: 'Minimum recommended resolution: 600 × 450 px' },
  { icon: CheckCircle, text: 'Centre the lesion in the frame before uploading' },
]

export default function UploadZone({ onFileSelect, disabled }) {
  const inputRef              = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  const validate = (file) => {
    const ext = (file.name || '').toLowerCase().slice(((file.name || '').lastIndexOf('.')))
    const hasValidType = file.type && ACCEPTED.includes(file.type)
    const hasValidExt = ACCEPTED_EXTS.includes(ext)

    if (!hasValidType && !hasValidExt) {
      const typeLabel = file.type || 'unknown'
      setFileError(`Unsupported format: ${typeLabel}. Please use JPEG, PNG, BMP, TIFF, or WEBP.`)
      return false
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFileError(`File too large (${(file.size / 1e6).toFixed(1)} MB). Maximum: ${MAX_MB} MB.`)
      return false
    }
    setFileError('')
    return true
  }

  const handleFile = useCallback((file) => {
    if (!file || disabled) return
    if (validate(file)) onFileSelect(file)
  }, [onFileSelect, disabled])

  const onDrop      = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <div className="max-w-4xl mx-auto animate-fade-in" id="platform">

      {/* Section header */}
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
          <FileImage className="w-4 h-4" />
          Upload Workspace
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Upload Your Dermoscopy Image
        </h2>
        <p className="text-gray-500 text-base max-w-xl mx-auto">
          The AI pipeline will run 9 stages automatically and return a full clinical analysis report
          in seconds.
        </p>
      </div>

      {/* Pipeline preview strip */}
      <div className="flex items-center justify-center gap-1.5 mb-8 flex-wrap">
        {['Quality Check', 'Segmentation', 'Mask Refinement', 'ROI Extraction', 'Classification', 'Top-K Ranking'].map((s, i, arr) => (
          <React.Fragment key={s}>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
              {s}
            </span>
            {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-200
          flex flex-col items-center justify-center gap-6 py-20 px-8
          ${dragging
            ? 'border-blue-500 bg-blue-50/80 scale-[1.01] shadow-lg shadow-blue-100'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/20 hover:shadow-md'
          }
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        {/* Scanning animation while dragging */}
        {dragging && (
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan" />
          </div>
        )}

        {/* Upload icon */}
        <div className={`
          w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300
          ${dragging
            ? 'bg-blue-100 scale-110 shadow-lg shadow-blue-200'
            : 'bg-gradient-to-br from-gray-100 to-gray-50 group-hover:from-blue-50 group-hover:to-indigo-50 group-hover:scale-105'
          }
        `}>
          <ImagePlus className={`w-12 h-12 transition-colors ${dragging ? 'text-blue-600' : 'text-gray-300 group-hover:text-blue-500'}`} />
        </div>

        <div className="text-center space-y-2">
          <p className="text-xl font-bold text-gray-800">
            {dragging ? 'Release to Analyse' : 'Drag & Drop Dermoscopy Image'}
          </p>
          <p className="text-gray-500">
            or{' '}
            <span className="text-blue-600 font-semibold underline underline-offset-2 cursor-pointer">
              click to browse files
            </span>
          </p>
          <p className="text-gray-400 text-sm">
            JPEG · PNG · BMP · TIFF · WEBP &nbsp;·&nbsp; Max {MAX_MB} MB
          </p>
        </div>

        <Upload className={`absolute right-6 top-6 w-5 h-5 transition-colors ${dragging ? 'text-blue-400' : 'text-gray-200 group-hover:text-gray-300'}`} />

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
          disabled={disabled}
        />
      </div>

      {/* File error */}
      {fileError && (
        <div className="mt-4 flex items-center gap-3 text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Tips */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIPS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

    </div>
  )
}
