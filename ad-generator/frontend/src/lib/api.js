import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.error || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

// ── Research ──────────────────────────────────────────────────
export const researchAudience = (payload) =>
  api.post('/research', payload)

// ── Copy generation ───────────────────────────────────────────
export const generateCopy = (payload) =>
  api.post('/generate/copy', payload)

export const generateVariations = (payload) =>
  api.post('/generate/variations', payload)

// ── Facebook Ads API ──────────────────────────────────────────
export const pushAdsDraft = (payload) =>
  api.post('/facebook/push-drafts', payload)

export const getFacebookAdSets = (adAccountId) =>
  api.get(`/facebook/adsets/${adAccountId}`)

export const getAnalytics = (adAccountId, dateRange) =>
  api.get(`/facebook/analytics/${adAccountId}`, { params: dateRange })

// ── Ad preview image upload ───────────────────────────────────
export const uploadImage = (formData) =>
  api.post('/facebook/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
