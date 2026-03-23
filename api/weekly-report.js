import { createClient } from '@supabase/supabase-js'
import { transporter, generatePDF, generateEmailBody, fetchLedgerGroups } from './_reportUtils.js'

// Returns the most recent April 1 as a YYYY-MM-DD string (Indian fiscal year start).
function fiscalYearStart() {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-04-01`
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
  if (usersError) return res.status(500).json({ error: usersError.message })

  const fromDate = fiscalYearStart()
  const toDate   = toDateStr(new Date())
  const filename  = `daybook-report-${fromDate}-to-${toDate}.pdf`

  const results = []
  for (const user of users) {
    if (!user.email) continue
    try {
      const ledgerGroups = await fetchLedgerGroups(user.id, fromDate, toDate, supabaseAdmin)
      if (ledgerGroups.length === 0) continue

      const html      = generateEmailBody(fromDate, toDate)
      const pdfBuffer = generatePDF(ledgerGroups, fromDate, toDate)

      await transporter.sendMail({
        from: `Daybook <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: 'Daybook Weekly Report',
        html,
        attachments: [{ filename, content: pdfBuffer }],
      })
      results.push({ email: user.email, status: 'sent' })
    } catch (err) {
      results.push({ email: user.email, status: 'error', error: err.message })
    }
  }

  return res.status(200).json({ sent: results.filter((r) => r.status === 'sent').length, results })
}
