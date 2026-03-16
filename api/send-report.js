import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, html, subject } = req.body
  if (!to || !html) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const { data, error } = await resend.emails.send({
    from: 'Daybook <onboarding@resend.dev>',
    to,
    subject: subject || 'Daybook Report',
    html,
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true, id: data.id })
}
