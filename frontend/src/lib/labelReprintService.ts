/**
 * Label Print & Re-print Governance Service
 * Enforces enterprise physical tag integrity rule:
 * 1. Initial label print is allowed once when asset data is fully filled.
 * 2. Duplicate printing (second print / re-print) is strictly blocked for normal users.
 * 3. Normal users must submit a Re-print Authorization Request with a valid business reason.
 * 4. Super User reviews and approves or rejects the request.
 * 5. Once approved by Super User, the normal user receives a single-use authorization to print.
 */

import { logAuditEvent, type UserProfile } from './deviceTracker'
import type { Asset } from '@/types/asset'

export const STORAGE_KEY_PRINT_RECORDS = 'meridian_label_print_records'
export const STORAGE_KEY_REPRINT_REQUESTS = 'meridian_reprint_requests'

export type ReprintReason =
  | 'Label Damaged / Scratched'
  | 'Label Faded / Unreadable Barcode/QR'
  | 'Label Peeled Off / Lost'
  | 'Asset Relocated / Retagging'
  | 'Maintenance / Parts Replacement'
  | 'Defective Sticker / Re-application'
  | 'Other Justification'

export const REPRINT_REASONS: ReprintReason[] = [
  'Label Damaged / Scratched',
  'Label Faded / Unreadable Barcode/QR',
  'Label Peeled Off / Lost',
  'Asset Relocated / Retagging',
  'Maintenance / Parts Replacement',
  'Defective Sticker / Re-application',
  'Other Justification',
]

export type PrintStatusBadge = 'Not Printed' | 'Printed' | 'Reprint Pending' | 'Approved' | 'Rejected'

export interface AssetPrintRecord {
  assetId: string
  assetCode: string
  printCount: number
  firstPrintedAt?: string
  lastPrintedAt?: string
  lastPrintedBy?: string
  lastPrintedUserId?: string
}

export interface ReprintRequest {
  id: string
  assetId: string
  assetCode: string
  assetName: string
  requestedBy: string
  requesterUserId: string
  requesterDept?: string
  reason: ReprintReason | string
  notes?: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
  reviewedBy?: string
  reviewerUserId?: string
  reviewedAt?: string
  reviewNotes?: string
  isUsed?: boolean
  usedAt?: string
  usedBy?: string
}

export interface PrintEligibility {
  canPrint: boolean
  isFirstPrint: boolean
  isReprintApproved: boolean
  isReprintPending: boolean
  isReprintBlocked: boolean
  isSuperUser: boolean
  isHOD: boolean
  printCount: number
  status:
    | 'ready_first_print'
    | 'reprint_approved'
    | 'reprint_pending'
    | 'already_printed_blocked'
    | 'data_incomplete'
    | 'superuser_override'
  title: string
  message: string
  pendingRequest?: ReprintRequest
  approvedRequest?: ReprintRequest
  printRecord?: AssetPrintRecord
}

/** Check if user possesses Super User or Administrator clearance */
export function isSuperUserRole(user?: UserProfile | null): boolean {
  if (!user) return false
  return Boolean(
    user.isSuperuser ||
    user.role === 'Admin' ||
    user.role === 'Administrator' ||
    user.role === 'Samfu Boss' ||
    user.role === 'Super User' ||
    user.userId?.toUpperCase() === 'USR-ADMIN'
  )
}

/** Check if user is an HOD (Department Head) or Plant Manager */
export function isHODRole(user?: UserProfile | null): boolean {
  if (!user) return false
  const roleLower = (user.role || '').toLowerCase()
  return (
    roleLower.includes('hod') ||
    roleLower.includes('head') ||
    roleLower.includes('manager') ||
    roleLower === 'plant manager' ||
    Boolean((user as any).isHOD)
  )
}

/** Check if user is either HOD or Super User (both have approval authority) */
export function isHODOrSuperUser(user?: UserProfile | null): boolean {
  return isSuperUserRole(user) || isHODRole(user)
}

/** Retrieve all asset print count records from storage */
export function getPrintRecords(): Record<string, AssetPrintRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRINT_RECORDS)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse print records from localStorage', err)
  }
  return {}
}

/** Retrieve print record for a specific asset */
export function getAssetPrintRecord(assetId: string, assetCode?: string): AssetPrintRecord | null {
  const records = getPrintRecords()
  return records[assetId] || (assetCode ? records[assetCode] : null) || null
}

/** Retrieve all reprint requests from storage */
export function getReprintRequests(): ReprintRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPRINT_REQUESTS)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse reprint requests from localStorage', err)
  }
  return []
}

/** Save reprint requests to storage and dispatch update notification */
function saveReprintRequests(requests: ReprintRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REPRINT_REQUESTS, JSON.stringify(requests))
    window.dispatchEvent(new CustomEvent('meridian_reprint_updated', { detail: { requests } }))
  } catch (err) {
    console.error('Failed to save reprint requests to localStorage', err)
  }
}

/** Save print records to storage and dispatch update notification */
function savePrintRecords(records: Record<string, AssetPrintRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY_PRINT_RECORDS, JSON.stringify(records))
    window.dispatchEvent(new CustomEvent('meridian_reprint_updated', { detail: { records } }))
  } catch (err) {
    console.error('Failed to save print records to localStorage', err)
  }
}

/** Retrieve pending reprint request for an asset if one exists */
export function getPendingReprintRequest(assetId: string, assetCode?: string): ReprintRequest | null {
  const all = getReprintRequests()
  return all.find((r) => (r.assetId === assetId || (assetCode && r.assetCode === assetCode)) && r.status === 'pending') || null
}

/** Retrieve active approved reprint request for an asset that has not yet been consumed */
export function getActiveApprovedReprint(assetId: string, assetCode?: string): ReprintRequest | null {
  const all = getReprintRequests()
  return all.find((r) => (r.assetId === assetId || (assetCode && r.assetCode === assetCode)) && r.status === 'approved' && !r.isUsed) || null
}

/**
 * Record a label print execution.
 * Increments print count, records timestamp & actor, and consumes any active approved reprint request.
 */
export function recordAssetPrint(
  assetId: string,
  assetCode: string,
  user?: UserProfile
): AssetPrintRecord {
  const records = getPrintRecords()
  const existing = records[assetId] || (assetCode ? records[assetCode] : null)
  const now = new Date().toISOString()
  const userName = user?.userName || 'User'
  const userId = user?.userId || 'USR-UNKNOWN'

  const printCount = (existing?.printCount || 0) + 1
  const updated: AssetPrintRecord = {
    assetId,
    assetCode,
    printCount,
    firstPrintedAt: existing?.firstPrintedAt || now,
    lastPrintedAt: now,
    lastPrintedBy: userName,
    lastPrintedUserId: userId,
  }

  records[assetId] = updated
  if (assetCode && assetCode !== assetId) {
    records[assetCode] = updated
  }
  savePrintRecords(records)

  // Consume any active approved reprint permit
  const requests = getReprintRequests()
  let requestConsumed = false
  const updatedRequests = requests.map((req) => {
    if (
      (req.assetId === assetId || req.assetCode === assetCode) &&
      req.status === 'approved' &&
      !req.isUsed
    ) {
      requestConsumed = true
      return {
        ...req,
        isUsed: true,
        usedAt: now,
        usedBy: userName,
      }
    }
    return req
  })

  if (requestConsumed) {
    saveReprintRequests(updatedRequests)
  }

  // Asynchronous background call to backend REST enforcement endpoint
  try {
    fetch('/api/labels/record-print/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_id: assetId,
        asset_code: assetCode,
        user_id: userId,
        user_name: userName,
        role: user?.role || 'Employee',
        department: user?.department || 'Operations',
      }),
    }).catch(() => {})
  } catch {}

  // Record audit trail event
  logAuditEvent(
    'LABEL_PRINT',
    {
      assetId,
      assetCode,
      printCount,
      wasReprint: printCount > 1,
      reprintRequestConsumed: requestConsumed,
      actorName: userName,
      actorId: userId,
    },
    assetCode
  )

  return updated
}

/**
 * Normal user submits a request to the HOD / Super User to re-print an asset label.
 * A mandatory reason is strictly enforced.
 */
export function createReprintRequest(params: {
  assetId: string
  assetCode: string
  assetName: string
  requester: UserProfile
  reason: ReprintReason | string
  notes?: string
}): ReprintRequest {
  if (!params.reason || !params.reason.trim()) {
    throw new Error('A mandatory reason is required to submit a reprint request.')
  }

  const now = new Date().toISOString()
  const requests = getReprintRequests()

  const newRequest: ReprintRequest = {
    id: `RPT-REQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
    assetId: params.assetId,
    assetCode: params.assetCode,
    assetName: params.assetName || params.assetCode,
    requestedBy: params.requester.userName || 'Unknown User',
    requesterUserId: params.requester.userId || 'USR-UNKNOWN',
    requesterDept: params.requester.department || 'Operations',
    reason: params.reason,
    notes: params.notes?.trim() || '',
    status: 'pending',
    requestedAt: now,
    isUsed: false,
  }

  // Prepend to requests list
  saveReprintRequests([newRequest, ...requests])

  // Sync to backend endpoint asynchronously
  try {
    fetch('/api/labels/reprint-requests/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_id: params.assetId,
        asset_code: params.assetCode,
        asset_name: params.assetName,
        reason: params.reason,
        notes: params.notes,
        user_id: params.requester.userId,
        user_name: params.requester.userName,
        department: params.requester.department,
      }),
    }).catch(() => {})
  } catch {}

  // Log audit event
  logAuditEvent(
    'LABEL_REPRINT_REQUEST',
    {
      requestId: newRequest.id,
      assetId: params.assetId,
      assetCode: params.assetCode,
      reason: params.reason,
      notes: params.notes,
      requestedBy: newRequest.requestedBy,
      requesterUserId: newRequest.requesterUserId,
    },
    params.assetCode
  )

  return newRequest
}

/**
 * HOD or Super User approves a pending reprint request, granting 1-time reprint authorization.
 */
export function approveReprintRequest(
  requestId: string,
  reviewer: UserProfile,
  reviewNotes?: string
): ReprintRequest | null {
  const requests = getReprintRequests()
  const now = new Date().toISOString()
  let target: ReprintRequest | null = null

  const updatedRequests = requests.map((req) => {
    if (req.id === requestId) {
      target = {
        ...req,
        status: 'approved',
        reviewedBy: reviewer.userName || (isSuperUserRole(reviewer) ? 'Super User' : 'HOD'),
        reviewerUserId: reviewer.userId || 'USR-HOD',
        reviewedAt: now,
        reviewNotes: reviewNotes?.trim() || 'Approved by HOD. 1-time reprint unlocked.',
        isUsed: false,
      }
      return target
    }
    return req
  })

  if (!target) return null

  saveReprintRequests(updatedRequests)

  // Sync to backend REST action endpoint
  try {
    fetch(`/api/labels/reprint-requests/${requestId}/action/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        user_id: reviewer.userId,
        user_name: reviewer.userName,
        role: reviewer.role || 'HOD',
        notes: reviewNotes,
      }),
    }).catch(() => {})
  } catch {}

  // Log audit event
  logAuditEvent(
    'LABEL_REPRINT_APPROVE',
    {
      requestId,
      assetId: (target as ReprintRequest).assetId,
      assetCode: (target as ReprintRequest).assetCode,
      reviewedBy: reviewer.userName,
      reviewerUserId: reviewer.userId,
      reviewNotes,
    },
    (target as ReprintRequest).assetCode
  )

  return target
}

/**
 * HOD or Super User rejects a pending reprint request.
 */
export function rejectReprintRequest(
  requestId: string,
  reviewer: UserProfile,
  reviewNotes?: string
): ReprintRequest | null {
  const requests = getReprintRequests()
  const now = new Date().toISOString()
  let target: ReprintRequest | null = null

  const updatedRequests = requests.map((req) => {
    if (req.id === requestId) {
      target = {
        ...req,
        status: 'rejected',
        reviewedBy: reviewer.userName || (isSuperUserRole(reviewer) ? 'Super User' : 'HOD'),
        reviewerUserId: reviewer.userId || 'USR-HOD',
        reviewedAt: now,
        reviewNotes: reviewNotes?.trim() || 'Rejected by HOD',
      }
      return target
    }
    return req
  })

  if (!target) return null

  saveReprintRequests(updatedRequests)

  // Sync to backend REST action endpoint
  try {
    fetch(`/api/labels/reprint-requests/${requestId}/action/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject',
        user_id: reviewer.userId,
        user_name: reviewer.userName,
        role: reviewer.role || 'HOD',
        notes: reviewNotes,
      }),
    }).catch(() => {})
  } catch {}

  // Log audit event
  logAuditEvent(
    'LABEL_REPRINT_REJECT',
    {
      requestId,
      assetId: (target as ReprintRequest).assetId,
      assetCode: (target as ReprintRequest).assetCode,
      reviewedBy: reviewer.userName,
      reviewerUserId: reviewer.userId,
      reviewNotes,
    },
    (target as ReprintRequest).assetCode
  )

  return target
}

/**
 * Evaluate whether an asset is currently eligible for printing under the Single-Print & Re-print Approval rule.
 */
export function checkPrintEligibility(
  asset: Asset,
  user?: UserProfile | null,
  isDataComplete: boolean = true
): PrintEligibility {
  const isSuperUser = isSuperUserRole(user)
  const isHOD = isHODRole(user)
  const isGovernanceAuthorized = isSuperUser || isHOD

  // 1. Incomplete asset data is an absolute blocker for all roles
  if (!isDataComplete) {
    return {
      canPrint: false,
      isFirstPrint: false,
      isReprintApproved: false,
      isReprintPending: false,
      isReprintBlocked: false,
      isSuperUser,
      isHOD,
      printCount: 0,
      status: 'data_incomplete',
      title: 'QR Print Locked: Complete Data First',
      message: 'Rule: QR printing is strictly prohibited until all required asset fields are filled.',
    }
  }

  // 2. Fetch print record
  const printRecord = getAssetPrintRecord(asset.id, asset.assetCode)
  const printCount = printRecord?.printCount ?? asset.printCount ?? 0

  // 3. First-time print: Never printed before
  if (printCount === 0) {
    return {
      canPrint: true,
      isFirstPrint: true,
      isReprintApproved: false,
      isReprintPending: false,
      isReprintBlocked: false,
      isSuperUser,
      isHOD,
      printCount: 0,
      status: 'ready_first_print',
      title: `Print Label (${asset.assetCode})`,
      message: 'First print authorized. Single-print rule will take effect once printed.',
      printRecord: printRecord || undefined,
    }
  }

  // 4. Asset has been printed at least once: check for active approved reprint permit
  const approvedRequest = getActiveApprovedReprint(asset.id, asset.assetCode)
  if (approvedRequest) {
    return {
      canPrint: true,
      isFirstPrint: false,
      isReprintApproved: true,
      isReprintPending: false,
      isReprintBlocked: false,
      isSuperUser,
      isHOD,
      printCount,
      status: 'reprint_approved',
      title: `Print Approved Re-print (${asset.assetCode})`,
      message: `Re-print approved by HOD (${approvedRequest.reviewedBy || 'HOD'}). Single-use permit valid.`,
      approvedRequest,
      printRecord: printRecord || undefined,
    }
  }

  // 5. Check if there is an active pending reprint request
  const pendingRequest = getPendingReprintRequest(asset.id, asset.assetCode)
  if (pendingRequest) {
    if (isGovernanceAuthorized) {
      return {
        canPrint: true,
        isFirstPrint: false,
        isReprintApproved: false,
        isReprintPending: true,
        isReprintBlocked: false,
        isSuperUser,
        isHOD,
        printCount,
        status: 'superuser_override',
        title: `Authorize & Print Re-print (${asset.assetCode})`,
        message: `Pending request from ${pendingRequest.requestedBy}. HOD / Super User clearance allows immediate review or printing.`,
        pendingRequest,
        printRecord: printRecord || undefined,
      }
    }

    return {
      canPrint: false,
      isFirstPrint: false,
      isReprintApproved: false,
      isReprintPending: true,
      isReprintBlocked: true,
      isSuperUser: false,
      isHOD: false,
      printCount,
      status: 'reprint_pending',
      title: 'Re-print Request Pending HOD Approval',
      message: `Re-print request submitted by ${pendingRequest.requestedBy} on ${new Date(pendingRequest.requestedAt).toLocaleDateString()}. Awaiting HOD approval.`,
      pendingRequest,
      printRecord: printRecord || undefined,
    }
  }

  // 6. No reprint permit and no pending request: Duplicate print blocked for normal users
  if (isSuperUser) {
    return {
      canPrint: true,
      isFirstPrint: false,
      isReprintApproved: false,
      isReprintPending: false,
      isReprintBlocked: false,
      isSuperUser: true,
      isHOD,
      printCount,
      status: 'superuser_override',
      title: `👑 Super User Override: Print (${asset.assetCode})`,
      message: `Asset printed previously (${printCount}x). Super User clearance grants direct reprint authority.`,
      printRecord: printRecord || undefined,
    }
  }

  return {
    canPrint: false,
    isFirstPrint: false,
    isReprintApproved: false,
    isReprintPending: false,
    isReprintBlocked: true,
    isSuperUser: false,
    isHOD,
    printCount,
    status: 'already_printed_blocked',
    title: `🔒 Re-print Locked (${asset.assetCode})`,
    message: `Rule: Single-print policy enforced. This label was already printed (${printCount} time${printCount > 1 ? 's' : ''}). Re-printing requires HOD approval.`,
    printRecord: printRecord || undefined,
  }
}

/** Retrieve the most recent reprint request for an asset */
export function getLatestReprintRequest(assetId: string, assetCode?: string): ReprintRequest | null {
  const all = getReprintRequests()
  return all.find((r) => r.assetId === assetId || (assetCode && r.assetCode === assetCode)) || null
}

/**
 * Returns current QR print governance badge status:
 * 'Not Printed' | 'Printed' | 'Reprint Pending' | 'Approved' | 'Rejected'
 */
export function getAssetPrintStatus(
  asset: Asset,
  record?: AssetPrintRecord | null,
  activeRequest?: ReprintRequest | null
): PrintStatusBadge {
  const req = activeRequest !== undefined ? activeRequest : getLatestReprintRequest(asset.id, asset.assetCode)
  if (req) {
    if (req.status === 'pending') return 'Reprint Pending'
    if (req.status === 'approved' && !req.isUsed) return 'Approved'
    if (req.status === 'rejected') return 'Rejected'
  }

  const printRecord = record !== undefined ? record : getAssetPrintRecord(asset.id, asset.assetCode)
  const printCount = printRecord?.printCount ?? asset.printCount ?? 0

  if (printCount === 0) {
    return 'Not Printed'
  }

  return 'Printed'
}

/**
 * Visual styling props for the 5 QR print status badges
 */
export function getPrintStatusBadgeProps(status: PrintStatusBadge) {
  switch (status) {
    case 'Not Printed':
      return {
        label: 'Not Printed',
        colorClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: '⚪',
        dotClass: 'bg-slate-400',
      }
    case 'Printed':
      return {
        label: 'Printed',
        colorClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        icon: '🔒',
        dotClass: 'bg-blue-500',
      }
    case 'Reprint Pending':
      return {
        label: 'Reprint Pending',
        colorClass: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        icon: '⏳',
        dotClass: 'bg-amber-500 animate-pulse',
      }
    case 'Approved':
      return {
        label: 'Approved',
        colorClass: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
        icon: '🔓',
        dotClass: 'bg-purple-500 animate-pulse',
      }
    case 'Rejected':
      return {
        label: 'Rejected',
        colorClass: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        icon: '✕',
        dotClass: 'bg-rose-500',
      }
  }
}

