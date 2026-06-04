import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_URL || '').trim()

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120_000,
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

export async function getAnalytics(days = 30) {
  try {
    const response = await client.get('/api/v1/analytics/summary', {
      params: { days },
      timeout: 10_000,
    })
    return response.data
  } catch {
    return null
  }
}
