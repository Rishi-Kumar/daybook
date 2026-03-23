import { createClient } from '@supabase/supabase-js'
import { transporter, generatePDF, generateEmailBody, fetchLedgerGroups } from './_reportUtils.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorised' })

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorised' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const { to, fromDate, toDate } = body ?? {}
  if (!to || !fromDate || !toDate) return res.status(400).json({ error: 'Missing required fields' })

  const ledgerGroups = await fetchLedgerGroups(user.id, fromDate, toDate, supabaseAdmin)
  if (ledgerGroups.length === 0) return res.status(400).json({ error: 'No transactions found in this date range' })

  const html      = generateEmailBody(fromDate, toDate)
  const pdfBuffer = generatePDF(ledgerGroups, fromDate, toDate)
  const filename  = `daybook-report-${fromDate}-to-${toDate}.pdf`

  try {
    await transporter.sendMail({
      from: `Daybook <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Daybook Report',
      html,
      attachments: [{ filename, content: pdfBuffer }],
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  return res.status(200).json({ ok: true })
}
