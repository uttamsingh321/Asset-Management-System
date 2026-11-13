import * as React from 'react'
import {
  fetchAuditLogs,
  getClientDeviceInfo,
  getCurrentUserProfile,
  logAuditEvent,
  type AuditRecord,
  type DeviceType,
} from '@/lib/deviceTracker'
import { toast } from 'sonner'

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = React.useState<AuditRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionFilter, setActionFilter] = React.useState<string>('')
  const [deviceFilter, setDeviceFilter] = React.useState<string>('')
  const [search, setSearch] = React.useState<string>('')
  const [selectedLog, setSelectedLog] = React.useState<AuditRecord | null>(null)

  const currentDevice = React.useMemo(() => getClientDeviceInfo(), [])
  const currentUser = React.useMemo(() => getCurrentUserProfile(), [])

  const loadLogs = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAuditLogs({
        action: actionFilter || undefined,
        deviceType: deviceFilter || undefined,
        search: search || undefined,
      })
      setLogs(data.auditLogs)
    } catch {
      toast.error('Failed to load audit trail')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, deviceFilter, search])

  React.useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Compute breakdown stats
  const actionCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    logs.forEach((l) => {
      counts[l.action] = (counts[l.action] || 0) + 1
    })
    return counts
  }, [logs])

  const deviceCounts = React.useMemo(() => {
    const counts: Record<string, number> = { Desktop: 0, Laptop: 0, Tablet: 0, Mobile: 0 }
    logs.forEach((l) => {
      counts[l.deviceType] = (counts[l.deviceType] || 0) + 1
    })
    return counts
  }, [logs])

  const handleExportAuditLogs = async () => {
    if (logs.length === 0) {
      toast.warning('No audit logs available to export.')
      return
    }

    // Log the export event itself into the audit trail!
    await logAuditEvent('ASSET_EXPORT', {
      exportType: 'ImmutableAuditLog',
      recordsCount: logs.length,
      filters: { actionFilter, deviceFilter, search },
    }, 'AUDIT-EXPORT')

    // Generate CSV
    const headers = [
      'Timestamp',
      'Action',
      'User Name',
      'User ID',
      'Role',
      'Session ID',
      'Device Type',
      'OS',
      'Browser',
      'Client IP',
      'Hostname',
      'Entity ID',
    ]

    const csvRows = [headers.join(',')]
    logs.forEach((l) => {
      const row = [
        `"${l.timestamp}"`,
        `"${l.action}"`,
        `"${l.userName}"`,
        `"${l.userId}"`,
        `"${l.role}"`,
        `"${l.sessionId}"`,
        `"${l.deviceType}"`,
        `"${l.os}"`,
        `"${l.browser}"`,
        `"${l.clientIp || '127.0.0.1'}"`,
        `"${l.hostname || 'localhost'}"`,
        `"${l.entityId || ''}"`,
      ]
      csvRows.push(row.join(','))
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `meridian_audit_trail_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('Immutable audit trail exported successfully!')
    loadLogs()
  }

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'LOGIN':
      case 'ASSET_CREATE':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      case 'LOGOUT':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
      case 'ASSET_UPDATE':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      case 'ASSET_IMPORT':
      case 'ASSET_EXPORT':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
      case 'ASSET_TRANSFER':
      case 'ASSET_APPROVAL':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
      case 'ASSET_DELETE':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20'
    }
  }

  const getDeviceIcon = (deviceType: DeviceType) => {
    switch (deviceType) {
      case 'Desktop':
        return '🖥️'
      case 'Laptop':
        return '💻'
      case 'Tablet':
        return '📱'
      case 'Mobile':
        return '📱'
      default:
        return '💻'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="top flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h1>Audit & Device Tracking</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-[var(--acc2)] text-[var(--acc)]">
              Immutable SOC 2 Log
            </span>
          </div>
          <div className="sub">
            Real-time immutable compliance ledger recording every login, asset creation, update,
            import, export, transfer, approval, and deletion with device telemetry.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="btn"
            title="Refresh live audit trail"
          >
            ↻ Refresh
          </button>
          <button
            onClick={handleExportAuditLogs}
            className="btn p flex items-center gap-1.5"
            title="Export full immutable audit trail"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export Audit Trail
          </button>
        </div>
      </div>

      {/* Active Device & Telemetry Banner */}
      <div className="card p-4 bg-gradient-to-r from-[var(--acc2)]/50 to-[var(--surf)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--acc)] text-white flex items-center justify-center text-lg shadow-sm">
            {getDeviceIcon(currentDevice.deviceType)}
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
              <span>Current Session: {currentDevice.deviceType}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-normal text-[var(--mute)]">Active Tracking</span>
            </div>
            <div className="text-xs text-[var(--mute)]">
              {currentUser.userName} ({currentUser.userId} · {currentUser.role}) — {currentDevice.os} · {currentDevice.browser} · Host: {currentDevice.hostname}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
            <span className="text-[var(--mute)] mr-1">Resolution:</span>
            <strong>{currentDevice.screenResolution}</strong>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
            <span className="text-[var(--mute)] mr-1">Compliance:</span>
            <strong className="text-emerald-600">SOC 2 / ISO 27001</strong>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Devices tracked</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 space-y-1">
            <div className="text-xs text-[var(--mute)]">Total Audit Events</div>
            <div className="text-2xl font-bold text-[var(--ink)]">{logs.length.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-600 font-medium">100% Immutable</div>
          </div>

          <div className="card p-4 space-y-1">
            <div className="text-xs text-[var(--mute)]">Tracked Devices</div>
            <div className="flex items-center gap-2 text-xs pt-1">
              <span>🖥️ {deviceCounts.Desktop}</span>
              <span>💻 {deviceCounts.Laptop}</span>
              <span>📱 {deviceCounts.Tablet + deviceCounts.Mobile}</span>
            </div>
            <div className="text-[11px] text-[var(--mute)]">Auto-detected</div>
          </div>

          <div className="card p-4 space-y-1">
            <div className="text-xs text-[var(--mute)]">Asset Operations</div>
            <div className="text-2xl font-bold text-[var(--ink)]">
              {(
                (actionCounts.ASSET_CREATE || 0) +
                (actionCounts.ASSET_UPDATE || 0) +
                (actionCounts.ASSET_TRANSFER || 0) +
                (actionCounts.ASSET_APPROVAL || 0) +
                (actionCounts.ASSET_DELETE || 0)
              ).toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--acc)] font-medium">Lifecycle Tracked</div>
          </div>

          <div className="card p-4 space-y-1">
            <div className="text-xs text-[var(--mute)]">Security Logins/Logouts</div>
            <div className="text-2xl font-bold text-[var(--ink)]">
              {((actionCounts.LOGIN || 0) + (actionCounts.LOGOUT || 0)).toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--mute)]">Session Audited</div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Live audit events</h2>
        <div className="card p-3 flex flex-wrap items-center justify-between gap-3 bg-[var(--surf)] border border-[var(--line)]">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user, action, IP, hostname, asset code, session..."
              className="w-full px-3 py-1.5 pl-8 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
            />
            <span className="absolute left-2.5 top-2 text-xs text-[var(--mute)]">🔍</span>
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-[var(--mute)] hover:text-[var(--ink)]"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="ASSET_CREATE">ASSET_CREATE</option>
            <option value="ASSET_UPDATE">ASSET_UPDATE</option>
            <option value="ASSET_IMPORT">ASSET_IMPORT</option>
            <option value="ASSET_EXPORT">ASSET_EXPORT</option>
            <option value="ASSET_TRANSFER">ASSET_TRANSFER</option>
            <option value="ASSET_APPROVAL">ASSET_APPROVAL</option>
            <option value="ASSET_DELETE">ASSET_DELETE</option>
          </select>

          {/* Device Type Filter */}
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
          >
            <option value="">All Devices</option>
            <option value="Desktop">Desktop</option>
            <option value="Laptop">Laptop</option>
            <option value="Tablet">Tablet</option>
            <option value="Mobile">Mobile</option>
          </select>
        </div>
      </div>
    </div>

      {/* Audit Log Table */}
      <div className="card overflow-hidden border border-[var(--line)] p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surf2)]/70 text-[var(--mute)] border-b border-[var(--line)] font-semibold">
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">User & Role</th>
                <th className="py-2.5 px-3">Device & Telemetry</th>
                <th className="py-2.5 px-3">IP & Hostname</th>
                <th className="py-2.5 px-3">Entity Target</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--mute)]">
                    Loading immutable audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center space-y-2 text-[var(--mute)]">
                    <div className="text-2xl">📋</div>
                    <div>No audit entries matching filter criteria.</div>
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr
                    key={log.id || `${log.timestamp}-${idx}`}
                    className="hover:bg-[var(--surf2)]/50 transition cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    {/* Timestamp */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-[var(--ink)] font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeClass(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* User & Role */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[var(--ink)]">{log.userName}</div>
                      <div className="text-[11px] text-[var(--mute)]">
                        {log.userId} · <span className="font-medium">{log.role}</span>
                      </div>
                    </td>

                    {/* Device & Telemetry */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--ink)]">
                        <span>{getDeviceIcon(log.deviceType)}</span>
                        <span>{log.deviceType}</span>
                      </div>
                      <div className="text-[11px] text-[var(--mute)]">
                        {log.os} · {log.browser}
                      </div>
                    </td>

                    {/* IP & Hostname */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                      <div className="text-[var(--ink)]">{log.clientIp || '127.0.0.1'}</div>
                      <div className="text-[var(--mute)] text-[10px]">{log.hostname || 'localhost'}</div>
                    </td>

                    {/* Target Entity */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                      {log.entityId ? (
                        <span className="font-semibold text-[var(--acc)]">{log.entityId}</span>
                      ) : (
                        <span className="text-[var(--mute)]">—</span>
                      )}
                    </td>

                    {/* Details Action */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLog(log)
                        }}
                        className="px-2 py-1 text-[11px] font-medium rounded border border-[var(--line)] bg-[var(--surf)] hover:bg-[var(--surf2)] transition"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal Dialog */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  Audit Entry Details: {selectedLog.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--mute)] hover:bg-[var(--surf2)] transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-[var(--surf2)]/70">
                <span className="text-[var(--mute)] block">User & Role</span>
                <strong>{selectedLog.userName}</strong> ({selectedLog.userId})
                <div className="text-[var(--mute)]">Role: {selectedLog.role}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--surf2)]/70">
                <span className="text-[var(--mute)] block">Device Telemetry</span>
                <strong>
                  {getDeviceIcon(selectedLog.deviceType)} {selectedLog.deviceType}
                </strong>
                <div className="text-[var(--mute)]">
                  {selectedLog.os} · {selectedLog.browser}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--surf2)]/70">
                <span className="text-[var(--mute)] block">Network & Session</span>
                <strong>{selectedLog.clientIp || '127.0.0.1'}</strong>
                <div className="text-[var(--mute)] truncate">Host: {selectedLog.hostname || 'localhost'}</div>
                <div className="text-[var(--mute)] text-[10px] truncate">
                  Session: {selectedLog.sessionId}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--surf2)]/70">
                <span className="text-[var(--mute)] block">Timestamp & Entity</span>
                <strong className="font-mono text-[11px]">{selectedLog.timestamp}</strong>
                <div className="text-[var(--acc)] font-semibold mt-0.5">
                  Target: {selectedLog.entityId || selectedLog.entityType || 'General'}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-[var(--mute)]">Event Payload Details:</div>
              <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                {JSON.stringify(selectedLog.details || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn primary px-4 py-1.5 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
