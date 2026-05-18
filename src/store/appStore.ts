import { create } from 'zustand';
import type {
  CallType,
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
  type CallTypeRow,
  type CardOverrideRow,
  type DiagnosisRow,
  type FacilityRow,
  type LegacyWorkflowRow,
  type NotificationRow,
  type ReferenceCardRow,
  type SpecialtyServiceRow,
  type WorkflowRow,
  callTypeFromRow,
  callTypeToRow,
  facilityFromRow,
  facilityToRow,
  svcFromRow,
  svcToRow,
  dxFromRow,
  dxToRow,
  workflowFromRow,
  workflowToRow,
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
  defaultCallTypes,
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

  callTypes: CallType[];
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

  setCallTypes: (next: CallType[]) => Promise<void>;
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

  callTypes: [],
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

  setCallTypes: async (next) => {
    const prev = get().callTypes;
    set({ callTypes: next });
    await diffSyncList(prev.map(callTypeToRow), next.map(callTypeToRow), 'call_types');
  },
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
    await diffSyncList(prev.map(facilityToRow), next.map(facilityToRow), 'facilities');
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

// =========================================================================
// MIGRATION v4: expand sub-versions on High Acuity / Repate to encode the
// PTN dimension; replace per-workflow subVersionResolver with
// subVersionRules; reshape workflow.processSteps from a flat array to a
// Record keyed by sub-version. Wipes process step content (user chose
// fresh templates earlier; consistent here).
// Detection key: whether High Acuity has sub-version `llto_std`.
// =========================================================================
async function migrateV4() {
  // Re-fetch call types each time — they may have just been seeded.
  const { data: ctRows } = await supabase.from('call_types').select('id, sub_versions');
  const haRow = (ctRows ?? []).find((r) => r.id === 'ct_high_acuity') as
    | { id: string; sub_versions: unknown }
    | undefined;
  const haSubVersions = (haRow?.sub_versions as Array<{ id: string }>) ?? [];
  if (haSubVersions.some((s) => s.id === 'llto_std')) return; // already v4

  // 1) Replace call_types with the new defaults (4 subs on High Acuity etc.).
  await supabase.from('call_types').delete().neq('id', '__none__');
  await supabase.from('call_types').insert(defaultCallTypes.map(callTypeToRow));

  // 2) Wipe service template content (sub-version IDs changed).
  const { data: svcs } = await supabase.from('specialty_services').select('id, transport_advisor');
  for (const s of (svcs ?? []) as Array<{ id: string; transport_advisor: unknown }>) {
    const ta = (s.transport_advisor as { enabled?: boolean; cards?: Array<Record<string, unknown>> } | null) ?? null;
    const cards = (ta?.cards ?? []).map((c) => ({ ...c, callTypeIds: [] }));
    await supabase
      .from('specialty_services')
      .update({ templates: {}, transport_advisor: { enabled: ta?.enabled ?? false, cards } })
      .eq('id', s.id);
  }

  // 3) Wipe card overrides (sub-version IDs changed).
  await supabase.from('card_overrides').delete().neq('id', '__none__');

  // 4) Migrate workflows: convert sub_version_resolver → sub_version_rules;
  // wipe process_steps to {} since old format is incompatible.
  const { data: wfs } = await supabase
    .from('workflows')
    .select('id, call_type_id, sub_version_resolver');
  for (const w of (wfs ?? []) as Array<{
    id: string;
    call_type_id: string;
    sub_version_resolver: unknown;
  }>) {
    const update: Record<string, unknown> = {
      sub_version_rules: {},
      process_steps: {},
    };
    // Detect High Acuity (had LLTO/HLOC resolver). If the existing
    // resolver maps Yes→llto / No→hloc, we can't safely auto-wire the new
    // 4-sub-version rules (need PTN question id). Just clear and let the
    // admin re-configure.
    update.sub_version_resolver = null;
    await supabase.from('workflows').update(update).eq('id', w.id);
  }
}

// =========================================================================
// MIGRATION v3: rewrite call types to be workflow-types (High Acuity etc.),
// each with optional sub-versions (e.g. High Acuity has LLTO/HLOC). Service
// templates become nested by (callType, subVersion). Per the user's call,
// service-template CONTENT is wiped — admins repopulate via the UI.
// Runs idempotently: detection key is whether `ct_high_acuity` exists.
// =========================================================================
async function migrateV3() {
  const { data: existingHighAcuity } = await supabase
    .from('call_types')
    .select('id')
    .eq('id', 'ct_high_acuity')
    .maybeSingle();
  if (existingHighAcuity) return; // already migrated

  // 1) Replace call_types with the new defaults.
  await supabase.from('call_types').delete().neq('id', '__none__');
  await supabase.from('call_types').insert(defaultCallTypes.map(callTypeToRow));

  // 2) Wipe service template content. (transportAdvisor cards keep config
  //    but their callTypeIds get cleared since those referenced the old IDs.)
  const { data: svcs } = await supabase.from('specialty_services').select('id, transport_advisor');
  for (const s of (svcs ?? []) as Array<{ id: string; transport_advisor: unknown }>) {
    const ta = (s.transport_advisor as { enabled?: boolean; cards?: Array<Record<string, unknown>> } | null) ?? null;
    const cards = (ta?.cards ?? []).map((c) => ({ ...c, callTypeIds: [] }));
    await supabase
      .from('specialty_services')
      .update({ templates: {}, transport_advisor: { enabled: ta?.enabled ?? false, cards } })
      .eq('id', s.id);
  }

  // 3) Wipe card overrides — they referenced the old call type IDs.
  await supabase.from('card_overrides').delete().neq('id', '__none__');

  // 4) Migrate workflows.
  const { data: wfs } = await supabase
    .from('workflows')
    .select('id, name, call_type_id, questions, post_triage, process_steps');
  for (const w of (wfs ?? []) as Array<{
    id: string;
    name: string;
    call_type_id: string;
    questions: unknown;
    post_triage: unknown;
    process_steps: unknown;
  }>) {
    const questions = ((w.questions as Array<Record<string, unknown>>) ?? []).map((q) => {
      if (q.type === 'triage') return { ...q, type: 'yesno' };
      return q;
    }) as unknown as Workflow['questions'];

    // Try to detect a triage question (yes/no with LLTO/HLOC in text) for the resolver.
    const triageQ = (questions as unknown as Array<Record<string, unknown>>).find(
      (q) =>
        q.type === 'yesno' &&
        typeof q.text === 'string' &&
        /llto|hloc/i.test(q.text as string)
    );

    // Pick a new call type. Default to ct_high_acuity since the existing
    // workflow was the High Acuity Workflow.
    const callTypeId = 'ct_high_acuity';

    void triageQ;

    // Wrap post_triage in the new union shape (questions mode).
    const ptObj = (w.post_triage as { enabled?: boolean; showServicePreQuestions?: boolean; questions?: unknown[] } | null) ?? null;
    const post_triage = ptObj?.enabled
      ? {
          mode: 'questions',
          showServicePreQuestions: !!ptObj.showServicePreQuestions,
          questions: ptObj.questions ?? [],
        }
      : { mode: 'none' };

    await supabase
      .from('workflows')
      .update({
        call_type_id: callTypeId,
        questions,
        post_triage,
        process_steps: {},
        sub_version_rules: {},
      })
      .eq('id', w.id);
  }

  // 5) Facility notification requirements: clear callTypeIds (old IDs are gone).
  const { data: facs } = await supabase
    .from('facilities')
    .select('id, notification_requirements');
  for (const f of (facs ?? []) as Array<{ id: string; notification_requirements: unknown }>) {
    const arr = (f.notification_requirements as Array<Record<string, unknown>>) ?? [];
    const next = arr.map((nr) => ({ ...nr, callTypeIds: [] }));
    await supabase
      .from('facilities')
      .update({ notification_requirements: next })
      .eq('id', f.id);
  }
}

async function seedIfEmpty() {
  // Workflows: if empty, look for legacy data first; otherwise seed defaults.
  const { count: wfCount } = await supabase
    .from('workflows')
    .select('id', { count: 'exact', head: true });
  if ((wfCount ?? 0) === 0) {
    const { data: legacyWf } = await supabase
      .from('workflow')
      .select('*')
      .eq('id', 'main')
      .maybeSingle();
    if (legacyWf && (legacyWf as LegacyWorkflowRow).questions) {
      const wf: Workflow = {
        id: 'wf_high_acuity',
        name: 'High Acuity Workflow',
        callTypeId: 'ct_high_acuity',
        subVersionRules: {},
        questions: ((legacyWf as LegacyWorkflowRow).questions as Workflow['questions']) ?? [],
        postTriage: {
          mode: 'questions',
          showServicePreQuestions: true,
          questions: [
            {
              id: uid('ptq'),
              type: 'yesno',
              text: 'Was the patient accepted outside of PTN?',
            },
          ],
        },
        processSteps: {},
      };
      await supabase.from('workflows').insert(workflowToRow(wf, 0));
    } else {
      await supabase
        .from('workflows')
        .insert(defaultWorkflows.map((w, i) => workflowToRow(w, i)));
    }
  }

  type Seedable<T> = {
    table: string;
    defaults: T[];
    toRow: (item: T) => unknown;
  };
  const seeds: Seedable<unknown>[] = [
    { table: 'call_types',         defaults: defaultCallTypes,          toRow: (x) => callTypeToRow(x as CallType) } as Seedable<unknown>,
    { table: 'health_authorities', defaults: defaultHealthAuthorities,  toRow: (x) => x } as Seedable<unknown>,
    { table: 'specialty_services', defaults: defaultSpecialtyServices,  toRow: (x) => svcToRow(x as SpecialtyService) } as Seedable<unknown>,
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
    await migrateV3();
    await migrateV4();
    await seedIfEmpty();
    const [
      { data: ctRows },
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
      supabase.from('call_types').select('*'),
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
      callTypes: ((ctRows ?? []) as CallTypeRow[]).map(callTypeFromRow),
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
        case 'call_types':
          set({ callTypes: safeRows.map(callTypeFromRow) });
          break;
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
    'call_types',
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
