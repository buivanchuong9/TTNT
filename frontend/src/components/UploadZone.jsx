import React, { useRef, useState, useCallback } from 'react'
import { Upload, ImagePlus, AlertCircle, Microscope, ArrowRight } from 'lucide-react'

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp']
const MAX_MB = 20

export default function UploadZone({ onFileSelect, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  const validate = (file) => {
    if (!ACCEPTED.includes(file.type)) {
      setFileError(`Định dạng không hỗ trợ: ${file.type}. Sử dụng JPEG, PNG, BMP, TIFF, hoặc WEBP.`)
      return false
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFileError(`File quá lớn (${(file.size / 1e6).toFixed(1)} MB). Tối đa: ${MAX_MB} MB.`)
      return false
    }
    setFileError('')
    return true
  }

  const handleFile = useCallback((file) => {
    if (!file || disabled) return
    if (validate(file)) onFileSelect(file)
  }, [onFileSelect, disabled])

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }
  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">

      {/* Hero */}
      <div className="text-center mb-10 space-y-4">
        <div className="inline-flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-sm font-medium">
          <Microscope className="w-4 h-4" />
          Hệ Thống Phân Tích Tổn Thương Da Bằng AI
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
          Tải Ảnh Da Liễu
          <br />
          <span className="text-blue-600">Nhận Kết Quả Phân Tích</span>
        </h2>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
          Hệ thống 2 giai đoạn: phân đoạn tổn thương bằng UNet++ → phân loại bệnh da liễu với xếp hạng xác suất từ cơ sở tri thức y tế 44 bệnh.
        </p>
      </div>

      {/* Pipeline preview */}
      <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
        {['Ảnh gốc', 'Phân đoạn', 'Heatmap', 'Trích xuất ROI', 'Phân loại bệnh'].map((s, i, arr) => (
          <React.Fragment key={s}>
            <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">{s}</span>
            {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
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
          flex flex-col items-center justify-center gap-5 py-20 px-8
          ${dragging
            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
            : 'border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50/30'
          }
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        {dragging && (
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <div className="absolute left-0 right-0 h-0.5 bg-blue-500 animate-scan opacity-70" style={{ position: 'absolute' }} />
          </div>
        )}

        {/* Icon */}
        <div className={`
          w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-200
          ${dragging ? 'bg-blue-100 scale-110' : 'bg-gray-100 group-hover:bg-blue-100'}
        `}>
          <ImagePlus className={`w-10 h-10 transition-colors ${dragging ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
        </div>

        <div className="text-center space-y-1.5">
          <p className="text-xl font-semibold text-gray-800">
            {dragging ? 'Thả file để phân tích' : 'Kéo & thả ảnh da liễu'}
          </p>
          <p className="text-gray-500">
            hoặc <span className="text-blue-600 font-medium underline underline-offset-2 cursor-pointer">chọn file</span>
          </p>
          <p className="text-gray-400 text-sm">JPEG · PNG · BMP · TIFF · WEBP &nbsp;·&nbsp; Tối đa {MAX_MB} MB</p>
        </div>

        <Upload className={`absolute right-6 top-6 w-5 h-5 transition-colors ${dragging ? 'text-blue-500' : 'text-gray-300 group-hover:text-gray-400'}`} />

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
          disabled={disabled}
        />
      </div>

      {fileError && (
        <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {fileError}
        </div>
      )}
    </div>
  )
}
