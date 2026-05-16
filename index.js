import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import contactRouter from './routes/contact.js'

const app = express()
const PORT = process.env.PORT || 3001

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allows any origin — no tokens, fully public API
app.use(cors())

app.use(express.json())

// ── Health check ─────────────────────────────────────────────────────────────
// Used by Render's health check ping
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Shaheen Developers API is running',
    timestamp: new Date().toISOString(),
  })
})

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/contact', contactRouter)

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.statusCode ?? 500
  const message = err.statusMessage ?? err.message ?? 'Internal Server Error'
  console.error(`[error] ${status} — ${message}`)
  res.status(status).json({ error: message })
})

app.listen(PORT, () => {
  console.log(`✅ API server running on port ${PORT}`)
})