import React, { useState } from 'react'
import { toast } from 'sonner'
import type { Asset } from '@/types/asset'
import { formatINR, formatDateIN, t, type Language, todayISO } from '@/lib/indiaLocale'

// ─── Types ───────────────────────────────────────────────────────────────────

type DisposalReason =
  | 'Damaged — no repair value'
  | 'EOL Phase-out'
  | 'Expired'
  | 'Obsolete'

type DisposalMethod =
  | 'Sale'
  | 'Scrap Recycling'
  | 'Return to Supplier'

type DisposalStatus = 'Pending Approval' | 'Approved' | 'Rejected'

interface DisposalApplication {
  id: string
  assetCode: string
  assetName: string
  reason: DisposalReason
  method: DisposalMethod
  proceeds: number
  approverRemarks: string
  status: DisposalStatus
  date: string
  disposalNote?: string
}

type DisposalTab = 'list' | 'new'

// ─── Helpers / Sub-components ─────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '56px 24px', color: '#94a3b8',
    }}>
      <svg width="52" height="52" fill="none" viewBox="0 0 52 52" style={{ marginBottom: 14 }}>
        <rect width="52" height="52" rx="14" fill="#f1f5f9" />
        <path d="M18 36l4-10h8l4 10H18z" stroke="#cbd5e1" strokeWidth="2" fill="none" />
        <path d="M22 26v-6a4 4 0 118 0v6" stroke="#cbd5e1" strokeWidth="2" fill="none" />
        <circle cx="26" cy="20" r="2" fill="#cbd5e1" />
      </svg>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{message}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: DisposalStatus }) {
  const cfg: Record<DisposalStatus, { bg: string; color: string; label: string }> = {
    'Pending Approval': { bg: '#fef9c3', color: '#a16207', label: 'Pending Approval' },
    'Approved':         { bg: '#f0fdf4', color: '#16a34a', label: 'Approved' },
    'Rejected':         { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
  }
  const s = cfg[status]
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface IndiaDisposalViewProps {
  assets: Asset[]
  onDisposeAsset: (assetId: string, reason: string, method: string, proceeds: number) => void
  lang: Language
}

const DISPOSAL_REASONS: DisposalReason[] = [
  'Damaged — no repair value',
  'EOL Phase-out',
  'Expired',
  'Obsolete',
]

const DISPOSAL_METHODS: DisposalMethod[] = [
  'Sale',
  'Scrap Recycling',
  'Return to Supplier',
]

export default function IndiaDisposalView({ assets, onDisposeAsset, lang }: IndiaDisposalViewProps) {
  const [activeTab, setActiveTab] = useState<DisposalTab>('list')
  const [applications, setApplications] = useState<DisposalApplication[]>([])

  // Form state
  const [formAssetCode, setFormAssetCode] = useState('')
  const [formReason, setFormReason] = useState<DisposalReason>(DISPOSAL_REASONS[0])
  const [formMethod, setFormMethod] = useState<DisposalMethod>(DISPOSAL_METHODS[0])
  const [formProceeds, setFormProceeds] = useState<number>(0)
  const [formRemarks, setFormRemarks] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function validateForm(): boolean {
    const errors: Record<string, string> = {}
    if (!formAssetCode.trim()) {
      errors.assetCode = lang === 'hi' ? 'संपत्ति कोड आवश्यक है' : 'Asset code is required'
    }
    if (formProceeds < 0) {
      errors.proceeds = lang === 'hi' ? 'राशि ऋणात्मक नहीं हो सकती' : 'Proceeds cannot be negative'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)

    const matchedAsset = assets.find(
      a => a.assetCode.toLowerCase() === formAssetCode.trim().toLowerCase()
    )

    const newApp: DisposalApplication = {
      id: `DISP-${Date.now()}`,
      assetCode: formAssetCode.trim(),
      assetName: matchedAsset?.name ?? matchedAsset?.currentDescription ?? formAssetCode.trim(),
      reason: formReason,
      method: formMethod,
      proceeds: formProceeds,
      approverRemarks: formRemarks,
      status: 'Pending Approval',
      date: todayISO(),
    }

    setApplications(prev => [newApp, ...prev])
    if (matchedAsset) {
      onDisposeAsset(matchedAsset.id, formReason, formMethod, formProceeds)
    }

    toast.success(lang === 'hi' ? 'निपटान आवेदन सफलतापूर्वक जमा किया गया' : 'Disposal application submitted — Pending Approval')

    // Reset form
    setFormAssetCode('')
    setFormReason(DISPOSAL_REASONS[0])
    setFormMethod(DISPOSAL_METHODS[0])
    setFormProceeds(0)
    setFormRemarks('')
    setFormErrors({})
    setSubmitting(false)
    setActiveTab('list')
  }

  function handleApprove(id: string) {
    setApplications(prev =>
      prev.map(a => a.id === id
        ? { ...a, status: 'Approved', disposalNote: 'Depreciation no longer accrued' }
        : a
      )
    )
    toast.success(lang === 'hi' ? 'आवेदन स्वीकृत किया गया' : 'Application approved — asset marked as Disposed')
  }

  function handleReject(id: string) {
    setApplications(prev =>
      prev.map(a => a.id === id ? { ...a, status: 'Rejected' } : a)
    )
    toast.info(lang === 'hi' ? 'आवेदन अस्वीकार किया गया' : 'Application rejected')
  }

  function handleViewDocs(id: string) {
    toast.info(lang === 'hi' ? `दस्तावेज़ देख रहे हैं: ${id}` : `Viewing audit documents for: ${id}`)
  }

  function handleScan() {
    toast.info(lang === 'hi' ? 'QR स्कैनर खुल रहा है...' : 'Opening QR scanner...')
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
    background: '#f8fafc',
  }

  const tdStyle: React.CSSProperties = {
    padding: '11px 12px',
    fontSize: 13,
    color: '#1e293b',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
            {t('disposal', lang)}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {lang === 'hi' ? 'संपत्ति निपटान प्रबंधन' : 'Asset Disposal Management'}
          </p>
        </div>
        <button
          onClick={() => setActiveTab('new')}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: '#3b82f6', color: '#fff', fontSize: 14,
            cursor: 'pointer', fontWeight: 600,
            minHeight: 44,
          }}
        >
          + {lang === 'hi' ? 'नया आवेदन' : 'New Application'}
        </button>
      </div>

      {/* Indian Tax Compliance Banner */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
        padding: '10px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>⚖️</span>
        <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 500 }}>
          {lang === 'hi'
            ? 'निपटान दस्तावेज़ भारतीय आयकर ऑडिट आवश्यकताओं के लिए सुरक्षित रखे गए हैं'
            : 'Disposal documentation retained for Indian Income Tax audit requirements'}
        </span>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 0,
      }}>
        {([
          { key: 'list' as DisposalTab, label: lang === 'hi' ? 'निपटान आवेदन' : 'Disposal Applications' },
          { key: 'new'  as DisposalTab, label: lang === 'hi' ? 'नया आवेदन' : 'New Application' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 24px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.key ? '#3b82f6' : '#64748b',
              fontWeight: activeTab === tab.key ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'color 0.15s',
              minHeight: 44,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content wrapper */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderTop: 'none',
        borderRadius: '0 0 10px 10px',
        overflow: 'hidden',
      }}>
        {/* ── Disposal Applications List ── */}
        {activeTab === 'list' && (
          applications.length === 0
            ? <EmptyState message={lang === 'hi' ? 'कोई निपटान आवेदन नहीं मिला' : 'No disposal applications yet'} />
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{lang === 'hi' ? 'आवेदन ID' : 'Application ID'}</th>
                      <th style={thStyle}>{lang === 'hi' ? 'संपत्ति कोड' : 'Asset Code'}</th>
                      <th style={thStyle}>{t('name', lang)}</th>
                      <th style={thStyle}>{lang === 'hi' ? 'कारण' : 'Reason'}</th>
                      <th style={thStyle}>{lang === 'hi' ? 'पद्धति' : 'Method'}</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'आय (INR)' : 'Proceeds (INR)'}</th>
                      <th style={thStyle}>{t('status', lang)}</th>
                      <th style={thStyle}>{lang === 'hi' ? 'तिथि' : 'Date'}</th>
                      <th style={thStyle}>{t('action', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app, i) => (
                      <React.Fragment key={app.id}>
                        <tr style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ ...tdStyle, fontWeight: 600, color: '#7c3aed', fontSize: 12 }}>{app.id}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: '#3b82f6' }}>{app.assetCode}</td>
                          <td style={tdStyle}>{app.assetName}</td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>{app.reason}</td>
                          <td style={tdStyle}>{app.method}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatINR(app.proceeds)}
                          </td>
                          <td style={tdStyle}><StatusBadge status={app.status} /></td>
                          <td style={tdStyle}>{formatDateIN(app.date)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {app.status === 'Pending Approval' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(app.id)}
                                    style={{
                                      padding: '6px 12px', borderRadius: 6, border: 'none',
                                      background: '#16a34a', color: '#fff', fontSize: 12,
                                      cursor: 'pointer', fontWeight: 600, minHeight: 32,
                                    }}
                                  >
                                    ✓ {lang === 'hi' ? 'स्वीकृत' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => handleReject(app.id)}
                                    style={{
                                      padding: '6px 12px', borderRadius: 6, border: 'none',
                                      background: '#dc2626', color: '#fff', fontSize: 12,
                                      cursor: 'pointer', fontWeight: 600, minHeight: 32,
                                    }}
                                  >
                                    ✕ {lang === 'hi' ? 'अस्वीकार' : 'Reject'}
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleViewDocs(app.id)}
                                style={{
                                  padding: '6px 12px', borderRadius: 6,
                                  border: '1px solid #e2e8f0',
                                  background: '#fff', color: '#374151', fontSize: 12,
                                  cursor: 'pointer', fontWeight: 500, minHeight: 32,
                                }}
                              >
                                📄 {lang === 'hi' ? 'दस्तावेज़' : 'View Docs'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Disposal note row */}
                        {app.status === 'Approved' && app.disposalNote && (
                          <tr style={{ background: '#f0fdf4' }}>
                            <td colSpan={9} style={{ padding: '8px 16px', fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
                              🔒 {lang === 'hi'
                                ? 'संपत्ति "निपटान" के रूप में लॉक है — मूल्यह्रास अब जमा नहीं हो रहा है। ऑडिट दस्तावेज़ सुरक्षित हैं।'
                                : `Asset status locked as "Disposed" — ${app.disposalNote}. Audit documentation retained.`}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {/* ── New Application Form ── */}
        {activeTab === 'new' && (
          <div style={{ padding: 32, maxWidth: 640 }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              {lang === 'hi' ? 'नया निपटान आवेदन' : 'New Disposal Application'}
            </h3>
            <form onSubmit={handleSubmit} noValidate>
              {/* Asset Code */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  {lang === 'hi' ? 'संपत्ति कोड *' : 'Asset Code *'}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={formAssetCode}
                    onChange={e => setFormAssetCode(e.target.value)}
                    placeholder={lang === 'hi' ? 'जैसे NOI-SMT-2024-00001' : 'e.g. NOI-SMT-2024-00001'}
                    style={{
                      ...inputStyle,
                      borderColor: formErrors.assetCode ? '#dc2626' : '#e2e8f0',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleScan}
                    style={{
                      padding: '10px 16px', borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc', color: '#374151',
                      fontSize: 18, cursor: 'pointer',
                      whiteSpace: 'nowrap', minHeight: 44, minWidth: 44,
                    }}
                    title={t('scanQR', lang)}
                  >
                    📷
                  </button>
                </div>
                {formErrors.assetCode && (
                  <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>
                    {formErrors.assetCode}
                  </span>
                )}
              </div>

              {/* Disposal Reason */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  {lang === 'hi' ? 'निपटान का कारण *' : 'Disposal Reason *'}
                </label>
                <select
                  value={formReason}
                  onChange={e => setFormReason(e.target.value as DisposalReason)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {DISPOSAL_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Disposal Method */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  {lang === 'hi' ? 'निपटान पद्धति *' : 'Disposal Method *'}
                </label>
                <select
                  value={formMethod}
                  onChange={e => setFormMethod(e.target.value as DisposalMethod)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {DISPOSAL_METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Disposal Proceeds */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  {lang === 'hi' ? 'निपटान आय (INR)' : 'Disposal Proceeds (INR)'}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: '#64748b', fontSize: 14, pointerEvents: 'none',
                  }}>₹</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formProceeds}
                    onChange={e => setFormProceeds(parseFloat(e.target.value) || 0)}
                    style={{
                      ...inputStyle,
                      paddingLeft: 28,
                      borderColor: formErrors.proceeds ? '#dc2626' : '#e2e8f0',
                    }}
                  />
                </div>
                {formErrors.proceeds && (
                  <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>
                    {formErrors.proceeds}
                  </span>
                )}
                {formProceeds > 0 && (
                  <span style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'block' }}>
                    = {formatINR(formProceeds)}
                  </span>
                )}
              </div>

              {/* Approver Remarks */}
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>
                  {lang === 'hi' ? 'अनुमोदक की टिप्पणी' : 'Approver Remarks'}
                </label>
                <textarea
                  value={formRemarks}
                  onChange={e => setFormRemarks(e.target.value)}
                  rows={3}
                  placeholder={lang === 'hi' ? 'वैकल्पिक टिप्पणी...' : 'Optional remarks...'}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: 80,
                  }}
                />
              </div>

              {/* Approval Workflow Info */}
              <div style={{
                background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8,
                padding: '10px 14px', marginBottom: 24,
                fontSize: 12, color: '#c2410c',
              }}>
                ℹ️ {lang === 'hi'
                  ? 'आवेदन जमा होने पर स्थिति "अनुमोदन प्रतीक्षित" रहेगी।'
                  : 'Submission will enter the approval workflow with status "Pending Approval".'}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '12px 28px', borderRadius: 8, border: 'none',
                    background: submitting ? '#93c5fd' : '#3b82f6',
                    color: '#fff', fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer',
                    fontWeight: 700, minHeight: 48,
                  }}
                >
                  {submitting
                    ? (lang === 'hi' ? 'जमा हो रहा है...' : 'Submitting...')
                    : (lang === 'hi' ? 'आवेदन जमा करें' : 'Submit Application')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  style={{
                    padding: '12px 24px', borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#fff', color: '#374151',
                    fontSize: 14, cursor: 'pointer',
                    fontWeight: 500, minHeight: 48,
                  }}
                >
                  {t('cancel', lang)}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
