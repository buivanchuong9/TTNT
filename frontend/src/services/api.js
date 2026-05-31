import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120_000,  // 2 minutes — model inference can be slow on CPU
})

export async function analyzeImage(file, onUploadProgress) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await client.post('/api/v1/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })

  return response.data
}

export async function checkHealth() {
  const response = await client.get('/api/v1/health')
  return response.data
}
