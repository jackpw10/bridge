import { create } from 'zustand';
import type {
  CardOverride,
  Diagnosis,
  Facility,
  Notification,
  OverrideReason,
  ProcessSteps,
  ReferenceCard,
  Session,
  SpecialtyService,
  User,
  Workflow,
} from '../types';
import { storage, KEYS } from './storage';
import {
  defaultDiagnoses,
  defaultFacilities,
  defaultOverrideReasons,
  defaultProcessSteps,
  defaultReferenceCards,
  defaultSpecialtyServices,
  defaultUsers,
  defaultWorkflow,
} from '../data/defaults';

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
    storage.set(KEYS.initialized, true);
  }
}

initIfNeeded();

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

  setNotifications: (n) => set({ notifications: persist(KEYS.notifications, n) }),
  refreshNotificationsFromStorage: () =>
    set({ notifications: load<Notification[]>(KEYS.notifications, []) }),

  resetAll: () => {
    storage.remove(KEYS.initialized);
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
    });
  },
}));
