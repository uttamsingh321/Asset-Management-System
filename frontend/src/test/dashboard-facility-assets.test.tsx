import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { parseExcelOrCsvFile } from '../lib/excelImporter'

describe('Main Dashboard Facility Assets Register Specification', () => {
  beforeEach(() => {
    window.location.hash = '#dashboard'
    localStorage.clear()
    window.innerWidth = 1024
  })

  it('Main Dashboard displays the Facility Assets Register section with empty state when zero assets exist', () => {
    render(<App />)

    expect(screen.getByRole('region', { name: /Facility Assets Register/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Facility Assets Register/i })).toBeInTheDocument()
    expect(screen.getByText(/Zero Assets Registered in Dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/Add equipment or import an Excel spreadsheet to view real-time facility deployments for IIPL and Padget across buildings C39, D197, D198, and D199/i)).toBeInTheDocument()
  })

  it('Adding an asset with Company, Building, Floor, Dept, and In-Charge displays all required fields on the Main Dashboard', async () => {
    render(<App />)

    // Open Add Asset drawer
    const addAssetBtns = screen.getAllByRole('button', { name: /add asset/i })
    fireEvent.click(addAssetBtns[0])

    // Verify Company options in drawer
    const iipBtns = screen.getAllByRole('button', { name: /IIPL/i })
    const padgetBtns = screen.getAllByRole('button', { name: /Padget/i })
    expect(iipBtns.length).toBeGreaterThanOrEqual(1)
    expect(padgetBtns.length).toBeGreaterThanOrEqual(1)

    // Select Padget in drawer
    fireEvent.click(padgetBtns[padgetBtns.length - 1])

    // Verify Building options (C39, D197, D198, D199)
    const bldgD198Btns = screen.getAllByRole('button', { name: 'D198' })
    fireEvent.click(bldgD198Btns[bldgD198Btns.length - 1])

    // Fill in Floor
    fireEvent.change(screen.getByPlaceholderText(/1st Floor \/ xxx/i), {
      target: { value: '3rd Floor Testing Lab' },
    })

    // Fill in Basic Required Information
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. AST-DEL-0492/i), {
      target: { value: 'AST-PAD-8821' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. SN-88392104-X/i), {
      target: { value: 'SN-PDG-55109' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Pune Central Plant/i), {
      target: { value: 'Noida Manufacturing Facility' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Operational - Excellent \/ New/i), {
      target: { value: 'Operational - Good' },
    })
    fireEvent.change(screen.getByPlaceholderText(/MacBook Pro 16 inch M3 Pro Space Black/i), {
      target: { value: 'SMT Automated Optical Inspector' },
    })

    // Fill in Department ("Belong to which dept")
    fireEvent.change(screen.getByPlaceholderText(/SMT Operations, Quality Control/i), {
      target: { value: 'SMT Line 4' },
    })

    // Fill in Who in charge (ID, Name)
    fireEvent.change(screen.getByPlaceholderText(/Emp ID: e\.g\. EMP-102/i), {
      target: { value: 'EMP-7721' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Name: e\.g\. Rajesh Kumar/i), {
      target: { value: 'Ananya Sharma' },
    })

    // Save asset
    fireEvent.click(screen.getByRole('button', { name: /save asset/i }))

    // Navigate to dashboard
    window.location.hash = '#dashboard'
    fireEvent.click(screen.getByRole('link', { name: /Dashboard/i }))

    // Main Dashboard Facility Assets Register verification
    await waitFor(() => {
      // 1. Asset Code
      expect(screen.getByText('AST-PAD-8821')).toBeInTheDocument()
      // 2. Company (Padget)
      expect(screen.getAllByText('Padget').length).toBeGreaterThanOrEqual(1)
      // 3. Building (D198)
      expect(screen.getAllByText('D198').length).toBeGreaterThanOrEqual(1)
      // 4. Floor (3rd Floor Testing Lab)
      expect(screen.getByText('3rd Floor Testing Lab')).toBeInTheDocument()
      // 5. Belong to Dept (SMT Line 4)
      expect(screen.getByText('SMT Line 4')).toBeInTheDocument()
      // 6. Who in charge (ID, Name)
      expect(screen.getByText('Ananya Sharma')).toBeInTheDocument()
      expect(screen.getByText(/EMP-7721/i)).toBeInTheDocument()
    })
  })

  it('Excel / CSV Importer auto-extracts Company (IIPL/Padget), Building (C39/D197/D198/D199), Floor, Dept, and In-Charge', async () => {
    const csvContent = `assetCode,name,company,building,floor,department,inChargeId,inChargeName,status
AST-IMP-001,Precision Oscilloscope,Padget,D197,2nd Floor,Quality Assurance,EMP-901,Vikas Verma,Active
AST-IMP-002,Wave Soldering Machine,IIPL,C39,Ground Floor,Production,EMP-304,Pooja Patel,Active`

    const file = new File([csvContent], 'assets_facility_test.csv', { type: 'text/csv' })
    const result = await parseExcelOrCsvFile(file)

    expect(result.assets).toHaveLength(2)

    // First asset
    expect(result.assets[0].company).toBe('Padget')
    expect(result.assets[0].building).toBe('D197')
    expect(result.assets[0].floor).toBe('2nd Floor')
    expect(result.assets[0].currentDepartment).toBe('Quality Assurance')
    expect(result.assets[0].inChargeId).toBe('EMP-901')
    expect(result.assets[0].inChargeName).toBe('Vikas Verma')

    // Second asset
    expect(result.assets[1].company).toBe('IIPL')
    expect(result.assets[1].building).toBe('C39')
    expect(result.assets[1].floor).toBe('Ground Floor')
    expect(result.assets[1].currentDepartment).toBe('Production')
    expect(result.assets[1].inChargeId).toBe('EMP-304')
    expect(result.assets[1].inChargeName).toBe('Pooja Patel')
  })
})
