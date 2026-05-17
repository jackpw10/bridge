import { create } from 'zustand';
import type {
  CardOverride,
  Diagnosis,
  Facility,
  HealthAuthority,
  Notification,
  OverrideReason,
  ProcessSteps,
  ReferenceCard,
  Session,
  SpecialtyService,
  TACard,
  User,
  Workflow,
} from '../types';
import { storage, KEYS } from './storage';
import {
  defaultDiagnoses,
  defaultFacilities,
  defaultHealthAuthorities,
  defaultOverrideReasons,
  defaultProcessSteps,
  defaultReferenceCards,
  defaultSpecialtyServices,
  defaultUsers,
  defaultWorkflow,
} from '../data/defaults';
import { uid } from '../utils/id';

interface AppState {
  users: User[];
  session: Session | null;
  workflow: Workflow;
  facilities: Facility[];
  specialty: SpecialtyService[];
  diagnoses: Diagnosis[];
  processSteps: ProcessSteps;
  overrides: CardOverride[];
  reasons: OverrideReason[];
  refCards: ReferenceCard[];
  notifications: Notification[];
  healthAuthorities: HealthAuthority[];

  // ---------- mutations ----------
  setUsers: (u: User[]) => void;
  setSession: (s: Session | null) => void;

  setWorkflow: (w: Workflow) => void;
  setFacilities: (f: Facility[]) => void;
  setSpecialty: (s: SpecialtyService[]) => void;
  setDiagnoses: (d: Diagnosis[]) => void;
  setProcessSteps: (p: ProcessSteps) => void;
  setOverrides: (o: CardOverride[]) => void;
  setReasons: (r: OverrideReason[]) => void;
  setRefCards: (r: ReferenceCard[]) => void;
  setHealthAuthorities: (h: HealthAuthority[]) => void;

  setNotifications: (n: Notification[]) => void;
  refreshNotificationsFromStorage: () => void;

  resetAll: () => void;
}

function load<T>(key: string, fallback: T): T {
  const v = storage.get<T>(key);
  return v === null ? fallback : v;
}

function persist<T>(key: string, value: T): T {
  storage.set(key, value);
  return value;
}

function initIfNeeded() {
  if (!storage.get(KEYS.initialized)) {
    storage.set(KEYS.users, defaultUsers);
    storage.set(KEYS.workflow, defaultWorkflow);
    storage.set(KEYS.facilities, defaultFacilities);
    storage.set(KEYS.specialty, defaultSpecialtyServices);
    storage.set(KEYS.diagnoses, defaultDiagnoses);
    storage.set(KEYS.processSteps, defaultProcessSteps);
    storage.set(KEYS.overrides, []);
    storage.set(KEYS.reasons, defaultOverrideReasons);
    storage.set(KEYS.refCards, defaultReferenceCards);
    storage.set(KEYS.notifications, []);
    storage.set(KEYS.healthAuthorities, defaultHealthAuthorities);
    storage.set(KEYS.initialized, true);
    storage.set(KEYS.migratedV2, true);
  }
}

function migrateUsers() {
  const raw = storage.get<Array<Partial<User>>>(KEYS.users);
  if (!raw || !Array.isArray(raw)) return;
  let dirty = false;
  const migrated = raw.map((u) => {
    const next: User = {
      id: u.id ?? '',
      username: u.username ?? '',
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      passwordHash: u.passwordHash ?? '',
      role: (u.role === 'admin' ? 'admin' : 'user'),
    };
    if (u.firstName === undefined || u.lastName === undefined) dirty = true;
    return next;
  });
  if (dirty) storage.set(KEYS.users, migrated);
}

// One-time strip of the now-removed `q_notes` workflow question. The notes
// field lives in the in-memory triage state instead.
function migrateRemoveNotesQuestion() {
  const wf = storage.get<Workflow>(KEYS.workflow);
  if (!wf || !Array.isArray(wf.questions)) return;
  const stripped = wf.questions.filter((q) => q.id !== 'q_notes');
  if (stripped.length !== wf.questions.length) {
    storage.set(KEYS.workflow, { questions: stripped });
  }
}

// v2 migration: extract Health Authorities from facility.healthAuthority
// strings into a dedicated entity list, convert facilities to use
// healthAuthorityId, and convert each specialty service's
// transportAdvisor.cardsByHA dictionary into a flat cards[] array.
function migrateV2() {
  if (storage.get(KEYS.migratedV2)) return;

  type LegacyFacility = Omit<Facility, 'healthAuthorityId'> & {
    healthAuthority?: string;
    healthAuthorityId?: string;
  };
  type LegacyTransport = {
    enabled?: boolean;
    cards?: TACard[];
    cardsByHA?: Record<string, { steps: { id: string; text: string }[] }>;
  };
  type LegacyService = Omit<SpecialtyService, 'transportAdvisor'> & {
    transportAdvisor?: LegacyTransport;
  };

  const facilitiesRaw = storage.get<LegacyFacility[]>(KEYS.facilities) ?? [];
  const servicesRaw = storage.get<LegacyService[]>(KEYS.specialty) ?? [];
  const existingHas = storage.get<HealthAuthority[]>(KEYS.healthAuthorities) ?? [];

  // Build HA index: prefer existing, then seed from facility strings.
  const haByName = new Map<string, HealthAuthority>();
  for (const ha of existingHas) haByName.set(ha.name.toLowerCase(), ha);

  for (const f of facilitiesRaw) {
    const nm = (f.healthAuthority ?? '').trim();
    if (nm && !haByName.has(nm.toLowerCase())) {
      haByName.set(nm.toLowerCase(), { id: uid('ha'), name: nm });
    }
  }

  const allHas = Array.from(haByName.values());
  storage.set(KEYS.healthAuthorities, allHas);

  // Rewrite facilities to use healthAuthorityId.
  const migratedFacilities: Facility[] = facilitiesRaw.map((f) => {
    const haId =
      f.healthAuthorityId ??
      (() => {
        const nm = (f.healthAuthority ?? '').trim().toLowerCase();
        return haByName.get(nm)?.id ?? '';
      })();
    const next: Facility = {
      id: f.id,
      name: f.name,
      healthAuthorityId: haId,
      onSiteServiceIds: f.onSiteServiceIds ?? [],
      referralPatterns: f.referralPatterns ?? {},
      notificationRequirements: f.notificationRequirements ?? [],
      serviceNotifs: f.serviceNotifs ?? {},
    };
    return next;
  });
  storage.set(KEYS.facilities, migratedFacilities);

  // Rewrite specialty services: cardsByHA dictionary → cards[] array.
  const migratedServices: SpecialtyService[] = servicesRaw.map((s) => {
    const ta = s.transportAdvisor ?? {};
    const alreadyV2 = Array.isArray(ta.cards);
    let cards: TACard[];
    if (alreadyV2) {
      cards = ta.cards as TACard[];
    } else {
      cards = Object.entries(ta.cardsByHA ?? {}).map(([haName, card]) => {
        const ha = haByName.get(haName.toLowerCase());
        return {
          id: uid('tac'),
          name: ha ? `${ha.name} card` : `${haName} card`,
          llto: true,    // legacy cards weren't version-aware → apply to both
          hloc: true,
          haIds: ha ? [ha.id] : [],
          steps: card.steps ?? [],
        };
      });
    }
    return {
      ...s,
      transportAdvisor: {
        enabled: ta.enabled ?? false,
        cards,
      },
    } as SpecialtyService;
  });
  storage.set(KEYS.specialty, migratedServices);

  storage.set(KEYS.migratedV2, true);
}

// Backfill the new `excludeSvcIds` field on facility notification requirements.
function migrateExcludeSvcIds() {
  type LegacyNr = {
    id: string;
    text: string;
    llto: boolean;
    hloc: boolean;
    svcIds: string[];
    excludeSvcIds?: string[];
  };
  type LegacyFacility = Omit<Facility, 'notificationRequirements'> & {
    notificationRequirements: LegacyNr[];
  };
  const raw = storage.get<LegacyFacility[]>(KEYS.facilities);
  if (!raw || !Array.isArray(raw)) return;
  let dirty = false;
  const migrated: Facility[] = raw.map((f) => ({
    ...f,
    notificationRequirements: f.notificationRequirements.map((nr) => {
      if (nr.excludeSvcIds === undefined) {
        dirty = true;
        return { ...nr, excludeSvcIds: [] };
      }
      return nr as Facility['notificationRequirements'][number];
    }),
  }));
  if (dirty) storage.set(KEYS.facilities, migrated);
}

initIfNeeded();
migrateUsers();
migrateRemoveNotesQuestion();
migrateV2();
migrateExcludeSvcIds();

export const useAppStore = create<AppState>((set) => ({
  users: load<User[]>(KEYS.users, defaultUsers),
  session: load<Session | null>(KEYS.session, null),
  workflow: load<Workflow>(KEYS.workflow, defaultWorkflow),
  facilities: load<Facility[]>(KEYS.facilities, defaultFacilities),
  specialty: load<SpecialtyService[]>(KEYS.specialty, defaultSpecialtyServices),
  diagnoses: load<Diagnosis[]>(KEYS.diagnoses, defaultDiagnoses),
  processSteps: load<ProcessSteps>(KEYS.processSteps, defaultProcessSteps),
  overrides: load<CardOverride[]>(KEYS.overrides, []),
  reasons: load<OverrideReason[]>(KEYS.reasons, defaultOverrideReasons),
  refCards: load<ReferenceCard[]>(KEYS.refCards, defaultReferenceCards),
  notifications: load<Notification[]>(KEYS.notifications, []),
  healthAuthorities: load<HealthAuthority[]>(KEYS.healthAuthorities, defaultHealthAuthorities),

  setUsers: (u) => set({ users: persist(KEYS.users, u) }),
  setSession: (s) => {
    if (s === null) storage.remove(KEYS.session);
    else storage.set(KEYS.session, s);
    set({ session: s });
  },
  setWorkflow: (w) => set({ workflow: persist(KEYS.workflow, w) }),
  setFacilities: (f) => set({ facilities: persist(KEYS.facilities, f) }),
  setSpecialty: (s) => set({ specialty: persist(KEYS.specialty, s) }),
  setDiagnoses: (d) => set({ diagnoses: persist(KEYS.diagnoses, d) }),
  setProcessSteps: (p) => set({ processSteps: persist(KEYS.processSteps, p) }),
  setOverrides: (o) => set({ overrides: persist(KEYS.overrides, o) }),
  setReasons: (r) => set({ reasons: persist(KEYS.reasons, r) }),
  setRefCards: (r) => set({ refCards: persist(KEYS.refCards, r) }),
  setHealthAuthorities: (h) =>
    set({ healthAuthorities: persist(KEYS.healthAuthorities, h) }),

  setNotifications: (n) => set({ notifications: persist(KEYS.notifications, n) }),
  refreshNotificationsFromStorage: () =>
    set({ notifications: load<Notification[]>(KEYS.notifications, []) }),

  resetAll: () => {
    storage.remove(KEYS.initialized);
    storage.remove(KEYS.migratedV2);
    initIfNeeded();
    set({
      users: load<User[]>(KEYS.users, defaultUsers),
      workflow: load<Workflow>(KEYS.workflow, defaultWorkflow),
      facilities: load<Facility[]>(KEYS.facilities, defaultFacilities),
      specialty: load<SpecialtyService[]>(KEYS.specialty, defaultSpecialtyServices),
      diagnoses: load<Diagnosis[]>(KEYS.diagnoses, defaultDiagnoses),
      processSteps: load<ProcessSteps>(KEYS.processSteps, defaultProcessSteps),
      overrides: [],
      reasons: load<OverrideReason[]>(KEYS.reasons, defaultOverrideReasons),
      refCards: load<ReferenceCard[]>(KEYS.refCards, defaultReferenceCards),
      notifications: [],
      healthAuthorities: load<HealthAuthority[]>(KEYS.healthAuthorities, defaultHealthAuthorities),
    });
  },
}));
