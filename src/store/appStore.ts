import { create } from 'zustand';
import type {
  CardOverride,
  Diagnosis,
  Facility,
  HealthAuthority,
  Notification,
  OverrideReason,
  ReferenceCard,
  SpecialtyService,
  Workflow,
} from '../types';
import { supabase } from '../lib/supabase';
import {
  type CardOverrideRow,
  type DiagnosisRow,
  type FacilityRow,
  type LegacyWorkflowRow,
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
  workflowToRow,
  psFromRow,
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
  defaultReferenceCards,
  defaultSpecialtyServices,
  defaultWorkflows,
} from '../data/defaults';
import { uid } from '../utils/id';
import type { AppSession } from '../lib/auth';
import { fetchProfile } from '../lib/auth';

interface AppState {
  session: AppSession | null;
  loading: boolean;
  error: string | null;

  workflows: Workflow[];
  facilities: Facility[];
  specialty: SpecialtyService[];
  diagnoses: Diagnosis[];
  overrides: CardOverride[];
  reasons: OverrideReason[];
  refCards: ReferenceCard[];
  notifications: Notification[];
  healthAuthorities: HealthAuthority[];

  setSession: (s: AppSession | null) => void;

  setWorkflows: (next: Workflow[]) => Promise<void>;
  setFacilities: (next: Facility[]) => Promise<void>;
  setSpecialty: (next: SpecialtyService[]) => Promise<void>;
  setDiagnoses: (next: Diagnosis[]) => Promise<void>;
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

  workflows: [],
  facilities: [],
  specialty: [],
  diagnoses: [],
  overrides: [],
  reasons: [],
  refCards: [],
  notifications: [],
  healthAuthorities: [],

  setSession: (s) => set({ session: s }),

  setWorkflows: async (next) => {
    const prev = get().workflows;
    set({ workflows: next });
    await diffSyncList(
      prev.map((w, i) => workflowToRow(w, i)),
      next.map((w, i) => workflowToRow(w, i)),
      'workflows'
    );
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

// Seed defaults when a fresh DB is detected.
async function seedIfEmpty() {
  // Workflows: if empty, try migrating from legacy singleton tables; otherwise seed defaults.
  const { count: wfCount } = await supabase
    .from('workflows')
    .select('id', { count: 'exact', head: true });
  if ((wfCount ?? 0) === 0) {
    const { data: legacyWf } = await supabase
      .from('workflow')
      .select('*')
      .eq('id', 'main')
      .maybeSingle();
    const { data: legacyPs } = await supabase
      .from('process_steps')
      .select('*')
      .eq('id', 'main')
      .maybeSingle();

    if (legacyWf && (legacyWf as LegacyWorkflowRow).questions) {
      const migrated: Workflow = {
        id: 'wf_high_acuity',
        name: 'High Acuity Workflow',
        questions: ((legacyWf as LegacyWorkflowRow).questions as Workflow['questions']) ?? [],
        postTriage: {
          enabled: true,
          showServicePreQuestions: true,
          questions: [
            {
              id: uid('ptq'),
              type: 'yesno',
              text: 'Was the patient accepted outside of PTN?',
              drivesPtnBucket: true,
            },
          ],
        },
        processSteps: legacyPs
          ? psFromRow(legacyPs as ProcessStepsRow)
          : { lltoNo: [], lltoYes: [], hlocNo: [], hlocYes: [] },
      };
      await supabase.from('workflows').insert(workflowToRow(migrated, 0));
    } else {
      // Fresh DB — seed the default workflows.
      await supabase
        .from('workflows')
        .insert(defaultWorkflows.map((w, i) => workflowToRow(w, i)));
    }
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

export async function loadAllData(): Promise<void> {
  try {
    await seedIfEmpty();
    const [
      { data: wfRows },
      { data: facRows },
      { data: svcRows },
      { data: dxRows },
      { data: ovRows },
      { data: reasonRows },
      { data: refRows },
      { data: haRows },
      { data: notifRows },
    ] = await Promise.all([
      supabase.from('workflows').select('*').order('position'),
      supabase.from('facilities').select('*'),
      supabase.from('specialty_services').select('*'),
      supabase.from('diagnoses').select('*'),
      supabase.from('card_overrides').select('*'),
      supabase.from('override_reasons').select('*'),
      supabase.from('reference_cards').select('*'),
      supabase.from('health_authorities').select('*'),
      supabase.from('notifications').select('*').order('ts', { ascending: false }),
    ]);

    useAppStore.setState({
      workflows: (wfRows as WorkflowRow[] | null ?? []).map(workflowFromRow),
      facilities: (facRows as FacilityRow[] | null ?? []).map(facilityFromRow),
      specialty: (svcRows as SpecialtyServiceRow[] | null ?? []).map(svcFromRow),
      diagnoses: (dxRows as DiagnosisRow[] | null ?? []).map(dxFromRow),
      overrides: (ovRows as CardOverrideRow[] | null ?? []).map(ovFromRow),
      reasons: (reasonRows ?? []).map(reasonFromRow),
      refCards: (refRows as ReferenceCardRow[] | null ?? []).map(refCardFromRow),
      healthAuthorities: (haRows ?? []).map(haFromRow),
      notifications: (notifRows as NotificationRow[] | null ?? []).map(notifFromRow),
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

let unsubscribers: Array<() => void> = [];

export function startRealtime() {
  stopRealtime();

  function refetch(table: string) {
    return async () => {
      const set = useAppStore.setState;
      if (table === 'workflows') {
        const { data } = await supabase.from('workflows').select('*').order('position');
        set({ workflows: (data as WorkflowRow[] | null ?? []).map(workflowFromRow) });
        return;
      }
      const { data } = await supabase.from(table).select('*');
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
    'workflows',
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

  if (data.session?.user) {
    await loadAllData();
    startRealtime();
  } else {
    useAppStore.setState({ loading: false });
  }
}
