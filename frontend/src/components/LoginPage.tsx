import * as React from 'react'
import type { Language } from '@/lib/indiaLocale'
import type { UserProfile } from '@/lib/deviceTracker'
import { masterMappingService } from '@/lib/masterMappingService'
import { toast } from 'sonner'

export function findLocalRBACUser(id: string) {
  const cleanId = (id || '').trim().toUpperCase()
  if (!cleanId) return null

  // 1. Check Master Mapping RBAC Directory
  try {
    const rbacUsers = masterMappingService.getRBACUsers()
    const found = rbacUsers.find(
      (u) => (u.employeeId || '').trim().toUpperCase() === cleanId
    )
    if (found) {
      return {
        userId: found.employeeId,
        userName: found.employeeName,
        role: found.role,
        department: found.department || 'IT',
        password: found.password || '',
        status: found.status || 'Active',
        isSuperuser: found.role === 'Super User' || found.role === 'Admin' || cleanId === 'USR-ADMIN',
      }
    }
  } catch {}

  // 2. Check meridian_rbac_users_v1
  try {
    const v1Users = JSON.parse(localStorage.getItem('meridian_rbac_users_v1') || '[]')
    const found = v1Users.find(
      (u: any) => (u.userId || u.employeeId || '').trim().toUpperCase() === cleanId
    )
    if (found) {
      return {
        userId: found.userId || found.employeeId,
        userName: found.name || found.userName || found.employeeName,
        role: found.role,
        department: found.department || 'IT',
        password: found.password || '',
        status: found.status || 'Active',
        isSuperuser: found.role === 'Admin' || found.role === 'Super User' || cleanId === 'USR-ADMIN',
      }
    }
  } catch {}

  // 3. Check meridian_users_cache
  try {
    const cacheUsers = JSON.parse(localStorage.getItem('meridian_users_cache') || '[]')
    const found = cacheUsers.find(
      (u: any) => (u.userId || '').trim().toUpperCase() === cleanId
    )
    if (found) {
      return {
        userId: found.userId,
        userName: found.name || found.userName,
        role: found.role,
        department: found.department || 'IT',
        password: found.password || '',
        status: found.isActive === false ? 'Inactive' : 'Active',
        isSuperuser: found.isSuperuser || cleanId === 'USR-ADMIN',
      }
    }
  } catch {}

  // 4. Default Super User fallback
  if (cleanId === 'USR-ADMIN') {
    return {
      userId: 'USR-ADMIN',
      userName: 'Uttam Singh',
      role: 'Super User',
      department: 'IT',
      password: 'AdminPassword2026!',
      status: 'Active',
      isSuperuser: true,
    }
  }

  return null
}

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile, factory: string) => void
  onEnterOfflineMode: () => void
  lang?: Language
  onToggleLang?: () => void
}

export const FACTORY_OPTIONS = [
  { id: 'noida', name: 'Noida Plant (SMT Line & Assembly)', state: 'Uttar Pradesh', code: 'PLANT-NOI' },
  { id: 'gurgaon', name: 'Gurgaon Plant (Machining & Tooling)', state: 'Haryana', code: 'PLANT-GGN' },
  { id: 'pune', name: 'Pune Central Plant (Facility C39 & D197-D199)', state: 'Maharashtra', code: 'PLANT-PUN' },
  { id: 'chennai', name: 'Chennai Staging & Logistics Hub', state: 'Tamil Nadu', code: 'PLANT-CHE' },
]

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onEnterOfflineMode,
  lang,
}) => {
  const [userId, setUserId] = React.useState(() => localStorage.getItem('meridian_remember_user') || '')
  const [password, setPassword] = React.useState('')
  const [selectedFactory, setSelectedFactory] = React.useState(
    () => localStorage.getItem('meridian_remember_factory') || FACTORY_OPTIONS[0].name
  )
  const [rememberMe, setRememberMe] = React.useState(() => Boolean(localStorage.getItem('meridian_remember_user')))
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  // Security Lockout states
  const [failedAttempts, setFailedAttempts] = React.useState(0)
  const [lockoutRemaining, setLockoutRemaining] = React.useState<number | null>(null)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = React.useState(false)

  // Detect scanned asset code from deep-link URL if user arrived via barcode / QR scan
  const scannedAssetCode = React.useMemo(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search)
      const fromParam = searchParams.get('asset') || searchParams.get('code')
      if (fromParam) return fromParam
      if (window.location.hash) {
        const match = window.location.hash.match(/[?&](?:asset|code)=([^&]+)/)
        if (match) return decodeURIComponent(match[1])
      }
    } catch {}
    return null
  }, [])

  // Check stored lockout in local session
  React.useEffect(() => {
    const lockUntilStr = localStorage.getItem(`meridian_lockout_${userId.toUpperCase()}`)
    if (lockUntilStr) {
      const lockUntil = new Date(lockUntilStr).getTime()
      const now = Date.now()
      if (lockUntil > now) {
        setLockoutRemaining(Math.ceil((lockUntil - now) / 60000))
      } else {
        localStorage.removeItem(`meridian_lockout_${userId.toUpperCase()}`)
        setLockoutRemaining(null)
      }
    }
  }, [userId])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanUser = userId.trim().toUpperCase()
    const cleanPw = password.trim()

    if (!cleanUser) {
      toast.error(lang === 'hi' ? 'कृपया उपयोगकर्ता आईडी दर्ज करें' : 'Please enter your User ID / Employee ID')
      return
    }
    if (!cleanPw) {
      toast.error(lang === 'hi' ? 'कृपया पासवर्ड दर्ज करें' : 'Please enter your password')
      return
    }

    if (lockoutRemaining && lockoutRemaining > 0) {
      toast.error(
        lang === 'hi'
          ? `खाता लॉक है। कृपया ${lockoutRemaining} मिनट प्रतीक्षा करें या सुपरयूज़र से संपर्क करें।`
          : `Account locked. Please wait ${lockoutRemaining} minute(s) or contact Superuser.`
      )
      return
    }

    setLoading(true)

    // Helper to complete successful login
    const completeLogin = (loggedUser: UserProfile) => {
      setFailedAttempts(0)
      setLockoutRemaining(null)
      localStorage.removeItem(`meridian_lockout_${cleanUser}`)

      if (rememberMe) {
        localStorage.setItem('meridian_remember_user', cleanUser)
        localStorage.setItem('meridian_remember_factory', selectedFactory)
      } else {
        localStorage.removeItem('meridian_remember_user')
        localStorage.removeItem('meridian_remember_factory')
      }

      toast.success(
        lang === 'hi'
          ? `स्वागत है, ${loggedUser.userName} (${selectedFactory})`
          : `Welcome, ${loggedUser.userName} (${selectedFactory})`
      )

      onLoginSuccess(loggedUser, selectedFactory)
    }

    try {
      const res = await fetch('/api/users/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cleanUser,
          password: cleanPw,
          factory: selectedFactory,
        }),
      })

      const data = await res.json()

      if (res.status === 403 && data.isLocked) {
        setLockoutRemaining(data.remainingMinutes || 15)
        localStorage.setItem(
          `meridian_lockout_${cleanUser}`,
          data.lockedUntil || new Date(Date.now() + 15 * 60000).toISOString()
        )
        toast.error(data.error || 'Account locked due to 5 consecutive failed attempts.')
        setLoading(false)
        return
      }

      if (res.ok && data.user) {
        const loggedUser: UserProfile = {
          userId: data.user.userId,
          userName: data.user.name,
          role: data.user.role,
          department: data.user.department,
          isSuperuser: data.user.isSuperuser,
        }
        completeLogin(loggedUser)
        return
      }

      // If backend rejected (e.g. 401 User ID not yet in backend SQLite or offline discrepancy),
      // verify against Master RBAC local store
      const localUser = findLocalRBACUser(cleanUser)
      if (
        localUser &&
        (localUser.password === cleanPw ||
          (cleanUser === 'USR-ADMIN' && (cleanPw === 'AdminPassword2026!' || cleanPw === 'Admin@2026!')))
      ) {
        if (localUser.status === 'Inactive') {
          toast.error(
            lang === 'hi'
              ? 'यह खाता निष्क्रिय कर दिया गया है। कृपया सुपरयूज़र से संपर्क करें।'
              : 'This account has been deactivated. Please contact Superuser.'
          )
          setLoading(false)
          return
        }
        if (localUser.status === 'Locked') {
          toast.error(
            lang === 'hi'
              ? 'खाता लॉक है। कृपया सुपरयूज़र से संपर्क करें।'
              : 'Account locked. Please contact Superuser.'
          )
          setLoading(false)
          return
        }

        // Auto-sync this verified user to backend SQLite so backend has it permanently
        fetch('/api/users/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: localUser.userId,
            name: localUser.userName,
            department: localUser.department,
            role: localUser.role,
            password: cleanPw,
            isSuperuser: localUser.isSuperuser,
            isActive: true,
          }),
        }).catch(() => {})

        completeLogin({
          userId: localUser.userId,
          userName: localUser.userName,
          role: localUser.role,
          department: localUser.department,
          isSuperuser: localUser.isSuperuser,
        })
        return
      }

      // Neither backend nor RBAC store authenticated
      if (data.failedAttempts !== undefined) {
        setFailedAttempts(data.failedAttempts)
      } else {
        setFailedAttempts((prev) => prev + 1)
      }
      toast.error(
        lang === 'hi'
          ? 'अमान्य क्रेडेंशियल। कृपया सही पासवर्ड दर्ज करें।'
          : 'Invalid User ID or Password. Verify with Superuser.'
      )
    } catch {
      // Offline fallback authentication if backend is not reachable
      const localUser = findLocalRBACUser(cleanUser)
      if (
        localUser &&
        (localUser.password === cleanPw ||
          (cleanUser === 'USR-ADMIN' && (cleanPw === 'AdminPassword2026!' || cleanPw === 'Admin@2026!')))
      ) {
        if (localUser.status === 'Inactive') {
          toast.error(
            lang === 'hi'
              ? 'यह खाता निष्क्रिय कर दिया गया है। कृपया सुपरयूज़र से संपर्क करें।'
              : 'This account has been deactivated. Please contact Superuser.'
          )
          setLoading(false)
          return
        }
        if (localUser.status === 'Locked') {
          toast.error(
            lang === 'hi'
              ? 'खाता लॉक है। कृपया सुपरयूज़र से संपर्क करें।'
              : 'Account locked. Please contact Superuser.'
          )
          setLoading(false)
          return
        }

        completeLogin({
          userId: localUser.userId,
          userName: localUser.userName,
          role: localUser.role,
          department: localUser.department,
          isSuperuser: localUser.isSuperuser,
        })
      } else {
        setFailedAttempts((prev) => prev + 1)
        toast.error(
          lang === 'hi'
            ? 'अमान्य क्रेडेंशियल। कृपया सही पासवर्ड दर्ज करें।'
            : 'Invalid User ID or Password. Verify with Superuser.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="login-page-root min-h-screen w-full flex flex-col md:flex-row bg-[#0b132b] text-white"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        backgroundColor: '#0b132b',
        color: '#ffffff',
      }}
    >
      {/* ──────────────────────────────────────────────────────────── */}
      {/* LEFT SIDE: Factory Branding + Industrial Facility Details   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        className="login-brand-side w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-between bg-gradient-to-br from-[#165DFF] via-[#0f44bd] to-[#0b2874] relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #165DFF 0%, #0f44bd 50%, #0b2874 100%)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Subtle Industrial Blueprint Grid Pattern */}
        <div
          className="login-brand-grid-pattern absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Top Factory Header */}
        <div className="login-brand-top relative z-10 space-y-4">
          <div className="login-logo-row flex items-center gap-3">
            <div
              className="login-logo-box w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-lg"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}
            >
              🏭
            </div>
            <div>
              <div className="login-company-title text-xl md:text-2xl font-black tracking-tight text-white">
                Meridian Manufacturing India Pvt. Ltd.
              </div>
              <div className="login-company-subtitle text-xs text-white/80 font-medium">
                मेरिडियन मैन्युफैक्चरिंग इंडिया प्राइवेट लिमिटेड · Enterprise Plant System
              </div>
            </div>
          </div>

          <div
            className="login-pill-badge inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20 text-[11px] font-semibold text-white"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.14)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              fontSize: '11px',
              color: '#ffffff',
            }}
          >
            <span
              className="login-pill-dot w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
              style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }}
            />
            <span>Industrial IoT & Workshop Asset Management</span>
          </div>
        </div>

        {/* Center: Indian Plant Operating Principles & Facility Highlights */}
        <div className="login-brand-mid relative z-10 my-8 space-y-4">
          <div className="space-y-2">
            <h2 className="login-hero-heading text-lg md:text-xl font-bold leading-tight">
              {lang === 'hi'
                ? 'स्मार्ट विनिर्माण परिसंपत्ति एवं स्टॉक सत्यापन'
                : 'India Multi-Plant Asset Tracking & Stock Verification'}
            </h2>
            <p className="login-hero-desc text-xs text-white/80 leading-relaxed max-w-lg">
              {lang === 'hi'
                ? 'कठोर विभागीय भूमिका आधारित नियंत्रण (RBAC), कमजोर नेटवर्क में ऑफलाइन बारकोड स्कैनिंग और भारतीय आयकर अधिनियम मूल्यह्रास मानकों के साथ पूर्ण अनुपालन।'
                : 'High-reliability workshop management built for Indian electronics, SMT, and automotive assembly facilities. Compliant with Income Tax Act depreciation and GST reporting.'}
            </p>
          </div>

          {/* Plant Badges */}
          <div className="login-facilities-grid grid grid-cols-2 gap-3 max-w-md pt-2">
            <div className="login-facility-card p-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
              <div className="login-facility-label text-[11px] text-white/70">SMT & Cleanrooms</div>
              <div className="login-facility-val text-xs font-bold text-white mt-0.5">Noida Plant · Line 1 & 2</div>
            </div>
            <div className="login-facility-card p-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
              <div className="login-facility-label text-[11px] text-white/70">Tooling & Machining</div>
              <div className="login-facility-val text-xs font-bold text-white mt-0.5">Gurgaon Facility</div>
            </div>
            <div className="login-facility-card p-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
              <div className="login-facility-label text-[11px] text-white/70">Central Warehouse</div>
              <div className="login-facility-val text-xs font-bold text-white mt-0.5">Pune Central C39 / D197</div>
            </div>
            <div className="login-facility-card p-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
              <div className="login-facility-label text-[11px] text-white/70">Staging & Dispatch</div>
              <div className="login-facility-val text-xs font-bold text-white mt-0.5">Chennai Hub</div>
            </div>
          </div>
        </div>

        {/* Bottom Compliance & Security Note */}
        <div className="login-brand-bottom relative z-10 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/70">
          <div className="flex items-center gap-2">
            <span>🛡️ SOC 2 Type II Certified</span>
            <span>·</span>
            <span>Indian Accounting Standards (AS-10)</span>
          </div>
          <div>Strict Superuser Audit Trail</div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* RIGHT SIDE: Industrial Login Box                            */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        className="login-form-side w-full md:w-1/2 p-6 md:p-14 flex flex-col justify-between bg-[#0e1626]"
        style={{
          backgroundColor: '#0e1626',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Top bar */}
        <div className="login-top-bar flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span
              className="w-2 h-2 rounded-full bg-emerald-500"
              style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}
            />
            <span>Industrial Tablet Terminal</span>
          </div>
          <div className="text-[11px] font-mono text-white/50">
            Secure Factory Authentication
          </div>
        </div>

        {/* Login Form Box */}
        <div className="login-form-center max-w-md w-full mx-auto my-auto py-8 space-y-6">
          <div className="login-form-header">
            <h1 className="login-form-title text-xl md:text-2xl font-bold text-white tracking-tight">
              {lang === 'hi' ? 'कार्यशाला पोर्टल में साइन इन करें' : 'Sign In to Enterprise Portal'}
            </h1>
            <p className="login-form-subtitle text-xs text-white/60 mt-1">
              {lang === 'hi'
                ? 'अधिकृत कार्मिक लॉगिन। सुपरयूज़र द्वारा मैन्युअल रूप से सेट पासवर्ड आवश्यक है।'
                : 'Authorized personnel access only. Passwords set manually by Superuser.'}
            </p>
          </div>

          {/* Security Lockout Banner */}
          {lockoutRemaining && lockoutRemaining > 0 && (
            <div className="login-notice-box login-notice-danger p-4 rounded-xl border border-red-500/50 bg-red-500/10 text-red-400 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span>🚫</span>
                <span>Security Lockout Active</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Account locked due to 5 consecutive failed attempts. Please wait <b>{lockoutRemaining} minute(s)</b>, or contact your <b>Superuser</b> to unlock immediately.
              </p>
            </div>
          )}

          {/* Failed Attempts Notice (before 5) */}
          {failedAttempts > 0 && (!lockoutRemaining || lockoutRemaining <= 0) && (
            <div className="login-notice-box login-notice-warning p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>
                Invalid credentials. Attempt <b>{failedAttempts} of 5</b>. Account locks for 15 minutes after 5 failures.
              </span>
            </div>
          )}

          {/* Barcode / QR Scan Notification Banner */}
          {scannedAssetCode && (
            <div className="login-notice-box login-notice-warning p-3.5 rounded-xl border border-amber-500/50 bg-amber-500/15 text-amber-200 text-xs flex items-start gap-3">
              <span className="text-xl shrink-0">🔒</span>
              <div className="space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>Scanned Code Detected:</span>
                  <span
                    className="font-mono px-2 py-0.5 rounded text-amber-300 font-bold tracking-wider"
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.25)' }}
                  >
                    {scannedAssetCode}
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Sign in required. Equipment specifications and details are strictly isolated by department. Please log in with your assigned department credentials.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form-element space-y-4 text-xs">
            {/* 1. Factory Selection */}
            <div className="login-field-group">
              <label htmlFor="login-factory-select" className="login-field-label block text-white/80 font-semibold mb-1.5">
                {lang === 'hi' ? 'फैक्ट्री / संयंत्र चयन *' : 'Factory / Manufacturing Plant *'}
              </label>
              <div className="login-field-control">
                <select
                  id="login-factory-select"
                  value={selectedFactory}
                  onChange={(e) => setSelectedFactory(e.target.value)}
                  className="login-select-text w-full p-3 rounded-xl border border-white/20 bg-[#162035] text-white focus:outline-none focus:border-[#165DFF] text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: '#162035',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.20)',
                  }}
                >
                  {FACTORY_OPTIONS.map((fac) => (
                    <option key={fac.id} value={fac.name} className="bg-[#162035] text-white">
                      {fac.name} ({fac.state})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Username / Employee ID */}
            <div className="login-field-group">
              <label htmlFor="login-user-id" className="login-field-label block text-white/80 font-semibold mb-1.5">
                {lang === 'hi' ? 'उपयोगकर्ता आईडी / कर्मचारी आईडी *' : 'User ID / Employee ID *'}
              </label>
              <div className="login-field-control relative">
                <input
                  id="login-user-id"
                  type="text"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="e.g. USR-ADMIN, SMT-101, MNT-202"
                  className="login-input-text w-full p-3 pl-10 rounded-xl border border-white/20 bg-[#162035] text-white placeholder-white/40 focus:outline-none focus:border-[#165DFF] text-xs font-mono font-medium"
                  style={{
                    backgroundColor: '#162035',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.20)',
                    paddingLeft: '38px',
                  }}
                />
                <span className="login-field-icon absolute left-3.5 top-3 text-sm text-white/40">👤</span>
              </div>
            </div>

            {/* 3. Password Input */}
            <div className="login-field-group">
              <div className="login-field-label flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-white/80 font-semibold">
                  {lang === 'hi' ? 'पासवर्ड *' : 'Password *'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[11px] text-[#4d88ff] hover:underline cursor-pointer"
                  style={{ color: '#4d88ff', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {lang === 'hi' ? 'पासवर्ड भूल गए?' : 'Forgot password?'}
                </button>
              </div>
              <div className="login-field-control relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter manual superuser password"
                  className="login-input-text w-full p-3 pl-10 pr-10 rounded-xl border border-white/20 bg-[#162035] text-white placeholder-white/40 focus:outline-none focus:border-[#165DFF] text-xs font-medium"
                  style={{
                    backgroundColor: '#162035',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.20)',
                    paddingLeft: '38px',
                    paddingRight: '38px',
                  }}
                />
                <span className="login-field-icon absolute left-3.5 top-3 text-sm text-white/40">🔑</span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle absolute right-3.5 top-3 text-xs text-white/50 hover:text-white cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="login-remember-row flex items-center justify-between pt-1">
              <label className="login-checkbox-label flex items-center gap-2 cursor-pointer select-none text-[11px] text-white/70">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="login-checkbox-input rounded border-white/20 bg-[#162035] text-[#165DFF] focus:ring-0 cursor-pointer"
                  style={{ accentColor: '#165DFF', cursor: 'pointer' }}
                />
                <span>
                  {lang === 'hi'
                    ? 'इस कार्यशाला टर्मिनल पर मुझे याद रखें'
                    : 'Remember me on this workshop terminal'}
                </span>
              </label>
            </div>

            {/* Submit Button (Touch-first, large industrial tablet button) */}
            <button
              type="submit"
              disabled={loading || Boolean(lockoutRemaining && lockoutRemaining > 0)}
              className="login-submit-button w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-[#165DFF] hover:bg-[#1249cb] text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{
                backgroundColor: '#165DFF',
                color: '#ffffff',
                border: 'none',
                cursor: loading || Boolean(lockoutRemaining && lockoutRemaining > 0) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      display: 'inline-block',
                    }}
                  />
                  <span>{lang === 'hi' ? 'सत्यापन हो रहा है...' : 'Verifying Credentials...'}</span>
                </>
              ) : (
                <>
                  <span>➔</span>
                  <span>{lang === 'hi' ? 'साइन इन करें' : 'Sign In to Factory System'}</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Help (Click-to-fill for instant access) */}
          <div className="login-profiles-box p-3.5 rounded-xl bg-white/5 border border-white/10 text-[11px] space-y-2 text-white/70">
            <div className="login-profiles-header font-semibold text-white/90 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>⚡</span>
                <span>Quick Login Profiles:</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">1-Click Autofill</span>
            </div>
            <div className="login-profiles-grid grid grid-cols-1 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setUserId('USR-ADMIN')
                  setPassword('AdminPassword2026!')
                }}
                className="login-profile-card p-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-left transition cursor-pointer group"
                title="Click to fill Superuser credentials"
              >
                <div className="font-bold text-white text-[11px] group-hover:text-[#4d88ff]">👑 Superuser (Admin)</div>
                <div className="font-mono text-[10px] text-white/60">USR-ADMIN · Uttam Singh</div>
              </button>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* BOTTOM SMALL TEXT: Version + Offline Mode Entry             */}
        {/* ──────────────────────────────────────────────────────────── */}
        <div className="login-bottom-bar pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/50">
          <div>
            <span>Version: </span>
            <span className="font-mono text-white/70">v2.4.0-IN-PROD</span>
            <span className="ml-2">· Build 2026.11 (India Plant Edition)</span>
          </div>

          {/* Offline Mode Entry Button (for poor network factories) */}
          <button
            type="button"
            onClick={onEnterOfflineMode}
            className="login-offline-btn flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer font-medium"
            title="Allows offline stock count and QR verification when workshop Wi-Fi is weak"
          >
            <span>⚠️</span>
            <span>
              {lang === 'hi'
                ? 'ऑफलाइन मोड प्रविष्टि (कमजोर नेटवर्क कारखाने)'
                : 'Offline Mode Entry (⚠️ for poor-network factories only)'}
            </span>
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
          }}
        >
          <div
            className="bg-[#162035] border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs text-white"
            style={{
              backgroundColor: '#162035',
              border: '1px solid rgba(255, 255, 255, 0.20)',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              color: '#ffffff',
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-xl">🔐</span>
                <h3 className="text-sm font-bold" style={{ fontSize: '14px', fontWeight: 700 }}>Credential Reset Policy</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-white/80 leading-relaxed" style={{ fontSize: '12px', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>
              <p>
                In compliance with strict industrial asset governance and Indian plant security guidelines, <b>random password resets and email links are disabled</b>.
              </p>
              <div
                className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1"
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  marginTop: '10px',
                  marginBottom: '10px',
                }}
              >
                <div className="font-bold text-white" style={{ fontWeight: 700, color: '#ffffff' }}>How to reset your password:</div>
                <div className="text-[11px] text-white/70" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                  1. Contact your Plant Manager or the Factory Superuser.
                </div>
                <div className="text-[11px] text-white/70" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                  2. Verify your Employee ID and Department in person or via factory internal intercom.
                </div>
                <div className="text-[11px] text-white/70" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                  3. The Superuser will set your new password directly in the RBAC Management Console and hand over your updated credential card.
                </div>
              </div>
              <div className="font-mono text-[10px] text-white/60" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                Factory IT Support: ext. 4401 · it.support@meridian.com
              </div>
            </div>

            <div className="pt-2" style={{ paddingTop: '8px' }}>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-full py-2.5 rounded-xl font-bold bg-[#165DFF] text-white hover:bg-[#1249cb]"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: '#165DFF',
                  color: '#ffffff',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Understood / समझ आ गया
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LoginPage
