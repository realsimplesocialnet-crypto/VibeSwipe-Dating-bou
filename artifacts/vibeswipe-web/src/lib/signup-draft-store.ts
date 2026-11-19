// Per-tab, short-lived local draft for the profile-first signup.
// Never stores passwords, verification codes or session tokens.

export type SignupAnswers = {
  firstName: string; lastName: string;
  countryCode: string; countryName: string;
  stateCode: string; stateName: string;
  city: string; age: string; gender: string; lookingFor: string;
  bio: string; interests: string[];
  ageMin: number; ageMax: number; distanceKm: number;
  email: string; referralCode: string;
};

export type SignupDraft = {
  step: number;
  answers: SignupAnswers;
  photo: File | null;
  createdUserId: string | null;
  mediaReference: string | null;
  expiresAt: number;
};

const DB = 'vibeswipe-signup';
const STORE = 'drafts';
const KEY = 'vibeswipe.signupDraftId';
export const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB failed'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function withTimeout<T>(p: Promise<T>, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Storage timed out')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error ?? new Error('Storage failed'));
      t.onabort = () => reject(t.error ?? new Error('Storage aborted'));
    });
  } finally { db.close(); }
}

function opaqueId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function getDraftId(create: boolean): string | null {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id && create) { id = opaqueId(); sessionStorage.setItem(KEY, id); }
    return id;
  } catch { return null; }
}

export async function loadDraft(): Promise<SignupDraft | null> {
  const id = getDraftId(false);
  if (!id) return null;
  const draft = await withTimeout(tx<SignupDraft | undefined>('readonly', s => s.get(id) as IDBRequest<SignupDraft | undefined>));
  if (!draft) return null;
  if (draft.expiresAt < Date.now()) { await clearDraft().catch(() => undefined); return null; }
  return draft;
}

export async function saveDraft(draft: Omit<SignupDraft, 'expiresAt'>): Promise<void> {
  const id = getDraftId(true);
  if (!id) throw new Error('Session storage unavailable');
  const record: SignupDraft = { ...draft, expiresAt: Date.now() + DRAFT_TTL_MS };
  await withTimeout(tx('readwrite', s => s.put(record, id)));
}

export async function clearDraft(): Promise<void> {
  const id = getDraftId(false);
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  if (id) await withTimeout(tx('readwrite', s => s.delete(id)));
}
