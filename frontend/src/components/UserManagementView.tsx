import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import type { UserAccount, PlantDepartment } from '../types/asset'
import { logAuditEvent, setCurrentUserProfile, type UserProfile } from '../lib/deviceTracker'
import { masterMappingService } from '../lib/masterMappingService'

const DEPARTMENTS: { key: PlantDepartment; label: string; icon: string; color: string }[] = [
  { key: 'IT', label: 'IT & Systems', icon: '💻', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { key: 'Production', label: 'Production & SMT', icon: '🏭', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  { key: 'Maintenance', label: 'Maintenance & Calibration', icon: '🔧', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { key: 'Store', label: 'Warehouse & Store', icon: '📦', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { key: 'Finance', label: 'Finance & Accounts', icon: '💰', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { key: 'Quality', label: 'Quality & Audit', icon: '🔍', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
  { key: 'Operations', label: 'Operations & Facilities', icon: '⚡', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  { key: 'Administration', label: 'Administration & HR', icon: '🏢', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
]

const ROLES = [
  { key: 'Admin', label: 'Admin (Superuser)', desc: 'Full unrestricted plant and user administration' },
  { key: 'Plant Manager', label: 'Plant Manager', desc: 'Cross-department oversight & transfer approvals' },
  { key: 'Maintenance', label: 'Maintenance Specialist', desc: 'Repair tickets, downtime tracking & calibration' },
  { key: 'Store', label: 'Store / Warehouse Keeper', desc: 'Barcode scanning, stocktaking & inventory variance' },
  { key: 'Auditor', label: 'Internal Auditor', desc: 'Read-only audit trails, tax depreciation & stock papers' },
  { key: 'Viewer', label: 'Viewer (Read Only)', desc: 'Read-only access to asset registry and public dashboards' },
  { key: 'Employee', label: 'Department Employee', desc: 'Department-scoped asset assignment and usage' },
]

const STORAGE_USERS_KEY = 'meridian_rbac_users_v1'

const DEFAULT_USERS: UserAccount[] = [
  {
    userId: 'USR-ADMIN',
    name: 'Uttam Singh',
    email: 'uttam.singh@meridian.com',
    department: 'IT',
    role: 'Admin',
    password: 'AdminPassword2026!',
    isSuperuser: true,
    isActive: true,
    createdBy: 'System Initializer',
    createdAt: new Date().toISOString(),
  },
]

interface Props {
  currentUser: UserProfile
  onSwitchUser: (user: UserProfile) => void
  lang?: 'en' | 'hi'
}

export const UserManagementView: React.FC<Props> = ({ currentUser, onSwitchUser, lang = 'en' }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USERS_KEY)
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.warn('Failed to parse saved RBAC users', e)
    }
    return DEFAULT_USERS
  })

  const [selectedDept, setSelectedDept] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [targetUser, setTargetUser] = useState<UserAccount | null>(null)

  // Add User Form state
  const [newUserId, setNewUserId] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDepartment, setNewDepartment] = useState<string>('Production & SMT')
  const [newRole, setNewRole] = useState('Employee')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Reset Password Form state
  const [manualResetPassword, setManualResetPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)

  // Newly created credential card for handover
  const [createdCredentialHandover, setCreatedCredentialHandover] = useState<UserAccount | null>(null)

  // Sync users with backend API if available
  useEffect(() => {
    fetch('/api/users/?include_passwords=1')
      .then((res) => {
        if (!res.ok) throw new Error('Backend not available')
        return res.json()
      })
      .then((data) => {
        if (data.users && data.users.length > 0) {
          setUsers(data.users)
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(data.users))
        }
      })
      .catch(() => {
        // Fallback to local storage
      })
  }, [])

  // Persist local state
  const persistUsers = (updated: UserAccount[]) => {
    setUsers(updated)
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn('Failed to persist users to localStorage', e)
    }
  }

  const isSuperuser = currentUser.role === 'Admin' || currentUser.userId === 'USR-ADMIN'

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (selectedDept !== 'All') {
        const matches =
          u.department.toLowerCase() === selectedDept.toLowerCase() ||
          (selectedDept.includes('&') && selectedDept.toLowerCase().includes(u.department.toLowerCase())) ||
          (u.department.includes('&') && u.department.toLowerCase().includes(selectedDept.toLowerCase()))
        if (!matches) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const text = [u.userId, u.name, u.email, u.department, u.role].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [users, selectedDept, searchQuery])

  // Stats
  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.isActive !== false).length
  const departmentCount = new Set(users.map((u) => u.department)).size
  const adminCount = users.filter((u) => u.role === 'Admin').length

  // Dynamic list of unique department suggestions (standard + custom typed by Superuser)
  const allDepartmentSuggestions = useMemo(() => {
    const defaultList = [
      'IT & Systems',
      'Production & SMT',
      'Maintenance & Calibration',
      'Warehouse & Store',
      'Finance & Accounts',
      'Quality & Audit',
      'Operations & Facilities',
      'Administration & HR',
    ]
    const userDepts = users.map((u) => u.department).filter(Boolean)
    return Array.from(new Set([...defaultList, ...userDepts]))
  }, [users])

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    const uid = newUserId.trim().toUpperCase()
    const name = newName.trim()
    const pw = newPassword.trim()
    const dept = newDepartment.trim()

    if (!dept) {
      toast.error('Department is required. Please type the department.')
      return
    }
    if (!uid) {
      toast.error('User ID is required (e.g. SMT-101, MNT-202)')
      return
    }
    if (!name) {
      toast.error('Full Name is required')
      return
    }
    if (!pw) {
      toast.error('Password is required. Superuser must set the credential manually (random generation is disabled).')
      return
    }
    if (pw.length < 4) {
      toast.error('Password must be at least 4 characters long')
      return
    }
    if (pw !== confirmPassword.trim()) {
      toast.error('Passwords do not match. Please re-enter confirm password.')
      return
    }
    if (users.some((u) => u.userId.toUpperCase() === uid)) {
      toast.error(`User ID '${uid}' already exists. Please choose a unique ID.`)
      return
    }

    const newUser: UserAccount = {
      userId: uid,
      name,
      email: newEmail.trim() || `${uid.toLowerCase()}@meridian.com`,
      department: dept,
      role: newRole,
      password: pw,
      isSuperuser: newRole === 'Admin',
      isActive: true,
      createdBy: currentUser.userName || 'Superuser',
      createdAt: new Date().toISOString(),
    }

    // Try posting to backend
    try {
      const res = await fetch('/api/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          newUser.id = data.user.id
        }
      }
    } catch {
      // Offline fallback
    }

    const updated = [newUser, ...users]
    persistUsers(updated)

    try {
      const currentRBAC = masterMappingService.getRBACUsers()
      if (!currentRBAC.some((u) => u.employeeId.toUpperCase() === uid.toUpperCase())) {
        masterMappingService.saveRBACUsers([
          {
            id: String(Date.now()),
            employeeId: uid,
            employeeName: name,
            email: newEmail,
            phone: '',
            department: newDepartment,
            designation: newRole,
            status: 'Active',
            role: newRole,
            twoFactorEnabled: false,
            password: pw,
            createdAt: new Date().toISOString(),
          },
          ...currentRBAC,
        ])
      }
    } catch {}

    logAuditEvent('ASSET_APPROVAL', {
      actionType: 'USER_CREATE_RBAC',
      userId: uid,
      name,
      department: newDepartment,
      role: newRole,
      passwordSetBySuperuser: true,
    }, uid)

    setCreatedCredentialHandover(newUser)
    setIsAddModalOpen(false)

    // Reset inputs
    setNewUserId('')
    setNewName('')
    setNewEmail('')
    setNewPassword('')
    setConfirmPassword('')

    toast.success(`User ${name} created for ${newDepartment}! Hand over password to user.`)
  }

  // Manual Reset Password Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUser) return
    const pw = manualResetPassword.trim()
    if (!pw || pw.length < 4) {
      toast.error('New password must be at least 4 characters long')
      return
    }

    const updatedUsers = users.map((u) => {
      if (u.userId === targetUser.userId) {
        return { ...u, password: pw }
      }
      return u
    })
    persistUsers(updatedUsers)

    // Call backend PUT if possible
    try {
      await fetch(`/api/users/${targetUser.userId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
    } catch {
      // Offline
    }

    logAuditEvent('ASSET_APPROVAL', {
      actionType: 'USER_PASSWORD_RESET',
      targetUser: targetUser.userId,
      resetBy: currentUser.userId,
    }, targetUser.userId)

    toast.success(`Password for ${targetUser.name} updated. Provide this password to the employee.`)
    setIsResetPasswordModalOpen(false)
    setTargetUser(null)
    setManualResetPassword('')
  }

  // Delete User Handler
  const handleDeleteUser = async (userToDelete: UserAccount) => {
    if (userToDelete.role === 'Admin' && adminCount <= 1) {
      toast.error('Cannot delete the sole Administrator account.')
      return
    }
    if (!window.confirm(`Are you sure you want to deactivate and remove user ${userToDelete.name} (${userToDelete.userId})?`)) {
      return
    }

    const updated = users.filter((u) => u.userId !== userToDelete.userId)
    persistUsers(updated)

    try {
      await fetch(`/api/users/${userToDelete.userId}/`, { method: 'DELETE' })
    } catch {
      // Offline
    }

    logAuditEvent('ASSET_DELETE', {
      actionType: 'USER_DELETE',
      deletedUser: userToDelete.userId,
      department: userToDelete.department,
    }, userToDelete.userId)

    toast.success(`User ${userToDelete.userId} removed.`)
  }

  // Switch to User
  const handleLoginAs = (user: UserAccount) => {
    const profile: UserProfile = {
      userId: user.userId,
      userName: user.name,
      role: user.role,
      department: user.department,
    }
    setCurrentUserProfile(profile)
    onSwitchUser(profile)
    logAuditEvent('LOGIN', { authMethod: 'Superuser RBAC Switch', user: profile })
    toast.success(`Switched active session to ${user.name} (${user.department} · ${user.role})`)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  return (
    <div className="space-y-6" id="v-rbac-users">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="text-lg font-bold text-[var(--ink)]">
                {lang === 'hi' ? 'विभाग RBAC और उपयोगकर्ता प्रबंधन' : 'Department RBAC & User Access Management'}
              </h1>
              <p className="text-xs text-[var(--mute)] mt-0.5">
                {lang === 'hi'
                  ? 'सुपरयूज़र विभाग के अनुसार नए उपयोगकर्ताओं को जोड़ सकता है और सीधे पासवर्ड सेट करके उन्हें सौंप सकता है।'
                  : 'Superuser console: Provision department staff, configure permissions, and manually assign passwords for secure handover.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSuperuser && (
            <button
              type="button"
              onClick={() => {
                setShowPassword(false)
                setIsAddModalOpen(true)
              }}
              className="btn p text-xs flex items-center gap-1.5 px-4 py-2"
            >
              <span>+</span>
              <span>{lang === 'hi' ? 'नया उपयोगकर्ता जोड़ें' : 'Add Department User'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="text-[11px] text-[var(--mute)] font-medium">Total Users</div>
          <div className="text-lg sm:text-xl font-black text-[var(--ink)] mt-0.5 mb-1">{totalUsers}</div>
          <div className="text-[10px] text-[var(--ok)]">Across all facilities</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="text-[11px] text-[var(--mute)] font-medium">Active Accounts</div>
          <div className="text-lg sm:text-xl font-black text-[var(--ok)] mt-0.5 mb-1">{activeUsers}</div>
          <div className="text-[10px] text-[var(--mute)]">100% credentials active</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="text-[11px] text-[var(--mute)] font-medium">Departments</div>
          <div className="text-lg sm:text-xl font-black text-[var(--acc)] mt-0.5 mb-1">{departmentCount}</div>
          <div className="text-[10px] text-[var(--mute)]">Role-scoped access</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="text-[11px] text-[var(--mute)] font-medium">Superusers / Admins</div>
          <div className="text-lg sm:text-xl font-black text-amber-500 mt-0.5 mb-1">{adminCount}</div>
          <div className="text-[10px] text-[var(--mute)]">Privileged access</div>
        </div>
      </div>

      {/* Credential Handover Card (displayed when a new user is created) */}
      {createdCredentialHandover && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <div>
                <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  User Created Successfully - Hand Over Credentials
                </h3>
                <p className="text-xs text-[var(--mute)]">
                  Copy these login credentials and give them directly to the user. No random password was generated.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreatedCredentialHandover(null)}
              className="text-xs text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
            >
              ✕ Dismiss
            </button>
          </div>

          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs">
            <div className="space-y-1">
              <div>
                <span className="text-[var(--mute)]">User ID: </span>
                <span className="font-bold text-[var(--ink)]">{createdCredentialHandover.userId}</span>
              </div>
              <div>
                <span className="text-[var(--mute)]">Name: </span>
                <span className="text-[var(--ink)]">{createdCredentialHandover.name}</span>
              </div>
              <div>
                <span className="text-[var(--mute)]">Department: </span>
                <span className="text-indigo-500 font-semibold">{createdCredentialHandover.department}</span>
              </div>
              <div>
                <span className="text-[var(--mute)]">Role: </span>
                <span className="text-amber-500 font-semibold">{createdCredentialHandover.role}</span>
              </div>
              <div>
                <span className="text-[var(--mute)]">Superuser Password: </span>
                <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {createdCredentialHandover.password}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const text = `Meridian Asset Management Credentials\nUser ID: ${createdCredentialHandover.userId}\nName: ${createdCredentialHandover.name}\nDepartment: ${createdCredentialHandover.department}\nRole: ${createdCredentialHandover.role}\nPassword: ${createdCredentialHandover.password}\nLogin URL: http://localhost:5173/`
                copyToClipboard(text, 'User credentials')
              }}
              className="btn p text-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              📋 Copy Credentials to Hand Over
            </button>
          </div>
        </div>
      )}

      {/* Filters & Department Tabs */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Department Selection Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedDept('All')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                selectedDept === 'All'
                  ? 'bg-[var(--acc)] text-white shadow-xs'
                  : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              All Departments ({totalUsers})
            </button>
            {allDepartmentSuggestions.map((deptName) => {
              const count = users.filter((u) => {
                return (
                  u.department.toLowerCase() === deptName.toLowerCase() ||
                  (deptName.includes('&') && deptName.toLowerCase().includes(u.department.toLowerCase())) ||
                  (u.department.includes('&') && u.department.toLowerCase().includes(deptName.toLowerCase()))
                )
              }).length
              if (count === 0 && !['IT & Systems', 'Production & SMT', 'Maintenance & Calibration', 'Warehouse & Store'].includes(deptName)) return null
              const deptObj = DEPARTMENTS.find(
                (d) => d.key.toLowerCase() === deptName.toLowerCase() || d.label.toLowerCase() === deptName.toLowerCase()
              )
              const isSelected = selectedDept.toLowerCase() === deptName.toLowerCase()

              return (
                <button
                  key={deptName}
                  type="button"
                  onClick={() => setSelectedDept(deptName)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[var(--acc)] text-white shadow-xs'
                      : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>{deptObj?.icon || '🏢'}</span>
                  <span>{deptName}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user ID, name, role..."
              className="text-xs py-1.5 pl-8 pr-4 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] w-full"
            />
            <span className="absolute left-2.5 top-1.5 text-xs text-[var(--mute)]">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1 text-xs text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--mute)] uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">User ID</th>
                <th className="py-3 px-3">Full Name & Email</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">RBAC Role</th>
                <th className="py-3 px-3">Superuser Password</th>
                <th className="py-3 px-3">Created By</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const deptObj = DEPARTMENTS.find((d) => d.key === u.department)
                  const isCurrent = currentUser.userId === u.userId

                  return (
                    <tr
                      key={u.userId}
                      className={`hover:bg-[var(--surf2)]/50 transition-colors ${
                        isCurrent ? 'bg-[var(--acc)]/5 font-medium' : ''
                      }`}
                    >
                      {/* User ID */}
                      <td className="py-3 px-3 font-mono font-bold text-[var(--ink)]">
                        <div className="flex items-center gap-1.5">
                          <span>{u.userId}</span>
                          {isCurrent && (
                            <span className="text-[10px] bg-[var(--acc)] text-white px-1.5 py-0.2 rounded font-sans">
                              Active Session
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Name & Email */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-xs text-[var(--ink)]">{u.name}</div>
                        <div className="text-[11px] text-[var(--mute)] font-mono">{u.email || '-'}</div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            deptObj?.color || 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                          }`}
                        >
                          <span>{deptObj?.icon || '🏢'}</span>
                          <span>{u.department}</span>
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            u.role === 'Admin'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : u.role === 'Plant Manager'
                              ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                              : u.role === 'Maintenance'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : u.role === 'Store'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-[var(--surf2)] text-[var(--ink)] border border-[var(--line)]'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Superuser Password */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs bg-[var(--surf2)] px-2 py-0.5 rounded border border-[var(--line)]">
                            {u.password ? u.password : '••••••••'}
                          </span>
                          {u.password && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(u.password!, 'Password')}
                              className="text-[10px] text-[var(--mute)] hover:text-[var(--acc)] cursor-pointer"
                              title="Copy password to hand over"
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Created By */}
                      <td className="py-3 px-3 text-[11px] text-[var(--mute)]">
                        {u.createdBy || 'Superuser'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test / Login as */}
                          <button
                            type="button"
                            onClick={() => handleLoginAs(u)}
                            className="px-2 py-1 rounded bg-[var(--acc)]/10 text-[var(--acc)] hover:bg-[var(--acc)] hover:text-white transition text-[11px] font-semibold cursor-pointer"
                            title={`Switch active session to ${u.name} to test department view`}
                          >
                            Switch User
                          </button>

                          {/* Reset Password */}
                          {isSuperuser && (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetUser(u)
                                setManualResetPassword('')
                                setShowResetPassword(false)
                                setIsResetPasswordModalOpen(true)
                              }}
                              className="px-2 py-1 rounded bg-[var(--surf2)] text-[var(--ink)] hover:bg-[var(--line)] transition text-[11px] font-semibold cursor-pointer"
                              title="Set new password manually for this user"
                            >
                              Reset PW
                            </button>
                          )}

                          {/* Delete */}
                          {isSuperuser && u.userId !== 'USR-ADMIN' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1 rounded text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                              title={`Delete ${u.userId}`}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-xs text-[var(--mute)]">
                    No users found matching the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New User Modal (Superuser RBAC) */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)]">Add Department User (Superuser RBAC)</h3>
                  <p className="text-[11px] text-[var(--mute)]">
                    Provision department user and set manual password for direct handover.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--mute)] hover:bg-[var(--surf2)] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              {/* 1. Typable Department Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[var(--ink)] block text-xs">
                    1. Department * (Type custom department name)
                  </label>
                  {newDepartment && (
                    <span className="text-[11px] font-mono text-[var(--acc)] font-semibold">
                      Selected: {newDepartment}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    list="department-datalist"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Type department (e.g. SMT Line 1, IT, Maintenance, Warehouse, QA...)"
                    className="w-full p-2.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] font-medium shadow-2xs"
                  />
                  <datalist id="department-datalist">
                    {allDepartmentSuggestions.map((dep) => (
                      <option key={dep} value={dep} />
                    ))}
                  </datalist>
                </div>

                {/* Quick Suggestion Pills */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-[var(--mute)]">Quick select:</span>
                  {allDepartmentSuggestions.slice(0, 8).map((chip) => {
                    const isSelected = newDepartment.trim().toLowerCase() === chip.toLowerCase()
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setNewDepartment(chip)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] transition cursor-pointer border ${
                          isSelected
                            ? 'bg-[var(--acc)] text-white border-[var(--acc)] font-bold shadow-2xs'
                            : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)] border-[var(--line)]'
                        }`}
                      >
                        {chip}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">
                  2. Role & Access Level *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                >
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label} — {r.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* User ID & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[var(--ink)] block mb-1">
                    3. User / Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="e.g. SMT-101, MNT-202"
                    className="w-full p-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[var(--ink)] block mb-1">
                    4. Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full p-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. rajesh.kumar@meridian.com"
                  className="w-full p-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                />
              </div>

              {/* Explicit Password Setting by Superuser */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-amber-700 dark:text-amber-400 block text-xs">
                      🔒 5. Superuser Manual Password *
                    </label>
                    <p className="text-[11px] text-[var(--mute)]">
                      Random password generation is disabled. Enter the password you will hand over to this user.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs font-semibold text-[var(--acc)] hover:underline"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter employee password"
                      className="w-full p-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] font-mono"
                    />
                  </div>
                  <div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full p-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn flex-1 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn p flex-1 py-2 text-xs font-bold"
                >
                  Create User & Save Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Reset Password Modal */}
      {isResetPasswordModalOpen && targetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)]">Reset Password (Manual Superuser)</h3>
                <p className="text-[11px] text-[var(--mute)]">
                  For user: <b>{targetUser.name}</b> ({targetUser.userId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--mute)] hover:bg-[var(--surf2)] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">
                  New Password (Enter manually) *
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={manualResetPassword}
                    onChange={(e) => setManualResetPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full p-2 pr-12 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] font-mono focus:outline-none focus:border-[var(--acc)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-2 text-[11px] font-semibold text-[var(--acc)]"
                  >
                    {showResetPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[10.5px] text-[var(--mute)] mt-1">
                  Random generation is disabled. Provide this new password directly to the employee.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="btn flex-1 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn p flex-1 py-1.5 text-xs font-bold"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default UserManagementView
