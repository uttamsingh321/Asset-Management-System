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
    s: '12,480 assets across 8 categories',
    btn: 'Add asset',
    k: [
      ['Total assets', '12,480', '+214 this month'],
      ['Assigned', '10,912', '87% in use'],
      ['In storage', '1,204', 'Across 4 sites'],
      ['Retired this year', '364', 'Disposal value $41K'],
    ],
    ah: 'Recently updated',
    a: [
      ['💻', 'MacBook Pro 16" · AST-30417', 'Kavya Menon · Delhi HQ', 'ok', 'Healthy'],
      ['⚙️', 'Hydraulic press HP-204', 'Pune Plant 2 · Line C', 'b', 'Service overdue'],
      ['🚛', 'Delivery van MH-12-4471', 'Mumbai depot', 'w', 'Due in 2 days'],
      ['🖥️', 'Dell UltraSharp U2723 x 40', 'Bengaluru · Floor 4', 'ok', 'Healthy'],
      ['❄️', 'Chiller unit CH-02', 'Delhi HQ · Roof', 'w', 'Watch'],
      ['📱', 'iPad Air · AST-28810', 'Arjun Rao · Hyderabad', 'ok', 'Healthy'],
    ],
    bh: 'By category',
    b: [
      ['IT equipment', '5,820', 100],
      ['Manufacturing', '2,960', 51],
      ['Office', '1,740', 30],
      ['Fleet', '1,120', 19],
      ['Digital', '840', 14],
    ],
  },
  inventory: {
    t: 'Inventory',
    s: '3,420 SKUs in 6 warehouses',
    btn: 'Receive stock',
    k: [
      ['Stock value', '$4.8M', '+3.1% vs last month'],
      ['Low stock', '86', 'Below reorder point'],
      ['Out of stock', '12', '4 on order'],
      ['Turnover', '5.4x', 'Yearly'],
    ],
    ah: 'Needs reordering',
    a: [
      ['🔩', 'Spindle bearing 6204-2RS', 'Pune warehouse', 'b', '12 left, min 40'],
      ['🔋', 'Laptop battery pack L-17', 'Delhi store room', 'w', '28 left, min 50'],
      ['🧴', 'Hydraulic oil 20L', 'Pune warehouse', 'w', '9 left, min 15'],
      ['🔌', 'USB-C dock', 'Bengaluru', 'ok', '64 left, min 30'],
      ['🧰', 'Press seal kit S-88', 'Mumbai depot', 'b', 'Out of stock'],
    ],
    bh: 'Stock by warehouse',
    b: [
      ['Pune', '$1.9M', 100],
      ['Delhi', '$1.1M', 58],
      ['Mumbai', '$0.9M', 47],
      ['Bengaluru', '$0.6M', 32],
      ['Hyderabad', '$0.3M', 16],
    ],
  },
  maintenance: {
    t: 'Maintenance',
    s: '142 jobs due in the next 14 days',
    btn: 'Schedule job',
    k: [
      ['Planned', '142', 'Next 14 days'],
      ['Overdue', '23', 'Down from 31'],
      ['Mean time to repair', '3.4 h', '-0.6 h'],
      ['Equipment uptime', '98.2%', 'Target 97%'],
    ],
    ah: 'Upcoming work',
    a: [
      ['⚙️', 'Hydraulic press HP-204', 'Seal replacement · Pune', 'b', 'Overdue 6 days'],
      ['🚛', 'Van MH-12-4471', 'Service at 40,000 km', 'w', 'In 2 days'],
      ['❄️', 'Chiller CH-02', 'Filter and coolant check', 'w', 'In 5 days'],
      ['🖨️', 'Printer PR-31', 'Roller replacement', 'ok', 'In 11 days'],
      ['🏭', 'CNC mill M-09', 'Spindle inspection', 'ok', 'In 13 days'],
    ],
    bh: 'Work by type',
    b: [
      ['Preventive', '96', 100],
      ['Corrective', '31', 32],
      ['Inspection', '24', 25],
      ['Calibration', '12', 12],
    ],
  },
  workorders: {
    t: 'Work orders',
    s: '318 open · 94 in progress',
    btn: 'New work order',
    k: [
      ['Open', '318', '+22 today'],
      ['In progress', '94', 'Across 31 technicians'],
      ['Waiting for parts', '27', 'Avg wait 3 days'],
      ['Closed this week', '211', 'Median 1.8 days'],
    ],
    ah: 'Latest orders',
    a: [
      ['🔴', 'WO-5531 · Press HP-204 oil leak', 'Assigned to Vikram Singh', 'b', 'Urgent'],
      ['🟠', 'WO-5529 · Chiller CH-02 noise', 'Assigned to Meena Shah', 'w', 'High'],
      ['🟢', 'WO-5526 · Replace dock station', 'Assigned to Rohan Das', 'ok', 'Normal'],
      ['🟢', 'WO-5520 · Chiller CH-01 service', 'Closed 8:05', 'ok', 'Done'],
      ['🟠', 'WO-5517 · Forklift FK-07 brakes', 'Waiting for parts', 'w', 'High'],
    ],
    bh: 'By priority',
    b: [
      ['Urgent', '18', 14],
      ['High', '74', 58],
      ['Normal', '181', 100],
      ['Low', '45', 25],
    ],
  },
  employees: {
    t: 'Employees',
    s: '1,860 people hold company assets',
    btn: 'Assign asset',
    k: [
      ['People with assets', '1,860', 'Of 2,140 staff'],
      ['Assets per person', '2.3', 'Average'],
      ['Returns pending', '18', 'Leaving this month'],
      ['Onboarding this week', '9', 'New joiners'],
    ],
    ah: 'Pending returns',
    a: [
      ['👤', 'Aarav Kapoor', 'Laptop, phone, access card · last day 20 Nov', 'w', '3 items'],
      ['👤', 'Sana Iyer', 'Laptop, monitor · last day 27 Nov', 'w', '2 items'],
      ['👤', 'Dev Malhotra', 'Phone · returned 12 Nov', 'ok', 'Complete'],
      ['👤', 'Isha Reddy', 'Laptop, headset · starts 16 Nov', 'ok', 'Ready to issue'],
    ],
    bh: 'Assets by department',
    b: [
      ['Manufacturing', '4,100', 100],
      ['IT', '3,260', 80],
      ['Sales', '1,980', 48],
      ['Finance', '840', 21],
      ['HR', '410', 10],
    ],
  },
  locations: {
    t: 'Locations',
    s: '4 sites · 212 rooms and zones',
    btn: 'Add location',
    k: [
      ['Sites', '4', 'India'],
      ['Rooms and zones', '212', 'Mapped'],
      ['Unverified assets', '318', 'Not scanned in 90 days'],
      ['Moves this month', '146', 'Logged'],
    ],
    ah: 'Sites',
    a: [
      ['🏢', 'Delhi HQ', '3,940 assets · 62 rooms', 'ok', 'Audit complete'],
      ['🏭', 'Pune Plant 2', '4,720 assets · 48 zones', 'w', 'Audit due in 9 days'],
      ['🏬', 'Bengaluru office', '2,310 assets · 71 rooms', 'ok', 'Audit complete'],
      ['📦', 'Mumbai depot', '1,510 assets · 31 zones', 'b', 'Audit overdue'],
    ],
    bh: 'Assets by site',
    b: [
      ['Pune Plant 2', '4,720', 100],
      ['Delhi HQ', '3,940', 83],
      ['Bengaluru', '2,310', 49],
      ['Mumbai depot', '1,510', 32],
    ],
  },
  vendors: {
    t: 'Vendors',
    s: '148 active vendors',
    btn: 'Add vendor',
    k: [
      ['Active vendors', '148', '12 added this year'],
      ['Contracts expiring', '11', 'Next 60 days'],
      ['On-time delivery', '94%', '+2 pts'],
      ['Spend this year', '$11.6M', 'Top 10 = 64%'],
    ],
    ah: 'Top vendors',
    a: [
      ['🏷️', 'Siemens India', 'Manufacturing equipment', 'ok', '98% on time'],
      ['🏷️', 'Dell Technologies', 'IT hardware', 'ok', '95% on time'],
      ['🏷️', 'Tata Motors', 'Fleet and service', 'w', '88% on time'],
      ['🏷️', 'Godrej Interio', 'Office furniture', 'ok', '96% on time'],
      ['🏷️', 'SKF Bearings', 'Spare parts', 'b', 'Contract ends in 18 days'],
    ],
    bh: 'Spend by category',
    b: [
      ['Manufacturing', '$4.9M', 100],
      ['IT hardware', '$3.2M', 65],
      ['Fleet', '$1.8M', 37],
      ['Office', '$1.1M', 22],
      ['Spares', '$0.6M', 12],
    ],
  },
  procurement: {
    t: 'Procurement',
    s: '36 open purchase orders',
    btn: 'New purchase order',
    k: [
      ['Open POs', '36', '$1.2M committed'],
      ['Awaiting approval', '3', 'Oldest 1 day'],
      ['Cycle time', '4.2 days', 'Request to order'],
      ['Savings this year', '$318K', 'From negotiation'],
    ],
    ah: 'Purchase orders',
    a: [
      ['🧾', 'PO-8841 · Siemens India', '$38,400 · motor drives', 'w', 'Needs approval'],
      ['🧾', 'PO-8839 · Dell Technologies', '$52,000 · 60 laptops', 'ok', 'Ordered'],
      ['🧾', 'PO-8836 · SKF Bearings', '$6,200 · spindle bearings', 'ok', 'Shipped'],
      ['🧾', 'PO-8830 · Godrej Interio', '$14,900 · desks', 'ok', 'Delivered'],
      ['🧾', 'PO-8827 · Tata Motors', '$21,000 · van service plan', 'w', 'Needs approval'],
    ],
    bh: 'POs by status',
    b: [
      ['Awaiting approval', '3', 8],
      ['Ordered', '17', 47],
      ['Shipped', '11', 31],
      ['Delivered', '5', 14],
    ],
  },
  finance: {
    t: 'Finance',
    s: 'Book value and depreciation across all assets',
    btn: 'Export ledger',
    k: [
      ['Book value', '$38.2M', 'Of $61.5M cost'],
      ['Depreciation this year', '$4.1M', 'On schedule'],
      ['Quarter spend', '$2.41M', '6.2% under budget'],
      ['Warranty savings', '$186K', 'Claims paid'],
    ],
    ah: 'Cost centers',
    a: [
      ['💼', 'Manufacturing', '$1.02M of $1.15M budget', 'w', '89% used'],
      ['💼', 'IT', '$640K of $800K budget', 'ok', '80% used'],
      ['💼', 'Logistics and fleet', '$410K of $520K budget', 'ok', '79% used'],
      ['💼', 'Facilities', '$215K of $210K budget', 'b', '102% used'],
    ],
    bh: 'Book value by category',
    b: [
      ['Manufacturing', '$21.4M', 100],
      ['IT', '$8.1M', 38],
      ['Fleet', '$5.2M', 24],
      ['Office', '$3.5M', 16],
    ],
  },
  reports: {
    t: 'Reports',
    s: '24 saved reports · 9 scheduled',
    btn: 'New report',
    k: [
      ['Saved reports', '24', 'Shared with teams'],
      ['Scheduled', '9', 'Weekly and monthly'],
      ['Runs this month', '312', '+18%'],
      ['Exports', '87', 'PDF and Excel'],
    ],
    ah: 'Saved reports',
    a: [
      ['📊', 'Asset register by site', 'Updated daily · Operations', 'ok', 'Weekly'],
      ['📊', 'Warranty expiry forecast', 'Finance · IT', 'ok', 'Monthly'],
      ['📊', 'Maintenance backlog', 'Plant managers', 'ok', 'Daily'],
      ['📊', 'Depreciation schedule', 'Finance', 'w', 'Quarterly'],
      ['📊', 'Unverified assets', 'Audit team', 'ok', 'On demand'],
    ],
    bh: 'Most run',
    b: [
      ['Asset register', '94', 100],
      ['Maintenance backlog', '71', 76],
      ['Warranty forecast', '58', 62],
      ['Depreciation', '33', 35],
    ],
  },
  administration: {
    t: 'Administration',
    s: 'Users, roles and connected systems',
    btn: 'Invite user',
    k: [
      ['Users', '212', '9 invited'],
      ['Roles', '8', 'Custom roles allowed'],
      ['Integrations', '6', 'All healthy'],
      ['Audit events', '48K', 'Last 30 days'],
    ],
    ah: 'Connected systems',
    a: [
      ['🔗', 'SAP S/4HANA', 'Finance sync · every hour', 'ok', 'Connected'],
      ['🔗', 'Microsoft Entra ID', 'Single sign-on and users', 'ok', 'Connected'],
      ['🔗', 'Intune', 'Device inventory', 'ok', 'Connected'],
      ['🔗', 'ServiceNow', 'Incident link', 'w', 'Token expires in 6 days'],
      ['🔗', 'Samsara', 'Fleet telematics', 'ok', 'Connected'],
    ],
    bh: 'Users by role',
    b: [
      ['Viewer', '108', 100],
      ['Technician', '64', 59],
      ['Manager', '28', 26],
      ['Admin', '12', 11],
    ],
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
    'Drafted 14 inspections for Pune Plant 2 across next week, avoiding production shifts. Ready to send for approval.',
  'Compare renewal options':
    'Renewing 41 laptops for 12 months costs $9,800. Replacement costs $52,000 and a refresh would fall in Q1.',
  'Which assets fail most?':
    'Hydraulic presses fail most: 11 unplanned stops this year, mostly seal wear. CNC spindles are second.',
}
