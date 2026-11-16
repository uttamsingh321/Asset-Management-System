import type { Asset } from '@/types/asset'
import type { UserProfile } from './deviceTracker'
import { masterMappingService } from './masterMappingService'

/**
 * Known human-readable plant departments across IIPL and Padget facilities.
 */
export const STANDARD_DEPARTMENTS = [
  'IT & Infrastructure',
  'Production',
  'SMT Operations',
  'Quality Control',
  'Maintenance',
  'Store',
  'Finance & Accounts',
  'Operations',
  'Administration',
] as const

/**
 * Checks whether a given string is a raw numeric SAP / ERP cost center code
 * (e.g. '95030021', '502006009', 'C502006009') rather than a real department name.
 */
export function isRawNumericDepartmentCode(val?: string | null): boolean {
  if (!val) return false
  const s = val.trim()
  if (!s) return false
  // All digits of length 4 to 15 (e.g. 95030021, 502006009)
  if (/^\d{4,15}$/.test(s)) return true
  // C-prefixed alphanumeric SAP cost centers (e.g. C502006009)
  if (/^c\d{5,15}$/i.test(s)) return true
  return false
}

/**
 * Resolves the true human-readable Department Name from RBAC users,
 * Master Mapping directory, or custodian profiles whenever an asset has a
 * missing or raw numeric cost center code (e.g. '95030021').
 */
export function resolveDepartmentName(
  rawDept?: string | null,
  asset?: Partial<Asset> | null,
  fallbackUser?: UserProfile | null
): string {
  const cleanRaw = (rawDept || '').trim()

  // 1. If cleanRaw is already a valid human-readable department (not numeric code), use it!
  if (cleanRaw && !isRawNumericDepartmentCode(cleanRaw) && cleanRaw !== '-') {
    return cleanRaw
  }

  // 2. Look up the Custodian in RBAC users directory
  const rbacUsers = masterMappingService.getRBACUsers()

  const custodianId = (asset?.inChargeId || '').trim().toUpperCase()
  const custodianName = (asset?.inChargeName || asset?.custodian || asset?.whoInCharge || asset?.assignedTo || '').trim().toLowerCase()

  if (custodianId || custodianName) {
    const matched = rbacUsers.find((u) => {
      const uEmpId = (u.employeeId || '').trim().toUpperCase()
      const uName = (u.employeeName || '').trim().toLowerCase()
      if (custodianId && uEmpId && (uEmpId === custodianId || custodianId.includes(uEmpId))) return true
      if (custodianName && uName && (uName === custodianName || custodianName.includes(uName) || uName.includes(custodianName))) return true
      return false
    })

    if (matched?.department && !isRawNumericDepartmentCode(matched.department)) {
      return matched.department
    }

    // Direct check for well-known administrative personnel
    if (custodianId === 'USR-ADMIN' || custodianName.includes('uttam singh') || custodianName.includes('uttam')) {
      return 'IT & Infrastructure'
    }
    if (custodianId === '19105533' || custodianName.includes('manish')) {
      return 'Production'
    }
    if (custodianId === '19102709' || custodianName.includes('arbind')) {
      return 'Production'
    }
  }

  // 3. Look up Submitter / Current User department
  const submitterDept = (asset?.submitterDepartment || '').trim()
  if (submitterDept && !isRawNumericDepartmentCode(submitterDept) && submitterDept !== '-') {
    return submitterDept
  }

  const submitterId = (asset?.submitterId || '').trim().toUpperCase()
  const submitterName = (asset?.submitter || '').trim().toLowerCase()
  if (submitterId || submitterName) {
    const matchedSubmitter = rbacUsers.find((u) => {
      const uEmpId = (u.employeeId || '').trim().toUpperCase()
      const uName = (u.employeeName || '').trim().toLowerCase()
      if (submitterId && uEmpId && (uEmpId === submitterId || submitterId.includes(uEmpId))) return true
      if (submitterName && uName && (uName === submitterName || submitterName.includes(uName))) return true
      return false
    })
    if (matchedSubmitter?.department && !isRawNumericDepartmentCode(matchedSubmitter.department)) {
      return matchedSubmitter.department
    }
  }

  // 4. Look up Active / Logged-in User profile
  if (fallbackUser?.department && !isRawNumericDepartmentCode(fallbackUser.department)) {
    return fallbackUser.department
  }

  // 5. Contextual fallback based on building / machinery type
  const bldg = (asset?.building || '').toUpperCase()
  if (bldg.includes('D197') || bldg.includes('D198') || bldg.includes('D199')) {
    return 'SMT Operations'
  }
  if (bldg.includes('C39')) {
    return 'Production'
  }

  return 'Production'
}
