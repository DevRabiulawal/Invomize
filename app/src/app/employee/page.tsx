import { requireRole } from '@/lib/server-auth'
import { getAppConfig } from '@/lib/app-config'
import { PortalShell } from '../portal-shell'

export const dynamic = 'force-dynamic'

const { companyName: defaultCompanyName } = getAppConfig()

export default async function EmployeePortalPage() {
  const { profile } = await requireRole('EMPLOYEE')
  return <PortalShell role="EMPLOYEE" fullName={profile.full_name} email={profile.email} companyName={profile.company_name ?? defaultCompanyName} />
}