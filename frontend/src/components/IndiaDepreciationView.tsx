import React, { useState, useMemo } from 'react'
import { toast } from 'sonner'
import type { Asset } from '@/types/asset'
import {
  formatINR,
  formatDateIN,
  calcSLMDepreciation,
  t,
  type Language,
} from '@/lib/indiaLocale'

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportTab =
  | 'schedule'
  | 'summary'
  | 'monthly'
  | 'audit'

interface DepreciationRow {
  assetCode: string
  name: string
  category: string
  purchaseDate: string
  grossValue: number
  salvageValue: number
  usefulLife: number
  depreciationMethod: string
  accDepreciation: number
  netBookValue: number
  status: string
  fullyDepreciated: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthsSince(dateStr: string): number {
  if (!dateStr) return 0
  const purchase = new Date(dateStr)
  const now = new Date()
  return (
    (now.getFullYear() - purchase.getFullYear()) * 12 +
    (now.getMonth() - purchase.getMonth())
  )
}

function buildDepreciationRow(asset: Asset): DepreciationRow {
  const gross = asset.grossValue ?? asset.purchaseCost ?? 0
  const salvageRate = asset.salvageValueRate ?? 5
  const usefulLife = asset.usefulLifeYears ?? 5
  const months = monthsSince(asset.purchaseDate)

  let accDep = 0
  const method = asset.depreciationMethod ?? 'Straight Line (SLM)'
  if (method === 'Straight Line (SLM)') {
    accDep = calcSLMDepreciation(gross, salvageRate, usefulLife, months)
  } else {
    // WDV: use already-stored accumulated depreciation if present, else SLM fallback
    accDep = asset.accumulatedDepreciation ?? calcSLMDepreciation(gross, salvageRate, usefulLife, months)
  }

  const salvageValue = gross * (salvageRate / 100)
  const maxDep = gross - salvageValue
  accDep = Math.min(accDep, maxDep)
  const nbv = gross - accDep
  const fullyDepreciated = accDep >= maxDep

  return {
    assetCode: asset.assetCode,
    name: asset.name ?? asset.currentDescription,
    category: asset.category ?? asset.currentCategory,
    purchaseDate: asset.purchaseDate,
    grossValue: gross,
    salvageValue,
    usefulLife,
    depreciationMethod: method,
    accDepreciation: accDep,
    netBookValue: nbv,
    status: fullyDepreciated ? 'Fully Depreciated' : (asset.status ?? 'Active'),
    fullyDepreciated,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surf)',
      border: '1px solid var(--line)',
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 140,
      flex: '1 1 140px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--mute)', marginBottom: 2, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', color: '#94a3b8',
    }}>
      <svg width="48" height="48" fill="none" viewBox="0 0 48 48" style={{ marginBottom: 12 }}>
        <rect width="48" height="48" rx="12" fill="#f1f5f9" />
        <path d="M14 34V18l10-6 10 6v16H14z" stroke="#cbd5e1" strokeWidth="2" fill="none" />
        <path d="M20 34v-8h8v8" stroke="#cbd5e1" strokeWidth="2" fill="none" />
      </svg>
      <span style={{ fontSize: 14 }}>{message}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface IndiaDepreciationViewProps {
  assets: Asset[]
  lang: Language
}

export default function IndiaDepreciationView({ assets, lang }: IndiaDepreciationViewProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('schedule')

  const rows = useMemo(() => assets.map(buildDepreciationRow), [assets])

  const totalGross = useMemo(() => rows.reduce((s, r) => s + r.grossValue, 0), [rows])
  const totalAccDep = useMemo(() => rows.reduce((s, r) => s + r.accDepreciation, 0), [rows])
  const totalNBV = useMemo(() => rows.reduce((s, r) => s + r.netBookValue, 0), [rows])
  const fullyDepreciatedCount = useMemo(() => rows.filter(r => r.fullyDepreciated).length, [rows])

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'schedule', label: lang === 'hi' ? 'मूल्यह्रास अनुसूची' : 'Asset Depreciation Schedule' },
    { key: 'summary', label: lang === 'hi' ? 'मूल्य सारांश' : 'Asset Value Summary' },
    { key: 'monthly', label: lang === 'hi' ? 'मासिक नया/निपटान' : 'Monthly New/Disposed' },
    { key: 'audit', label: lang === 'hi' ? 'ऑडिट निर्यात सूची' : 'Audit Export List' },
  ]

  function handleExportExcel() {
    toast.info('Exporting to Excel...')
  }

  function handleExportPDF() {
    toast.info('Generating bilingual PDF...')
  }

  function handleRecalculate() {
    toast.info(lang === 'hi' ? 'मूल्यह्रास पुनर्गणना की जा रही है...' : 'Recalculating depreciation...')
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
    padding: '10px 12px',
    fontSize: 13,
    color: '#1e293b',
    borderBottom: '1px solid #f1f5f9',
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
            {t('depreciation', lang)} &amp; {t('reports', lang)}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {lang === 'hi' ? 'India IT अधिनियम Schedule II के अनुसार' : 'Per India Income Tax Act Schedule II'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleRecalculate}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #3b82f6',
              background: '#fff', color: '#3b82f6', fontSize: 13, cursor: 'pointer', fontWeight: 500,
            }}
          >
            🔄 {lang === 'hi' ? 'पुनर्गणना करें' : 'Recalculate Depreciation'}
          </button>
          <button
            onClick={handleExportExcel}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#16a34a', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
            }}
          >
            📊 {lang === 'hi' ? 'Excel निर्यात' : 'Export Excel'}
          </button>
          <button
            onClick={handleExportPDF}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
            }}
          >
            📄 {lang === 'hi' ? 'PDF निर्यात' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* SAP Integration Banner */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
        padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🔗</span>
        <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 500 }}>
          {lang === 'hi'
            ? 'SAP इंटीग्रेशन सक्षम — मूल्यह्रास मासिक रूप से सिंक होता है'
            : 'SAP integration enabled — depreciation syncs monthly'}
        </span>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryCard
          label={lang === 'hi' ? 'कुल सकल मूल्य' : 'Total Gross Value (INR)'}
          value={formatINR(totalGross)}
        />
        <SummaryCard
          label={lang === 'hi' ? 'कुल संचित मूल्यह्रास' : 'Total Accumulated Depreciation (INR)'}
          value={formatINR(totalAccDep)}
        />
        <SummaryCard
          label={lang === 'hi' ? 'कुल शुद्ध पुस्तक मूल्य' : 'Total Net Book Value (INR)'}
          value={formatINR(totalNBV)}
        />
        <SummaryCard
          label={lang === 'hi' ? 'पूर्ण मूल्यह्रासित संपत्तियां' : 'Assets Fully Depreciated'}
          value={String(fullyDepreciatedCount)}
          sub={lang === 'hi' ? 'संपत्तियां' : 'assets'}
        />
      </div>

      {/* Report Tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 0, borderBottom: '2px solid #e2e8f0',
        flexWrap: 'wrap',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.key ? '#3b82f6' : '#64748b',
              fontWeight: activeTab === tab.key ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0',
        borderTop: 'none', borderRadius: '0 0 10px 10px',
        overflow: 'hidden',
      }}>
        {/* ── Depreciation Schedule ── */}
        {activeTab === 'schedule' && (
          rows.length === 0
            ? <EmptyState message={lang === 'hi' ? 'कोई संपत्ति नहीं मिली' : 'No assets found'} />
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t('assetNo', lang)}</th>
                      <th style={thStyle}>{t('name', lang)}</th>
                      <th style={thStyle}>{t('category', lang)}</th>
                      <th style={thStyle}>{t('purchaseDate', lang)}</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>{t('grossValue', lang)}</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'अवशिष्ट मूल्य' : 'Salvage Value'}</th>
                      <th style={thStyle}>{t('usefulLife', lang)}</th>
                      <th style={thStyle}>{t('depreciationMethod', lang)}</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>{t('accDepreciation', lang)}</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'शुद्ध पुस्तक मूल्य' : 'Net Book Value (INR)'}</th>
                      <th style={thStyle}>{t('status', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.assetCode + i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: '#3b82f6' }}>{row.assetCode}</td>
                        <td style={tdStyle}>{row.name}</td>
                        <td style={tdStyle}>{row.category}</td>
                        <td style={tdStyle}>{formatDateIN(row.purchaseDate)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(row.grossValue)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(row.salvageValue)}</td>
                        <td style={tdStyle}>{row.usefulLife} {lang === 'hi' ? 'वर्ष' : 'yrs'}</td>
                        <td style={tdStyle}>{row.depreciationMethod}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>
                          {formatINR(row.accDepreciation)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                          {formatINR(row.netBookValue)}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: row.fullyDepreciated ? '#fef2f2' : '#f0fdf4',
                            color: row.fullyDepreciated ? '#dc2626' : '#16a34a',
                          }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {/* ── Asset Value Summary ── */}
        {activeTab === 'summary' && (
          <div style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
              {lang === 'hi' ? 'श्रेणी-वार मूल्य सारांश' : 'Category-wise Value Summary'}
            </h3>
            {rows.length === 0
              ? <EmptyState message={lang === 'hi' ? 'कोई डेटा नहीं' : 'No data available'} />
              : (() => {
                const catMap: Record<string, { gross: number; dep: number; nbv: number; count: number }> = {}
                rows.forEach(r => {
                  if (!catMap[r.category]) catMap[r.category] = { gross: 0, dep: 0, nbv: 0, count: 0 }
                  catMap[r.category].gross += r.grossValue
                  catMap[r.category].dep += r.accDepreciation
                  catMap[r.category].nbv += r.netBookValue
                  catMap[r.category].count++
                })
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>{t('category', lang)}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'संपत्तियां' : 'Assets'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'सकल मूल्य' : 'Gross Value'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'संचित मूल्यह्रास' : 'Acc. Depreciation'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'शुद्ध पुस्तक मूल्य' : 'Net Book Value'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(catMap).map(([cat, v], i) => (
                          <tr key={cat} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={tdStyle}>{cat}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{v.count}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(v.gross)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>{formatINR(v.dep)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(v.nbv)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()
            }
          </div>
        )}

        {/* ── Monthly New/Disposed ── */}
        {activeTab === 'monthly' && (
          <div style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
              {lang === 'hi' ? 'मासिक नई / निपटान संपत्तियां' : 'Monthly New / Disposed Assets'}
            </h3>
            {rows.length === 0
              ? <EmptyState message={lang === 'hi' ? 'कोई डेटा नहीं' : 'No data available'} />
              : (() => {
                const monthMap: Record<string, { added: number; disposed: number; addedValue: number }> = {}
                assets.forEach(a => {
                  const d = new Date(a.purchaseDate)
                  if (isNaN(d.getTime())) return
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                  if (!monthMap[key]) monthMap[key] = { added: 0, disposed: 0, addedValue: 0 }
                  monthMap[key].added++
                  monthMap[key].addedValue += a.grossValue ?? a.purchaseCost ?? 0
                  if (a.status === 'Disposed' || a.status === 'Pending Disposal') {
                    monthMap[key].disposed++
                  }
                })
                const sortedKeys = Object.keys(monthMap).sort().reverse()
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>{lang === 'hi' ? 'माह' : 'Month'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'नई संपत्तियां' : 'New Assets'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'जोड़ा गया मूल्य' : 'Value Added'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'निपटान' : 'Disposed'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedKeys.map((key, i) => {
                          const v = monthMap[key]
                          const [yr, mo] = key.split('-')
                          const label = new Date(Number(yr), Number(mo) - 1, 1)
                            .toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })
                          return (
                            <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={tdStyle}>{label}</td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>{v.added}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(v.addedValue)}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', color: v.disposed > 0 ? '#dc2626' : '#1e293b' }}>{v.disposed}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()
            }
          </div>
        )}

        {/* ── Audit Export List ── */}
        {activeTab === 'audit' && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                {lang === 'hi' ? 'ऑडिट निर्यात सूची' : 'Audit Export List'}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleExportExcel} style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: '#16a34a', color: '#fff', fontSize: 12, cursor: 'pointer',
                }}>📊 Excel</button>
                <button onClick={handleExportPDF} style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer',
                }}>📄 PDF</button>
              </div>
            </div>
            {rows.length === 0
              ? <EmptyState message={lang === 'hi' ? 'कोई डेटा नहीं' : 'No data available'} />
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t('assetNo', lang)}</th>
                        <th style={thStyle}>{t('name', lang)}</th>
                        <th style={thStyle}>{t('category', lang)}</th>
                        <th style={thStyle}>{t('purchaseDate', lang)}</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'सकल मूल्य' : 'Gross Value'}</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'संचित मूल्यह्रास' : 'Acc. Dep.'}</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'hi' ? 'शुद्ध पुस्तक मूल्य' : 'NBV'}</th>
                        <th style={thStyle}>{t('depreciationMethod', lang)}</th>
                        <th style={thStyle}>{t('status', lang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.assetCode + i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{row.assetCode}</td>
                          <td style={tdStyle}>{row.name}</td>
                          <td style={tdStyle}>{row.category}</td>
                          <td style={tdStyle}>{formatDateIN(row.purchaseDate)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(row.grossValue)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>{formatINR(row.accDepreciation)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(row.netBookValue)}</td>
                          <td style={{ ...tdStyle, fontSize: 11 }}>{row.depreciationMethod}</td>
                          <td style={tdStyle}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                              background: row.fullyDepreciated ? '#fef2f2' : '#f0fdf4',
                              color: row.fullyDepreciated ? '#dc2626' : '#16a34a',
                            }}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        )}
      </div>
    </div>
  )
}
