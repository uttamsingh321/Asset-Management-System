import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import { toast } from 'sonner'
import { t, formatDateIN, type Language } from '@/lib/indiaLocale'
import type { Asset } from '@/types/asset'
import {
  MAJOR_ASSET_CATEGORIES,
  MAJOR_ASSET_CATEGORIES_CONFIG,
  resolveMajorAssetCategory,
} from '@/types/asset'
import { exportAssetsToExcel } from '@/lib/excelExport'
import { logAuditEvent, type UserProfile, getCurrentUserProfile } from '@/lib/deviceTracker'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Pending Review'
export type ScanStatus = 'Pending' | 'Normal' | 'Shortage' | 'Overage' | 'Misplaced' | 'Damaged'

export interface StockCountItemRecord {
  assetId: string
  assetCode: string
  assetName: string
  serialNumber: string
  bookLocation: string
  currentLocation?: string
  building?: string
  floor?: string
  plant: string
  department: string
  category: string
  assetCondition: string
  status: ScanStatus
  verifiedAt?: string
  verifiedBy?: string
  varianceRemarks?: string
  photo?: string
  originalValues?: Record<string, any>
  updatedFields?: Record<string, any>
}

export interface StockCountTask {
  id: string
  title: string
  titleHi: string
  plant: string
  department: string
  workshop: string
  status: TaskStatus
  total: number
  scanned: number
  variances: number
  createdDate: string
  completedDate?: string
  assignedAssetCodes: string[]
}

interface IndiaStockCountViewProps {
  lang: Language
  assets?: Asset[]
  currentUser?: UserProfile
  onUpdateAsset?: (asset: Asset) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IndiaStockCountView({
  lang,
  assets = [],
  currentUser: propUser,
  onUpdateAsset,
}: IndiaStockCountViewProps) {
  const activeUser = useMemo(() => propUser || getCurrentUserProfile(), [propUser])
  const isSuperuserOrAdmin = Boolean(
    activeUser.isSuperuser ||
    activeUser.role === 'Admin' ||
    activeUser.role === 'Administrator' ||
    activeUser.userId?.toUpperCase() === 'USR-ADMIN'
  )

  const userDept = (activeUser.department || 'IT').trim()

  // 1. Dynamic Stock Count Tasks generation based on real scoped assets
  const [tasks, setTasks] = useState<StockCountTask[]>(() => {
    // Group assets by department to create realistic tasks
    const depts = Array.from(new Set(assets.map(a => a.currentDepartment || a.department || userDept).filter(Boolean)))
    if (depts.length === 0) depts.push(userDept)

    return depts.map((dept, idx) => {
      const deptAssets = assets.filter(a => (a.currentDepartment || a.department || '').toLowerCase() === dept.toLowerCase())
      return {
        id: `SC-2026-${(dept.slice(0, 3) || 'FAC').toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
        title: `Q4 Annual Stock Count – ${dept}`,
        titleHi: `Q4 वार्षिक स्टॉक गिनती – ${dept}`,
        plant: deptAssets[0]?.plant || 'Noida Central Plant',
        department: dept,
        workshop: `${dept} Operation Bay`,
        status: deptAssets.length > 0 ? 'In Progress' : 'Not Started',
        total: deptAssets.length || 1,
        scanned: 0,
        variances: 0,
        createdDate: '2026-11-01',
        assignedAssetCodes: deptAssets.map(a => a.assetCode),
      }
    })
  })

  // Synchronize tasks when scoped assets change
  useEffect(() => {
    setTasks(prev => {
      const depts = Array.from(new Set(assets.map(a => a.currentDepartment || a.department || userDept).filter(Boolean)))
      if (depts.length === 0) depts.push(userDept)

      return depts.map((dept, idx) => {
        const deptAssets = assets.filter(a => (a.currentDepartment || a.department || '').toLowerCase() === dept.toLowerCase())
        const existing = prev.find(t => t.department.toLowerCase() === dept.toLowerCase())
        return {
          id: existing?.id || `SC-2026-${(dept.slice(0, 3) || 'FAC').toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
          title: `Q4 Annual Stock Count – ${dept}`,
          titleHi: `Q4 वार्षिक स्टॉक गिनती – ${dept}`,
          plant: deptAssets[0]?.plant || 'Noida Central Plant',
          department: dept,
          workshop: `${dept} Operation Bay`,
          status: existing?.status || (deptAssets.length > 0 ? 'In Progress' : 'Not Started'),
          total: deptAssets.length,
          scanned: existing?.scanned ?? 0,
          variances: existing?.variances ?? 0,
          createdDate: existing?.createdDate || '2026-11-01',
          assignedAssetCodes: deptAssets.map(a => a.assetCode),
        }
      })
    })
  }, [assets, userDept])

  // 2. Active Count Session State
  const [activeTask, setActiveTask] = useState<StockCountTask | null>(null)
  const [taskItemRecords, setTaskItemRecords] = useState<Record<string, StockCountItemRecord>>({})
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'variances'>('all')
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('all')

  // 3. QR Scan Dialog State & Real Hardware Camera Feed
  const [isScanModalOpen, setIsScanModalOpen] = useState(false)
  const [targetAsset, setTargetAsset] = useState<Asset | null>(null)
  const [scannedCodeInput, setScannedCodeInput] = useState('')
  const [scanValidationStatus, setScanValidationStatus] = useState<{
    tested: boolean
    valid: boolean
    error?: string
    asset?: Asset
  } | null>(null)
  const [isValidatingScan, setIsValidatingScan] = useState(false)

  // Real Camera Hardware Feed & QR Decoder State
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanAnimFrameRef = useRef<number | null>(null)
  const isProcessingScanRef = useRef(false)
  const lastScannedCodeRef = useRef<string | null>(null)
  const lastScannedTimeRef = useRef<number>(0)

  // 4. Asset Details Verification Modal
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [verifyingAsset, setVerifyingAsset] = useState<Asset | null>(null)
  const [isEditingVariance, setIsEditingVariance] = useState(false)

  // Permitted edit fields state for Variance
  const [varianceLocation, setVarianceLocation] = useState('')
  const [varianceBuilding, setVarianceBuilding] = useState('')
  const [varianceFloor, setVarianceFloor] = useState('')
  const [varianceCondition, setVarianceCondition] = useState('Operational - Good')
  const [varianceType, setVarianceType] = useState<ScanStatus>('Shortage')
  const [varianceRemarks, setVarianceRemarks] = useState('')
  const [variancePhoto, setVariancePhoto] = useState<string | null>(null)

  // 5. Variance Report Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  // ── Handlers ─────────────────────────────────────────────────────────────

  // Step 1: User clicks "Start Count"
  const handleStartCount = (task: StockCountTask) => {
    // Security Guard: Cross-department stock count blocked for non-admins
    if (!isSuperuserOrAdmin && task.department.toLowerCase() !== userDept.toLowerCase()) {
      toast.error('Access Denied: Cross-department stock count is unauthorized.', {
        description: `This count is assigned to ${task.department}. Your user is scoped to ${userDept}.`,
      })
      logAuditEvent(
        'STOCK_COUNT_SCAN_REJECTED',
        {
          taskId: task.id,
          reason: 'TASK_DEPARTMENT_MISMATCH',
          taskDepartment: task.department,
          userDepartment: userDept,
        },
        task.id,
        'StockCountTask'
      )
      return
    }

    setActiveTask(task)

    // Load only the assets assigned to that Stock Count, Plant, Department, and User
    const relevantAssets = assets.filter(a => {
      const matchDept = isSuperuserOrAdmin || (a.currentDepartment || a.department || '').toLowerCase() === task.department.toLowerCase()
      const matchPlant = !task.plant || !a.plant || a.plant.toLowerCase().includes(task.plant.toLowerCase())
      return matchDept && matchPlant
    })

    const initialRecords: Record<string, StockCountItemRecord> = {}
    relevantAssets.forEach(a => {
      initialRecords[a.assetCode] = {
        assetId: a.id,
        assetCode: a.assetCode,
        assetName: a.currentDescription || a.name,
        serialNumber: a.serialNumber || '-',
        bookLocation: a.currentLocation || a.location || `${a.building || 'C39'} ${a.floor || '1F'}`,
        currentLocation: a.currentLocation || a.location,
        building: a.building || 'C39',
        floor: a.floor || '1st Floor',
        plant: a.plant || task.plant,
        department: a.currentDepartment || a.department || task.department,
        category: a.currentCategory || a.category || 'General Equipment',
        assetCondition: a.assetCondition || 'Operational',
        status: 'Pending',
      }
    })

    setTaskItemRecords(initialRecords)

    logAuditEvent(
      'STOCK_COUNT_START',
      {
        taskId: task.id,
        plant: task.plant,
        department: task.department,
        totalAssets: relevantAssets.length,
      },
      task.id,
      'StockCountTask'
    )

    toast.info(`Started Stock Count: ${task.title}`, {
      description: `Loaded ${relevantAssets.length} assets assigned to ${task.department} (${task.plant}). Ready for QR scan verification.`,
    })
  }

  // Step 2: Open QR Scanner for an asset or free scan
  const handleOpenScanner = (asset?: Asset) => {
    setTargetAsset(asset || null)
    setScannedCodeInput('')
    setScanValidationStatus(null)
    setIsScanModalOpen(true)
  }

  // Step 3: Backend / Invariant QR Validation Engine
  const handleValidateQr = async (scannedCodeRaw: string) => {
    let scannedCode = scannedCodeRaw.trim()
    try {
      if (scannedCode.startsWith('http://') || scannedCode.startsWith('https://')) {
        const u = new URL(scannedCode)
        const fromParam = u.searchParams.get('asset') || u.searchParams.get('code')
        if (fromParam) {
          scannedCode = fromParam
        } else if (u.hash.includes('code=')) {
          const match = u.hash.match(/[?&]code=([^&]+)/)
          if (match) scannedCode = decodeURIComponent(match[1])
        } else if (u.hash.includes('asset=')) {
          const match = u.hash.match(/[?&]asset=([^&]+)/)
          if (match) scannedCode = decodeURIComponent(match[1])
        }
      }
    } catch {}

    if (!scannedCode) {
      toast.error('Please scan or enter an asset QR code.')
      return
    }

    setIsValidatingScan(true)
    setScanValidationStatus(null)

    // First attempt backend validation API
    let validationResult: {
      valid: boolean
      error?: string
      code?: string
      asset?: Asset
    } | null = null

    try {
      const res = await fetch('/api/stock-count/validate-scan/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': activeUser.userId,
          'X-User-Name': activeUser.userName,
          'X-User-Role': activeUser.role,
          'X-User-Department': activeUser.department || userDept,
          'X-Superuser': isSuperuserOrAdmin ? 'true' : 'false',
        },
        body: JSON.stringify({
          scannedCode,
          expectedAssetId: targetAsset?.assetCode || targetAsset?.id,
          taskId: activeTask?.id,
          plant: activeTask?.plant,
          taskDepartment: activeTask?.department,
          userDepartment: activeUser.department || userDept,
          isSuperuser: isSuperuserOrAdmin,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        validationResult = { valid: true, asset: json.asset }
      } else {
        const errJson = await res.json().catch(() => ({}))
        validationResult = {
          valid: false,
          error: errJson.error || `QR Validation Failed (HTTP ${res.status})`,
          code: errJson.code,
        }
      }
    } catch {
      // Offline / Local Sandbox Validation Invariant Fallback
      const matched = assets.find(
        a =>
          a.assetCode.toLowerCase() === scannedCode.toLowerCase() ||
          (a.assetTag && a.assetTag.toLowerCase() === scannedCode.toLowerCase())
      )

      if (!matched) {
        validationResult = {
          valid: false,
          error: `Validation Failed: Scanned QR '${scannedCode}' does not exist in asset database.`,
          code: 'QR_NOT_FOUND',
        }
      } else if (matched.status === 'Disposed' || matched.status === 'Retired') {
        validationResult = {
          valid: false,
          error: `Validation Failed: Asset '${matched.assetCode}' is marked as ${matched.status} and cannot be verified in active count.`,
          code: 'INACTIVE_STATUS',
        }
      } else if (targetAsset && targetAsset.assetCode.toLowerCase() !== matched.assetCode.toLowerCase()) {
        validationResult = {
          valid: false,
          error: `Validation Failed: A QR can only open its own linked asset. Scanned QR '${scannedCode}' does not match expected asset '${targetAsset.assetCode}'.`,
          code: 'ASSET_MISMATCH',
        }
      } else {
        // Department Check
        const assetDept = (matched.currentDepartment || matched.department || '').toLowerCase()
        const countDept = (activeTask?.department || userDept).toLowerCase()
        if (!isSuperuserOrAdmin && assetDept && countDept && assetDept !== countDept) {
          validationResult = {
            valid: false,
            error: `Access Denied: Asset '${matched.assetCode}' belongs to '${matched.currentDepartment || matched.department}'. Your session is restricted to '${activeTask?.department || userDept}'. Cross-department verification is prohibited.`,
            code: 'DEPARTMENT_MISMATCH',
          }
        } else {
          validationResult = { valid: true, asset: matched }
        }
      }
    }

    setIsValidatingScan(false)

    if (validationResult.valid && validationResult.asset) {
      setScanValidationStatus({
        tested: true,
        valid: true,
        asset: validationResult.asset,
      })

      logAuditEvent(
        'STOCK_COUNT_SCAN_SUCCESS',
        {
          taskId: activeTask?.id,
          scannedCode,
          assetName: validationResult.asset.currentDescription || validationResult.asset.name,
          department: validationResult.asset.currentDepartment || validationResult.asset.department,
        },
        validationResult.asset.assetCode,
        'Asset'
      )

      toast.success(`✓ QR Validated Successfully for ${validationResult.asset.assetCode}!`)

      // Close scanner modal and immediately open Asset Details verification modal!
      setIsScanModalOpen(false)
      setVerifyingAsset(validationResult.asset)
      setIsEditingVariance(false)
      setIsVerifyModalOpen(true)
    } else {
      setScanValidationStatus({
        tested: true,
        valid: false,
        error: validationResult.error,
      })

      logAuditEvent(
        'STOCK_COUNT_SCAN_REJECTED',
        {
          taskId: activeTask?.id,
          scannedCode,
          expectedAsset: targetAsset?.assetCode,
          error: validationResult.error,
          code: validationResult.code,
        },
        scannedCode,
        'Asset'
      )

      toast.error('⛔ QR Verification Denied', {
        description: validationResult.error,
      })
    }
  }

  // ── Camera Controller & QR Scanning Engine ─────────────────────────────────

  const stopCamera = useCallback(() => {
    if (scanAnimFrameRef.current) {
      cancelAnimationFrame(scanAnimFrameRef.current)
      scanAnimFrameRef.current = null
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
        })
      } catch {}
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null)
    setScannedFeedback(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported in this browser environment. You can enter or scan codes using a hardware scanner below.')
      setCameraActive(false)
      return
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setCameraActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch {
          // Playback constraint handled
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access device camera'
      setCameraError(msg)
      setCameraActive(false)
    }
  }, [facingMode])

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    startCamera(nextMode)
  }

  // Camera start / stop lifecycle tied to isScanModalOpen
  useEffect(() => {
    if (isScanModalOpen) {
      startCamera(facingMode)
    } else {
      stopCamera()
      setCameraError(null)
      setScannedFeedback(null)
      lastScannedCodeRef.current = null
    }
    return () => {
      stopCamera()
    }
  }, [isScanModalOpen, startCamera, stopCamera, facingMode])

  // Continuous Video Frame QR Decoder Loop
  useEffect(() => {
    if (!isScanModalOpen || !cameraActive) return

    let isMounted = true

    const scanFrame = async () => {
      if (!isMounted || !isScanModalOpen) return

      const video = videoRef.current
      const canvas = canvasRef.current

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          let detectedCode: string | null = null

          // Method 1: BarcodeDetector API (fastest if supported)
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
              // @ts-ignore
              const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a'] })
              const barcodes = await detector.detect(canvas)
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedCode = barcodes[0].rawValue
              }
            } catch {}
          }

          // Method 2: jsQR decoding fallback
          if (!detectedCode) {
            try {
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const qr = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'attemptBoth',
              })
              if (qr && qr.data) {
                detectedCode = qr.data
              }
            } catch {}
          }

          if (detectedCode && !isProcessingScanRef.current) {
            const now = Date.now()
            if (detectedCode !== lastScannedCodeRef.current || now - lastScannedTimeRef.current > 2500) {
              lastScannedCodeRef.current = detectedCode
              lastScannedTimeRef.current = now
              isProcessingScanRef.current = true

              setScannedFeedback(detectedCode)
              setScannedCodeInput(detectedCode)

              try {
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  navigator.vibrate(60)
                }
              } catch {}

              await handleValidateQr(detectedCode)

              setTimeout(() => {
                isProcessingScanRef.current = false
              }, 1200)
            }
          }
        }
      }

      if (isMounted && isScanModalOpen) {
        scanAnimFrameRef.current = requestAnimationFrame(scanFrame)
      }
    }

    scanAnimFrameRef.current = requestAnimationFrame(scanFrame)

    return () => {
      isMounted = false
      if (scanAnimFrameRef.current) {
        cancelAnimationFrame(scanAnimFrameRef.current)
      }
    }
  }, [isScanModalOpen, cameraActive, handleValidateQr])

  // Step 4A: Decision: Information Correct
  const handleMarkCorrect = async () => {
    if (!verifyingAsset || !activeTask) return

    const code = verifyingAsset.assetCode
    const nowIso = new Date().toISOString()

    // Submit to Backend
    try {
      await fetch('/api/stock-count/verify/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': activeUser.userId,
          'X-User-Name': activeUser.userName,
          'X-User-Role': activeUser.role,
        },
        body: JSON.stringify({
          taskId: activeTask.id,
          assetCode: code,
          decision: 'CORRECT',
          userId: activeUser.userId,
          userName: activeUser.userName,
          role: activeUser.role,
        }),
      })
    } catch {}

    // Update Local Records
    setTaskItemRecords(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || {
          assetId: verifyingAsset.id,
          assetCode: code,
          assetName: verifyingAsset.currentDescription || verifyingAsset.name,
          serialNumber: verifyingAsset.serialNumber || '-',
          bookLocation: verifyingAsset.currentLocation || verifyingAsset.location || '',
          plant: verifyingAsset.plant || activeTask.plant,
          department: verifyingAsset.currentDepartment || verifyingAsset.department || activeTask.department,
          category: verifyingAsset.currentCategory || verifyingAsset.category || 'Equipment',
          assetCondition: verifyingAsset.assetCondition || 'Operational',
        }),
        status: 'Normal',
        verifiedAt: nowIso,
        verifiedBy: activeUser.userName,
      },
    }))

    // Update Task Progress
    setTasks(prev =>
      prev.map(t =>
        t.id === activeTask.id
          ? {
              ...t,
              scanned: Math.min(t.scanned + 1, t.total),
            }
          : t
      )
    )

    setActiveTask(prev =>
      prev
        ? {
            ...prev,
            scanned: Math.min(prev.scanned + 1, prev.total),
          }
        : null
    )

    logAuditEvent(
      'STOCK_COUNT_VERIFIED',
      {
        taskId: activeTask.id,
        decision: 'Information Correct',
        status: 'Normal',
        assetCode: code,
        verifiedLocation: verifyingAsset.currentLocation || verifyingAsset.location,
        verifiedCondition: verifyingAsset.assetCondition,
      },
      code,
      'Asset'
    )

    toast.success(`Asset "${code}" Verified`, {
      description: 'Physical equipment data confirmed correct. Verification status updated.',
    })

    setIsVerifyModalOpen(false)
    setVerifyingAsset(null)
  }

  // Step 4B: Decision: Information Incorrect -> Switch to Edit Variance Mode
  const handleSwitchToVariance = () => {
    if (!verifyingAsset) return
    setIsEditingVariance(true)
    setVarianceLocation(verifyingAsset.currentLocation || verifyingAsset.location || '')
    setVarianceBuilding(verifyingAsset.building || 'C39')
    setVarianceFloor(verifyingAsset.floor || '1st Floor')
    setVarianceCondition(verifyingAsset.assetCondition || 'Operational - Good')
    setVarianceType('Shortage')
    setVarianceRemarks('')
    setVariancePhoto(null)
  }

  // Step 4C: Save Variance and Update Permitted Fields
  const handleSaveVariance = async () => {
    if (!verifyingAsset || !activeTask) return
    if (!varianceRemarks.trim()) {
      toast.error('Please enter variance remarks explaining the discrepancy.')
      return
    }

    const code = verifyingAsset.assetCode
    const nowIso = new Date().toISOString()

    const updatedFields = {
      location: varianceLocation.trim(),
      currentLocation: varianceLocation.trim(),
      building: varianceBuilding.trim(),
      floor: varianceFloor.trim(),
      assetCondition: varianceCondition,
      remarks: varianceRemarks.trim(),
    }

    // Submit to Backend
    try {
      await fetch('/api/stock-count/verify/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': activeUser.userId,
          'X-User-Name': activeUser.userName,
          'X-User-Role': activeUser.role,
        },
        body: JSON.stringify({
          taskId: activeTask.id,
          assetCode: code,
          decision: 'INCORRECT',
          updatedFields,
          varianceRemarks: varianceRemarks.trim(),
          varianceType,
          userId: activeUser.userId,
          userName: activeUser.userName,
          role: activeUser.role,
        }),
      })
    } catch {}

    // Update Asset Object with permitted changes
    const updatedAsset: Asset = {
      ...verifyingAsset,
      location: varianceLocation.trim(),
      currentLocation: varianceLocation.trim(),
      building: varianceBuilding.trim(),
      floor: varianceFloor.trim(),
      assetCondition: varianceCondition,
      remarks: [verifyingAsset.remarks, `[Audit Variance: ${varianceRemarks.trim()}]`].filter(Boolean).join(' — '),
    }

    if (onUpdateAsset) {
      onUpdateAsset(updatedAsset)
    }

    // Update Local Records
    setTaskItemRecords(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || {
          assetId: verifyingAsset.id,
          assetCode: code,
          assetName: verifyingAsset.currentDescription || verifyingAsset.name,
          serialNumber: verifyingAsset.serialNumber || '-',
          bookLocation: verifyingAsset.currentLocation || verifyingAsset.location || '',
          plant: verifyingAsset.plant || activeTask.plant,
          department: verifyingAsset.currentDepartment || verifyingAsset.department || activeTask.department,
          category: verifyingAsset.currentCategory || verifyingAsset.category || 'Equipment',
          assetCondition: verifyingAsset.assetCondition || 'Operational',
        }),
        status: varianceType,
        verifiedAt: nowIso,
        verifiedBy: activeUser.userName,
        varianceRemarks: varianceRemarks.trim(),
        updatedFields,
        photo: variancePhoto || undefined,
      },
    }))

    // Update Task Progress & Increment Variances
    setTasks(prev =>
      prev.map(t =>
        t.id === activeTask.id
          ? {
              ...t,
              scanned: Math.min(t.scanned + 1, t.total),
              variances: t.variances + 1,
            }
          : t
      )
    )

    setActiveTask(prev =>
      prev
        ? {
            ...prev,
            scanned: Math.min(prev.scanned + 1, prev.total),
            variances: prev.variances + 1,
          }
        : null
    )

    logAuditEvent(
      'STOCK_COUNT_VARIANCE',
      {
        taskId: activeTask.id,
        decision: 'Information Incorrect',
        status: varianceType,
        varianceRemarks: varianceRemarks.trim(),
        originalValues: {
          location: verifyingAsset.currentLocation || verifyingAsset.location,
          condition: verifyingAsset.assetCondition,
        },
        newValues: updatedFields,
      },
      code,
      'Asset'
    )

    toast.warning(`Variance Saved for "${code}"`, {
      description: `Discrepancy logged as ${varianceType}. Permitted asset fields updated.`,
    })

    setIsVerifyModalOpen(false)
    setVerifyingAsset(null)
    setIsEditingVariance(false)
  }

  // Step 5: Complete Stock Count
  const handleCompleteCount = () => {
    if (!activeTask) return

    const verifiedCount = Object.values(taskItemRecords).filter(i => i.status !== 'Pending').length
    const variancesCount = Object.values(taskItemRecords).filter(i => i.status !== 'Pending' && i.status !== 'Normal').length
    const finalStatus: TaskStatus = variancesCount > 0 ? 'Pending Review' : 'Completed'

    setTasks(prev =>
      prev.map(t =>
        t.id === activeTask.id
          ? {
              ...t,
              status: finalStatus,
              scanned: verifiedCount,
              variances: variancesCount,
              completedDate: new Date().toISOString().split('T')[0],
            }
          : t
      )
    )

    logAuditEvent(
      'STOCK_COUNT_COMPLETE',
      {
        taskId: activeTask.id,
        finalStatus,
        verifiedCount,
        variancesCount,
      },
      activeTask.id,
      'StockCountTask'
    )

    toast.success(`Stock Count "${activeTask.title}" Completed!`, {
      description: `Status: ${finalStatus} · ${verifiedCount} assets verified · ${variancesCount} variances recorded.`,
    })

    setIsReportModalOpen(true)
  }

  // Export assigned count assets to Excel
  const handleExportExcel = () => {
    if (activeTask) {
      const assigned = assets.filter(a => activeTask.assignedAssetCodes.includes(a.assetCode))
      exportAssetsToExcel(assigned.length > 0 ? assigned : assets, `Stock_Count_${activeTask.id}`)
    } else {
      exportAssetsToExcel(assets, 'Stock_Count_Audit')
    }
  }

  // Computed Items for Active Task
  const activeItemsList = useMemo(() => {
    if (!activeTask) return []
    const codes = activeTask.assignedAssetCodes
    const relevant = assets.filter(a => codes.includes(a.assetCode))

    return relevant.map(asset => {
      const record = taskItemRecords[asset.assetCode]
      return {
        asset,
        record: record || {
          assetId: asset.id,
          assetCode: asset.assetCode,
          assetName: asset.currentDescription || asset.name,
          serialNumber: asset.serialNumber || '-',
          bookLocation: asset.currentLocation || asset.location || `${asset.building || 'C39'} ${asset.floor || '1F'}`,
          plant: asset.plant || activeTask.plant,
          department: asset.currentDepartment || asset.department || activeTask.department,
          category: asset.currentCategory || asset.category || 'General Equipment',
          assetCondition: asset.assetCondition || 'Operational',
          status: 'Pending',
        },
      }
    })
  }, [activeTask, assets, taskItemRecords])

  const filteredItemsList = useMemo(() => {
    let list = activeItemsList
    if (statusFilter === 'pending') list = list.filter(i => i.record.status === 'Pending')
    else if (statusFilter === 'verified') list = list.filter(i => i.record.status === 'Normal')
    else if (statusFilter === 'variances') list = list.filter(i => i.record.status !== 'Pending' && i.record.status !== 'Normal')

    if (stockCategoryFilter !== 'all') {
      list = list.filter(i => resolveMajorAssetCategory(i.asset.currentCategory || i.asset.category) === stockCategoryFilter)
    }
    return list
  }, [activeItemsList, statusFilter, stockCategoryFilter])

  const verifiedTotal = activeItemsList.filter(i => i.record.status !== 'Pending').length
  const variancesTotal = activeItemsList.filter(i => i.record.status !== 'Pending' && i.record.status !== 'Normal').length
  const progressPct = activeItemsList.length > 0 ? Math.round((verifiedTotal / activeItemsList.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[var(--line)]">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>📦</span>
            <span>{t('stockCount', lang)}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
              QR Audit Engine
            </span>
          </h1>
          <p className="text-xs text-[var(--mute)] mt-1">
            {lang === 'hi'
              ? 'संयंत्र और विभाग के अनुसार परिसंपत्ति स्टॉक गणना — केवल मुद्रित QR सत्यापन'
              : 'Physical Stock Count Audit with strict QR validation, department scoping, and variance tracking.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTask ? (
            <>
              <button
                type="button"
                onClick={() => handleOpenScanner()}
                className="btn p text-xs flex items-center gap-1.5 px-3.5 py-2 cursor-pointer shadow-sm"
              >
                <span>📷</span>
                <span>Scan QR Code</span>
              </button>
              <button
                type="button"
                onClick={handleCompleteCount}
                className="btn text-xs flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm font-semibold rounded-lg"
              >
                <span>✓</span>
                <span>Complete Stock Count</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTask(null)}
                className="btn text-xs px-3 py-2 cursor-pointer"
              >
                Exit Session
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn p text-xs flex items-center gap-1.5 px-4 py-2 cursor-pointer shadow-sm"
            >
              <span>📊</span>
              <span>{lang === 'hi' ? 'Excel निर्यात' : 'Export Excel'}</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW A: Active Stock Count Session Workspace */}
      {activeTask ? (
        <div className="space-y-6">
          {/* Active Session Info Card */}
          <div className="card p-5 border border-blue-500/30 bg-gradient-to-r from-blue-500/5 via-[var(--surf)] to-[var(--surf)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-base font-bold text-[var(--ink)]">{activeTask.title}</h2>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[var(--surf2)] text-[var(--mute)]">
                    {activeTask.id}
                  </span>
                </div>
                <div className="text-xs text-[var(--mute)] mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>🏭 <strong>Plant:</strong> {activeTask.plant}</span>
                  <span>🏢 <strong>Department:</strong> {activeTask.department}</span>
                  <span>👤 <strong>Auditor:</strong> {activeUser.userName} ({activeUser.userId})</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="btn text-xs px-3 py-1.5 cursor-pointer flex items-center gap-1"
                >
                  <span>📋</span>
                  <span>View Variances ({variancesTotal})</span>
                </button>
              </div>
            </div>

            {/* Progress Bar & Metric Pills */}
            <div className="space-y-2 pt-2 border-t border-[var(--line)]">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[var(--ink)]">
                  Verification Progress: {verifiedTotal} / {activeItemsList.length} Units Verified
                </span>
                <span className="text-blue-600 font-bold">{progressPct}%</span>
              </div>
              <div className="w-full bg-[var(--surf2)] h-2.5 rounded-full overflow-hidden border border-[var(--line)]">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition ${
                    statusFilter === 'all'
                      ? 'bg-[var(--ink)] text-white border-transparent'
                      : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  All Units ({activeItemsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition flex items-center gap-1 ${
                    statusFilter === 'pending'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-amber-600'
                  }`}
                >
                  <span>⏳ Pending Scan</span>
                  <span>({activeItemsList.length - verifiedTotal})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('verified')}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition flex items-center gap-1 ${
                    statusFilter === 'verified'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold'
                      : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-emerald-600'
                  }`}
                >
                  <span>✅ Verified Normal</span>
                  <span>({verifiedTotal - variancesTotal})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('variances')}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition flex items-center gap-1 ${
                    statusFilter === 'variances'
                      ? 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40 font-bold'
                      : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-red-600'
                  }`}
                >
                  <span>⚠️ Variances</span>
                  <span>({variancesTotal})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Assigned Assets Verification Table */}
          <div className="card overflow-hidden border border-[var(--line)]">
            <div className="p-4 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                  <span>📋</span>
                  <span>Assigned Units for Physical Audit</span>
                </h3>
                <p className="text-xs text-[var(--mute)] mt-0.5">
                  Strict Rule: Each unit must be verified only by scanning its printed QR code.
                </p>
              </div>

              {/* Major Asset Category Filter */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStockCategoryFilter('all')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap ${
                    stockCategoryFilter === 'all'
                      ? 'bg-[var(--ink)] text-[var(--surf)] font-bold'
                      : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  All Categories
                </button>
                {MAJOR_ASSET_CATEGORIES.map((catKey) => {
                  const cfg = MAJOR_ASSET_CATEGORIES_CONFIG[catKey]
                  const isSelected = stockCategoryFilter === catKey
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setStockCategoryFilter(catKey)}
                      className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-[var(--surf)] font-bold shadow-xs'
                          : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {filteredItemsList.length > 0 ? (
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-340px)] min-h-[350px] border border-[var(--line)] rounded-xl scrollbar-thin">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-[var(--surf2)] shadow-2xs">
                    <tr className="bg-[var(--surf2)] text-[var(--mute)] font-semibold border-b border-[var(--line)]">
                      <th className="p-3 bg-[var(--surf2)]">Asset Code</th>
                      <th className="p-3 bg-[var(--surf2)]">Asset Name & Model</th>
                      <th className="p-3 bg-[var(--surf2)]">Category</th>
                      <th className="p-3 bg-[var(--surf2)]">Expected Location</th>
                      <th className="p-3 bg-[var(--surf2)]">Status</th>
                      <th className="p-3 bg-[var(--surf2)]">Last Verified</th>
                      <th className="p-3 text-right bg-[var(--surf2)]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {filteredItemsList.map(({ asset, record }) => {
                      const isPending = record.status === 'Pending'
                      const isNormal = record.status === 'Normal'
                      const isVariance = !isPending && !isNormal

                      return (
                        <tr key={asset.id} className="hover:bg-[var(--surf2)]/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-[var(--ink)]">
                            {asset.assetCode}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-[var(--ink)]">
                              {asset.currentDescription || asset.name}
                            </div>
                            <div className="text-[11px] text-[var(--mute)]">
                              SN: {asset.serialNumber || 'SN-UNAVAIL'} · Custodian: {asset.whoInCharge || asset.inChargeName || '-'}
                            </div>
                          </td>
                          <td className="p-3 text-[var(--mute)]">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${MAJOR_ASSET_CATEGORIES_CONFIG[resolveMajorAssetCategory(asset.currentCategory || asset.category)].badgeClass}`}>
                              {MAJOR_ASSET_CATEGORIES_CONFIG[resolveMajorAssetCategory(asset.currentCategory || asset.category)].icon}{' '}
                              {MAJOR_ASSET_CATEGORIES_CONFIG[resolveMajorAssetCategory(asset.currentCategory || asset.category)].label}
                            </span>
                          </td>
                          <td className="p-3 text-[var(--mute)]">
                            {record.currentLocation || record.bookLocation}
                          </td>
                          <td className="p-3">
                            {isPending && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                ⏳ Pending Scan
                              </span>
                            )}
                            {isNormal && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                ✅ Verified
                              </span>
                            )}
                            {isVariance && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-600 border border-red-500/20">
                                ⚠️ {record.status}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[var(--mute)] text-[11px]">
                            {record.verifiedAt ? (
                              <div>
                                <div>{formatDateIN(record.verifiedAt)}</div>
                                <div className="text-[10px] text-[var(--mute)]">by {record.verifiedBy}</div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenScanner(asset)}
                              className={`btn text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                isPending ? 'p' : 'border border-[var(--line)] bg-[var(--surf)] hover:bg-[var(--surf2)]'
                              }`}
                            >
                              <span>📷</span>
                              <span>{isPending ? 'Scan QR' : 'Re-scan QR'}</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[var(--mute)]">
                No asset units match the selected status filter.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VIEW B: Tasks List View (When no task session is active) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <div className="card p-2.5 sm:p-3 space-y-0.5">
              <div className="text-[11px] text-[var(--mute)]">Total Audit Tasks</div>
              <div className="text-lg sm:text-xl font-black text-[var(--ink)]">{tasks.length}</div>
              <div className="text-[10px] text-[var(--mute)]">Scoped to Indian Plants</div>
            </div>
            <div className="card p-2.5 sm:p-3 space-y-0.5">
              <div className="text-[11px] text-[var(--mute)]">Active Sessions</div>
              <div className="text-lg sm:text-xl font-black text-blue-600">
                {tasks.filter(t => t.status === 'In Progress').length}
              </div>
              <div className="text-[10px] text-blue-600 font-medium">In Progress</div>
            </div>
            <div className="card p-2.5 sm:p-3 space-y-0.5">
              <div className="text-[11px] text-[var(--mute)]">Completed Tasks</div>
              <div className="text-lg sm:text-xl font-black text-emerald-600">
                {tasks.filter(t => t.status === 'Completed').length}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">100% Reconciled</div>
            </div>
            <div className="card p-2.5 sm:p-3 space-y-0.5">
              <div className="text-[11px] text-[var(--mute)]">Total Variances</div>
              <div className="text-lg sm:text-xl font-black text-amber-600">
                {tasks.reduce((sum, t) => sum + t.variances, 0)}
              </div>
              <div className="text-[10px] text-amber-600 font-medium">Requires Supervisor Review</div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--mute)]">
              Scheduled Stock Count Operations
            </h2>

            {tasks.map(task => {
              const progressPct = task.total > 0 ? Math.round((task.scanned / task.total) * 100) : 0
              const isUserDepartment = isSuperuserOrAdmin || task.department.toLowerCase() === userDept.toLowerCase()

              return (
                <div key={task.id} className="card p-5 space-y-4 border border-[var(--line)]">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--ink)]">{task.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded font-bold font-mono bg-[var(--surf2)] text-[var(--mute)]">
                          {task.id}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--mute)] mt-1 flex flex-wrap items-center gap-x-4">
                        <span>🏭 <strong>Plant:</strong> {task.plant}</span>
                        <span>🏢 <strong>Department:</strong> {task.department}</span>
                        <span>📅 <strong>Scheduled:</strong> {formatDateIN(task.createdDate)}</span>
                      </div>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border self-start ${
                        task.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : task.status === 'In Progress'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-[var(--mute)]">
                      <span>Progress: {task.scanned} / {task.total} Scanned</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="w-full bg-[var(--surf2)] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Variances & Actions */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)]">
                    <div className="text-xs">
                      <span>⚠️ Variances: </span>
                      <strong className={task.variances > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {task.variances}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartCount(task)}
                        disabled={!isUserDepartment}
                        title={
                          isUserDepartment
                            ? 'Start QR physical count'
                            : `Disabled: Scoped to ${task.department}. Your user is in ${userDept}.`
                        }
                        className={`btn text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm ${
                          isUserDepartment
                            ? 'p cursor-pointer'
                            : 'opacity-50 cursor-not-allowed bg-[var(--surf2)] text-[var(--mute)]'
                        }`}
                      >
                        <span>🚀</span>
                        <span>Start Count</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* DIALOG 1: QR Scanner & Security Validation Dialog */}
      {isScanModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="card p-6 max-w-lg w-full space-y-4 border border-[var(--line)] shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <span>📷</span>
                  <span>Physical QR Code Scanner</span>
                </h3>
                <p className="text-xs text-[var(--mute)] mt-0.5">
                  Verify unit by scanning its printed Equipment Fixed Asset QR label.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScanModalOpen(false)}
                className="text-[var(--mute)] hover:text-[var(--ink)] text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {targetAsset && (
              <div className="p-3 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-xs space-y-1">
                <div className="text-[var(--mute)]">Target Unit to Verify:</div>
                <div className="font-bold text-[var(--ink)] flex items-center gap-2">
                  <span className="font-mono text-sm">{targetAsset.assetCode}</span>
                  <span>— {targetAsset.currentDescription || targetAsset.name}</span>
                </div>
                <div className="text-[11px] text-[var(--mute)]">
                  Expected Dept: {targetAsset.currentDepartment || targetAsset.department} · Plant: {targetAsset.plant}
                </div>
              </div>
            )}

            {/* Live Camera Viewfinder & QR Scanner */}
            <div className="relative w-full h-56 rounded-xl bg-black overflow-hidden border-2 border-emerald-500/40 p-0 shadow-inner flex items-center justify-center">
              {/* Hidden Canvas for Frame Decoding */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  cameraActive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Live Scanning Reticle Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-3 z-10">
                  {/* Top Bar: Live Status and Switch Camera */}
                  <div className="w-full flex items-center justify-between pointer-events-auto">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-xs text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Camera Live • Scanning
                    </span>
                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      className="px-2.5 py-1 rounded bg-black/75 hover:bg-black/90 text-white text-[11px] font-medium border border-white/20 transition cursor-pointer flex items-center gap-1"
                      title="Switch between rear and front camera"
                    >
                      <span>🔄</span>
                      <span>{facingMode === 'environment' ? 'Rear' : 'Front'} Camera</span>
                    </button>
                  </div>

                  {/* Target Alignment Reticle */}
                  <div className="relative w-36 h-36 border-2 border-emerald-400/90 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.35)] flex items-center justify-center overflow-hidden">
                    {/* Reticle Corner Marks */}
                    <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-300" />
                    <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-300" />
                    <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-300" />
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-300" />

                    {/* Sweeping Laser Line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg animate-pulse" />
                  </div>

                  {/* Bottom Guide */}
                  <div className="px-2.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] text-white/80 font-mono">
                    Point camera at Asset QR code label
                  </div>
                </div>
              )}

              {/* Instant Detection Flash Banner */}
              {scannedFeedback && (
                <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-2xs flex items-center justify-center z-20 animate-in fade-in">
                  <div className="bg-black/90 text-emerald-300 px-4 py-2 rounded-lg border border-emerald-500/50 text-xs font-mono font-bold flex items-center gap-2 shadow-xl">
                    <span className="text-base">✓</span>
                    <span>Detected: {scannedFeedback}</span>
                  </div>
                </div>
              )}

              {/* Camera Inactive / Permission Prompt / Error Fallback */}
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-zinc-950/95 space-y-2 z-10">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-xl text-zinc-400">
                    📷
                  </div>
                  <div className="text-xs font-semibold text-white/90">
                    {cameraError ? 'Camera Permission Required' : 'Initializing Camera...'}
                  </div>
                  <p className="text-[11px] text-white/60 max-w-xs leading-relaxed">
                    {cameraError ||
                      'Please allow camera access when prompted by your browser to scan physical equipment QR labels.'}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs transition"
                    >
                      📷 Retry Camera
                    </button>
                    {cameraError && (
                      <button
                        type="button"
                        onClick={toggleFacingMode}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer shadow-xs transition"
                      >
                        🔄 Switch Device
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Input for Manual Code / Hardware Barcode Scanner Gun */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Scan Result / Barcode Gun Input:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scannedCodeInput}
                  onChange={e => setScannedCodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleValidateQr(scannedCodeInput)}
                  placeholder="Scan or enter asset code (e.g. 2004218)..."
                  className="flex-1 p-2.5 text-xs font-mono rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none focus:border-[var(--acc)]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleValidateQr(scannedCodeInput)}
                  disabled={isValidatingScan}
                  className="btn p text-xs px-4 py-2 font-semibold cursor-pointer shadow-sm"
                >
                  {isValidatingScan ? 'Validating...' : 'Validate QR'}
                </button>
              </div>
            </div>

            {/* Quick Testing Shortcuts */}
            <div className="pt-2 border-t border-[var(--line)] text-xs space-y-1.5">
              <div className="text-[var(--mute)] text-[11px] font-semibold">Test Simulator:</div>
              <div className="flex flex-wrap gap-2">
                {targetAsset && (
                  <button
                    type="button"
                    onClick={() => {
                      setScannedCodeInput(targetAsset.assetCode)
                      handleValidateQr(targetAsset.assetCode)
                    }}
                    className="text-[11px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20"
                  >
                    ✓ Scan Matching QR ({targetAsset.assetCode})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const mismatchCode = 'SMT-CROSS-DEPT-999'
                    setScannedCodeInput(mismatchCode)
                    handleValidateQr(mismatchCode)
                  }}
                  className="text-[11px] px-2.5 py-1 rounded bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30 cursor-pointer hover:bg-red-500/20"
                >
                  ⛔ Test Wrong Dept / Invalid QR
                </button>
              </div>
            </div>

            {/* Error Display if Validation Failed */}
            {scanValidationStatus && !scanValidationStatus.valid && (
              <div className="p-3.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-700 dark:text-red-300">
                  <span>⛔</span>
                  <span>Validation Denied</span>
                </div>
                <div>{scanValidationStatus.error}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIALOG 2: Asset Details Verification Modal (Choice: Correct vs Incorrect) */}
      {isVerifyModalOpen && verifyingAsset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 border border-[var(--line)] shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    ✓ QR Verified
                  </span>
                  <h3 className="text-base font-bold text-[var(--ink)]">
                    Asset Details Verification
                  </h3>
                </div>
                <p className="text-xs text-[var(--mute)] mt-0.5">
                  Confirm whether physical asset matches system ledger records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsVerifyModalOpen(false)
                  setVerifyingAsset(null)
                  setIsEditingVariance(false)
                }}
                className="text-[var(--mute)] hover:text-[var(--ink)] text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode 1: Display complete asset details with 2 choices */}
            {!isEditingVariance ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[var(--surf2)] p-4 rounded-xl border border-[var(--line)]">
                  <div>
                    <span className="text-[var(--mute)] block">Asset Code (资产编号):</span>
                    <strong className="text-sm font-mono text-[var(--ink)]">{verifyingAsset.assetCode}</strong>
                  </div>
                  <div>
                    <span className="text-[var(--mute)] block">Serial Number / Model:</span>
                    <strong className="font-mono text-[var(--ink)]">{verifyingAsset.serialNumber || 'SN-UNAVAIL'}</strong>
                  </div>
                  <div>
                    <span className="text-[var(--mute)] block">Asset Name / Description:</span>
                    <strong className="text-[var(--ink)]">{verifyingAsset.currentDescription || verifyingAsset.name}</strong>
                  </div>
                  <div>
                    <span className="text-[var(--mute)] block">Category:</span>
                    <span className="text-[var(--ink)]">{verifyingAsset.currentCategory || verifyingAsset.category}</span>
                  </div>
                  <div>
                    <span className="text-[var(--mute)] block">Department:</span>
                    <span className="text-[var(--ink)]">{verifyingAsset.currentDepartment || verifyingAsset.department}</span>
                  </div>
                  <div>
                    <span className="text-[var(--mute)] block">Custodian / In-Charge:</span>
                    <span className="text-[var(--ink)]">{verifyingAsset.whoInCharge || verifyingAsset.inChargeName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--mute)] block">Book Location:</span>
                    <span className="text-[var(--ink)]">
                      {verifyingAsset.currentLocation || verifyingAsset.location || `${verifyingAsset.building || 'C39'} ${verifyingAsset.floor || '1F'}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--mute)] block">Operational Condition:</span>
                    <span className="text-[var(--ink)]">{verifyingAsset.assetCondition || 'Operational'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-[var(--mute)]">
                  💡 <strong>Verification Requirement:</strong> Compare the physical equipment label and location with the ledger above. Choose <strong>Information Correct</strong> if everything matches, or <strong>Information Incorrect</strong> to record field discrepancies.
                </div>

                {/* The Two Choice Buttons */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleMarkCorrect}
                    className="btn py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <span>✅</span>
                    <span>Information Correct</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchToVariance}
                    className="btn py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <span>⚠️</span>
                    <span>Information Incorrect</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Mode 2: Variance Editing of Permitted Fields Only */
              <div className="space-y-4">
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
                  <strong>Variance Record Mode:</strong> Restricted identifiers (Asset Code, Serial Number, Company) are locked and cannot be edited. Update only permitted physical fields below.
                </div>

                {/* Restricted Fields (Locked) */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surf2)] rounded-lg text-xs opacity-80 border border-[var(--line)]">
                  <div>
                    <span className="text-[var(--mute)] block">🔒 Asset Code (Locked):</span>
                    <span className="font-mono font-bold text-[var(--ink)]">{verifyingAsset.assetCode}</span>
                  </div>
                  <div>
                    <span className="text-[var(--mute)] block">🔒 Serial Number (Locked):</span>
                    <span className="font-mono font-bold text-[var(--ink)]">{verifyingAsset.serialNumber || 'SN-UNAVAIL'}</span>
                  </div>
                </div>

                {/* Permitted Editable Fields */}
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-[var(--ink)] block mb-1">
                        Actual Location / Bay:
                      </label>
                      <input
                        type="text"
                        value={varianceLocation}
                        onChange={e => setVarianceLocation(e.target.value)}
                        placeholder="e.g. Bay 14 Desk 4A..."
                        className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none focus:border-[var(--acc)]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[var(--ink)] block mb-1">
                        Floor / Placement Area:
                      </label>
                      <input
                        type="text"
                        value={varianceFloor}
                        onChange={e => setVarianceFloor(e.target.value)}
                        placeholder="e.g. 2nd Floor (C39-2F)..."
                        className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none focus:border-[var(--acc)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-[var(--ink)] block mb-1">
                        Operational Condition:
                      </label>
                      <select
                        value={varianceCondition}
                        onChange={e => setVarianceCondition(e.target.value)}
                        className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none"
                      >
                        <option value="Operational - Excellent">Operational - Excellent</option>
                        <option value="Operational - Good">Operational - Good</option>
                        <option value="Operational - Fair">Operational - Fair</option>
                        <option value="Needs Maintenance">Needs Maintenance</option>
                        <option value="Damaged / Not Functioning">Damaged / Not Functioning</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-[var(--ink)] block mb-1">
                        Variance Classification:
                      </label>
                      <select
                        value={varianceType}
                        onChange={e => setVarianceType(e.target.value as ScanStatus)}
                        className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none"
                      >
                        <option value="Shortage">⚠️ Shortage (Missing Parts/Discrepancy)</option>
                        <option value="Misplaced">📍 Misplaced / Relocated</option>
                        <option value="Damaged">🛠️ Damaged / Degraded Condition</option>
                        <option value="Overage">📦 Overage (Extra Accessories)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--ink)] block mb-1">
                      Variance Remarks * (Required):
                    </label>
                    <textarea
                      rows={3}
                      value={varianceRemarks}
                      onChange={e => setVarianceRemarks(e.target.value)}
                      placeholder="Explain what physical discrepancy was observed (e.g. unit relocated to bay 12 without transfer form)..."
                      className="w-full p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none focus:border-[var(--acc)]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--ink)] block mb-1">
                      Attach Physical Condition Photo (Optional):
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) setVariancePhoto(file.name)
                      }}
                      className="text-xs"
                    />
                    {variancePhoto && (
                      <span className="text-[11px] text-emerald-600 block mt-1">
                        📎 Attached: {variancePhoto}
                      </span>
                    )}
                  </div>
                </div>

                {/* Variance Actions */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => setIsEditingVariance(false)}
                    className="btn text-xs px-4 py-2 cursor-pointer"
                  >
                    Back to Details
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveVariance}
                    className="btn py-2 px-5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm"
                  >
                    Save Variance & Update
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIALOG 3: Variance & Audit Summary Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="card p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-4 border border-[var(--line)] shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <span>📊</span>
                  <span>Stock Count Variance & Reconciliation Report</span>
                </h3>
                <p className="text-xs text-[var(--mute)] mt-0.5">
                  Audit report for {activeTask?.title || 'Stock Count Session'} ({activeTask?.id})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn text-xs px-3 py-1.5 cursor-pointer flex items-center gap-1"
                >
                  <span>🖨️</span>
                  <span>Print Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="text-[var(--mute)] hover:text-[var(--ink)] text-lg cursor-pointer px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--surf2)] text-[var(--mute)] font-semibold border-b border-[var(--line)]">
                    <th className="p-2.5">Asset Code</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Variance Details</th>
                    <th className="p-2.5">Verified By</th>
                    <th className="p-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {Object.values(taskItemRecords).map(rec => (
                    <tr key={rec.assetCode} className="hover:bg-[var(--surf2)]/50">
                      <td className="p-2.5 font-mono font-bold">{rec.assetCode}</td>
                      <td className="p-2.5">{rec.assetName}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.status === 'Normal'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : rec.status === 'Pending'
                                ? 'bg-gray-500/10 text-gray-600'
                                : 'bg-red-500/10 text-red-600'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-[var(--mute)]">
                        {rec.varianceRemarks || 'No discrepancies (Normal physical match)'}
                      </td>
                      <td className="p-2.5 text-[var(--mute)]">{rec.verifiedBy || 'Pending'}</td>
                      <td className="p-2.5 text-[var(--mute)]">{rec.verifiedAt ? formatDateIN(rec.verifiedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[var(--line)]">
              <span className="text-xs text-[var(--mute)]">
                Recorded into Enterprise SOC 2 Immutable Audit Trail.
              </span>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="btn p text-xs px-4 py-2 cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IndiaStockCountView
