import nodemailer from 'nodemailer'

// Email service configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export interface UsageLogEntry {
  timestamp: string
  user: string
  action: string
}

export async function sendUsageLogsEmail(logs: UsageLogEntry[]): Promise<boolean> {
  try {
    const now = new Date()
    const guatemalaTime = new Date(now.getTime() - (6 * 60 * 60 * 1000)) // UTC-6
    const timestamp = guatemalaTime.toISOString().replace('T', ' ').substring(0, 19)
    
    // Format logs as simple lines
    const logLines = logs.map(log => 
      `${log.timestamp} | ${log.user} | ${log.action}`
    ).join('\n')
    
    const emailContent = `Forma Usage Logs - ${timestamp}
---

${logLines}

---
This is an automated report for adoption monitoring.
 
`

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'jorgeluiscontrerasherrera@gmail.com',
      subject: `Forma Usage Logs - ${timestamp}`,
      text: emailContent,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Usage logs email sent successfully at ${timestamp}`)
    return true
  } catch (error) {
    console.error('Failed to send usage logs email:', error)
    return false
  }
}

export async function testEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify()
    console.log('Email service connection verified')
    return true
  } catch (error) {
    console.error('Email service connection failed:', error)
    return false
  }
}
