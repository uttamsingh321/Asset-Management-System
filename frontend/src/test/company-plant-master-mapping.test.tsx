import { describe, it, expect } from 'vitest'
import {
  BASELINE_DATA,
} from '@/lib/masterMappingService'
import {
  isPadgetCompany,
  resolveCompanyName,
  resolveCompanyCode,
} from '@/assets/companyLogos'

describe('Company Code & Plant (WERKS) Master Mapping Specification', () => {
  it('Invariant 1: ISMARTU / IIPL has Company Code 5020 and exactly ONE plant (Noida Central Plant)', () => {
    const ismartu = BASELINE_DATA.companies.find((c) => c.code === '5020')
    expect(ismartu).toBeDefined()
    expect(ismartu?.name).toContain('IIPL')

    // Filter plants belonging to IIPL / ismartu
    const iiplPlants = BASELINE_DATA.plants.filter((p) => p.companyId === ismartu?.id)
    expect(iiplPlants).toHaveLength(1)
    expect(iiplPlants[0].name).toBe('Noida Central Plant')
    expect(iiplPlants[0].code).toBe('5020')
  })

  it('Invariant 2: PADGET has Company Code 9500 and all 5 plant codes (9502, 9503, 9504, 9505, 9506)', () => {
    const padget = BASELINE_DATA.companies.find((c) => c.code === '9500')
    expect(padget).toBeDefined()
    expect(padget?.name).toContain('Padget')

    const padgetPlants = BASELINE_DATA.plants.filter((p) => p.companyId === padget?.id)
    expect(padgetPlants).toHaveLength(5)

    const plantCodes = padgetPlants.map((p) => p.code).sort()
    expect(plantCodes).toEqual(['9502', '9503', '9504', '9505', '9506'])

    // Verify descriptions / locations from user table
    const p9502 = padgetPlants.find((p) => p.code === '9502')
    expect(p9502?.description).toBe('SECTOR 63')

    const p9503 = padgetPlants.find((p) => p.code === '9503')
    expect(p9503?.description).toBe('SECTOR 63')

    const p9504 = padgetPlants.find((p) => p.code === '9504')
    expect(p9504?.description).toBe('SECTOR 63 (OEM BUSINESS)')

    const p9505 = padgetPlants.find((p) => p.code === '9505')
    expect(p9505?.description).toBe('C39 OUR BUSINESS')

    const p9506 = padgetPlants.find((p) => p.code === '9506')
    expect(p9506?.description).toBe('C39 (OEM BUSINESS NT)')
  })

  it('Invariant 3: Company differentiator accurately maps 5020 to ismartu, and 9500 / 9502-9506 to Padget', () => {
    // 5020 -> ismartu
    expect(isPadgetCompany({ companyCode: '5020' })).toBe(false)
    expect(resolveCompanyName({ companyCode: '5020' })).toBe('ismartu')
    expect(resolveCompanyCode({ company: 'ismartu' })).toBe('5020')

    // 9500 -> Padget
    expect(isPadgetCompany({ companyCode: '9500' })).toBe(true)
    expect(resolveCompanyName({ companyCode: '9500' })).toBe('Padget')
    expect(resolveCompanyCode({ company: 'Padget' })).toBe('9500')

    // Plant Codes (WERKS) -> Padget
    expect(isPadgetCompany({ plant: '9502' })).toBe(true)
    expect(isPadgetCompany({ plant: '9503' })).toBe(true)
    expect(isPadgetCompany({ plant: '9504' })).toBe(true)
    expect(isPadgetCompany({ plant: '9505' })).toBe(true)
    expect(isPadgetCompany({ plant: '9506' })).toBe(true)
    expect(isPadgetCompany({ location: 'SECTOR 63 (OEM BUSINESS)' })).toBe(true)
  })
})
