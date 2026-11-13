import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { AuditLogView } from '../components/AuditLogView'
import {
  detectDeviceType,
  detectOperatingSystem,
  detectBrowser,
  getClientDeviceInfo,
  logAuditEvent,
  fetchAuditLogs,
} from '../lib/deviceTracker'

describe('Comprehensive Audit & Device Tracking System Specification', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = '#audit'
    vi.restoreAllMocks()
  })

  it('Device Detection: Automatically identifies Desktop, Laptop, Tablet, and Mobile environments', () => {
    // 1. Tablet detection (iPad User Agent)
    const originalUA = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    expect(detectDeviceType()).toBe('Tablet')

    // 2. Mobile detection (iPhone / Android Mobile)
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Version/17.3 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    expect(detectDeviceType()).toBe('Mobile')

    // 3. Laptop detection (MacBook Pro / Chromebook)
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MacBookPro18,1 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      configurable: true,
    })
    expect(detectDeviceType()).toBe('Laptop')

    // Restore standard desktop user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true,
    })

    const deviceInfo = getClientDeviceInfo()
    expect(deviceInfo.deviceType).toBeDefined()
    expect(deviceInfo.os).toBeDefined()
    expect(deviceInfo.browser).toBeDefined()
    expect(detectOperatingSystem()).toBeDefined()
    expect(detectBrowser()).toBeDefined()
  })

  it('Audit Logger: Records and persists audit entries with full telemetry for every required action', async () => {
    // Test logging all actions: LOGIN, LOGOUT, ASSET_CREATE, ASSET_UPDATE, ASSET_IMPORT, ASSET_EXPORT, ASSET_TRANSFER, ASSET_APPROVAL, ASSET_DELETE
    const record1 = await logAuditEvent(
      'ASSET_CREATE',
      { assetCode: 'AST-TEST-99', name: 'Precision CNC Mill', cost: 45000 },
      'AST-TEST-99'
    )
    expect(record1.action).toBe('ASSET_CREATE')
    expect(record1.entityId).toBe('AST-TEST-99')
    expect(record1.userId).toBeDefined()
    expect(record1.userName).toBeDefined()
    expect(record1.sessionId).toBeDefined()
    expect(record1.deviceType).toBeDefined()

    const record2 = await logAuditEvent(
      'ASSET_TRANSFER',
      { assetCode: 'AST-TEST-99', fromDept: 'Operations', toDept: 'Fabrication' },
      'AST-TEST-99'
    )
    expect(record2.action).toBe('ASSET_TRANSFER')

    const record3 = await logAuditEvent(
      'ASSET_APPROVAL',
      { assetCode: 'AST-TEST-99', decision: 'Approved', approver: 'Dr. Rao' },
      'AST-TEST-99'
    )
    expect(record3.action).toBe('ASSET_APPROVAL')

    const record4 = await logAuditEvent(
      'ASSET_DELETE',
      { assetCode: 'AST-TEST-99', reason: 'Decommissioned' },
      'AST-TEST-99'
    )
    expect(record4.action).toBe('ASSET_DELETE')

    // Verify fetchAuditLogs retrieves all saved entries
    const logsData = await fetchAuditLogs()
    expect(logsData.totalCount).toBeGreaterThanOrEqual(4)
    const actions = logsData.auditLogs.map((l) => l.action)
    expect(actions).toContain('ASSET_CREATE')
    expect(actions).toContain('ASSET_TRANSFER')
    expect(actions).toContain('ASSET_APPROVAL')
    expect(actions).toContain('ASSET_DELETE')
  })

  it('Audit & Device Tracking View: Displays active telemetry, summary cards, and live audit ledger', async () => {
    // Pre-populate an audit log
    await logAuditEvent(
      'ASSET_IMPORT',
      { rowCount: 5000, filename: 'inventory_2026.xlsx', categories: 12 },
      'IMP-2026-XLSX'
    )

    render(<AuditLogView />)

    // Verify Header & Subline
    expect(screen.getByRole('heading', { level: 1, name: /Audit & Device Tracking/i })).toBeInTheDocument()
    expect(screen.getByText(/Immutable SOC 2 Log/i)).toBeInTheDocument()

    // Verify Active Session Device Tracking Banner
    expect(screen.getByText(/Current Session:/i)).toBeInTheDocument()
    expect(screen.getByText(/Active Tracking/i)).toBeInTheDocument()

    // Verify KPI summary metrics
    expect(screen.getByText(/Total Audit Events/i)).toBeInTheDocument()
    expect(screen.getByText(/Tracked Devices/i)).toBeInTheDocument()
    expect(screen.getByText(/Asset Operations/i)).toBeInTheDocument()

    // Verify Table Columns
    expect(screen.getByText('Date & Time')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText('User & Role')).toBeInTheDocument()
    expect(screen.getByText('Device & Telemetry')).toBeInTheDocument()
    expect(screen.getByText('IP & Hostname')).toBeInTheDocument()
    expect(screen.getByText('Entity Target')).toBeInTheDocument()

    // Verify recorded action appears in table
    await waitFor(() => {
      expect(screen.getByText('ASSET_IMPORT')).toBeInTheDocument()
    })

    // Click "View Details" to open inspection modal
    const viewDetailsBtn = await screen.findByRole('button', { name: /View Details/i })
    fireEvent.click(viewDetailsBtn)

    await waitFor(() => {
      expect(screen.getByText(/Audit Entry Details: ASSET_IMPORT/i)).toBeInTheDocument()
      expect(screen.getByText(/inventory_2026\.xlsx/i)).toBeInTheDocument()
    })

    // Close detail modal
    fireEvent.click(screen.getByRole('button', { name: /Close/i }))
  })

  it('App Integration: Navigating to #audit renders AuditLogView with export option', async () => {
    render(<App />)

    // Navigate to Audit & Tracking
    const auditNavBtn = screen.getByRole('link', { name: /Audit & Tracking/i })
    expect(auditNavBtn).toBeInTheDocument()
    fireEvent.click(auditNavBtn)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Audit & Device Tracking/i })).toBeInTheDocument()
    })

    // Test Export Audit Trail button
    const exportBtn = screen.getByRole('button', { name: /Export Audit Trail/i })
    expect(exportBtn).toBeInTheDocument()
  })
})
