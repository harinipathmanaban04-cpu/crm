// Brand palette copied from the web CRM (client/tailwind.config.js: brand-50 … brand-700) + Tailwind grays.
export const C = {
  // Teal + coral palette copied from client/tailwind.config.js (matches the Eco Friendly Tech Solutions logo)
  brand50: '#EDFAFA', brand100: '#D0F4F4', brand200: '#A0E8E8', brand300: '#60D5D5', brand400: '#38CACF', brand500: '#23AAA7', brand600: '#1DA4AC',
  brand700: '#085555', // = tailwind brand-800: dark teal used for text/icons on light teal backgrounds
  coral50: '#FFF3F0', coral600: '#FB725D', coral700: '#E66354', hero: '#085555', heroSoft: '#0B6B6B', coral: '#FD7B69', coral100: '#FFE1DA', warn: '#B4402F', warnBg: '#FFE1DA',
  bg: '#F9FAFB', card: '#FFFFFF', border: '#E5E7EB', text: '#111827', sub: '#6B7280', muted: '#9CA3AF',
  green: '#16A34A', greenBg: '#DCFCE7', red: '#DC2626', redBg: '#FEE2E2', blue: '#2563EB', blueBg: '#DBEAFE', amberBg: '#FFE1DA',
};
export const STATUS = {
  New: ['#1D4ED8', '#DBEAFE'], Contacted: ['#4338CA', '#E0E7FF'], Interested: ['#0F766E', '#CCFBF1'], 'Follow-up': ['#A16207', '#FEF3C7'],
  Qualified: ['#7E22CE', '#F3E8FF'], 'Admission in Progress': ['#0E7490', '#CFFAFE'], Converted: ['#15803D', '#DCFCE7'], Lost: ['#B91C1C', '#FEE2E2'],
};
export const PRIORITY = { Low: '#9CA3AF', Medium: '#EAAB08', High: '#DC2626' };
export const LEAD_STATUSES = Object.keys(STATUS);
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const TASK_STATUSES = ['To Do', 'In Progress', 'Completed', 'Cancelled'];
// Same rule as the website's Teams page: card top border alternates teal / coral by position (client LOGO_PALETTE).
export const alt = (i = 0) => (i % 2 === 0 ? '#23AAA7' : '#FD7B69');
export const shadow = { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 };
export const ADMISSION_STATUS = { 'Not Started': ['#4B5563', '#F3F4F6'], 'In Progress': ['#A16207', '#FEF3C7'], Admitted: ['#15803D', '#DCFCE7'], Dropped: ['#B91C1C', '#FEE2E2'] };
export const TONE = {
  Pending: ['#A16207', '#FEF3C7'], Confirmed: ['#15803D', '#DCFCE7'], Cancelled: ['#B91C1C', '#FEE2E2'], Success: ['#15803D', '#DCFCE7'], Failed: ['#B91C1C', '#FEE2E2'], Refunded: ['#7E22CE', '#F3E8FF'],
  Paid: ['#15803D', '#DCFCE7'], 'Partially Paid': ['#0E7490', '#CFFAFE'], Enquiry: ['#1D4ED8', '#DBEAFE'], Counselling: ['#4338CA', '#E0E7FF'], Registered: ['#0F766E', '#CCFBF1'], Enrolled: ['#0E7490', '#CFFAFE'], Completed: ['#15803D', '#DCFCE7'], Dropped: ['#B91C1C', '#FEE2E2'],
  Active: ['#15803D', '#DCFCE7'], Inactive: ['#4B5563', '#F3F4F6'], ...ADMISSION_STATUS,
};
