import * as React from 'react'
import { meridianPages } from '@/data/meridianData'
import { AddAssetPanel } from '@/components/AddAssetPanel'
import { AssetLibraryView } from '@/components/AssetLibraryView'
import { AuditLogView } from '@/components/AuditLogView'
import { AssetCodeWorkflow } from '@/components/AssetCodeWorkflow'
import { LoginPage } from '@/components/LoginPage'
import {
  logAuditEvent,
  getCurrentUserProfile,
  setCurrentUserProfile,
  type UserProfile,
} from '@/lib/deviceTracker'
import type { Asset } from '@/types/asset'
import {
  isAssetTaskCompleted,
  MAJOR_ASSET_CATEGORIES,
  MAJOR_ASSET_CATEGORIES_CONFIG,
  resolveMajorAssetCategory,
  type MajorAssetCategory,
} from '@/types/asset'
import type { Language } from '@/lib/indiaLocale'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { exportAssetsToExcel } from '@/lib/excelExport'
import { isPadgetCompany } from '@/assets/companyLogos'
import {
  saveAssetsToStorage,
  loadAssetsFromStorage,
  fetchBackendAssets,
  fetchBackendAssetsSummary,
  fetchBackendUpdatedAssets,
  pushAssetsToBackend,
  purgeBackendAssets,
} from '@/lib/assetStorage'
import { DigitalTwinFacility3D } from '@/components/DigitalTwinFacility3D'
import { ExecutiveBentoGrid3D } from '@/components/ExecutiveBentoGrid3D'
import { initialAssets } from '@/data/mockAssets'
import { masterMappingService } from '@/lib/masterMappingService'
import {
  getAssetPrintStatus,
  getPrintStatusBadgeProps,
  getAssetPrintRecord,
  getLatestReprintRequest,
  createReprintRequest,
  getReprintRequests,
  syncBackendReprintRequests,
  approveReprintRequest,
  rejectReprintRequest,
  REPRINT_REASONS,
  type ReprintReason,
  type ReprintRequest,
} from '@/lib/labelReprintService'
import {
  getPasswordResetRequests,
  syncBackendPasswordResetRequests,
  resolvePasswordResetRequest,
  rejectPasswordResetRequest,
  type PasswordResetRequest,
} from '@/lib/passwordResetService'

// Lazy-load heavy views to keep bundle fast
const IndiaMaintenanceView = React.lazy(() => import('@/components/IndiaMaintenanceView'))
const IndiaStockCountView = React.lazy(() => import('@/components/IndiaStockCountView'))
const IndiaDepreciationView = React.lazy(() => import('@/components/IndiaDepreciationView'))
const IndiaDisposalView = React.lazy(() => import('@/components/IndiaDisposalView'))
const IndiaTransferView = React.lazy(() =>
  import('@/components/IndiaTransferView').then((m) => ({ default: m.IndiaTransferView }))
)
const IndiaLabelPrintView = React.lazy(() =>
  import('@/components/IndiaLabelPrintView').then((m) => ({ default: m.IndiaLabelPrintView }))
)
const SuperuserSecurityView = React.lazy(() => import('@/components/SuperuserSecurityView'))
const MasterMappingView = React.lazy(() => import('@/components/MasterMappingView'))
const RBACManagementView = React.lazy(() => import('@/components/RBACManagementView'))

const STORAGE_KEY = 'meridian_assets'

function purgeAllDummyDataStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('meridian_custom_companies')
    localStorage.removeItem('meridian_custom_buildings')
    localStorage.removeItem('meridian_recent_searches')
    localStorage.removeItem('meridian_master_rbac_users_store')
    localStorage.removeItem('meridian_users_cache')
    localStorage.setItem(
      'meridian_rbac_users_v1',
      JSON.stringify([
        {
          userId: 'USR-ADMIN',
          name: 'Uttam Singh',
          email: 'uttam.singh@meridian.com',
          department: 'IT',
          role: 'Admin',
          password: 'AdminPassword2026!',
          isSuperuser: true,
          isActive: true,
          createdBy: 'System Initializer',
          createdAt: new Date().toISOString(),
        },
      ])
    )
    if (window.indexedDB) {
      window.indexedDB.deleteDatabase('meridian_assets_db')
    }
  } catch {}
}

function sanitizeAssetList(assets: Asset[]): Asset[] {
  if (!assets || assets.length === 0) return []

  // Check if storage contains old dummy/corrupted batch (like 500 assets with Sector 63 / 5020 or ast-c39 mock assets)
  const isDummyOrCorruptedBatch = assets.some((a) => {
    if (!a) return false
    const idStr = String(a.id || '')
    const codeStr = String(a.assetCode || a.assetTag || '')
    return (
      idStr.startsWith('ast-c39-') ||
      idStr.startsWith('ast-d198-') ||
      codeStr.includes('Sector 63') ||
      codeStr === '5020' ||
      codeStr === '5030'
    )
  })

  if (isDummyOrCorruptedBatch) {
    purgeAllDummyDataStorage()
    return []
  }

  // Ensure unique string IDs across all real assets
  return assets.map((a, idx) => {
    const idStr = a.id ? String(a.id) : `AST-${a.assetCode || 'REG'}-${idx + 1}`
    return { ...a, id: idStr }
  })
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(() => {
    return sessionStorage.getItem('meridian_auth') === 'true'
  })
  const [activeFactory, setActiveFactory] = React.useState<string>(() => {
    const s = sessionStorage.getItem('meridian_active_factory')
    const l = localStorage.getItem('meridian_remember_factory')
    if (s && s !== 'Noida Plant (SMT Line & Assembly)') return s
    if (l && l !== 'Noida Plant (SMT Line & Assembly)') return l
    return 'IIPL-Sector 63'
  })

  const [currentHash, setCurrentHash] = React.useState<string>(() => {
    const h = window.location.hash.replace('#', '')
    return h &&
      (meridianPages[h] ||
        [
          'tasks',
          'verification',
          'maintenance-india',
          'stockcount',
          'depreciation',
          'disposal',
          'transfer',
          'labels',
          'users',
          'rbac',
          'master-mapping',
          'security',
        ].includes(h))
      ? h
      : 'dashboard'
  })
  const [isMini, setIsMini] = React.useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  })

  // ── India localization: language state ──
  const [lang, setLang] = React.useState<Language>(() => {
    return (localStorage.getItem('meridian_lang') as Language) || 'en'
  })
  const toggleLang = () => {
    setLang((prev) => {
      const next: Language = prev === 'en' ? 'hi' : 'en'
      localStorage.setItem('meridian_lang', next)
      return next
    })
  }

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [workflowAsset, setWorkflowAsset] = React.useState<Asset | null>(null)
  const [dashCompanyFilter, setDashCompanyFilter] = React.useState<'All' | 'IIPL' | 'Padget'>('All')
  const [dashBuildingFilter, setDashBuildingFilter] = React.useState<string>('All')
  const [dashCategoryFilter, setDashCategoryFilter] = React.useState<string>('All')
  const [dashSearchQuery, setDashSearchQuery] = React.useState<string>('')
  const [previewImage, setPreviewImage] = React.useState<{ url: string; title: string; code: string } | null>(null)
  const [qrScannedAsset, setQrScannedAsset] = React.useState<Asset | null>(null)
  const [reprintModalAsset, setReprintModalAsset] = React.useState<Asset | null>(null)
  const [reprintReason, setReprintReason] = React.useState<ReprintReason>('Label Damaged / Scratched')
  const [reprintNotes, setReprintNotes] = React.useState('')
  const [reprintSubmitting, setReprintSubmitting] = React.useState(false)
  const [, setReprintUpdateVersion] = React.useState(0)

  React.useEffect(() => {
    const onReprintUpdate = () => setReprintUpdateVersion((v) => v + 1)
    window.addEventListener('meridian_reprint_updated', onReprintUpdate)
    return () => window.removeEventListener('meridian_reprint_updated', onReprintUpdate)
  }, [])
  const [qrAccessDenied, setQrAccessDenied] = React.useState<{
    assetCode: string
    assetDepartment: string
    userDepartment: string
    userName: string
  } | null>(null)
  const addAssetButtonRef = React.useRef<HTMLButtonElement>(null)
  const [assets, setAssets] = React.useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return sanitizeAssetList(saved ? JSON.parse(saved) : initialAssets)
    } catch {
      return initialAssets
    }
  })
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const [currentUser, setCurrentUser] = React.useState<UserProfile>(() => getCurrentUserProfile())
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false)
  const [tempUserName, setTempUserName] = React.useState(currentUser.userName)
  const [tempUserId, setTempUserId] = React.useState(currentUser.userId)
  const [tempUserRole, setTempUserRole] = React.useState(currentUser.role)
  const [tempUserDepartment, setTempUserDepartment] = React.useState(currentUser.department || 'IT')

  const dynamicGreeting = React.useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  // Check if current user has full administrative oversight
  const isSuperuserOrAdmin = React.useMemo(() => {
    return Boolean(
      currentUser.isSuperuser ||
      currentUser.role === 'Admin' ||
      currentUser.role === 'Administrator' ||
      currentUser.role === 'Super User' ||
      currentUser.userId?.toUpperCase() === 'USR-ADMIN'
    )
  }, [currentUser])

  // Reprint requests and real-time backend synchronization
  const [reprintRequests, setReprintRequests] = React.useState<ReprintRequest[]>(() => getReprintRequests())
  const [isNotificationFlyoutOpen, setIsNotificationFlyoutOpen] = React.useState(false)

  // Password reset requests governance (Super User sets new passwords)
  const [passwordResetRequests, setPasswordResetRequests] = React.useState<PasswordResetRequest[]>(() =>
    getPasswordResetRequests()
  )
  const [selectedResetRequest, setSelectedResetRequest] = React.useState<PasswordResetRequest | null>(null)
  const [newPasswordInput, setNewPasswordInput] = React.useState('')
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false)
  const [isSettingPassword, setIsSettingPassword] = React.useState(false)
  const [activeNotifTab, setActiveNotifTab] = React.useState<'all' | 'passwords' | 'reprints'>('all')

  React.useEffect(() => {
    let isMounted = true
    const handleReprintUpdate = () => {
      if (isMounted) setReprintRequests(getReprintRequests())
    }
    const handleResetUpdate = () => {
      if (isMounted) setPasswordResetRequests(getPasswordResetRequests())
    }

    window.addEventListener('meridian_reprint_updated', handleReprintUpdate)
    window.addEventListener('meridian_password_reset_updated', handleResetUpdate)

    void syncBackendReprintRequests().then((reqs) => {
      if (isMounted && reqs) setReprintRequests(reqs)
    })
    void syncBackendPasswordResetRequests().then((reqs) => {
      if (isMounted && reqs) setPasswordResetRequests(reqs)
    })

    const interval = setInterval(() => {
      void syncBackendReprintRequests().then((reqs) => {
        if (isMounted && reqs) setReprintRequests(reqs)
      })
      void syncBackendPasswordResetRequests().then((reqs) => {
        if (isMounted && reqs) setPasswordResetRequests(reqs)
      })
    }, 5000)

    return () => {
      isMounted = false
      window.removeEventListener('meridian_reprint_updated', handleReprintUpdate)
      window.removeEventListener('meridian_password_reset_updated', handleResetUpdate)
      clearInterval(interval)
    }
  }, [])

  const pendingReprintRequests = React.useMemo(() => {
    return reprintRequests.filter((r) => r.status === 'pending')
  }, [reprintRequests])

  const pendingPasswordResetRequests = React.useMemo(() => {
    return passwordResetRequests.filter((r) => r.status === 'pending')
  }, [passwordResetRequests])

  const pendingReprintCount = pendingReprintRequests.length
  const pendingPasswordResetCount = pendingPasswordResetRequests.length
  const totalPendingNotifications = pendingReprintCount + pendingPasswordResetCount

  // Check if a specific asset can be viewed by the user under department RBAC
  const checkAssetAccess = React.useCallback(
    (targetAsset: Asset, user: UserProfile): boolean => {
      if (
        user.isSuperuser ||
        user.role === 'Admin' ||
        user.role === 'Administrator' ||
        user.userId?.toUpperCase() === 'USR-ADMIN'
      ) {
        return true
      }

      const userDept = (user.department || '').trim().toLowerCase()
      const userId = (user.userId || '').trim().toLowerCase()
      const userName = (user.userName || '').trim().toLowerCase()

      const assetDept = (targetAsset.currentDepartment || targetAsset.department || '').trim().toLowerCase()
      const inChargeId = (targetAsset.inChargeId || '').trim().toLowerCase()
      const inChargeName = (targetAsset.inChargeName || targetAsset.whoInCharge || '').trim().toLowerCase()
      const submitter = (targetAsset.submitter || '').trim().toLowerCase()

      // 1. Matches user's department
      if (userDept && assetDept && (assetDept === userDept || assetDept.includes(userDept) || userDept.includes(assetDept))) {
        return true
      }
      // 2. Matches user's identity
      if (userId && inChargeId === userId) {
        return true
      }
      if (userName && (inChargeName.includes(userName) || submitter.includes(userName))) {
        return true
      }
      return false
    },
    []
  )

  // Scope assets strictly by the active user's department or identity, with graceful fallback to plant assets
  const scopedAssets = React.useMemo(() => {
    if (isSuperuserOrAdmin) {
      return assets
    }
    const userDept = (currentUser.department || '').trim().toLowerCase()
    const userId = (currentUser.userId || '').trim().toLowerCase()
    const userName = (currentUser.userName || '').trim().toLowerCase()

    const isUserProduction =
      userDept.includes('production') ||
      userDept.includes('smt') ||
      userDept.includes('assembly') ||
      userDept.includes('operations') ||
      userDept === 'pd'

    const deptScoped = assets.filter((a) => {
      const rawDept = (a.currentDepartment || a.department || '').trim()
      const assetDept = rawDept.toLowerCase()
      const inChargeId = (a.inChargeId || '').trim().toLowerCase()
      const inChargeName = (a.inChargeName || a.whoInCharge || '').trim().toLowerCase()
      const submitter = (a.submitter || '').trim().toLowerCase()

      // Production & SMT matching: matches Production, SMT, PD, Assembly, Operations, or unassigned/open tasks
      if (isUserProduction) {
        if (
          assetDept.includes('production') ||
          assetDept.includes('smt') ||
          assetDept.includes('assembly') ||
          assetDept.includes('operations') ||
          assetDept === 'pd' ||
          !rawDept ||
          rawDept === 'Unassigned' ||
          rawDept.toLowerCase().includes('smt') ||
          !isNaN(Number(rawDept)) ||
          rawDept === '5030'
        ) {
          return true
        }
      }

      // 1. Matches user's department
      if (userDept && assetDept && (assetDept === userDept || assetDept.includes(userDept) || userDept.includes(assetDept))) {
        return true
      }
      // 2. Matches user's identity (in-charge ID or name or submitter)
      if (userId && inChargeId === userId) {
        return true
      }
      if (userName && (inChargeName.includes(userName) || submitter.includes(userName))) {
        return true
      }
      return false
    })

    return deptScoped.length > 0 ? deptScoped : assets
  }, [assets, isSuperuserOrAdmin, currentUser.department, currentUser.userId, currentUser.userName])

  const filteredDashboardAssets = React.useMemo(() => {
    if (scopedAssets.length === 0) return []
    return scopedAssets.filter((a) => {
      // Exclude pending/incomplete task queue codes that have not yet had their data filled
      if (!isAssetTaskCompleted(a)) {
        return false
      }
      // Category filter: Fixed Assets, Accessories, Tools, Fixtures
      if (dashCategoryFilter !== 'All') {
        const cat = resolveMajorAssetCategory(a.currentCategory || a.category)
        if (cat !== dashCategoryFilter) return false
      }
      // Company filter: IIPL or Padget
      if (dashCompanyFilter !== 'All') {
        const isPadget = isPadgetCompany(a)
        const comp = isPadget ? 'Padget' : 'IIPL'
        if (comp !== dashCompanyFilter) return false
      }
      // Building filter: C39, D197, D198, D199
      if (dashBuildingFilter !== 'All') {
        const bldg = a.building || 'C39'
        if (bldg !== dashBuildingFilter) return false
      }
      // Search query
      if (dashSearchQuery.trim()) {
        const q = dashSearchQuery.toLowerCase()
        const text = [
          a.assetCode,
          a.name,
          a.currentDescription,
          a.company,
          a.building,
          a.floor,
          a.currentDepartment,
          a.department,
          a.inChargeId,
          a.inChargeName,
          a.assignedTo,
          a.submitter,
          a.serialNumber,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [scopedAssets, dashCompanyFilter, dashBuildingFilter, dashCategoryFilter, dashSearchQuery])

  const userInitials = React.useMemo(() => {
    return (
      currentUser.userName
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'ME'
    )
  }, [currentUser.userName])

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempUserName.trim()) {
      toast.error('User name cannot be empty')
      return
    }
    const updated: UserProfile = {
      userName: tempUserName.trim(),
      userId: tempUserId.trim() || 'USR-101',
      role: tempUserRole.trim() || 'Employee',
      department: tempUserDepartment,
      isSuperuser: tempUserRole === 'Admin' || tempUserId.toUpperCase() === 'USR-ADMIN',
    }
    setCurrentUserProfile(updated)
    setCurrentUser(updated)
    setIsProfileModalOpen(false)
    logAuditEvent('LOGIN', { authMethod: 'Profile Switch', user: updated })
    toast.success(`Active session switched to ${updated.userName} (${updated.role})`)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('meridian_auth')
    sessionStorage.removeItem('meridian_offline_mode')
    sessionStorage.removeItem('meridian_active_factory')
    logAuditEvent('LOGOUT', { user: currentUser }, currentUser.userId)
    setIsAuthenticated(false)
    toast.info('Logged out from workshop terminal')
  }

  // Asynchronous large-capacity persistence (IndexedDB for 100k+ assets, localStorage for startup cache)
  React.useEffect(() => {
    void saveAssetsToStorage(assets)
  }, [assets])

  // Hydrate full dataset from IndexedDB and sync with central Django backend
  React.useEffect(() => {
    let isMounted = true
    let lastKnownSummary = { count: 0, completedCount: -1, lastUpdated: '' }

    const syncWithBackendAndLocal = async () => {
      try {
        // 1. First load local IndexedDB cache for instant display
        const localStored = await loadAssetsFromStorage()
        if (isMounted && localStored && localStored.length > 0) {
          setAssets((prev) => {
            if (localStored.length > prev.length) {
              return sanitizeAssetList(localStored)
            }
            return prev
          })
        }

        // 2. Fetch master assets from central backend SQLite database with progressive chunked hydration
        const backendAssets = await fetchBackendAssets((chunk) => {
          if (!isMounted) return
          setAssets((prev) => {
            const existingMap = new Map(prev.map((a) => [String(a.assetCode || a.assetTag || a.id).toLowerCase(), a]))
            for (const ba of chunk) {
              const key = String(ba.assetCode || ba.assetTag || ba.id).toLowerCase()
              existingMap.set(key, ba)
            }
            return sanitizeAssetList(Array.from(existingMap.values()))
          })
        })
        if (!isMounted) return

        if (backendAssets && backendAssets.length > 0) {
          setAssets((prev) => {
            // Deduplicate and merge backend assets
            const existingMap = new Map(prev.map((a) => [String(a.assetCode || a.assetTag || a.id).toLowerCase(), a]))
            let changesFound = false
            for (const ba of backendAssets) {
              const key = String(ba.assetCode || ba.assetTag || ba.id).toLowerCase()
              const prevItem = existingMap.get(key)
              if (!prevItem || prevItem.status !== ba.status || prevItem.whoInCharge !== ba.whoInCharge || prevItem.currentDepartment !== ba.currentDepartment) {
                changesFound = true
              }
              existingMap.set(key, ba)
            }
            const merged = Array.from(existingMap.values())
            if (changesFound || merged.length !== prev.length || backendAssets.length > prev.length) {
              void saveAssetsToStorage(merged)
              return sanitizeAssetList(merged)
            }
            return prev
          })

          // Update initial known summary
          lastKnownSummary = {
            count: backendAssets.length,
            completedCount: backendAssets.filter((a) => a.status === 'Completed' || a.status === 'Active').length,
            lastUpdated: backendAssets[0]?.updatedAt || '',
          }

          // If local client has more assets than backend (e.g. freshly imported locally), sync difference to cloud
          if (localStored && localStored.length > backendAssets.length) {
            void pushAssetsToBackend(localStored, currentUser)
          }
        } else if (localStored && localStored.length > 0) {
          // Backend is empty, push local assets to backend so every terminal sees them
          void pushAssetsToBackend(localStored, currentUser)
        }
      } catch (err) {
        console.warn('Initial asset synchronization error:', err)
      }
    }

    void syncWithBackendAndLocal()

    // 3. Periodic background sync: lightweight ping every 5 seconds (~100 bytes)
    // Only downloads updated data if total count, completed count, or last updated timestamp changes
    const performPeriodicSync = async () => {
      try {
        const summary = await fetchBackendAssetsSummary()
        if (!isMounted || !summary) return

        const needsSync =
          lastKnownSummary.completedCount === -1 ||
          summary.count !== lastKnownSummary.count ||
          summary.completedCount !== lastKnownSummary.completedCount ||
          (Boolean(summary.lastUpdated) && summary.lastUpdated !== lastKnownSummary.lastUpdated)

        if (needsSync) {
          const prevTimestamp = lastKnownSummary.lastUpdated
          lastKnownSummary = summary

          // Fetch only updated assets if delta timestamp exists; otherwise fetch full
          const updatedAssets = prevTimestamp
            ? await fetchBackendUpdatedAssets(prevTimestamp)
            : []

          const assetsToApply = updatedAssets.length > 0 ? updatedAssets : await fetchBackendAssets()
          if (!isMounted || !assetsToApply || assetsToApply.length === 0) return

          setAssets((current) => {
            const existingMap = new Map(current.map((a) => [String(a.assetCode || a.assetTag || a.id).toLowerCase(), a]))
            for (const ba of assetsToApply) {
              existingMap.set(String(ba.assetCode || ba.assetTag || ba.id).toLowerCase(), ba)
            }
            const merged = Array.from(existingMap.values())
            void saveAssetsToStorage(merged)
            return sanitizeAssetList(merged)
          })
        }
      } catch {
        // Silent ping error
      }
    }

    const syncInterval = setInterval(() => {
      void performPeriodicSync()
    }, 5000)

    return () => {
      isMounted = false
      clearInterval(syncInterval)
    }
  }, [])

  // Cross-tab instantaneous synchronization via BroadcastChannel
  React.useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel('meridian_asset_sync')
      channel.onmessage = (event) => {
        if (event.data?.type === 'ASSET_SAVED' && event.data?.asset) {
          const updatedAsset = event.data.asset as Asset
          setAssets((prev) => {
            const key = String(updatedAsset.assetCode || updatedAsset.assetTag || updatedAsset.id).toLowerCase()
            const updated = prev.map((a) => {
              if (String(a.assetCode || a.assetTag || a.id).toLowerCase() === key) {
                return updatedAsset
              }
              return a
            })
            void saveAssetsToStorage(updated)
            return sanitizeAssetList(updated)
          })
        }
      }
    } catch {}

    return () => {
      try {
        channel?.close()
      } catch {}
    }
  }, [])

  // Unique ID guarantee hook
  React.useEffect(() => {
    setAssets((prev) => {
      if (!prev || prev.length === 0) return prev
      const sanitized = sanitizeAssetList(prev)
      const seenIds = new Set<string>()
      let hasDuplicateIds = false
      for (const a of sanitized) {
        if (seenIds.has(a.id)) {
          hasDuplicateIds = true
          break
        }
        seenIds.add(a.id)
      }

      if (hasDuplicateIds) {
        return sanitized.map((a, idx) => ({
          ...a,
          id: `${a.id}-${idx + 1}`,
        }))
      }

      return sanitized
    })
  }, [])

  // Instant QR Deep-Link Scanner: Opens asset details or enforces Department RBAC restriction
  React.useEffect(() => {
    // CRITICAL SECURITY: If user is not authenticated, DO NOT process or expose deep-link asset data!
    if (!isAuthenticated) {
      return
    }

    const checkDeepLink = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search)
        const fromParam = searchParams.get('asset') || searchParams.get('code')
        let targetCode = fromParam || ''
        if (!targetCode && window.location.hash) {
          const h = window.location.hash
          const match = h.match(/[?&](?:asset|code)=([^&]+)/)
          if (match) targetCode = decodeURIComponent(match[1])
        }

        if (targetCode) {
          const match = assets.find(
            (a) =>
              a.assetCode.toLowerCase() === targetCode.toLowerCase() ||
              (a.assetTag && a.assetTag.toLowerCase() === targetCode.toLowerCase())
          )
          if (match) {
            // Check if active authenticated user has department permission for this asset
            if (checkAssetAccess(match, currentUser)) {
              setQrAccessDenied(null)
              setQrScannedAsset(match)
              logAuditEvent(
                'QR_VERIFY_SCAN',
                {
                  assetCode: match.assetCode,
                  department: match.currentDepartment || match.department,
                  userDepartment: currentUser.department,
                  userId: currentUser.userId,
                  origin: window.location.href,
                },
                match.assetCode
              )
              toast.success(`Scanned Asset Verified: ${match.name || match.assetCode}`)
            } else {
              // Block cross-department data exposure! User is logged in, but not authorized for this department's data
              setQrScannedAsset(null)
              setQrAccessDenied({
                assetCode: match.assetCode,
                assetDepartment: match.currentDepartment || match.department || 'Restricted Department',
                userDepartment: currentUser.department || 'General',
                userName: currentUser.userName,
              })
              logAuditEvent(
                'CROSS_DEPARTMENT_SCAN_DENIED',
                {
                  assetCode: match.assetCode,
                  assetDepartment: match.currentDepartment || match.department,
                  userDepartment: currentUser.department,
                  userId: currentUser.userId,
                  userName: currentUser.userName,
                  reason: 'User not authorized for this asset department',
                  origin: window.location.href,
                },
                match.assetCode
              )
              toast.error(
                `Access Denied: Asset ${match.assetCode} belongs to ${match.currentDepartment || match.department || 'another department'}. You cannot view this product.`
              )
            }
          } else {
            // Reconstruct asset from scanned QR query parameters if available
            const urlName = searchParams.get('name')
            const urlModel = searchParams.get('model')
            const urlDept = searchParams.get('dept')
            const urlCustodian = searchParams.get('custodian')
            const urlUser = searchParams.get('user')
            const urlLoc = searchParams.get('loc')
            const urlCo = searchParams.get('co')
            const urlSn = searchParams.get('sn')

            if (urlName || urlDept || urlCustodian || urlLoc || urlModel) {
              const scannedAsset: Asset = {
                id: `scanned-${targetCode}`,
                assetCode: targetCode,
                assetTag: targetCode,
                name: urlName || targetCode,
                currentDescription: urlName || targetCode,
                model: urlModel || undefined,
                serialNumber: urlSn || 'SN-VERIFIED',
                category: 'Equipment',
                currentCategory: 'Equipment',
                department: urlDept || 'Production',
                currentDepartment: urlDept || 'Production',
                whoInCharge: urlCustodian || 'Assigned Custodian',
                inChargeName: urlCustodian || 'Assigned Custodian',
                assignedTo: urlCustodian || 'Assigned Custodian',
                submitter: urlUser || '',
                building: urlLoc?.split('-')[0] || 'C39',
                floor: urlLoc?.split('-')[1] || '1F',
                location: urlLoc || 'C39-1F',
                currentLocation: urlLoc || 'C39-1F',
                plant: `${urlCo || 'ismartu'} Facility`,
                company: (urlCo as any) || 'ismartu',
                status: 'Completed',
                assetCondition: 'Operational',
                purchaseDate: new Date().toISOString().slice(0, 10),
                date: new Date().toISOString().slice(0, 10),
                purchaseCost: 0,
                currentValue: 0,
              }
              if (checkAssetAccess(scannedAsset, currentUser)) {
                setQrAccessDenied(null)
                setQrScannedAsset(scannedAsset)
                toast.success(`Scanned Asset Verified: ${scannedAsset.name} (#${scannedAsset.assetCode})`)
              } else {
                setQrScannedAsset(null)
                setQrAccessDenied({
                  assetCode: scannedAsset.assetCode,
                  assetDepartment: scannedAsset.currentDepartment || scannedAsset.department,
                  userDepartment: currentUser.department || 'General',
                  userName: currentUser.userName,
                })
              }
            } else {
              toast.error(`Asset not found for scanned code: ${targetCode}`)
            }
          }
        }
      } catch {}
    }

    checkDeepLink()
    window.addEventListener('hashchange', checkDeepLink)
    window.addEventListener('popstate', checkDeepLink)
    return () => {
      window.removeEventListener('hashchange', checkDeepLink)
      window.removeEventListener('popstate', checkDeepLink)
    }
  }, [isAuthenticated, assets, currentUser, checkAssetAccess])

  const handleClearAllAssets = () => {
    if (assets.length === 0) return
    const count = assets.length
    setAssets([])
    void purgeBackendAssets(currentUser)
    logAuditEvent(
      'ASSET_DELETE',
      {
        deletedItemType: 'Bulk Purge',
        count,
        deletionTimestamp: new Date().toISOString(),
        deletionReason: 'User initiated clear all assets',
      },
      'ALL-ASSETS'
    )
    toast.success('All assets removed from local ledger')
  }

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setIsDrawerOpen(!isDrawerOpen)
    } else {
      setIsMini(!isMini)
    }
  }

  const [collapsedNavSections, setCollapsedNavSections] = React.useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('meridian_sidebar_collapsed_sections')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const toggleNavSection = (sectionKey: string) => {
    setCollapsedNavSections((prev) => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] }
      try {
        localStorage.setItem('meridian_sidebar_collapsed_sections', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    logAuditEvent('THEME_TOGGLE', { theme: next }, 'SYSTEM')
  }

  // Sync hash routing & enforce Super User protection
  React.useEffect(() => {
    const superuserOnlyRoutes = ['audit', 'administration', 'security', 'master-mapping', 'rbac', 'users']

    const onHashChange = () => {
      const h = window.location.hash.replace('#', '')
      if (!isSuperuserOrAdmin && superuserOnlyRoutes.includes(h)) {
        toast.error('Access Restricted: System Governance & Administration are restricted to Super Users.')
        setCurrentHash('dashboard')
        window.location.hash = '#dashboard'
        return
      }
      if (
        h &&
        (meridianPages[h] ||
          [
            'tasks',
            'verification',
            'maintenance-india',
            'stockcount',
            'depreciation',
            'disposal',
            'transfer',
            'labels',
            'users',
            'rbac',
            'master-mapping',
            'security',
          ].includes(h))
      ) {
        setCurrentHash(h)
      } else if (!h) {
        setCurrentHash('dashboard')
      }
      const mainEl = document.querySelector('main')
      if (mainEl) mainEl.scrollTop = 0
      window.scrollTo(0, 0)
    }

    // Guard on load or when user privileges change
    const initialH = window.location.hash.replace('#', '')
    if (!isSuperuserOrAdmin && superuserOnlyRoutes.includes(initialH)) {
      setCurrentHash('dashboard')
      window.location.hash = '#dashboard'
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [isSuperuserOrAdmin])

  // Always reset scroll to top on hash view transition or user account switch
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo(0, 0)
    const mainEl = document.querySelector('main')
    if (mainEl) {
      if (typeof mainEl.scrollTo === 'function') {
        mainEl.scrollTo(0, 0)
      } else {
        mainEl.scrollTop = 0
      }
    }
  }, [currentHash, currentUser.userId])

  // Sync RBAC directory between local store and backend SQLite
  React.useEffect(() => {
    masterMappingService.syncBackendUsersToLocal().catch(() => {})
  }, [])

  const handleNavClick = (key: string, e: React.MouseEvent) => {
    e.preventDefault()
    const superuserOnlyRoutes = ['audit', 'administration', 'security', 'master-mapping', 'rbac', 'users']
    if (!isSuperuserOrAdmin && superuserOnlyRoutes.includes(key)) {
      toast.error('Access Restricted: System Governance & Administration are restricted to Super Users.')
      return
    }
    window.location.hash = `#${key}`
    setCurrentHash(key)
    setIsDrawerOpen(false)
    window.scrollTo(0, 0)
    const mainEl = document.querySelector('main')
    if (mainEl) {
      if (typeof mainEl.scrollTo === 'function') {
        mainEl.scrollTo(0, 0)
      } else {
        mainEl.scrollTop = 0
      }
    }
  }

  const handleSaveAsset = (newAsset: Asset) => {
    // Instantaneous cross-tab notification
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('meridian_asset_sync')
        bc.postMessage({ type: 'ASSET_SAVED', asset: newAsset })
        bc.close()
      }
    } catch {}

    if (workflowAsset) {
      let updatedCount = 0
      setAssets((prev) =>
        prev.map((asset) => {
          // Strictly match and update ONLY the single target asset opened in workflow
          // Invariant: Assets must be filled strictly ONE AT A TIME
          if (updatedCount === 0 && asset.id === workflowAsset.id) {
            updatedCount++
            return newAsset
          }
          return asset
        })
      )
      logAuditEvent(
        'ASSET_UPDATE',
        {
          assetCode: newAsset.assetCode,
          status: newAsset.status,
          department: newAsset.currentDepartment,
          condition: newAsset.assetCondition,
        },
        newAsset.assetCode
      )
      void pushAssetsToBackend([newAsset], currentUser)
      setWorkflowAsset(null)
      return
    }

    setAssets((prev) => [newAsset, ...prev])
    void pushAssetsToBackend([newAsset], currentUser)
    logAuditEvent(
      'ASSET_CREATE',
      {
        assetCode: newAsset.assetCode,
        name: newAsset.name,
        company: newAsset.company,
        building: newAsset.building,
        floor: newAsset.floor,
        department: newAsset.currentDepartment,
        whoInCharge: newAsset.whoInCharge,
        condition: newAsset.assetCondition,
        date: newAsset.date,
      },
      newAsset.assetCode
    )
  }

  const handleDeleteAsset = (id: string) => {
    const target = assets.find((a) => a.id === id)
    setAssets((prev) => prev.filter((a) => a.id !== id))
    logAuditEvent(
      'ASSET_DELETE',
      {
        deletedItemType: 'Physical Asset',
        assetCode: target?.assetCode || id,
        name: target?.name || target?.currentDescription || 'Asset Unit',
        serialNumber: target?.serialNumber || 'N/A',
        company: target?.company || 'IIPL',
        building: target?.building || 'C39',
        floor: target?.floor || 'Ground Floor',
        department: target?.currentDepartment || target?.department || 'Operations',
        whoInCharge: target?.whoInCharge || target?.assignedTo || 'Operations Staff',
        condition: target?.assetCondition || 'Operational',
        deletionTimestamp: new Date().toISOString(),
        deletionReason: 'User initiated deletion from Asset Registry',
      },
      target?.assetCode || id
    )
    toast.success(`Asset "${target?.assetCode || id}" removed from registry`)
  }

  const handleDisposeAsset = (assetId: string, reason: string, method: string, proceeds: number) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId || a.assetCode === assetId
          ? { ...a, status: 'Disposed', assetCondition: 'Disposed / Scrapped' }
          : a
      )
    )
    logAuditEvent('ASSET_UPDATE', { status: 'Disposed', reason, method, proceeds }, assetId)
    toast.success(`Asset ${assetId} marked Disposed. Documentation locked for tax audit.`)
  }

  const handleImportAssets = (importedAssets: Asset[]) => {
    setAssets((prev) => [...importedAssets, ...prev])
    logAuditEvent(
      'ASSET_IMPORT',
      {
        importedCount: importedAssets.length,
        firstCode: importedAssets[0]?.assetCode,
        lastCode: importedAssets[importedAssets.length - 1]?.assetCode,
      },
      'BATCH-IMPORT'
    )
  }

  const handleImportAssetCodes = (codesOrAssets: (string | Partial<Asset>)[], targetCategory?: string) => {
    const importedAt = new Date().toISOString().slice(0, 10)
    const importedCodes: Asset[] = codesOrAssets.map((item, idx) => {
      const assignedCat = targetCategory || (typeof item !== 'string' ? item.currentCategory || item.category : undefined) || 'Fixed Assets'
      if (typeof item === 'string') {
        const code = item
        const uniqueId = `imported-${code}-${idx + 1}-${Date.now().toString(36)}`
        return {
          id: uniqueId,
          assetCode: code,
          serialNumber: '',
          currentCategory: assignedCat,
          currentDescription: '',
          plant: 'Noida Central Plant',
          building: 'C39',
          company: 'ismartu',
          assetCondition: '',
          date: importedAt,
          name: code,
          assetTag: code,
          category: assignedCat,
          department: '',
          currentDepartment: '',
          status: 'Pending Verification',
          purchaseDate: importedAt,
          purchaseCost: 0,
          currentValue: 0,
          assignedTo: '',
          location: '',
        }
      }

      // If Partial<Asset> from Excel Master Import
      const code = item.assetCode || `AST-${Date.now()}`
      const uniqueId = item.id || `imported-${code}-${idx + 1}-${Date.now().toString(36)}`
      const isPadget = isPadgetCompany(item)
      const resolvedCompany = isPadget ? 'Padget' : (item.company || 'ismartu')
      const resolvedCompanyCode = isPadget ? '9500' : (item.companyCode || (resolvedCompany === 'Padget' ? '9500' : '5020'))
      const resolvedBuilding = item.building || (isPadget ? 'D197' : 'C39')
      const resolvedFloor = item.floor || '1st Floor'
      const resolvedDept = item.department || item.currentDepartment || item.costCenter || ''
      const whoInCharge = item.whoInCharge || (item.inChargeName ? `${item.inChargeId ? item.inChargeId + ' · ' : ''}${item.inChargeName}` : '')
      const finalCategory = targetCategory || item.currentCategory || item.category || 'Fixed Assets'

      return {
        id: uniqueId,
        assetCode: code,
        model: item.model || '',
        serialNumber: item.serialNumber || '',
        currentCategory: finalCategory,
        category: finalCategory,
        assetClass: item.assetClass || finalCategory,
        currentDescription: item.currentDescription || item.name || code,
        name: item.name || item.currentDescription || code,
        company: resolvedCompany,
        companyCode: resolvedCompanyCode,
        plant: item.plant || (isPadget ? 'Padget Electronics Noida' : 'Noida Central Plant'),
        building: resolvedBuilding,
        floor: resolvedFloor,
        location: item.location || (isPadget ? `Padget · ${resolvedBuilding} · ${resolvedFloor}` : `ismartu · ${resolvedBuilding} · ${resolvedFloor}`),
        currentLocation: item.currentLocation || item.location || '',
        costCenter: item.costCenter || '',
        department: resolvedDept,
        currentDepartment: resolvedDept,
        inChargeId: item.inChargeId || '',
        inChargeName: item.inChargeName || '',
        whoInCharge,
        submitter: item.submitter || '',
        submitterId: item.submitterId || '',
        submitterDepartment: item.submitterDepartment || '',
        assetCondition: item.assetCondition || '',
        purchaseDate: item.purchaseDate || importedAt,
        capitalizationDate: item.capitalizationDate || item.purchaseDate || importedAt,
        date: item.date || importedAt,
        purchaseCost: item.purchaseCost ?? 0,
        currentValue: item.currentValue ?? 0,
        assignedTo: item.assignedTo || whoInCharge || '',
        assetTag: item.assetTag || code,
        status: item.status || 'Pending Verification',
        isExcelImported: true,
      }
    })

    setAssets((prev) => {
      const existingCodes = new Set(prev.map((a) => String(a.assetCode || a.assetTag || a.id).toLowerCase()))
      const deduped = importedCodes.filter((a) => !existingCodes.has(String(a.assetCode || a.assetTag || a.id).toLowerCase()))
      if (deduped.length > 0) {
        void pushAssetsToBackend(deduped, currentUser)
      }
      return [...deduped, ...prev]
    })

    logAuditEvent(
      'ASSET_IMPORT',
      {
        importedCount: importedCodes.length,
        firstCode: importedCodes[0]?.assetCode,
        lastCode: importedCodes[importedCodes.length - 1]?.assetCode,
      },
      'ASSET-EXCEL-IMPORT'
    )
  }

  const handleAssignAssetCode = (assetId: string, department: string) => {
    const asset = assets.find((item) => item.id === assetId)
    if (!asset || asset.status !== 'Imported') return
    setAssets((prev) =>
      prev.map((item) =>
        item.id === assetId
          ? { ...item, department, currentDepartment: department, status: 'Pending Verification' }
          : item
      )
    )
    logAuditEvent('ASSET_UPDATE', { status: 'Pending Verification', department }, asset.assetCode)
    toast.success(`${asset.assetCode} assigned to ${department}`)
  }

  const handleRefreshFromBackend = async () => {
    try {
      const backendAssets = await fetchBackendAssets()
      if (backendAssets && backendAssets.length > 0) {
        setAssets((prev) => {
          const existingMap = new Map(prev.map((a) => [String(a.assetCode || a.assetTag || a.id).toLowerCase(), a]))
          for (const ba of backendAssets) {
            existingMap.set(String(ba.assetCode || ba.assetTag || ba.id).toLowerCase(), ba)
          }
          const merged = Array.from(existingMap.values())
          void saveAssetsToStorage(merged)
          return sanitizeAssetList(merged)
        })
        toast.success(`Successfully loaded ${backendAssets.length.toLocaleString()} codes from factory server!`)
      } else {
        toast.info('Factory server currently has 0 codes.')
      }
    } catch {
      toast.error('Could not connect to factory server.')
    }
  }

  const isDashboard = currentHash === 'dashboard'
  const activePage = meridianPages[currentHash]

  // Only completed/filled physical assets count towards active deployed fleet
  const completedAssetsList = React.useMemo(() => {
    return scopedAssets.filter(isAssetTaskCompleted)
  }, [scopedAssets])

  const pendingTaskCount = React.useMemo(() => {
    return assets.filter((a) => !isAssetTaskCompleted(a)).length
  }, [assets])

  const totalAssets = completedAssetsList.length
  const healthyCount = completedAssetsList.filter((a) => a.status === 'Active' || a.status === 'Completed').length
  const maintenanceCount = completedAssetsList.filter((a) => a.status === 'Maintenance').length
  const reservedCount = completedAssetsList.filter((a) => a.status === 'Reserved').length
  const retiredCount = completedAssetsList.filter((a) => a.status === 'Retired').length

  // ────────────────────────────────────────────────────────────
  // RENDER: Login Page if not authenticated
  // ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" richColors closeButton />
        <LoginPage
          lang={lang}
          onToggleLang={toggleLang}
          onLoginSuccess={(user, factory) => {
            setCurrentUser(user)
            setCurrentUserProfile(user)
            setTempUserName(user.userName)
            setTempUserId(user.userId)
            setTempUserRole(user.role)
            setTempUserDepartment(user.department || 'IT')
            setActiveFactory(factory)
            sessionStorage.setItem('meridian_auth', 'true')
            sessionStorage.setItem('meridian_active_factory', factory)
            setIsAuthenticated(true)
          }}
          onEnterOfflineMode={() => {
            const offlineUser: UserProfile = {
              userId: 'OFFLINE-OPERATOR',
              userName: 'Workshop Offline Staff',
              role: 'Employee',
              department: 'Operations',
              isSuperuser: false,
            }
            setCurrentUser(offlineUser)
            setCurrentUserProfile(offlineUser)
            setActiveFactory('Noida Plant (Offline Mode)')
            sessionStorage.setItem('meridian_auth', 'true')
            sessionStorage.setItem('meridian_offline_mode', 'true')
            setIsAuthenticated(true)
            toast.info('Entered Workshop Offline Mode. Barcode scanning and local cached data active.')
          }}
        />
      </>
    )
  }

  // ────────────────────────────────────────────────────────────
  // RENDER: Authenticated Main App Shell
  // ────────────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" richColors closeButton />

      {/* Mobile Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`app ${isMini ? 'mini' : ''} ${isDrawerOpen ? 'drawer-open' : ''}`}
        id="app"
      >
        {/* Collapsible Left Sidebar */}
        <aside>
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-[var(--line)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="mark flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8">
                  <path d="M2 12 8 3l6 9H2Z" />
                </svg>
              </div>
              {!isMini && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm tracking-tight text-[var(--ink)] leading-tight">Meridian</span>
                  <span className="text-[10px] text-[var(--mute)] font-medium leading-none mt-0.5 truncate">
                    Enterprise Plant System
                  </span>
                </div>
              )}
            </div>
            {!isMini && (
              <button
                type="button"
                onClick={handleToggleSidebar}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="w-7 h-7 rounded-lg text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)] flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>

          <nav className="nav" aria-label="Main">
            {/* 1. Dashboard */}
            <a
              className={currentHash === 'dashboard' ? 'on' : ''}
              href="#dashboard"
              onClick={(e) => handleNavClick('dashboard', e)}
              title={isMini ? 'Dashboard' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="9" rx="2" />
                <rect x="14" y="3" width="7" height="5" rx="2" />
                <rect x="14" y="12" width="7" height="9" rx="2" />
                <rect x="3" y="16" width="7" height="5" rx="2" />
              </svg>
              <span>Dashboard</span>
            </a>

            {/* 2. Asset Gallery */}
            <a
              className={currentHash === 'assets' ? 'on' : ''}
              href="#assets"
              onClick={(e) => handleNavClick('assets', e)}
              title={isMini ? 'Asset Gallery' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <span>Asset Gallery</span>
            </a>

            {/* 3. Task Queue */}
            <a
              className={currentHash === 'tasks' || currentHash === 'verification' ? 'on' : ''}
              href="#tasks"
              onClick={(e) => handleNavClick('tasks', e)}
              title={isMini ? 'Task Queue' : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 14l2 2 4-4" />
              </svg>
              <span>Task Queue</span>
              {pendingTaskCount > 0 && (
                <span className="sidebar-hide-mini ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500">
                  {pendingTaskCount.toLocaleString()}
                </span>
              )}
            </a>

            {/* 4. Asset Library */}
            <a
              className={currentHash === 'library' ? 'on' : ''}
              href="#library"
              onClick={(e) => handleNavClick('library', e)}
              title={isMini ? 'Asset Library' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
              </svg>
              <span>Asset Library</span>
            </a>

            {/* 5. QR Label Print */}
            <a
              className={currentHash === 'labels' ? 'on' : ''}
              href="#labels"
              onClick={(e) => handleNavClick('labels', e)}
              title={isMini ? 'QR Label Print' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
                <rect x="6" y="14" width="12" height="8" rx="1" />
              </svg>
              <span>QR Label Print</span>
            </a>

            {/* ── India Factory Operations ── */}
            <div className="nav-section-title">
              <span>🏭 Factory Operations</span>
              {!isMini && (
                <button
                  type="button"
                  onClick={() => toggleNavSection('operations')}
                  className="text-[10px] text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                  title={collapsedNavSections.operations ? 'Expand' : 'Collapse'}
                >
                  {collapsedNavSections.operations ? '▾' : '▴'}
                </button>
              )}
            </div>

            {!collapsedNavSections.operations && (
              <>
                {/* Stock Count (Audit) */}
                <a
                  className={currentHash === 'stockcount' ? 'on' : ''}
                  href="#stockcount"
                  onClick={(e) => handleNavClick('stockcount', e)}
                  title={isMini ? 'Stock Count (Audit)' : undefined}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
                  </svg>
                  <span>Stock Count (Audit)</span>
                </a>

                {/* Asset Transfer */}
                <a
                  className={currentHash === 'transfer' ? 'on' : ''}
                  href="#transfer"
                  onClick={(e) => handleNavClick('transfer', e)}
                  title={isMini ? 'Asset Transfer' : undefined}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="m17 2 4 4-4 4" />
                    <path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" />
                    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                  </svg>
                  <span>Asset Transfer</span>
                </a>

                {/* Scrapping & Disposal */}
                <a
                  className={currentHash === 'disposal' ? 'on' : ''}
                  href="#disposal"
                  onClick={(e) => handleNavClick('disposal', e)}
                  title={isMini ? 'Scrapping & Disposal' : undefined}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Scrapping & Disposal</span>
                </a>
              </>
            )}

            {/* ── SUPERUSER EXCLUSIVE: Governance & Administration ── */}
            {isSuperuserOrAdmin && (
              <>
                <div className="nav-section-title">
                  <span>⚙️ System & Governance</span>
                  {!isMini && (
                    <button
                      type="button"
                      onClick={() => toggleNavSection('system')}
                      className="text-[10px] text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                      title={collapsedNavSections.system ? 'Expand' : 'Collapse'}
                    >
                      {collapsedNavSections.system ? '▾' : '▴'}
                    </button>
                  )}
                </div>

                {!collapsedNavSections.system && (
                  <>
                    {/* Audit & Tracking */}
                    <a
                      className={currentHash === 'audit' ? 'on' : ''}
                      href="#audit"
                      onClick={(e) => handleNavClick('audit', e)}
                      title={isMini ? 'Audit & Tracking' : undefined}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      <span>Audit & Tracking</span>
                      <span className="sidebar-hide-mini ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        SOC-2
                      </span>
                    </a>
                  </>
                )}

                {/* Master Governance */}
                <div className="nav-section-title text-purple-600/90 border-purple-500/20">
                  <span>👑 Master Governance</span>
                  {!isMini && (
                    <button
                      type="button"
                      onClick={() => toggleNavSection('governance')}
                      className="text-[10px] text-purple-600 hover:text-purple-700 cursor-pointer"
                      title={collapsedNavSections.governance ? 'Expand' : 'Collapse'}
                    >
                      {collapsedNavSections.governance ? '▾' : '▴'}
                    </button>
                  )}
                </div>

                {!collapsedNavSections.governance && (
                  <>
                    <a
                      className={currentHash === 'master-mapping' ? 'on' : ''}
                      href="#master-mapping"
                      onClick={(e) => handleNavClick('master-mapping', e)}
                      title={isMini ? 'Master Mapping (Hierarchy)' : undefined}
                      style={{ color: currentHash === 'master-mapping' ? undefined : '#9333ea' }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      <span>Master Mapping</span>
                    </a>

                    <a
                      className={currentHash === 'rbac' || currentHash === 'administration' ? 'on' : ''}
                      href="#rbac"
                      onClick={(e) => handleNavClick('rbac', e)}
                      title={isMini ? 'User & RBAC Administration' : undefined}
                      style={{ color: currentHash === 'rbac' || currentHash === 'administration' ? undefined : '#9333ea' }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      <span>User & RBAC Administration</span>
                    </a>

                    <a
                      className={currentHash === 'security' ? 'on' : ''}
                      href="#security"
                      onClick={(e) => handleNavClick('security', e)}
                      title={isMini ? 'Security & Lockouts' : undefined}
                      style={{ color: currentHash === 'security' ? undefined : '#a855f7' }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>Security & Lockouts</span>
                    </a>
                  </>
                )}
              </>
            )}
          </nav>

          {/* User Profile Footer inside Sidebar */}
          {!isMini ? (
            <div className="mt-auto pt-3 border-t border-[var(--line)]">
              <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surf2)] border border-[var(--line)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                    {currentUser.userName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[var(--ink)] truncate max-w-[110px]">
                        {currentUser.userName}
                      </span>
                      {isSuperuserOrAdmin && (
                        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                          SU
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--mute)] truncate max-w-[130px]">
                      {currentUser.department || 'Noida Plant'} · {currentUser.role}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out of factory terminal"
                  className="w-7 h-7 rounded-lg text-[var(--mute)] hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-auto pt-3 border-t border-[var(--line)] flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSidebar}
                title="Expand sidebar"
                className="w-8 h-8 rounded-lg text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)] flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
              <div
                title={`${currentUser.userName} (${currentUser.role})`}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
              >
                {currentUser.userName.slice(0, 2).toUpperCase()}
              </div>
            </div>
          )}
        </aside>

        {/* Main View Area */}
        <main>
          {/* Sticky Header */}
          <header>
            <button
              className="ico"
              id="collapse"
              aria-label="Toggle navigation menu"
              onClick={handleToggleSidebar}
            >
              <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="M9 4v16" />
              </svg>
            </button>

            <div className="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                ref={searchInputRef}
                id="search-input"
                placeholder="Search assets, people, work orders (Scan barcode or Ctrl+K)"
                aria-label="Search assets, people, work orders"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const query = e.currentTarget.value.trim()
                    if (query) {
                      const match = assets.find(
                        (a) =>
                          a.assetCode.toLowerCase() === query.toLowerCase() ||
                          (a.assetTag && a.assetTag.toLowerCase() === query.toLowerCase())
                      )
                      if (match) {
                        if (checkAssetAccess(match, currentUser)) {
                          setQrAccessDenied(null)
                          setQrScannedAsset(match)
                          logAuditEvent(
                            'QR_VERIFY_SCAN',
                            {
                              assetCode: match.assetCode,
                              department: match.currentDepartment || match.department,
                              origin: 'barcode_gun_header_search',
                            },
                            match.assetCode
                          )
                          toast.success(`Scanned Asset Verified: ${match.name || match.assetCode}`)
                        } else {
                          setQrScannedAsset(null)
                          setQrAccessDenied({
                            assetCode: match.assetCode,
                            assetDepartment: match.currentDepartment || match.department || 'Restricted Department',
                            userDepartment: currentUser.department || 'General',
                            userName: currentUser.userName,
                          })
                          logAuditEvent(
                            'CROSS_DEPARTMENT_SCAN_DENIED',
                            {
                              assetCode: match.assetCode,
                              assetDepartment: match.currentDepartment || match.department,
                              userDepartment: currentUser.department,
                              userId: currentUser.userId,
                              userName: currentUser.userName,
                              origin: 'barcode_gun_header_search',
                            },
                            match.assetCode
                          )
                          toast.error(
                            `Access Denied: Asset ${match.assetCode} belongs to ${match.currentDepartment || match.department}. You cannot view this product.`
                          )
                        }
                      }
                    }
                  }
                }}
              />
              <kbd>Ctrl K</kbd>
            </div>

            {/* Active Factory Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-xs font-semibold text-[var(--ink)]">
              <span>🏭</span>
              <span className="truncate max-w-[180px]">{activeFactory}</span>
            </div>

            <span style={{ flex: 1 }} />

            <button
              className="ai"
              id="ai-btn"
              onClick={() => {
                toast.info('Ask Meridian AI activated', {
                  description: 'Select an inquiry chip to check failure risks or warranty status.',
                })
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="m12 2 2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7L12 2Z" />
              </svg>
              <span>Ask Meridian</span>
            </button>

            <button
              className="ico"
              id="theme"
              aria-label="Toggle light and dark mode"
              onClick={toggleTheme}
            >
              <svg viewBox="0 0 24 24">
                <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
              </svg>
            </button>

            <button
              type="button"
              className="ico relative cursor-pointer"
              aria-label={`Notifications ${totalPendingNotifications > 0 ? `(${totalPendingNotifications} pending approvals)` : ''}`}
              onClick={() => setIsNotificationFlyoutOpen(true)}
              title={
                totalPendingNotifications > 0
                  ? `${totalPendingNotifications} Pending Super User Action(s): ${pendingPasswordResetCount} Password Reset(s), ${pendingReprintCount} Re-print Request(s)`
                  : 'Notifications'
              }
            >
              <svg viewBox="0 0 24 24">
                <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 19a2 2 0 0 0 4 0" />
              </svg>
              {totalPendingNotifications > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center animate-pulse shadow-xs border border-white dark:border-slate-900">
                  {totalPendingNotifications}
                </span>
              ) : (
                <i className="dot" />
              )}
            </button>

            {/* User Profile Avatar */}
            <button
              type="button"
              className="me cursor-pointer border-none font-bold"
              onClick={() => {
                setTempUserName(currentUser.userName)
                setTempUserId(currentUser.userId)
                setTempUserRole(currentUser.role)
                setTempUserDepartment(currentUser.department || 'IT')
                setIsProfileModalOpen(true)
              }}
              title={`Logged in as ${currentUser.userName} (${currentUser.role}) · Click to switch user profile`}
              aria-label="User profile and login session"
            >
              {userInitials}
            </button>

            {/* Logout Button */}
            <button
              type="button"
              className="ico"
              onClick={handleLogout}
              title="Sign Out from workshop terminal"
              aria-label="Logout"
              style={{ color: 'var(--bad)' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </header>

          {/* Page Content */}
          <div className="wrap">
            {isDashboard ? (
              /* Executive Dashboard View */
              <div id="v-dashboard">
                <div className="top">
                  <div>
                    <h1>
                      {dynamicGreeting}, {currentUser.userName}
                    </h1>
                    <div className="sub">
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}{' '}
                      · 0 active alerts · {activeFactory} · last synced just now
                    </div>
                  </div>
                  <div className="btns">
                    <button
                      className="btn"
                      onClick={() => {
                        toast.success('Live inventory telemetry refreshed')
                      }}
                    >
                      Refresh
                    </button>
                    <button
                      ref={addAssetButtonRef}
                      className="btn p"
                      onClick={() => {
                        setWorkflowAsset(null)
                        setIsAddModalOpen(true)
                      }}
                    >
                      + Add Asset
                    </button>
                  </div>
                </div>

                {/* Fleet Health Bar & Executive Command Center */}
                <section className="card p-3 sm:p-3.5 space-y-2.5 bg-gradient-to-r from-[var(--surf)] via-[var(--surf)] to-[var(--surf2)] border border-[var(--line)] shadow-2xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#165DFF] to-[#0f44bd] text-white flex items-center justify-center text-base font-black shadow-sm shadow-[#165DFF]/20">
                        {totalAssets}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[var(--ink)]">
                            Active Deployed Fleet
                          </h3>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Telemetry
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--mute)]">
                          Enterprise equipment tracking across IIPL & Padget manufacturing sites
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line)] shadow-2xs hover:border-[var(--ok)]/40 transition">
                        <span className="sw" style={{ background: 'var(--ok)' }} />
                        <span className="text-[var(--mute)] text-[11px]">Operational:</span>
                        <b className="font-bold text-[var(--ink)] text-[11px]">{healthyCount}</b>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line)] shadow-2xs hover:border-[var(--warn)]/40 transition">
                        <span className="sw" style={{ background: 'var(--warn)' }} />
                        <span className="text-[var(--mute)] text-[11px]">Service Due:</span>
                        <b className="font-bold text-[var(--ink)] text-[11px]">{maintenanceCount}</b>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line)] shadow-2xs hover:border-[var(--acc)]/40 transition">
                        <span className="sw" style={{ background: 'var(--acc)' }} />
                        <span className="text-[var(--mute)] text-[11px]">Reserved:</span>
                        <b className="font-bold text-[var(--ink)] text-[11px]">{reservedCount}</b>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line)] shadow-2xs hover:border-[var(--bad)]/40 transition">
                        <span className="sw" style={{ background: 'var(--bad)' }} />
                        <span className="text-[var(--mute)] text-[11px]">Retired:</span>
                        <b className="font-bold text-[var(--ink)] text-[11px]">{retiredCount}</b>
                      </div>
                    </div>
                  </div>

                  {/* Visual Status Allocation Meter */}
                  <div className="w-full bg-[var(--surf2)] h-1.5 rounded-full overflow-hidden flex border border-[var(--line)]/50">
                    <div
                      style={{ width: `${totalAssets > 0 ? (healthyCount / totalAssets) * 100 : 0}%` }}
                      className="bg-[var(--ok)] transition-all duration-500"
                      title={`${healthyCount} Operational`}
                    />
                    <div
                      style={{ width: `${totalAssets > 0 ? (maintenanceCount / totalAssets) * 100 : 0}%` }}
                      className="bg-[var(--warn)] transition-all duration-500"
                      title={`${maintenanceCount} Service Due`}
                    />
                    <div
                      style={{ width: `${totalAssets > 0 ? (reservedCount / totalAssets) * 100 : 0}%` }}
                      className="bg-[var(--acc)] transition-all duration-500"
                      title={`${reservedCount} Reserved`}
                    />
                    <div
                      style={{ width: `${totalAssets > 0 ? (retiredCount / totalAssets) * 100 : 0}%` }}
                      className="bg-[var(--bad)] transition-all duration-500"
                      title={`${retiredCount} Retired`}
                    />
                  </div>
                </section>

                {/* Pending Tasks Queue Alert Banner */}
                {pendingTaskCount > 0 && (
                  <div className="mt-3 p-3 sm:p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg font-bold shrink-0 border border-amber-500/30">
                        ⏳
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                            {pendingTaskCount.toLocaleString()} Asset Codes in Task Queue
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Awaiting Physical Data Entry
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--mute)] mt-0.5">
                          Super user imported {assets.length.toLocaleString()} master codes from SAP/ERP. Complete physical asset details to activate them in the deployed fleet.
                        </p>
                      </div>
                    </div>
                    <a
                      href="#tasks"
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs text-center"
                    >
                      <span>Open Task Queue ({pendingTaskCount.toLocaleString()})</span>
                      <span>→</span>
                    </a>
                  </div>
                )}

                {/* 👑 Super User Approval & Governance Center */}
                {isSuperuserOrAdmin && (
                  <section
                    className="mt-3 card p-4 sm:p-5 space-y-4 bg-gradient-to-br from-[var(--surf)] via-[var(--surf)] to-purple-500/5 border-2 border-purple-500/30 shadow-xs"
                    aria-label="Super User Approval & Governance Center"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xl font-bold shadow-sm shadow-purple-600/30">
                          👑
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[var(--ink)] tracking-tight">
                              Super User Approval & Governance Center (审批中心)
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                              HOD Authority
                            </span>
                          </div>
                          <p className="text-xs text-[var(--mute)] mt-0.5">
                            Enforce Single-Print Governance: Authorize duplicate QR code reprints requested by department operators.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {pendingPasswordResetCount > 0 && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-rose-600" />
                            <span>{pendingPasswordResetCount} Password Reset{pendingPasswordResetCount === 1 ? '' : 's'} Pending</span>
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                            pendingReprintCount > 0
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${pendingReprintCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          <span>{pendingReprintCount} Reprint Request{pendingReprintCount === 1 ? '' : 's'} Pending Approval</span>
                        </span>
                        <a
                          href="#labels"
                          className="text-xs font-bold px-3 py-1 rounded-lg border border-[var(--line)] bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] transition"
                        >
                          QR Label Print →
                        </a>
                      </div>
                    </div>

                    {/* SECTION 1: Pending Password Reset Requests */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🔑</span>
                          <h4 className="text-xs font-bold text-[var(--ink)]">
                            Employee Password Reset Requests ({pendingPasswordResetRequests.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-[var(--mute)]">
                          Operators who requested password reset from worker login terminal
                        </span>
                      </div>

                      {pendingPasswordResetRequests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {pendingPasswordResetRequests.map((req) => (
                            <div
                              key={req.id}
                              className="p-3.5 rounded-xl border border-rose-500/40 bg-[var(--surf)] hover:border-purple-500/50 transition shadow-2xs space-y-2.5 flex flex-col justify-between"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                                        👤 {req.userId}
                                      </span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surf2)] text-[var(--mute)] border border-[var(--line)]">
                                        {req.id}
                                      </span>
                                    </div>
                                    <h4 className="text-xs font-bold text-[var(--ink)] mt-0.5 truncate max-w-[280px]">
                                      {req.userName}
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 shrink-0">
                                    ⏳ Reset Pending
                                  </span>
                                </div>

                                <div className="text-[11px] text-[var(--mute)] space-y-0.5 bg-[var(--surf2)]/50 p-2 rounded-lg border border-[var(--line)]/50">
                                  <div>
                                    <b>Department:</b> <span className="text-[var(--ink)] font-semibold">{req.department || 'Production & SMT'}</span>
                                  </div>
                                  <div>
                                    <b>Plant:</b> <span className="text-[var(--ink)]">{req.plant || activeFactory}</span>
                                  </div>
                                  <div>
                                    <b>Reason:</b> <span className="text-rose-600 dark:text-rose-400 font-semibold">{req.notes || 'Forgot password'}</span>
                                  </div>
                                  <div>
                                    <b>Requested:</b> {new Date(req.requestedAt).toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1 border-t border-[var(--line)]/60">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedResetRequest(req)
                                    setNewPasswordInput('Meridian@2026')
                                    setIsResetModalOpen(true)
                                  }}
                                  className="flex-1 py-1.5 px-3 rounded-lg bg-[#165DFF] hover:bg-[#1249cb] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                                >
                                  <span>🔑</span>
                                  <span>Set New Password</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await rejectPasswordResetRequest(req.id, currentUser, 'Rejected by Super User')
                                    if (res.success) {
                                      toast.info(`Rejected password reset request for ${req.userName}.`)
                                    }
                                  }}
                                  className="py-1.5 px-3 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  <span>✕</span>
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
                          <span className="text-xl">🛡️</span>
                          <div>
                            <div className="font-bold">Zero Pending Password Reset Requests</div>
                            <div className="text-[11px] opacity-80">
                              All employee credentials are active and synchronized with workshop security protocols.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SECTION 2: Pending QR Label Reprint Requests */}
                    <div className="space-y-2.5 pt-2 border-t border-[var(--line)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🏷️</span>
                          <h4 className="text-xs font-bold text-[var(--ink)]">
                            QR Code Re-print Authorizations ({pendingReprintRequests.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-[var(--mute)]">
                          Strict anti-duplicate label rule requires HOD approval
                        </span>
                      </div>

                      {pendingReprintRequests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {pendingReprintRequests.map((req) => (
                            <div
                              key={req.id}
                              className="p-3.5 rounded-xl border border-amber-500/40 bg-[var(--surf)] hover:border-purple-500/50 transition shadow-2xs space-y-2.5 flex flex-col justify-between"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-xs text-[var(--acc)]">
                                        🏷️ {req.assetCode}
                                      </span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surf2)] text-[var(--mute)] border border-[var(--line)]">
                                        {req.id}
                                      </span>
                                    </div>
                                    <h4 className="text-xs font-bold text-[var(--ink)] mt-0.5 truncate max-w-[280px]">
                                      {req.assetName || 'Equipment Fixed Asset'}
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                                    ⏳ Pending
                                  </span>
                                </div>

                                <div className="text-[11px] text-[var(--mute)] space-y-0.5 bg-[var(--surf2)]/50 p-2 rounded-lg border border-[var(--line)]/50">
                                  <div>
                                    <b>Requester:</b> <span className="text-[var(--ink)] font-semibold">{req.requestedBy || 'Staff'}</span> ({req.requesterDept || req.department || 'Production'})
                                  </div>
                                  <div>
                                    <b>Reason:</b> <span className="text-amber-600 dark:text-amber-400 font-semibold">{req.reason}</span>
                                  </div>
                                  {req.notes && (
                                    <div>
                                      <b>Operator Note:</b> <i>"{req.notes}"</i>
                                    </div>
                                  )}
                                  <div>
                                    <b>Requested:</b> {new Date(req.requestedAt).toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1 border-t border-[var(--line)]/60">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const note = 'Approved by Super User'
                                    const res = approveReprintRequest(req.id, currentUser, note)
                                    if (res) {
                                      toast.success(`Approved reprint for ${req.assetCode}! 1-time print unlocked for ${req.requestedBy}.`)
                                    }
                                  }}
                                  className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                                >
                                  <span>✓</span>
                                  <span>Approve 1-Time Print</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const note = 'Rejected by Super User'
                                    const res = rejectReprintRequest(req.id, currentUser, note)
                                    if (res) {
                                      toast.info(`Rejected reprint request for ${req.assetCode}.`)
                                    }
                                  }}
                                  className="py-1.5 px-3 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  <span>✕</span>
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
                          <span className="text-xl">🛡️</span>
                          <div>
                            <div className="font-bold">All QR Label Reprint Requests are Approved & Clear</div>
                            <div className="text-[11px] opacity-80">
                              Zero duplicate print requests pending. Strict anti-duplicate label governance is fully active.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Four Major Asset Categories (四大核心资产类别) Overview Strip */}
                <section
                  className="mt-3 card p-3 sm:p-4 space-y-3 bg-[var(--surf)] border border-[var(--line)] shadow-2xs"
                  aria-label="Four Major Asset Categories"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[var(--line)]/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[var(--acc)]/10 text-[var(--acc)] flex items-center justify-center text-lg font-bold">
                        🏷️
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-bold text-[var(--ink)] tracking-tight">
                            Four Major Asset Categories (四大核心资产类别)
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Enterprise Master Scope
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-[var(--mute)]">
                          Fixed Assets · Accessories · Tools · Fixtures — Click any category card to filter the facility register below
                        </p>
                      </div>
                    </div>
                    {dashCategoryFilter !== 'All' && (
                      <button
                        type="button"
                        onClick={() => setDashCategoryFilter('All')}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                      >
                        <span>Filtered by: <b>{dashCategoryFilter}</b></span>
                        <span className="text-[var(--mute)] hover:text-[var(--bad)] font-bold">✕ Show All</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {MAJOR_ASSET_CATEGORIES.map((catKey) => {
                      const cfg = MAJOR_ASSET_CATEGORIES_CONFIG[catKey]
                      const isSelected = dashCategoryFilter === catKey
                      
                      // Count in completed fleet and total scoped
                      const catAssets = scopedAssets.filter(
                        (a) => resolveMajorAssetCategory(a.currentCategory || a.category) === catKey
                      )
                      const deployedCount = catAssets.filter((a) => isAssetTaskCompleted(a)).length
                      const totalCount = catAssets.length
                      const pctOfFleet =
                        totalAssets > 0
                          ? Math.round((deployedCount / totalAssets) * 100)
                          : scopedAssets.length > 0
                          ? Math.round((totalCount / scopedAssets.length) * 100)
                          : 0
                      const healthyCatCount = catAssets.filter((a) => a.status === 'Active' || a.status === 'Completed').length

                      return (
                        <div
                          key={catKey}
                          onClick={() => setDashCategoryFilter(prev => prev === catKey ? 'All' : catKey)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Category ${cfg.label}: ${totalCount > 0 && deployedCount === 0 ? totalCount : deployedCount} ${cfg.label}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setDashCategoryFilter(prev => prev === catKey ? 'All' : catKey)
                            }
                          }}
                          className={`relative overflow-hidden rounded-xl p-3 border transition-all duration-200 cursor-pointer text-left select-none ${
                            isSelected
                              ? 'ring-2 ring-[var(--acc)] bg-[var(--acc)]/10 border-[var(--acc)] shadow-sm'
                              : 'bg-gradient-to-br from-[var(--surf)] to-[var(--surf2)]/50 border-[var(--line)] hover:border-[var(--acc)]/50 hover:shadow-xs'
                          }`}
                        >
                          {/* Header with Icon, Labels and Active Pill */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl p-1.5 rounded-lg bg-[var(--surf)] border border-[var(--line)] shadow-2xs">
                                {cfg.icon}
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-[var(--ink)] leading-tight">
                                  {cfg.label}
                                </h4>
                                <div className="text-[10px] text-[var(--mute)] font-medium">
                                  {cfg.chineseLabel}
                                </div>
                              </div>
                            </div>
                            {isSelected ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--acc)] text-white shadow-2xs">
                                Filtered ✓
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-[var(--mute)]">
                                {pctOfFleet}%
                              </span>
                            )}
                          </div>

                          {/* Metric figures */}
                          <div className="mt-2 flex items-baseline justify-between">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-black text-[var(--ink)] tracking-tight">
                                {totalCount > 0 && deployedCount === 0 ? totalCount.toLocaleString() : deployedCount.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-[var(--mute)]">
                                {deployedCount > 0 ? `/ ${totalCount.toLocaleString()} total` : 'total registered'}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {healthyCatCount > 0 ? `${healthyCatCount} Active` : `${catAssets.length} in system`}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-[var(--line)]/60 h-1.5 rounded-full overflow-hidden mt-2">
                            <div
                              style={{ width: `${pctOfFleet}%`, backgroundColor: cfg.color }}
                              className="h-full rounded-full transition-all duration-500"
                            />
                          </div>

                          <div className="mt-2 text-[10px] text-[var(--mute)] truncate" title={cfg.description}>
                            {cfg.description}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* 3D Bento-Box Command Grid */}
                <div className="mt-3">
                  <ExecutiveBentoGrid3D
                    assets={completedAssetsList}
                    pendingTaskCount={pendingTaskCount}
                    onNavigate={(hash) => {
                      setCurrentHash(hash)
                      window.location.hash = '#' + hash
                    }}
                    onAddAsset={() => {
                      setWorkflowAsset(null)
                      setIsAddModalOpen(true)
                    }}
                  />
                </div>

                {/* 3D Spatial Digital Twin Facility Visualizer */}
                <div className="mt-3">
                  <DigitalTwinFacility3D
                    assets={scopedAssets}
                    completedAssets={completedAssetsList}
                    activeBuildingFilter={dashBuildingFilter}
                    onSelectBuilding={(bldg) => {
                      setDashBuildingFilter(bldg as any)
                    }}
                    onOpenAsset={(asset) => {
                      setWorkflowAsset(asset)
                      setIsAddModalOpen(true)
                    }}
                    onNavigate={(hash, assetCode) => {
                      if (assetCode) {
                        setDashSearchQuery(assetCode)
                      }
                      setCurrentHash(hash)
                      window.location.hash = '#' + hash
                    }}
                    onAddNewAssetOnFloor={(bldg, floor) => {
                      setWorkflowAsset({
                        id: `AST-NEW-${Date.now()}`,
                        assetCode: '',
                        serialNumber: '',
                        currentCategory: 'IT Hardware',
                        currentDescription: '',
                        company: bldg === 'C39' ? 'IIPL' : 'Padget',
                        building: bldg as any,
                        floor: floor,
                        plant: bldg === 'C39' ? 'C-39 Factory, Noida' : 'Padget Electronics, Noida',
                        department: 'Production',
                        currentDepartment: 'Production',
                        assetCondition: 'Operational - Good',
                        date: new Date().toISOString().split('T')[0],
                        name: '',
                        assetTag: '',
                        category: 'IT Hardware',
                        status: 'Pending Verification',
                        purchaseDate: new Date().toISOString().split('T')[0],
                        purchaseCost: 0,
                        currentValue: 0,
                        assignedTo: '',
                        location: `${bldg} · ${floor}`,
                      })
                      setIsAddModalOpen(true)
                    }}
                  />
                </div>

                {/* Facility Assets Register */}
                <section className="card" style={{ marginTop: '20px', padding: '20px' }} aria-label="Facility Assets Register">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏢</span>
                        <h2 className="text-base font-bold text-[var(--ink)]">
                          Facility Assets Register
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[var(--acc)]/10 text-[var(--acc)]">
                          {filteredDashboardAssets.length} of {completedAssetsList.length} Deployed
                        </span>
                        {!isSuperuserOrAdmin && currentUser.department && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                            {currentUser.department} Dept View
                          </span>
                        )}
                        {pendingTaskCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentHash('tasks')
                              window.location.hash = '#tasks'
                            }}
                            className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer flex items-center gap-1"
                            title="Click to view pending asset codes in Task Queue"
                          >
                            <span>⏳</span>
                            <span>{pendingTaskCount} pending task entry</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[var(--mute)] mt-1">
                        Enterprise tracking across <b>IIPL</b> & <b>Padget</b> facilities (Buildings: <b>C39, D197, D198, D199</b>)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Search */}
                      <div className="relative">
                        <input
                          type="text"
                          value={dashSearchQuery}
                          onChange={(e) => setDashSearchQuery(e.target.value)}
                          placeholder="Search code, dept, in-charge..."
                          className="text-xs py-1.5 pl-7 pr-4 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] w-48 md:w-56"
                        />
                        <span className="absolute left-2 top-1.5 text-xs text-[var(--mute)]">🔍</span>
                        {dashSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDashSearchQuery('')}
                            className="absolute right-2 top-1 text-xs text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Company Filter */}
                      <div className="flex items-center rounded-lg border border-[var(--line)] overflow-hidden text-xs">
                        {(['All', 'IIPL', 'Padget'] as const).map((comp) => (
                          <button
                            key={comp}
                            type="button"
                            onClick={() => setDashCompanyFilter(comp)}
                            className={`px-2.5 py-1 transition-colors cursor-pointer ${
                              dashCompanyFilter === comp
                                ? 'bg-[var(--acc)] text-white font-bold'
                                : 'bg-[var(--surf)] text-[var(--mute)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {comp === 'All' ? 'All Co.' : comp}
                          </button>
                        ))}
                      </div>

                      {/* Building Filter */}
                      <div className="flex items-center rounded-lg border border-[var(--line)] overflow-hidden text-xs">
                        {['All', 'C39', 'D197', 'D198', 'D199'].map((bldg) => (
                          <button
                            key={bldg}
                            type="button"
                            onClick={() => setDashBuildingFilter(bldg)}
                            className={`px-2 py-1 transition-colors cursor-pointer ${
                              dashBuildingFilter === bldg
                                ? 'bg-[var(--acc)] text-white font-bold'
                                : 'bg-[var(--surf)] text-[var(--mute)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {bldg === 'All' ? 'All Bldgs' : bldg}
                          </button>
                        ))}
                      </div>

                      {/* Category Quick Filter */}
                      <div className="flex items-center rounded-lg border border-[var(--line)] overflow-hidden text-xs">
                        {['All', ...MAJOR_ASSET_CATEGORIES].map((cat) => {
                          const isSelected = dashCategoryFilter === cat
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setDashCategoryFilter(cat)}
                              className={`px-2 py-1 transition-colors cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-[var(--acc)] text-white font-bold'
                                  : 'bg-[var(--surf)] text-[var(--mute)] hover:text-[var(--ink)]'
                              }`}
                            >
                              {cat !== 'All' && <span>{MAJOR_ASSET_CATEGORIES_CONFIG[cat as MajorAssetCategory]?.icon}</span>}
                              <span>{cat === 'All' ? 'All Categories' : cat}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Export to Excel Button */}
                      <button
                        type="button"
                        onClick={() => exportAssetsToExcel(filteredDashboardAssets, `${currentUser.department || 'Asset'}_Inventory`)}
                        className="btn text-xs py-1 px-3 flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-xs"
                        title="Export current assets to Excel (.xlsx)"
                        aria-label="Export to Excel"
                      >
                        <span>📊</span>
                        <span>Export Excel</span>
                      </button>

                      {/* Add Asset Quick Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setWorkflowAsset(null)
                          setIsAddModalOpen(true)
                        }}
                        className="btn p text-xs py-1 px-3 cursor-pointer"
                      >
                        + Add Asset
                      </button>
                    </div>
                  </div>

                  {/* Asset Table */}
                  {filteredDashboardAssets.length > 0 ? (
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)] min-h-[350px] mt-3 border border-[var(--line)] rounded-xl scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 z-10 bg-[var(--surf)] border-b border-[var(--line)] shadow-xs">
                          <tr className="border-b border-[var(--line)] text-[var(--mute)] uppercase tracking-wider text-[11px] bg-[var(--surf)]">
                            <th className="py-2.5 px-3 bg-[var(--surf)]">Picture</th>
                            <th className="py-2.5 px-3 bg-[var(--surf)]">Asset Code</th>
                            <th className="py-2.5 px-3 bg-[var(--surf)]">Category (四大核心)</th>
                            <th className="py-2.5 px-3 bg-[var(--surf)]">Company</th>
                            <th className="py-2.5 px-3 bg-[var(--surf)]">Building</th>
                            <th className="py-2.5 px-3 bg-[var(--surf)]">Floor</th>
                            <th className="py-2.5 px-3 bg-[var(--surf)]">Belong to Dept</th>
                            <th className="py-2.5 px-3 bg-[var(--surf)]">Who in Charge (ID, Name)</th>
                            <th className="py-2.5 px-3 text-right bg-[var(--surf)]">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)]">
                          {filteredDashboardAssets.map((asset) => {
                            const isPadget = isPadgetCompany(asset)
                            const comp = isPadget ? 'Padget' : (asset.company || 'IIPL')
                            const bldg = asset.building || (isPadget ? 'D197' : 'C39')
                            const flr = asset.floor || 'Ground Floor'
                            const dept = asset.currentDepartment || asset.department || 'Operations'
                            const inChargeDisplayId = asset.inChargeId || 'ID Pending'
                            const inChargeDisplayName = asset.inChargeName || asset.submitter || asset.assignedTo || 'Unassigned Staff'

                            return (
                              <tr key={asset.id} className="hover:bg-[var(--surf2)]/50 transition-colors">
                                {/* Picture */}
                                <td className="py-2.5 px-3">
                                  {asset.assetPhoto ? (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage({
                                        url: asset.assetPhoto!,
                                        title: asset.currentDescription || asset.name,
                                        code: asset.assetCode
                                      })}
                                      className="cursor-pointer group relative block"
                                      title="Click to view picture"
                                    >
                                      <img
                                        src={asset.assetPhoto}
                                        alt={asset.assetCode}
                                        className="w-10 h-10 object-cover rounded-md border border-[var(--line)] shadow-xs group-hover:scale-105 transition-transform"
                                      />
                                    </button>
                                  ) : (
                                    <div
                                      className="w-10 h-10 rounded-md bg-[var(--surf2)] border border-[var(--line)] flex items-center justify-center text-base"
                                      title="No photo attached"
                                    >
                                      📦
                                    </div>
                                  )}
                                </td>

                                {/* Asset Code */}
                                <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink)]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWorkflowAsset(asset)
                                      setIsAddModalOpen(true)
                                    }}
                                    className="text-left group cursor-pointer bg-transparent border-none p-0 focus:outline-none"
                                    title={`Open ${asset.assetCode} form`}
                                  >
                                    <div className="group-hover:text-[var(--acc)] group-hover:underline transition-colors">{asset.assetCode}</div>
                                    <div className="text-[10px] text-[var(--mute)] font-sans">{asset.serialNumber || 'SN: N/A'}</div>
                                  </button>
                                </td>

                                {/* Category */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {(() => {
                                    const cat = resolveMajorAssetCategory(asset.currentCategory || asset.category)
                                    const cfg = MAJOR_ASSET_CATEGORIES_CONFIG[cat]
                                    return (
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${cfg.badgeClass}`}
                                        title={`${cfg.label} (${cfg.chineseLabel})`}
                                      >
                                        <span>{cfg.icon}</span>
                                        <span>{cfg.label}</span>
                                      </span>
                                    )
                                  })()}
                                </td>

                                {/* Company */}
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                      comp === 'Padget'
                                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                    }`}
                                  >
                                    <span>{comp === 'Padget' ? '🏭' : '🏢'}</span>
                                    <span>{comp}</span>
                                  </span>
                                </td>

                                {/* Building */}
                                <td className="py-2.5 px-3 font-semibold text-[var(--ink)]">
                                  <span className="inline-flex items-center gap-1">
                                    <span>🏛️</span>
                                    <span>{bldg}</span>
                                  </span>
                                </td>

                                {/* Floor */}
                                <td className="py-2.5 px-3 text-[var(--mute)]">
                                  <span className="inline-flex items-center gap-1">
                                    <span>📍</span>
                                    <span>{flr}</span>
                                  </span>
                                </td>

                                {/* Belong to Dept */}
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surf2)] text-[var(--ink)] border border-[var(--line)]">
                                    {dept}
                                  </span>
                                </td>

                                {/* Who in Charge (ID, Name) */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[var(--acc)]/10 text-[var(--acc)] flex items-center justify-center text-[10px] font-bold">
                                      👤
                                    </div>
                                    <div>
                                      <div className="font-semibold text-[var(--ink)] leading-tight">
                                        {inChargeDisplayName}
                                      </div>
                                      <div className="font-mono text-[10px] text-[var(--mute)] leading-tight">
                                        ID: {inChargeDisplayId}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Action */}
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setQrScannedAsset(asset)}
                                      className="p-1 rounded text-[var(--mute)] hover:text-[var(--acc)] hover:bg-[var(--surf2)] transition cursor-pointer"
                                      title={`View Details & Print Status for ${asset.assetCode}`}
                                      aria-label={`View Details & Print Status for ${asset.assetCode}`}
                                    >
                                      👁️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        try {
                                          sessionStorage.setItem('meridian_print_asset_id', asset.id)
                                        } catch {}
                                        window.location.hash = '#labels'
                                      }}
                                      className="p-1 rounded text-[var(--mute)] hover:text-[var(--acc)] hover:bg-[var(--surf2)] transition cursor-pointer"
                                      title={`Print QR Label for ${asset.assetCode}`}
                                      aria-label={`Print QR Label for ${asset.assetCode}`}
                                    >
                                      🏷️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAsset(asset.id)}
                                      className="p-1 rounded text-[var(--mute)] hover:text-[var(--bad)] hover:bg-[var(--surf2)] transition cursor-pointer"
                                      title={`Delete asset ${asset.assetCode}`}
                                      aria-label={`Delete asset ${asset.assetCode}`}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 px-4">
                      <div className="text-3xl mb-2">🏢</div>
                      <h3 className="text-sm font-bold text-[var(--ink)]">
                        {completedAssetsList.length === 0
                          ? pendingTaskCount > 0
                            ? `0 Deployed Assets (${pendingTaskCount} Codes Pending in Task Queue)`
                            : 'Zero Assets Registered in Dashboard'
                          : 'No matching assets found for active filters'}
                      </h3>
                      <p className="text-xs text-[var(--mute)] max-w-md mx-auto mt-1 mb-4">
                        {completedAssetsList.length === 0
                          ? pendingTaskCount > 0
                            ? 'Asset codes have been imported into the Task Queue, but departmental data has not been filled out yet. Open the Task Queue to select codes and register equipment details.'
                            : 'Add equipment or import an Excel spreadsheet to view real-time facility deployments for IIPL and Padget across buildings C39, D197, D198, and D199.'
                          : 'Try clearing your search term or switching the Company and Building filters.'}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        {completedAssetsList.length === 0 ? (
                          <>
                            {pendingTaskCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentHash('tasks')
                                  window.location.hash = '#tasks'
                                }}
                                className="btn p text-xs flex items-center gap-1"
                              >
                                <span>📋</span>
                                <span>Open Task Queue ({pendingTaskCount} Pending)</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setWorkflowAsset(null)
                                setIsAddModalOpen(true)
                              }}
                              className="btn text-xs"
                            >
                              + Add Asset
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentHash('library')
                                window.location.hash = '#library'
                              }}
                              className="btn text-xs"
                            >
                              📥 Import Spreadsheet
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setDashSearchQuery('')
                              setDashCompanyFilter('All')
                              setDashBuildingFilter('All')
                            }}
                            className="btn text-xs"
                          >
                            Reset Filters
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            ) : currentHash === 'verification' || currentHash === 'tasks' ? (
              <AssetCodeWorkflow
                assets={assets}
                user={currentUser}
                onImportCodes={handleImportAssetCodes}
                onAssign={handleAssignAssetCode}
                onSelectAsset={(asset) => {
                  setWorkflowAsset(asset)
                  setIsAddModalOpen(true)
                }}
                onClearAllTasks={handleClearAllAssets}
                onRefreshFromBackend={handleRefreshFromBackend}
              />
            ) : currentHash === 'assets' || currentHash === 'library' ? (
              <AssetLibraryView
                assets={scopedAssets}
                activeSubTab={currentHash === 'library' ? 'library' : 'gallery'}
                setActiveSubTab={(tab) => {
                  const targetHash = tab === 'library' ? 'library' : 'assets'
                  setCurrentHash(targetHash)
                  window.location.hash = `#${targetHash}`
                }}
                onOpenAddAsset={() => {
                  setWorkflowAsset(null)
                  setIsAddModalOpen(true)
                }}
                onDeleteAsset={handleDeleteAsset}
                onClearAllAssets={handleClearAllAssets}
                onImportAssets={handleImportAssets}
                addAssetButtonRef={addAssetButtonRef}
              />
            ) : currentHash === 'audit' ? (
              isSuperuserOrAdmin ? (
                <AuditLogView />
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-red-200 shadow-xs max-w-lg mx-auto my-12">
                  <div className="text-4xl mb-3">🛡️🔒</div>
                  <h2 className="text-lg font-bold text-red-600 mb-2">Access Restricted</h2>
                  <p className="text-sm text-[var(--mute)]">
                    Audit & Device Tracking is restricted to Super Users. Your current role does not possess the required clearance.
                  </p>
                </div>
              )
            ) : currentHash === 'administration' && !isSuperuserOrAdmin ? (
              <div className="p-8 text-center bg-white rounded-xl border border-red-200 shadow-xs max-w-lg mx-auto my-12">
                <div className="text-4xl mb-3">⚙️🔒</div>
                <h2 className="text-lg font-bold text-red-600 mb-2">Access Restricted</h2>
                <p className="text-sm text-[var(--mute)]">
                  System Administration is restricted to Super Users. Your current role does not possess the required clearance.
                </p>
              </div>
            ) : (currentHash === 'security' || currentHash === 'master-mapping' || currentHash === 'rbac' || currentHash === 'users') && !isSuperuserOrAdmin ? (
              <div className="p-8 text-center bg-white rounded-xl border border-red-200 shadow-xs max-w-lg mx-auto my-12">
                <div className="text-4xl mb-3">👑🔒</div>
                <h2 className="text-lg font-bold text-red-600 mb-2">Access Restricted</h2>
                <p className="text-sm text-[var(--mute)]">
                  Master Governance & Security are restricted to Super Users.
                </p>
              </div>
            ) : currentHash === 'security' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Superuser Security Console...</div>}>
                <SuperuserSecurityView currentUser={currentUser} lang={lang} />
              </React.Suspense>
            ) : currentHash === 'master-mapping' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Master Organization Mapping...</div>}>
                <MasterMappingView currentUser={currentUser} lang={lang} />
              </React.Suspense>
            ) : currentHash === 'rbac' || currentHash === 'administration' || currentHash === 'users' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading User & RBAC Administration...</div>}>
                <RBACManagementView
                  currentUser={currentUser}
                  lang={lang}
                  onSwitchUser={(user) => {
                    setCurrentUser(user)
                    setCurrentUserProfile(user)
                    setTempUserName(user.userName)
                    setTempUserId(user.userId)
                    setTempUserRole(user.role)
                    setTempUserDepartment(user.department || 'IT')
                  }}
                />
              </React.Suspense>
            ) : currentHash === 'maintenance-india' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Maintenance Module...</div>}>
                <IndiaMaintenanceView lang={lang} />
              </React.Suspense>
            ) : currentHash === 'stockcount' || currentHash === 'stock-count' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Stock Count Module...</div>}>
                <IndiaStockCountView
                  lang={lang}
                  assets={scopedAssets}
                  currentUser={currentUser}
                  onUpdateAsset={(updated) => {
                    setAssets((prev) =>
                      prev.map((a) => (a.id === updated.id || a.assetCode === updated.assetCode ? updated : a))
                    )
                  }}
                />
              </React.Suspense>
            ) : currentHash === 'transfer' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Transfer Module...</div>}>
                <IndiaTransferView
                  assets={scopedAssets}
                  lang={lang}
                  currentUser={currentUser}
                  onUpdateAsset={(updated) => {
                    setAssets((prev) =>
                      prev.map((a) => (a.id === updated.id || a.assetCode === updated.assetCode ? updated : a))
                    )
                  }}
                />
              </React.Suspense>
            ) : currentHash === 'disposal' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Disposal Module...</div>}>
                <IndiaDisposalView assets={scopedAssets} onDisposeAsset={handleDisposeAsset} lang={lang} />
              </React.Suspense>
            ) : currentHash === 'depreciation' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Depreciation Module...</div>}>
                <IndiaDepreciationView assets={scopedAssets} lang={lang} />
              </React.Suspense>
            ) : currentHash === 'labels' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Label Print Module...</div>}>
                <IndiaLabelPrintView
                  assets={scopedAssets}
                  lang={lang}
                  currentUser={currentUser}
                  onFillAssetData={(asset) => {
                    setWorkflowAsset(asset)
                    setIsAddModalOpen(true)
                  }}
                />
              </React.Suspense>
            ) : activePage ? (
              /* All Other 11 Dashboards (#assets, #inventory, #maintenance, etc.) */
              <div id="v-page">
                <div className="top">
                  <div>
                    <h1>{activePage.t}</h1>
                    <div className="sub">{activePage.s}</div>
                  </div>
                  <div className="btns">
                    <button
                      className="btn"
                      onClick={() => {
                        if (currentHash === 'assets' && assets.length === 0) {
                          toast.warning('No assets recorded to export.')
                          return
                        }
                        toast.success(`Exporting ${activePage.t}`)
                      }}
                    >
                      Export
                    </button>
                    <button
                      className="btn p"
                      onClick={() => {
                        if (activePage.btn === 'Add asset') {
                          setWorkflowAsset(null)
                          setIsAddModalOpen(true)
                        } else {
                          toast.info(`Action triggered: ${activePage.btn}`)
                        }
                      }}
                    >
                      {activePage.btn}
                    </button>
                  </div>
                </div>

                {/* 4 KPIs */}
                <div className="kpis">
                  {activePage.k.map((x, idx) => (
                    <div key={idx} className="card k">
                      <div className="l">{x[0]}</div>
                      <div className="v">{currentHash === 'assets' && idx === 0 ? totalAssets : x[1]}</div>
                      <div className="d">{x[2]}</div>
                    </div>
                  ))}
                </div>

                {/* Responsive Grid with 8-col list and 4-col bars */}
                <div className="grid">
                  <section className="card c8">
                    <h2>{activePage.ah}</h2>
                    {currentHash === 'assets' && assets.length > 0 ? (
                      <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                        {assets.map((a) => (
                          <div key={a.id} className="row">
                            <div className="th">💻</div>
                            <div>
                              <div className="t">{a.name} · {a.assetTag}</div>
                              <div className="m">{a.assignedTo || a.department} · {a.location}</div>
                            </div>
                            <div className="r">
                              <span className="pill ok">{a.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : activePage.a.length > 0 ? (
                      activePage.a.map((r, idx) => (
                        <div key={idx} className="row">
                          <div className="th">{r[0]}</div>
                          <div>
                            <div className="t">{r[1]}</div>
                            <div className="m">{r[2]}</div>
                          </div>
                          <div className="r">
                            <span className={`pill ${r[3]}`}>{r[4]}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs" style={{ color: 'var(--mute)' }}>
                        No records found. Click "{activePage.btn}" to add your first entry.
                      </div>
                    )}
                  </section>

                  <section className="card c4">
                    <h2>{activePage.bh}</h2>
                    {(() => {
                      const isCategoryCard = activePage.bh === 'By category'
                      if (isCategoryCard && assets.length > 0) {
                        const total = assets.length
                        return (
                          <div className="space-y-3">
                            {MAJOR_ASSET_CATEGORIES.map((catKey) => {
                              const cfg = MAJOR_ASSET_CATEGORIES_CONFIG[catKey]
                              const count = assets.filter(
                                (a) => resolveMajorAssetCategory(a.currentCategory || a.category) === catKey
                              ).length
                              const pct = total > 0 ? Math.round((count / total) * 100) : 0
                              return (
                                <div key={catKey} className="row" style={{ display: 'block' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="t flex items-center gap-1.5 font-medium">
                                      <span>{cfg.icon}</span>
                                      <span>{cfg.label}</span>
                                      <span className="text-[10px] text-[var(--mute)]">({cfg.chineseLabel})</span>
                                    </span>
                                    <span className="font-mono text-xs font-bold text-[var(--ink)]">
                                      {count.toLocaleString()} <span className="text-[10px] text-[var(--mute)]">({pct}%)</span>
                                    </span>
                                  </div>
                                  <div className="bar mt-1">
                                    <i style={{ width: `${pct}%`, background: cfg.color }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }
                      if (activePage.b.length > 0) {
                        return activePage.b.map((r, idx) => (
                          <div key={idx} className="row" style={{ display: 'block' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span className="t">{r[0]}</span>
                              <span>{r[1]}</span>
                            </div>
                            <div className="bar">
                              <i style={{ width: `${r[2]}%` }} />
                            </div>
                          </div>
                        ))
                      }
                      return (
                        <div className="py-8 text-center text-xs" style={{ color: 'var(--mute)' }}>
                          No category breakdown data available.
                        </div>
                      )
                    })()}
                  </section>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* User Login Profile Switcher Modal */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <h3 className="text-sm font-bold text-[var(--ink)]">User Session Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--mute)] hover:bg-[var(--surf2)] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--ink)] block mb-1">
                  Logged In Name *
                </label>
                <input
                  type="text"
                  value={tempUserName}
                  onChange={(e) => setTempUserName(e.target.value)}
                  placeholder="e.g. Uttam Singh"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--ink)] block mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={tempUserId}
                  onChange={(e) => setTempUserId(e.target.value)}
                  placeholder="e.g. USR-101"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--ink)] block mb-1">Role</label>
                <select
                  value={tempUserRole}
                  onChange={(e) => setTempUserRole(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Asset Manager">Asset Manager</option>
                  <option value="Compliance Auditor">Compliance Auditor</option>
                  <option value="IT Technician">IT Technician</option>
                  <option value="Department Head">Department Head</option>
                  <option value="Employee">Employee</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="btn flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn p flex-1">
                  Save & Switch
                </button>
              </div>

              {isSuperuserOrAdmin && (
                <div className="pt-2 border-t border-[var(--line)] space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false)
                      setCurrentHash('master-mapping')
                      window.location.hash = '#master-mapping'
                    }}
                    className="w-full text-center py-2 px-3 text-xs font-semibold rounded-lg border border-purple-500/30 text-purple-600 bg-purple-500/5 hover:bg-purple-500/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🏢</span>
                    <span>Master Mapping (Hierarchy Foundation)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false)
                      setCurrentHash('rbac')
                      window.location.hash = '#rbac'
                    }}
                    className="w-full text-center py-2 px-3 text-xs font-semibold rounded-lg border border-purple-500/30 text-purple-600 bg-purple-500/5 hover:bg-purple-500/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🛡️</span>
                    <span>User & RBAC Administration</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false)
                      setCurrentHash('security')
                      window.location.hash = '#security'
                    }}
                    className="w-full text-center py-2 px-3 text-xs font-semibold rounded-lg border border-purple-500/30 text-purple-600 bg-purple-500/5 hover:bg-purple-500/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🔒</span>
                    <span>Superuser Security & IP Audit</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Lightbox / Picture Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-[var(--surf)] border border-[var(--line)] rounded-xl max-w-lg w-full p-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">{previewImage.code}</h3>
                <p className="text-xs text-[var(--mute)]">{previewImage.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-[var(--surf2)] hover:bg-[var(--line)] flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="rounded-lg overflow-hidden border border-[var(--line)] bg-black/5 flex items-center justify-center max-h-[70vh]">
              <img
                src={previewImage.url}
                alt={previewImage.code}
                className="max-h-[65vh] w-auto object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      )}

      {/* Instant QR Scanned Asset Verification Modal (Mobile Camera & Laptop Scanner) */}
      {qrScannedAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg tracking-tight">
                    <span className="text-red-400">i</span>smartu
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                    Official QR Verified
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQrScannedAsset(null)
                    try {
                      window.history.replaceState({}, '', window.location.pathname)
                    } catch {}
                  }}
                  className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition"
                >
                  ✕
                </button>
              </div>
              <h2 className="text-sm font-bold mt-2">设备固定资产详情 / Equipment Fixed Asset Details</h2>
              <p className="text-[11px] text-white/80">Decoded successfully from printed barcode label.</p>
            </div>

            {/* Modal Body: Verified Specifications */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Asset Code Hero Box with QR Print Status Badge */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                <div>
                  <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">资产编号 / Asset No.</div>
                  <div className="text-lg font-black text-[var(--ink)] font-mono">{qrScannedAsset.assetCode}</div>
                </div>
                <div className="text-right flex items-center gap-2">
                  {(() => {
                    const printRec = getAssetPrintRecord(qrScannedAsset.id, qrScannedAsset.assetCode)
                    const latestReq = getLatestReprintRequest(qrScannedAsset.id, qrScannedAsset.assetCode)
                    const pStatus = getAssetPrintStatus(qrScannedAsset, printRec, latestReq)
                    const badge = getPrintStatusBadgeProps(pStatus)
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-xs ${badge.colorClass}`}
                        title={`QR Print Status: ${pStatus}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                    )
                  })()}
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {qrScannedAsset.status || 'Active'}
                  </span>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-[var(--line)] rounded-xl divide-y divide-[var(--line)] text-xs">
                <div className="p-2.5 flex justify-between gap-2">
                  <span className="text-[var(--mute)] font-medium shrink-0">资产名称 / Asset Name:</span>
                  <span className="text-[var(--ink)] font-bold text-right">
                    {qrScannedAsset.name || qrScannedAsset.currentDescription || 'Equipment Fixed Asset'}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between gap-2">
                  <span className="text-[var(--mute)] font-medium shrink-0">设备型号 / Model:</span>
                  <span className="text-[var(--ink)] font-mono font-medium text-right">
                    {qrScannedAsset.model || qrScannedAsset.serialNumber || qrScannedAsset.currentCategory || '-'}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between gap-2">
                  <span className="text-[var(--mute)] font-medium shrink-0">使用部门 / Department:</span>
                  <span className="text-[var(--ink)] font-semibold text-right">
                    {qrScannedAsset.currentDepartment || qrScannedAsset.department || '-'}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between gap-2">
                  <span className="text-[var(--mute)] font-medium shrink-0">责任人 / Custodian:</span>
                  <span className="text-[var(--ink)] font-semibold text-right">
                    {qrScannedAsset.inChargeId && qrScannedAsset.inChargeName
                      ? `${qrScannedAsset.inChargeId} · ${qrScannedAsset.inChargeName}`
                      : qrScannedAsset.whoInCharge || qrScannedAsset.inChargeName || qrScannedAsset.custodian || '-'}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between gap-2">
                  <span className="text-[var(--mute)] font-medium shrink-0">使用人 / Current User:</span>
                  <span className="text-[var(--ink)] font-medium text-right">
                    {qrScannedAsset.submitter || qrScannedAsset.submitterId || '-'}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between gap-2">
                  <span className="text-[var(--mute)] font-medium shrink-0">放置区域 / Placement:</span>
                  <span className="text-[var(--ink)] text-right">
                    {qrScannedAsset.building || 'C39'}-{qrScannedAsset.floor || '1F'} {qrScannedAsset.currentLocation ? `(${qrScannedAsset.currentLocation})` : ''}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between gap-2">
                  <span className="text-[var(--mute)] font-medium shrink-0">厂区实体 / Plant:</span>
                  <span className="text-[var(--ink)] text-right">
                    {qrScannedAsset.company || 'IIPL'} · {qrScannedAsset.plant || 'Noida Central Plant'}
                  </span>
                </div>
              </div>

              {/* QR Print Control & Complete Audit Trail Section */}
              {(() => {
                const printRec = getAssetPrintRecord(qrScannedAsset.id, qrScannedAsset.assetCode)
                const latestReq = getLatestReprintRequest(qrScannedAsset.id, qrScannedAsset.assetCode)
                const pStatus = getAssetPrintStatus(qrScannedAsset, printRec, latestReq)
                const count = printRec?.printCount ?? qrScannedAsset.printCount ?? 0
                const badge = getPrintStatusBadgeProps(pStatus)

                return (
                  <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surf2)]/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🏷️</span>
                        <div>
                          <div className="text-xs font-bold text-[var(--ink)]">QR Print Control & Audit Governance</div>
                          <div className="text-[10px] text-[var(--mute)]">Single-Print rule: 1 default print, locked thereafter.</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.colorClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    {/* Audit Summary Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
                        <div className="text-[10px] uppercase font-bold text-[var(--mute)]">Print Count</div>
                        <div className="text-base font-black text-[var(--ink)] font-mono">{count}</div>
                        <div className="text-[10px] text-[var(--mute)] mt-0.5">
                          {count === 0 ? 'Never printed' : count === 1 ? 'Initial print completed' : `Re-printed ${count - 1} time${count > 2 ? 's' : ''}`}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
                        <div className="text-[10px] uppercase font-bold text-[var(--mute)]">Printed By & Date</div>
                        <div className="font-semibold text-[var(--ink)] truncate">
                          {printRec?.lastPrintedBy || (count > 0 ? 'Authorized User' : 'Not Printed')}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--mute)] truncate mt-0.5">
                          {printRec?.lastPrintedAt ? new Date(printRec.lastPrintedAt).toLocaleString() : '-'}
                        </div>
                      </div>

                      {latestReq && (
                        <div className="col-span-2 p-2.5 rounded-lg bg-[var(--surf)] border border-[var(--line)] space-y-1.5">
                          <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                            <span>Reprint Request Audit Record</span>
                            <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 font-bold">
                              {latestReq.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--ink)]">
                            <span className="text-[var(--mute)]">Request Reason: </span>
                            <span className="font-bold">{latestReq.reason}</span>
                          </div>
                          {latestReq.notes && (
                            <div className="text-[10px] italic text-[var(--mute)]">
                              "{latestReq.notes}"
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[var(--line)] text-[var(--mute)]">
                            <span>Requested by: <b className="text-[var(--ink)]">{latestReq.requestedBy}</b> ({new Date(latestReq.requestedAt).toLocaleDateString()})</span>
                            <span className={`font-bold uppercase px-1.5 py-0.2 rounded ${
                              latestReq.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-600'
                                : latestReq.status === 'rejected'
                                ? 'bg-rose-500/15 text-rose-600'
                                : 'bg-amber-500/15 text-amber-600'
                            }`}>
                              {latestReq.status} {latestReq.reviewedBy ? `by ${latestReq.reviewedBy}` : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Bar inside Audit Box */}
                    <div className="pt-1 flex items-center justify-between gap-2">
                      {pStatus === 'Not Printed' && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              sessionStorage.setItem('meridian_print_asset_id', qrScannedAsset.id)
                            } catch {}
                            setQrScannedAsset(null)
                            window.location.hash = '#labels'
                          }}
                          className="w-full py-1.5 px-3 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition shadow-xs text-center flex items-center justify-center gap-1.5"
                        >
                          <span>🖨️</span>
                          <span>Print QR Label (First Print Authorized)</span>
                        </button>
                      )}

                      {pStatus === 'Printed' && (
                        <div className="w-full flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[var(--mute)] flex items-center gap-1">
                            <span>🔒</span>
                            <span>Button locked. Need another label?</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setReprintModalAsset(qrScannedAsset)
                              setReprintReason('Label Damaged / Scratched')
                              setReprintNotes('')
                            }}
                            className="py-1.5 px-3.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs transition shrink-0 flex items-center gap-1"
                          >
                            <span>📩</span>
                            <span>Request Reprint</span>
                          </button>
                        </div>
                      )}

                      {pStatus === 'Reprint Pending' && (
                        <div className="w-full p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>Reprint Request Pending HOD Approval</span>
                        </div>
                      )}

                      {pStatus === 'Approved' && (
                        <div className="w-full flex items-center justify-between gap-2">
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                            <span>🔓</span>
                            <span>HOD Approved (1 print unlocked)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                sessionStorage.setItem('meridian_print_asset_id', qrScannedAsset.id)
                              } catch {}
                              setQrScannedAsset(null)
                              window.location.hash = '#labels'
                            }}
                            className="py-1.5 px-3.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs transition shrink-0 flex items-center gap-1"
                          >
                            <span>🖨️</span>
                            <span>Print Approved Reprint</span>
                          </button>
                        </div>
                      )}

                      {pStatus === 'Rejected' && (
                        <div className="w-full flex items-center justify-between gap-2">
                          <span className="text-[11px] text-rose-600 font-medium">Reprint request was rejected by HOD.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setReprintModalAsset(qrScannedAsset)
                              setReprintReason('Label Damaged / Scratched')
                              setReprintNotes('')
                            }}
                            className="py-1 px-2.5 text-xs font-bold rounded-lg bg-[var(--surf2)] hover:bg-[var(--line)] border border-[var(--line)] text-[var(--ink)] cursor-pointer transition shrink-0"
                          >
                            New Request
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const asset = qrScannedAsset
                    setQrScannedAsset(null)
                    setWorkflowAsset(asset)
                    setIsAddModalOpen(true)
                  }}
                  className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition shadow-sm text-center"
                >
                  Edit / Audit Asset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQrScannedAsset(null)
                    try {
                      window.history.replaceState({}, '', window.location.pathname)
                    } catch {}
                  }}
                  className="py-2 px-4 text-xs font-semibold rounded-xl border border-[var(--line)] bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] cursor-pointer transition text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Reprint Modal Dialog (Mandatory Reason Enforced) */}
      {reprintModalAsset && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="Request Reprint Modal"
        >
          <div className="card p-6 max-w-md w-full space-y-4 border border-[var(--line)] shadow-2xl bg-[var(--surf)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">📩</span>
                <div>
                  <h3 className="font-bold text-sm text-[var(--ink)]">Request QR Label Reprint</h3>
                  <p className="text-[11px] text-[var(--mute)]">Asset: {reprintModalAsset.assetCode} ({reprintModalAsset.name})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReprintModalAsset(null)}
                className="w-7 h-7 rounded-lg hover:bg-[var(--surf2)] text-[var(--mute)] flex items-center justify-center cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!reprintReason || !reprintReason.trim()) {
                  toast.error('A mandatory reason must be provided to request a reprint.')
                  return
                }
                setReprintSubmitting(true)
                try {
                  createReprintRequest({
                    assetId: reprintModalAsset.id,
                    assetCode: reprintModalAsset.assetCode,
                    assetName: reprintModalAsset.name,
                    requester: currentUser,
                    reason: reprintReason,
                    notes: reprintNotes,
                  })
                  toast.success(`Reprint request submitted to HOD for approval!`)
                  setReprintModalAsset(null)
                  setReprintNotes('')
                } catch (err: any) {
                  toast.error(err?.message || 'Failed to submit reprint request.')
                } finally {
                  setReprintSubmitting(false)
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-bold text-[var(--ink)] mb-1">
                  Reason for Reprint <span className="text-red-500">* (Mandatory)</span>
                </label>
                <select
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value as ReprintReason)}
                  required
                  className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] font-medium outline-none focus:border-[var(--acc)]"
                >
                  {REPRINT_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[var(--mute)] mb-1">
                  Justification / Operational Notes (Optional)
                </label>
                <textarea
                  value={reprintNotes}
                  onChange={(e) => setReprintNotes(e.target.value)}
                  rows={3}
                  placeholder="Explain why a new sticker is required (e.g. damaged during line maintenance)..."
                  className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] outline-none focus:border-[var(--acc)] resize-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-700 dark:text-blue-300">
                ℹ️ <b>Governance Workflow:</b> Your request will be sent to the HOD for approval. Once approved, the Print QR button will unlock for exactly 1 print.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setReprintModalAsset(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surf2)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reprintSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {reprintSubmitting ? 'Submitting...' : 'Submit to HOD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Access Restricted Modal (Cross-Department RBAC Enforced) */}
      {qrAccessDenied && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
          role="alertdialog"
          aria-modal="true"
        >
          <div
            className="bg-[var(--surf)] border-2 border-red-500/50 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚫</span>
                  <h2 className="font-bold text-sm tracking-tight uppercase">
                    Department Access Restricted / 部门权限受限
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQrAccessDenied(null)
                    try {
                      window.history.replaceState({}, '', window.location.pathname)
                    } catch {}
                  }}
                  className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition"
                  aria-label="Close access denied modal"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-red-100 mt-1">
                You are authenticated, but unauthorized to view equipment outside your department.
              </p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs text-[var(--ink)]">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>🔒</span>
                  <span>Confidential Equipment Data Blocked</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Per factory RBAC security policy, equipment specifications, depreciation schedules, and hardware configurations are strictly isolated by department.
                </p>
              </div>

              {/* Department Comparison Table */}
              <div className="border border-[var(--line)] rounded-xl divide-y divide-[var(--line)] overflow-hidden">
                <div className="p-2.5 flex justify-between items-center bg-[var(--surf2)]/40">
                  <span className="text-[var(--mute)] font-medium">Scanned Asset Code:</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{qrAccessDenied.assetCode}</span>
                </div>
                <div className="p-2.5 flex justify-between items-center">
                  <span className="text-[var(--mute)] font-medium">Product Owning Dept:</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {qrAccessDenied.assetDepartment}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between items-center">
                  <span className="text-[var(--mute)] font-medium">Your Active Account:</span>
                  <span className="font-semibold">{qrAccessDenied.userName}</span>
                </div>
                <div className="p-2.5 flex justify-between items-center">
                  <span className="text-[var(--mute)] font-medium">Your Assigned Dept:</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                    {qrAccessDenied.userDepartment}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-[var(--mute)] bg-[var(--surf2)]/30 p-2.5 rounded-lg border border-[var(--line)]">
                ℹ️ If you need access to this equipment, please contact the <b>{qrAccessDenied.assetDepartment}</b> HOD or a Plant Administrator to transfer asset custodianship or request elevated permissions.
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQrAccessDenied(null)
                    try {
                      window.history.replaceState({}, '', window.location.pathname)
                    } catch {}
                  }}
                  className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-[var(--acc)] hover:opacity-90 text-white cursor-pointer transition shadow-sm text-center"
                >
                  Return to My Department Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AddAssetPanel
        open={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setWorkflowAsset(null)
        }}
        onSave={handleSaveAsset}
        initialAsset={workflowAsset}
        triggerRef={addAssetButtonRef}
        currentUser={currentUser}
      />

      {/* Notifications & Approvals Flyout Modal */}
      {isNotificationFlyoutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notif-flyout-title"
          className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-150"
          onClick={() => setIsNotificationFlyoutOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-[var(--surf)] border border-[var(--line)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 mt-12 max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-[var(--line)] bg-[var(--surf2)]/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 flex items-center justify-center text-base font-bold">
                    🔔
                  </div>
                  <div>
                    <h3 id="notif-flyout-title" className="text-sm font-bold text-[var(--ink)]">
                      Notifications & Approvals
                    </h3>
                    <div className="text-[11px] text-[var(--mute)]">
                      {pendingPasswordResetCount > 0
                        ? `${pendingPasswordResetCount} password reset, ${pendingReprintCount} re-print approval requests pending`
                        : `${pendingReprintCount} re-print approval ${pendingReprintCount === 1 ? 'request' : 'requests'} pending`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotificationFlyoutOpen(false)}
                  className="w-7 h-7 rounded-lg text-[var(--mute)] hover:bg-[var(--surf2)] hover:text-[var(--ink)] flex items-center justify-center text-sm transition cursor-pointer"
                  aria-label="Close notifications"
                >
                  ✕
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-[var(--line)]/60">
                <button
                  type="button"
                  onClick={() => setActiveNotifTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    activeNotifTab === 'all'
                      ? 'bg-[var(--ink)] text-[var(--surf)]'
                      : 'bg-[var(--surf)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  All ({totalPendingNotifications})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNotifTab('passwords')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeNotifTab === 'passwords'
                      ? 'bg-rose-600 text-white'
                      : 'bg-[var(--surf)] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  <span>🔑 Passwords</span>
                  <span>({pendingPasswordResetCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNotifTab('reprints')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeNotifTab === 'reprints'
                      ? 'bg-amber-600 text-white'
                      : 'bg-[var(--surf)] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  <span>🏷️ Re-prints</span>
                  <span>({pendingReprintCount})</span>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Password Reset Requests */}
              {(activeNotifTab === 'all' || activeNotifTab === 'passwords') &&
                pendingPasswordResetRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/5 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                            👤 {req.userId}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            Password Reset
                          </span>
                        </div>
                        <div className="text-xs font-bold text-[var(--ink)] mt-0.5">
                          {req.userName}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--mute)] shrink-0">
                        {req.id}
                      </span>
                    </div>

                    <div className="text-[11px] text-[var(--mute)] space-y-0.5 border-t border-[var(--line)] pt-2">
                      <div>
                        <b>Department:</b> <span className="text-[var(--ink)]">{req.department || 'Production & SMT'}</span>
                      </div>
                      <div>
                        <b>Plant:</b> <span className="text-[var(--ink)]">{req.plant || activeFactory}</span>
                      </div>
                      <div>
                        <b>Reason:</b> <span className="text-rose-600 dark:text-rose-400 font-semibold">{req.notes || 'Forgot password'}</span>
                      </div>
                      <div>
                        <b>Requested:</b> {new Date(req.requestedAt).toLocaleString()}
                      </div>
                    </div>

                    {isSuperuserOrAdmin && (
                      <div className="flex items-center gap-2 pt-1 border-t border-[var(--line)]/60">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedResetRequest(req)
                            setNewPasswordInput('Meridian@2026')
                            setIsResetModalOpen(true)
                          }}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-[#165DFF] hover:bg-[#1249cb] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                          <span>🔑</span>
                          <span>Set New Password</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await rejectPasswordResetRequest(req.id, currentUser, 'Rejected by Super User')
                            if (res.success) {
                              toast.info(`Rejected password reset request for ${req.userName}.`)
                            }
                          }}
                          className="py-1.5 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <span>✕</span>
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

              {/* Reprint Requests */}
              {(activeNotifTab === 'all' || activeNotifTab === 'reprints') &&
                pendingReprintRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-[var(--ink)]">
                            🏷️ {req.assetCode}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Re-print Request
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-[var(--ink)] mt-0.5 truncate max-w-[280px]">
                          {req.assetName || 'Equipment Unit'}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--mute)] shrink-0">
                        {req.id}
                      </span>
                    </div>

                    <div className="text-[11px] text-[var(--mute)] space-y-0.5 border-t border-[var(--line)] pt-2">
                      <div>
                        <b>Requested by:</b> <span className="text-[var(--ink)] font-semibold">{req.requestedBy || 'Staff'}</span> ({req.requesterDept || req.department || 'Production & SMT'})
                      </div>
                      <div>
                        <b>Reason:</b> <span className="text-amber-600 dark:text-amber-400 font-semibold">{req.reason}</span>
                      </div>
                      {req.notes && (
                        <div>
                          <b>Notes:</b> <i>"{req.notes}"</i>
                        </div>
                      )}
                      <div>
                        <b>Date:</b> {new Date(req.requestedAt).toLocaleString()}
                      </div>
                    </div>

                    {isSuperuserOrAdmin ? (
                      <div className="flex items-center gap-2 pt-1 border-t border-[var(--line)]/60">
                        <button
                          type="button"
                          onClick={() => {
                            const res = approveReprintRequest(req.id, currentUser, 'Approved by Super User')
                            if (res) {
                              toast.success(`Approved re-print for ${req.assetCode}! Print button unlocked for 1 print.`)
                            }
                          }}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer"
                        >
                          <span>✓</span>
                          <span>Approve 1-Time Print</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const res = rejectReprintRequest(req.id, currentUser, 'Rejected by Super User')
                            if (res) {
                              toast.info(`Rejected re-print request for ${req.assetCode}.`)
                            }
                          }}
                          className="py-1.5 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <span>✕</span>
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-600 font-medium">
                        ⏳ Under Review by HOD / Super User
                      </div>
                    )}
                  </div>
                ))}

              {totalPendingNotifications === 0 && (
                <div className="py-10 text-center space-y-2">
                  <div className="text-3xl">🎉</div>
                  <div className="text-xs font-bold text-[var(--ink)]">All Approvals Up to Date</div>
                  <div className="text-[11px] text-[var(--mute)] max-w-xs mx-auto">
                    No pending password resets or reprint requests. Industrial security and single-print governance are fully synchronized.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[var(--line)] bg-[var(--surf2)]/30 flex items-center justify-between text-xs">
              <a
                href="#labels"
                onClick={() => setIsNotificationFlyoutOpen(false)}
                className="text-[var(--acc)] hover:underline font-semibold flex items-center gap-1"
              >
                <span>View Full Print & Approval Center</span>
                <span>→</span>
              </a>
              <button
                type="button"
                onClick={() => setIsNotificationFlyoutOpen(false)}
                className="px-3 py-1 rounded-lg border border-[var(--line)] bg-[var(--surf)] hover:bg-[var(--surf2)] text-[var(--ink)] font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super User Set New Password Modal */}
      {isResetModalOpen && selectedResetRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 text-xs text-[var(--ink)] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">👑</span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    Set New Password (Super User)
                  </h3>
                  <div className="text-[10px] text-[var(--mute)]">
                    Ticket: {selectedResetRequest.id}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsResetModalOpen(false)
                  setSelectedResetRequest(null)
                  setNewPasswordInput('')
                }}
                className="w-7 h-7 rounded-lg text-[var(--mute)] hover:bg-[var(--surf2)] flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Requester details */}
            <div className="p-3 rounded-xl bg-[var(--surf2)]/60 border border-[var(--line)] space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[var(--mute)]">Employee Name:</span>
                <span className="font-bold text-[var(--ink)]">{selectedResetRequest.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--mute)]">Employee ID:</span>
                <span className="font-mono font-bold text-[var(--acc)]">{selectedResetRequest.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--mute)]">Department:</span>
                <span>{selectedResetRequest.department || 'Production & SMT'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--mute)]">Plant:</span>
                <span>{selectedResetRequest.plant}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--mute)]">Requested:</span>
                <span>{new Date(selectedResetRequest.requestedAt).toLocaleString()}</span>
              </div>
            </div>

            {/* New Password Input Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newPasswordInput || newPasswordInput.length < 4) {
                  toast.error('New password must be at least 4 characters long.')
                  return
                }
                setIsSettingPassword(true)
                try {
                  const res = await resolvePasswordResetRequest(
                    selectedResetRequest.id,
                    newPasswordInput,
                    currentUser
                  )
                  if (res.success) {
                    toast.success(`New password set successfully for ${selectedResetRequest.userName}!`)
                    setIsResetModalOpen(false)
                    setSelectedResetRequest(null)
                    setNewPasswordInput('')
                  } else {
                    toast.error(res.message || 'Failed to update password')
                  }
                } catch (err: any) {
                  toast.error(err?.message || 'Error updating password')
                } finally {
                  setIsSettingPassword(false)
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="admin-new-pw" className="font-semibold text-[11px]">
                    Enter New Password for User *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const samplePasswords = ['Meridian@2026', 'Factory@789', 'IndiaPlant#2026', 'Pass#SMT88']
                      const chosen = samplePasswords[Math.floor(Math.random() * samplePasswords.length)]
                      setNewPasswordInput(chosen)
                    }}
                    className="text-[10px] text-[var(--acc)] hover:underline cursor-pointer font-semibold"
                  >
                    🎲 Suggest Password
                  </button>
                </div>
                <input
                  id="admin-new-pw"
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="e.g. Meridian@2026"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] font-mono text-xs focus:outline-none focus:border-[var(--acc)]"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-300">
                ✓ Saving will immediately unlock account lockout and activate this new password for {selectedResetRequest.userName} across all workshop terminals.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSettingPassword}
                  className="flex-1 py-2 px-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSettingPassword ? (
                    <span>⏳ Saving password...</span>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Confirm & Apply New Password</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false)
                    setSelectedResetRequest(null)
                    setNewPasswordInput('')
                  }}
                  className="px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default App
