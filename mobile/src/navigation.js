import { StackActions, createNavigationContainerRef } from '@react-navigation/native';

export const navRef = createNavigationContainerRef();

export { NAV_ITEMS } from './navItems';
// Routes that sit on top of the tab navigator (so the drawer must pop / replace them instead of stacking).
const PUSHED = ['MyTasks', 'Customers', 'Admissions', 'Payments', 'Performance', 'CustomerDetail', 'LeadDetail'];
export const activeNavKey = (name) => (name === 'CustomerDetail' ? 'Customers' : name === 'LeadDetail' ? 'Leads' : name);

export function goTo(item) {
  if (!navRef.isReady()) return;
  const cur = navRef.getCurrentRoute()?.name; const onTop = PUSHED.includes(cur);
  if (item.tab) { if (onTop) navRef.dispatch(StackActions.popTo('Main', { screen: item.tab })); else navRef.navigate('Main', { screen: item.tab }); return; }
  if (cur === item.route) return;
  if (onTop) navRef.dispatch(StackActions.replace(item.route)); else navRef.navigate(item.route);
}
