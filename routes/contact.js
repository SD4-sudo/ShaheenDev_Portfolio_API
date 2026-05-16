import express from 'express'
import nodemailer from 'nodemailer'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const router = express.Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

// ── POST /api/contact ─────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const { firstName, lastName, email, message } = req.body ?? {}

  // ── Validation ────────────────────────────────────────────────────────────
  const missing = []
  if (!firstName?.trim()) missing.push('firstName')
  if (!email?.trim())     missing.push('email')
  if (!message?.trim())   missing.push('message')

  if (missing.length) {
    return res.status(400).json({
      error: `Missing required fields: ${missing.join(', ')}`,
    })
  }

  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPass) {
    console.error('[contact] GMAIL_USER or GMAIL_APP_PASSWORD env vars are not set')
    return res.status(500).json({
      error: 'Server email configuration is incomplete.',
    })
  }

  // ── Transport ─────────────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  })

  // ── Build template values — exact same logic as original ──────────────────
  const fullName    = [firstName.trim(), lastName?.trim()].filter(Boolean).join(' ')
  const safeMessage = message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const deliveredAt = new Date().toLocaleString('en-US', {
    year:       'numeric',
    month:      'long',
    day:        'numeric',
    hour:       '2-digit',
    minute:     '2-digit',
    second:     '2-digit',
    timeZoneName: 'short',
  })

  // ── Load & fill template ──────────────────────────────────────────────────
  const templatePath = resolve(__dirname, '../templates/mailTemplate.html')
  let emailTemplate  = readFileSync(templatePath, 'utf-8')

  emailTemplate = emailTemplate
    .replace(/{{fullName}}/g,     fullName)
    .replace(/{{email}}/g,        email.trim())
    .replace(/{{safeMessage}}/g,  safeMessage)
    .replace(/{{deliveredAt}}/g,  deliveredAt)

  // ── Send ──────────────────────────────────────────────────────────────────
  try {
    await transporter.sendMail({
      from:    `"Shaheen Developers Website" <${gmailUser}>`,
      to:      gmailUser,
      replyTo: email.trim(),
      subject: `New Enquiry from ${fullName}`,
      html:    emailTemplate,
    })
  } catch (err) {
    console.error('[contact] sendMail failed:', err)
    return res.status(500).json({
      error: 'Failed to send email. Please try again later.',
    })
  }

  return res.json({
    success: true,
    message: 'Your message has been sent! We will get back to you soon.',
  })
})

export default router