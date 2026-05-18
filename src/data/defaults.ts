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

export const defaultCallTypes: CallType[] = [
  { id: 'ct_llto', name: 'LLTO' },
  { id: 'ct_hloc', name: 'HLOC' },
  { id: 'ct_advice', name: 'Advice' },
  { id: 'ct_repate', name: 'REPATE' },
  { id: 'ct_scheduled', name: 'Scheduled' },
  { id: 'ct_discharge', name: 'Discharge' },
];

export const defaultHealthAuthorities: HealthAuthority[] = [
  { id: 'ha_vch', name: 'VCH' },
  { id: 'ha_fh', name: 'Fraser Health' },
];

export const defaultWorkflows: Workflow[] = [
  {
    id: 'wf_high_acuity',
    name: 'High Acuity Workflow',
    callTypeId: 'ct_llto',
    questions: [
      { id: 'q_facility', type: 'facility', text: 'Sending facility' },
      {
        id: 'q_specialty',
        type: 'specialty_multi',
        text: 'Which specialty service(s) are required?',
      },
      {
        id: 'q_diagnosis',
        type: 'diagnosis_multi',
        text: 'Working / suspected diagnoses',
      },
      {
        id: 'q_referral',
        type: 'referral_resolve',
        text: 'Confirm receiving facility',
      },
    ],
    postTriage: {
      enabled: true,
      showServicePreQuestions: true,
      questions: [
        {
          id: 'ptq_ptn',
          type: 'yesno',
          text: 'Was the patient accepted outside of PTN?',
        },
      ],
    },
    processSteps: [
      { id: 'ps_1', text: 'Confirm receiving bed availability' },
      { id: 'ps_2', text: 'Arrange ground transport via dispatch' },
      { id: 'ps_3', text: 'Document acceptance and ETA' },
      {
        id: 'ps_4',
        text: 'Confirm outside-PTN acceptance',
        condQid: 'ptq_ptn',
        condVal: 'Yes',
      },
      {
        id: 'ps_5',
        text: 'Engage IFT coordinator for inter-region transfer',
        condQid: 'ptq_ptn',
        condVal: 'Yes',
      },
    ],
  },
];

export const defaultSpecialtyServices: SpecialtyService[] = [
  {
    id: 'svc_card',
    name: 'Cardiology',
    templates: {
      ct_llto: {
        preQuestions: [
          { id: 'sq_card_l1', type: 'yesno', text: 'Has 12-lead ECG been transmitted?' },
          {
            id: 'sq_card_l2',
            type: 'dropdown',
            text: 'Troponin trend',
            options: ['Rising', 'Falling', 'Stable', 'Unknown'],
          },
        ],
        exceptionSteps: [
          {
            id: 'sx_card_l1',
            text: 'Escalate to interventional cardiology on-call if troponin rising',
            condQid: 'sq_card_l2',
            condVal: 'Rising',
          },
        ],
      },
      ct_hloc: {
        preQuestions: [
          { id: 'sq_card_h1', type: 'yesno', text: 'Is the patient hemodynamically unstable?' },
        ],
        exceptionSteps: [
          {
            id: 'sx_card_h1',
            text: 'Activate cath lab and notify CCU charge',
            condQid: 'sq_card_h1',
            condVal: 'Yes',
          },
        ],
      },
    },
    transportAdvisor: { enabled: false, cards: [] },
  },
  {
    id: 'svc_neuro',
    name: 'Neurology',
    templates: {
      ct_llto: {
        preQuestions: [
          { id: 'sq_neuro_l1', type: 'yesno', text: 'Has CT head been performed?' },
        ],
        exceptionSteps: [],
      },
      ct_hloc: {
        preQuestions: [
          {
            id: 'sq_neuro_h1',
            type: 'dropdown',
            text: 'NIH stroke scale',
            options: ['0-4', '5-15', '16-20', '21+'],
          },
        ],
        exceptionSteps: [
          {
            id: 'sx_neuro_h1',
            text: 'Activate stroke protocol; notify neuro-interventional radiology',
            condQid: 'sq_neuro_h1',
            condVal: '16-20',
          },
        ],
      },
    },
    transportAdvisor: { enabled: false, cards: [] },
  },
];

export const defaultFacilities: Facility[] = [
  {
    id: 'f_general',
    name: 'Vancouver General',
    healthAuthorityId: 'ha_vch',
    onSiteServiceIds: ['svc_card', 'svc_neuro'],
    referralPatterns: {},
    notificationRequirements: [
      {
        id: 'nr_vgh_1',
        text: 'Notify Transfer Center at extension 2200',
        callTypeIds: [],     // empty = all call types
        svcIds: [],
        excludeSvcIds: [],
      },
    ],
    serviceNotifs: {},
  },
  {
    id: 'f_richmond',
    name: 'Richmond Regional',
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
