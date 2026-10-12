import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, Sparkles } from 'lucide-react'
import { getAppConfig } from '@/lib/app-config'
import { LoginForm } from './login-form'

const { appName, supportEmail } = getAppConfig()

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link className="auth-brand" href="/login"><span className="brand-mark"><span>i</span><span>m</span></span><span>{appName.toLowerCase()}</span><i /></Link>
        <div className="story-copy"><span className="story-kicker"><Sparkles size={14} /> PEOPLE, IN SYNC</span><h1>Great teams start with <em>showing up.</em></h1><p>One clear place for attendance, time away, and the people who make your work matter.</p><div className="story-proof"><span><BadgeCheck size={17} />Thoughtful by design</span><span><BadgeCheck size={17} />Built for your team</span></div></div>
        <div className="story-footer"><span>{appName}</span>{supportEmail && <Link href={`mailto:${supportEmail}`}>Need help? <ArrowUpRight size={13} /></Link>}</div>
        <div className="story-shape shape-one" /><div className="story-shape shape-two" />
      </section>
      <section className="auth-side"><div className="auth-card"><div className="auth-heading"><span className="eyebrow">WELCOME BACK</span><h2>Sign in to your workspace</h2><p>Use your work account to continue.</p></div>{error === 'office-network' && <p className="auth-error" role="alert">Employee sign-in is only available from the registered office network.</p>}{error === 'profile-not-configured' && <p className="auth-error" role="alert">Your account is not assigned to an active company. Ask HR for help.</p>}<LoginForm /><p className="auth-invite-note">Invited to {appName}? Open the secure invite link sent to your work email to finish setting up your account.</p></div><div className="auth-footnote">By signing in, you agree to your organization’s acceptable use policy.</div></section>
    </main>
  )
}