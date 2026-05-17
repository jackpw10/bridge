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
  SpecialtyService,
  Workflow,
} from '../types';
import { supabase } from '../lib/supabase';
import {
  type CardOverrideRow,
  type DiagnosisRow,
  type FacilityRow,
  type NotificationRow,
  type ProcessStepsRow,
  type ReferenceCardRow,
  type SpecialtyServiceRow,
  type WorkflowRow,
  facilityFromRow,
  facilityToRow,
  svcFromRow,
  svcToRow,
  dxFromRow,
  dxToRow,
  workflowFromRow,
  psFromRow,
  psToRow,
  ovFromRow,
  ovToRow,
  haFromRow,
  reasonFromRow,
  refCardFromRow,
  refCardToRow,
  notifFromRow,
  notifToRow,
} from '../lib/dbMappers';
import {
  defaultDiagnoses,
  defaultFacilities,
  defaultHealthAuthorities,
  defaultOverrideReasons,
  defaultProcessSteps,
  defaultReferenceCards,
  defaultSpecialtyServices,
  defaultWorkflow,
} from '../data/defaults';
import type { AppSession } from '../lib/auth';
import { fetchProfile } from '../lib/auth';

interface AppState {
  session: AppSession | null;
  loading: boolean;
  error: string | null;

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

  setSession: (s: AppSession | null) => void;

  setWorkflow: (w: Workflow) => Promise<void>;
  setFacilities: (next: Facility[]) => Promise<void>;
  setSpecialty: (next: SpecialtyService[]) => Promise<void>;
  setDiagnoses: (next: Diagnosis[]) => Promise<void>;
  setProcessSteps: (p: ProcessSteps) => Promise<void>;
  setOverrides: (next: CardOverride[]) => Promise<void>;
  setReasons: (next: OverrideReason[]) => Promise<void>;
  setRefCards: (next: ReferenceCard[]) => Promise<void>;
  setHealthAuthorities: (next: HealthAuthority[]) => Promise<void>;

  setNotifications: (next: Notification[]) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  loading: true,
  error: null,

  workflow: { questions: [] },
  facilities: [],
  specialty: [],
  diagnoses: [],
  processSteps: { lltoNo: [], lltoYes: [], hlocNo: [], hlocYes: [] },
  overrides: [],
  reasons: [],
  refCards: [],
  notifications: [],
  healthAuthorities: [],

  setSession: (s) => set({ session: s }),

  // ---------- Diff-based writers (insert new, update changed, delete missing) ----------
  setWorkflow: async (w) => {
    set({ workflow: w });
    await supabase.from('workflow').upsert({ id: 'main', questions: w.questions });
  },
  setProcessSteps: async (p) => {
    set({ processSteps: p });
    await supabase.from('process_steps').upsert({ id: 'main', ...psToRow(p) });
  },
  setFacilities: async (next) => {
    const prev = get().facilities;
    set({ facilities: next });
    await diffSyncList(
      prev.map(facilityToRow),
      next.map(facilityToRow),
      'facilities'
    );
  },
  setSpecialty: async (next) => {
    const prev = get().specialty;
    set({ specialty: next });
    await diffSyncList(prev.map(svcToRow), next.map(svcToRow), 'specialty_services');
  },
  setDiagnoses: async (next) => {
    const prev = get().diagnoses;
    set({ diagnoses: next });
    await diffSyncList(prev.map(dxToRow), next.map(dxToRow), 'diagnoses');
  },
  setOverrides: async (next) => {
    const prev = get().overrides;
    set({ overrides: next });
    await diffSyncList(prev.map(ovToRow), next.map(ovToRow), 'card_overrides');
  },
  setReasons: async (next) => {
    const prev = get().reasons;
    set({ reasons: next });
    await diffSyncList(prev, next, 'override_reasons');
  },
  setRefCards: async (next) => {
    const prev = get().refCards;
    set({ refCards: next });
    await diffSyncList(prev.map(refCardToRow), next.map(refCardToRow), 'reference_cards');
  },
  setHealthAuthorities: async (next) => {
    const prev = get().healthAuthorities;
    set({ healthAuthorities: next });
    await diffSyncList(prev, next, 'health_authorities');
  },

  setNotifications: async (next) => {
    const prev = get().notifications;
    set({ notifications: next });
    await diffSyncList(prev.map(notifToRow), next.map(notifToRow), 'notifications');
  },
}));

// Generic "diff sync" for tables with text PK `id`.
// - Inserts rows present in next but not prev
// - Upserts rows present in both whose contents differ
// - Deletes rows present in prev but not next
async function diffSyncList<R extends { id: string }>(
  prev: R[],
  next: R[],
  table: string
) {
  const prevById = new Map(prev.map((r) => [r.id, r] as const));
  const nextById = new Map(next.map((r) => [r.id, r] as const));

  const toUpsert: R[] = [];
  for (const [id, nextRow] of nextById) {
    const prevRow = prevById.get(id);
    if (!prevRow || JSON.stringify(prevRow) !== JSON.stringify(nextRow)) {
      toUpsert.push(nextRow);
    }
  }
  const toDelete: string[] = [];
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) toDelete.push(id);
  }

  if (toUpsert.length) {
    const { error } = await supabase.from(table).upsert(toUpsert);
    if (error) console.error(`upsert ${table}`, error);
  }
  if (toDelete.length) {
    const { error } = await supabase.from(table).delete().in('id', toDelete);
    if (error) console.error(`delete ${table}`, error);
  }
}

// ---------- Seeding (called once if a fresh DB is detected) ----------
async function seedIfEmpty() {
  // Workflow + ProcessSteps are singletons — seed if missing.
  const [{ data: wfRow }, { data: psRow }] = await Promise.all([
    supabase.from('workflow').select('id').eq('id', 'main').maybeSingle(),
    supabase.from('process_steps').select('id').eq('id', 'main').maybeSingle(),
  ]);
  if (!wfRow) {
    await supabase.from('workflow').insert({ id: 'main', questions: defaultWorkflow.questions });
  }
  if (!psRow) {
    await supabase
      .from('process_steps')
      .insert({ id: 'main', ...psToRow(defaultProcessSteps) });
  }

  // List tables — seed if empty.
  type Seedable<T> = {
    table: string;
    defaults: T[];
    toRow: (item: T) => unknown;
  };
  const seeds: Seedable<unknown>[] = [
    { table: 'health_authorities', defaults: defaultHealthAuthorities, toRow: (x) => x } as Seedable<unknown>,
    { table: 'specialty_services', defaults: defaultSpecialtyServices, toRow: (x) => svcToRow(x as SpecialtyService) } as Seedable<unknown>,
    { table: 'facilities',         defaults: defaultFacilities,         toRow: (x) => facilityToRow(x as Facility) } as Seedable<unknown>,
    { table: 'diagnoses',          defaults: defaultDiagnoses,          toRow: (x) => dxToRow(x as Diagnosis) } as Seedable<unknown>,
    { table: 'override_reasons',   defaults: defaultOverrideReasons,    toRow: (x) => x } as Seedable<unknown>,
    { table: 'reference_cards',    defaults: defaultReferenceCards,     toRow: (x) => refCardToRow(x as ReferenceCard) } as Seedable<unknown>,
  ];

  for (const s of seeds) {
    const { count, error } = await supabase
      .from(s.table)
      .select('id', { count: 'exact', head: true });
    if (error) {
      console.error(`count ${s.table}`, error);
      continue;
    }
    if ((count ?? 0) === 0 && s.defaults.length > 0) {
      const rows = s.defaults.map(s.toRow);
      const { error: insErr } = await supabase.from(s.table).insert(rows);
      if (insErr) console.error(`seed ${s.table}`, insErr);
    }
  }
}

// ---------- Initial load of all entities ----------
export async function loadAllData(): Promise<void> {
  try {
    await seedIfEmpty();
    const [
      { data: facRows },
      { data: svcRows },
      { data: dxRows },
      { data: ovRows },
      { data: reasonRows },
      { data: refRows },
      { data: haRows },
      { data: notifRows },
      { data: wfRow },
      { data: psRow },
    ] = await Promise.all([
      supabase.from('facilities').select('*'),
      supabase.from('specialty_services').select('*'),
      supabase.from('diagnoses').select('*'),
      supabase.from('card_overrides').select('*'),
      supabase.from('override_reasons').select('*'),
      supabase.from('reference_cards').select('*'),
      supabase.from('health_authorities').select('*'),
      supabase.from('notifications').select('*').order('ts', { ascending: false }),
      supabase.from('workflow').select('*').eq('id', 'main').maybeSingle(),
      supabase.from('process_steps').select('*').eq('id', 'main').maybeSingle(),
    ]);

    useAppStore.setState({
      facilities: (facRows as FacilityRow[] | null ?? []).map(facilityFromRow),
      specialty: (svcRows as SpecialtyServiceRow[] | null ?? []).map(svcFromRow),
      diagnoses: (dxRows as DiagnosisRow[] | null ?? []).map(dxFromRow),
      overrides: (ovRows as CardOverrideRow[] | null ?? []).map(ovFromRow),
      reasons: (reasonRows ?? []).map(reasonFromRow),
      refCards: (refRows as ReferenceCardRow[] | null ?? []).map(refCardFromRow),
      healthAuthorities: (haRows ?? []).map(haFromRow),
      notifications: (notifRows as NotificationRow[] | null ?? []).map(notifFromRow),
      workflow: wfRow ? workflowFromRow(wfRow as WorkflowRow) : { questions: [] },
      processSteps: psRow
        ? psFromRow(psRow as ProcessStepsRow)
        : { lltoNo: [], lltoYes: [], hlocNo: [], hlocYes: [] },
      loading: false,
      error: null,
    });
  } catch (e) {
    useAppStore.setState({
      loading: false,
      error: (e as Error).message ?? 'Failed to load data',
    });
  }
}

// ---------- Realtime subscriptions ----------
// For each list table, we just re-fetch the table when any change is observed.
// Simpler than diffing single-row payloads, and fine at this scale.
let unsubscribers: Array<() => void> = [];

export function startRealtime() {
  stopRealtime();

  function refetch(table: string) {
    return async () => {
      const { data } = await supabase.from(table).select('*');
      const set = useAppStore.setState;
      const safeRows = data ?? [];
      switch (table) {
        case 'facilities':
          set({ facilities: (safeRows as FacilityRow[]).map(facilityFromRow) });
          break;
        case 'specialty_services':
          set({ specialty: (safeRows as SpecialtyServiceRow[]).map(svcFromRow) });
          break;
        case 'diagnoses':
          set({ diagnoses: (safeRows as DiagnosisRow[]).map(dxFromRow) });
          break;
        case 'card_overrides':
          set({ overrides: (safeRows as CardOverrideRow[]).map(ovFromRow) });
          break;
        case 'override_reasons':
          set({ reasons: safeRows.map(reasonFromRow) });
          break;
        case 'reference_cards':
          set({ refCards: (safeRows as ReferenceCardRow[]).map(refCardFromRow) });
          break;
        case 'health_authorities':
          set({ healthAuthorities: safeRows.map(haFromRow) });
          break;
      }
    };
  }

  const tables = [
    'facilities',
    'specialty_services',
    'diagnoses',
    'card_overrides',
    'override_reasons',
    'reference_cards',
    'health_authorities',
  ];

  for (const t of tables) {
    const channel = supabase
      .channel(`realtime_${t}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: t },
        refetch(t)
      )
      .subscribe();
    unsubscribers.push(() => {
      supabase.removeChannel(channel);
    });
  }

  // Singletons
  const wfChannel = supabase
    .channel('realtime_workflow')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow' }, async () => {
      const { data } = await supabase.from('workflow').select('*').eq('id', 'main').maybeSingle();
      if (data) useAppStore.setState({ workflow: workflowFromRow(data as WorkflowRow) });
    })
    .subscribe();
  unsubscribers.push(() => supabase.removeChannel(wfChannel));

  const psChannel = supabase
    .channel('realtime_process_steps')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'process_steps' }, async () => {
      const { data } = await supabase.from('process_steps').select('*').eq('id', 'main').maybeSingle();
      if (data) useAppStore.setState({ processSteps: psFromRow(data as ProcessStepsRow) });
    })
    .subscribe();
  unsubscribers.push(() => supabase.removeChannel(psChannel));

  // Notifications — also realtime; reusing the same poll-replacement.
  const notifChannel = supabase
    .channel('realtime_notifications')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      async () => {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .order('ts', { ascending: false });
        useAppStore.setState({
          notifications: (data as NotificationRow[] | null ?? []).map(notifFromRow),
        });
      }
    )
    .subscribe();
  unsubscribers.push(() => supabase.removeChannel(notifChannel));
}

export function stopRealtime() {
  for (const u of unsubscribers) u();
  unsubscribers = [];
}

// ---------- Auth bootstrap ----------
let authInitialized = false;

export async function initAuth() {
  if (authInitialized) return;
  authInitialized = true;

  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    const profile = await fetchProfile(data.session.user.id);
    useAppStore.setState({ session: profile });
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      useAppStore.setState({ session: null });
      stopRealtime();
      return;
    }
    const profile = await fetchProfile(session.user.id);
    useAppStore.setState({ session: profile });
    if (profile) {
      await loadAllData();
      startRealtime();
    }
  });

  // If a session is already present from page load, also load data + start realtime.
  if (data.session?.user) {
    await loadAllData();
    startRealtime();
  } else {
    // Nothing to load, but we're done initializing.
    useAppStore.setState({ loading: false });
  }
}
