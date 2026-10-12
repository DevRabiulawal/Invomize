import 'server-only'
import { google } from 'googleapis'

export type AttendanceSheetRow = {
  date: string
  fullName: string
  email: string
  checkInTime: string
  status: 'PRESENT' | 'LATE'
  penaltyPoints: number
}

export async function appendToGoogleSheet(data: AttendanceSheetRow) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Attendance'!A:F"

  if (!email || !privateKey || !spreadsheetId) {
    throw new Error('Google Sheets service account or spreadsheet configuration is missing.')
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[data.date, data.fullName, data.email, data.checkInTime, data.status, data.penaltyPoints]],
    },
  })

  return response.data.updates?.updatedRange ?? null
}