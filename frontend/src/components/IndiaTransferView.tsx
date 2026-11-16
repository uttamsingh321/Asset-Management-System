import React, { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { formatDateIN, todayISO, type Language } from '@/lib/indiaLocale'
import type { Asset, TransferRequestItem, TransferType, TransferApprovalStep, TransferNotification } from '@/types/asset'
import { logAuditEvent, type UserProfile, getCurrentUserProfile } from '@/lib/deviceTracker'

interface IndiaTransferViewProps {
  assets: Asset[]
  lang: Language
  currentUser?: UserProfile
  onUpdateAsset?: (asset: Asset) => void
}

type TransferTab = 'my_requests' | 'pending_approval' | 'all_transfers' | 'new_transfer'

export const IndiaTransferView: React.FC<IndiaTransferViewProps> = ({
  assets,
  currentUser: propUser,
  onUpdateAsset,
}) => {
  const activeUser = useMemo(() => propUser || getCurrentUserProfile(), [propUser])
  const isSuperuserOrAdmin = Boolean(
    activeUser.isSuperuser ||
    activeUser.role === 'Admin' ||
    activeUser.role === 'Administrator' ||
    activeUser.role === 'Samfu Boss' ||
    activeUser.userId?.toUpperCase() === 'USR-ADMIN'
  )

  const [activeTab, setActiveTab] = useState<TransferTab>('my_requests')
  const [transfers, setTransfers] = useState<TransferRequestItem[]>(() => {
    try {
      const saved = localStorage.getItem('meridian_transfers')
      if (saved) return JSON.parse(saved)
    } catch {}

    // Initial realistic transfer data demonstrating both Small Asset (1-level) and Large Asset / Parts (3-level)
    return [
      {
        id: 'TR-2026-001',
        assetCode: '2004218',
        assetName: 'Dell Precision Workstation',
        transferType: 'Large Asset',
        fromLocation: 'C39-2F Bay 14',
        toLocation: 'D197-1F Production Line 2',
        fromPlant: 'Noida Central Plant',
        toPlant: 'Padget Unit 2',
        fromDept: 'IT',
        toDept: 'SMT Operations',
        newCustodian: 'EMP-105 · Rajesh Kumar',
        newCustodianId: 'EMP-105',
        reason: 'SMT Line expansion requires dedicated graphics workstation for AOI inspection.',
        date: '2026-11-14',
        requesterId: 'EMP-IT-01',
        requesterName: 'Rajesh IT Auditor',
        requesterDept: 'IT',
        status: 'Pending Chinese HOD',
        currentStage: 1,
        totalStages: 3,
        currentApproverRole: 'Chinese HOD',
        approvalHistory: [
          {
            stage: 0,
            role: 'Requester',
            approverId: 'EMP-IT-01',
            approverName: 'Rajesh IT Auditor',
            decision: 'Approved',
            comments: 'Transfer request initiated for line rebalancing',
            timestamp: '2026-11-14T08:30:00Z',
          },
        ],
      },
      {
        id: 'TR-2026-002',
        assetCode: 'AST-SMT-4001',
        assetName: 'Barcode Scanner Gun - Honeywell',
        transferType: 'Small Asset',
        fromLocation: 'C39 Warehouse Rack 3',
        toLocation: 'C39 SMT Line 1',
        fromPlant: 'Noida Central Plant',
        toPlant: 'Noida Central Plant',
        fromDept: 'Store',
        toDept: 'SMT Operations',
        newCustodian: 'EMP-108 · Amit Verma',
        newCustodianId: 'EMP-108',
        reason: 'Handheld scanner replacement for station 4.',
        date: '2026-11-13',
        requesterId: 'EMP-IT-01',
        requesterName: 'Rajesh IT Auditor',
        requesterDept: 'IT',
        status: 'Pending HOD',
        currentStage: 1,
        totalStages: 1,
        currentApproverRole: 'HOD',
        approvalHistory: [
          {
            stage: 0,
            role: 'Requester',
            approverId: 'EMP-IT-01',
            approverName: 'Rajesh IT Auditor',
            decision: 'Approved',
            comments: 'Request initiated',
            timestamp: '2026-11-13T10:00:00Z',
          },
        ],
      },
    ]
  })

  // Notifications Store
  const [notifications, setNotifications] = useState<TransferNotification[]>(() => {
    try {
      const saved = localStorage.getItem('meridian_transfer_notifications')
      if (saved) return JSON.parse(saved)
    } catch {}
    return [
      {
        id: 'NOTIF-01',
        transferId: 'TR-2026-001',
        recipientRole: 'Chinese HOD',
        title: 'Pending Transfer Approval: TR-2026-001',
        message: 'Large Asset Transfer (Dell Precision Workstation) is waiting for Level 1: Chinese HOD Approval.',
        timestamp: '2026-11-14T08:30:00Z',
        read: false,
      },
      {
        id: 'NOTIF-02',
        transferId: 'TR-2026-002',
        recipientRole: 'HOD',
        title: 'Pending Transfer Approval: TR-2026-002',
        message: 'Small Asset Transfer (Barcode Scanner Gun) is waiting for HOD Approval.',
        timestamp: '2026-11-13T10:00:00Z',
        read: false,
      },
    ]
  })

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('meridian_transfers', JSON.stringify(transfers))
    } catch {}
  }, [transfers])

  useEffect(() => {
    try {
      localStorage.setItem('meridian_transfer_notifications', JSON.stringify(notifications))
    } catch {}
  }, [notifications])

  // Form State for Creating Transfer
  const [assetCodeInput, setAssetCodeInput] = useState('')
  const [transferType, setTransferType] = useState<TransferType>('Small Asset')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [toPlant, setToPlant] = useState('Noida Central Plant')
  const [toDept, setToDept] = useState('SMT Operations')
  const [toLocation, setToLocation] = useState('')
  const [newCustodian, setNewCustodian] = useState('')
  const [newCustodianId, setNewCustodianId] = useState('')
  const [transferReason, setTransferReason] = useState('')

  // Modal State for Approving / Rejecting
  const [reviewTransfer, setReviewTransfer] = useState<TransferRequestItem | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'Approve' | 'Reject'>('Approve')
  const [reviewComments, setReviewComments] = useState('')
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)

  // Auto-determine Transfer Type when asset is selected
  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset)
    setAssetCodeInput(asset.assetCode)

    // System determines Transfer Type based on category or value
    const cat = (asset.currentCategory || asset.category || '').toLowerCase()
    const cost = asset.purchaseCost || 0

    if (cat.includes('part') || cat.includes('nozzle') || cat.includes('feeder') || cat.includes('spare')) {
      setTransferType('Parts')
    } else if (cost > 50000 || cat.includes('machinery') || cat.includes('server') || cat.includes('workstation')) {
      setTransferType('Large Asset')
    } else {
      setTransferType('Small Asset')
    }
  }

  // Check whether the active user is authorized to act as approver for a specific role
  const canUserApproveRole = (approverRole: string): boolean => {
    if (isSuperuserOrAdmin) return true

    const role = (activeUser.role || '').toLowerCase()
    const dept = (activeUser.department || '').toLowerCase()

    if (approverRole === 'HOD') {
      return role.includes('hod') || role.includes('plant manager') || role.includes('department head')
    }
    if (approverRole === 'Chinese HOD') {
      return role.includes('chinese hod')
    }
    if (approverRole === 'Finance') {
      return dept === 'finance' || role.includes('finance')
    }
    if (approverRole === 'Samfu Boss') {
      return role.includes('samfu') || role.includes('superuser') || Boolean(activeUser.isSuperuser)
    }
    return false
  }

  // Filter transfers for "My Requests" (submitted by active user)
  const myRequests = useMemo(() => {
    if (isSuperuserOrAdmin) return transfers
    return transfers.filter(
      t =>
        t.requesterId.toLowerCase() === activeUser.userId.toLowerCase() ||
        t.requesterName.toLowerCase() === activeUser.userName.toLowerCase()
    )
  }, [transfers, activeUser, isSuperuserOrAdmin])

  // Filter transfers for "Pending Approvals" (actionable by active user at the current sequential stage)
  const pendingApprovals = useMemo(() => {
    return transfers.filter(t => {
      if (t.status === 'Approved' || t.status === 'Rejected') return false
      return canUserApproveRole(t.currentApproverRole)
    })
  }, [transfers, activeUser, isSuperuserOrAdmin])

  // Unread notifications for active user
  const userNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (isSuperuserOrAdmin) return true
      if (n.recipientId && n.recipientId.toLowerCase() === activeUser.userId.toLowerCase()) return true
      return canUserApproveRole(n.recipientRole)
    })
  }, [notifications, activeUser, isSuperuserOrAdmin])

  // ── Action Handlers ────────────────────────────────────────────────────────

  // Step 1: Create Transfer Request
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedAsset) {
      toast.error('Please select an equipment asset to transfer.')
      return
    }
    if (!toLocation.trim()) {
      toast.error('Destination location is required.')
      return
    }
    if (!transferReason.trim()) {
      toast.error('Transfer reason is mandatory.')
      return
    }

    const transferId = `TR-${Date.now().toString().slice(-6)}`
    const nowIso = new Date().toISOString()

    // Determine initial stage & approver role
    let totalStages = 1
    let currentApproverRole: 'HOD' | 'Chinese HOD' = 'HOD'
    let initialStatus: TransferRequestItem['status'] = 'Pending HOD'

    if (transferType === 'Large Asset' || transferType === 'Parts') {
      totalStages = 3
      currentApproverRole = 'Chinese HOD'
      initialStatus = 'Pending Chinese HOD'
    }

    const newTransfer: TransferRequestItem = {
      id: transferId,
      assetCode: selectedAsset.assetCode,
      assetName: selectedAsset.currentDescription || selectedAsset.name,
      transferType,
      fromLocation: selectedAsset.currentLocation || selectedAsset.location || 'Current Bay',
      toLocation: toLocation.trim(),
      fromPlant: selectedAsset.plant || 'Noida Central Plant',
      toPlant,
      fromDept: selectedAsset.currentDepartment || selectedAsset.department || 'Operations',
      toDept,
      newCustodian: newCustodian.trim() || 'Unassigned Staff',
      newCustodianId: newCustodianId.trim(),
      reason: transferReason.trim(),
      date: todayISO(),
      requesterId: activeUser.userId,
      requesterName: activeUser.userName,
      requesterDept: activeUser.department || 'Operations',
      status: initialStatus,
      currentStage: 1,
      totalStages,
      currentApproverRole,
      approvalHistory: [
        {
          stage: 0,
          role: 'Requester',
          approverId: activeUser.userId,
          approverName: activeUser.userName,
          decision: 'Approved',
          comments: transferReason.trim(),
          timestamp: nowIso,
        },
      ],
    }

    // Try backend API with fallback
    try {
      await fetch('/api/transfers/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': activeUser.userId,
          'X-User-Name': activeUser.userName,
          'X-User-Role': activeUser.role,
        },
        body: JSON.stringify(newTransfer),
      })
    } catch {}

    // Add to transfers
    setTransfers(prev => [newTransfer, ...prev])

    // Sequential Notification: Send alert ONLY to the first approver!
    const newNotif: TransferNotification = {
      id: `NOTIF-${Date.now()}`,
      transferId,
      recipientRole: currentApproverRole,
      title: `Pending Approval: ${transferId} (${transferType})`,
      message: `New ${transferType} transfer for ${newTransfer.assetName} (${newTransfer.assetCode}) requires ${currentApproverRole} approval.`,
      timestamp: nowIso,
      read: false,
    }
    setNotifications(prev => [newNotif, ...prev])

    // Log in Immutable Audit Log
    logAuditEvent(
      'TRANSFER_CREATE',
      {
        transferId,
        assetCode: newTransfer.assetCode,
        transferType,
        totalStages,
        currentApproverRole,
        fromDept: newTransfer.fromDept,
        toDept: newTransfer.toDept,
        reason: transferReason.trim(),
      },
      transferId,
      'AssetTransfer'
    )

    toast.success(`Transfer Request ${transferId} Created!`, {
      description: `Workflow initiated for ${transferType}. Routed to ${currentApproverRole} for Level 1 approval.`,
    })

    // Reset Form & Switch to My Requests
    setSelectedAsset(null)
    setAssetCodeInput('')
    setToLocation('')
    setNewCustodian('')
    setNewCustodianId('')
    setTransferReason('')
    setActiveTab('my_requests')
  }

  // Open Sequential Review Modal
  const handleOpenReview = (transfer: TransferRequestItem, defaultDecision: 'Approve' | 'Reject' = 'Approve') => {
    setReviewTransfer(transfer)
    setReviewDecision(defaultDecision)
    setReviewComments('')
    setIsReviewModalOpen(true)
  }

  // Process Approval / Rejection Decision
  const handleSubmitReview = async () => {
    if (!reviewTransfer) return

    // Invariant 1: Security Check
    if (!canUserApproveRole(reviewTransfer.currentApproverRole)) {
      toast.error('Security Rule Violation: Unauthorized Approval Role', {
        description: `This stage requires role '${reviewTransfer.currentApproverRole}'. Your role is '${activeUser.role}'.`,
      })
      return
    }

    if (reviewDecision === 'Reject' && !reviewComments.trim()) {
      toast.error('A rejection reason is mandatory to reject a transfer request.')
      return
    }

    const nowIso = new Date().toISOString()
    const transferId = reviewTransfer.id
    const currentStage = reviewTransfer.currentStage
    const totalStages = reviewTransfer.totalStages
    const currRole = reviewTransfer.currentApproverRole

    // Try backend API
    try {
      await fetch(`/api/transfers/${transferId}/action/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': activeUser.userId,
          'X-User-Name': activeUser.userName,
          'X-User-Role': activeUser.role,
          'X-User-Department': activeUser.department || '',
          'X-Superuser': isSuperuserOrAdmin ? 'true' : 'false',
        },
        body: JSON.stringify({
          action: reviewDecision,
          comments: reviewComments.trim(),
          userId: activeUser.userId,
          userName: activeUser.userName,
          role: activeUser.role,
          department: activeUser.department,
          isSuperuser: isSuperuserOrAdmin,
        }),
      })
    } catch {}

    const approvalStep: TransferApprovalStep = {
      stage: currentStage,
      role: currRole,
      approverId: activeUser.userId,
      approverName: activeUser.userName,
      decision: reviewDecision === 'Approve' ? 'Approved' : 'Rejected',
      comments: reviewComments.trim() || `${reviewDecision}d by ${currRole}`,
      timestamp: nowIso,
    }

    let updatedTransfer: TransferRequestItem

    if (reviewDecision === 'Reject') {
      // Rejection: Workflow ends immediately
      updatedTransfer = {
        ...reviewTransfer,
        status: 'Rejected',
        rejectionReason: reviewComments.trim(),
        rejectedByRole: currRole,
        approvalHistory: [...reviewTransfer.approvalHistory, approvalStep],
      }

      // Sequential Notification: Notify requester immediately!
      const notif: TransferNotification = {
        id: `NOTIF-${Date.now()}`,
        transferId,
        recipientRole: 'Requester',
        recipientId: reviewTransfer.requesterId,
        title: `Transfer Rejected: ${transferId}`,
        message: `Your transfer request was Rejected at Stage ${currentStage} by ${currRole}. Reason: ${reviewComments.trim()}`,
        timestamp: nowIso,
        read: false,
      }
      setNotifications(prev => [notif, ...prev])

      logAuditEvent(
        'TRANSFER_REJECT',
        {
          transferId,
          stage: currentStage,
          role: currRole,
          rejectionReason: reviewComments.trim(),
        },
        transferId,
        'AssetTransfer'
      )

      toast.error(`Transfer ${transferId} Rejected`, {
        description: `Workflow terminated at Stage ${currentStage} by ${currRole}. Requester has been notified.`,
      })
    } else {
      // Approval: Check if further stages remain
      if (currentStage < totalStages) {
        const nextStage = currentStage + 1
        let nextRole: 'Finance' | 'Samfu Boss' = 'Finance'
        let nextStatus: TransferRequestItem['status'] = 'Pending Finance'

        if (nextStage === 3) {
          nextRole = 'Samfu Boss'
          nextStatus = 'Pending Samfu Boss'
        }

        updatedTransfer = {
          ...reviewTransfer,
          currentStage: nextStage,
          currentApproverRole: nextRole,
          status: nextStatus,
          approvalHistory: [...reviewTransfer.approvalHistory, approvalStep],
        }

        // Sequential Notification: Send alert ONLY to the Level 2 / Level 3 approver!
        const nextNotif: TransferNotification = {
          id: `NOTIF-${Date.now()}`,
          transferId,
          recipientRole: nextRole,
          title: `Action Required: Transfer ${transferId} (Stage ${nextStage})`,
          message: `Level ${currentStage} approved by ${currRole}. Request is now awaiting ${nextRole} approval.`,
          timestamp: nowIso,
          read: false,
        }
        setNotifications(prev => [nextNotif, ...prev])

        logAuditEvent(
          currentStage === 1 ? 'TRANSFER_APPROVE_LEVEL_1' : 'TRANSFER_APPROVE_LEVEL_2',
          {
            transferId,
            stage: currentStage,
            approvedByRole: currRole,
            nextStage,
            nextApproverRole: nextRole,
          },
          transferId,
          'AssetTransfer'
        )

        toast.success(`Stage ${currentStage} Approved by ${currRole}!`, {
          description: `Sequentially routed to Level ${nextStage} (${nextRole}).`,
        })
      } else {
        // Final Approval: All stages completed!
        updatedTransfer = {
          ...reviewTransfer,
          status: 'Approved',
          completedAt: nowIso,
          approvalHistory: [...reviewTransfer.approvalHistory, approvalStep],
        }

        // Apply physical changes to asset in registry
        let targetAssetObj = assets.find(a => a.assetCode === reviewTransfer.assetCode || a.id === reviewTransfer.assetCode)
        if (!targetAssetObj) {
          try {
            const raw = localStorage.getItem('meridian_assets')
            if (raw) {
              const allParsed: Asset[] = JSON.parse(raw)
              targetAssetObj = allParsed.find((a: any) => a.assetCode === reviewTransfer.assetCode || a.id === reviewTransfer.assetCode)
            }
          } catch {}
        }

        if (targetAssetObj) {
          const updatedAsset: Asset = {
            ...targetAssetObj,
            department: reviewTransfer.toDept,
            currentDepartment: reviewTransfer.toDept,
            location: reviewTransfer.toLocation,
            currentLocation: reviewTransfer.toLocation,
            plant: reviewTransfer.toPlant,
            assignedTo: reviewTransfer.newCustodian || targetAssetObj.assignedTo,
            submitter: reviewTransfer.newCustodian || targetAssetObj.submitter,
          }

          try {
            const raw = localStorage.getItem('meridian_assets')
            if (raw) {
              const allParsed: Asset[] = JSON.parse(raw)
              const updatedList = allParsed.map((a: any) =>
                a.assetCode === updatedAsset.assetCode || a.id === updatedAsset.id ? updatedAsset : a
              )
              localStorage.setItem('meridian_assets', JSON.stringify(updatedList))
            }
          } catch {}

          if (onUpdateAsset) {
            onUpdateAsset(updatedAsset)
          }
        }

        // Sequential Notification: Notify requester of completion!
        const completeNotif: TransferNotification = {
          id: `NOTIF-${Date.now()}`,
          transferId,
          recipientRole: 'Requester',
          recipientId: reviewTransfer.requesterId,
          title: `Transfer Completed: ${transferId}`,
          message: `Your transfer request for ${reviewTransfer.assetName} has been fully approved by all levels and completed!`,
          timestamp: nowIso,
          read: false,
        }
        setNotifications(prev => [completeNotif, ...prev])

        logAuditEvent(
          totalStages === 3 ? 'TRANSFER_APPROVE_LEVEL_3' : 'TRANSFER_APPROVE_LEVEL_1',
          {
            transferId,
            finalApproverRole: currRole,
            status: 'Approved',
          },
          transferId,
          'AssetTransfer'
        )

        logAuditEvent(
          'TRANSFER_COMPLETE',
          {
            transferId,
            assetCode: reviewTransfer.assetCode,
            fromDept: reviewTransfer.fromDept,
            toDept: reviewTransfer.toDept,
            fromLocation: reviewTransfer.fromLocation,
            toLocation: reviewTransfer.toLocation,
          },
          transferId,
          'AssetTransfer'
        )

        toast.success(`Transfer ${transferId} Fully Approved & Completed!`, {
          description: `All ${totalStages} approval stages passed. Equipment ledger updated.`,
        })
      }
    }

    // Update transfers state
    setTransfers(prev => prev.map(t => (t.id === transferId ? updatedTransfer : t)))
    setIsReviewModalOpen(false)
    setReviewTransfer(null)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[var(--line)]">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>⇄</span>
            <span>Asset Transfer Approval Workflow</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
              Sequential RBAC Engine
            </span>
          </h1>
          <p className="text-xs text-[var(--mute)] mt-1">
            Multi-tier sequential approval based on Transfer Type: Small Asset (1-level HOD) vs Large Asset / Parts (3-level: Chinese HOD → Finance → Samfu Boss).
          </p>
        </div>

        {/* User Identity Pill */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              <strong>{activeUser.userName}</strong> ({activeUser.role} · {activeUser.department || 'Operations'})
            </span>
          </div>

          {userNotifications.length > 0 && (
            <div className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold" title="Pending sequential transfer alerts">
              <span>🔔</span>
              <span>{userNotifications.length}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('new_transfer')}
            className="btn p text-xs flex items-center gap-1.5 px-4 py-2 cursor-pointer shadow-sm"
          >
            <span>+</span>
            <span>Create Transfer Request</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--line)] gap-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('my_requests')}
          className={`py-2 px-4 font-semibold border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
            activeTab === 'my_requests'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-[var(--mute)] hover:text-[var(--ink)]'
          }`}
        >
          <span>📑</span>
          <span>My Requests</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--surf2)] text-[var(--mute)]">
            {myRequests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending_approval')}
          className={`py-2 px-4 font-semibold border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
            activeTab === 'pending_approval'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-[var(--mute)] hover:text-[var(--ink)]'
          }`}
        >
          <span>⚖️</span>
          <span>Pending Approvals</span>
          {pendingApprovals.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('all_transfers')}
          className={`py-2 px-4 font-semibold border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
            activeTab === 'all_transfers'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-[var(--mute)] hover:text-[var(--ink)]'
          }`}
        >
          <span>📜</span>
          <span>All Transfers Registry</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--surf2)] text-[var(--mute)]">
            {transfers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('new_transfer')}
          className={`py-2 px-4 font-semibold border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
            activeTab === 'new_transfer'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-[var(--mute)] hover:text-[var(--ink)]'
          }`}
        >
          <span>✍️</span>
          <span>New Transfer Form</span>
        </button>
      </div>

      {/* TAB 1: My Requests Page (Full Visual Timeline & Tracking) */}
      {activeTab === 'my_requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--mute)]">
              My Submitted Transfer Requests ({myRequests.length})
            </h2>
            <span className="text-xs text-[var(--mute)]">
              Live tracking: Stage, current approver, timeline, and audit history.
            </span>
          </div>

          {myRequests.length > 0 ? (
            <div className="space-y-4">
              {myRequests.map(t => (
                <TransferTrackingCard key={t.id} transfer={t} />
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center text-xs text-[var(--mute)] space-y-3">
              <span className="text-4xl block">📑</span>
              <p>You have not submitted any transfer requests yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('new_transfer')}
                className="btn p text-xs py-2 px-4 cursor-pointer"
              >
                Create Your First Transfer Request
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Pending Approvals (Strict RBAC-gated stage actions) */}
      {activeTab === 'pending_approval' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--mute)]">
              Requests Awaiting Your RBAC Approval ({pendingApprovals.length})
            </h2>
            <span className="text-xs text-[var(--mute)]">
              Authorized for: <strong>{activeUser.role}</strong>
            </span>
          </div>

          {pendingApprovals.length > 0 ? (
            <div className="space-y-4">
              {pendingApprovals.map(t => (
                <div key={t.id} className="card p-5 border border-amber-500/30 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--surf2)] text-[var(--mute)]">
                          {t.id}
                        </span>
                        <h3 className="text-sm font-bold text-[var(--ink)]">
                          {t.assetName} ({t.assetCode})
                        </h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            t.transferType === 'Small Asset'
                              ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                          }`}
                        >
                          {t.transferType} ({t.totalStages}-Tier)
                        </span>
                      </div>

                      <div className="text-xs text-[var(--mute)] mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>👤 <strong>Requester:</strong> {t.requesterName} ({t.requesterDept})</span>
                        <span>⇄ <strong>Route:</strong> {t.fromDept} → {t.toDept}</span>
                        <span>📍 <strong>Destination:</strong> {t.toLocation}</span>
                      </div>
                      <div className="text-xs text-[var(--ink)] mt-2 bg-[var(--surf2)] p-2.5 rounded-lg border border-[var(--line)]">
                        <strong>Reason:</strong> {t.reason}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>Awaiting: {t.currentApproverRole}</span>
                      </span>
                      <span className="text-[11px] text-[var(--mute)]">
                        Stage {t.currentStage} of {t.totalStages}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[var(--mute)]">
                      Submitted on {formatDateIN(t.date)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenReview(t, 'Reject')}
                        className="btn text-xs px-3.5 py-1.5 border border-red-500/30 text-red-600 hover:bg-red-500/10 cursor-pointer rounded-lg font-semibold"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReview(t, 'Approve')}
                        className="btn p text-xs px-4 py-1.5 cursor-pointer shadow-sm font-semibold rounded-lg"
                      >
                        Review & Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center text-xs text-[var(--mute)] space-y-2">
              <span className="text-4xl block">✓</span>
              <p className="font-semibold text-[var(--ink)]">No Pending Approvals</p>
              <p>There are no transfer requests currently awaiting your role's approval.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: All Transfers Registry */}
      {activeTab === 'all_transfers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--mute)]">
              Enterprise Asset Transfers Ledger ({transfers.length})
            </h2>
          </div>

          <div className="space-y-4">
            {transfers.map(t => (
              <TransferTrackingCard key={t.id} transfer={t} />
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: New Transfer Form */}
      {activeTab === 'new_transfer' && (
        <div className="card p-6 max-w-2xl mx-auto space-y-5 border border-[var(--line)] shadow-sm">
          <div className="border-b border-[var(--line)] pb-3">
            <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <span>✍️</span>
              <span>Create New Asset Transfer Request</span>
            </h2>
            <p className="text-xs text-[var(--mute)] mt-0.5">
              The system automatically determines the approval tier based on Transfer Type.
            </p>
          </div>

          <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
            {/* Asset Selection */}
            <div>
              <label className="font-semibold text-[var(--ink)] block mb-1">
                Select Equipment Asset *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={assetCodeInput}
                  onChange={e => {
                    setAssetCodeInput(e.target.value)
                    const found = assets.find(a => a.assetCode.toLowerCase() === e.target.value.toLowerCase())
                    if (found) handleSelectAsset(found)
                  }}
                  placeholder="Enter or select asset code (e.g. 2004218)..."
                  className="flex-1 p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] font-mono outline-none focus:border-[var(--acc)]"
                  required
                />
              </div>

              {/* Quick asset chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {assets.slice(0, 5).map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelectAsset(a)}
                    className={`px-2 py-1 rounded text-[11px] font-mono border cursor-pointer transition ${
                      selectedAsset?.id === a.id
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'bg-[var(--surf2)] text-[var(--mute)] border-[var(--line)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {a.assetCode} ({a.currentCategory || a.category})
                  </button>
                ))}
              </div>
            </div>

            {/* Transfer Type Selector (Auto-determined / manual override) */}
            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surf2)] space-y-2">
              <label className="font-semibold text-[var(--ink)] block">
                Transfer Type Classification:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Small Asset', 'Large Asset', 'Parts'] as TransferType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTransferType(type)}
                    className={`p-2.5 rounded-lg border text-center font-bold transition cursor-pointer ${
                      transferType === type
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Approval Pathway Explanation */}
              <div className="text-[11px] pt-1">
                {transferType === 'Small Asset' ? (
                  <div className="text-blue-600 font-medium flex items-center gap-1.5">
                    <span>✓</span>
                    <span><strong>1-Level Approval:</strong> HOD only</span>
                  </div>
                ) : (
                  <div className="text-purple-600 font-medium flex items-center gap-1.5">
                    <span>✓</span>
                    <span>
                      <strong>3-Level Sequential Approval:</strong> Level 1: Chinese HOD → Level 2: Finance Department → Level 3: Samfu Boss (Super User)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Route Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Destination Plant:</label>
                <select
                  value={toPlant}
                  onChange={e => setToPlant(e.target.value)}
                  className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none"
                >
                  <option value="Noida Central Plant">Noida Central Plant</option>
                  <option value="Padget Unit 2">Padget Unit 2</option>
                  <option value="Padget Unit 3">Padget Unit 3</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Destination Department:</label>
                <select
                  value={toDept}
                  onChange={e => setToDept(e.target.value)}
                  className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none"
                >
                  <option value="SMT Operations">SMT Operations</option>
                  <option value="IT">IT</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Quality Control">Quality Control</option>
                  <option value="Store">Store</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-[var(--ink)] block mb-1">
                Destination Specific Location / Bay *:
              </label>
              <input
                type="text"
                value={toLocation}
                onChange={e => setToLocation(e.target.value)}
                placeholder="e.g. Building C39 - 2nd Floor (Bay 14 Desk 4)..."
                className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none focus:border-[var(--acc)]"
                required
              />
            </div>

            {/* New Custodian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">New Custodian Employee ID:</label>
                <input
                  type="text"
                  value={newCustodianId}
                  onChange={e => setNewCustodianId(e.target.value)}
                  placeholder="e.g. EMP-105"
                  className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">New Custodian Name:</label>
                <input
                  type="text"
                  value={newCustodian}
                  onChange={e => setNewCustodian(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none"
                />
              </div>
            </div>

            {/* Transfer Reason */}
            <div>
              <label className="font-semibold text-[var(--ink)] block mb-1">
                Reason for Custody / Location Transfer * (Mandatory):
              </label>
              <textarea
                rows={3}
                value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
                placeholder="Explain the operational necessity for this physical transfer..."
                className="w-full p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none focus:border-[var(--acc)]"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setActiveTab('my_requests')}
                className="btn text-xs px-4 py-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn p text-xs px-6 py-2.5 font-bold cursor-pointer shadow-md"
              >
                Submit Transfer Request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Review & Sequential Approval Action */}
      {isReviewModalOpen && reviewTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="card p-6 max-w-lg w-full space-y-4 border border-[var(--line)] shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <span>⚖️</span>
                  <span>Sequential Approval Decision</span>
                </h3>
                <p className="text-xs text-[var(--mute)] mt-0.5">
                  Acting as <strong>{reviewTransfer.currentApproverRole}</strong> for Stage {reviewTransfer.currentStage} of {reviewTransfer.totalStages}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="text-[var(--mute)] hover:text-[var(--ink)] text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Request Summary */}
            <div className="p-3.5 bg-[var(--surf2)] rounded-xl text-xs space-y-1.5 border border-[var(--line)]">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[var(--ink)]">{reviewTransfer.id}</span>
                <span className="text-[11px] font-semibold text-blue-600">{reviewTransfer.transferType}</span>
              </div>
              <div className="text-[var(--ink)]">
                <strong>Asset:</strong> {reviewTransfer.assetName} ({reviewTransfer.assetCode})
              </div>
              <div className="text-[var(--mute)]">
                <strong>Route:</strong> {reviewTransfer.fromDept} ({reviewTransfer.fromLocation}) → {reviewTransfer.toDept} ({reviewTransfer.toLocation})
              </div>
              <div className="text-[var(--mute)]">
                <strong>Reason:</strong> {reviewTransfer.reason}
              </div>
            </div>

            {/* Decision Radio */}
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-[var(--ink)] block">Approval Action:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewDecision('Approve')}
                  className={`p-2.5 rounded-lg border font-bold text-center cursor-pointer transition ${
                    reviewDecision === 'Approve'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  ✓ Approve & Advance
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision('Reject')}
                  className={`p-2.5 rounded-lg border font-bold text-center cursor-pointer transition ${
                    reviewDecision === 'Reject'
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  ✕ Reject & End Workflow
                </button>
              </div>
            </div>

            {/* Comments / Reason */}
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-[var(--ink)] block">
                {reviewDecision === 'Reject' ? 'Rejection Reason * (Required):' : 'Approver Comments:'}
              </label>
              <textarea
                rows={3}
                value={reviewComments}
                onChange={e => setReviewComments(e.target.value)}
                placeholder={
                  reviewDecision === 'Reject'
                    ? 'State clearly why this transfer is rejected (requester will receive this reason)...'
                    : 'Add optional approval notes or instructions for the next approver...'
                }
                className="w-full p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none focus:border-[var(--acc)]"
                required={reviewDecision === 'Reject'}
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="btn text-xs px-4 py-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                className={`btn text-xs px-6 py-2.5 font-bold cursor-pointer shadow-md ${
                  reviewDecision === 'Approve' ? 'p' : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Confirm {reviewDecision}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Visual Timeline & Request Tracking Card Component ────────────────────────

function TransferTrackingCard({ transfer }: { transfer: TransferRequestItem }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const isSmall = transfer.transferType === 'Small Asset'
  const isApproved = transfer.status === 'Approved'
  const isRejected = transfer.status === 'Rejected'

  return (
    <div className="card p-5 border border-[var(--line)] space-y-4 shadow-sm hover:border-blue-500/40 transition">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--surf2)] text-[var(--mute)]">
              {transfer.id}
            </span>
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {transfer.assetName} ({transfer.assetCode})
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                isSmall
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : 'bg-purple-500/10 text-purple-600 border-purple-500/20'
              }`}
            >
              {transfer.transferType} ({transfer.totalStages}-Tier)
            </span>
          </div>

          <div className="text-xs text-[var(--mute)] mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>👤 <strong>Requester:</strong> {transfer.requesterName} ({transfer.requesterDept})</span>
            <span>⇄ <strong>Route:</strong> {transfer.fromDept} → {transfer.toDept}</span>
            <span>📍 <strong>Location:</strong> {transfer.fromLocation} → {transfer.toLocation}</span>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`text-xs px-3 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
              isApproved
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : isRejected
                  ? 'bg-red-500/10 text-red-600 border-red-500/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            }`}
          >
            {!isApproved && !isRejected && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            <span>
              {isApproved
                ? '✓ Transfer Completed'
                : isRejected
                  ? `✕ Rejected by ${transfer.rejectedByRole || 'Approver'}`
                  : `Stage ${transfer.currentStage} of ${transfer.totalStages}: Awaiting ${transfer.currentApproverRole}`}
            </span>
          </span>
          <span className="text-[11px] text-[var(--mute)]">
            Initiated on {formatDateIN(transfer.date)}
          </span>
        </div>
      </div>

      {/* Rejection Alert Banner */}
      {isRejected && transfer.rejectionReason && (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-200 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-red-700 dark:text-red-300">
            <span>✕</span>
            <span>Workflow Terminated: Rejection Reason</span>
          </div>
          <p>{transfer.rejectionReason}</p>
        </div>
      )}

      {/* Visual Step-by-Step Approval Timeline */}
      <div className="pt-2 border-t border-[var(--line)]">
        <div className="flex items-center justify-between pb-2">
          <span className="text-[11px] font-bold text-[var(--mute)] uppercase tracking-wider">
            Sequential Approval Timeline:
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
          >
            {isExpanded ? 'Hide History ▲' : 'View Audit History ▼'}
          </button>
        </div>

        {/* Horizontal Timeline Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
          {/* Step 1: Requester */}
          <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-0.5">
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
              <span>✓</span>
              <span>Step 1: Submitted</span>
            </div>
            <div className="font-semibold text-[var(--ink)]">{transfer.requesterName}</div>
            <div className="text-[10px] text-[var(--mute)]">{formatDateIN(transfer.date)}</div>
          </div>

          {/* Step 2: HOD (for Small) OR Chinese HOD (for Large/Parts) */}
          {isSmall ? (
            <TimelineStepBox
              stepNumber={2}
              title="HOD Approval"
              isActive={transfer.currentApproverRole === 'HOD' && !isApproved && !isRejected}
              isPassed={isApproved || transfer.approvalHistory.some(h => h.role === 'HOD' && h.decision === 'Approved')}
              isRejected={isRejected && transfer.rejectedByRole === 'HOD'}
              approverInfo={transfer.approvalHistory.find(h => h.role === 'HOD')}
            />
          ) : (
            <TimelineStepBox
              stepNumber={2}
              title="Level 1: Chinese HOD"
              isActive={transfer.currentApproverRole === 'Chinese HOD' && !isApproved && !isRejected}
              isPassed={transfer.currentStage > 1 || isApproved}
              isRejected={isRejected && transfer.rejectedByRole === 'Chinese HOD'}
              approverInfo={transfer.approvalHistory.find(h => h.role === 'Chinese HOD')}
            />
          )}

          {/* Step 3: Finance Approver (Only for Large Asset / Parts) */}
          {!isSmall && (
            <TimelineStepBox
              stepNumber={3}
              title="Level 2: Finance"
              isActive={transfer.currentApproverRole === 'Finance' && !isApproved && !isRejected}
              isPassed={transfer.currentStage > 2 || isApproved}
              isRejected={isRejected && transfer.rejectedByRole === 'Finance'}
              approverInfo={transfer.approvalHistory.find(h => h.role === 'Finance')}
            />
          )}

          {/* Step 4: Samfu Boss (Only for Large Asset / Parts) */}
          {!isSmall && (
            <TimelineStepBox
              stepNumber={4}
              title="Level 3: Samfu Boss"
              isActive={transfer.currentApproverRole === 'Samfu Boss' && !isApproved && !isRejected}
              isPassed={isApproved}
              isRejected={isRejected && transfer.rejectedByRole === 'Samfu Boss'}
              approverInfo={transfer.approvalHistory.find(h => h.role === 'Samfu Boss')}
            />
          )}
        </div>

        {/* Expanded Audit Log Details */}
        {isExpanded && (
          <div className="mt-3 p-3 bg-[var(--surf2)] rounded-lg text-xs space-y-2 border border-[var(--line)] animate-in fade-in">
            <div className="font-bold text-[var(--ink)]">Immutable Action Ledger:</div>
            <div className="divide-y divide-[var(--line)]">
              {transfer.approvalHistory.map((step, idx) => (
                <div key={idx} className="py-1.5 flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-[var(--ink)]">{step.role}: {step.approverName}</span>
                    <span className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      step.decision === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                    }`}>
                      {step.decision}
                    </span>
                    <p className="text-[11px] text-[var(--mute)] mt-0.5">{step.comments}</p>
                  </div>
                  <span className="text-[10px] text-[var(--mute)] whitespace-nowrap">
                    {formatDateIN(step.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineStepBox({
  stepNumber,
  title,
  isActive,
  isPassed,
  isRejected,
  approverInfo,
}: {
  stepNumber: number
  title: string
  isActive: boolean
  isPassed: boolean
  isRejected: boolean
  approverInfo?: TransferApprovalStep
}) {
  return (
    <div
      className={`p-2.5 rounded-lg border space-y-0.5 transition ${
        isRejected
          ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
          : isPassed
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : isActive
              ? 'border-amber-500/40 bg-amber-500/10 font-bold'
              : 'border-[var(--line)] bg-[var(--surf)] opacity-50'
      }`}
    >
      <div className="text-[10px] font-bold flex items-center justify-between">
        <span>Step {stepNumber}: {title}</span>
        {isRejected ? (
          <span className="text-red-600">✕ Rejected</span>
        ) : isPassed ? (
          <span className="text-emerald-600">✓ Done</span>
        ) : isActive ? (
          <span className="text-amber-600 animate-pulse">● Active</span>
        ) : (
          <span className="text-[var(--mute)]">Waiting</span>
        )}
      </div>
      <div className="font-semibold text-[var(--ink)] truncate">
        {approverInfo ? approverInfo.approverName : isActive ? 'Pending Approval' : 'Queued'}
      </div>
      {approverInfo && (
        <div className="text-[10px] text-[var(--mute)] truncate">{approverInfo.comments}</div>
      )}
    </div>
  )
}

export default IndiaTransferView
