import 'server-only';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_ACCOUNTS, type DemoRole } from '@/lib/demo-accounts';

export type DemoCategory = 'WORKING_SCHOLAR' | 'ACADEMIC';
export type DemoStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED' | 'COMPLETED';
export type DemoDocument = { id: string; name: string; dataUrl: string; mimeType: string };
export type DemoApplication = {
  id: string;
  programId: string;
  category: DemoCategory;
  studentEmail: string;
  studentName: string;
  course: string;
  yearLevel: number;
  status: DemoStatus;
  submittedAt: string;
  documents: DemoDocument[];
  eligibility: string;
};

export type DemoProgram = {
  id: string;
  name: string;
  category: DemoCategory;
  description: string;
  eligibility: string;
  requirements: string[];
  isActive: boolean;
};

export type DemoUser = { email: string; name: string; role: DemoRole; isActive: boolean };
export type DemoSettings = { applicationsOpen: boolean; academicMinGpa: number; notice: string };

const initialPrograms: DemoProgram[] = [
  { id: 'program-ws-001', name: 'Campus Working Scholar', category: 'WORKING_SCHOLAR', description: 'Part-time campus work with tuition assistance.', eligibility: 'Enrolled student; available for 10 hours weekly.', requirements: ['Student ID', 'Current class schedule', 'Personal statement'], isActive: true },
  { id: 'program-ac-001', name: 'Academic Excellence Grant', category: 'ACADEMIC', description: 'Merit-based support for students with strong academic standing.', eligibility: 'Minimum GPA 3.0 and full-time enrollment.', requirements: ['Transcript of records', 'Proof of enrollment', 'Recommendation letter'], isActive: true },
  { id: 'program-ac-002', name: 'STEM Opportunity Scholarship', category: 'ACADEMIC', description: 'Need-aware scholarship for students in science and technology programs.', eligibility: 'Enrolled in a STEM program; household income declaration required.', requirements: ['Transcript of records', 'Income declaration', 'Student ID'], isActive: true },
];

const initialApplications: DemoApplication[] = [
  {
    id: 'demo-ws-001', programId: 'program-ws-001', category: 'WORKING_SCHOLAR', studentEmail: 'student@demo.local',
    studentName: 'Demo Student', course: 'BS Information Technology', yearLevel: 2,
    status: 'UNDER_REVIEW', submittedAt: '2026-10-01', documents: [], eligibility: 'Class schedule verification pending.',
  },
  {
    id: 'demo-ac-001', programId: 'program-ac-001', category: 'ACADEMIC', studentEmail: 'student@demo.local',
    studentName: 'Demo Student', course: 'BS Information Technology', yearLevel: 2,
    status: 'PENDING', submittedAt: '2026-10-03', documents: [], eligibility: 'Transcript received; GPA review pending.',
  },
];

type DemoStore = {
  applications: DemoApplication[];
  programs: DemoProgram[];
  users: DemoUser[];
  settings: DemoSettings;
};

const demoDataDirectory = join(process.cwd(), '.demo-data');
const demoDataPath = join(demoDataDirectory, 'demo-store.json');

function isDemoStore(value: unknown): value is DemoStore {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.applications) || !Array.isArray(candidate.programs)
    || !Array.isArray(candidate.users) || typeof candidate.settings !== 'object'
    || candidate.settings === null) return false;
  const settings = candidate.settings as Record<string, unknown>;
  return candidate.applications.every((item) => typeof item === 'object' && item !== null
      && typeof (item as Record<string, unknown>).id === 'string'
      && Array.isArray((item as Record<string, unknown>).documents))
    && candidate.programs.every((item) => typeof item === 'object' && item !== null
      && typeof (item as Record<string, unknown>).id === 'string'
      && Array.isArray((item as Record<string, unknown>).requirements))
    && candidate.users.every((item) => typeof item === 'object' && item !== null
      && typeof (item as Record<string, unknown>).email === 'string'
      && typeof (item as Record<string, unknown>).isActive === 'boolean')
    && typeof settings.applicationsOpen === 'boolean'
    && typeof settings.academicMinGpa === 'number'
    && typeof settings.notice === 'string';
}

function initialStore(): DemoStore {
  return {
    applications: structuredClone(initialApplications),
    programs: structuredClone(initialPrograms),
    users: DEMO_ACCOUNTS.map(({ email, name, role }) => ({ email, name, role, isActive: true })),
    settings: { applicationsOpen: true, academicMinGpa: 3, notice: 'Applications are open for the current academic year.' },
  };
}

function loadPersistedStore(): DemoStore | null {
  if (process.env.NODE_ENV === 'production' || !existsSync(demoDataPath)) return null;
  const data: unknown = JSON.parse(readFileSync(demoDataPath, 'utf8'));
  if (!isDemoStore(data)) {
    throw new Error(`Local demo data at ${demoDataPath} has an unsupported or invalid format. Remove or repair this demo-only file.`);
  }
  return data;
}

const storeKey = Symbol.for('student-aid-tracker.demo-store');
const root = globalThis as typeof globalThis & { [storeKey]?: DemoStore };
const store = root[storeKey] ?? (root[storeKey] = loadPersistedStore() ?? initialStore());
store.programs ??= initialPrograms;
store.users ??= DEMO_ACCOUNTS.map(({ email, name, role }) => ({ email, name, role, isActive: true }));
store.settings ??= { applicationsOpen: true, academicMinGpa: 3, notice: 'Applications are open for the current academic year.' };
store.applications.forEach((application) => {
  if (!application.programId) application.programId = application.category === 'ACADEMIC' ? 'program-ac-001' : 'program-ws-001';
  if (!application.eligibility) application.eligibility = 'Eligibility review pending.';
});

function persistStore(): void {
  if (process.env.NODE_ENV === 'production') return;
  mkdirSync(demoDataDirectory, { recursive: true });
  const temporaryPath = `${demoDataPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
  renameSync(temporaryPath, demoDataPath);
}

export function canAccessCategory(role: DemoRole, category: DemoCategory): boolean {
  return role === 'SUPER_ADMIN'
    || (role === 'WORKING_SCHOLAR_ADMIN' && category === 'WORKING_SCHOLAR')
    || (role === 'ACADEMIC_ADMIN' && category === 'ACADEMIC');
}

export function getDemoApplications(role: DemoRole, email: string): DemoApplication[] {
  return store.applications.filter((application) => role === 'STUDENT'
    ? application.studentEmail === email
    : canAccessCategory(role, application.category));
}

export function getDemoApplication(id: string): DemoApplication | undefined {
  return store.applications.find((application) => application.id === id);
}

export function createDemoApplication(application: Omit<DemoApplication, 'id' | 'status' | 'submittedAt' | 'documents' | 'eligibility'>): DemoApplication {
  const program = getDemoProgram(application.programId);
  const created: DemoApplication = {
    ...application,
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'PENDING',
    submittedAt: new Date().toISOString().slice(0, 10),
    documents: [],
    eligibility: program?.eligibility ?? 'Eligibility review pending.',
  };
  store.applications.unshift(created);
  persistStore();
  return created;
}

export function updateDemoApplication(id: string, update: (application: DemoApplication) => DemoApplication): DemoApplication | undefined {
  const index = store.applications.findIndex((application) => application.id === id);
  if (index < 0) return undefined;
  store.applications[index] = update(store.applications[index]);
  persistStore();
  return store.applications[index];
}

export function deleteDemoApplication(id: string): boolean {
  const index = store.applications.findIndex((application) => application.id === id);
  if (index < 0) return false;
  store.applications.splice(index, 1);
  persistStore();
  return true;
}

export function getDemoPrograms(role: DemoRole): DemoProgram[] {
  return store.programs.filter((program) => role === 'SUPER_ADMIN'
    || (role === 'STUDENT' ? program.isActive : canAccessCategory(role, program.category)));
}

export function getDemoProgram(id: string): DemoProgram | undefined {
  return store.programs.find((program) => program.id === id);
}

export function createDemoProgram(program: Omit<DemoProgram, 'id'>): DemoProgram {
  const created = { ...program, id: `program-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
  store.programs.unshift(created);
  persistStore();
  return created;
}

export function updateDemoProgram(id: string, update: (program: DemoProgram) => DemoProgram): DemoProgram | undefined {
  const index = store.programs.findIndex((program) => program.id === id);
  if (index < 0) return undefined;
  store.programs[index] = update(store.programs[index]);
  persistStore();
  return store.programs[index];
}

export function deleteDemoProgram(id: string): boolean {
  if (store.applications.some((application) => application.programId === id)) return false;
  const index = store.programs.findIndex((program) => program.id === id);
  if (index < 0) return false;
  store.programs.splice(index, 1);
  persistStore();
  return true;
}

export function getDemoUsers(): DemoUser[] {
  return store.users.map((user) => ({ ...user }));
}

export function setDemoUserActive(email: string, isActive: boolean): DemoUser | undefined {
  const user = store.users.find((item) => item.email === email);
  if (!user) return undefined;
  user.isActive = isActive;
  persistStore();
  return { ...user };
}

export function isDemoUserActive(email: string): boolean {
  return store.users.some((user) => user.email === email && user.isActive);
}

export function getDemoSettings(): DemoSettings {
  return { ...store.settings };
}

export function updateDemoSettings(settings: Partial<DemoSettings>): DemoSettings {
  store.settings = { ...store.settings, ...settings };
  persistStore();
  return getDemoSettings();
}

export function getDemoReport() {
  return {
    totalApplications: store.applications.length,
    pending: store.applications.filter((item) => item.status === 'PENDING' || item.status === 'UNDER_REVIEW').length,
    approved: store.applications.filter((item) => item.status === 'APPROVED' || item.status === 'COMPLETED').length,
    denied: store.applications.filter((item) => item.status === 'DENIED').length,
    byCategory: {
      WORKING_SCHOLAR: store.applications.filter((item) => item.category === 'WORKING_SCHOLAR').length,
      ACADEMIC: store.applications.filter((item) => item.category === 'ACADEMIC').length,
    },
  };
}
