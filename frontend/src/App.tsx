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
import { isAssetTaskCompleted } from '@/types/asset'
import type { Language } from '@/lib/indiaLocale'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { exportAssetsToExcel } from '@/lib/excelExport'
import {
  saveAssetsToStorage,
  loadAssetsFromStorage,
  fetchBackendAssets,
  fetchBackendAssetCount,
  pushAssetsToBackend,
  purgeBackendAssets,
} from '@/lib/assetStorage'
import { DigitalTwinFacility3D } from '@/components/DigitalTwinFacility3D'
import { ExecutiveBentoGrid3D } from '@/components/ExecutiveBentoGrid3D'
import { initialAssets } from '@/data/mockAssets'
import { masterMappingService } from '@/lib/masterMappingService'

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
const UserManagementView = React.lazy(() => import('@/components/UserManagementView'))
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
    return (
      sessionStorage.getItem('meridian_auth') === 'true' ||
      localStorage.getItem('meridian_remember_user') !== null ||
      window.location.hash.includes('offline')
    )
  })
  const [activeFactory, setActiveFactory] = React.useState<string>(() => {
    return (
      sessionStorage.getItem('meridian_active_factory') ||
      localStorage.getItem('meridian_remember_factory') ||
      'Noida Plant (SMT Line & Assembly)'
    )
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
  const [dashSearchQuery, setDashSearchQuery] = React.useState<string>('')
  const [previewImage, setPreviewImage] = React.useState<{ url: string; title: string; code: string } | null>(null)
  const [qrScannedAsset, setQrScannedAsset] = React.useState<Asset | null>(null)
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

  // Scope assets strictly by the active user's department or identity
  const scopedAssets = React.useMemo(() => {
    if (isSuperuserOrAdmin) {
      return assets
    }
    const userDept = (currentUser.department || '').trim().toLowerCase()
    const userId = (currentUser.userId || '').trim().toLowerCase()
    const userName = (currentUser.userName || '').trim().toLowerCase()

    return assets.filter((a) => {
      const assetDept = (a.currentDepartment || a.department || '').trim().toLowerCase()
      const inChargeId = (a.inChargeId || '').trim().toLowerCase()
      const inChargeName = (a.inChargeName || a.whoInCharge || '').trim().toLowerCase()
      const submitter = (a.submitter || '').trim().toLowerCase()

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
  }, [assets, isSuperuserOrAdmin, currentUser.department, currentUser.userId, currentUser.userName])

  const filteredDashboardAssets = React.useMemo(() => {
    if (scopedAssets.length === 0) return []
    return scopedAssets.filter((a) => {
      // Exclude pending/incomplete task queue codes that have not yet had their data filled
      if (!isAssetTaskCompleted(a)) {
        return false
      }
      // Company filter: IIPL or Padget
      if (dashCompanyFilter !== 'All') {
        const comp = a.company || (a.location?.includes('Padget') ? 'Padget' : 'IIPL')
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
  }, [scopedAssets, dashCompanyFilter, dashBuildingFilter, dashSearchQuery])

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

        // 2. Fetch master assets from central backend SQLite database
        const backendAssets = await fetchBackendAssets()
        if (!isMounted) return

        if (backendAssets && backendAssets.length > 0) {
          setAssets((prev) => {
            // Deduplicate and merge backend assets
            const existingMap = new Map(prev.map((a) => [String(a.assetCode || a.assetTag || a.id).toLowerCase(), a]))
            for (const ba of backendAssets) {
              existingMap.set(String(ba.assetCode || ba.assetTag || ba.id).toLowerCase(), ba)
            }
            const merged = Array.from(existingMap.values())
            if (merged.length !== prev.length || backendAssets.length > prev.length) {
              void saveAssetsToStorage(merged)
              return sanitizeAssetList(merged)
            }
            return prev
          })

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

    // 3. Periodic background sync: lightweight ping every 15 seconds; only downloads full data if count changes
    const syncInterval = setInterval(() => {
      fetchBackendAssetCount().then((count) => {
        if (!isMounted || count === null) return
        setAssets((prev) => {
          if (count > prev.length) {
            fetchBackendAssets().then((backendAssets) => {
              if (!isMounted || !backendAssets || backendAssets.length === 0) return
              setAssets((current) => {
                const existingMap = new Map(current.map((a) => [String(a.assetCode || a.assetTag || a.id).toLowerCase(), a]))
                for (const ba of backendAssets) {
                  existingMap.set(String(ba.assetCode || ba.assetTag || ba.id).toLowerCase(), ba)
                }
                const merged = Array.from(existingMap.values())
                void saveAssetsToStorage(merged)
                return sanitizeAssetList(merged)
              })
            }).catch(() => {})
          }
          return prev
        })
      }).catch(() => {})
    }, 15000)

    return () => {
      isMounted = false
      clearInterval(syncInterval)
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
            toast.error(`Asset not found for scanned code: ${targetCode}`)
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

  const handleImportAssetCodes = (codesOrAssets: (string | Partial<Asset>)[]) => {
    const importedAt = new Date().toISOString().slice(0, 10)
    const importedCodes: Asset[] = codesOrAssets.map((item, idx) => {
      if (typeof item === 'string') {
        const code = item
        const uniqueId = `imported-${code}-${idx + 1}-${Date.now().toString(36)}`
        return {
          id: uniqueId,
          assetCode: code,
          serialNumber: '',
          currentCategory: 'Equipment',
          currentDescription: '',
          plant: 'Noida Central Plant',
          building: 'C39',
          company: 'ismartu',
          assetCondition: '',
          date: importedAt,
          name: code,
          assetTag: code,
          category: 'Equipment',
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
      return {
        id: uniqueId,
        assetCode: code,
        serialNumber: item.serialNumber || '',
        currentCategory: item.currentCategory || item.category || 'Equipment',
        category: item.category || item.currentCategory || 'Equipment',
        assetClass: item.assetClass || item.currentCategory || '',
        currentDescription: item.currentDescription || item.name || code,
        name: item.name || item.currentDescription || code,
        company: item.company || 'ismartu',
        companyCode: item.companyCode || (item.company === 'Padget' ? '5030' : '5020'),
        plant: item.plant || 'Noida Central Plant',
        building: item.building || 'C39',
        floor: item.floor || '',
        location: item.location || 'C-39 Factory Noida',
        currentLocation: item.currentLocation || item.location || '',
        costCenter: item.costCenter || '',
        department: item.department || item.currentDepartment || 'Production',
        currentDepartment: item.currentDepartment || item.department || 'Production',
        inChargeId: item.inChargeId || '',
        inChargeName: item.inChargeName || '',
        submitter: item.submitter || '',
        submitterId: item.submitterId || '',
        submitterDepartment: item.submitterDepartment || '',
        assetCondition: item.assetCondition || '',
        purchaseDate: item.purchaseDate || importedAt,
        capitalizationDate: item.capitalizationDate || item.purchaseDate || importedAt,
        date: item.date || importedAt,
        purchaseCost: item.purchaseCost ?? 0,
        currentValue: item.currentValue ?? 0,
        assignedTo: item.assignedTo || '',
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

                    {/* Administration */}
                    <a
                      className={currentHash === 'administration' ? 'on' : ''}
                      href="#administration"
                      onClick={(e) => handleNavClick('administration', e)}
                      title={isMini ? 'Administration' : undefined}
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
                      </svg>
                      <span>Administration</span>
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
                      className={currentHash === 'rbac' ? 'on' : ''}
                      href="#rbac"
                      onClick={(e) => handleNavClick('rbac', e)}
                      title={isMini ? 'User & RBAC Administration' : undefined}
                      style={{ color: currentHash === 'rbac' ? undefined : '#9333ea' }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      <span>User & RBAC</span>
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
              className="ico"
              aria-label="Notifications"
              onClick={() => toast('No new notifications')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 19a2 2 0 0 0 4 0" />
              </svg>
              <i className="dot" />
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
                <section className="card p-5 space-y-4 bg-gradient-to-r from-[var(--surf)] via-[var(--surf)] to-[var(--surf2)] border border-[var(--line)] shadow-xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#165DFF] to-[#0f44bd] text-white flex items-center justify-center text-xl font-black shadow-md shadow-[#165DFF]/20">
                        {totalAssets}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[var(--ink)]">
                            Active Deployed Fleet
                          </h3>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Telemetry
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--mute)] mt-0.5">
                          Enterprise equipment tracking across IIPL & Padget manufacturing sites
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surf)] border border-[var(--line)] shadow-2xs hover:border-[var(--ok)]/40 transition">
                        <span className="sw" style={{ background: 'var(--ok)' }} />
                        <span className="text-[var(--mute)]">Operational:</span>
                        <b className="font-bold text-[var(--ink)]">{healthyCount}</b>
                        <span className="text-[10px] text-[var(--mute)]">operational</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surf)] border border-[var(--line)] shadow-2xs hover:border-[var(--warn)]/40 transition">
                        <span className="sw" style={{ background: 'var(--warn)' }} />
                        <span className="text-[var(--mute)]">Service Due:</span>
                        <b className="font-bold text-[var(--ink)]">{maintenanceCount}</b>
                        <span className="text-[10px] text-[var(--mute)]">service due</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surf)] border border-[var(--line)] shadow-2xs hover:border-[var(--acc)]/40 transition">
                        <span className="sw" style={{ background: 'var(--acc)' }} />
                        <span className="text-[var(--mute)]">Reserved:</span>
                        <b className="font-bold text-[var(--ink)]">{reservedCount}</b>
                        <span className="text-[10px] text-[var(--mute)]">reserved</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surf)] border border-[var(--line)] shadow-2xs hover:border-[var(--bad)]/40 transition">
                        <span className="sw" style={{ background: 'var(--bad)' }} />
                        <span className="text-[var(--mute)]">Retired:</span>
                        <b className="font-bold text-[var(--ink)]">{retiredCount}</b>
                        <span className="text-[10px] text-[var(--mute)]">retired</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Status Allocation Meter */}
                  <div className="w-full bg-[var(--surf2)] h-2 rounded-full overflow-hidden flex border border-[var(--line)]/50">
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

                {/* 3D Bento-Box Command Grid */}
                <div className="mt-5">
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
                <div className="mt-5">
                  <DigitalTwinFacility3D
                    assets={completedAssetsList}
                    activeBuildingFilter={dashBuildingFilter}
                    onSelectBuilding={(bldg) => {
                      setDashBuildingFilter(bldg as any)
                    }}
                    onOpenAsset={(asset) => {
                      setWorkflowAsset(asset)
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
                    <div className="overflow-x-auto mt-3">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--line)] text-[var(--mute)] uppercase tracking-wider text-[11px]">
                            <th className="py-2.5 px-3">Picture</th>
                            <th className="py-2.5 px-3">Asset Code</th>
                            <th className="py-2.5 px-3">Company</th>
                            <th className="py-2.5 px-3">Building</th>
                            <th className="py-2.5 px-3">Floor</th>
                            <th className="py-2.5 px-3">Belong to Dept</th>
                            <th className="py-2.5 px-3">Who in Charge (ID, Name)</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)]">
                          {filteredDashboardAssets.map((asset) => {
                            const comp = asset.company || (asset.location?.includes('Padget') ? 'Padget' : 'IIPL')
                            const bldg = asset.building || 'C39'
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
            ) : currentHash === 'rbac' ? (
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
            ) : currentHash === 'users' || currentHash === 'rbac' ? (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--mute)]">Loading Department RBAC & User Management...</div>}>
                <UserManagementView
                  currentUser={currentUser}
                  onSwitchUser={(user) => {
                    setCurrentUser(user)
                    setCurrentUserProfile(user)
                    setTempUserName(user.userName)
                    setTempUserId(user.userId)
                    setTempUserRole(user.role)
                    setTempUserDepartment(user.department || 'IT')
                  }}
                  lang={lang}
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
                    {activePage.b.length > 0 ? (
                      activePage.b.map((r, idx) => (
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
                    ) : (
                      <div className="py-8 text-center text-xs" style={{ color: 'var(--mute)' }}>
                        No category breakdown data available.
                      </div>
                    )}
                  </section>
                </div>

                {currentHash === 'administration' && (
                  <div style={{ marginTop: '24px' }}>
                    <React.Suspense fallback={<div className="p-4 text-center text-xs text-[var(--mute)]">Loading Department RBAC & User Management...</div>}>
                      <UserManagementView
                        currentUser={currentUser}
                        onSwitchUser={(user) => {
                          setCurrentUser(user)
                          setCurrentUserProfile(user)
                          setTempUserName(user.userName)
                          setTempUserId(user.userId)
                          setTempUserRole(user.role)
                          setTempUserDepartment(user.department || 'IT')
                        }}
                        lang={lang}
                      />
                    </React.Suspense>
                  </div>
                )}
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
                      setCurrentHash('administration')
                      window.location.hash = '#administration'
                    }}
                    className="w-full text-center py-2 px-3 text-xs font-semibold rounded-lg border border-[var(--acc)]/30 text-[var(--acc)] bg-[var(--acc)]/5 hover:bg-[var(--acc)]/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🛡️</span>
                    <span>Manage Department Users & Passwords (RBAC)</span>
                  </button>

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
              {/* Asset Code Hero Box */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                <div>
                  <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">资产编号 / Asset No.</div>
                  <div className="text-lg font-black text-[var(--ink)] font-mono">{qrScannedAsset.assetCode}</div>
                </div>
                <div className="text-right">
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
                    {qrScannedAsset.serialNumber || qrScannedAsset.currentCategory || '-'}
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
    </>
  )
}

export default App
