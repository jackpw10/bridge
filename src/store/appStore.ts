import { create } from 'zustand';
import type {
  CallType,
  CardOverride,
  CardOverridePart,
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
  type ReferenceCardRow,
  type SpecialtyServiceRow,
  type WorkflowRow,
  callTypeFromRow,
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
    await diffSyncList(prev, next, 'call_types');
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
// MIGRATION: convert existing data to the new call-type-based shape.
// Runs once before the initial fetch.
// =========================================================================
async function migrateToCallTypes() {
  // 1) Seed call_types if empty.
  const { count: ctCount } = await supabase
    .from('call_types')
    .select('id', { count: 'exact', head: true });
  if ((ctCount ?? 0) === 0) {
    await supabase.from('call_types').insert(defaultCallTypes);
  }

  // 2) Specialty services: if a row has empty `templates` JSON and has the
  // legacy `template` JSON with llto/hloc keys, copy it across.
  const { data: svcs } = await supabase
    .from('specialty_services')
    .select('id, template, templates');
  for (const s of (svcs ?? []) as Array<{ id: string; template: unknown; templates: unknown }>) {
    const tpls = (s.templates as Record<string, unknown>) ?? {};
    if (Object.keys(tpls).length > 0) continue;
    const legacy = (s.template as { llto?: unknown; hloc?: unknown } | null) ?? null;
    if (!legacy) continue;
    const newTemplates: Record<string, unknown> = {};
    if (legacy.llto) newTemplates['ct_llto'] = legacy.llto;
    if (legacy.hloc) newTemplates['ct_hloc'] = legacy.hloc;
    if (Object.keys(newTemplates).length === 0) continue;
    await supabase
      .from('specialty_services')
      .update({ templates: newTemplates })
      .eq('id', s.id);
  }

  // 3) Card overrides: if `parts` is empty, copy from `llto` + `hloc` columns.
  const { data: ovs } = await supabase
    .from('card_overrides')
    .select('id, llto, hloc, parts');
  for (const o of (ovs ?? []) as Array<{ id: string; llto: unknown; hloc: unknown; parts: unknown }>) {
    const parts = (o.parts as Record<string, unknown>) ?? {};
    if (Object.keys(parts).length > 0) continue;
    const newParts: Record<string, CardOverridePart> = {};
    if (o.llto) newParts['ct_llto'] = o.llto as CardOverridePart;
    if (o.hloc) newParts['ct_hloc'] = o.hloc as CardOverridePart;
    if (Object.keys(newParts).length === 0) continue;
    await supabase
      .from('card_overrides')
      .update({ parts: newParts })
      .eq('id', o.id);
  }

  // 4) Workflows: assign call_type_id if missing. Also strip 'triage' special
  // behavior (the question stays but won't drive versions) and flatten old
  // 4-bucket process steps to a flat list with conditions.
  const { data: wfs } = await supabase
    .from('workflows')
    .select('id, call_type_id, questions, post_triage, process_steps');
  for (const w of (wfs ?? []) as Array<{
    id: string;
    call_type_id: string;
    questions: unknown;
    post_triage: unknown;
    process_steps: unknown;
  }>) {
    let dirty = false;
    const update: Record<string, unknown> = {};

    if (!w.call_type_id) {
      // Default to LLTO if questions include a 'triage' question — that's the
      // most common case (the old "High Acuity Workflow").
      update.call_type_id = 'ct_llto';
      dirty = true;
    }

    // Flatten 4-bucket process steps to a flat array with conditions, but
    // only if process_steps is currently shaped like the old 4-bucket object.
    const ps = w.process_steps as
      | { lltoNo?: unknown[]; lltoYes?: unknown[]; hlocNo?: unknown[]; hlocYes?: unknown[] }
      | unknown[];
    if (!Array.isArray(ps) && ps && typeof ps === 'object') {
      const pt = w.post_triage as { questions?: Array<{ id: string; drivesPtnBucket?: boolean }> } | null;
      const driver = pt?.questions?.find((q) => q.drivesPtnBucket);
      const flat: Array<Record<string, unknown>> = [];
      for (const step of (ps.lltoNo ?? [])) flat.push(step as Record<string, unknown>);
      for (const step of (ps.hlocNo ?? [])) flat.push(step as Record<string, unknown>);
      if (driver) {
        for (const step of (ps.lltoYes ?? [])) {
          flat.push({ ...(step as Record<string, unknown>), condQid: driver.id, condVal: 'Yes' });
        }
        for (const step of (ps.hlocYes ?? [])) {
          flat.push({ ...(step as Record<string, unknown>), condQid: driver.id, condVal: 'Yes' });
        }
      } else {
        for (const step of (ps.lltoYes ?? [])) flat.push(step as Record<string, unknown>);
        for (const step of (ps.hlocYes ?? [])) flat.push(step as Record<string, unknown>);
      }
      update.process_steps = flat;
      dirty = true;
    }

    // Strip drivesPtnBucket from post-triage questions (no longer used).
    const ptObj = w.post_triage as {
      enabled?: boolean;
      showServicePreQuestions?: boolean;
      questions?: Array<{ drivesPtnBucket?: boolean } & Record<string, unknown>>;
    } | null;
    if (ptObj?.questions?.some((q) => q.drivesPtnBucket !== undefined)) {
      update.post_triage = {
        ...ptObj,
        questions: ptObj.questions.map((q) => {
          const copy = { ...q };
          delete copy.drivesPtnBucket;
          return copy;
        }),
      };
      dirty = true;
    }

    if (dirty) {
      await supabase.from('workflows').update(update).eq('id', w.id);
    }
  }

  // 5) Facility notification requirements: convert {llto, hloc} booleans to callTypeIds.
  const { data: facs } = await supabase
    .from('facilities')
    .select('id, notification_requirements');
  for (const f of (facs ?? []) as Array<{ id: string; notification_requirements: unknown }>) {
    const arr = (f.notification_requirements as Array<Record<string, unknown>>) ?? [];
    let mutated = false;
    const next = arr.map((nr) => {
      if (nr.callTypeIds !== undefined) return nr;
      const callTypeIds: string[] = [];
      if (nr.llto === true) callTypeIds.push('ct_llto');
      if (nr.hloc === true) callTypeIds.push('ct_hloc');
      // If both llto+hloc were true, leave callTypeIds as [llto, hloc].
      // If neither, leave empty (i.e. all call types).
      mutated = true;
      const copy: Record<string, unknown> = { ...nr, callTypeIds };
      delete copy.llto;
      delete copy.hloc;
      return copy;
    });
    if (mutated) {
      await supabase
        .from('facilities')
        .update({ notification_requirements: next })
        .eq('id', f.id);
    }
  }

  // 6) Specialty services' transportAdvisor cards: convert llto/hloc booleans to callTypeIds.
  const { data: svcs2 } = await supabase
    .from('specialty_services')
    .select('id, transport_advisor');
  for (const s of (svcs2 ?? []) as Array<{ id: string; transport_advisor: unknown }>) {
    const ta = s.transport_advisor as
      | { enabled?: boolean; cards?: Array<Record<string, unknown>> }
      | null;
    if (!ta?.cards) continue;
    let mutated = false;
    const cards = ta.cards.map((c) => {
      if (c.callTypeIds !== undefined) return c;
      const callTypeIds: string[] = [];
      if (c.llto === true) callTypeIds.push('ct_llto');
      if (c.hloc === true) callTypeIds.push('ct_hloc');
      mutated = true;
      const copy: Record<string, unknown> = { ...c, callTypeIds };
      delete copy.llto;
      delete copy.hloc;
      return copy;
    });
    if (mutated) {
      await supabase
        .from('specialty_services')
        .update({ transport_advisor: { ...ta, cards } })
        .eq('id', s.id);
    }
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
        callTypeId: 'ct_llto',
        questions: ((legacyWf as LegacyWorkflowRow).questions as Workflow['questions']) ?? [],
        postTriage: {
          enabled: true,
          showServicePreQuestions: true,
          questions: [
            {
              id: uid('ptq'),
              type: 'yesno',
              text: 'Was the patient accepted outside of PTN?',
            },
          ],
        },
        processSteps: [],
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
    { table: 'call_types',         defaults: defaultCallTypes,          toRow: (x) => x } as Seedable<unknown>,
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
    await seedIfEmpty();
    await migrateToCallTypes();
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
      callTypes: (ctRows ?? []).map(callTypeFromRow),
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
