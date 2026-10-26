// Same options, order and labels as the website's Sales Executive menu (client/src/Layout.jsx → NAV.sales).
// `tab` = lives in the bottom tab bar, `route` = full-screen stack route. Every icon is Ionicons (single icon set app-wide).
export const NAV_ITEMS = [
  { label: 'Dashboard', icon: 'grid-outline', tab: 'Home' },
  { label: 'My Leads', icon: 'disc-outline', tab: 'Leads' },
  { label: 'My Tasks', icon: 'checkbox-outline', route: 'MyTasks' },
  { label: 'My Customers', icon: 'id-card-outline', route: 'Customers' },
  { label: 'Follow-ups', icon: 'call-outline', tab: 'Followups' },
  { label: 'Courses & Admissions', icon: 'school-outline', route: 'Admissions' },
  { label: 'Payment Updates', icon: 'receipt-outline', route: 'Payments' },
  { label: 'My Performance', icon: 'bar-chart-outline', route: 'Performance' },
  { label: 'My Profile', icon: 'person-circle-outline', tab: 'Profile' },
];
