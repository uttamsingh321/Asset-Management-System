import * as React from 'react'
import { meridianPages, aiAnswers } from '@/data/meridianData'
import { AddAssetModal } from '@/components/AddAssetModal'
import type { Asset } from '@/types/asset'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

export function App() {
  const [currentHash, setCurrentHash] = React.useState<string>(() => {
    const h = window.location.hash.replace('#', '')
    return h && meridianPages[h] ? h : 'dashboard'
  })
  const [isMini, setIsMini] = React.useState(false)
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  })
  const [aiAnswer, setAiAnswer] = React.useState<string>('')
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Sync hash routing
  React.useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '')
      setCurrentHash(h && meridianPages[h] ? h : 'dashboard')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
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

  const handleNavClick = (key: string, e: React.MouseEvent) => {
    e.preventDefault()
    window.location.hash = `#${key}`
    setCurrentHash(key)
    window.scrollTo(0, 0)
  }

  const handleAddAsset = (asset: Asset) => {
    toast.success(`Asset "${asset.name}" registered successfully!`)
  }

  const isDashboard = currentHash === 'dashboard'
  const activePage = meridianPages[currentHash]

  return (
    <>
      <Toaster position="top-right" richColors />

      <div className={`app ${isMini ? 'mini' : ''}`} id="app">
        {/* Left Sidebar */}
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
              aria-label="Collapse sidebar"
              onClick={() => setIsMini(!isMini)}
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
                  description: 'Select an insight chip or type an inquiry to analyze fleet risks.',
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
                    <div className="sub">Friday 13 November · 4 sites · last synced 2 minutes ago</div>
                  </div>
                  <div className="btns">
                    <button className="btn" onClick={() => toast.success('Export report initiated')}>
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
                    <span className="n">12,480</span>
                    <span>assets under management</span>
                    <span className="chg">+214 this month</span>
                  </div>
                  <div className="band" role="img" aria-label="Health: 9,610 healthy, 1,870 watch, 690 service due, 310 critical">
                    <i style={{ flex: 9610, background: 'var(--ok)' }} />
                    <i style={{ flex: 1870, background: '#7fbf9f' }} />
                    <i style={{ flex: 690, background: 'var(--warn)' }} />
                    <i style={{ flex: 310, background: 'var(--bad)' }} />
                  </div>
                  <div className="leg">
                    <div>
                      <span className="sw" style={{ background: 'var(--ok)' }} />
                      <b>9,610</b> healthy
                    </div>
                    <div>
                      <span className="sw" style={{ background: '#7fbf9f' }} />
                      <b>1,870</b> on watch
                    </div>
                    <div>
                      <span className="sw" style={{ background: 'var(--warn)' }} />
                      <b>690</b> service due
                    </div>
                    <div>
                      <span className="sw" style={{ background: 'var(--bad)' }} />
                      <b>310</b> critical
                    </div>
                  </div>
                </section>

                {/* 4 Summary Cards */}
                <div className="kpis">
                  <div className="card k">
                    <div className="l">Maintenance due</div>
                    <div className="v">142</div>
                    <div className="d">
                      <span className="pill w">23 overdue</span> next 14 days
                    </div>
                  </div>
                  <div className="card k">
                    <div className="l">Warranties expiring</div>
                    <div className="v">57</div>
                    <div className="d">
                      <span className="pill b">9 within 30 days</span>
                    </div>
                  </div>
                  <div className="card k">
                    <div className="l">Open work orders</div>
                    <div className="v">318</div>
                    <div className="d">
                      <span className="pill ok">median close 1.8 days</span>
                    </div>
                  </div>
                  <div className="card k">
                    <div className="l">Spend this quarter</div>
                    <div className="v">$2.41M</div>
                    <div className="d">
                      <span className="pill ok">6.2% under budget</span>
                    </div>
                  </div>
                </div>

                {/* 12-Column Grid */}
                <div className="grid">
                  {/* Cost Overview Line Chart */}
                  <section className="card c8 chart">
                    <h2>
                      Cost overview <small>Last 12 months, $ thousands</small>
                    </h2>
                    <svg viewBox="0 0 720 230" role="img" aria-label="Monthly cost line chart">
                      <g stroke="var(--line)">
                        <path d="M40 20h670M40 70h670M40 120h670M40 170h670M40 200h670" />
                      </g>
                      <g>
                        <text x="4" y="24">1,000</text>
                        <text x="4" y="74">750</text>
                        <text x="4" y="124">500</text>
                        <text x="4" y="174">250</text>
                      </g>
                      <path
                        d="M50 150 L108 142 L166 148 L224 120 L282 126 L340 104 L398 110 L456 86 L514 92 L572 70 L630 58 L688 44 L688 200 L50 200Z"
                        fill="var(--acc)"
                        opacity=".12"
                      />
                      <path
                        d="M50 150 L108 142 L166 148 L224 120 L282 126 L340 104 L398 110 L456 86 L514 92 L572 70 L630 58 L688 44"
                        fill="none"
                        stroke="var(--acc)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M50 184 L108 182 L166 178 L224 180 L282 172 L340 174 L398 168 L456 170 L514 160 L572 162 L630 156 L688 150"
                        fill="none"
                        stroke="var(--warn)"
                        strokeWidth="2"
                        strokeDasharray="5 4"
                      />
                      <circle cx="688" cy="44" r="5" fill="var(--acc)" />
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
                      Meridian insights <small>Updated 8 min ago</small>
                    </h2>
                    <p>
                      <b>14 CNC spindles</b> at Pune Plant 2 show vibration patterns that preceded past failures. Replacement lead time is 6 weeks.
                    </p>
                    <p>
                      <b>41 laptops</b> reach end of warranty in December. Renewing costs $9,800; replacing costs $52,000.
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
                      Maintenance due <small>View all 142</small>
                    </h2>
                    <div className="row">
                      <div className="th">⚙️</div>
                      <div>
                        <div className="t">Hydraulic press HP-204</div>
                        <div className="m">Pune Plant 2 · Line C</div>
                      </div>
                      <div className="r">
                        <span className="pill b">Overdue 6 days</span>
                      </div>
                    </div>
                    <div className="row">
                      <div className="th">🚛</div>
                      <div>
                        <div className="t">Delivery van MH-12-4471</div>
                        <div className="m">Fleet · Mumbai depot</div>
                      </div>
                      <div className="r">
                        <span className="pill w">Due in 2 days</span>
                      </div>
                    </div>
                    <div className="row">
                      <div className="th">❄️</div>
                      <div>
                        <div className="t">Chiller unit CH-02</div>
                        <div className="m">Delhi HQ · Roof</div>
                      </div>
                      <div className="r">
                        <span className="pill w">Due in 5 days</span>
                      </div>
                    </div>
                    <div className="row">
                      <div className="th">🖨️</div>
                      <div>
                        <div className="t">Production printer PR-31</div>
                        <div className="m">Bengaluru office · Floor 4</div>
                      </div>
                      <div className="r">
                        <span className="pill ok">Due in 11 days</span>
                      </div>
                    </div>
                  </section>

                  {/* Spend by Department */}
                  <section className="card c6">
                    <h2>
                      Spend by department <small>Q4 to date</small>
                    </h2>
                    <div className="row" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="t">Manufacturing</span>
                        <span>$1.02M</span>
                      </div>
                      <div className="bar">
                        <i style={{ width: '84%' }} />
                      </div>
                    </div>
                    <div className="row" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="t">IT</span>
                        <span>$640K</span>
                      </div>
                      <div className="bar">
                        <i style={{ width: '53%' }} />
                      </div>
                    </div>
                    <div className="row" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="t">Logistics and fleet</span>
                        <span>$410K</span>
                      </div>
                      <div className="bar">
                        <i style={{ width: '34%' }} />
                      </div>
                    </div>
                    <div className="row" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="t">Facilities</span>
                        <span>$215K</span>
                      </div>
                      <div className="bar">
                        <i style={{ width: '18%' }} />
                      </div>
                    </div>
                  </section>

                  {/* Awaiting Your Approval */}
                  <section className="card c6">
                    <h2>
                      Awaiting your approval <small>3 requests</small>
                    </h2>
                    <div className="row">
                      <div className="th">💻</div>
                      <div>
                        <div className="t">Transfer 12 laptops to Hyderabad</div>
                        <div className="m">Requested by Arjun Rao · 40 min ago</div>
                      </div>
                      <div className="r">
                        <button className="btn" onClick={() => toast.info('Review opened')}>
                          Review
                        </button>
                      </div>
                    </div>
                    <div className="row">
                      <div className="th">🧾</div>
                      <div>
                        <div className="t">Purchase order PO-8841 · $38,400</div>
                        <div className="m">Vendor: Siemens India · 2 hours ago</div>
                      </div>
                      <div className="r">
                        <button className="btn" onClick={() => toast.info('Review opened')}>
                          Review
                        </button>
                      </div>
                    </div>
                    <div className="row">
                      <div className="th">🗑️</div>
                      <div>
                        <div className="t">Retire forklift FK-07</div>
                        <div className="m">Requested by Meena Shah · yesterday</div>
                      </div>
                      <div className="r">
                        <button className="btn" onClick={() => toast.info('Review opened')}>
                          Review
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Recent Activity */}
                  <section className="card c6">
                    <h2>
                      Recent activity <small>Live</small>
                    </h2>
                    <div className="row">
                      <div className="th">📷</div>
                      <div>
                        <div className="t">MacBook Pro 16" onboarded</div>
                        <div className="m">Scanned invoice, serial matched · Kavya, 9:12</div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="th">📦</div>
                      <div>
                        <div className="t">Spare bearings restocked to 240</div>
                        <div className="m">Pune warehouse · Rohan, 8:47</div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="th">✅</div>
                      <div>
                        <div className="t">Work order WO-5520 closed</div>
                        <div className="m">Chiller CH-01 · Vikram, 8:05</div>
                      </div>
                    </div>
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
                    <button className="btn" onClick={() => toast.success(`Exporting ${activePage.t}`)}>
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
                      <div className="v">{x[1]}</div>
                      <div className="d">{x[2]}</div>
                    </div>
                  ))}
                </div>

                {/* Grid with 8-col list and 4-col bars */}
                <div className="grid">
                  <section className="card c8">
                    <h2>{activePage.ah}</h2>
                    {activePage.a.map((r, idx) => (
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
                    ))}
                  </section>

                  <section className="card c4">
                    <h2>{activePage.bh}</h2>
                    {activePage.b.map((r, idx) => (
                      <div key={idx} className="row" style={{ display: 'block' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="t">{r[0]}</span>
                          <span>{r[1]}</span>
                        </div>
                        <div className="bar">
                          <i style={{ width: `${r[2]}%` }} />
                        </div>
                      </div>
                    ))}
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
