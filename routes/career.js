import express from 'express'
import multer from 'multer'
import nodemailer from 'nodemailer'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const router = express.Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Email validation (mirrors frontend) ───────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const validateEmail = (email) => EMAIL_RE.test(email.trim())

// ── Multer — memory storage, strict file filter ───────────────────────────────
const ACCEPTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIMES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF or DOCX files are accepted.'))
    }
  },
})

// ── POST /api/career ──────────────────────────────────────────────────────────
router.post('/', upload.single('resume'), async (req, res) => {
  const { fullName, email, phone, message } = req.body ?? {}

  // ── Validation ─────────────────────────────────────────────────────────────
  const missing = []
  if (!fullName?.trim()) missing.push('fullName')
  if (!email?.trim())    missing.push('email')

  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' })
  }

  if (!req.file) {
    return res.status(400).json({ error: 'A résumé file is required.' })
  }

  // ── Gmail config check ─────────────────────────────────────────────────────
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPass) {
    console.error('[career] GMAIL_USER or GMAIL_APP_PASSWORD env vars are not set')
    return res.status(500).json({ error: 'Server email configuration is incomplete.' })
  }

  // ── Build template values ──────────────────────────────────────────────────
  const safeMessage = message?.trim()
    ? message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : null

  const deliveredAt = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  })

  // ── Load & fill template ───────────────────────────────────────────────────
  const templatePath = resolve(__dirname, '../templates/careerMailTemplate.html')
  let html = readFileSync(templatePath, 'utf-8')

  html = html
    .replace(/{{fullName}}/g,    fullName.trim())
    .replace(/{{email}}/g,       email.trim())
    .replace(/{{phone}}/g,       phone?.trim() || 'Not provided')
    .replace(/{{message}}/g,     safeMessage
      ? `<p style="margin:0;font-size:14px;color:#444444;line-height:1.75;">${safeMessage}</p>`
      : `<p style="margin:0;font-size:13px;color:#aaaaaa;font-style:italic;">No message provided.</p>`)
    .replace(/{{deliveredAt}}/g, deliveredAt)

  // ── Transport ──────────────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  })

  // ── Send with résumé attachment ────────────────────────────────────────────
  try {
    await transporter.sendMail({
      from:    `"Shaheen Developers Website" <${gmailUser}>`,
      to:      gmailUser,
      replyTo: email.trim(),
      subject: `New Job Application from ${fullName.trim()}`,
      html,
      attachments: [
        {
          filename:    req.file.originalname,
          content:     req.file.buffer,
          contentType: req.file.mimetype,
        },
      ],
    })
  } catch (err) {
    console.error('[career] sendMail failed:', err)
    return res.status(500).json({ error: 'Failed to send application. Please try again later.' })
  }

  return res.json({
    success: true,
    message: 'Your application has been submitted! We will be in touch if there is a good fit.',
  })
})

// ── Multer error handler (file type / size violations) ────────────────────────
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File must be under 5 MB.' })
  }
  if (err?.message) {
    return res.status(400).json({ error: err.message })
  }
  res.status(500).json({ error: 'An unexpected error occurred.' })
})

export default router