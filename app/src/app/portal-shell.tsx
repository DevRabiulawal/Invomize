'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowRight, Bell,
  CalendarCheck2, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3,
  Download, Fingerprint, LayoutDashboard, LogOut, Menu, Plus, Search, Settings,
  ShieldCheck, Users, X,
} from 'lucide-react'
import type { AttendanceStatus, LeaveStatus, UserRole } from '@/lib/database.types'
import { getAppConfig } from '@/lib/app-config'

const { appName } = getAppConfig()

type Employee = { id: string; email: string; full_name: string; role: UserRole; job_title: string | null; department: string | null; employment_status: string; created_at: string }
type Attendance = { id: string; date: string; checked_in_at: string; checked_out_at: string | null; status: AttendanceStatus; late_minutes: number; penalty_points: number }
type Score = { total_working_days: number; absences: number; penalty_points: number; score_percent: number }
type LeaderboardRow = { user_id: string; full_name: string; department: string | null; job_title: string | null; check_in_status: AttendanceStatus; checked_in_at: string | null; penalty_points: number; score_percent: number }
type LeaveRequest = { id: string; user_id: string; employee_name: string; leave_type: string; start_date: string; end_date: string; working_days: number; reason: string; status: LeaveStatus; reviewed_at: string | null; created_at: string }
type ShiftConfig = { shift_start: string; shift_end: string; grace_minutes: number; late_penalty_points: number; max_daily_base: number; time_zone: string; working_days: number[] }
type Section = 'Overview' | 'Employees' | 'Attendance' | 'Leave requests' | 'Shift & policy' | 'Settings' | 'My day' | 'My attendance' | 'Team leaderboard'
type Modal = 'invite' | 'leave' | null

const hrNavigation: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Employees', icon: Users },
  { label: 'Attendance', icon: CalendarCheck2 },
  { label: 'Leave requests', icon: CalendarDays },
  { label: 'Shift & policy', icon: Clock3 },
  { label: 'Settings', icon: Settings },
]
const employeeNavigation: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'My day', icon: LayoutDashboard },
  { label: 'My attendance', icon: CalendarCheck2 },
  { label: 'Team leaderboard', icon: Users },
  { label: 'Leave requests', icon: CalendarDays },
]

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' })
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.')
  return payload
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase()
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <span className={`portal-avatar ${large ? 'portal-avatar-large' : ''}`} aria-label={name}>{initials(name)}</span>
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string | number; detail: string; icon: ReactNode; tone: string }) {
  return <article className="portal-metric"><div className="portal-metric-top"><span>{label}</span><i className={tone}>{icon}</i></div><strong>{value}</strong><small>{detail}</small></article>
}

function Status({ value }: { value: AttendanceStatus | LeaveStatus | string }) {
  const normalized = value.toLowerCase()
  return <span className={`portal-status status-${normalized}`}><i />{value.replaceAll('_', ' ')}</span>
}

export function PortalShell({ role, fullName, email, companyName }: { role: UserRole; fullName: string; email: string; companyName: string }) {
  const isHr = role === 'HR'
  const navigation = isHr ? hrNavigation : employeeNavigation
  const [section, setSection] = useState<Section>(isHr ? 'Overview' : 'My day')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [score, setScore] = useState<Score | null>(null)
  const [companyToday, setCompanyToday] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [shift, setShift] = useState<ShiftConfig | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [mobileNavigation, setMobileNavigation] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setNotice('')
      try {
        if (isHr) {
          if (section === 'Overview' || section === 'Employees') {
            const result = await api<{ employees: Employee[] }>('/api/hr/employees')
            if (!cancelled) setEmployees(result.employees)
          }
          if (section === 'Overview' || section === 'Attendance' || section === 'Shift & policy') {
            const [board, config] = await Promise.all([
              api<{ leaderboard: LeaderboardRow[] }>('/api/attendance/leaderboard'),
              section === 'Shift & policy' ? api<{ shift: ShiftConfig }>('/api/hr/shift-config') : Promise.resolve(null),
            ])
            if (!cancelled) {
              setLeaderboard(board.leaderboard)
              if (config) setShift(config.shift)
            }
          }
          if (section === 'Overview' || section === 'Leave requests') {
            const result = await api<{ requests: LeaveRequest[] }>('/api/leaves')
            if (!cancelled) setRequests(result.requests)
          }
        } else {
          if (section === 'My day' || section === 'My attendance') {
            const result = await api<{ attendance: Attendance[]; score: Score | null; today: string }>('/api/attendance/history')
            if (!cancelled) { setAttendance(result.attendance); setScore(result.score); setCompanyToday(result.today) }
          }
          if (section === 'My day' || section === 'Team leaderboard') {
            const result = await api<{ leaderboard: LeaderboardRow[] }>('/api/attendance/leaderboard')
            if (!cancelled) setLeaderboard(result.leaderboard)
          }
          if (section === 'My day' || section === 'Leave requests') {
            const result = await api<{ requests: LeaveRequest[] }>('/api/leaves')
            if (!cancelled) setRequests(result.requests)
          }
        }
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : 'Unable to load this page.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [isHr, section, refreshKey])

  const toast = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4000)
  }

  const checkIn = async () => {
    setBusy(true)
    try {
      const result = await api<{ attendance: Attendance }>('/api/attendance/check-in', { method: 'POST', body: '{}' })
      setAttendance((current) => [result.attendance, ...current.filter((row) => row.date !== result.attendance.date)])
      toast(result.attendance.status === 'LATE' ? 'You are checked in. Today is marked late.' : 'You are checked in for today.')
      setRefreshKey((value) => value + 1)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Check-in failed.')
    } finally { setBusy(false) }
  }

  const checkOut = async () => {
    setBusy(true)
    try {
      const result = await api<{ attendance: Attendance }>('/api/attendance/check-out', { method: 'POST', body: '{}' })
      setAttendance((current) => current.map((row) => row.date === result.attendance.date ? { ...row, checked_out_at: result.attendance.checked_out_at } : row))
      toast('You are checked out for today.')
      setRefreshKey((value) => value + 1)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Check-out failed.')
    } finally { setBusy(false) }
  }

  const exportAttendanceCsv = async () => {
    try {
      const response = await fetch('/api/hr/export-attendance', { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error ?? 'Unable to export attendance data.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'attendance-export.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast('Attendance export downloaded.')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not export attendance.')
    }
  }

  const submitForm = async (event: FormEvent<HTMLFormElement>, kind: 'invite' | 'leave') => {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const body = kind === 'invite'
      ? { email: form.get('email'), fullName: form.get('fullName'), jobTitle: form.get('jobTitle'), department: form.get('department') }
      : { leaveType: form.get('leaveType'), startDate: form.get('startDate'), endDate: form.get('endDate'), reason: form.get('reason') }
    try {
      await api(kind === 'invite' ? '/api/hr/invite' : '/api/leaves/request', { method: 'POST', body: JSON.stringify(body) })
      setModal(null)
      toast(kind === 'invite' ? 'Invitation sent to the employee.' : 'Leave request sent for review.')
      setSection(kind === 'invite' ? 'Employees' : 'Leave requests')
      setRefreshKey((value) => value + 1)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not submit this form.')
    } finally { setBusy(false) }
  }

  const decideLeave = async (requestId: string, decision: 'APPROVED' | 'DECLINED') => {
    setBusy(true)
    try {
      await api('/api/leaves/approve', { method: 'PATCH', body: JSON.stringify({ requestId, decision }) })
      toast(`Leave request ${decision.toLowerCase()}.`)
      setRefreshKey((value) => value + 1)
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not review this request.') }
    finally { setBusy(false) }
  }

  const saveShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const workingDays = form.getAll('workingDays').map(Number)
    const body = {
      shiftStart: form.get('shiftStart'), shiftEnd: form.get('shiftEnd'),
      graceMinutes: Number(form.get('graceMinutes')), latePenaltyPoints: Number(form.get('latePenaltyPoints')),
      maxDailyBase: Number(form.get('maxDailyBase')), timeZone: form.get('timeZone'), workingDays,
    }
    try {
      const result = await api<{ shift: ShiftConfig }>('/api/hr/shift-config', { method: 'POST', body: JSON.stringify(body) })
      setShift(result.shift)
      toast('Shift policy saved.')
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not save shift policy.') }
    finally { setBusy(false) }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/login')
  }

  const filteredEmployees = employees.filter((employee) => `${employee.full_name} ${employee.email} ${employee.department ?? ''} ${employee.job_title ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const filteredBoard = leaderboard.filter((person) => `${person.full_name} ${person.department ?? ''} ${person.job_title ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const checkedInToday = attendance.some((record) => record.date === companyToday)
  const pageTitle = section === 'Overview' ? 'People overview' : section === 'My day' ? 'My day' : section

  return (
    <div className="portal-root">
      {mobileNavigation && <button className="portal-scrim" aria-label="Close navigation" onClick={() => setMobileNavigation(false)} />}
      <aside className={`portal-sidebar ${mobileNavigation ? 'portal-sidebar-open' : ''}`}>
        <a className="portal-brand" href={isHr ? '/hr' : '/employee'}><span className="brand-mark"><span>i</span><span>m</span></span><b>{appName.toLowerCase()}</b><i /></a>
        <div className="portal-company"><span>{initials(companyName)[0]}</span><div><strong>{companyName}</strong><small>Workspace</small></div><ChevronDown size={15} /></div>
        <nav className="portal-nav" aria-label={`${isHr ? 'HR' : 'Employee'} navigation`}>
          <span className="portal-nav-label">{isHr ? 'PEOPLE OPERATIONS' : 'YOUR WORKSPACE'}</span>
          {navigation.map(({ label, icon: Icon }) => <button key={label} className={`portal-nav-item ${section === label ? 'active' : ''}`} onClick={() => { setSection(label); setMobileNavigation(false); setSearch('') }}><Icon size={18} /><span>{label}</span>{label === 'Leave requests' && pendingCount > 0 && <small>{pendingCount}</small>}</button>)}
        </nav>
        <div className="portal-sidebar-bottom"><div className="portal-help"><ShieldCheck size={17} /><div><strong>Workspace protected</strong><span>Secure people records</span></div></div><div className="portal-user"><Avatar name={fullName} /><div><strong>{fullName}</strong><small>{isHr ? 'HR administrator' : 'Employee'}</small></div><button aria-label="Sign out" onClick={logout}><LogOut size={17} /></button></div></div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar"><button className="portal-menu" aria-label="Open navigation" onClick={() => setMobileNavigation(true)}><Menu size={19} /></button><div className="portal-breadcrumb">{companyName} <span>/</span> <strong>{section}</strong></div><div className="portal-top-actions"><label><Search size={16} /><input aria-label="Search this page" placeholder="Search people..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><button aria-label="Notifications" onClick={() => toast('You’re all caught up.')}><Bell size={18} /><i /></button><Avatar name={fullName} /></div></header>
        <main className="portal-content">
          <div className="portal-heading"><div><span className="eyebrow">{isHr ? 'PEOPLE OPERATIONS' : 'YOUR WORKSPACE'}</span><h1>{pageTitle}</h1><p>{isHr ? 'A clear view of your people, attendance, and time away.' : 'Your attendance and time away, all in one place.'}</p></div><div className="portal-heading-actions">{isHr && section === 'Employees' && <button className="portal-button primary" onClick={() => setModal('invite')}><Plus size={16} /> Invite employee</button>}{!isHr && section === 'Leave requests' && <button className="portal-button primary" onClick={() => setModal('leave')}><Plus size={16} /> Request leave</button>}</div></div>
          {notice && <div className={`portal-notice ${notice.toLowerCase().includes('failed') || notice.toLowerCase().includes('unable') || notice.toLowerCase().includes('only available') || notice.toLowerCase().includes('could not') ? 'notice-error' : ''}`} role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button></div>}
          {loading ? <div className="portal-loading"><span /><span /><span />Loading your workspace…</div> : <>
            {isHr && section === 'Overview' && <HrOverview employees={employees} leaderboard={leaderboard} requests={requests} onNavigate={setSection} />}
            {isHr && section === 'Employees' && <EmployeeDirectory employees={filteredEmployees} search={search} onInvite={() => setModal('invite')} />}
            {isHr && section === 'Attendance' && <AttendanceTable rows={filteredBoard} isHr onExport={() => void exportAttendanceCsv()} />}
            {section === 'Leave requests' && <LeaveTable requests={requests} isHr={isHr} busy={busy} onDecide={decideLeave} />}
            {isHr && section === 'Shift & policy' && <ShiftEditor shift={shift} busy={busy} onSubmit={saveShift} />}
            {isHr && section === 'Settings' && <SettingsPanel fullName={fullName} email={email} onLogout={logout} />}
            {!isHr && section === 'My day' && <EmployeeOverview fullName={fullName} attendance={attendance} score={score} leaderboard={leaderboard} checkedInToday={checkedInToday} companyToday={companyToday} busy={busy} onCheckIn={checkIn} onCheckOut={checkOut} onNavigate={setSection} />}
            {!isHr && section === 'My attendance' && <EmployeeHistory attendance={attendance} score={score} />}
            {!isHr && section === 'Team leaderboard' && <AttendanceTable rows={filteredBoard} />}
          </>}
        </main>
        <footer className="portal-footer"><span>{appName}</span><span>People operations, made simple.</span><span><i /> Secure workspace</span></footer>
      </div>
      {modal && <div className="portal-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="portal-modal-title"><header><div><span className="eyebrow">{modal === 'invite' ? 'PEOPLE DIRECTORY' : 'TIME AWAY'}</span><h2 id="portal-modal-title">{modal === 'invite' ? 'Invite a teammate' : 'Request time off'}</h2></div><button aria-label="Close dialog" onClick={() => setModal(null)}><X size={18} /></button></header><form onSubmit={(event) => void submitForm(event, modal)}><div className="portal-modal-body">{modal === 'invite' ? <><Field label="Full name"><input name="fullName" required maxLength={160} placeholder="e.g. Jordan Lee" /></Field><Field label="Work email"><input name="email" type="email" required maxLength={254} placeholder="jordan@company.com" /></Field><div className="portal-form-grid"><Field label="Job title"><input name="jobTitle" maxLength={120} placeholder="Product designer" /></Field><Field label="Department"><input name="department" maxLength={120} placeholder="Design" /></Field></div><p className="portal-form-note"><ShieldCheck size={15} /> The invite will create an employee account with no administrative access.</p></> : <><Field label="Leave type"><select name="leaveType" defaultValue="ANNUAL"><option value="ANNUAL">Annual leave</option><option value="SICK">Sick leave</option><option value="PERSONAL">Personal day</option><option value="UNPAID">Unpaid leave</option></select></Field><div className="portal-form-grid"><Field label="Start date"><input name="startDate" type="date" required /></Field><Field label="End date"><input name="endDate" type="date" required /></Field></div><Field label="Reason"><textarea name="reason" rows={3} required minLength={2} maxLength={2000} placeholder="Share a short note for your manager" /></Field><p className="portal-form-note"><CalendarDays size={15} /> Working days are calculated from your company calendar.</p></>}</div><footer><button className="portal-button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="portal-button primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : modal === 'invite' ? 'Send invitation' : 'Submit request'} <ArrowRight size={15} /></button></footer></form></section></div>}
    </div>
  )
}

function HrOverview({ employees, leaderboard, requests, onNavigate }: { employees: Employee[]; leaderboard: LeaderboardRow[]; requests: LeaveRequest[]; onNavigate: (section: Section) => void }) {
  const pending = requests.filter((request) => request.status === 'PENDING')
  const present = leaderboard.filter((person) => person.check_in_status === 'PRESENT').length
  const late = leaderboard.filter((person) => person.check_in_status === 'LATE').length
  return <>
    <section className="portal-metrics"><Metric label="Team members" value={employees.length} detail="Active in your workspace" icon={<Users size={18} />} tone="blue" /><Metric label="Present today" value={present} detail={`${leaderboard.length ? Math.round(present / leaderboard.length * 100) : 0}% of active team`} icon={<CalendarCheck2 size={18} />} tone="green" /><Metric label="Late arrivals" value={late} detail="Today across your team" icon={<Clock3 size={18} />} tone="amber" /><Metric label="Pending leave" value={pending.length} detail="Requests need review" icon={<CalendarDays size={18} />} tone="lilac" /></section>
    <div className="portal-dashboard-grid"><section className="portal-panel"><PanelHeading eyebrow="YOUR PEOPLE" title="Recently added" action={<button className="portal-link" onClick={() => onNavigate('Employees')}>View directory <ArrowRight size={14} /></button>} /><div className="portal-people-list">{employees.slice(0, 5).map((employee) => <div className="portal-person-row" key={employee.id}><Avatar name={employee.full_name} /><div><strong>{employee.full_name}</strong><small>{employee.job_title || employee.email}</small></div><span>{employee.department || 'Unassigned'}</span><Status value={employee.employment_status} /></div>)}{employees.length === 0 && <Empty>No employees yet. Invite your first teammate.</Empty>}</div></section><section className="portal-panel"><PanelHeading eyebrow="NEEDS YOUR ATTENTION" title="Leave approvals" action={<button className="portal-link" onClick={() => onNavigate('Leave requests')}>View requests <ArrowRight size={14} /></button>} /><div className="portal-approval-list">{pending.slice(0, 5).map((request) => <div className="portal-approval-row" key={request.id}><Avatar name={request.user_id.slice(0, 8)} /><div><strong>{request.leave_type}</strong><small>{request.start_date} – {request.end_date} · {request.working_days} days</small></div><Status value="PENDING" /></div>)}{pending.length === 0 && <Empty><CheckCircle2 size={16} /> No pending requests.</Empty>}</div></section></div>
  </>
}

function EmployeeDirectory({ employees, search, onInvite }: { employees: Employee[]; search: string; onInvite: () => void }) {
  return <section className="portal-panel portal-table-panel"><PanelHeading eyebrow="PEOPLE DIRECTORY" title={`${employees.length} team members`} action={<button className="portal-button primary" onClick={onInvite}><Plus size={15} /> Invite employee</button>} /><div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Employee</th><th>Department</th><th>Job title</th><th>Status</th><th>Work email</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td><div className="portal-table-person"><Avatar name={employee.full_name} /><span><strong>{employee.full_name}</strong><small>{employee.role}</small></span></div></td><td>{employee.department || '—'}</td><td>{employee.job_title || '—'}</td><td><Status value={employee.employment_status} /></td><td>{employee.email}</td></tr>)}</tbody></table>{employees.length === 0 && <Empty>{search ? 'No employees match your search.' : 'The directory is empty.'}</Empty>}</div></section>
}

function AttendanceTable({ rows, isHr = false, onExport }: { rows: LeaderboardRow[]; isHr?: boolean; onExport?: () => void }) {
  return <><section className="portal-metrics portal-metrics-three"><Metric label="Present" value={rows.filter((row) => row.check_in_status === 'PRESENT').length} detail="Checked in on time" icon={<CheckCircle2 size={18} />} tone="green" /><Metric label="Late" value={rows.filter((row) => row.check_in_status === 'LATE').length} detail="Checked in after grace" icon={<Clock3 size={18} />} tone="amber" /><Metric label="Absent" value={rows.filter((row) => row.check_in_status === 'ABSENT').length} detail="No check-in recorded" icon={<CalendarDays size={18} />} tone="blue" /></section><section className="portal-panel portal-table-panel"><PanelHeading eyebrow={isHr ? 'WORKFORCE MONITORING' : 'TEAM TRANSPARENCY'} title={isHr ? 'Today’s attendance' : 'Team leaderboard'} action={isHr && onExport ? <button className="portal-button" onClick={onExport}><Download size={15} /> Export CSV</button> : undefined} /><div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Team member</th><th>Department</th><th>Check-in</th><th>Attendance score</th><th>Penalty points</th></tr></thead><tbody>{rows.map((person) => <tr key={person.user_id}><td><div className="portal-table-person"><Avatar name={person.full_name} /><span><strong>{person.full_name}</strong><small>{person.job_title || 'Team member'}</small></span></div></td><td>{person.department || '—'}</td><td><Status value={person.check_in_status} /></td><td><div className="portal-score"><span><i style={{ width: `${Math.max(0, Math.min(100, person.score_percent ?? 0))}%` }} /></span><strong>{Number(person.score_percent ?? 0).toFixed(1)}%</strong></div></td><td>{person.penalty_points}</td></tr>)}</tbody></table>{rows.length === 0 && <Empty>Attendance information is not available yet.</Empty>}</div></section></>
}

function LeaveTable({ requests, isHr, busy, onDecide }: { requests: LeaveRequest[]; isHr: boolean; busy: boolean; onDecide: (requestId: string, decision: 'APPROVED' | 'DECLINED') => void }) {
  const visibleRequests = requests
  return <section className="portal-panel portal-table-panel"><PanelHeading eyebrow={isHr ? 'TIME AWAY' : 'YOUR TIME AWAY'} title={isHr ? 'Leave requests' : 'My leave requests'} /><div className="portal-table-wrap"><table className="portal-table"><thead><tr>{isHr && <th>Employee</th>}<th>Leave type</th><th>Dates requested</th><th>Working days</th><th>Reason</th><th>Status</th>{isHr && <th>Decision</th>}</tr></thead><tbody>{visibleRequests.map((request) => <tr key={request.id}>{isHr && <td>{request.employee_name}</td>}<td>{request.leave_type}</td><td>{request.start_date} – {request.end_date}</td><td>{request.working_days}</td><td className="portal-reason">{request.reason}</td><td><Status value={request.status} /></td>{isHr && <td>{request.status === 'PENDING' ? <div className="portal-decision"><button disabled={busy} aria-label={`Approve leave for ${request.employee_name}`} onClick={() => onDecide(request.id, 'APPROVED')}><Check size={16} /></button><button disabled={busy} aria-label={`Decline leave for ${request.employee_name}`} onClick={() => onDecide(request.id, 'DECLINED')}><X size={16} /></button></div> : <small>{request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : 'Reviewed'}</small>}</td>}</tr>)}</tbody></table>{visibleRequests.length === 0 && <Empty>No leave requests to show.</Empty>}</div></section>
}

function EmployeeOverview({ fullName, attendance, score, leaderboard, checkedInToday, companyToday, busy, onCheckIn, onCheckOut, onNavigate }: { fullName: string; attendance: Attendance[]; score: Score | null; leaderboard: LeaderboardRow[]; checkedInToday: boolean; companyToday: string; busy: boolean; onCheckIn: () => void; onCheckOut: () => void; onNavigate: (section: Section) => void }) {
  const currentAttendance = attendance.find((row) => row.date === companyToday)
  const checkedOutToday = Boolean(currentAttendance?.checked_out_at)
  const checkInText = checkedOutToday ? 'You’re checked out' : checkedInToday ? 'You’re checked in' : 'Ready to start your day?'
  const checkInSubtitle = currentAttendance
    ? `${currentAttendance.status} · ${new Date(currentAttendance.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${checkedOutToday && currentAttendance.checked_out_at ? ` · out ${new Date(currentAttendance.checked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : checkedInToday ? 'Your attendance is up to date.' : 'Check in from your office network.'
  return <>
    <section className="employee-welcome"><div><span className="eyebrow">TODAY AT A GLANCE</span><h2>Welcome back, {fullName.split(' ')[0]}</h2><p>Make today count. Your attendance is ready when you are.</p></div><div className="employee-checkin"><span className={`checkin-emblem ${checkedInToday ? 'done' : ''}`}>{checkedInToday ? <Check size={22} /> : <Fingerprint size={23} />}</span><div><strong>{checkInText}</strong><small>{checkInSubtitle}</small></div><div className="portal-inline-actions">{!checkedOutToday && <button className="portal-button primary" disabled={busy || checkedInToday} onClick={onCheckIn}>{checkedInToday ? 'Checked in' : busy ? 'Checking in…' : 'Check in'} {!checkedInToday && <ArrowRight size={15} />}</button>}{checkedInToday && !checkedOutToday && <button className="portal-button" disabled={busy} onClick={onCheckOut}>{busy ? 'Checking out…' : 'Check out'}</button>}</div></div></section>
    <section className="portal-metrics"><Metric label="Attendance score" value={`${Number(score?.score_percent ?? 100).toFixed(1)}%`} detail="Based on your working days" icon={<Activity size={18} />} tone="blue" /><Metric label="Penalty points" value={score?.penalty_points ?? 0} detail="Points deducted this period" icon={<Clock3 size={18} />} tone="amber" /><Metric label="Working days" value={score?.total_working_days ?? 0} detail="Since joining your team" icon={<CalendarDays size={18} />} tone="green" /><Metric label="Days absent" value={score?.absences ?? 0} detail="Excludes approved leave" icon={<CalendarCheck2 size={18} />} tone="lilac" /></section>
    <div className="portal-dashboard-grid"><section className="portal-panel"><PanelHeading eyebrow="YOUR RECENT ACTIVITY" title="Attendance history" action={<button className="portal-link" onClick={() => onNavigate('My attendance')}>Full history <ArrowRight size={14} /></button>} /><AttendanceHistoryRows attendance={attendance.slice(0, 5)} /></section><section className="portal-panel"><PanelHeading eyebrow="TEAM TRANSPARENCY" title="Leaderboard" action={<button className="portal-link" onClick={() => onNavigate('Team leaderboard')}>Full board <ArrowRight size={14} /></button>} /><div className="portal-ranking">{leaderboard.slice(0, 5).map((person, index) => <div className="portal-ranking-row" key={person.user_id}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><Avatar name={person.full_name} /><div><strong>{person.full_name}</strong><small>{person.department || person.job_title || 'Team member'}</small></div><b>{Number(person.score_percent ?? 0).toFixed(0)}%</b></div>)}{leaderboard.length === 0 && <Empty>Team scores will appear here.</Empty>}</div></section></div>
  </>
}

function EmployeeHistory({ attendance, score }: { attendance: Attendance[]; score: Score | null }) {
  return <><section className="portal-metrics portal-metrics-three"><Metric label="Score" value={`${Number(score?.score_percent ?? 100).toFixed(1)}%`} detail="Current attendance score" icon={<Activity size={18} />} tone="blue" /><Metric label="Late penalties" value={score?.penalty_points ?? 0} detail="Penalty points accrued" icon={<Clock3 size={18} />} tone="amber" /><Metric label="Absences" value={score?.absences ?? 0} detail="Excludes approved leave" icon={<CalendarDays size={18} />} tone="lilac" /></section><section className="portal-panel portal-table-panel"><PanelHeading eyebrow="PERSONAL RECORD" title="Attendance history" /><AttendanceHistoryRows attendance={attendance} /></section></>
}

function AttendanceHistoryRows({ attendance }: { attendance: Attendance[] }) {
  return <div className="portal-history">{attendance.map((record) => <div className="portal-history-row" key={record.id}><span className="history-date"><CalendarDays size={15} />{record.date}</span><span>{new Date(record.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><Status value={record.status} /><span>{record.penalty_points} pts</span></div>)}{attendance.length === 0 && <Empty>No check-ins recorded yet.</Empty>}</div>
}

function ShiftEditor({ shift, busy, onSubmit }: { shift: ShiftConfig | null; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const workDays = shift?.working_days ?? [1, 2, 3, 4, 5]
  return <section className="portal-panel portal-settings-card"><PanelHeading eyebrow="COMPANY POLICY" title="Shift & attendance rules" /><p className="portal-settings-copy">These rules determine the daily attendance status and late penalties for your organization.</p><form className="portal-shift-form" onSubmit={onSubmit}><div className="portal-form-grid"><Field label="Shift starts"><input name="shiftStart" type="time" defaultValue={shift?.shift_start.slice(0, 5) ?? '09:00'} required /></Field><Field label="Shift ends"><input name="shiftEnd" type="time" defaultValue={shift?.shift_end.slice(0, 5) ?? '17:00'} required /></Field><Field label="Grace period (minutes)"><input name="graceMinutes" type="number" min="0" max="240" defaultValue={shift?.grace_minutes ?? 10} required /></Field><Field label="Late penalty (points)"><input name="latePenaltyPoints" type="number" min="0" max="100" defaultValue={shift?.late_penalty_points ?? 5} required /></Field><Field label="Maximum daily base"><input name="maxDailyBase" type="number" min="1" step="0.01" defaultValue={shift?.max_daily_base ?? 100} required /></Field><Field label="Time zone"><input name="timeZone" defaultValue={shift?.time_zone ?? 'UTC'} required /></Field></div><fieldset className="portal-workdays"><legend>Working days</legend>{[{day:1,label:'Mon'},{day:2,label:'Tue'},{day:3,label:'Wed'},{day:4,label:'Thu'},{day:5,label:'Fri'},{day:6,label:'Sat'},{day:7,label:'Sun'}].map(({day,label}) => <label key={day}><input name="workingDays" type="checkbox" value={day} defaultChecked={workDays.includes(day)} /><span>{label}</span></label>)}</fieldset><button className="portal-button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save shift policy'} <Check size={16} /></button></form></section>
}

function SettingsPanel({ fullName, email, onLogout }: { fullName: string; email: string; onLogout: () => void }) {
  return <section className="portal-panel portal-settings-card"><PanelHeading eyebrow="ACCOUNT" title="Your workspace account" /><div className="portal-profile-card"><Avatar name={fullName} large /><div><strong>{fullName}</strong><small>{email}</small><span>Signed in with a verified {appName} account.</span></div></div><div className="portal-security-note"><ShieldCheck size={18} /><div><strong>Role-based access is active</strong><span>{'Only your authorized company data is available in this portal.'}</span></div></div><button className="portal-button" onClick={onLogout}><LogOut size={16} /> Sign out</button></section>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="portal-field"><span>{label}</span>{children}</label>
}

function PanelHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <header className="portal-panel-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</header>
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="portal-empty">{children}</div>
}