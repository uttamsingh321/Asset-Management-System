import * as React from 'react'
import type { Language } from '@/lib/indiaLocale'
import type { UserProfile } from '@/lib/deviceTracker'
import { toast } from 'sonner'

interface SecurityLogRecord {
  id: number
  timestamp: string
  action: 'LOGIN' | 'LOGIN_FAILURE' | 'ACCOUNT_LOCKOUT' | 'USER_UNLOCK'
  userId: string
  userName: string
  role: string
  clientIp: string
  deviceType: string
  os: string
  browser: string
  details?: Record<string, any>
}

interface LockedAccount {
  id: number
  userId: string
  name: string
  department: string
  role: string
  failedLoginAttempts: number
  lockedUntil: string | null
  lockoutReason?: string
}

interface SuperuserSecurityViewProps {
  currentUser: UserProfile
  lang: Language
}

export const SuperuserSecurityView: React.FC<SuperuserSecurityViewProps> = ({ currentUser, lang }) => {
  const [logs, setLogs] = React.useState<SecurityLogRecord[]>([])
  const [lockedAccounts, setLockedAccounts] = React.useState<LockedAccount[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [actionFilter, setActionFilter] = React.useState<string>('All')

  // STRICT SUPERUSER CHECK:
  // Must be superuser (not even standard Admin is allowed)
  const isSuperuser = Boolean(
    currentUser.isSuperuser ||
    currentUser.userId === 'USR-ADMIN' ||
    currentUser.role === 'Superuser'
  )

  const fetchSecurityAudit = React.useCallback(async () => {
    if (!isSuperuser) return
    setLoading(true)
    try {
      const res = await fetch('/api/security/login-audit/', {
        headers: {
          'X-Superuser': 'true',
          'X-User-Id': currentUser.userId,
          'X-User-Role': currentUser.role,
        },
      })

      if (res.status === 403) {
        toast.error('Access Forbidden: Only Superuser can view security audit logs.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        throw new Error('Failed to load security audit trail from server')
      }

      const data = await res.json()
      setLogs(data.logs || [])
      setLockedAccounts(data.lockedAccounts || [])
    } catch {
      // Offline fallback: load from local audit trail
      try {
        const localLogs = JSON.parse(localStorage.getItem('meridian_local_audit_logs') || '[]')
        const secLogs = localLogs.filter((l: any) =>
          ['LOGIN', 'LOGIN_FAILURE', 'ACCOUNT_LOCKOUT', 'USER_UNLOCK'].includes(l.action)
        )
        setLogs(secLogs)
      } catch {
        toast.error('Could not load security audit trail')
      }
    } finally {
      setLoading(false)
    }
  }, [currentUser, isSuperuser])

  React.useEffect(() => {
    fetchSecurityAudit()
  }, [fetchSecurityAudit])

  const handleUnlockUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/security/unlock-user/${userId}/`, {
        method: 'POST',
        headers: {
          'X-Superuser': 'true',
          'X-User-Id': currentUser.userId,
        },
      })

      if (!res.ok) {
        throw new Error('Failed to unlock user account')
      }

      toast.success(`User ${userId} unlocked successfully by Superuser`)
      // Refresh list
      fetchSecurityAudit()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unlock user')
    }
  }

  // If not superuser, render strict blockade
  if (!isSuperuser) {
    return (
      <div className="card p-12 text-center max-w-2xl mx-auto my-12 border-red-500/30 bg-red-500/5 space-y-4">
        <div className="text-5xl">🚫</div>
        <h2 className="text-lg font-bold text-red-600 uppercase tracking-wider">
          Superuser Access Required
        </h2>
        <p className="text-xs text-[var(--mute)] max-w-md mx-auto">
          Security lockout policies and login IP audit records are strictly restricted to the Superuser. Administrators, Plant Managers, and other roles are prohibited from viewing these records.
        </p>
        <div className="text-[11px] font-mono text-[var(--mute)] bg-[var(--surf)] p-3 rounded-lg border border-[var(--line)] inline-block">
          Logged in as: {currentUser.userName} ({currentUser.userId}) · Role: {currentUser.role}
        </div>
      </div>
    )
  }

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'All' && log.action !== actionFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      log.userId.toLowerCase().includes(q) ||
      log.userName.toLowerCase().includes(q) ||
      log.clientIp.toLowerCase().includes(q) ||
      (log.details?.factory || '').toLowerCase().includes(q) ||
      (log.details?.reason || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6" id="v-superuser-security">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔒</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--ink)]">
                  {lang === 'hi' ? 'सुपरयूज़र सुरक्षा: लॉगिन आईपी ऑडिट एवं लॉकआउट' : 'Superuser Security: Login IP Audit & Lockout Control'}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  Strict Superuser Only
                </span>
              </div>
              <p className="text-xs text-[var(--mute)] mt-1">
                {lang === 'hi'
                  ? 'असफल प्रयासों पर लॉकआउट नीतियां, लॉगिन आईपी ट्रैकिंग और अनलॉक प्रबंधन। केवल सुपरयूज़र द्वारा दृश्यमान।'
                  : 'Real-time telemetry recording login IP addresses, failed password attempts, and 15-minute consecutive lockouts.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSecurityAudit}
            disabled={loading}
            className="btn text-xs flex items-center gap-1.5 px-3 py-2 cursor-pointer"
          >
            <span>↻</span>
            <span>{loading ? 'Refreshing...' : 'Refresh Logs'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between border-l-4 border-l-red-500">
          <div className="text-[11px] text-[var(--mute)] font-medium">Currently Locked Accounts</div>
          <div className="text-lg sm:text-xl font-black text-red-600 mt-0.5 mb-1">{lockedAccounts.length}</div>
          <div className="text-[10px] text-[var(--mute)]">5 consecutive failures</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between border-l-4 border-l-amber-500">
          <div className="text-[11px] text-[var(--mute)] font-medium">Failed Login Attempts</div>
          <div className="text-lg sm:text-xl font-black text-amber-500 mt-0.5 mb-1">
            {logs.filter((l) => l.action === 'LOGIN_FAILURE').length}
          </div>
          <div className="text-[10px] text-[var(--mute)]">Recorded with client IP</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div className="text-[11px] text-[var(--mute)] font-medium">Authorized Logins</div>
          <div className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5 mb-1">
            {logs.filter((l) => l.action === 'LOGIN').length}
          </div>
          <div className="text-[10px] text-[var(--mute)]">100% verified sessions</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between border-l-4 border-l-blue-500">
          <div className="text-[11px] text-[var(--mute)] font-medium">Unique IP Addresses</div>
          <div className="text-lg sm:text-xl font-black text-blue-600 mt-0.5 mb-1">
            {new Set(logs.map((l) => l.clientIp).filter(Boolean)).size}
          </div>
          <div className="text-[10px] text-[var(--mute)]">Plant terminals tracked</div>
        </div>
      </div>

      {/* Currently Locked Accounts Section */}
      {lockedAccounts.length > 0 && (
        <div className="card p-5 border border-red-500/30 bg-red-500/5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <h2 className="text-sm font-bold text-red-600">
                Locked User Accounts Awaiting Superuser Action ({lockedAccounts.length})
              </h2>
            </div>
            <span className="text-[11px] text-[var(--mute)]">Auto-unlocks after 15 minutes or manual unlock</span>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-48 border border-red-500/20 rounded-xl scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--surf)] border-b border-red-500/20 shadow-xs">
                <tr className="border-b border-red-500/20 text-[var(--mute)] uppercase tracking-wider text-[11px] bg-[var(--surf)]">
                  <th className="py-2.5 px-3 bg-[var(--surf)]">User ID</th>
                  <th className="py-2.5 px-3 bg-[var(--surf)]">Name</th>
                  <th className="py-2.5 px-3 bg-[var(--surf)]">Department</th>
                  <th className="py-2.5 px-3 bg-[var(--surf)]">Failures</th>
                  <th className="py-2.5 px-3 bg-[var(--surf)]">Lockout Reason</th>
                  <th className="py-2.5 px-3 bg-[var(--surf)]">Locked Until</th>
                  <th className="py-2.5 px-3 text-right bg-[var(--surf)]">Superuser Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-500/10">
                {lockedAccounts.map((acc) => (
                  <tr key={acc.userId} className="hover:bg-red-500/10 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink)]">{acc.userId}</td>
                    <td className="py-2.5 px-3 font-medium">{acc.name}</td>
                    <td className="py-2.5 px-3">{acc.department}</td>
                    <td className="py-2.5 px-3 font-bold text-red-600">{acc.failedLoginAttempts} attempts</td>
                    <td className="py-2.5 px-3 text-[var(--mute)]">{acc.lockoutReason || 'Exceeded 5 failed attempts'}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {acc.lockedUntil ? new Date(acc.lockedUntil).toLocaleTimeString() : 'Active Lock'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleUnlockUser(acc.userId)}
                        className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                      >
                        🔓 Unlock Account
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Audit Trail Table */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--ink)]">
              Security Login & Client IP Audit Trail
            </h2>
            <p className="text-[11px] text-[var(--mute)]">
              Immutable log of every login attempt, IP address, device telemetry, and lockout trigger.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Action filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)]"
            >
              <option value="All">All Actions</option>
              <option value="LOGIN">LOGIN (Success)</option>
              <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
              <option value="ACCOUNT_LOCKOUT">ACCOUNT_LOCKOUT</option>
              <option value="USER_UNLOCK">USER_UNLOCK</option>
            </select>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user, IP, factory..."
                className="text-xs py-1.5 pl-7 pr-3 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] w-48"
              />
              <span className="absolute left-2 top-1.5 text-xs text-[var(--mute)]">🔍</span>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-320px)] min-h-[320px] border border-[var(--line)] rounded-xl scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[var(--surf)] border-b border-[var(--line)] shadow-xs">
              <tr className="border-b border-[var(--line)] text-[var(--mute)] uppercase tracking-wider text-[10px] bg-[var(--surf)]">
                <th className="py-2 px-2 bg-[var(--surf)]">Date & Time</th>
                <th className="py-2 px-2 bg-[var(--surf)]">Action</th>
                <th className="py-2 px-2 bg-[var(--surf)]">User ID & Name</th>
                <th className="py-2 px-2 bg-[var(--surf)]">Client IP</th>
                <th className="py-2 px-2 bg-[var(--surf)]">Factory</th>
                <th className="py-2 px-2 bg-[var(--surf)]">Device / Telemetry</th>
                <th className="py-2 px-2 bg-[var(--surf)]">Security Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const isFail = log.action === 'LOGIN_FAILURE'
                  const isLock = log.action === 'ACCOUNT_LOCKOUT'
                  const isUnlock = log.action === 'USER_UNLOCK'

                  const badgeClass = isLock
                    ? 'bg-red-500/10 text-red-600 border-red-500/20'
                    : isFail
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : isUnlock
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'

                  return (
                    <tr key={`${log.id}-${log.timestamp}`} className="hover:bg-[var(--surf2)]/50 transition">
                      <td className="py-2 px-2 font-mono text-[10px] text-[var(--mute)] break-all">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${badgeClass} whitespace-nowrap`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="font-mono text-[var(--ink)] font-bold text-[10px] truncate">{log.userId}</div>
                        <div className="text-[10px] text-[var(--mute)] truncate">{log.userName}</div>
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-blue-600 text-[10px]">
                        {log.clientIp || '127.0.0.1'}
                      </td>
                      <td className="py-2 px-2 text-[10px] text-[var(--ink)] truncate">
                        {log.details?.factory || 'Noida Plant'}
                      </td>
                      <td className="py-2 px-2 text-[10px] text-[var(--mute)]">
                        <div className="truncate">{log.deviceType} · {log.os}</div>
                        <div className="truncate">{log.browser}</div>
                      </td>
                      <td className="py-2 px-2 text-[10px] text-[var(--mute)] truncate">
                        {log.details?.reason ||
                          log.details?.authMethod ||
                          (log.details?.failedAttempts ? `Attempt ${log.details.failedAttempts}/5` : 'Standard authentication')}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--mute)]">
                    No security audit logs found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SuperuserSecurityView
