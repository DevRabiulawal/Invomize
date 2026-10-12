import { redirect } from 'next/navigation'
import { getAuthenticatedProfile } from '@/lib/server-auth'
import { acceptInvitation } from './actions'

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getAuthenticatedProfile()
  if (!session?.profile.company_id) redirect('/login')
  const { error } = await searchParams
  const errors: Record<string, string> = {
    password: 'Choose a password between 12 and 128 characters.',
    mismatch: 'The passwords do not match.',
    update: 'Password could not be set. Request a new invitation from HR.',
  }

  return <main className="auth-page auth-setup-page"><section className="auth-side"><div className="auth-card"><div className="auth-heading"><span className="eyebrow">INVITATION ACCEPTED</span><h2>Set your password</h2><p>Welcome, {session.profile.full_name}. Create a password to finish setting up your account.</p></div><form className="auth-form" action={acceptInvitation}><label className="auth-field"><span>New password</span><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label className="auth-field"><span>Confirm password</span><input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>{error && <p className="auth-error" role="alert">{errors[error] ?? 'Unable to accept invitation.'}</p>}<button className="auth-submit" type="submit">Finish setup <span aria-hidden="true">→</span></button></form></div></section></main>
}