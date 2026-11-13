import * as React from 'react'
import { navItems, meridianPages, aiAnswers } from '@/data/meridianData'
import { AddAssetModal } from '@/components/AddAssetModal'
import type { Asset } from '@/types/asset'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Boxes,
  Package,
  Wrench,
  FileCheck2,
  Users,
  MapPin,
  Store,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Settings,
  Menu,
  Moon,
  Sun,
  Bell,
  Sparkles,
  Search,
} from 'lucide-react'

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

  const handleNavClick = (key: string) => {
    window.location.hash = `#${key}`
    setCurrentHash(key)
  }

  const handleAddAsset = (asset: Asset) => {
    toast.success(`Asset "${asset.name}" registered successfully!`)
  }

  const getNavIcon = (key: string) => {
    const props = { className: 'w-4 h-4 shrink-0' }
    switch (key) {
      case 'dashboard':
        return <LayoutDashboard {...props} />
      case 'assets':
        return <Boxes {...props} />
      case 'inventory':
        return <Package {...props} />
      case 'maintenance':
        return <Wrench {...props} />
      case 'workorders':
        return <FileCheck2 {...props} />
      case 'employees':
        return <Users {...props} />
      case 'locations':
        return <MapPin {...props} />
      case 'vendors':
        return <Store {...props} />
      case 'procurement':
        return <ShoppingCart {...props} />
      case 'finance':
        return <DollarSign {...props} />
      case 'reports':
        return <BarChart3 {...props} />
      case 'administration':
        return <Settings {...props} />
      default:
        return <Boxes {...props} />
    }
  }

  const renderPill = (c: string, text: string) => {
    let classes = 'text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center '
    if (c === 'ok') {
      classes += 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
    } else if (c === 'w') {
      classes += 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
    } else if (c === 'b') {
      classes += 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
    } else {
      classes += 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
    return <span className={classes}>{text}</span>
  }

  const isDashboard = currentHash === 'dashboard'
  const activePage = meridianPages[currentHash]

  return (
    <div
      className={`min-h-screen grid transition-all duration-300 ${
        isMini ? 'grid-cols-[68px_1fr]' : 'grid-cols-[232px_1fr]'
      } max-[720px]:grid-cols-1`}
      style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
    >
      <Toaster position="top-right" richColors />

      {/* Sidebar */}
      <aside
        className="sticky top-0 h-screen overflow-hidden p-3 border-r transition-all"
        style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
      >
        <div className="flex items-center gap-2.5 px-2 py-3 mb-3 font-bold text-base whitespace-nowrap">
          <div
            className="w-7 h-7 rounded-lg shrink-0 grid place-items-center text-white"
            style={{ backgroundColor: 'var(--acc)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8">
              <path d="M2 12 8 3l6 9H2Z" />
            </svg>
          </div>
          {!isMini && <span>Meridian</span>}
        </div>

        <nav className="flex flex-col gap-1 max-[720px]:flex-row max-[720px]:overflow-x-auto">
          {navItems.map((item) => {
            const on = currentHash === item.key
            return (
              <a
                key={item.key}
                href={`#${item.key}`}
                onClick={(e) => {
                  e.preventDefault()
                  handleNavClick(item.key)
                }}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  on
                    ? 'font-semibold'
                    : 'hover:text-foreground'
                }`}
                style={{
                  backgroundColor: on ? 'var(--acc2)' : 'transparent',
                  color: on ? 'var(--acc)' : 'var(--mute)',
                }}
                title={isMini ? item.label : undefined}
              >
                {getNavIcon(item.key)}
                {!isMini && <span>{item.label}</span>}
              </a>
            )
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex flex-col">
        {/* Sticky Header */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-6 py-3 border-b backdrop-blur-md transition-colors"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)',
            borderColor: 'var(--line)',
          }}
        >
          <button
            onClick={() => setIsMini(!isMini)}
            className="w-9 h-9 rounded-lg grid place-items-center hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--mute)' }}
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Search Box */}
          <div
            className="flex-1 max-w-[500px] flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm"
            style={{
              backgroundColor: 'var(--surf)',
              borderColor: 'var(--line)',
              color: 'var(--mute)',
            }}
          >
            <Search className="w-4 h-4 shrink-0" />
            <input
              ref={searchInputRef}
              placeholder="Search assets, people, work orders..."
              className="w-full bg-transparent border-none outline-none text-sm text-[var(--ink)] placeholder:text-[var(--mute)]"
            />
            <kbd
              className="text-xs px-1.5 py-0.5 rounded border font-mono shrink-0"
              style={{ borderColor: 'var(--line)' }}
            >
              Ctrl K
            </kbd>
          </div>

          <div className="flex-1" />

          {/* Ask Meridian AI Button */}
          <button
            onClick={() => {
              toast.info('Ask Meridian AI activated', {
                description: 'Ask any question regarding equipment failure prediction or maintenance scheduling.',
              })
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold text-xs text-white shadow-xs hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: 'var(--acc)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask Meridian</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg grid place-items-center hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--mute)' }}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <button
            onClick={() => toast('No unread notifications')}
            className="relative w-9 h-9 rounded-lg grid place-items-center hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--mute)' }}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span
              className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--bad)' }}
            />
          </button>

          {/* User Avatar */}
          <div
            className="w-8 h-8 rounded-full grid place-items-center text-xs font-semibold text-white select-none"
            style={{ background: 'linear-gradient(135deg, #6aa6d8, #0b6e79)' }}
          >
            PN
          </div>
        </header>

        {/* Dynamic Page Views */}
        <div className="p-6 max-w-[1360px] w-full mx-auto space-y-6">
          {isDashboard ? (
            <>
              {/* Top Welcome Title */}
              <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Good morning, Priya</h1>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--mute)' }}>
                    Friday 13 November · 4 sites · last synced 2 minutes ago
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toast.success('Report export started')}
                    className="px-3.5 py-1.5 rounded-lg border font-semibold text-xs hover:opacity-80 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--surf)',
                      borderColor: 'var(--line)',
                    }}
                  >
                    Export report
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg font-semibold text-xs text-white hover:opacity-90 cursor-pointer"
                    style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
                  >
                    Add asset
                  </button>
                </div>
              </div>

              {/* Fleet Health Hero */}
              <section
                className="p-6 rounded-2xl border shadow-xs space-y-4"
                style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
              >
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-4xl font-bold tracking-tight">12,480</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--mute)' }}>
                    assets under management
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--ok)' }}>
                    +214 this month
                  </span>
                </div>

                <div className="flex gap-1 h-10 rounded-lg overflow-hidden py-1">
                  <div style={{ flex: 9610, backgroundColor: 'var(--ok)' }} className="rounded-l-md" />
                  <div style={{ flex: 1870, backgroundColor: '#7fbf9f' }} />
                  <div style={{ flex: 690, backgroundColor: 'var(--warn)' }} />
                  <div style={{ flex: 310, backgroundColor: 'var(--bad)' }} className="rounded-r-md" />
                </div>

                <div className="flex gap-6 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--ok)' }} />
                    <b className="font-semibold">9,610</b>{' '}
                    <span style={{ color: 'var(--mute)' }}>healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#7fbf9f' }} />
                    <b className="font-semibold">1,870</b>{' '}
                    <span style={{ color: 'var(--mute)' }}>on watch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--warn)' }} />
                    <b className="font-semibold">690</b>{' '}
                    <span style={{ color: 'var(--mute)' }}>service due</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--bad)' }} />
                    <b className="font-semibold">310</b>{' '}
                    <span style={{ color: 'var(--mute)' }}>critical</span>
                  </div>
                </div>
              </section>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  className="p-5 rounded-2xl border shadow-xs"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="text-xs font-medium" style={{ color: 'var(--mute)' }}>
                    Maintenance due
                  </div>
                  <div className="text-2xl font-bold tracking-tight my-1">142</div>
                  <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--mute)' }}>
                    {renderPill('w', '23 overdue')} next 14 days
                  </div>
                </div>

                <div
                  className="p-5 rounded-2xl border shadow-xs"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="text-xs font-medium" style={{ color: 'var(--mute)' }}>
                    Warranties expiring
                  </div>
                  <div className="text-2xl font-bold tracking-tight my-1">57</div>
                  <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--mute)' }}>
                    {renderPill('b', '9 within 30 days')}
                  </div>
                </div>

                <div
                  className="p-5 rounded-2xl border shadow-xs"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="text-xs font-medium" style={{ color: 'var(--mute)' }}>
                    Open work orders
                  </div>
                  <div className="text-2xl font-bold tracking-tight my-1">318</div>
                  <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--mute)' }}>
                    {renderPill('ok', 'median close 1.8 days')}
                  </div>
                </div>

                <div
                  className="p-5 rounded-2xl border shadow-xs"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="text-xs font-medium" style={{ color: 'var(--mute)' }}>
                    Spend this quarter
                  </div>
                  <div className="text-2xl font-bold tracking-tight my-1">$2.41M</div>
                  <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--mute)' }}>
                    {renderPill('ok', '6.2% under budget')}
                  </div>
                </div>
              </div>

              {/* Main Grid: Cost Overview & AI Insights */}
              <div className="grid grid-cols-12 gap-4">
                {/* Cost Overview Line Chart */}
                <section
                  className="col-span-12 lg:col-span-8 p-5 rounded-2xl border shadow-xs space-y-3"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold">Cost overview</h2>
                    <span className="text-xs font-normal" style={{ color: 'var(--mute)' }}>
                      Last 12 months, $ thousands
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 720 230"
                    role="img"
                    aria-label="Cost line chart"
                    className="w-full h-auto block"
                  >
                    <g stroke="var(--line)">
                      <path d="M40 20h670M40 70h670M40 120h670M40 170h670M40 200h670" />
                    </g>
                    <g fill="var(--mute)" fontSize="11" fontFamily="Figtree">
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
                    <g fill="var(--mute)" fontSize="11" fontFamily="Figtree">
                      <text x="50" y="220">Nov</text>
                      <text x="224" y="220">Feb</text>
                      <text x="398" y="220">May</text>
                      <text x="572" y="220">Aug</text>
                      <text x="670" y="220">Oct</text>
                    </g>
                    <g fontSize="11" fontFamily="Figtree">
                      <circle cx="560" cy="12" r="4" fill="var(--acc)" />
                      <text x="570" y="16" fill="var(--mute)">Purchases</text>
                      <circle cx="640" cy="12" r="4" fill="var(--warn)" />
                      <text x="650" y="16" fill="var(--mute)">Maintenance</text>
                    </g>
                  </svg>
                </section>

                {/* Meridian Insights AI Panel */}
                <section
                  className="col-span-12 lg:col-span-4 p-5 rounded-2xl border shadow-xs space-y-3"
                  style={{
                    background: 'linear-gradient(160deg, var(--acc2), var(--surf) 70%)',
                    borderColor: 'var(--line)',
                  }}
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold">Meridian insights</h2>
                    <span className="text-xs font-normal" style={{ color: 'var(--mute)' }}>
                      Updated 8 min ago
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    <b>14 CNC spindles</b> at Pune Plant 2 show vibration patterns that preceded past failures. Replacement lead time is 6 weeks.
                  </p>
                  <p className="text-xs leading-relaxed">
                    <b>41 laptops</b> reach end of warranty in December. Renewing costs $9,800; replacing costs $52,000.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {['Schedule inspections', 'Compare renewal options', 'Which assets fail most?'].map(
                      (q) => (
                        <button
                          key={q}
                          onClick={() => setAiAnswer(aiAnswers[q] || '')}
                          className="px-2.5 py-1 rounded-full border text-xs font-medium transition-colors hover:border-[var(--acc)] hover:text-[var(--acc)] cursor-pointer"
                          style={{
                            backgroundColor: 'var(--surf)',
                            borderColor: 'var(--line)',
                          }}
                        >
                          {q}
                        </button>
                      )
                    )}
                  </div>
                  {aiAnswer && (
                    <div
                      className="mt-3 p-3 rounded-lg text-xs font-medium border"
                      style={{
                        backgroundColor: 'var(--surf)',
                        borderColor: 'var(--acc)',
                        color: 'var(--ink)',
                      }}
                    >
                      {aiAnswer}
                    </div>
                  )}
                </section>

                {/* Maintenance Due List */}
                <section
                  className="col-span-12 lg:col-span-6 p-5 rounded-2xl border shadow-xs space-y-3"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold">Maintenance due</h2>
                    <span className="text-xs font-normal" style={{ color: 'var(--mute)' }}>
                      View all 142
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                    {[
                      { icon: '⚙️', t: 'Hydraulic press HP-204', m: 'Pune Plant 2 · Line C', c: 'b', s: 'Overdue 6 days' },
                      { icon: '🚛', t: 'Delivery van MH-12-4471', m: 'Fleet · Mumbai depot', c: 'w', s: 'Due in 2 days' },
                      { icon: '❄️', t: 'Chiller unit CH-02', m: 'Delhi HQ · Roof', c: 'w', s: 'Due in 5 days' },
                      { icon: '🖨️', t: 'Production printer PR-31', m: 'Bengaluru office · Floor 4', c: 'ok', s: 'Due in 11 days' },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2.5">
                        <div
                          className="w-9 h-9 rounded-lg grid place-items-center shrink-0 text-base"
                          style={{ backgroundColor: 'var(--surf2)' }}
                        >
                          {row.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate">{row.t}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--mute)' }}>
                            {row.m}
                          </div>
                        </div>
                        <div>{renderPill(row.c, row.s)}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Spend by Department Progress Bars */}
                <section
                  className="col-span-12 lg:col-span-6 p-5 rounded-2xl border shadow-xs space-y-3"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold">Spend by department</h2>
                    <span className="text-xs font-normal" style={{ color: 'var(--mute)' }}>
                      Q4 to date
                    </span>
                  </div>
                  <div className="space-y-3 pt-1">
                    {[
                      { dept: 'Manufacturing', val: '$1.02M', pct: 84 },
                      { dept: 'IT', val: '$640K', pct: 53 },
                      { dept: 'Logistics and fleet', val: '$410K', pct: 34 },
                      { dept: 'Facilities', val: '$215K', pct: 18 },
                    ].map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span>{item.dept}</span>
                          <span>{item.val}</span>
                        </div>
                        <div
                          className="h-1.5 w-full rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--surf2)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${item.pct}%`,
                              backgroundColor: 'var(--acc)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Awaiting Your Approval */}
                <section
                  className="col-span-12 lg:col-span-6 p-5 rounded-2xl border shadow-xs space-y-3"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold">Awaiting your approval</h2>
                    <span className="text-xs font-normal" style={{ color: 'var(--mute)' }}>
                      3 requests
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                    {[
                      { icon: '💻', t: 'Transfer 12 laptops to Hyderabad', m: 'Requested by Arjun Rao · 40 min ago' },
                      { icon: '🧾', t: 'Purchase order PO-8841 · $38,400', m: 'Vendor: Siemens India · 2 hours ago' },
                      { icon: '🗑️', t: 'Retire forklift FK-07', m: 'Requested by Meena Shah · yesterday' },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2.5">
                        <div
                          className="w-9 h-9 rounded-lg grid place-items-center shrink-0 text-base"
                          style={{ backgroundColor: 'var(--surf2)' }}
                        >
                          {row.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate">{row.t}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--mute)' }}>
                            {row.m}
                          </div>
                        </div>
                        <button
                          onClick={() => toast.info(`Reviewing: ${row.t}`)}
                          className="px-2.5 py-1 rounded-md border text-xs font-semibold hover:opacity-80 cursor-pointer"
                          style={{
                            backgroundColor: 'var(--surf)',
                            borderColor: 'var(--line)',
                          }}
                        >
                          Review
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Recent Activity */}
                <section
                  className="col-span-12 lg:col-span-6 p-5 rounded-2xl border shadow-xs space-y-3"
                  style={{ backgroundColor: 'var(--surf)', borderColor: 'var(--line)' }}
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold">Recent activity</h2>
                    <span className="text-xs font-normal" style={{ color: 'var(--mute)' }}>
                      Live
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                    {[
                      { icon: '📷', t: 'MacBook Pro 16" onboarded', m: 'Scanned invoice, serial matched · Kavya, 9:12' },
                      { icon: '📦', t: 'Spare bearings restocked to 240', m: 'Pune warehouse · Rohan, 8:47' },
                      { icon: '✅', t: 'Work order WO-5520 closed', m: 'Chiller CH-01 · Vikram, 8:05' },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2.5">
                        <div
                          className="w-9 h-9 rounded-lg grid place-items-center shrink-0 text-base"
                          style={{ backgroundColor: 'var(--surf2)' }}
                        >
                          {row.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate">{row.t}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--mute)' }}>
                            {row.m}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : activePage ? (
            /* Subpage view for all other 11 modules */
            <div className="space-y-6">
              <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{activePage.t}</h1>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--mute)' }}>
                    {activePage.s}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toast.success(`Exported ${activePage.t} report`)}
                    className="px-3.5 py-1.5 rounded-lg border font-semibold text-xs hover:opacity-80 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--surf)',
                      borderColor: 'var(--line)',
                    }}
                  >
                    Export
                  </button>
                  <button
                    onClick={() => {
                      if (activePage.btn === 'Add asset') {
                        setIsAddModalOpen(true)
                      } else {
                        toast.info(`Action triggered: ${activePage.btn}`)
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg font-semibold text-xs text-white hover:opacity-90 cursor-pointer"
                    style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
                  >
                    {activePage.btn}
                  </button>
                </div>
              </div>

              {/* 4 KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {activePage.k.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border shadow-xs"
                    style={{
                      backgroundColor: 'var(--surf)',
                      borderColor: 'var(--line)',
                    }}
                  >
                    <div className="text-xs font-medium" style={{ color: 'var(--mute)' }}>
                      {item[0]}
                    </div>
                    <div className="text-2xl font-bold tracking-tight my-1">{item[1]}</div>
                    <div className="text-xs" style={{ color: 'var(--mute)' }}>
                      {item[2]}
                    </div>
                  </div>
                ))}
              </div>

              {/* Main List and Side Bars */}
              <div className="grid grid-cols-12 gap-4">
                <section
                  className="col-span-12 lg:col-span-8 p-5 rounded-2xl border shadow-xs space-y-3"
                  style={{
                    backgroundColor: 'var(--surf)',
                    borderColor: 'var(--line)',
                  }}
                >
                  <h2 className="text-sm font-semibold">{activePage.ah}</h2>
                  <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                    {activePage.a.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2.5">
                        <div
                          className="w-9 h-9 rounded-lg grid place-items-center shrink-0 text-base"
                          style={{ backgroundColor: 'var(--surf2)' }}
                        >
                          {row[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate">{row[1]}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--mute)' }}>
                            {row[2]}
                          </div>
                        </div>
                        <div>{renderPill(row[3], row[4])}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section
                  className="col-span-12 lg:col-span-4 p-5 rounded-2xl border shadow-xs space-y-3"
                  style={{
                    backgroundColor: 'var(--surf)',
                    borderColor: 'var(--line)',
                  }}
                >
                  <h2 className="text-sm font-semibold">{activePage.bh}</h2>
                  <div className="space-y-3 pt-1">
                    {activePage.b.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span>{item[0]}</span>
                          <span>{item[1]}</span>
                        </div>
                        <div
                          className="h-1.5 w-full rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--surf2)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${item[2]}%`,
                              backgroundColor: 'var(--acc)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <AddAssetModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAddAsset={handleAddAsset}
      />
    </div>
  )
}

export default App
