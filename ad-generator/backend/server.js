require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const helmet     = require('helmet')
const morgan     = require('morgan')
const compression = require('compression')
const rateLimit  = require('express-rate-limit')

const researchRoutes   = require('./routes/research')
const generateRoutes   = require('./routes/generate')
const facebookRoutes   = require('./routes/facebook')
const analyticsRoutes  = require('./routes/analytics')
const ghlBookingRoutes = require('./routes/ghlBooking')

const app  = express()
const PORT = process.env.PORT || 5000

// ── Security & middleware ──────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow CDN assets
  contentSecurityPolicy: false, // managed by frontend
}))
app.use(compression())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(cors({ origin: ['http://localhost:3000', 'https://brayneai.com', 'https://www.brayneai.com'] }))
app.use(express.json({ limit: '10mb' }))

// ── Rate limiting — tiered by route cost ─────────────────────
const generalLimiter = rateLimit({ windowMs: 60_000, max: 60,  standardHeaders: true, legacyHeaders: false })
const aiLimiter      = rateLimit({ windowMs: 60_000, max: 15,  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many AI requests — wait a minute before retrying' }
})
const fbLimiter      = rateLimit({ windowMs: 60_000, max: 30,  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many Facebook API requests — wait a minute before retrying' }
})

app.use('/api/', generalLimiter)
app.use('/api/research',  aiLimiter)
app.use('/api/generate',  aiLimiter)
app.use('/api/facebook',  fbLimiter)

// ── Routes ────────────────────────────────────────────────────
app.use('/api/research',     researchRoutes)
app.use('/api/generate',     generateRoutes)
app.use('/api/facebook',     facebookRoutes)
app.use('/api/analytics',    analyticsRoutes)
app.use('/api/ghl-booking',  ghlBookingRoutes)   // Vapi tool calls → GHL calendar

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'Brayne AI Ad Generator',
    version: require('./package.json').version,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    apis: {
      anthropic:  !!process.env.ANTHROPIC_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
      facebook:   !!process.env.FACEBOOK_ACCESS_TOKEN,
    },
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  console.error(`[ERROR] ${req.method} ${req.path} → ${err.message}`)
  res.status(status).json({ error: err.message || 'Internal server error' })
})

// ── Startup ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Brayne AI Ad Generator backend running on http://localhost:${PORT}`)
  console.log(`   Anthropic API:  ${process.env.ANTHROPIC_API_KEY ? '✅ Connected' : '❌ Missing ANTHROPIC_API_KEY'}`)
  console.log(`   Perplexity API: ${process.env.PERPLEXITY_API_KEY ? '✅ Connected' : '❌ Missing PERPLEXITY_API_KEY'}`)
  console.log(`   Facebook API:   ${process.env.FACEBOOK_ACCESS_TOKEN ? '✅ Connected' : '❌ Missing FACEBOOK_ACCESS_TOKEN'}`)
  console.log(`   Environment:    ${process.env.NODE_ENV || 'development'}\n`)
})
