/**
 * Enterprise Password Reset Governance Service
 * Enforces industrial security policy:
 * 1. Employees cannot self-reset passwords via random tokens or email links.
 * 2. When clicking "Forgot password?", an employee submits a formal Password Reset Request.
 * 3. Super User receives real-time notification with requester's Name, User ID, Plant, and Department.
 * 4. Super User generates/assigns a new password directly in the Approval Center.
 * 5. The new password is saved to backend AppUser and local RBAC cache for immediate login access.
 */

import { logAuditEvent, type UserProfile } from './deviceTracker'
import { masterMappingService } from './masterMappingService'

export const STORAGE_KEY_PASSWORD_RESETS = 'meridian_password_reset_requests'

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('null')) {
    return `${window.location.origin}${path}`
  }
  return `http://localhost:8000${path}`
}

export interface PasswordResetRequest {
  id: string
  requestId: string
  userId: string
  userName: string
  department?: string
  plant?: string
  status: 'pending' | 'completed' | 'rejected'
  requestedAt: string
  resolvedAt?: string | null
  resolvedBy?: string | null
  resolverUserId?: string | null
  newPasswordSet?: boolean
  notes?: string
}

export function getPasswordResetRequests(): PasswordResetRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PASSWORD_RESETS)
    if (!raw) return []
    return JSON.parse(raw) as PasswordResetRequest[]
  } catch {
    return []
  }
}

export function savePasswordResetRequests(requests: PasswordResetRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PASSWORD_RESETS, JSON.stringify(requests))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('meridian_password_reset_updated', { detail: requests }))
    }
  } catch {}
}

export async function syncBackendPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  try {
    const res = await fetch(getApiUrl('/api/auth/password-reset-requests/'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      return getPasswordResetRequests()
    }
    const data = await res.json()
    if (Array.isArray(data.requests)) {
      const backendRequests = data.requests as PasswordResetRequest[]
      const local = getPasswordResetRequests()

      const mergedMap = new Map<string, PasswordResetRequest>()
      for (const r of local) mergedMap.set(r.id, r)
      for (const r of backendRequests) mergedMap.set(r.id, r)

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      )
      savePasswordResetRequests(merged)
      return merged
    }
  } catch {}
  return getPasswordResetRequests()
}

export async function submitPasswordResetRequest(params: {
  userId: string
  userName?: string
  department?: string
  plant?: string
  reason?: string
}): Promise<{ success: boolean; message: string; request?: PasswordResetRequest }> {
  const cleanId = (params.userId || '').trim()
  if (!cleanId) {
    return { success: false, message: 'User ID / Employee ID is required.' }
  }

  if (['USR-ADMIN', 'SUPERUSER', 'ADMIN'].includes(cleanId.toUpperCase())) {
    return {
      success: false,
      message: 'Super User accounts have master governance authority and cannot request self-reset from worker terminals.',
    }
  }

  // Check local RBAC user to pre-fill name / dept if not given
  let resolvedName = params.userName || ''
  let resolvedDept = params.department || ''
  if (!resolvedName || !resolvedDept) {
    try {
      const rbacUsers = masterMappingService.getRBACUsers()
      const found = rbacUsers.find((u) => (u.employeeId || '').toUpperCase() === cleanId.toUpperCase())
      if (found) {
        resolvedName = resolvedName || found.employeeName
        resolvedDept = resolvedDept || found.department || 'Production & SMT'
      }
    } catch {}
  }
  if (!resolvedName) resolvedName = `Employee ${cleanId}`
  if (!resolvedDept) resolvedDept = 'Production & SMT'

  const plant = params.plant || 'Noida Plant (SMT Line & Assembly)'
  const reason = params.reason || 'Forgot password'

  // Attempt backend API submission
  try {
    const res = await fetch(getApiUrl('/api/auth/password-reset-request/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: cleanId,
        userName: resolvedName,
        department: resolvedDept,
        plant,
        notes: reason,
      }),
    })

    const data = await res.json()
    if (res.ok && data.success && data.request) {
      const req: PasswordResetRequest = data.request
      const current = getPasswordResetRequests().filter((r) => r.id !== req.id)
      savePasswordResetRequests([req, ...current])
      return { success: true, message: data.message, request: req }
    } else if (!res.ok && data.error) {
      return { success: false, message: data.error }
    }
  } catch {}

  // Fallback to local storage persistence
  const current = getPasswordResetRequests()
  const existing = current.find((r) => r.userId.toUpperCase() === cleanId.toUpperCase() && r.status === 'pending')
  if (existing) {
    return {
      success: true,
      message: `A password reset request for ${existing.userName} (${existing.userId}) is already pending Super User action.`,
      request: existing,
    }
  }

  const reqId = `PRR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  const newReq: PasswordResetRequest = {
    id: reqId,
    requestId: reqId,
    userId: cleanId,
    userName: resolvedName,
    department: resolvedDept,
    plant,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    notes: reason,
  }

  savePasswordResetRequests([newReq, ...current])

  void logAuditEvent(
    'PASSWORD_RESET_REQUEST',
    {
      requestId: reqId,
      name: resolvedName,
      plant,
      department: resolvedDept,
    },
    cleanId,
    'User'
  )

  return {
    success: true,
    message: `Password reset request submitted successfully for ${resolvedName} (${cleanId}). Super User has been notified.`,
    request: newReq,
  }
}

export async function resolvePasswordResetRequest(
  requestId: string,
  newPassword: string,
  reviewer: UserProfile,
  notes?: string
): Promise<{ success: boolean; message: string; request?: PasswordResetRequest }> {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, message: 'New password must be at least 4 characters long.' }
  }

  let backendReq: PasswordResetRequest | undefined

  try {
    const res = await fetch(getApiUrl(`/api/auth/password-reset-resolve/${requestId}/`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_password',
        newPassword,
        userId: reviewer.userId,
        userName: reviewer.userName,
        role: reviewer.role,
        notes: notes || `New password set by Super User ${reviewer.userName}`,
      }),
    })
    const data = await res.json()
    if (res.ok && data.success && data.request) {
      backendReq = data.request
    }
  } catch {}

  // Update local requests list
  const current = getPasswordResetRequests()
  const target = current.find((r) => r.id === requestId)
  const targetUserId = backendReq?.userId || target?.userId

  if (target) {
    target.status = 'completed'
    target.resolvedAt = new Date().toISOString()
    target.resolvedBy = reviewer.userName
    target.resolverUserId = reviewer.userId
    target.newPasswordSet = true
    target.notes = notes || `New password set by Super User ${reviewer.userName}`
    savePasswordResetRequests([...current])
  } else if (backendReq) {
    savePasswordResetRequests([backendReq, ...current])
  }

  // Update local RBAC user password so offline login also succeeds immediately
  if (targetUserId) {
    try {
      const rbacUsers = masterMappingService.getRBACUsers()
      const userIndex = rbacUsers.findIndex(
        (u) => (u.employeeId || '').toUpperCase() === targetUserId.toUpperCase()
      )
      if (userIndex !== -1) {
        rbacUsers[userIndex].password = newPassword
        rbacUsers[userIndex].status = 'Active'
        rbacUsers[userIndex].failedLoginAttempts = 0
        masterMappingService.saveRBACUsers(rbacUsers)
      }
    } catch {}

    // Also clear any lockout key for this user
    try {
      localStorage.removeItem(`meridian_lockout_${targetUserId}`)
    } catch {}
  }

  const requesterName = backendReq?.userName || target?.userName || targetUserId || 'User'

  void logAuditEvent(
    'PASSWORD_RESET_COMPLETE',
    {
      requestId,
      requesterName,
      targetUserId,
      resolver: reviewer.userName,
    },
    targetUserId || requestId,
    'User'
  )

  return {
    success: true,
    message: `New password set successfully for ${requesterName} (${targetUserId}).`,
    request: backendReq || target,
  }
}

export async function rejectPasswordResetRequest(
  requestId: string,
  reviewer: UserProfile,
  reason?: string
): Promise<{ success: boolean; message: string; request?: PasswordResetRequest }> {
  try {
    await fetch(getApiUrl(`/api/auth/password-reset-resolve/${requestId}/`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject',
        userId: reviewer.userId,
        userName: reviewer.userName,
        role: reviewer.role,
        notes: reason || 'Rejected by Super User',
      }),
    })
  } catch {}

  const current = getPasswordResetRequests()
  const target = current.find((r) => r.id === requestId)
  if (target) {
    target.status = 'rejected'
    target.resolvedAt = new Date().toISOString()
    target.resolvedBy = reviewer.userName
    target.resolverUserId = reviewer.userId
    target.notes = reason || 'Rejected by Super User'
    savePasswordResetRequests([...current])
  }

  return {
    success: true,
    message: `Password reset request ${requestId} rejected.`,
    request: target,
  }
}
