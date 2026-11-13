import * as React from 'react'
import { meridianPages, aiAnswers } from '@/data/meridianData'
import { AddAssetPanel } from '@/components/AddAssetPanel'
import { AssetLibraryView } from '@/components/AssetLibraryView'
import { AuditLogView } from '@/components/AuditLogView'
import {
  logAuditEvent,
  getCurrentUserProfile,
  setCurrentUserProfile,
  type UserProfile,
} from '@/lib/deviceTracker'
import type { Asset } from '@/types/asset'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

const STORAGE_KEY = 'meridian_assets'

export function App() {
  const [currentHash, setCurrentHash] = React.useState<string>(() => {
    const h = window.location.hash.replace('#', '')
    return h && meridianPages[h] ? h : 'dashboard'
  })
  const [isMini, setIsMini] = React.useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  })
  const [aiAnswer, setAiAnswer] = React.useState<string>('')
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [dashCompanyFilter, setDashCompanyFilter] = React.useState<'All' | 'IIPL' | 'Padget'>('All')
  const [dashBuildingFilter, setDashBuildingFilter] = React.useState<string>('All')
  const [dashSearchQuery, setDashSearchQuery] = React.useState<string>('')
  const [previewImage, setPreviewImage] = React.useState<{ url: string; title: string; code: string } | null>(null)
  const addAssetButtonRef = React.useRef<HTMLButtonElement>(null)
  const [assets, setAssets] = React.useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const [currentUser, setCurrentUser] = React.useState<UserProfile>(() => getCurrentUserProfile())
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false)
  const [tempUserName, setTempUserName] = React.useState(currentUser.userName)
  const [tempUserId, setTempUserId] = React.useState(currentUser.userId)
  const [tempUserRole, setTempUserRole] = React.useState(currentUser.role)

  const dynamicGreeting = React.useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const filteredDashboardAssets = React.useMemo(() => {
    if (assets.length === 0) return []
    return assets.filter((a) => {
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
  }, [assets, dashCompanyFilter, dashBuildingFilter, dashSearchQuery])

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
    }
    setCurrentUserProfile(updated)
    setCurrentUser(updated)
    setIsProfileModalOpen(false)
    logAuditEvent('LOGIN', { authMethod: 'Profile Switch', user: updated })
    toast.success(`Logged in as ${updated.userName} (${updated.role})`)
  }

  // Sync to local storage safely with quota protection
  React.useEffect(() => {
    try {
      const safeSubset = assets.length > 2000 ? assets.slice(0, 2000) : assets
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSubset))
    } catch (err) {
      console.warn('Failed to sync assets to localStorage', err)
    }
  }, [assets])

  // Sync hash routing
  React.useEffect(() => {
    // Record LOGIN audit event with auto device tracking on initial mount
    logAuditEvent('LOGIN', { authMethod: 'Session Auto-Resume', platform: 'Web' })

    const onHashChange = () => {
      const h = window.location.hash.replace('#', '')
      const key = h && meridianPages[h] ? h : 'dashboard'
      setCurrentHash(key)
      setIsDrawerOpen(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Auto-close mobile drawer on window resize to desktop
  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) {
        setIsDrawerOpen(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Ctrl+K shortcut
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
  }

  // Handle sidebar collapse toggle
  const handleToggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setIsDrawerOpen((prev) => !prev)
    } else {
      setIsMini((prev) => !prev)
    }
  }

  const handleNavClick = (key: string, e: React.MouseEvent) => {
    e.preventDefault()
    window.location.hash = `#${key}`
    setCurrentHash(key)
    setIsDrawerOpen(false)
    window.scrollTo(0, 0)
  }

  const handleSaveAsset = (newAsset: Asset) => {
    setAssets((prev) => [newAsset, ...prev])
    logAuditEvent(
      'ASSET_CREATE',
      {
        assetCode: newAsset.assetCode,
        serialNumber: newAsset.serialNumber,
        name: newAsset.currentDescription || newAsset.name,
        category: newAsset.currentCategory || newAsset.category,
        plant: newAsset.plant,
        department: newAsset.currentDepartment || newAsset.department,
        condition: newAsset.assetCondition,
        unavailabilityReasons: newAsset.unavailabilityReasons,
        remarks: newAsset.remarks,
      },
      newAsset.assetCode
    )
    setCurrentHash('assets')
    window.location.hash = '#assets'
  }

  const handleDeleteAsset = (id: string) => {
    const target = assets.find((a) => a.id === id || a.assetCode === id)
    setAssets((prev) => prev.filter((a) => a.id !== id && a.assetCode !== id))

    const assetCode = target?.assetCode || id
    const assetName = target?.currentDescription || target?.name || 'Equipment Unit'
    const category = target?.currentCategory || target?.category || 'General Equipment'
    const plant = target?.plant || target?.location || 'Main Center'

    logAuditEvent(
      'ASSET_DELETE',
      {
        deletedItemType: 'Physical Asset',
        deletedId: id,
        assetCode,
        name: assetName,
        serialNumber: target?.serialNumber || 'N/A',
        category,
        plant,
        condition: target?.assetCondition || 'Good',
        department: target?.currentDepartment || target?.department || 'Operations',
        assignedTo: target?.assignedTo || target?.submitter || 'Unassigned',
        remarks: target?.remarks || '',
        deletionTimestamp: new Date().toISOString(),
        deletionReason: 'User initiated deletion from Asset Registry',
      },
      assetCode,
      'Asset'
    )
    toast.success(`Asset "${assetCode} (${assetName})" deleted`)
  }

  const handleClearAllAssets = () => {
    if (assets.length === 0) return
    const count = assets.length
    const deletedSummary = assets.slice(0, 10).map((a) => `${a.assetCode} (${a.currentDescription || a.name})`)
    setAssets([])
    logAuditEvent(
      'ASSET_DELETE',
      {
        deletedItemType: 'Bulk Asset Purge',
        count,
        summary: deletedSummary.join(', ') + (count > 10 ? ` and ${count - 10} more` : ''),
        deletedAssetsList: assets.slice(0, 50).map((a) => ({
          code: a.assetCode,
          name: a.name || a.currentDescription,
          serial: a.serialNumber,
          plant: a.plant,
        })),
        deletionTimestamp: new Date().toISOString(),
        deletionReason: 'User purged all physical assets from inventory',
      },
      'ALL-PHYSICAL-ASSETS',
      'Asset'
    )
    toast.success('All physical assets removed from registry')
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

  const isDashboard = currentHash === 'dashboard'
  const activePage = meridianPages[currentHash]

  // Calculated dynamic metrics
  const totalAssets = assets.length
  const healthyCount = assets.filter((a) => a.status === 'Active').length
  const maintenanceCount = assets.filter((a) => a.status === 'Maintenance').length
  const reservedCount = assets.filter((a) => a.status === 'Reserved').length
  const retiredCount = assets.filter((a) => a.status === 'Retired').length
  const totalSpend = assets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0)

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
          <div className="brand">
            <div className="mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8">
                <path d="M2 12 8 3l6 9H2Z" />
              </svg>
            </div>
            <span>Meridian</span>
          </div>

          <nav className="nav" aria-label="Main">
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

            <a
              className={currentHash === 'library' ? 'on' : ''}
              href="#library"
              onClick={(e) => handleNavClick('library', e)}
              title={isMini ? 'Asset Library' : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="4" width="4" height="16" rx="1" />
                <rect x="10" y="4" width="4" height="16" rx="1" />
                <path d="M16 4.5l3.5 15" strokeLinecap="round" />
              </svg>
              <span>Asset Library</span>
            </a>

            <a
              className={currentHash === 'assets' ? 'on' : ''}
              href="#assets"
              onClick={(e) => handleNavClick('assets', e)}
              title={isMini ? 'Asset Gallery' : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M8 20h8M12 16v4" strokeLinecap="round" />
              </svg>
              <span>Asset Gallery</span>
            </a>

            <a
              className={currentHash === 'audit' ? 'on' : ''}
              href="#audit"
              onClick={(e) => handleNavClick('audit', e)}
              title={isMini ? 'Audit & Tracking' : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Audit & Tracking</span>
            </a>

            <a
              className={currentHash === 'inventory' ? 'on' : ''}
              href="#inventory"
              onClick={(e) => handleNavClick('inventory', e)}
              title={isMini ? 'Inventory' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
                <path d="m3 8 9 5 9-5M12 13v8" />
              </svg>
              <span>Inventory</span>
            </a>

            <a
              className={currentHash === 'maintenance' ? 'on' : ''}
              href="#maintenance"
              onClick={(e) => handleNavClick('maintenance', e)}
              title={isMini ? 'Maintenance' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.6-.6-2.6 2.6-2.2Z" />
              </svg>
              <span>Maintenance</span>
            </a>

            <a
              className={currentHash === 'workorders' ? 'on' : ''}
              href="#workorders"
              onClick={(e) => handleNavClick('workorders', e)}
              title={isMini ? 'Work orders' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <path d="M9 8h6M9 12h6M9 16h3" />
              </svg>
              <span>Work orders</span>
            </a>

            <a
              className={currentHash === 'employees' ? 'on' : ''}
              href="#employees"
              onClick={(e) => handleNavClick('employees', e)}
              title={isMini ? 'Employees' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .7 3.2 2.4 3.5 5" />
              </svg>
              <span>Employees</span>
            </a>

            <a
              className={currentHash === 'locations' ? 'on' : ''}
              href="#locations"
              onClick={(e) => handleNavClick('locations', e)}
              title={isMini ? 'Locations' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span>Locations</span>
            </a>

            <a
              className={currentHash === 'reports' ? 'on' : ''}
              href="#reports"
              onClick={(e) => handleNavClick('reports', e)}
              title={isMini ? 'Reports' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </svg>
              <span>Reports</span>
            </a>

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
          </nav>
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
                placeholder="Search assets, people, work orders"
                aria-label="Search assets, people, work orders"
              />
              <kbd>Ctrl K</kbd>
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

            <button
              type="button"
              className="me cursor-pointer border-none font-bold"
              onClick={() => {
                setTempUserName(currentUser.userName)
                setTempUserId(currentUser.userId)
                setTempUserRole(currentUser.role)
                setIsProfileModalOpen(true)
              }}
              title={`Logged in as ${currentUser.userName} (${currentUser.role}) · Click to switch user profile`}
              aria-label="User profile and login session"
            >
              {userInitials}
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
                      · 0 active alerts · last synced just now
                    </div>
                  </div>
                  <div className="btns">
                    <button
                      className="btn"
                      onClick={() => {
                        if (assets.length === 0) {
                          toast.warning('Register at least one asset before exporting.')
                          return
                        }
                        toast.success('Export report initiated')
                      }}
                    >
                      Export report
                    </button>
                    <button className="btn p" onClick={() => setIsAddModalOpen(true)}>
                      Add asset
                    </button>
                  </div>
                </div>

                {/* Fleet Health Hero Band */}
                <section className="card hero" aria-label="Fleet health">
                  <div className="big">
                    <span className="n">{totalAssets}</span>
                    <span>assets under management</span>
                    <span className="chg">
                      {totalAssets === 0 ? 'Register equipment to begin tracking' : `${totalAssets} active records`}
                    </span>
                  </div>
                  <div className="band" role="img" aria-label="Fleet health status band">
                    {totalAssets > 0 ? (
                      <>
                        <i style={{ flex: healthyCount || 1, background: 'var(--ok)' }} />
                        <i style={{ flex: reservedCount || 0, background: '#7fbf9f' }} />
                        <i style={{ flex: maintenanceCount || 0, background: 'var(--warn)' }} />
                        <i style={{ flex: retiredCount || 0, background: 'var(--bad)' }} />
                      </>
                    ) : (
                      <i style={{ flex: 1, background: 'var(--surf2)' }} />
                    )}
                  </div>
                  <div className="leg">
                    <div>
                      <span className="sw" style={{ background: 'var(--ok)' }} />
                      <b>{healthyCount}</b> healthy
                    </div>
                    <div>
                      <span className="sw" style={{ background: '#7fbf9f' }} />
                      <b>{reservedCount}</b> reserved
                    </div>
                    <div>
                      <span className="sw" style={{ background: 'var(--warn)' }} />
                      <b>{maintenanceCount}</b> service due
                    </div>
                    <div>
                      <span className="sw" style={{ background: 'var(--bad)' }} />
                      <b>{retiredCount}</b> retired
                    </div>
                  </div>
                </section>

                {/* 4 Summary Cards */}
                <div className="kpis">
                  <div className="card k">
                    <div className="l">Maintenance due</div>
                    <div className="v">{maintenanceCount}</div>
                    <div className="d">
                      <span className="pill ok">0 overdue</span> next 14 days
                    </div>
                  </div>
                  <div className="card k">
                    <div className="l">Warranties expiring</div>
                    <div className="v">0</div>
                    <div className="d">
                      <span className="pill ok">0 within 30 days</span>
                    </div>
                  </div>
                  <div className="card k">
                    <div className="l">Open work orders</div>
                    <div className="v">0</div>
                    <div className="d">
                      <span className="pill ok">All closed</span>
                    </div>
                  </div>
                  <div className="card k">
                    <div className="l">Spend this quarter</div>
                    <div className="v">${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="d">
                      <span className="pill ok">On budget</span>
                    </div>
                  </div>
                </div>

                {/* Facility Assets Register - IIPL & Padget Deployed Units (C39, D197, D198, D199) */}
                <section className="card" style={{ marginTop: '20px', padding: '20px' }} aria-label="Facility Assets Register">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏢</span>
                        <h2 className="text-base font-bold text-[var(--ink)]">
                          Facility Assets Register
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[var(--acc)]/10 text-[var(--acc)]">
                          {filteredDashboardAssets.length} of {assets.length} Deployed
                        </span>
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
                      <div className="flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surf)]" title="Filter by Company">
                        {(['All', 'IIPL', 'Padget'] as const).map((comp) => (
                          <button
                            key={comp}
                            type="button"
                            onClick={() => setDashCompanyFilter(comp)}
                            className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                              dashCompanyFilter === comp
                                ? 'bg-[var(--acc)] text-white shadow-xs'
                                : 'text-[var(--mute)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {comp === 'All' ? 'All Co.' : comp}
                          </button>
                        ))}
                      </div>

                      {/* Building Filter */}
                      <div className="flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surf)]" title="Filter by Building">
                        {(['All', 'C39', 'D197', 'D198', 'D199'] as const).map((bldg) => (
                          <button
                            key={bldg}
                            type="button"
                            onClick={() => setDashBuildingFilter(bldg)}
                            className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                              dashBuildingFilter === bldg
                                ? 'bg-[var(--acc)] text-white shadow-xs'
                                : 'text-[var(--mute)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {bldg === 'All' ? 'All Bldgs' : bldg}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="btn p text-xs py-1 px-3"
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
                                      title="No photo uploaded"
                                    >
                                      📦
                                    </div>
                                  )}
                                </td>

                                {/* Asset Code */}
                                <td className="py-2.5 px-3">
                                  <div className="font-mono font-bold text-[var(--ink)] text-xs">
                                    {asset.assetCode}
                                  </div>
                                  <div className="text-[11px] text-[var(--mute)] truncate max-w-[150px]" title={asset.currentDescription || asset.name}>
                                    {asset.currentDescription || asset.name}
                                  </div>
                                </td>

                                {/* Company: IIPL or Padget */}
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                      comp === 'Padget'
                                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                    }`}
                                  >
                                    <span>{comp === 'Padget' ? '🏭' : '🏢'}</span>
                                    <span>{comp}</span>
                                  </span>
                                </td>

                                {/* Building: C39, D197, D198, D199 */}
                                <td className="py-2.5 px-3">
                                  <span className="inline-flex items-center gap-1 font-semibold text-xs text-[var(--ink)] px-2 py-0.5 rounded border border-[var(--line)] bg-[var(--surf)]">
                                    <span>🏛️</span>
                                    <span>{bldg}</span>
                                  </span>
                                </td>

                                {/* Floor */}
                                <td className="py-2.5 px-3 text-xs text-[var(--ink)]">
                                  <span className="inline-flex items-center gap-1 text-[var(--mute)]">
                                    <span>📍</span>
                                    <span className="font-medium text-[var(--ink)]">{flr}</span>
                                  </span>
                                </td>

                                {/* Belong to which dept */}
                                <td className="py-2.5 px-3">
                                  <span className="inline-block px-2 py-0.5 rounded bg-[var(--acc)]/10 text-[var(--acc)] font-medium text-xs">
                                    {dept}
                                  </span>
                                </td>

                                {/* Who in charge (ID, name) */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[var(--surf2)] border border-[var(--line)] text-xs flex items-center justify-center font-bold text-[var(--acc)] shrink-0">
                                      👤
                                    </div>
                                    <div>
                                      <div className="font-semibold text-xs text-[var(--ink)]">
                                        {inChargeDisplayName}
                                      </div>
                                      <div className="text-[10.5px] font-mono text-[var(--mute)]">
                                        ID: <span className="font-bold text-[var(--ink)]">{inChargeDisplayId}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Action: Bin delete */}
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAsset(asset.id)}
                                    className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer border border-transparent hover:border-red-500/20"
                                    title={`Delete asset ${asset.assetCode}`}
                                    aria-label={`Delete asset ${asset.assetCode}`}
                                  >
                                    🗑️
                                  </button>
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
                        {assets.length === 0
                          ? 'Zero Assets Registered in Dashboard'
                          : 'No matching assets found for active filters'}
                      </h3>
                      <p className="text-xs text-[var(--mute)] max-w-md mx-auto mt-1 mb-4">
                        {assets.length === 0
                          ? 'Add equipment or import an Excel spreadsheet to view real-time facility deployments for IIPL and Padget across buildings C39, D197, D198, and D199.'
                          : 'Try clearing your search term or switching the Company and Building filters.'}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        {assets.length === 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsAddModalOpen(true)}
                              className="btn p text-xs"
                            >
                              + Add First Asset
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

                {/* 12-Column Responsive Grid */}
                <div className="grid">
                  {/* Cost Overview Line Chart */}
                  <section className="card c8 chart">
                    <h2>
                      Cost overview <small>Last 12 months, $ thousands</small>
                    </h2>
                    <svg viewBox="0 0 720 230" role="img" aria-label="Cost line chart">
                      <g stroke="var(--line)">
                        <path d="M40 20h670M40 70h670M40 120h670M40 170h670M40 200h670" />
                      </g>
                      <g>
                        <text x="4" y="24">1,000</text>
                        <text x="4" y="74">750</text>
                        <text x="4" y="124">500</text>
                        <text x="4" y="174">250</text>
                      </g>
                      {/* Zero baseline */}
                      <path
                        d="M50 200 L688 200"
                        fill="none"
                        stroke="var(--acc)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <g>
                        <text x="50" y="220">Nov</text>
                        <text x="224" y="220">Feb</text>
                        <text x="398" y="220">May</text>
                        <text x="572" y="220">Aug</text>
                        <text x="670" y="220">Oct</text>
                      </g>
                      <g>
                        <circle cx="560" cy="12" r="4" fill="var(--acc)" />
                        <text x="570" y="16">Purchases</text>
                        <circle cx="640" cy="12" r="4" fill="var(--warn)" />
                        <text x="650" y="16">Maintenance</text>
                      </g>
                    </svg>
                  </section>

                  {/* Meridian Insights AI Panel */}
                  <section className="card c4 insight">
                    <h2>
                      Meridian insights <small>Live</small>
                    </h2>
                    <p>
                      {totalAssets === 0
                        ? 'Zero telemetry anomalies detected. Equipment health telemetry and wear prediction models activate as assets are added.'
                        : `Monitoring ${totalAssets} registered hardware units across infrastructure.`}
                    </p>
                    <div className="chips">
                      {['Schedule inspections', 'Compare renewal options', 'Which assets fail most?'].map(
                        (q) => (
                          <button
                            key={q}
                            className="chip"
                            onClick={() => setAiAnswer(aiAnswers[q] || '')}
                          >
                            {q}
                          </button>
                        )
                      )}
                    </div>
                    {aiAnswer && (
                      <div id="ans" aria-live="polite">
                        {aiAnswer}
                      </div>
                    )}
                  </section>

                  {/* Maintenance Due Section */}
                  <section className="card c6">
                    <h2>
                      Maintenance due <small>Live queue</small>
                    </h2>
                    {assets.filter((a) => a.status === 'Maintenance').length > 0 ? (
                      <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                        {assets
                          .filter((a) => a.status === 'Maintenance')
                          .map((a) => (
                            <div key={a.id} className="row">
                              <div className="th">⚙️</div>
                              <div>
                                <div className="t">{a.name}</div>
                                <div className="m">{a.location || a.department}</div>
                              </div>
                              <div className="r">
                                <span className="pill w">In maintenance</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs" style={{ color: 'var(--mute)' }}>
                        No maintenance work orders scheduled.
                      </div>
                    )}
                  </section>

                  {/* Spend by Department */}
                  <section className="card c6">
                    <h2>
                      Spend by department <small>Current fiscal year</small>
                    </h2>
                    <div className="py-8 text-center text-xs" style={{ color: 'var(--mute)' }}>
                      No departmental expenditure recorded yet.
                    </div>
                  </section>

                  {/* Awaiting Your Approval */}
                  <section className="card c6">
                    <h2>
                      Awaiting your approval <small>0 requests</small>
                    </h2>
                    <div className="py-8 text-center text-xs" style={{ color: 'var(--mute)' }}>
                      No pending purchase or retirement authorizations.
                    </div>
                  </section>

                  {/* Recent Activity */}
                  <section className="card c6">
                    <h2>
                      Recent activity <small>Live audit trail</small>
                    </h2>
                    {assets.length > 0 ? (
                      <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                        {assets.slice(0, 3).map((a) => (
                          <div key={a.id} className="row">
                            <div className="th">📦</div>
                            <div>
                              <div className="t">{a.name} onboarded</div>
                              <div className="m">Tag: {a.assetTag} · Assigned: {a.assignedTo || 'Unassigned'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs" style={{ color: 'var(--mute)' }}>
                        No inventory events logged.
                      </div>
                    )}
                  </section>
                </div>
              </div>
            ) : currentHash === 'assets' || currentHash === 'library' ? (
              <AssetLibraryView
                assets={assets}
                activeSubTab={currentHash === 'library' ? 'library' : 'gallery'}
                setActiveSubTab={(tab) => {
                  const targetHash = tab === 'library' ? 'library' : 'assets'
                  setCurrentHash(targetHash)
                  window.location.hash = `#${targetHash}`
                }}
                onOpenAddAsset={() => setIsAddModalOpen(true)}
                onDeleteAsset={handleDeleteAsset}
                onClearAllAssets={handleClearAllAssets}
                onImportAssets={handleImportAssets}
                addAssetButtonRef={addAssetButtonRef}
              />
            ) : currentHash === 'audit' ? (
              <AuditLogView />
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

      <AddAssetPanel
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveAsset}
        triggerRef={addAssetButtonRef}
      />
    </>
  )
}

export default App
