export function getAppConfig() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'InvoMize'
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || 'Your company'

  return {
    appName,
    supportEmail,
    companyName,
  }
}