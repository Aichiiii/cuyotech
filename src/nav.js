// Sidebar navigation. Items are shown only when the user's role has the permission,
// so changing role permissions in Admin > Roles & Permissions also changes the menu.
import {
  LayoutDashboard, UserRound, BookOpen, BookOpenCheck, GraduationCap, FileText, ClipboardCheck, Wallet,
  ClipboardList, PenLine, FileCheck2, Banknote, Receipt, Library, ShieldCheck, Users, KeyRound,
  Settings2, ScrollText,
} from 'lucide-react';

export const NAV = [
  { section: null, items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    section: 'Student Portal',
    items: [
      { to: '/student/profile', label: 'My Profile', icon: UserRound, perm: 'portal.access' },
      { to: '/student/subjects', label: 'Subjects', icon: BookOpen, perm: 'portal.access' },
      { to: '/student/grades', label: 'Grades', icon: GraduationCap, perm: 'portal.access' },
      { to: '/student/enrollment', label: 'Enrollment', icon: BookOpenCheck, perm: 'enrollment.submit' },
      { to: '/student/clearance', label: 'Clearance', icon: ClipboardCheck, perm: 'clearance.request' },
      { to: '/student/documents', label: 'Document Requests', icon: FileText, perm: 'documents.request' },
      { to: '/student/payments', label: 'Payments & Receipts', icon: Wallet, perm: 'payments.submit' },
    ],
  },
  {
    section: 'Registrar',
    items: [
      { to: '/registrar/enrollments', label: 'Enrollment Review', icon: ClipboardList, perm: 'enrollment.review' },
      { to: '/registrar/grades', label: 'Grade Encoding', icon: PenLine, perm: 'grades.encode' },
      { to: '/registrar/documents', label: 'Document Requests', icon: FileCheck2, perm: 'documents.review' },
    ],
  },
  {
    section: 'Cashier',
    items: [
      { to: '/cashier/payments', label: 'Payment Verification', icon: Banknote, perm: 'payments.verify' },
      { to: '/cashier/receipts', label: 'Official Receipts', icon: Receipt, perm: 'payments.verify' },
    ],
  },
  {
    section: 'Department',
    items: [
      { to: '/department/courses', label: 'Courses & Offerings', icon: Library, perm: 'courses.manage' },
    ],
  },
  {
    section: 'Clearance',
    items: [{ to: '/clearance', label: 'Office Clearance', icon: ShieldCheck, perm: 'clearance.decide' }],
  },
  {
    section: 'Administration',
    items: [
      { to: '/admin/users', label: 'User Accounts', icon: Users, perm: 'users.manage' },
      { to: '/admin/roles', label: 'Roles & Permissions', icon: KeyRound, perm: 'roles.manage' },
      { to: '/admin/policies', label: 'Service Policies', icon: Settings2, perm: 'policies.manage' },
      { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText, perm: 'audit.view' },
    ],
  },
];

/** Extra titles for pages that are not in the sidebar */
export const PAGE_TITLES = { '/notifications': 'Notifications', '/account': 'Account Security' };
