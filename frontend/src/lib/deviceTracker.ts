/**
 * Frontend Device Detection & Audit Logger Service
 * Automatically detects whether the user is on Desktop, Laptop, Tablet, or Mobile,
 * identifies OS and Browser, and logs every audit event to the backend immutable audit log.
 */

export type DeviceType = 'Desktop' | 'Laptop' | 'Tablet' | 'Mobile'
export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILURE'
  | 'ACCOUNT_LOCKOUT'
  | 'USER_UNLOCK'
  | 'THEME_TOGGLE'
  | 'ASSET_CREATE'
  | 'ASSET_UPDATE'
  | 'ASSET_IMPORT'
  | 'ASSET_EXPORT'
  | 'ASSET_TRANSFER'
  | 'ASSET_APPROVAL'
  | 'ASSET_DELETE'
  | 'QR_VERIFY_SCAN'
  | 'CROSS_DEPARTMENT_SCAN_DENIED'
  | 'STOCK_COUNT_START'
  | 'STOCK_COUNT_SCAN_SUCCESS'
  | 'STOCK_COUNT_SCAN_REJECTED'
  | 'STOCK_COUNT_VERIFIED'
  | 'STOCK_COUNT_VARIANCE'
  | 'STOCK_COUNT_COMPLETE'
  | 'TRANSFER_CREATE'
  | 'TRANSFER_APPROVE_LEVEL_1'
  | 'TRANSFER_APPROVE_LEVEL_2'
  | 'TRANSFER_APPROVE_LEVEL_3'
  | 'TRANSFER_REJECT'
  | 'TRANSFER_COMPLETE'

export interface UserProfile {
  userId: string
  userName: string
  role: string
  department?: string
  isSuperuser?: boolean
}

export interface ClientDeviceInfo {
  deviceType: DeviceType
  os: string
  browser: string
  screenResolution: string
  language: string
  hostname: string
}

export interface AuditRecord {
  id?: number | string
  userId: string
  userName: string
  role: string
  sessionId: string
  action: AuditAction
  entityType: string
  entityId: string
  details: Record<string, any>
  timestamp: string
  loginTimestamp?: string
  logoutTimestamp?: string
  clientIp?: string
  hostname?: string
  deviceType: DeviceType
  os: string
  browser: string
  userAgent?: string
}

export interface TrackedDeviceItem {
  id: string
  deviceType: DeviceType
  os: string
  browser: string
  screenResolution: string
  hostname: string
  clientIp: string
  lastUser: string
  lastUserId: string
  lastSeen: string
  isCurrentDevice: boolean
  totalEvents: number
}

/**
 * Returns a consolidated list of all devices detected (including active session device)
 */
export function getTrackedDevices(logs: AuditRecord[] = []): TrackedDeviceItem[] {
  const current = getClientDeviceInfo()
  const currentUser = getCurrentUserProfile()
  const devicesMap = new Map<string, TrackedDeviceItem>()

  // 1. Current active device is always included
  const currentKey = `${current.deviceType}-${current.os}-${current.browser}`
  devicesMap.set(currentKey, {
    id: currentKey,
    deviceType: current.deviceType,
    os: current.os,
    browser: current.browser,
    screenResolution: current.screenResolution,
    hostname: current.hostname,
    clientIp: '127.0.0.1',
    lastUser: currentUser.userName,
    lastUserId: currentUser.userId,
    lastSeen: 'Active Now',
    isCurrentDevice: true,
    totalEvents: 0,
  })

  // 2. Aggregate device fingerprints from audit records
  logs.forEach((log) => {
    const key = `${log.deviceType}-${log.os}-${log.browser}`
    const existing = devicesMap.get(key)
    if (existing) {
      existing.totalEvents += 1
      if (!existing.isCurrentDevice) {
        if (!existing.lastSeen || existing.lastSeen === 'Active Now' || new Date(log.timestamp) > new Date(existing.lastSeen)) {
          existing.lastSeen = log.timestamp
          existing.lastUser = log.userName
          existing.lastUserId = log.userId
          existing.clientIp = log.clientIp || existing.clientIp
          existing.hostname = log.hostname || existing.hostname
        }
      }
    } else {
      devicesMap.set(key, {
        id: key,
        deviceType: log.deviceType,
        os: log.os,
        browser: log.browser,
        screenResolution: 'N/A',
        hostname: log.hostname || 'localhost',
        clientIp: log.clientIp || '127.0.0.1',
        lastUser: log.userName,
        lastUserId: log.userId,
        lastSeen: log.timestamp,
        isCurrentDevice: false,
        totalEvents: 1,
      })
    }
  })

  return Array.from(devicesMap.values())
}

/**
 * Ensures the active login session is audited at least once per browser session
 */
export async function ensureSessionAudited(): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId()
    const flagKey = `meridian_audited_session_${sessionId}`
    if (!sessionStorage.getItem(flagKey)) {
      sessionStorage.setItem(flagKey, 'true')
      await logAuditEvent(
        'LOGIN',
        {
          sessionType: 'Active Workspace Session',
          loginTime: new Date().toISOString(),
          status: 'Authenticated',
        },
        sessionId,
        'Session'
      )
    }
  } catch {}
}

const STORAGE_KEY_SESSION = 'meridian_session_id'
const STORAGE_KEY_USER = 'meridian_user_profile'
const STORAGE_KEY_AUDIT_LOGS = 'meridian_local_audit_logs'

/**
 * Automatically detects device type: Desktop, Laptop, Tablet, or Mobile
 */
export function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent.toLowerCase()

  // 1. Tablet check
  const isTablet =
    /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|silk|playbook)/i.test(
      ua
    ) ||
    (navigator.maxTouchPoints > 1 &&
      /macintosh/i.test(ua) &&
      window.innerWidth >= 768 &&
      window.innerWidth <= 1366)

  if (isTablet) return 'Tablet'

  // 2. Mobile smartphone check
  const isMobile =
    /(iphone|ipod|mobile|android.*mobile|blackberry|opera mini|windows phone|iemobile)/i.test(
      ua
    ) ||
    (window.innerWidth <= 640 && navigator.maxTouchPoints > 0)

  if (isMobile) return 'Mobile'

  // 3. Laptop check (MacBooks, ThinkPads, Chromebooks, or battery / screen hints)
  const isLaptop =
    /(macbook|chromebook|cros|thinkpad|laptop|latitude|surface)/i.test(ua) ||
    (window.innerWidth <= 1536 &&
      window.screen &&
      (window.screen.availHeight <= 950 || window.devicePixelRatio > 1))

  if (isLaptop) return 'Laptop'

  return 'Desktop'
}

/**
 * Detects Operating System
 */
export function detectOperatingSystem(): string {
  const ua = navigator.userAgent.toLowerCase()

  if (ua.includes('windows nt 10.0')) return 'Windows 10/11'
  if (ua.includes('windows nt 6.3')) return 'Windows 8.1'
  if (ua.includes('windows nt 6.1')) return 'Windows 7'
  if (ua.includes('windows')) return 'Windows'

  if (ua.includes('iphone os')) {
    const match = ua.match(/os (\d+[_.]\d+)/)
    return `iOS ${match ? match[1].replace('_', '.') : ''}`.trim()
  }
  if (ua.includes('ipad')) return 'iPadOS'
  if (ua.includes('mac os x') || ua.includes('macintosh')) {
    const match = ua.match(/mac os x (\d+[_.]\d+)/)
    return `macOS ${match ? match[1].replace('_', '.') : ''}`.trim()
  }
  if (ua.includes('android')) {
    const match = ua.match(/android (\d+([._]\d+)?)/)
    return `Android ${match ? match[1] : ''}`.trim()
  }
  if (ua.includes('cros')) return 'ChromeOS'
  if (ua.includes('ubuntu')) return 'Ubuntu Linux'
  if (ua.includes('linux')) return 'Linux'

  return 'Standard OS'
}

/**
 * Detects Browser Name and Major Version
 */
export function detectBrowser(): string {
  const ua = navigator.userAgent

  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/)
    return `Microsoft Edge ${match ? match[1] : ''}`.trim()
  }
  if (ua.includes('OPR/') || ua.includes('Opera')) {
    const match = ua.match(/(?:OPR|Opera)\/(\d+)/)
    return `Opera ${match ? match[1] : ''}`.trim()
  }
  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/(\d+)/)
    return `Chrome ${match ? match[1] : ''}`.trim()
  }
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/)
    return `Firefox ${match ? match[1] : ''}`.trim()
  }
  if (ua.includes('Safari/') && ua.includes('Version/')) {
    const match = ua.match(/Version\/(\d+)/)
    return `Safari ${match ? match[1] : ''}`.trim()
  }

  return 'Web Browser'
}

/**
 * Captures comprehensive client device telemetry
 */
export function getClientDeviceInfo(): ClientDeviceInfo {
  return {
    deviceType: detectDeviceType(),
    os: detectOperatingSystem(),
    browser: detectBrowser(),
    screenResolution: `${window.screen?.width || window.innerWidth}x${
      window.screen?.height || window.innerHeight
    }`,
    language: navigator.language || 'en-US',
    hostname: window.location.hostname || 'localhost',
  }
}

/**
 * Manages active user profile
 */
export function getCurrentUserProfile(): UserProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USER)
    if (saved) return JSON.parse(saved)
  } catch {}
  return {
    userId: 'USR-ADMIN',
    userName: 'Uttam Singh',
    role: 'Administrator',
  }
}

export function setCurrentUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile))
  } catch {}
}

/**
 * Manages active session ID and login timestamps
 */
export function getOrCreateSessionId(): string {
  try {
    let sess = localStorage.getItem(STORAGE_KEY_SESSION)
    if (!sess) {
      sess = `SES-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      localStorage.setItem(STORAGE_KEY_SESSION, sess)
    }
    return sess
  } catch {
    return `SES-${Date.now()}`
  }
}

/**
 * Central Audit Event Logger:
 * Sends the event with full device and user telemetry to the Django backend
 * and keeps a local cache for instant compliance viewing.
 */
export async function logAuditEvent(
  action: AuditAction,
  details: Record<string, any> = {},
  entityId: string = '',
  entityType: string = 'Asset'
): Promise<AuditRecord> {
  const device = getClientDeviceInfo()
  const user = getCurrentUserProfile()
  const sessionId = getOrCreateSessionId()
  const nowIso = new Date().toISOString()

  const auditData: AuditRecord = {
    userId: user.userId,
    userName: user.userName,
    role: user.role,
    sessionId,
    action,
    entityType,
    entityId: entityId || details.assetCode || details.tag || details.name || '',
    details,
    timestamp: nowIso,
    deviceType: device.deviceType,
    os: device.os,
    browser: device.browser,
    hostname: device.hostname,
    clientIp: '127.0.0.1',
  }

  // 1. Send to Backend Immutable Audit Log API (with direct localhost fallback)
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Type': device.deviceType,
      'X-Session-ID': sessionId,
      'X-User-ID': user.userId,
      'X-User-Name': user.userName,
      'X-User-Role': user.role,
      'X-Client-Hostname': device.hostname,
    }

    let res: Response | null = null
    try {
      res = await fetch('/api/audit/log/', {
        method: 'POST',
        headers,
        body: JSON.stringify(auditData),
      })
    } catch {
      // Direct localhost port 8000 fallback
      res = await fetch('http://127.0.0.1:8000/api/audit/log/', {
        method: 'POST',
        headers,
        body: JSON.stringify(auditData),
      })
    }

    if (res && res.ok) {
      const data = await res.json()
      if (data.auditLog) {
        Object.assign(auditData, data.auditLog)
      }
    }
  } catch (err) {
    // Graceful fallback for offline execution
  }

  // 2. Persist in local storage for instant compliance inspection
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS)
    const existing: AuditRecord[] = existingStr ? JSON.parse(existingStr) : []
    const updated = [auditData, ...existing.slice(0, 499)] // Keep latest 500
    localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(updated))
  } catch (err) {
    console.warn('Local audit cache quota reached:', err)
  }

  // 3. Broadcast event so any open view reloads immediately
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('meridian_audit_logged', { detail: auditData }))
    }
  } catch {}

  return auditData
}

/**
 * Fetch audit logs from backend (with fallback and merge with local storage)
 */
export async function fetchAuditLogs(filters: {
  action?: string
  deviceType?: string
  search?: string
} = {}): Promise<{ auditLogs: AuditRecord[]; totalCount: number }> {
  let backendLogs: AuditRecord[] = []

  try {
    const params = new URLSearchParams()
    if (filters.action) params.append('action', filters.action)
    if (filters.deviceType) params.append('device_type', filters.deviceType)
    if (filters.search) params.append('search', filters.search)

    let res: Response | null = null
    try {
      res = await fetch(`/api/audit/logs/?${params.toString()}`)
    } catch {
      res = await fetch(`http://127.0.0.1:8000/api/audit/logs/?${params.toString()}`)
    }

    if (res && res.ok) {
      const data = await res.json()
      if (Array.isArray(data.auditLogs)) {
        backendLogs = data.auditLogs
      }
    }
  } catch {}

  // Merge with local storage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS)
    let localLogs: AuditRecord[] = raw ? JSON.parse(raw) : []

    if (filters.action) {
      localLogs = localLogs.filter((l) => l.action.toLowerCase() === filters.action?.toLowerCase())
    }
    if (filters.deviceType) {
      localLogs = localLogs.filter((l) => l.deviceType === filters.deviceType)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      localLogs = localLogs.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.userId.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q)
      )
    }

    // Merge backend and local logs uniquely by timestamp + action + entityId
    const seen = new Set<string>()
    const merged: AuditRecord[] = []

    for (const item of [...localLogs, ...backendLogs]) {
      const key = `${item.timestamp}::${item.action}::${item.entityId}::${item.sessionId}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(item)
      }
    }

    // Sort descending by timestamp
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return { auditLogs: merged, totalCount: merged.length }
  } catch {
    return { auditLogs: backendLogs, totalCount: backendLogs.length }
  }
}
