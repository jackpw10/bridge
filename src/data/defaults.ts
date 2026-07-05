import type {
  CallType,
  Diagnosis,
  Facility,
  HealthAuthority,
  OverrideReason,
  ReferenceCard,
  SpecialtyService,
  Workflow,
} from '../types';

// All IDs below are static so cross-references survive a reset.

// One code letter per call type.
export const defaultCallTypes: CallType[] = [
  { id: 'ct_high_acuity', name: 'High Acuity', letter: 'A' },
  { id: 'ct_advice', name: 'Advice', letter: 'B' },
  { id: 'ct_repate', name: 'Repate', letter: 'C' },
  { id: 'ct_scheduled', name: 'Scheduled', letter: 'D' },
  { id: 'ct_discharge', name: 'Discharge', letter: 'E' },
];

export const defaultHealthAuthorities: HealthAuthority[] = [
  { id: 'ha_vch', name: 'VCH' },
  { id: 'ha_fh', name: 'Fraser Health' },
];

export const defaultWorkflows: Workflow[] = [
  // -------- High Acuity --------
  {
    id: 'wf_high_acuity',
    name: 'High Acuity',
    callTypeId: 'ct_high_acuity',
    questions: [
      { id: 'wfq_ha_sending', type: 'facility', text: 'Sending facility' },
      { id: 'wfq_ha_dx', type: 'diagnosis_multi', text: 'Working / suspected diagnoses' },
      { id: 'wfq_ha_svc', type: 'specialty_multi', text: 'Which specialty service(s) are required?' },
      { id: 'wfq_ha_referral', type: 'referral_resolve', text: 'Confirm receiving facility' },
    ],
    processSteps: [],
  },

  // -------- Advice --------
  {
    id: 'wf_advice',
    name: 'Advice',
    callTypeId: 'ct_advice',
    questions: [
      { id: 'wfq_adv_sending', type: 'facility', text: 'Sending facility' },
      { id: 'wfq_adv_dx', type: 'diagnosis_multi', text: 'Working / suspected diagnoses' },
      { id: 'wfq_adv_svc', type: 'specialty_multi', text: 'Which specialty service(s) are required?' },
      { id: 'wfq_adv_referral', type: 'referral_resolve', text: 'Confirm receiving facility' },
    ],
    processSteps: [],
  },

  // -------- Repate --------
  {
    id: 'wf_repate',
    name: 'Repate',
    callTypeId: 'ct_repate',
    questions: [
      { id: 'wfq_rep_sending', type: 'facility', text: 'Sending facility' },
      { id: 'wfq_rep_dx', type: 'diagnosis_multi', text: 'Working / suspected diagnoses' },
      { id: 'wfq_rep_svc', type: 'specialty_multi', text: 'Which specialty service(s) are required?' },
      { id: 'wfq_rep_receiving', type: 'receiving_facility', text: 'Receiving facility' },
    ],
    processSteps: [],
  },

  // -------- Scheduled --------
  {
    id: 'wf_scheduled',
    name: 'Scheduled',
    callTypeId: 'ct_scheduled',
    questions: [
      { id: 'wfq_sch_sending', type: 'facility', text: 'Sending facility (or address)', allowFreeText: true },
      { id: 'wfq_sch_dx', type: 'diagnosis_multi', text: 'Working / suspected diagnoses' },
      { id: 'wfq_sch_svc', type: 'specialty_multi', text: 'Which specialty service(s) are required?' },
      { id: 'wfq_sch_receiving', type: 'receiving_facility', text: 'Receiving facility (or address)', allowFreeText: true },
    ],
    processSteps: [],
  },

  // -------- Discharge --------
  {
    id: 'wf_discharge',
    name: 'Discharge',
    callTypeId: 'ct_discharge',
    questions: [
      { id: 'wfq_dis_sending', type: 'facility', text: 'Sending facility (or address)', allowFreeText: true },
      { id: 'wfq_dis_dx', type: 'diagnosis_multi', text: 'Working / suspected diagnoses' },
      { id: 'wfq_dis_svc', type: 'specialty_multi', text: 'Which specialty service(s) are required?' },
      { id: 'wfq_dis_receiving', type: 'receiving_facility', text: 'Receiving facility (or address)', allowFreeText: true },
    ],
    processSteps: [],
  },
];

// Services start enabled for the acute-style workflows.
const defaultEnabledCallTypeIds = ['ct_high_acuity', 'ct_advice', 'ct_repate'];

// Service numbers: alphabetical order (Cardiology = 1, Neurology = 2).
export const defaultSpecialtyServices: SpecialtyService[] = [
  {
    id: 'svc_card',
    name: 'Cardiology',
    number: 1,
    templates: {},
    transportAdvisor: { enabled: false, cards: [] },
    enabledCallTypeIds: [...defaultEnabledCallTypeIds],
  },
  {
    id: 'svc_neuro',
    name: 'Neurology',
    number: 2,
    templates: {},
    transportAdvisor: { enabled: false, cards: [] },
    enabledCallTypeIds: [...defaultEnabledCallTypeIds],
  },
];

// Facility codes: alphabetical order from 100 (Richmond 100, Surrey 101,
// Vancouver 102).
export const defaultFacilities: Facility[] = [
  {
    id: 'f_general',
    name: 'Vancouver General',
    abbreviation: 'VGH',
    code: '102',
    healthAuthorityId: 'ha_vch',
    onSiteServiceIds: ['svc_card', 'svc_neuro'],
    referralPatterns: {},
    notificationRequirements: [
      {
        id: 'nr_vgh_1',
        text: 'Notify Transfer Center at extension 2200',
        callTypeIds: [],
        svcIds: [],
        excludeSvcIds: [],
      },
    ],
    serviceNotifs: {},
  },
  {
    id: 'f_richmond',
    name: 'Richmond Regional',
    abbreviation: 'RR',
    code: '100',
    healthAuthorityId: 'ha_vch',
    onSiteServiceIds: ['svc_card'],
    referralPatterns: {
      svc_card: { d1: 'f_general', d2: '', d3: '' },
      svc_neuro: { d1: 'f_general', d2: '', d3: '' },
    },
    notificationRequirements: [],
    serviceNotifs: {},
  },
  {
    id: 'f_surrey',
    name: 'Surrey Memorial',
    abbreviation: 'SMH',
    code: '101',
    healthAuthorityId: 'ha_fh',
    onSiteServiceIds: ['svc_card', 'svc_neuro'],
    referralPatterns: {},
    notificationRequirements: [],
    serviceNotifs: {},
  },
];

export const defaultDiagnoses: Diagnosis[] = [
  {
    id: 'dx_stemi',
    text: 'STEMI',
    notifEnabled: true,
    notifMessage: 'STEMI transfer in progress — confirm cath lab readiness.',
  },
  {
    id: 'dx_stroke',
    text: 'Acute ischemic stroke',
    notifEnabled: true,
    notifMessage: 'Stroke transfer — confirm thrombolytic window and CT.',
  },
  { id: 'dx_sepsis', text: 'Sepsis', notifEnabled: false, notifMessage: '' },
  { id: 'dx_trauma', text: 'Major trauma', notifEnabled: false, notifMessage: '' },
];

export const defaultOverrideReasons: OverrideReason[] = [
  { id: 'or_1', text: 'Receiving facility at capacity' },
  { id: 'or_2', text: 'Service temporarily unavailable' },
  { id: 'or_3', text: 'Patient/family preference' },
  { id: 'or_4', text: 'Weather / transport constraint' },
];

export const defaultReferenceCards: ReferenceCard[] = [
  {
    id: 'rc_stroke',
    name: 'Stroke pathway summary',
    code: 'STROKE',
    body: 'Activate stroke protocol within 4.5h of symptom onset.',
    steps: [
      { id: 'rcs_1', text: 'Obtain CT head non-contrast' },
      { id: 'rcs_2', text: 'Confirm NIH stroke scale' },
      { id: 'rcs_3', text: 'Notify neurology on-call' },
    ],
  },
];
