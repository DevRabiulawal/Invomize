'use client'

import { useActionState, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, Eye, EyeOff, Fingerprint, ShieldCheck, Users } from 'lucide-react'
import { getAppConfig } from '@/lib/app-config'
import { signInAction, type LoginState } from './actions'

const { appName } = getAppConfig()

export function LoginForm() {
  const [portal, setPortal] = useState<'EMPLOYEE' | 'HR'>('EMPLOYEE')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signInAction, null)

  return (
    <form className="auth-form" action={formAction}>
      <div className="auth-role-switch" role="tablist" aria-label="Choose portal">
        <button type="button" role="tab" aria-selected={portal === 'EMPLOYEE'} className={portal === 'EMPLOYEE' ? 'selected' : ''} onClick={() => setPortal('EMPLOYEE')}><Users size={16} /> Employee</button>
        <button type="button" role="tab" aria-selected={portal === 'HR'} className={portal === 'HR' ? 'selected' : ''} onClick={() => setPortal('HR')}><BriefcaseBusiness size={16} /> HR admin</button>
      </div>
      <input type="hidden" name="portal" value={portal} />
      <label className="auth-field"><span>Work email</span><input autoComplete="username" name="email" type="email" placeholder="you@company.com" required maxLength={254} /></label>
      <label className="auth-field"><span>Password</span><span className="auth-password"><input autoComplete="current-password" name="password" type={passwordVisible ? 'text' : 'password'} placeholder="Enter your password" required maxLength={256} /><button type="button" aria-label={passwordVisible ? 'Hide password' : 'Show password'} onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
      {state?.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="auth-submit" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button>
      <div className="auth-network"><Fingerprint size={16} /><span>{portal === 'EMPLOYEE' ? 'Employee access is limited to the office network.' : 'HR administrators can sign in from any network.'}</span></div>
      <div className="auth-security"><ShieldCheck size={15} /> Your account is secured by {appName}</div>
    </form>
  )
}