export type DemoScholarRow = {
  id: string;
  scholar_no: string;
  scholar_type: 'NEW' | 'PREVIOUS';
  participation_status: 'ACTIVE' | 'INACTIVE';
  accepted_at: string;
  activated_at: string | null;
  updated_at: string;
  isDemo: true;
  application: {
    id: string;
    student_number: string;
    student_name: string;
    course: string;
    year_level: number;
    assigned_office: string;
  };
};

export type DemoScholarFilter = 'all' | 'active' | 'inactive' | 'new' | 'previous' | 'fourth_year';

const PROGRAMS = {
  BSBA: 'BSBA — Bachelor of Science in Business Administration',
  BSIT: 'BSIT — Bachelor of Science in Information Technology',
  EDUC: 'EDUC — Education',
} as const;

const OFFICES = ['Library', 'IT Services', 'Student Services', 'Admissions'] as const;

const ROSTER = [
  ['Mira Solenne', 'BSBA', 1, 'NEW', true, '2026-01-12'],
  ['Tomas Vale', 'BSIT', 1, 'NEW', true, '2026-01-15'],
  ['Arielle North', 'EDUC', 1, 'PREVIOUS', false, '2025-08-19'],
  ['Jonas Bellamy', 'BSBA', 1, 'PREVIOUS', true, '2025-08-22'],
  ['Lina Hartwell', 'BSIT', 1, 'NEW', false, '2026-02-03'],
  ['Rafael Wren', 'EDUC', 1, 'NEW', true, '2026-02-06'],
  ['Nadia Rowan', 'BSBA', 1, 'PREVIOUS', false, '2025-01-14'],
  ['Elias Marlowe', 'BSIT', 1, 'NEW', true, '2026-03-02'],
  ['Celia Briar', 'EDUC', 2, 'NEW', true, '2026-01-18'],
  ['Noel Ashby', 'BSBA', 2, 'PREVIOUS', false, '2025-08-26'],
  ['Talia Winslow', 'BSIT', 2, 'NEW', false, '2026-01-21'],
  ['Dario Finch', 'EDUC', 2, 'PREVIOUS', true, '2025-01-20'],
  ['Sera Whitlock', 'BSBA', 2, 'NEW', false, '2026-02-11'],
  ['Micah Everly', 'BSIT', 2, 'PREVIOUS', false, '2025-08-30'],
  ['Anika Lark', 'EDUC', 2, 'NEW', false, '2026-02-15'],
  ['Bennett Cove', 'BSBA', 3, 'PREVIOUS', true, '2025-01-28'],
  ['Inez Calder', 'BSIT', 3, 'NEW', false, '2026-01-25'],
  ['Lucian Meadow', 'EDUC', 3, 'PREVIOUS', false, '2025-09-03'],
  ['Phoebe Arden', 'BSBA', 3, 'NEW', false, '2026-02-19'],
  ['Kieran Dusk', 'BSIT', 3, 'PREVIOUS', false, '2025-02-02'],
  ['Maris Ellery', 'EDUC', 3, 'NEW', false, '2026-03-10'],
  ['Owen Thorne', 'BSBA', 3, 'PREVIOUS', false, '2025-09-07'],
  ['Vera Solace', 'BSIT', 4, 'NEW', false, '2026-01-29'],
  ['Emmett Lake', 'EDUC', 4, 'PREVIOUS', false, '2025-02-08'],
  ['Romy Fielding', 'BSBA', 4, 'NEW', false, '2026-02-24'],
  ['Soren Day', 'BSIT', 4, 'PREVIOUS', false, '2025-09-12'],
  ['Elara Quinn', 'EDUC', 4, 'NEW', false, '2026-03-14'],
  ['Theo Linden', 'BSBA', 4, 'PREVIOUS', false, '2025-02-14'],
  ['Amity Greer', 'BSIT', 5, 'PREVIOUS', false, '2024-08-20'],
  ['Jules Harbor', 'EDUC', 5, 'PREVIOUS', false, '2024-08-27'],
] as const;

export function createDemoScholars(activeCapacity: number): DemoScholarRow[] {
  let activeSlots = Math.max(0, Math.min(10, Math.floor(activeCapacity)));

  return ROSTER.map(([name, program, year, scholarType, activeCandidate, acceptedAt], index) => {
    const sequence = String(index + 1).padStart(3, '0');
    const active = activeCandidate && activeSlots > 0;
    if (active) activeSlots -= 1;
    const acceptedDate = new Date(`${acceptedAt}T12:00:00.000Z`);

    return {
      id: `demo-scholar-${sequence}`,
      scholar_no: `DEMO-WS-${sequence}`,
      scholar_type: scholarType,
      participation_status: active ? 'ACTIVE' : 'INACTIVE',
      accepted_at: acceptedAt,
      activated_at: active ? `${acceptedAt}T12:00:00.000Z` : null,
      updated_at: new Date(acceptedDate.getTime() + 86400000).toISOString(),
      isDemo: true,
      application: {
        id: `demo-application-${sequence}`,
        student_number: `DEMO-STU-${sequence}`,
        student_name: name,
        course: PROGRAMS[program],
        year_level: year,
        assigned_office: OFFICES[index % OFFICES.length],
      },
    };
  });
}

export function filterDemoScholars(rows: DemoScholarRow[], filter: DemoScholarFilter): DemoScholarRow[] {
  return rows.filter((row) => {
    if (filter === 'active') return row.participation_status === 'ACTIVE';
    if (filter === 'inactive') return row.participation_status === 'INACTIVE';
    if (filter === 'new') return row.scholar_type === 'NEW';
    if (filter === 'previous') return row.scholar_type === 'PREVIOUS';
    if (filter === 'fourth_year') return row.application.year_level >= 4;
    return true;
  });
}

export function getDemoScholarCounts(rows: DemoScholarRow[]): Record<DemoScholarFilter, number> {
  return {
    all: rows.length,
    active: filterDemoScholars(rows, 'active').length,
    inactive: filterDemoScholars(rows, 'inactive').length,
    new: filterDemoScholars(rows, 'new').length,
    previous: filterDemoScholars(rows, 'previous').length,
    fourth_year: filterDemoScholars(rows, 'fourth_year').length,
  };
}
