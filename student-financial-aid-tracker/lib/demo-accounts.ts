export const DEMO_ACCOUNTS = [
  { email: 'superadmin@demo.local', name: 'Demo Super Admin', role: 'SUPER_ADMIN', label: 'Super Admin' },
  { email: 'working.admin@demo.local', name: 'Demo Working Scholar Admin', role: 'WORKING_SCHOLAR_ADMIN', label: 'Working Scholar Admin' },
  { email: 'academic.admin@demo.local', name: 'Demo Academic Admin', role: 'ACADEMIC_ADMIN', label: 'Academic Admin' },
  { email: 'student@demo.local', name: 'Demo Student', role: 'STUDENT', label: 'Student' },
] as const;

export type DemoRole = (typeof DEMO_ACCOUNTS)[number]['role'];
export type DemoSession = Pick<(typeof DEMO_ACCOUNTS)[number], 'email' | 'name' | 'role'>;
