// Storage abstraction layer. Backed by localStorage today.
// Swap implementations (IndexedDB, REST, Supabase) by replacing this module.

export interface Storage {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

class LocalStorageDriver implements Storage {
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('localStorage write failed', e);
    }
  }
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export const storage: Storage = new LocalStorageDriver();

export const KEYS = {
  users: 'bridge.users',
  session: 'bridge.session',
  workflow: 'bridge.workflow',
  facilities: 'bridge.facilities',
  specialty: 'bridge.specialty',
  diagnoses: 'bridge.diagnoses',
  processSteps: 'bridge.processSteps',
  overrides: 'bridge.overrides',
  reasons: 'bridge.reasons',
  refCards: 'bridge.referenceCards',
  notifications: 'bridge.notifications',
  healthAuthorities: 'bridge.healthAuthorities',
  initialized: 'bridge.initialized.v1',
  migratedV2: 'bridge.migrated.v2',
} as const;
