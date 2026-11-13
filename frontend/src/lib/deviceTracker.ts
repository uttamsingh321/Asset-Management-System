/**
 * Frontend Device Detection & Audit Logger Service
 * Automatically detects whether the user is on Desktop, Laptop, Tablet, or Mobile,
 * identifies OS and Browser, and logs every audit event to the backend immutable audit log.
 */

export type DeviceType = 'Desktop' | 'Laptop' | 'Tablet' | 'Mobile'
export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'ASSET_CREATE'
  | 'ASSET_UPDATE'
  | 'ASSET_IMPORT'
  | 'ASSET_EXPORT'
  | 'ASSET_TRANSFER'
  | 'ASSET_APPROVAL'
  | 'ASSET_DELETE'

export interface UserProfile {
  userId: string
  userName: string
  role: string
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

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('null')) {
    try {
      return new URL(path, window.location.origin).toString()
    } catch {}
  }
  return path
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
    entityId: entityId || details.assetCode || details.tag || '',
    details,
    timestamp: nowIso,
    deviceType: device.deviceType,
    os: device.os,
    browser: device.browser,
    hostname: device.hostname,
    clientIp: 'Client Local',
  }

  // 1. Send to Backend Immutable Audit Log API (if reachable)
  try {
    const url = getApiUrl('/api/audit/log/')
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Type': device.deviceType,
        'X-Session-ID': sessionId,
        'X-User-ID': user.userId,
        'X-User-Name': user.userName,
        'X-User-Role': user.role,
        'X-Client-Hostname': device.hostname,
      },
      body: JSON.stringify(auditData),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.auditLog) {
        Object.assign(auditData, data.auditLog)
      }
    }
  } catch (err) {
    // Graceful fallback for unit testing and offline execution
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

  return auditData
}

/**
 * Fetch audit logs from backend (with fallback to local storage)
 */
export async function fetchAuditLogs(filters: {
  action?: string
  deviceType?: string
  search?: string
} = {}): Promise<{ auditLogs: AuditRecord[]; totalCount: number }> {
  try {
    const params = new URLSearchParams()
    if (filters.action) params.append('action', filters.action)
    if (filters.deviceType) params.append('device_type', filters.deviceType)
    if (filters.search) params.append('search', filters.search)

    const url = getApiUrl(`/api/audit/logs/?${params.toString()}`)
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      return {
        auditLogs: data.auditLogs,
        totalCount: data.totalCount,
      }
    }
  } catch {}

  // Fallback to local storage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS)
    let logs: AuditRecord[] = raw ? JSON.parse(raw) : []

    if (filters.action) {
      logs = logs.filter((l) => l.action.toLowerCase() === filters.action?.toLowerCase())
    }
    if (filters.deviceType) {
      logs = logs.filter((l) => l.deviceType === filters.deviceType)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      logs = logs.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.userId.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q)
      )
    }

    return { auditLogs: logs, totalCount: logs.length }
  } catch {
    return { auditLogs: [], totalCount: 0 }
  }
}
