import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import type { UserProfile } from '@/lib/deviceTracker'
import {
  masterMappingService,
  type SystemRole,
  type SystemPermission,
  type ApprovalAssignmentItem,
  type RBACUser,
  BASELINE_ROLES,
  BASELINE_APPROVALS,
  BASELINE_DATA,
} from '@/lib/masterMappingService'

interface Props {
  currentUser: UserProfile
  lang?: 'en' | 'hi'
  onSwitchUser?: (user: UserProfile) => void
}

type TabKey = 'users' | 'matrix' | 'scope' | 'approvals' | 'dashboard'

const MODULE_LIST = [
  'Dashboard',
  'Assets',
  'Asset Requests',
  'Asset Transfer',
  'Stock Count',
  'Audit',
  'Maintenance',
  'Reports',
  'Notifications',
  'Approval Workflow',
  'Master Mapping',
  'RBAC',
  'Settings',
]

const ACTION_LIST = [
  'View',
  'Create',
  'Edit',
  'Delete',
  'Approve',
  'Reject',
  'Import',
  'Export',
  'Assign',
  'Archive',
  'Restore',
  'Print',
  'Download',
  'API Access',
]

const DEPARTMENTS = [
  { key: 'All', label: 'All Departments', icon: '🌐' },
  { key: 'IT', label: 'IT & Systems', icon: '💻' },
  { key: 'Production', label: 'Production & SMT', icon: '🏭' },
  { key: 'Maintenance', label: 'Maintenance & Calibration', icon: '🔧' },
  { key: 'Store', label: 'Warehouse & Store', icon: '📦' },
  { key: 'Finance', label: 'Finance & Accounts', icon: '💰' },
  { key: 'Quality', label: 'Quality & Audit', icon: '🔍' },
  { key: 'Operations', label: 'Operations & Facilities', icon: '⚡' },
  { key: 'Administration', label: 'Administration & HR', icon: '🏢' },
]

export default function RBACManagementView({ currentUser, lang = 'en', onSwitchUser }: Props) {
  // ── Access Control Guard: Super User ONLY ──
  const isSuperuser =
    currentUser.isSuperuser ||
    currentUser.role === 'Admin' ||
    currentUser.role === 'Administrator' ||
    currentUser.role === 'Super User' ||
    currentUser.userId?.toUpperCase() === 'USR-ADMIN'

  const [activeTab, setActiveTab] = useState<TabKey>('users')
  const [loading, setLoading] = useState(false)

  // ── Data States ──
  const [users, setUsers] = useState<RBACUser[]>(() => masterMappingService.getRBACUsers())
  const [roles, setRoles] = useState<SystemRole[]>(BASELINE_ROLES)
  const [permissions, setPermissions] = useState<SystemPermission[]>([])
  const [approvals, setApprovals] = useState<ApprovalAssignmentItem[]>(BASELINE_APPROVALS)

  // ── Hierarchy Master Lists for Cascading Dropdowns ──
  const [companies, setCompanies] = useState<any[]>(BASELINE_DATA.companies)
  const [plants, setPlants] = useState<any[]>(BASELINE_DATA.plants)
  const [buildings, setBuildings] = useState<any[]>(BASELINE_DATA.buildings)
  const [floors, setFloors] = useState<any[]>(BASELINE_DATA.floors)
  const [departments, setDepartments] = useState<any[]>(BASELINE_DATA.departments)
  const [areas, setAreas] = useState<any[]>(BASELINE_DATA.areas)

  // ── User Filters & Search ──
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedDept, setSelectedDept] = useState<string>('All')

  // ── Newly created credential card for handover ──
  const [createdCredentialHandover, setCreatedCredentialHandover] = useState<{
    userId: string
    name: string
    department: string
    role: string
    password: string
  } | null>(null)

  // ── User Modal State ──
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<RBACUser | null>(null)
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    email: '',
    phone: '',
    designation: '',
    status: 'Active' as 'Active' | 'Inactive' | 'Locked',
    roleId: 1,
    role: 'Super User',
    twoFactorEnabled: false,
    password: '',
    companyId: undefined as number | undefined,
    plantId: undefined as number | undefined,
    buildingId: undefined as number | undefined,
    floorId: undefined as number | undefined,
    departmentId: undefined as number | undefined,
    areaId: undefined as number | undefined,
  })

  // ── Reset Password Modal ──
  const [resetPwdModal, setResetPwdModal] = useState<{ isOpen: boolean; user: RBACUser | null; newPwd: string }>({
    isOpen: false,
    user: null,
    newPwd: '',
  })

  // ── Role & Permission Matrix State ──
  const [selectedRoleId, setSelectedRoleId] = useState<number>(1)
  const [selectedRolePerms, setSelectedRolePerms] = useState<Set<string>>(new Set())
  const [savingMatrix, setSavingMatrix] = useState(false)
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false)
  const [newRoleForm, setNewRoleForm] = useState({ name: '', code: '', description: '' })

  // ── Scope Simulator State ──
  const [selectedScopeUserId, setSelectedScopeUserId] = useState<string>('USR-ADMIN')

  // ── Approver Modal ──
  const [isApproverModalOpen, setIsApproverModalOpen] = useState(false)
  const [approverForm, setApproverForm] = useState({
    workflowType: 'Asset Purchase',
    departmentName: 'Finance & Accounts',
    approverUserId: '',
    approverName: '',
    approvalLevel: 1,
    thresholdAmount: 100000,
    description: '',
  })

  // ── Initial Data Load ──
  const loadAllData = async () => {
    setLoading(true)
    try {
      const [rList, pList, cList, pAll, bList, fList, dList, aList, appList] = await Promise.all([
        masterMappingService.getRoles(currentUser),
        masterMappingService.getPermissions(currentUser),
        masterMappingService.getCompanies(currentUser),
        masterMappingService.getPlants(undefined, currentUser),
        masterMappingService.getBuildings(undefined, currentUser),
        masterMappingService.getFloors(undefined, currentUser),
        masterMappingService.getDepartments(undefined, currentUser),
        masterMappingService.getAreas(undefined, currentUser),
        masterMappingService.getApprovalAssignments(currentUser),
      ])

      if (rList?.length) setRoles(rList)
      if (pList?.length) setPermissions(pList)
      if (cList?.length) setCompanies(cList)
      if (pAll?.length) setPlants(pAll)
      if (bList?.length) setBuildings(bList)
      if (fList?.length) setFloors(fList)
      if (dList?.length) setDepartments(dList)
      if (aList?.length) setAreas(aList)
      if (appList?.length) setApprovals(appList)

      const storedUsers = await masterMappingService.syncBackendUsersToLocal()
      if (storedUsers?.length) setUsers(storedUsers)

      // Initialize selected role permissions
      const activeRole = rList.find((r) => r.id === selectedRoleId) || rList[0]
      if (activeRole) {
        const pIds = await masterMappingService.getRolePermissions(activeRole.id, currentUser)
        const activeCodes = new Set<string>()
        pList.forEach((p) => {
          if (pIds.includes(p.id)) activeCodes.add(p.code)
        })
        setSelectedRolePerms(activeCodes)
      }
    } catch {
      // Fallback cache remains active
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSuperuser) {
      loadAllData()
    }
  }, [isSuperuser])

  // Change active role in permission matrix
  const handleSelectRole = async (roleId: number) => {
    setSelectedRoleId(roleId)
    const pIds = await masterMappingService.getRolePermissions(roleId, currentUser)
    const activeCodes = new Set<string>()
    permissions.forEach((p) => {
      if (pIds.includes(p.id)) activeCodes.add(p.code)
    })
    setSelectedRolePerms(activeCodes)
  }

  // Toggle single permission code
  const togglePermission = (code: string) => {
    const updated = new Set(selectedRolePerms)
    if (updated.has(code)) {
      updated.delete(code)
    } else {
      updated.add(code)
    }
    setSelectedRolePerms(updated)
  }

  // Toggle all permissions for a specific module
  const toggleAllForModule = (module: string) => {
    const modulePerms = permissions.filter((p) => p.module === module)
    const allSelected = modulePerms.every((p) => selectedRolePerms.has(p.code))
    const updated = new Set(selectedRolePerms)
    modulePerms.forEach((p) => {
      if (allSelected) {
        updated.delete(p.code)
      } else {
        updated.add(p.code)
      }
    })
    setSelectedRolePerms(updated)
  }

  // Toggle all for an action column
  const toggleAllForAction = (action: string) => {
    const actionPerms = permissions.filter((p) => p.name.startsWith(action + ' '))
    const allSelected = actionPerms.every((p) => selectedRolePerms.has(p.code))
    const updated = new Set(selectedRolePerms)
    actionPerms.forEach((p) => {
      if (allSelected) {
        updated.delete(p.code)
      } else {
        updated.add(p.code)
      }
    })
    setSelectedRolePerms(updated)
  }

  // Save Role Matrix
  const handleSaveMatrix = async () => {
    setSavingMatrix(true)
    try {
      const pIds = permissions.filter((p) => selectedRolePerms.has(p.code)).map((p) => p.id)
      await masterMappingService.saveRolePermissions(selectedRoleId, pIds, currentUser)
      toast.success('Permission Matrix successfully published & committed to security engine!')
    } catch {
      toast.error('Failed to save permission matrix')
    } finally {
      setSavingMatrix(false)
    }
  }

  // Create Custom Role
  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleForm.name.trim() || !newRoleForm.code.trim()) {
      toast.error('Role name and code are required')
      return
    }
    try {
      const created = await masterMappingService.createRole(newRoleForm, currentUser)
      setRoles((prev) => [...prev, created])
      toast.success(`Role "${created.name}" created successfully`)
      setIsAddRoleModalOpen(false)
      setNewRoleForm({ name: '', code: '', description: '' })
      handleSelectRole(created.id)
    } catch {
      toast.error('Failed to create role')
    }
  }

  // ── Cascading Dropdown Handlers for User Modal ──
  const filteredPlants = useMemo(() => {
    if (!formData.companyId) return []
    return plants.filter((p) => p.companyId === formData.companyId && !p.isArchived)
  }, [plants, formData.companyId])

  const filteredBuildings = useMemo(() => {
    if (!formData.plantId) return []
    return buildings.filter((b) => b.plantId === formData.plantId && !b.isArchived)
  }, [buildings, formData.plantId])

  const filteredFloors = useMemo(() => {
    if (!formData.buildingId) return []
    return floors.filter((f) => f.buildingId === formData.buildingId && !f.isArchived)
  }, [floors, formData.buildingId])

  const filteredDepartments = useMemo(() => {
    if (!formData.floorId) return []
    return departments.filter((d) => d.floorId === formData.floorId && !d.isArchived)
  }, [departments, formData.floorId])

  const filteredAreas = useMemo(() => {
    if (!formData.departmentId) return []
    return areas.filter((a) => a.departmentId === formData.departmentId && !a.isArchived)
  }, [areas, formData.departmentId])

  // Open Create User Modal
  const openCreateUserModal = () => {
    setEditingUser(null)
    setFormData({
      employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      employeeName: '',
      email: '',
      phone: '',
      designation: '',
      status: 'Active',
      roleId: roles[0]?.id || 1,
      role: roles[0]?.name || 'Super User',
      twoFactorEnabled: false,
      password: 'User@' + Math.floor(1000 + Math.random() * 9000),
      companyId: companies[0]?.id,
      plantId: undefined,
      buildingId: undefined,
      floorId: undefined,
      departmentId: undefined,
      areaId: undefined,
    })
    setIsUserModalOpen(true)
  }

  // Open Edit User Modal
  const openEditUserModal = (u: RBACUser) => {
    setEditingUser(u)
    setFormData({
      employeeId: u.employeeId,
      employeeName: u.employeeName,
      email: u.email,
      phone: u.phone || '',
      designation: u.designation,
      status: u.status,
      roleId: u.roleId || 1,
      role: u.role,
      twoFactorEnabled: Boolean(u.twoFactorEnabled),
      password: '',
      companyId: u.companyId,
      plantId: u.plantId,
      buildingId: u.buildingId,
      floorId: u.floorId,
      departmentId: u.departmentId,
      areaId: u.areaId,
    })
    setIsUserModalOpen(true)
  }

  // Save User (Create or Edit)
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employeeId.trim() || !formData.employeeName.trim()) {
      toast.error('Employee ID and Employee Name are required')
      return
    }

    const companyObj = companies.find((c) => c.id === formData.companyId)
    const plantObj = plants.find((p) => p.id === formData.plantId)
    const bldgObj = buildings.find((b) => b.id === formData.buildingId)
    const flrObj = floors.find((f) => f.id === formData.floorId)
    const deptObj = departments.find((d) => d.id === formData.departmentId)
    const areaObj = areas.find((a) => a.id === formData.areaId)
    const roleObj = roles.find((r) => r.id === formData.roleId)

    if (editingUser) {
      // Edit
      const updated: RBACUser = {
        ...editingUser,
        employeeName: formData.employeeName,
        email: formData.email,
        phone: formData.phone,
        designation: formData.designation,
        status: formData.status,
        role: roleObj ? roleObj.name : formData.role,
        roleId: formData.roleId,
        twoFactorEnabled: formData.twoFactorEnabled,
        companyId: formData.companyId,
        companyName: companyObj?.name,
        plantId: formData.plantId,
        plantName: plantObj?.name,
        buildingId: formData.buildingId,
        buildingName: bldgObj?.name,
        floorId: formData.floorId,
        floorName: flrObj?.name,
        departmentId: formData.departmentId,
        departmentName: deptObj?.name,
        areaId: formData.areaId,
        areaName: areaObj?.name,
        department: deptObj ? deptObj.name : editingUser.department,
      }
      const newUsers = users.map((u) => (u.id === editingUser.id ? updated : u))
      setUsers(newUsers)
      masterMappingService.saveRBACUsers(newUsers)
      toast.success(`User ${updated.employeeName} updated successfully`)
    } else {
      // Create
      const newUser: RBACUser = {
        id: String(Date.now()),
        employeeId: formData.employeeId,
        employeeName: formData.employeeName,
        email: formData.email,
        phone: formData.phone,
        designation: formData.designation,
        status: formData.status,
        role: roleObj ? roleObj.name : formData.role,
        roleId: formData.roleId,
        twoFactorEnabled: formData.twoFactorEnabled,
        companyId: formData.companyId,
        companyName: companyObj?.name,
        plantId: formData.plantId,
        plantName: plantObj?.name,
        buildingId: formData.buildingId,
        buildingName: bldgObj?.name,
        floorId: formData.floorId,
        floorName: flrObj?.name,
        departmentId: formData.departmentId,
        departmentName: deptObj?.name,
        areaId: formData.areaId,
        areaName: areaObj?.name,
        department: deptObj ? deptObj.name : 'Unassigned',
        password: formData.password || 'Temporary@123',
        createdAt: new Date().toISOString(),
        failedLoginAttempts: 0,
      }
      const newUsers = [newUser, ...users]
      setUsers(newUsers)
      masterMappingService.saveRBACUsers(newUsers)
      setCreatedCredentialHandover({
        userId: newUser.employeeId,
        name: newUser.employeeName,
        department: newUser.department,
        role: newUser.role,
        password: newUser.password || 'Temporary@123',
      })
      toast.success(`User ${newUser.employeeName} created with Master Mapping scope`)
    }
    setIsUserModalOpen(false)
  }

  // Toggle User Status (Activate/Deactivate)
  const toggleUserStatus = (u: RBACUser) => {
    const nextStatus: 'Active' | 'Inactive' | 'Locked' = u.status === 'Active' ? 'Inactive' : 'Active'
    const updated: RBACUser = { ...u, status: nextStatus }
    const newUsers = users.map((item) => (item.id === u.id ? updated : item))
    setUsers(newUsers)
    masterMappingService.saveRBACUsers(newUsers)
    toast.success(`User ${u.employeeName} status set to ${nextStatus}`)
  }

  // Toggle User Lockout
  const toggleUserLock = (u: RBACUser) => {
    const nextStatus: 'Active' | 'Inactive' | 'Locked' = u.status === 'Locked' ? 'Active' : 'Locked'
    const updated: RBACUser = { ...u, status: nextStatus, failedLoginAttempts: nextStatus === 'Active' ? 0 : 5 }
    const newUsers = users.map((item) => (item.id === u.id ? updated : item))
    setUsers(newUsers)
    masterMappingService.saveRBACUsers(newUsers)
    toast.info(`User ${u.employeeName} ${nextStatus === 'Locked' ? 'Locked Out' : 'Unlocked'}`)
  }

  // Delete User
  const handleDeleteUser = (u: RBACUser) => {
    if (u.employeeId === 'USR-ADMIN' || u.role === 'Super User') {
      toast.error('System Protection Invariant: Primary Super User cannot be deleted.')
      return
    }
    if (!window.confirm(`Are you sure you want to permanently delete user ${u.employeeName} (${u.employeeId})?`)) {
      return
    }
    const newUsers = users.filter((x) => x.id !== u.id)
    setUsers(newUsers)
    masterMappingService.saveRBACUsers(newUsers)
    fetch(`/api/users/${encodeURIComponent(u.employeeId)}/`, { method: 'DELETE' }).catch(() => {})
    toast.success(`User ${u.employeeName} deleted`)
  }

  // Execute Password Reset
  const handleExecutePasswordReset = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPwdModal.user || !resetPwdModal.newPwd.trim()) return
    const updated: RBACUser = { ...resetPwdModal.user, password: resetPwdModal.newPwd.trim(), failedLoginAttempts: 0 }
    const newUsers = users.map((x) => (x.id === resetPwdModal.user!.id ? updated : x))
    setUsers(newUsers)
    masterMappingService.saveRBACUsers(newUsers)
    fetch(`/api/users/${encodeURIComponent(resetPwdModal.user.employeeId)}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPwdModal.newPwd.trim() }),
    }).catch(() => {})
    toast.success(`Password for ${resetPwdModal.user.employeeName} reset successfully`)
    setResetPwdModal({ isOpen: false, user: null, newPwd: '' })
  }

  // Copy credentials helper for handover
  const copyCredentials = (handover: { userId: string; name: string; department: string; role: string; password: string }) => {
    const text = `Meridian Enterprise RBAC Credentials\nUser ID: ${handover.userId}\nName: ${handover.name}\nDepartment: ${handover.department}\nRole: ${handover.role}\nPassword: ${handover.password}\nPortal URL: ${window.location.origin}/`
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success('Credentials copied to clipboard'))
        .catch(() => toast.info('Clipboard access unavailable'))
    } else {
      toast.info('Credentials ready')
    }
  }

  // Department counts for Quick Filter Pills
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = { All: users.length }
    DEPARTMENTS.slice(1).forEach((d) => {
      counts[d.key] = users.filter((u) => {
        const dept = (u.department || u.departmentName || '').toLowerCase()
        if (d.key === 'Production') return dept.includes('production') || dept.includes('smt')
        if (d.key === 'IT') return dept.includes('it') || dept.includes('system')
        if (d.key === 'Maintenance') return dept.includes('maintenance') || dept.includes('calibration')
        if (d.key === 'Store') return dept.includes('store') || dept.includes('warehouse')
        if (d.key === 'Finance') return dept.includes('finance') || dept.includes('account')
        if (d.key === 'Quality') return dept.includes('quality') || dept.includes('audit')
        if (d.key === 'Operations') return dept.includes('operation') || dept.includes('facility')
        if (d.key === 'Administration') return dept.includes('admin') || dept.includes('hr')
        return dept.includes(d.key.toLowerCase())
      }).length
    })
    return counts
  }, [users])

  // Filtered Users List with Department and Role Scoping
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.employeeName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.employeeId.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.department || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.departmentName || '').toLowerCase().includes(userSearch.toLowerCase())

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter

      let matchDept = true
      if (selectedDept !== 'All') {
        const dept = (u.department || u.departmentName || '').toLowerCase()
        if (selectedDept === 'Production') matchDept = dept.includes('production') || dept.includes('smt')
        else if (selectedDept === 'IT') matchDept = dept.includes('it') || dept.includes('system')
        else if (selectedDept === 'Maintenance') matchDept = dept.includes('maintenance') || dept.includes('calibration')
        else if (selectedDept === 'Store') matchDept = dept.includes('store') || dept.includes('warehouse')
        else if (selectedDept === 'Finance') matchDept = dept.includes('finance') || dept.includes('account')
        else if (selectedDept === 'Quality') matchDept = dept.includes('quality') || dept.includes('audit')
        else if (selectedDept === 'Operations') matchDept = dept.includes('operation') || dept.includes('facility')
        else if (selectedDept === 'Administration') matchDept = dept.includes('admin') || dept.includes('hr')
        else matchDept = dept.includes(selectedDept.toLowerCase())
      }

      return matchSearch && matchRole && matchStatus && matchDept
    })
  }, [users, userSearch, roleFilter, statusFilter, selectedDept])

  // Selected Scope User for Scope Tab
  const scopeUser = useMemo(() => {
    return users.find((u) => u.employeeId === selectedScopeUserId) || users[0]
  }, [users, selectedScopeUserId])

  // ── Access Denied View if not Super User ──
  if (!isSuperuser) {
    return (
      <div className="card p-12 max-w-xl mx-auto my-12 text-center space-y-4 border-2 border-red-500/30 bg-red-500/5">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-3xl">
          🛑
        </div>
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400">403 Access Denied: Super User Only</h2>
        <p className="text-xs text-[var(--mute)] max-w-md mx-auto leading-relaxed">
          User & RBAC Administration is strictly restricted to Super Users. No other role is permitted to inspect,
          modify, or manage security roles, permissions, or hierarchy assignments.
        </p>
        <div className="p-4 bg-[var(--surf)] border border-[var(--line)] rounded-xl text-xs text-left max-w-md mx-auto space-y-1">
          <div>
            <strong>Current Session:</strong> {currentUser.userName} ({currentUser.userId})
          </div>
          <div>
            <strong>Assigned Role:</strong> {currentUser.role}
          </div>
          <div>
            <strong>Department:</strong> {currentUser.department || 'N/A'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── TOP EXECUTIVE BANNER ── */}
      <div className="p-5 md:p-6 bg-[var(--surf)] border border-[var(--line)] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-2xl font-bold shadow-xs">
              🛡️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-[var(--ink)]">
                  User & RBAC Administration
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                  👑 Super User Exclusive ({lang === 'hi' ? 'सुपर यूज़र' : 'Global Scope'})
                </span>
              </div>
              <p className="text-xs text-[var(--mute)] mt-0.5">
                Single Source of Truth for system authentication, role authorization, hierarchy boundary scoping, and approval engines.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {loading && (
              <span className="text-xs text-[var(--acc)] font-medium animate-pulse flex items-center gap-1.5 mr-2">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                </svg>
                Syncing RBAC...
              </span>
            )}
            <button
              type="button"
              onClick={openCreateUserModal}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[var(--acc)] text-white hover:opacity-90 shadow-xs flex items-center gap-1.5 transition"
            >
              <span>➕</span> Add New User
            </button>
            <button
              type="button"
              onClick={() => setIsAddRoleModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)] flex items-center gap-1.5 transition"
            >
              <span>⚙️</span> Custom Role
            </button>
          </div>
        </div>

        {/* Live Quick KPI Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-3 border-t border-[var(--line)]">
          <div className="p-2.5 rounded-xl bg-[var(--surf2)] flex items-center justify-between">
            <span className="text-xs text-[var(--mute)]">Total Users</span>
            <span className="font-bold text-sm text-[var(--ink)]">{users.length}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surf2)] flex items-center justify-between">
            <span className="text-xs text-[var(--mute)]">Active Accounts</span>
            <span className="font-bold text-sm text-emerald-600">{users.filter((u) => u.status === 'Active').length}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surf2)] flex items-center justify-between">
            <span className="text-xs text-[var(--mute)]">Roles Configured</span>
            <span className="font-bold text-sm text-purple-600">{roles.length} Roles</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surf2)] flex items-center justify-between">
            <span className="text-xs text-[var(--mute)]">Permissions</span>
            <span className="font-bold text-sm text-blue-600">182 Matrix Verbs</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surf2)] flex items-center justify-between">
            <span className="text-xs text-[var(--mute)]">2FA Adoption</span>
            <span className="font-bold text-sm text-teal-600">
              {users.length ? Math.round((users.filter((u) => u.twoFactorEnabled).length / users.length) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* ── 5 NAVIGATION TABS ── */}
      <div className="flex items-center gap-1.5 border-b border-[var(--line)] pb-2 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`py-2 px-3.5 rounded-lg font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[var(--acc)] text-white shadow-xs'
              : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]'
          }`}
        >
          <span>👥</span> User Management ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`py-2 px-3.5 rounded-lg font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'bg-[var(--acc)] text-white shadow-xs'
              : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]'
          }`}
        >
          <span>🔐</span> Role & Permission Matrix ({roles.length} Roles × {permissions.length || 182} Perms)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scope')}
          className={`py-2 px-3.5 rounded-lg font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'scope'
              ? 'bg-[var(--acc)] text-white shadow-xs'
              : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]'
          }`}
        >
          <span>🎯</span> Hierarchy Scope Engine
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className={`py-2 px-3.5 rounded-lg font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'approvals'
              ? 'bg-[var(--acc)] text-white shadow-xs'
              : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]'
          }`}
        >
          <span>✍️</span> Approval Workflows ({approvals.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`py-2 px-3.5 rounded-lg font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-[var(--acc)] text-white shadow-xs'
              : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]'
          }`}
        >
          <span>📊</span> RBAC Dashboard & Audit
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: USER MANAGEMENT
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Credential Handover Card (displayed when a new user is created) */}
          {createdCredentialHandover && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 shadow-sm space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎉</span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      User Credentials Generated for Handover
                    </h4>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                      Share these credentials securely with the department staff member. The password was explicitly set during provisioning.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatedCredentialHandover(null)}
                  className="text-xs text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer px-2 py-1"
                >
                  ✕ Dismiss
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-white/60 dark:bg-black/20 p-3 rounded-xl border border-emerald-500/20 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--mute)] block uppercase font-bold">User ID</span>
                  <span className="font-bold text-[var(--ink)] font-mono">{createdCredentialHandover.userId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--mute)] block uppercase font-bold">Employee Name</span>
                  <span className="font-semibold text-[var(--ink)]">{createdCredentialHandover.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--mute)] block uppercase font-bold">Department</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{createdCredentialHandover.department}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--mute)] block uppercase font-bold">RBAC Role</span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">{createdCredentialHandover.role}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--mute)] block uppercase font-bold">Assigned Password</span>
                  <span className="font-bold text-emerald-600 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 font-mono inline-block">
                    {createdCredentialHandover.password}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => copyCredentials(createdCredentialHandover)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📋</span> Copy All Credentials
                </button>
              </div>
            </div>
          )}

          {/* Department Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {DEPARTMENTS.map((dept) => {
              const count = deptCounts[dept.key] ?? 0
              const isActive = selectedDept === dept.key
              return (
                <button
                  key={dept.key}
                  type="button"
                  onClick={() => setSelectedDept(dept.key)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[var(--acc)] text-white shadow-xs font-bold'
                      : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]'
                  }`}
                >
                  <span>{dept.icon}</span>
                  <span>{dept.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[var(--surf2)] text-[var(--ink)]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Filters Bar */}
          <div className="p-4 bg-[var(--surf)] border border-[var(--line)] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  type="text"
                  placeholder="Search user by name, ID, email, department..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full text-xs px-3 py-2 pl-8 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                />
                <span className="absolute left-2.5 top-2.5 text-xs text-[var(--mute)]">🔍</span>
              </div>

              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none font-medium"
              >
                <option value="ALL">All Roles ({roles.length})</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active Accounts</option>
                <option value="Inactive">Inactive Accounts</option>
                <option value="Locked">Locked Out</option>
              </select>
            </div>

            <div className="text-xs text-[var(--mute)]">
              Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surf2)] text-[var(--mute)] font-semibold">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Assigned Role</th>
                    <th className="p-3">Master Mapping Hierarchy Scope</th>
                    <th className="p-3">Security & 2FA</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] text-[var(--ink)]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--surf2)]/50 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--acc)]/20 to-purple-500/20 text-[var(--acc)] font-bold flex items-center justify-center shrink-0 border border-[var(--acc)]/30">
                            {u.employeeName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-sm flex items-center gap-1.5">
                              {u.employeeName}
                              {u.employeeId === 'USR-ADMIN' && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-700 font-bold border border-purple-500/30">
                                  ROOT
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--mute)] font-mono">
                              ID: {u.employeeId} · {u.email}
                            </div>
                            {u.designation && (
                              <div className="text-[11px] text-[var(--mute)] italic">{u.designation}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                          🛡️ {u.role}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="space-y-1 max-w-xs">
                          <div className="font-semibold text-xs text-[var(--ink)]">
                            {u.companyName || 'Corporate Master'}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[10px]">
                            {u.plantName && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
                                🏭 {u.plantName}
                              </span>
                            )}
                            {u.buildingName && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 border border-blue-500/20">
                                🏛️ {u.buildingName}
                              </span>
                            )}
                            {u.departmentName && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                                👥 {u.departmentName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                u.twoFactorEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <span className="text-[11px] font-medium">
                              {u.twoFactorEnabled ? '2FA Enforced' : '2FA Disabled'}
                            </span>
                          </div>
                          {u.failedLoginAttempts && u.failedLoginAttempts > 0 ? (
                            <div className="text-[10px] text-red-500 font-semibold">
                              ⚠️ {u.failedLoginAttempts} failed attempts
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            u.status === 'Active'
                              ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                              : u.status === 'Locked'
                              ? 'bg-rose-500/15 text-rose-700 border border-rose-500/30'
                              : 'bg-gray-500/15 text-gray-700 border border-gray-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'Active' ? 'bg-emerald-500' : u.status === 'Locked' ? 'bg-rose-500' : 'bg-gray-400'
                            }`}
                          />
                          {u.status === 'Active' ? 'Active' : u.status === 'Locked' ? 'Locked' : 'Inactive'}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onSwitchUser && (
                            <button
                              type="button"
                              onClick={() => {
                                onSwitchUser({
                                  userId: u.employeeId,
                                  userName: u.employeeName,
                                  role: u.role,
                                  department: u.department,
                                  isSuperuser: u.role === 'Super User' || u.employeeId === 'USR-ADMIN',
                                })
                                toast.success(`Switched active session to ${u.employeeName} (${u.role})`)
                              }}
                              className="px-2 py-1 text-[11px] font-semibold rounded-md bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] border border-[var(--line)] transition"
                              title="Simulate / Switch Login"
                            >
                              👤 Switch
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditUserModal(u)}
                            className="px-2 py-1 text-[11px] font-semibold rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition"
                            title="Edit User & Hierarchy"
                          >
                            ✏️ Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setResetPwdModal({
                                isOpen: true,
                                user: u,
                                newPwd: 'NewPass@' + Math.floor(1000 + Math.random() * 9000),
                              })
                            }
                            className="px-2 py-1 text-[11px] font-semibold rounded-md bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition"
                            title="Reset Password"
                          >
                            🔑 Pwd
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleUserLock(u)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                              u.status === 'Locked'
                                ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                            }`}
                            title={u.status === 'Locked' ? 'Unlock Account' : 'Lock Account'}
                          >
                            {u.status === 'Locked' ? '🔓 Unlock' : '🔒 Lock'}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleUserStatus(u)}
                            className="px-2 py-1 text-[11px] font-semibold rounded-md bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 transition"
                            title={u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          >
                            {u.status === 'Active' ? '⏸ Deact' : '▶ Act'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="px-2 py-1 text-[11px] font-semibold rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition"
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: ROLE & PERMISSION MATRIX (13 Modules × 14 Actions)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'matrix' && (
        <div className="space-y-5">
          {/* Role Selector Header */}
          <div className="p-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)]">Select Role to Inspect / Grant Permissions:</h3>
                <p className="text-xs text-[var(--mute)]">
                  Configuring capabilities for <strong>{roles.find((r) => r.id === selectedRoleId)?.name}</strong> ·{' '}
                  <span className="font-mono">{roles.find((r) => r.id === selectedRoleId)?.code}</span>
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allCodes = new Set(permissions.map((p) => p.code))
                    setSelectedRolePerms(allCodes)
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)] transition"
                >
                  Grant All (182)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRolePerms(new Set())}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)] transition"
                >
                  Revoke All
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatrix}
                  disabled={savingMatrix}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <span>💾</span> {savingMatrix ? 'Publishing...' : 'Save Matrix'}
                </button>
              </div>
            </div>

            {/* Role Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--line)]">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRole(r.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition border shadow-xs flex items-center gap-1.5 ${
                    selectedRoleId === r.id
                      ? 'bg-[var(--acc)] text-white border-[var(--acc)]'
                      : 'bg-[var(--surf)] text-[var(--ink)] border-[var(--line)] hover:bg-[var(--surf2)]'
                  }`}
                >
                  <span>{r.isSystem ? '🔒' : '⚙️'}</span>
                  <span>{r.name}</span>
                </button>
              ))}
            </div>

            {/* Percentage Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-[var(--mute)]">
                <span>Active Coverage</span>
                <span className="font-bold text-[var(--ink)]">
                  {selectedRolePerms.size} of {permissions.length || 182} Actions Enabled (
                  {Math.round((selectedRolePerms.size / (permissions.length || 182)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-[var(--line)] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((selectedRolePerms.size / (permissions.length || 182)) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Granular Permission Grid with Elevated Table Styling */}
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surf2)] text-[var(--mute)]">
                    <th className="p-3 font-bold sticky left-0 bg-[var(--surf2)] z-20 min-w-[170px] border-r border-[var(--line)] shadow-xs">
                      Module (13 Total)
                    </th>
                    {ACTION_LIST.map((action) => (
                      <th key={action} className="p-2.5 font-bold text-center min-w-[75px]">
                        <button
                          type="button"
                          onClick={() => toggleAllForAction(action)}
                          className="hover:underline text-[11px] font-bold text-[var(--ink)] cursor-pointer"
                          title={`Toggle ${action} across all 13 modules`}
                        >
                          {action}
                        </button>
                      </th>
                    ))}
                    <th className="p-2.5 text-center font-bold text-[var(--mute)]">Row Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] text-[var(--ink)]">
                  {MODULE_LIST.map((mod) => {
                    const rowPerms = permissions.filter((p) => p.module === mod)
                    const rowGranted = rowPerms.filter((p) => selectedRolePerms.has(p.code)).length

                    return (
                      <tr key={mod} className="hover:bg-[var(--surf2)]/60 transition group">
                        <td className="p-3 font-semibold sticky left-0 bg-[var(--surf)] group-hover:bg-[var(--surf2)] z-10 border-r border-[var(--line)]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">{mod}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold font-mono ${
                              rowGranted === 14
                                ? 'bg-emerald-500/15 text-emerald-700'
                                : rowGranted > 0
                                ? 'bg-blue-500/15 text-blue-700'
                                : 'bg-[var(--line)] text-[var(--mute)]'
                            }`}>
                              {rowGranted}/14
                            </span>
                          </div>
                        </td>

                        {ACTION_LIST.map((act) => {
                          const permCode = `${mod.toUpperCase().replace(/\s+/g, '_')}_${act
                            .toUpperCase()
                            .replace(/\s+/g, '_')}`
                          const isGranted = selectedRolePerms.has(permCode)

                          return (
                            <td key={act} className="p-2 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded-md hover:bg-[var(--line)]/50 transition">
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  onChange={() => togglePermission(permCode)}
                                  className="w-4 h-4 rounded border-[var(--line)] text-[var(--acc)] focus:ring-[var(--acc)] cursor-pointer transition"
                                />
                              </label>
                            </td>
                          )
                        })}

                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAllForModule(mod)}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] border border-[var(--line)]"
                          >
                            Row All
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: HIERARCHY SCOPE ACCESS ENGINE
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'scope' && (
        <div className="space-y-6">
          {/* Scope Header */}
          <div className="p-4 bg-[var(--surf)] border border-[var(--line)] rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <span>🎯</span> Scope Boundary Simulation & Verification
              </h2>
              <p className="text-xs text-[var(--mute)]">
                Every permission check strictly enforces both <strong>Role Capabilities</strong> and{' '}
                <strong>Hierarchy Boundary</strong>. A user with Edit permissions on Plant Delhi cannot touch
                Plant Noida.
              </p>
            </div>

            {/* User Selector for Simulation */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--ink)]">Simulate User:</span>
              <select
                value={selectedScopeUserId}
                onChange={(e) => setSelectedScopeUserId(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none font-semibold"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.employeeId}>
                    {u.employeeName} ({u.employeeId}) - {u.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scope Inspection Card */}
          {scopeUser && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: User Profile & Role Info */}
              <div className="p-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl space-y-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--acc)]/10 text-[var(--acc)] font-bold text-lg flex items-center justify-center border border-[var(--acc)]/30">
                    {scopeUser.employeeName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--ink)]">{scopeUser.employeeName}</h3>
                    <div className="text-xs text-[var(--mute)] font-mono">{scopeUser.employeeId}</div>
                    <div className="text-xs text-[var(--mute)]">{scopeUser.email}</div>
                  </div>
                </div>

                <div className="p-3 bg-[var(--surf2)] rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--mute)]">Assigned Role:</span>
                    <span className="font-bold text-[var(--ink)]">{scopeUser.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--mute)]">Department:</span>
                    <span className="font-bold text-[var(--ink)]">{scopeUser.department || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--mute)]">Designation:</span>
                    <span className="font-medium text-[var(--ink)]">{scopeUser.designation || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--mute)]">2FA Enforcement:</span>
                    <span className={scopeUser.twoFactorEnabled ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                      {scopeUser.twoFactorEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--line)]">
                  <div className="text-[11px] font-bold text-[var(--ink)] mb-2">Scope Enforcement Rule:</div>
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-700 text-[11px] leading-relaxed border border-blue-500/20">
                    {scopeUser.role === 'Super User' ? (
                      <span>
                        👑 <strong>Super User Global Scope:</strong> User has unrestricted master authority across all
                        Companies, Plants, Buildings, Floors, Departments, Areas, and Locations.
                      </span>
                    ) : (
                      <span>
                        🔒 <strong>Branch Bound Scope:</strong> Operations and queries are confined to{' '}
                        <strong>{scopeUser.companyName || 'Corporate Master'}</strong>
                        {scopeUser.plantName && ` ➔ ${scopeUser.plantName}`}
                        {scopeUser.buildingName && ` ➔ ${scopeUser.buildingName}`}
                        {scopeUser.departmentName && ` ➔ ${scopeUser.departmentName}`}
                        . Cross-plant access is denied.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Cascading Hierarchy Breadcrumb & Accessible Tree */}
              <div className="md:col-span-2 p-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <h3 className="text-sm font-bold text-[var(--ink)]">Assigned Hierarchy Branch</h3>
                  <span className="text-[11px] text-[var(--mute)]">Populated Exclusively from Master Mapping</span>
                </div>

                {/* Visual Branch Nodes */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🏢</span>
                      <strong className="text-xs text-purple-700 font-bold">Company Level:</strong>
                    </div>
                    <span className="text-xs font-bold text-[var(--ink)]">
                      {scopeUser.companyName || 'Corporate Root (All Companies)'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🏭</span>
                      <strong className="text-xs text-indigo-700 font-bold">Plant Level:</strong>
                    </div>
                    <span className="text-xs font-bold text-[var(--ink)]">
                      {scopeUser.plantName || (scopeUser.role === 'Super User' ? 'Global Plant Access' : 'Unrestricted in Company')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🏛️</span>
                      <strong className="text-xs text-blue-700 font-bold">Building Level:</strong>
                    </div>
                    <span className="text-xs font-bold text-[var(--ink)]">
                      {scopeUser.buildingName || 'All Buildings in Plant'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">📍</span>
                      <strong className="text-xs text-teal-700 font-bold">Floor Level:</strong>
                    </div>
                    <span className="text-xs font-bold text-[var(--ink)]">
                      {scopeUser.floorName || 'All Floors'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">👥</span>
                      <strong className="text-xs text-emerald-700 font-bold">Department Level:</strong>
                    </div>
                    <span className="text-xs font-bold text-[var(--ink)]">
                      {scopeUser.departmentName || scopeUser.department || 'All Departments'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">📐</span>
                      <strong className="text-xs text-amber-700 font-bold">Area / Zone Level:</strong>
                    </div>
                    <span className="text-xs font-bold text-[var(--ink)]">
                      {scopeUser.areaName || 'All Placement Areas'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 4: APPROVAL WORKFLOW ASSIGNMENTS
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {/* Header Action */}
          <div className="p-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[var(--ink)]">Multi-Tier Approval Authority Matrix</h2>
              <p className="text-xs text-[var(--mute)]">
                Designate certified authority holders for Asset Purchase, Inter-Plant Transfers, Scrapping, and Requisitions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setApproverForm({
                  workflowType: 'Asset Purchase',
                  departmentName: 'Finance & Accounts',
                  approverUserId: users[0]?.employeeId || 'USR-ADMIN',
                  approverName: users[0]?.employeeName || 'Super User',
                  approvalLevel: 1,
                  thresholdAmount: 250000,
                  description: '',
                })
                setIsApproverModalOpen(true)
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--acc)] text-white hover:opacity-90 transition flex items-center gap-1.5 shadow-xs"
            >
              <span>➕</span> Add Approver Tier
            </button>
          </div>

          {/* Approvals Table */}
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surf2)] text-[var(--mute)] font-semibold">
                    <th className="p-3">Workflow Domain</th>
                    <th className="p-3">Department Jurisdiction</th>
                    <th className="p-3">Designated Approver</th>
                    <th className="p-3">Tier Level</th>
                    <th className="p-3">Financial Threshold</th>
                    <th className="p-3">Sign-off Description</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] text-[var(--ink)]">
                  {approvals.map((app) => (
                    <tr key={app.id} className="hover:bg-[var(--surf2)]/50 transition">
                      <td className="p-3 font-semibold">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 font-bold border border-indigo-500/20">
                          ⚡ {app.workflowType}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--ink)] font-semibold">{app.departmentName}</td>
                      <td className="p-3">
                        <div className="font-bold text-sm">{app.approverName}</div>
                        <div className="text-[11px] text-[var(--mute)] font-mono">ID: {app.approverUserId}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30">
                          Level {app.approvalLevel}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-sm text-[var(--ink)]">
                        {app.thresholdAmount && app.thresholdAmount > 0
                          ? `₹${app.thresholdAmount.toLocaleString('en-IN')}`
                          : 'No Limit (All Amounts)'}
                      </td>
                      <td className="p-3 text-[var(--mute)]">{app.description || 'Standard sign-off'}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm('Delete this approval assignment?')) {
                              await masterMappingService.deleteApprovalAssignment(app.id, currentUser)
                              setApprovals((prev) => prev.filter((x) => x.id !== app.id))
                              toast.success('Approval assignment deleted')
                            }
                          }}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 5: RBAC DASHBOARD & COMPLIANCE AUDIT
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="p-2.5 sm:p-3 bg-[var(--surf)] border border-[var(--line)] rounded-xl space-y-0.5 shadow-2xs">
              <div className="text-[11px] text-[var(--mute)] font-medium">Total Registered Users</div>
              <div className="text-lg sm:text-xl font-black text-[var(--ink)]">{users.length}</div>
              <div className="text-[10px] text-emerald-600 font-bold">
                {users.filter((u) => u.status === 'Active').length} Active Accounts
              </div>
            </div>

            <div className="p-2.5 sm:p-3 bg-[var(--surf)] border border-[var(--line)] rounded-xl space-y-0.5 shadow-2xs">
              <div className="text-[11px] text-[var(--mute)] font-medium">Roles & Profiles</div>
              <div className="text-lg sm:text-xl font-black text-purple-600">{roles.length}</div>
              <div className="text-[10px] text-purple-700 font-medium">
                {roles.filter((r) => r.isSystem).length} System · {roles.filter((r) => !r.isSystem).length} Custom
              </div>
            </div>

            <div className="p-2.5 sm:p-3 bg-[var(--surf)] border border-[var(--line)] rounded-xl space-y-0.5 shadow-2xs">
              <div className="text-[11px] text-[var(--mute)] font-medium">Granular Permissions</div>
              <div className="text-lg sm:text-xl font-black text-blue-600">{permissions.length || 182}</div>
              <div className="text-[10px] text-blue-700 font-medium">13 Modules × 14 Action Verbs</div>
            </div>

            <div className="p-2.5 sm:p-3 bg-[var(--surf)] border border-[var(--line)] rounded-xl space-y-0.5 shadow-2xs">
              <div className="text-[11px] text-[var(--mute)] font-medium">2FA Compliance Rate</div>
              <div className="text-lg sm:text-xl font-black text-emerald-600">
                {users.length > 0
                  ? Math.round((users.filter((u) => u.twoFactorEnabled).length / users.length) * 100)
                  : 0}
                %
              </div>
              <div className="text-[10px] text-[var(--mute)]">
                {users.filter((u) => u.twoFactorEnabled).length} of {users.length} users active
              </div>
            </div>
          </div>

          {/* Role Distribution & Module Access */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--ink)]">Role Distribution across Organization</h3>
              <div className="space-y-3">
                {roles.slice(0, 7).map((r) => {
                  const count = users.filter((u) => u.role === r.name).length
                  const pct = users.length > 0 ? Math.round((count / users.length) * 100) : 0
                  return (
                    <div key={r.id} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>{r.name}</span>
                        <span className="text-[var(--mute)]">
                          {count} users ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[var(--surf2)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--acc)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-5 bg-[var(--surf)] border border-[var(--line)] rounded-2xl space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--ink)]">Security & Lockout Compliance</h3>
              <div className="p-4 rounded-xl bg-[var(--surf2)] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--mute)]">Active Sessions:</span>
                  <span className="font-bold text-emerald-600">{users.filter((u) => u.status === 'Active').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--mute)]">Locked Accounts (Failed Auth):</span>
                  <span className="font-bold text-rose-600">{users.filter((u) => u.status === 'Locked').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--mute)]">Inactive Accounts:</span>
                  <span className="font-bold text-gray-500">{users.filter((u) => u.status === 'Inactive').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--mute)]">Designated Approver Seats:</span>
                  <span className="font-bold text-indigo-600">{approvals.length} active tiers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: ADD / EDIT USER (WITH CASCADING MASTER MAPPING DROPDOWNS)
      ───────────────────────────────────────────────────────────────────────────── */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  {editingUser ? `Edit User: ${editingUser.employeeName}` : 'Register New Enterprise User'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--mute)] hover:bg-[var(--surf2)] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              {/* Section 1: User Identity */}
              <div className="space-y-3">
                <h4 className="font-bold text-[var(--ink)] text-[11px] uppercase tracking-wider text-[var(--mute)]">
                  1. Identity & Credentials
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">
                      Employee ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingUser}
                      value={formData.employeeId}
                      onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                      placeholder="e.g. EMP-1049"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">
                      Employee Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.employeeName}
                      onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. rajesh.kumar@meridian.com"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Designation / Job Title</label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      placeholder="e.g. Senior Calibration Engineer"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Account Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none font-medium"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Locked">Locked</option>
                    </select>
                  </div>
                </div>

                {!editingUser && (
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Initial Password</label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="twoFactorToggle"
                    checked={formData.twoFactorEnabled}
                    onChange={(e) => setFormData({ ...formData, twoFactorEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--line)] text-[var(--acc)]"
                  />
                  <label htmlFor="twoFactorToggle" className="font-semibold text-[var(--ink)] cursor-pointer">
                    Enable Two-Factor Authentication (2FA) for this user
                  </label>
                </div>
              </div>

              {/* Section 2: Role Selection */}
              <div className="space-y-2 pt-3 border-t border-[var(--line)]">
                <h4 className="font-bold text-[var(--ink)] text-[11px] uppercase tracking-wider text-[var(--mute)]">
                  2. System Role Assignment
                </h4>
                <div>
                  <label className="block font-semibold mb-1 text-[var(--ink)]">Assigned Security Role</label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => {
                      const rId = Number(e.target.value)
                      const rObj = roles.find((r) => r.id === rId)
                      setFormData({ ...formData, roleId: rId, role: rObj?.name || 'Viewer' })
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none font-medium"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} - {r.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 3: STRICT CASCADING MASTER MAPPING HIERARCHY */}
              <div className="space-y-3 pt-3 border-t border-[var(--line)]">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[var(--ink)] text-[11px] uppercase tracking-wider text-[var(--mute)]">
                    3. Hierarchy Scope Assignment (Master Mapping Cascading)
                  </h4>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    Manual text input strictly prohibited
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Company ▼ */}
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Company ▼</label>
                    <select
                      value={formData.companyId || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined
                        setFormData({
                          ...formData,
                          companyId: val,
                          plantId: undefined,
                          buildingId: undefined,
                          floorId: undefined,
                          departmentId: undefined,
                          areaId: undefined,
                        })
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none font-medium"
                    >
                      <option value="">Select Company</option>
                      {companies
                        .filter((c) => !c.isArchived)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Plant ▼ */}
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Plant ▼</label>
                    <select
                      disabled={!formData.companyId}
                      value={formData.plantId || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined
                        setFormData({
                          ...formData,
                          plantId: val,
                          buildingId: undefined,
                          floorId: undefined,
                          departmentId: undefined,
                          areaId: undefined,
                        })
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none disabled:opacity-50 font-medium"
                    >
                      <option value="">{formData.companyId ? 'All Plants / Select Plant' : 'Select Company First'}</option>
                      {filteredPlants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Building ▼ */}
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Building ▼</label>
                    <select
                      disabled={!formData.plantId}
                      value={formData.buildingId || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined
                        setFormData({
                          ...formData,
                          buildingId: val,
                          floorId: undefined,
                          departmentId: undefined,
                          areaId: undefined,
                        })
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none disabled:opacity-50 font-medium"
                    >
                      <option value="">{formData.plantId ? 'All Buildings / Select Building' : 'Select Plant First'}</option>
                      {filteredBuildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Floor ▼ */}
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Floor ▼</label>
                    <select
                      disabled={!formData.buildingId}
                      value={formData.floorId || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined
                        setFormData({
                          ...formData,
                          floorId: val,
                          departmentId: undefined,
                          areaId: undefined,
                        })
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none disabled:opacity-50 font-medium"
                    >
                      <option value="">{formData.buildingId ? 'All Floors / Select Floor' : 'Select Building First'}</option>
                      {filteredFloors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department ▼ */}
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Department ▼</label>
                    <select
                      disabled={!formData.floorId}
                      value={formData.departmentId || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined
                        setFormData({
                          ...formData,
                          departmentId: val,
                          areaId: undefined,
                        })
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none disabled:opacity-50 font-medium"
                    >
                      <option value="">{formData.floorId ? 'All Departments / Select Department' : 'Select Floor First'}</option>
                      {filteredDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Area / Zone ▼ */}
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">Area / Zone ▼</label>
                    <select
                      disabled={!formData.departmentId}
                      value={formData.areaId || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined
                        setFormData({
                          ...formData,
                          areaId: val,
                        })
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none disabled:opacity-50 font-medium"
                    >
                      <option value="">{formData.departmentId ? 'All Areas / Select Area' : 'Select Department First'}</option>
                      {filteredAreas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[var(--acc)] text-white hover:opacity-90 shadow-xs transition"
                >
                  {editingUser ? 'Save User Scope Changes' : 'Confirm & Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RESET PASSWORD ── */}
      {resetPwdModal.isOpen && resetPwdModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-[var(--ink)]">
              Reset Password for {resetPwdModal.user.employeeName}
            </h3>
            <p className="text-[var(--mute)]">
              Specify a secure temporary password. The user will be required to change it on their next login attempt.
            </p>
            <form onSubmit={handleExecutePasswordReset} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">New Temporary Password</label>
                <input
                  type="text"
                  required
                  value={resetPwdModal.newPwd}
                  onChange={(e) => setResetPwdModal({ ...resetPwdModal, newPwd: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPwdModal({ isOpen: false, user: null, newPwd: '' })}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surf2)] text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700"
                >
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CUSTOM ROLE ── */}
      {isAddRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-[var(--ink)]">Create New Custom Role</h3>
            <form onSubmit={handleCreateCustomRole} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">Role Name *</label>
                <input
                  type="text"
                  required
                  value={newRoleForm.name}
                  onChange={(e) =>
                    setNewRoleForm({
                      ...newRoleForm,
                      name: e.target.value,
                      code: 'ROLE_' + e.target.value.toUpperCase().replace(/\s+/g, '_'),
                    })
                  }
                  placeholder="e.g. SMT Line Calibration Lead"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">System Code *</label>
                <input
                  type="text"
                  required
                  value={newRoleForm.code}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">Description</label>
                <textarea
                  rows={2}
                  value={newRoleForm.description}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddRoleModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surf2)] text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[var(--acc)] text-white font-bold hover:opacity-90"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD APPROVAL TIER ── */}
      {isApproverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-[var(--ink)]">Configure Approval Authority Tier</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const created = await masterMappingService.createApprovalAssignment(approverForm, currentUser)
                setApprovals((prev) => [...prev, created])
                toast.success('Approval Tier created')
                setIsApproverModalOpen(false)
              }}
              className="space-y-3"
            >
              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">Workflow Type</label>
                <select
                  value={approverForm.workflowType}
                  onChange={(e) => setApproverForm({ ...approverForm, workflowType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  <option value="Asset Purchase">Asset Purchase</option>
                  <option value="Asset Disposal">Asset Disposal</option>
                  <option value="Asset Request">Asset Request</option>
                  <option value="Asset Issue / Transfer">Asset Issue / Transfer</option>
                  <option value="Final Approval">Final Approval</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">Department Jurisdiction</label>
                <input
                  type="text"
                  required
                  value={approverForm.departmentName}
                  onChange={(e) => setApproverForm({ ...approverForm, departmentName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">Designated User</label>
                <select
                  value={approverForm.approverUserId}
                  onChange={(e) => {
                    const u = users.find((x) => x.employeeId === e.target.value)
                    setApproverForm({
                      ...approverForm,
                      approverUserId: e.target.value,
                      approverName: u ? u.employeeName : 'Approver',
                    })
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.employeeId}>
                      {u.employeeName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--ink)]">Approval Level</label>
                  <select
                    value={approverForm.approvalLevel}
                    onChange={(e) => setApproverForm({ ...approverForm, approvalLevel: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] font-medium"
                  >
                    <option value={1}>Level 1 (Initial)</option>
                    <option value={2}>Level 2 (Managerial)</option>
                    <option value={3}>Level 3 (Executive Final)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[var(--ink)]">Threshold (₹)</label>
                  <input
                    type="number"
                    value={approverForm.thresholdAmount}
                    onChange={(e) => setApproverForm({ ...approverForm, thresholdAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">Description / Conditions</label>
                <input
                  type="text"
                  value={approverForm.description}
                  onChange={(e) => setApproverForm({ ...approverForm, description: e.target.value })}
                  placeholder="e.g. Line equipment Capex up to ₹2,50,000"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApproverModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surf2)] text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[var(--acc)] text-white font-bold hover:opacity-90"
                >
                  Save Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
