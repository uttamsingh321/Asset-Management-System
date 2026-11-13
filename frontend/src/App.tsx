import * as React from 'react'
import { meridianPages, aiAnswers } from '@/data/meridianData'
import { AddAssetModal } from '@/components/AddAssetModal'
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
  const [assets, setAssets] = React.useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Sync to local storage
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets))
    } catch (err) {
      console.error('Failed to sync assets', err)
    }
  }, [assets])

  // Sync hash routing
  React.useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '')
      setCurrentHash(h && meridianPages[h] ? h : 'dashboard')
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

  const handleAddAsset = (asset: Asset) => {
    setAssets((prev) => [asset, ...prev])
    toast.success(`Asset "${asset.name}" registered successfully!`)
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
      <Toaster position="top-right" richColors />

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
              className={currentHash === 'assets' ? 'on' : ''}
              href="#assets"
              onClick={(e) => handleNavClick('assets', e)}
              title={isMini ? 'Assets' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M8 20h8M12 16v4" />
              </svg>
              <span>Assets</span>
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
              className={currentHash === 'vendors' ? 'on' : ''}
              href="#vendors"
              onClick={(e) => handleNavClick('vendors', e)}
              title={isMini ? 'Vendors' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 9 5 4h14l2 5M3 9v11h18V9M3 9h18M9 20v-6h6v6" />
              </svg>
              <span>Vendors</span>
            </a>

            <a
              className={currentHash === 'procurement' ? 'on' : ''}
              href="#procurement"
              onClick={(e) => handleNavClick('procurement', e)}
              title={isMini ? 'Procurement' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="18" cy="20" r="1.5" />
                <path d="M2 3h3l2.5 12h11L21 7H6" />
              </svg>
              <span>Procurement</span>
            </a>

            <a
              className={currentHash === 'finance' ? 'on' : ''}
              href="#finance"
              onClick={(e) => handleNavClick('finance', e)}
              title={isMini ? 'Finance' : undefined}
            >
              <svg viewBox="0 0 24 24">
                <rect x="2" y="6" width="20" height="13" rx="2" />
                <path d="M2 11h20M6 16h3" />
              </svg>
              <span>Finance</span>
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

            <div className="me">PN</div>
          </header>

          {/* Page Content */}
          <div className="wrap">
            {isDashboard ? (
              /* Executive Dashboard View */
              <div id="v-dashboard">
                <div className="top">
                  <div>
                    <h1>Good morning, Priya</h1>
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

      <AddAssetModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAddAsset={handleAddAsset}
      />
    </>
  )
}

export default App
