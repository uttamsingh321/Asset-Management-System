import * as React from 'react'
import { toast } from 'sonner'
import { t, formatINR, formatDateIN, type Language } from '@/lib/indiaLocale'

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = 'High' | 'Medium' | 'Low'
type MaintenanceType = 'in-house' | 'external'
type TicketStatus =
  | 'Pending Maintenance'
  | 'In Maintenance'
  | 'Pending Acceptance'
  | 'Completed'
  | 'Scrapped'

interface MaintenanceTicket {
  id: string
  assetCode: string
  faultSymptom: string
  maintenanceType: MaintenanceType
  provider: string
  priority: Priority
  status: TicketStatus
  downtimeStart: string
  estimatedCost: number
  remarks: string
  createdAt: string
  closedAt?: string
}

interface FormState {
  assetCode: string
  faultSymptom: string
  downtimeStart: string
  maintenanceType: MaintenanceType
  provider: string
  estimatedCost: string
  priority: Priority
  remarks: string
}

interface Props {
  lang: Language
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }

function prioritySortedTickets(tickets: MaintenanceTicket[]): MaintenanceTicket[] {
  return [...tickets].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  )
}

function generateTicketId(): string {
  return `MNT-${Date.now().toString(36).toUpperCase()}`
}

function currentISO(): string {
  return new Date().toISOString()
}

// Count tickets closed in the current calendar month
function closedThisMonth(tickets: MaintenanceTicket[]): number {
  const now = new Date()
  return tickets.filter((tk) => {
    if (tk.status !== 'Completed' && tk.status !== 'Scrapped') return false
    if (!tk.closedAt) return false
    const d = new Date(tk.closedAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
}

// Rough MTBF / MTTR from ticket list (hours) — returns null if not enough data
function computeMTBF(tickets: MaintenanceTicket[]): string {
  const completed = tickets.filter(
    (tk) => tk.status === 'Completed' || tk.status === 'Scrapped',
  )
  if (completed.length < 2) return 'N/A'
  const sorted = [...completed].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  let totalGap = 0
  for (let i = 1; i < sorted.length; i++) {
    totalGap +=
      (new Date(sorted[i].createdAt).getTime() -
        new Date(sorted[i - 1].createdAt).getTime()) /
      3600000
  }
  return `${(totalGap / (sorted.length - 1)).toFixed(1)} hrs`
}

function computeMTTR(tickets: MaintenanceTicket[]): string {
  const completed = tickets.filter(
    (tk) =>
      (tk.status === 'Completed' || tk.status === 'Scrapped') &&
      tk.closedAt &&
      tk.downtimeStart,
  )
  if (completed.length === 0) return 'N/A'
  const totalRepair = completed.reduce((sum, tk) => {
    const diff =
      (new Date(tk.closedAt!).getTime() - new Date(tk.downtimeStart).getTime()) /
      3600000
    return sum + (diff > 0 ? diff : 0)
  }, 0)
  return `${(totalRepair / completed.length).toFixed(1)} hrs`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const style: React.CSSProperties =
    priority === 'High'
      ? { backgroundColor: 'var(--bad)', color: '#fff' }
      : priority === 'Medium'
        ? { backgroundColor: 'var(--warn)', color: '#fff' }
        : { backgroundColor: 'var(--ok)', color: '#fff' }
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
      style={style}
    >
      {priority}
    </span>
  )
}

function StatusPill({ status }: { status: TicketStatus }) {
  const colorMap: Record<TicketStatus, React.CSSProperties> = {
    'Pending Maintenance': { backgroundColor: 'var(--warn)', color: '#fff' },
    'In Maintenance': { backgroundColor: 'var(--acc)', color: '#fff' },
    'Pending Acceptance': { backgroundColor: '#9b59b6', color: '#fff' },
    Completed: { backgroundColor: 'var(--ok)', color: '#fff' },
    Scrapped: { backgroundColor: 'var(--mute)', color: '#fff' },
  }
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={colorMap[status]}
    >
      {status}
    </span>
  )
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      className="rounded-xl p-2.5 sm:p-3 flex flex-col gap-0.5 flex-1 min-w-[120px]"
      style={{ background: 'var(--surf)', border: '1px solid var(--line)' }}
    >
      <span className="text-[11px] font-medium" style={{ color: 'var(--mute)' }}>
        {label}
      </span>
      <span
        className="text-lg font-bold"
        style={{ color: 'var(--acc)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[10px]" style={{ color: 'var(--mute)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  assetCode: '',
  faultSymptom: '',
  downtimeStart: '',
  maintenanceType: 'in-house',
  provider: '',
  estimatedCost: '',
  priority: 'Medium',
  remarks: '',
}

export const IndiaMaintenanceView: React.FC<Props> = ({ lang }) => {
  const [activeTab, setActiveTab] = React.useState<'list' | 'new'>('list')
  const [tickets, setTickets] = React.useState<MaintenanceTicket[]>([])
  const [form, setForm] = React.useState<FormState>({ ...EMPTY_FORM })
  const [viewTicket, setViewTicket] = React.useState<MaintenanceTicket | null>(null)
  const assetCodeRef = React.useRef<HTMLInputElement>(null)

  // ── Derived stats ────────────────────────────────────────────────────────
  const openCount = tickets.filter(
    (tk) =>
      tk.status !== 'Completed' && tk.status !== 'Scrapped',
  ).length
  const closedCount = closedThisMonth(tickets)
  const mtbf = computeMTBF(tickets)
  const mttr = computeMTTR(tickets)

  // ── Form helpers ─────────────────────────────────────────────────────────
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleQRScan() {
    toast.info('QR scanning: point camera at asset label')
    assetCodeRef.current?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.assetCode.trim()) {
      toast.error('Asset Code is required')
      assetCodeRef.current?.focus()
      return
    }
    if (!form.faultSymptom.trim()) {
      toast.error('Fault Symptom is required')
      return
    }

    const ticket: MaintenanceTicket = {
      id: generateTicketId(),
      assetCode: form.assetCode.trim(),
      faultSymptom: form.faultSymptom.trim(),
      maintenanceType: form.maintenanceType,
      provider:
        form.maintenanceType === 'external' ? form.provider.trim() : 'In-house',
      priority: form.priority,
      status: 'Pending Maintenance',
      downtimeStart: form.downtimeStart || currentISO(),
      estimatedCost: parseFloat(form.estimatedCost) || 0,
      remarks: form.remarks.trim(),
      createdAt: currentISO(),
    }

    setTickets((prev) => [ticket, ...prev])
    setForm({ ...EMPTY_FORM })
    toast.success(`Ticket ${ticket.id} created`)
    setActiveTab('list')
  }

  // ── Ticket actions ───────────────────────────────────────────────────────
  function acceptTicket(id: string) {
    setTickets((prev) =>
      prev.map((tk) => {
        if (tk.id !== id) return tk
        const next: TicketStatus =
          tk.status === 'Pending Maintenance'
            ? 'In Maintenance'
            : tk.status === 'In Maintenance'
              ? 'Pending Acceptance'
              : tk.status === 'Pending Acceptance'
                ? 'Completed'
                : tk.status
        return {
          ...tk,
          status: next,
          closedAt:
            next === 'Completed' || next === 'Scrapped' ? currentISO() : tk.closedAt,
        }
      }),
    )
  }

  function closeTicket(id: string) {
    setTickets((prev) =>
      prev.map((tk) =>
        tk.id === id
          ? { ...tk, status: 'Completed', closedAt: currentISO() }
          : tk,
      ),
    )
    toast.success('Ticket closed')
  }

  const sortedTickets = prioritySortedTickets(tickets)

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const tabBase =
    'px-5 py-3 text-sm font-semibold rounded-t-lg transition-colors focus:outline-none'
  const tabActive = `${tabBase} border-b-2`
  const tabInactive = `${tabBase}`

  // ── View modal ───────────────────────────────────────────────────────────
  function TicketModal() {
    if (!viewTicket) return null
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={() => setViewTicket(null)}
      >
        <div
          className="rounded-2xl p-6 w-full max-w-lg shadow-2xl"
          style={{ background: 'var(--surf)', color: 'var(--ink)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--acc)' }}>
              {viewTicket.id}
            </h3>
            <button
              className="text-xl font-bold"
              style={{ color: 'var(--mute)' }}
              onClick={() => setViewTicket(null)}
            >
              ×
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ['Asset Code', viewTicket.assetCode],
              ['Fault', viewTicket.faultSymptom],
              ['Type', viewTicket.maintenanceType === 'in-house' ? 'In-house' : 'External'],
              ['Provider', viewTicket.provider],
              ['Priority', ''],
              ['Status', ''],
              ['Downtime Start', formatDateIN(viewTicket.downtimeStart)],
              ['Est. Cost', formatINR(viewTicket.estimatedCost)],
              ['Created', formatDateIN(viewTicket.createdAt)],
              ['Closed', viewTicket.closedAt ? formatDateIN(viewTicket.closedAt) : '—'],
              ['Remarks', viewTicket.remarks || '—'],
            ].map(([label, val], i) => (
              <React.Fragment key={i}>
                <dt className="font-medium" style={{ color: 'var(--mute)' }}>
                  {label}
                </dt>
                <dd>
                  {label === 'Priority' ? (
                    <PriorityBadge priority={viewTicket.priority} />
                  ) : label === 'Status' ? (
                    <StatusPill status={viewTicket.status} />
                  ) : (
                    val
                  )}
                </dd>
              </React.Fragment>
            ))}
          </dl>
          <button
            className="mt-6 w-full py-3 rounded-xl font-semibold text-white"
            style={{ background: 'var(--acc)' }}
            onClick={() => setViewTicket(null)}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{ background: 'var(--surf2)', color: 'var(--ink)' }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--acc)' }}>
          {t('maintenance', lang)}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--mute)' }}>
          {lang === 'hi'
            ? 'रखरखाव टिकट और सेवा प्रबंधन'
            : 'Maintenance tickets & service management'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="flex flex-wrap gap-3 mb-6">
        <SummaryCard
          label="MTBF"
          value={mtbf}
          sub="Mean Time Between Failures"
        />
        <SummaryCard
          label="MTTR"
          value={mttr}
          sub="Mean Time To Repair"
        />
        <SummaryCard
          label={lang === 'hi' ? 'खुले टिकट' : 'Open Tickets'}
          value={String(openCount)}
          sub={openCount === 0 ? 'All clear ✓' : undefined}
        />
        <SummaryCard
          label={lang === 'hi' ? 'इस माह बंद' : 'Closed This Month'}
          value={String(closedCount)}
          sub={lang === 'hi' ? 'पूर्ण / स्क्रैप' : 'Completed / Scrapped'}
        />
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 border-b mb-0"
        style={{ borderColor: 'var(--line)' }}
      >
        <button
          className={activeTab === 'list' ? tabActive : tabInactive}
          style={
            activeTab === 'list'
              ? {
                  borderColor: 'var(--acc)',
                  color: 'var(--acc)',
                  background: 'var(--surf)',
                }
              : { color: 'var(--mute)', background: 'transparent' }
          }
          onClick={() => setActiveTab('list')}
        >
          {lang === 'hi' ? '🔧 रखरखाव टिकट' : '🔧 Maintenance Tickets'}
          {openCount > 0 && (
            <span
              className="ml-2 inline-block rounded-full px-1.5 py-0.5 text-xs text-white"
              style={{ background: 'var(--warn)' }}
            >
              {openCount}
            </span>
          )}
        </button>
        <button
          className={activeTab === 'new' ? tabActive : tabInactive}
          style={
            activeTab === 'new'
              ? {
                  borderColor: 'var(--acc)',
                  color: 'var(--acc)',
                  background: 'var(--surf)',
                }
              : { color: 'var(--mute)', background: 'transparent' }
          }
          onClick={() => setActiveTab('new')}
        >
          {lang === 'hi' ? '➕ नया टिकट' : '➕ New Ticket'}
        </button>
      </div>

      {/* ── Tab: Maintenance Tickets ─────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div
          className="rounded-b-2xl rounded-tr-2xl p-4 md:p-6"
          style={{ background: 'var(--surf)', border: '1px solid var(--line)', borderTop: 'none' }}
        >
          {sortedTickets.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <span className="text-6xl">🛠️</span>
              <p className="text-lg font-semibold" style={{ color: 'var(--mute)' }}>
                {lang === 'hi' ? 'कोई टिकट नहीं मिला' : 'No maintenance tickets yet'}
              </p>
              <p className="text-sm" style={{ color: 'var(--mute)' }}>
                {lang === 'hi'
                  ? '"नया टिकट" टैब पर जाएँ और पहला टिकट बनाएँ।'
                  : 'Switch to the "New Ticket" tab to log your first ticket.'}
              </p>
              <button
                className="mt-2 px-6 py-3 rounded-xl font-semibold text-white text-sm"
                style={{ background: 'var(--acc)' }}
                onClick={() => setActiveTab('new')}
              >
                {lang === 'hi' ? '➕ नया टिकट बनाएँ' : '➕ Create New Ticket'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line)' }}>
                    {[
                      lang === 'hi' ? 'टिकट ID' : 'Ticket ID',
                      lang === 'hi' ? 'एसेट कोड' : 'Asset Code',
                      lang === 'hi' ? 'खराबी' : 'Fault Symptom',
                      lang === 'hi' ? 'प्रकार' : 'Type',
                      lang === 'hi' ? 'प्रदाता' : 'Provider',
                      lang === 'hi' ? 'प्राथमिकता' : 'Priority',
                      t('status', lang),
                      t('action', lang),
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-3 font-semibold whitespace-nowrap"
                        style={{ color: 'var(--mute)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTickets.map((tk, idx) => (
                    <tr
                      key={tk.id}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        background: idx % 2 === 0 ? 'var(--surf)' : 'var(--surf2)',
                      }}
                    >
                      {/* Ticket ID */}
                      <td className="px-3 py-3 font-mono font-semibold whitespace-nowrap" style={{ color: 'var(--acc)' }}>
                        {tk.id}
                      </td>

                      {/* Asset Code + QR icon */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <span>{tk.assetCode}</span>
                          <button
                            title="Scan QR"
                            className="text-base leading-none"
                            style={{ color: 'var(--mute)' }}
                            onClick={handleQRScan}
                          >
                            📷
                          </button>
                        </span>
                      </td>

                      {/* Fault */}
                      <td
                        className="px-3 py-3 max-w-[180px] truncate"
                        title={tk.faultSymptom}
                      >
                        {tk.faultSymptom}
                      </td>

                      {/* Type */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {tk.maintenanceType === 'in-house'
                          ? lang === 'hi'
                            ? 'आंतरिक'
                            : 'In-house'
                          : lang === 'hi'
                            ? 'बाहरी'
                            : 'External'}
                      </td>

                      {/* Provider */}
                      <td className="px-3 py-3">{tk.provider || '—'}</td>

                      {/* Priority */}
                      <td className="px-3 py-3">
                        <PriorityBadge priority={tk.priority} />
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <StatusPill status={tk.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{
                              background: 'var(--surf2)',
                              color: 'var(--ink)',
                              border: '1px solid var(--line)',
                            }}
                            onClick={() => setViewTicket(tk)}
                          >
                            {lang === 'hi' ? 'देखें' : 'View'}
                          </button>

                          {tk.status !== 'Completed' && tk.status !== 'Scrapped' && (
                            <button
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                              style={{ background: 'var(--acc)' }}
                              onClick={() => acceptTicket(tk.id)}
                            >
                              {tk.status === 'Pending Maintenance'
                                ? lang === 'hi'
                                  ? 'स्वीकार'
                                  : 'Accept'
                                : tk.status === 'In Maintenance'
                                  ? lang === 'hi'
                                    ? 'पूर्ण करें'
                                    : 'Mark Done'
                                  : lang === 'hi'
                                    ? 'अनुमोदित करें'
                                    : 'Approve'}
                            </button>
                          )}

                          {tk.status !== 'Completed' && tk.status !== 'Scrapped' && (
                            <button
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                              style={{ background: 'var(--bad)' }}
                              onClick={() => closeTicket(tk.id)}
                            >
                              {lang === 'hi' ? 'बंद करें' : 'Close'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: New Ticket Form ─────────────────────────────────────────── */}
      {activeTab === 'new' && (
        <div
          className="rounded-b-2xl rounded-tr-2xl p-4 md:p-6"
          style={{ background: 'var(--surf)', border: '1px solid var(--line)', borderTop: 'none' }}
        >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Asset Code */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--mute)' }}>
                {lang === 'hi' ? 'एसेट कोड *' : 'Asset Code *'}
              </label>
              <div className="flex gap-2">
                <input
                  ref={assetCodeRef}
                  type="text"
                  className="flex-1 rounded-xl px-4 py-3 text-sm border outline-none"
                  style={{
                    background: 'var(--surf2)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                  }}
                  placeholder={lang === 'hi' ? 'जैसे NOI-SMT-2024-00001' : 'e.g. NOI-SMT-2024-00001'}
                  value={form.assetCode}
                  onChange={(e) => setField('assetCode', e.target.value)}
                />
                <button
                  type="button"
                  className="px-4 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 text-white whitespace-nowrap"
                  style={{ background: 'var(--acc)' }}
                  onClick={handleQRScan}
                >
                  📷 {t('scanQR', lang)}
                </button>
              </div>
            </div>

            {/* Fault Symptom */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--mute)' }}>
                {lang === 'hi' ? 'खराबी का लक्षण *' : 'Fault Symptom *'}
              </label>
              <textarea
                className="rounded-xl px-4 py-3 text-sm border outline-none resize-none"
                style={{
                  background: 'var(--surf2)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
                rows={3}
                placeholder={lang === 'hi' ? 'खराबी का विवरण…' : 'Describe the fault symptom…'}
                value={form.faultSymptom}
                onChange={(e) => setField('faultSymptom', e.target.value)}
              />
            </div>

            {/* Downtime Start */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold" style={{ color: 'var(--mute)' }}>
                {lang === 'hi' ? 'डाउनटाइम प्रारंभ' : 'Downtime Start'}
              </label>
              <input
                type="datetime-local"
                className="rounded-xl px-4 py-3 text-sm border outline-none"
                style={{
                  background: 'var(--surf2)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
                value={form.downtimeStart}
                onChange={(e) => setField('downtimeStart', e.target.value)}
              />
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold" style={{ color: 'var(--mute)' }}>
                {lang === 'hi' ? 'प्राथमिकता' : 'Priority'}
              </label>
              <select
                className="rounded-xl px-4 py-3 text-sm border outline-none"
                style={{
                  background: 'var(--surf2)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value as Priority)}
              >
                <option value="High">{lang === 'hi' ? 'उच्च (High)' : 'High'}</option>
                <option value="Medium">{lang === 'hi' ? 'मध्यम (Medium)' : 'Medium'}</option>
                <option value="Low">{lang === 'hi' ? 'निम्न (Low)' : 'Low'}</option>
              </select>
            </div>

            {/* Maintenance Type */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--mute)' }}>
                {lang === 'hi' ? 'रखरखाव प्रकार' : 'Maintenance Type'}
              </label>
              <div className="flex gap-4">
                {(['in-house', 'external'] as MaintenanceType[]).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="maintenanceType"
                      value={type}
                      checked={form.maintenanceType === type}
                      onChange={() => setField('maintenanceType', type)}
                      className="accent-[#165DFF] w-4 h-4"
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                      {type === 'in-house'
                        ? lang === 'hi'
                          ? 'आंतरिक (In-house)'
                          : 'In-house'
                        : lang === 'hi'
                          ? 'बाहरी सेवा (External)'
                          : 'External Service'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Service Provider — only when external */}
            {form.maintenanceType === 'external' && (
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-sm font-semibold" style={{ color: 'var(--mute)' }}>
                  {lang === 'hi' ? 'सेवा प्रदाता' : 'Service Provider'}
                </label>
                <input
                  type="text"
                  className="rounded-xl px-4 py-3 text-sm border outline-none"
                  style={{
                    background: 'var(--surf2)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                  }}
                  placeholder={lang === 'hi' ? 'प्रदाता का नाम…' : 'Provider name…'}
                  value={form.provider}
                  onChange={(e) => setField('provider', e.target.value)}
                />
              </div>
            )}

            {/* Estimated Cost */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold" style={{ color: 'var(--mute)' }}>
                {lang === 'hi' ? 'अनुमानित लागत (₹)' : 'Estimated Cost (INR)'}
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: 'var(--mute)' }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl pl-8 pr-4 py-3 text-sm border outline-none"
                  style={{
                    background: 'var(--surf2)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                  }}
                  placeholder="0.00"
                  value={form.estimatedCost}
                  onChange={(e) => setField('estimatedCost', e.target.value)}
                />
              </div>
              {form.estimatedCost && !isNaN(parseFloat(form.estimatedCost)) && (
                <span className="text-xs" style={{ color: 'var(--mute)' }}>
                  {formatINR(parseFloat(form.estimatedCost))}
                </span>
              )}
            </div>

            {/* Remarks */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold" style={{ color: 'var(--mute)' }}>
                {t('remarks', lang)}
              </label>
              <textarea
                className="rounded-xl px-4 py-3 text-sm border outline-none resize-none"
                style={{
                  background: 'var(--surf2)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
                rows={3}
                placeholder={lang === 'hi' ? 'अतिरिक्त टिप्पणी…' : 'Additional remarks…'}
                value={form.remarks}
                onChange={(e) => setField('remarks', e.target.value)}
              />
            </div>

            {/* Form Actions */}
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                style={{ background: 'var(--acc)' }}
              >
                {lang === 'hi' ? '✅ टिकट सहेजें' : '✅ Save Ticket'}
              </button>
              <button
                type="button"
                className="px-6 py-3 rounded-xl font-semibold text-sm"
                style={{
                  background: 'var(--surf2)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
                onClick={() => setForm({ ...EMPTY_FORM })}
              >
                {t('cancel', lang)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket detail modal */}
      <TicketModal />
    </div>
  )
}

export default IndiaMaintenanceView
