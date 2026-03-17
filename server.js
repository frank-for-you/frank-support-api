require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

// CORS — allow requests from frank store
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://store.frankfor.you');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Rate limiting — 5 requests per IP per 15 minutes
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again later.' },
});

// Escape HTML to prevent injection
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// POST /support/contact
app.post('/support/contact', contactLimiter, async (req, res) => {
  const { name, email, orderNumber, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields: name, email, subject, message' });
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeOrderNumber = escapeHtml(orderNumber || 'not provided');
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);

  const mailOptions = {
    from: `"Frank Store Support" <${process.env.SMTP_FROM}>`,
    to: process.env.SUPPORT_EMAIL,
    replyTo: `"${safeName}" <${safeEmail}>`,
    subject: `[Support] ${subject}`,
    text: [
      `From: ${name} <${email}>`,
      `Order number: ${orderNumber || 'not provided'}`,
      `Subject: ${subject}`,
      '',
      message,
    ].join('\n'),
    html: `
      <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
      <p><strong>Order number:</strong> ${safeOrderNumber}</p>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <hr>
      <p>${safeMessage.replace(/\n/g, '<br>')}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Support email sent from ${email} — ${subject}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to send support email:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please email support@frankfor.you directly.' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Support API running on port ${PORT}`));
