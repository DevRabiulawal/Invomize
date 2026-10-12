import { requireRole } from '@/lib/server-auth'
import { getAppConfig } from '@/lib/app-config'
import { PortalShell } from '../portal-shell'

export const dynamic = 'force-dynamic'

const { companyName: defaultCompanyName } = getAppConfig()

export default async function HrPortalPage() {
  const { profile } = await requireRole('HR')
  return <PortalShell role="HR" fullName={profile.full_name} email={profile.email} companyName={profile.company_name ?? defaultCompanyName} />
}