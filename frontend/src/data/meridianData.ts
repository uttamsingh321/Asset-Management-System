export interface PageData {
  t: string
  s: string
  btn: string
  k: [string, string, string][]
  ah: string
  a: [string, string, string, string, string][]
  bh: string
  b: [string, string, number][]
}

export const meridianPages: Record<string, PageData> = {
  assets: {
    t: 'Assets',
    s: '0 assets registered across categories',
    btn: 'Add asset',
    k: [
      ['Total assets', '0', '0 this month'],
      ['Assigned', '0', '0% in use'],
      ['In storage', '0', '0 sites'],
      ['Retired this year', '0', 'Disposal value $0'],
    ],
    ah: 'Recently updated',
    a: [],
    bh: 'By category',
    b: [],
  },
  inventory: {
    t: 'Inventory',
    s: '0 SKUs recorded across warehouses',
    btn: 'Receive stock',
    k: [
      ['Stock value', '$0.00', '0% vs last month'],
      ['Low stock', '0', 'Below reorder point'],
      ['Out of stock', '0', '0 on order'],
      ['Turnover', '0.0x', 'Yearly'],
    ],
    ah: 'Needs reordering',
    a: [],
    bh: 'Stock by warehouse',
    b: [],
  },
  maintenance: {
    t: 'Maintenance',
    s: '0 jobs due in the next 14 days',
    btn: 'Schedule job',
    k: [
      ['Planned', '0', 'Next 14 days'],
      ['Overdue', '0', 'No overdue jobs'],
      ['Mean time to repair', '0.0 h', 'On schedule'],
      ['Equipment uptime', '100%', 'Target 97%'],
    ],
    ah: 'Upcoming work',
    a: [],
    bh: 'Work by type',
    b: [],
  },
  workorders: {
    t: 'Work orders',
    s: '0 open work orders',
    btn: 'New work order',
    k: [
      ['Open', '0', '0 today'],
      ['In progress', '0', '0 technicians'],
      ['Waiting for parts', '0', 'Avg wait 0 days'],
      ['Closed this week', '0', 'Median 0 days'],
    ],
    ah: 'Latest orders',
    a: [],
    bh: 'By priority',
    b: [],
  },
  employees: {
    t: 'Employees',
    s: '0 personnel assigned company assets',
    btn: 'Assign asset',
    k: [
      ['People with assets', '0', '0 total staff'],
      ['Assets per person', '0.0', 'Average'],
      ['Returns pending', '0', 'Leaving this month'],
      ['Onboarding this week', '0', 'New joiners'],
    ],
    ah: 'Pending returns',
    a: [],
    bh: 'Assets by department',
    b: [],
  },
  locations: {
    t: 'Locations',
    s: '0 active facilities mapped',
    btn: 'Add location',
    k: [
      ['Sites', '0', 'India'],
      ['Rooms and zones', '0', 'Mapped'],
      ['Unverified assets', '0', 'All verified'],
      ['Moves this month', '0', 'Logged'],
    ],
    ah: 'Sites',
    a: [],
    bh: 'Assets by site',
    b: [],
  },
  vendors: {
    t: 'Vendors',
    s: '0 approved supplier profiles',
    btn: 'Add vendor',
    k: [
      ['Active vendors', '0', '0 added this year'],
      ['Contracts expiring', '0', 'Next 60 days'],
      ['On-time delivery', '100%', 'Target 95%'],
      ['Spend this year', '$0.00', 'Top 10 = 0%'],
    ],
    ah: 'Top vendors',
    a: [],
    bh: 'Spend by category',
    b: [],
  },
  procurement: {
    t: 'Procurement',
    s: '0 open purchase orders',
    btn: 'New purchase order',
    k: [
      ['Open POs', '0', '$0 committed'],
      ['Awaiting approval', '0', '0 pending'],
      ['Cycle time', '0.0 days', 'Request to order'],
      ['Savings this year', '$0.00', 'From negotiation'],
    ],
    ah: 'Purchase orders',
    a: [],
    bh: 'POs by status',
    b: [],
  },
  finance: {
    t: 'Finance',
    s: 'Book value and depreciation across all assets',
    btn: 'Export ledger',
    k: [
      ['Book value', '$0.00', 'Of $0 cost'],
      ['Depreciation this year', '$0.00', 'On schedule'],
      ['Quarter spend', '$0.00', '0% under budget'],
      ['Warranty savings', '$0.00', 'Claims paid'],
    ],
    ah: 'Cost centers',
    a: [],
    bh: 'Book value by category',
    b: [],
  },
  reports: {
    t: 'Reports',
    s: '0 saved audit reports',
    btn: 'New report',
    k: [
      ['Saved reports', '0', 'Shared with teams'],
      ['Scheduled', '0', 'Weekly and monthly'],
      ['Runs this month', '0', '0%'],
      ['Exports', '0', 'PDF and Excel'],
    ],
    ah: 'Saved reports',
    a: [],
    bh: 'Most run',
    b: [],
  },
  administration: {
    t: 'Administration',
    s: 'Users, roles and connected systems',
    btn: 'Invite user',
    k: [
      ['Users', '0', '0 invited'],
      ['Roles', '0', 'Standard roles'],
      ['Integrations', '0', 'Connected systems'],
      ['Audit events', '0', 'Last 30 days'],
    ],
    ah: 'Connected systems',
    a: [],
    bh: 'Users by role',
    b: [],
  },
}

export const navItems = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'assets', label: 'Assets' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'workorders', label: 'Work orders' },
  { key: 'employees', label: 'Employees' },
  { key: 'locations', label: 'Locations' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'finance', label: 'Finance' },
  { key: 'reports', label: 'Reports' },
  { key: 'administration', label: 'Administration' },
]

export const aiAnswers: Record<string, string> = {
  'Schedule inspections':
    'No active inspection candidates found. Register assets and log inspection intervals to automate schedules.',
  'Compare renewal options':
    'No hardware warranties currently near expiration. Renewal forecasting activates when asset purchase dates are provided.',
  'Which assets fail most?':
    'Zero unplanned stoppages recorded in the current audit period.',
}
