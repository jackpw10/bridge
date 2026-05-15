import type {
  Diagnosis,
  Facility,
  OverrideReason,
  ProcessSteps,
  ReferenceCard,
  SpecialtyService,
  User,
  Workflow,
} from '../types';
import { hashPassword } from '../utils/hash';

// All IDs below are static so cross-references survive a reset.

export const defaultUsers: User[] = [
  {
    id: 'u_admin',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    passwordHash: hashPassword('admin'),
    role: 'admin',
  },
];

export const defaultWorkflow: Workflow = {
  questions: [
    { id: 'q_facility', type: 'facility', text: 'Sending facility' },
    {
      id: 'q_triage',
      type: 'triage',
      text: 'Is this a Lateral / Lower Triage Outside (LLTO) transfer? (Yes = LLTO, No = HLOC)',
    },
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
    {
      id: 'q_ptn',
      type: 'yesno',
      text: 'Is the receiving facility outside PTN?',
    },
    {
      id: 'q_notes',
      type: 'text',
      text: 'Clinical notes (optional)',
    },
  ],
};

export const defaultSpecialtyServices: SpecialtyService[] = [
  {
    id: 'svc_card',
    name: 'Cardiology',
    template: {
      llto: {
        preQuestions: [
          {
            id: 'sq_card_l1',
            type: 'yesno',
            text: 'Has 12-lead ECG been transmitted?',
          },
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
      hloc: {
        preQuestions: [
          {
            id: 'sq_card_h1',
            type: 'yesno',
            text: 'Is the patient hemodynamically unstable?',
          },
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
    transportAdvisor: { enabled: false, cardsByHA: {} },
  },
  {
    id: 'svc_neuro',
    name: 'Neurology',
    template: {
      llto: {
        preQuestions: [
          {
            id: 'sq_neuro_l1',
            type: 'yesno',
            text: 'Has CT head been performed?',
          },
        ],
        exceptionSteps: [],
      },
      hloc: {
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
    transportAdvisor: { enabled: false, cardsByHA: {} },
  },
];

export const defaultFacilities: Facility[] = [
  {
    id: 'f_general',
    name: 'Vancouver General',
    healthAuthority: 'VCH',
    onSiteServiceIds: ['svc_card', 'svc_neuro'],
    referralPatterns: {},
    notificationRequirements: [
      {
        id: 'nr_vgh_1',
        text: 'Notify Transfer Center at extension 2200',
        llto: true,
        hloc: true,
        svcIds: [],
      },
    ],
    serviceNotifs: {},
  },
  {
    id: 'f_richmond',
    name: 'Richmond Regional',
    healthAuthority: 'VCH',
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
    healthAuthority: 'Fraser Health',
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

export const defaultProcessSteps: ProcessSteps = {
  lltoNo: [
    { id: 'ps_l_n_1', text: 'Confirm receiving bed availability' },
    { id: 'ps_l_n_2', text: 'Arrange ground transport via dispatch' },
    { id: 'ps_l_n_3', text: 'Document acceptance and ETA' },
  ],
  lltoYes: [
    { id: 'ps_l_y_1', text: 'Confirm outside-PTN acceptance' },
    { id: 'ps_l_y_2', text: 'Engage IFT coordinator for inter-region transfer' },
  ],
  hlocNo: [
    { id: 'ps_h_n_1', text: 'Notify receiving site charge nurse' },
    { id: 'ps_h_n_2', text: 'Arrange critical care transport team' },
    { id: 'ps_h_n_3', text: 'Confirm escort qualifications (RN/RT/MD)' },
  ],
  hlocYes: [
    { id: 'ps_h_y_1', text: 'Escalate to Medical Director on-call' },
    { id: 'ps_h_y_2', text: 'Confirm tertiary acceptance via Transfer Center' },
  ],
};

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
