require('dotenv').config()
const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const researchRoutes  = require('./routes/research')
const generateRoutes  = require('./routes/generate')
const facebookRoutes  = require('./routes/facebook')
const analyticsRoutes = require('./routes/analytics')

const app  = express()
const PORT = process.env.PORT || 5000

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:3000', 'https://brayneai.com', 'https://www.brayneai.com'] }))
app.use(express.json({ limit: '10mb' }))

const limiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true })
app.use('/api/', limiter)

// ── Routes ────────────────────────────────────────────────────
app.use('/api/research',  researchRoutes)
app.use('/api/generate',  generateRoutes)
app.use('/api/facebook',  facebookRoutes)
app.use('/api/analytics', analyticsRoutes)

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'Brayne AI Ad Generator',
    timestamp: new Date().toISOString(),
    apis: {
      anthropic:  !!process.env.ANTHROPIC_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
      facebook:   !!process.env.FACEBOOK_ACCESS_TOKEN,
    },
  })
})

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Brayne AI Ad Generator backend running on http://localhost:${PORT}`)
  console.log(`   Anthropic API:  ${process.env.ANTHROPIC_API_KEY ? '✅ Connected' : '❌ Missing ANTHROPIC_API_KEY'}`)
  console.log(`   Perplexity API: ${process.env.PERPLEXITY_API_KEY ? '✅ Connected' : '❌ Missing PERPLEXITY_API_KEY'}`)
  console.log(`   Facebook API:   ${process.env.FACEBOOK_ACCESS_TOKEN ? '✅ Connected' : '❌ Missing FACEBOOK_ACCESS_TOKEN'}\n`)
})
