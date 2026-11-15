import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSignUp, useUser } from '@clerk/react';
import { Link, Redirect, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Check, ImagePlus, MapPin, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { OnboardingVideoBackground } from './onboarding-video-background';
import {
  getGetMyProfileQueryKey, requestProfileMediaUpload, saveMyProfile,
  type MediaUploadInputContentType, type ProfileInput,
} from '@workspace/api-client-react';
import { clearDraft, loadDraft, saveDraft, type SignupAnswers } from '@/lib/signup-draft-store';
import { listCities, listCountries, listStates, type GeoOption } from '@/lib/geo-data';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const STEPS = [
  'First name', 'Last name', 'Country', 'State or region', 'City', 'Age', 'Gender', 'Looking for',
  'Profile photo', 'Bio', 'Interests', 'Preferences', 'Email', 'Verify',
] as const;
const LAST = STEPS.length - 1;

const GENDERS = ['Woman', 'Man', 'Non-binary', 'Another identity'];
const LOOKING = ['Women', 'Men', 'Non-binary people', 'Everyone'];
const SUGGESTED = ['Live music', 'Hiking', 'Cooking', 'Books', 'Coffee', 'Travel', 'Film', 'Art galleries', 'Running', 'Board games', 'Yoga', 'Wine', 'Photography', 'Dancing', 'Gardening', 'Podcasts'];
const MAX_PHOTO = 15 * 1024 * 1024;
const PHOTO_TYPES: Record<string, MediaUploadInputContentType> = {
  'image/jpeg': 'image/jpeg', 'image/jpg': 'image/jpeg', 'image/png': 'image/png', 'image/webp': 'image/webp',
  'image/heic': 'image/heic', 'image/heif': 'image/heic',
};
const EXT_TYPES: Record<string, MediaUploadInputContentType> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heic' };

function photoType(file: File): MediaUploadInputContentType | null {
  if (file.type && PHOTO_TYPES[file.type.toLowerCase()]) return PHOTO_TYPES[file.type.toLowerCase()];
  if (!file.type || file.type === 'application/octet-stream') return EXT_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? null;
  return null;
}
function validatePhoto(file: File): string | null {
  if (!photoType(file)) return 'Use a JPEG, PNG, WebP or HEIC photo.';
  if (file.size <= 0) return 'That file is empty. Choose another photo.';
  if (file.size > MAX_PHOTO) return 'That photo is larger than 15 MB. Choose a smaller one.';
  return null;
}

const emptyAnswers: SignupAnswers = {
  firstName: '', lastName: '', countryCode: '', countryName: '', stateCode: '', stateName: '', city: '',
  age: '', gender: '', lookingFor: '', bio: '', interests: [], ageMin: 22, ageMax: 38, distanceKm: 50, email: '',
};

type ClerkErr = { message?: string; longMessage?: string; code?: string; errors?: { code?: string; longMessage?: string; message?: string }[] } | null | undefined;
function errText(e: ClerkErr, fallback: string) {
  const first = e?.errors?.[0];
  return first?.longMessage || first?.message || e?.longMessage || e?.message || fallback;
}
function errCode(e: ClerkErr) { return e?.errors?.[0]?.code || e?.code || ''; }

const FIELD_LABELS: Record<string, string> = { password: 'a password', username: 'a username', phone_number: 'a phone number', legal_accepted: 'legal terms acceptance', first_name: 'a first name', last_name: 'a last name' };

export function ProfileFirstSignup({ previewOnly = false }: { previewOnly?: boolean }) {
  const { signUp, fetchStatus } = useSignUp();
  const { isLoaded, isSignedIn, user } = useUser();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [ready, setReady] = useState(false);
  const [storageIssue, setStorageIssue] = useState('');
  const [step, setStep] = useState(0);
  const [a, setA] = useState<SignupAnswers>(emptyAnswers);
  const [photo, setPhoto] = useState<File | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [mediaReference, setMediaReference] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [configError, setConfigError] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [finishing, setFinishing] = useState<'idle' | 'working' | 'error'>('idle');
  const [finishError, setFinishError] = useState('');
  const completing = useRef(false);

  // Load per-tab draft (never blocks forever: store has its own timeout).
  useEffect(() => {
    let alive = true;
    loadDraft().then(d => {
      if (!alive || !d) return;
      setA({ ...emptyAnswers, ...d.answers });
      setStep(Math.min(d.step, 12));
      setPhoto(d.photo);
      setCreatedUserId(d.createdUserId);
      setMediaReference(d.mediaReference);
    }).catch(() => { if (alive) setStorageIssue('This browser could not keep your progress. Your answers stay while this page is open, but will be lost if you close or reload it.'); })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  // Persist answers + held photo (no codes, no tokens).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      saveDraft({ step: Math.min(step, 12), answers: a, photo, createdUserId, mediaReference })
        .then(() => setStorageIssue(''))
        .catch(() => setStorageIssue('This browser could not keep your progress. Your answers stay while this page is open, but will be lost if you close or reload it.'));
    }, 350);
    return () => clearTimeout(t);
  }, [ready, step, a, photo, createdUserId, mediaReference]);

  const set = useCallback(<K extends keyof SignupAnswers>(k: K, v: SignupAnswers[K]) => { setA(p => ({ ...p, [k]: v })); setError(''); }, []);

  const sessionMatches = !!(isLoaded && isSignedIn && user && createdUserId && user.id === createdUserId);

  const complete = useCallback(async () => {
    if (completing.current) return;
    if (!photo) { setFinishing('error'); setFinishError('Your profile photo is missing from this browser. Choose it again to finish.'); return; }
    completing.current = true;
    setFinishing('working'); setFinishError('');
    try {
      let ref = mediaReference;
      if (!ref) {
        const contentType = photoType(photo);
        if (!contentType) throw new Error('Unsupported photo type.');
        const up = await requestProfileMediaUpload({ name: photo.name.slice(0, 255) || 'profile-photo', size: photo.size, contentType, mediaType: 'image' });
        const put = await fetch(up.uploadURL, { method: 'PUT', body: photo, headers: { 'Content-Type': contentType } });
        if (!put.ok) throw new Error('Your photo did not upload.');
        ref = up.mediaReference;
        setMediaReference(ref);
      }
      const input: ProfileInput = {
        name: a.firstName.trim().slice(0, 60), age: Number(a.age), gender: a.gender, lookingFor: a.lookingFor,
        bio: a.bio.trim().slice(0, 500), city: a.city.slice(0, 100), country: a.countryName || null, state: a.stateName || null,
        interests: a.interests.slice(0, 12), photos: [ref], videoUrl: null,
        preferences: { ageMin: a.ageMin, ageMax: a.ageMax, gender: a.lookingFor, distanceKm: a.distanceKm },
      };
      const profile = await saveMyProfile(input);
      qc.setQueryData(getGetMyProfileQueryKey(), profile);
      await qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      await clearDraft().catch(() => undefined);
      setLocation('/discover', { replace: true });
    } catch (e) {
      setFinishing('error');
      setFinishError(e instanceof Error && e.message ? `${e.message} Your account is ready, and your answers and photo are still here.` : 'We could not save your profile. Your account is ready, and your answers and photo are still here.');
    } finally { completing.current = false; }
  }, [photo, mediaReference, a, qc, setLocation]);

  const completeRef = useRef(complete);
  completeRef.current = complete;
  useEffect(() => { if (sessionMatches && finishing === 'idle') void completeRef.current(); }, [sessionMatches, finishing]);

  // ---------- Clerk ----------
  async function createAccount() {
    if (previewOnly) {
      setConfigError('This is a form preview. Email-code-only signup is not enabled in the current authentication settings yet. No account or email code has been created.');
      return;
    }
    setBusy(true); setError(''); setConfigError('');
    try {
      const res = await signUp.create({ emailAddress: a.email.trim(), firstName: a.firstName.trim(), lastName: a.lastName.trim() });
      if (res.error) {
        const c = errCode(res.error);
        if (c === 'form_identifier_exists') setError('An account already uses this email. Sign in instead — nothing on that account was changed.');
        else setError(errText(res.error, 'We could not start your account.'));
        return;
      }
      const blocking = signUp.missingFields.filter(f => f !== 'email_address');
      if (blocking.length) {
        setConfigError(`Account setup is blocked: Myage's sign-up settings currently also require ${blocking.map(f => FIELD_LABELS[f] ?? f).join(', ')}. An administrator needs to turn this off in the authentication settings. Your answers are saved here — try again once it's updated.`);
        return;
      }
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) { setError(errText(sent.error, 'We could not send your code.')); return; }
      setCodeSent(true); setCode(''); setStep(LAST);
    } catch (e) { setError(e instanceof Error ? e.message : 'We could not start your account.'); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!photo) { setError('Your profile photo is missing. Go back and choose it again.'); return; }
    setBusy(true); setError(''); setConfigError('');
    try {
      const res = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (res.error) { setError(errText(res.error, 'That code did not work.')); return; }
      if (signUp.status !== 'complete') {
        const missing = signUp.missingFields;
        setConfigError(missing.length
          ? `Your email is verified, but the sign-up settings also require ${missing.map(f => FIELD_LABELS[f] ?? f).join(', ')}. An administrator needs to update the authentication settings before accounts can be finished here.`
          : 'Your email is verified, but the account is not complete yet. Please try again shortly.');
        return;
      }
      const uid = signUp.createdUserId;
      if (!uid) { setError('Your account was verified but no account ID came back. Please try again.'); return; }
      setCreatedUserId(uid);
      await saveDraft({ step: 12, answers: a, photo, createdUserId: uid, mediaReference }).catch(() => undefined);
      const fin = await signUp.finalize({ navigate: async ({ session }) => {
        if (session?.currentTask) setConfigError('Your account needs another step before it can be used. Sign in to continue.');
      } });
      if (fin.error) setError(errText(fin.error, 'We could not sign you in.'));
    } catch (e) { setError(e instanceof Error ? e.message : 'That code could not be confirmed.'); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError('');
    try { const r = await signUp.verifications.sendEmailCode(); if (r.error) setError(errText(r.error, 'Could not resend the code.')); else setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not resend the code.'); }
    finally { setBusy(false); }
  }

  // ---------- validation ----------
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email.trim());
  const ageNum = Number(a.age);
  const [geoEmpty, setGeoEmpty] = useState<{ states: boolean; cities: boolean }>({ states: false, cities: false });
  const valid = [
    a.firstName.trim().length > 0 && a.firstName.trim().length <= 60,
    a.lastName.trim().length > 0 && a.lastName.trim().length <= 60,
    !!a.countryCode,
    !!a.stateCode || geoEmpty.states,
    !!a.city || geoEmpty.cities,
    Number.isInteger(ageNum) && ageNum >= 18 && ageNum <= 120,
    !!a.gender, !!a.lookingFor, !!photo,
    a.bio.length <= 500, true,
    a.ageMin >= 18 && a.ageMax <= 120 && a.ageMin <= a.ageMax && a.distanceKm >= 1 && a.distanceKm <= 500,
    emailValid, code.trim().length >= 4,
  ][step];

  function next(e?: FormEvent) {
    e?.preventDefault();
    if (!valid || busy) return;
    if (step === 12) { void createAccount(); return; }
    if (step === LAST) { void verify(); return; }
    setError(''); setStep(s => s + 1);
  }
  function back() { setError(''); setConfigError(''); if (step === LAST) setCodeSent(false); setStep(s => Math.max(0, s - 1)); }

  // ---------- routing guards ----------
  if (!isLoaded || !ready) return <Frame><div className="space-y-4" aria-label="Loading">{[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[.04]" />)}</div></Frame>;
  if (isSignedIn && !sessionMatches) return <Redirect to="/profile" />;

  if (sessionMatches) return <Frame>
    <div className="page-in" data-testid="screen-signup-finishing">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">Account verified</p>
      <h1 className="brand mt-3 text-[2rem] font-bold leading-tight text-[#fff2f7]">{finishing === 'error' ? 'Almost there' : 'Setting up your profile'}</h1>
      <p className="mt-3 text-[15px] leading-7 text-[#c3b7c0]">{finishing === 'error' ? finishError : 'Uploading your photo and saving your answers. This only takes a moment.'}</p>
      {finishing !== 'error' && <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full w-1/2 animate-pulse rounded-full bg-primary" /></div>}
      {finishing === 'error' && <div className="mt-8 space-y-3">
        {!photo && <PhotoPicker photo={photo} onPick={f => { setPhoto(f); setMediaReference(null); }} />}
        <button onClick={() => void complete()} disabled={!photo} data-testid="button-signup-retry-finish" className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-bold text-[#24111b] disabled:opacity-40"><RotateCcw size={17} />Try again</button>
      </div>}
    </div>
  </Frame>;

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  return <Frame>
    <form onSubmit={next} noValidate className="flex flex-1 flex-col">
      <div>
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[.18em]">
          <span className="text-primary">{STEPS[step]}</span>
          <span className="tabular-nums text-muted-foreground" data-testid="text-signup-progress">{step + 1} / {STEPS.length}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[.07]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full origin-left rounded-full bg-primary transition-transform duration-300" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
      </div>
      {storageIssue && <p role="status" data-testid="status-signup-storage" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[.06] px-3.5 py-2.5 text-xs leading-5 text-amber-100">{storageIssue}</p>}

      <div key={step} className="page-in mt-8 flex-1">
        {step === 0 && <Q title="What's your first name?" hint="This is the name people will see on your profile.">
          <input autoFocus data-testid="input-signup-first-name" autoComplete="given-name" maxLength={60} value={a.firstName} onChange={e => set('firstName', e.target.value)} className="field signup-input" placeholder="First name" />
        </Q>}
        {step === 1 && <Q title="And your last name?" hint="Kept private with your account. It isn't shown on your profile.">
          <input autoFocus data-testid="input-signup-last-name" autoComplete="family-name" maxLength={60} value={a.lastName} onChange={e => set('lastName', e.target.value)} className="field signup-input" placeholder="Last name" />
        </Q>}
        {step === 2 && <Q title="Which country do you live in?">
          <GeoPicker testId="country" load={listCountries} deps="countries" value={a.countryCode} label={a.countryName}
            onPick={o => { if (o.code !== a.countryCode) setA(p => ({ ...p, countryCode: o.code, countryName: o.name, stateCode: '', stateName: '', city: '' })); setGeoEmpty({ states: false, cities: false }); setError(''); }}
            emptyText="Countries could not be loaded." placeholder="Search countries" />
        </Q>}
        {step === 3 && <Q title="Which state or region?" hint={a.countryName}>
          <GeoPicker testId="state" load={() => listStates(a.countryCode)} deps={a.countryCode} value={a.stateCode} label={a.stateName}
            onPick={o => { if (o.code !== a.stateCode) setA(p => ({ ...p, stateCode: o.code, stateName: o.name, city: '' })); setGeoEmpty(g => ({ ...g, cities: false })); setError(''); }}
            onEmpty={empty => setGeoEmpty(g => ({ ...g, states: empty }))}
            emptyText={`Our location data doesn't list states or regions for ${a.countryName}. You can continue without one.`} placeholder="Search states and regions" />
        </Q>}
        {step === 4 && <Q title="Which city?" hint={[a.stateName, a.countryName].filter(Boolean).join(', ')}>
          <GeoPicker testId="city" load={() => listCities(a.countryCode, a.stateCode)} deps={`${a.countryCode}/${a.stateCode}`} value={a.city} label={a.city}
            onPick={o => set('city', o.name)} onEmpty={empty => setGeoEmpty(g => ({ ...g, cities: empty }))}
            emptyText={`Our location data doesn't list cities for ${a.stateName || a.countryName}. You can continue without one — your profile will show your ${a.stateName ? 'region' : 'country'}.`} placeholder="Search cities" />
        </Q>}
        {step === 5 && <Q title="How old are you?" hint="Myage is for adults 18 and over.">
          <input autoFocus data-testid="input-signup-age" inputMode="numeric" type="number" min={18} max={120} value={a.age} onChange={e => set('age', e.target.value.replace(/\D/g, '').slice(0, 3))} className="field signup-input max-w-[160px]" placeholder="Age" />
          {a.age !== '' && Number(a.age) < 18 && <p className="mt-3 text-sm text-rose-300" data-testid="error-signup-age">You must be 18 or older to join.</p>}
        </Q>}
        {step === 6 && <Q title="How do you identify?"><Choices options={GENDERS} value={a.gender} onPick={v => set('gender', v)} testId="gender" /></Q>}
        {step === 7 && <Q title="Who would you like to meet?"><Choices options={LOOKING} value={a.lookingFor} onPick={v => set('lookingFor', v)} testId="looking" /></Q>}
        {step === 8 && <Q title="Add your profile photo" hint="Required. A clear, recent photo of you. This exact photo appears on your profile and in Discover.">
          <PhotoPicker photo={photo} onPick={f => { setPhoto(f); setMediaReference(null); setError(''); }} />
        </Q>}
        {step === 9 && <Q title="Say a little about yourself" hint="Optional. You can always add this later.">
          <textarea autoFocus data-testid="input-signup-bio" rows={5} maxLength={500} value={a.bio} onChange={e => set('bio', e.target.value)} className="field resize-none text-[15px] leading-7" placeholder="What makes a good evening for you?" />
          <p className="mt-2 text-right text-xs tabular-nums text-muted-foreground">{a.bio.length} / 500</p>
        </Q>}
        {step === 10 && <Q title="What are you into?" hint={`Optional. Pick up to 12 · ${a.interests.length} selected`}>
          <Interests value={a.interests} onChange={v => set('interests', v)} />
        </Q>}
        {step === 11 && <Q title="Your preferences" hint="Who shows up in Discover. Adjust any time.">
          <div className="space-y-7">
            <Range label="Youngest" value={a.ageMin} min={18} max={99} unit="" testId="age-min" onChange={v => setA(p => ({ ...p, ageMin: v, ageMax: Math.max(p.ageMax, v) }))} />
            <Range label="Oldest" value={a.ageMax} min={18} max={99} unit="" testId="age-max" onChange={v => setA(p => ({ ...p, ageMax: v, ageMin: Math.min(p.ageMin, v) }))} />
            <Range label="Distance" value={a.distanceKm} min={1} max={500} unit=" km" testId="distance" onChange={v => set('distanceKm', v)} />
          </div>
        </Q>}
        {step === 12 && <Q title="Last thing: your email" hint="We'll send a code to confirm it's you. No password needed.">
          <input autoFocus data-testid="input-signup-email" type="email" inputMode="email" autoComplete="email" value={a.email} onChange={e => { set('email', e.target.value); setConfigError(''); }} className="field signup-input" placeholder="you@example.com" />
          {a.email && !emailValid && <p className="mt-3 text-sm text-rose-300" data-testid="error-signup-email">Enter a valid email address.</p>}
          <div id="clerk-captcha" className="mt-4" data-testid="clerk-captcha" />
        </Q>}
        {step === LAST && <Q title="Check your email" hint={codeSent ? `We sent a code to ${a.email.trim()}.` : 'Go back to send a code to your email.'}>
          <input autoFocus data-testid="input-signup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={e => { setCode(e.target.value.replace(/\s/g, '')); setError(''); }} className="field signup-input max-w-[240px] tracking-[.4em]" placeholder="000000" />
          <button type="button" onClick={() => void resend()} disabled={busy || !codeSent} data-testid="button-signup-resend" className="mt-4 block min-h-[44px] text-sm font-semibold text-primary disabled:opacity-40">Resend code</button>
        </Q>}

        {configError && <p role="alert" data-testid="error-signup-config" className="mt-6 rounded-xl border border-amber-300/25 bg-amber-300/[.07] px-4 py-3 text-sm leading-6 text-amber-100">{configError}</p>}
        {error && <p role="alert" data-testid="error-signup" className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/[.06] px-4 py-3 text-sm leading-6 text-rose-200">{error}{errorLinksToSignIn(error) && <> <Link href="/sign-in" className="font-bold underline" data-testid="link-signup-error-signin">Sign in</Link></>}</p>}
      </div>

      <div className="mt-10 grid grid-cols-[auto_1fr] gap-3 border-t border-white/[.08] pt-5">
        <button type="button" onClick={back} disabled={step === 0 || busy} data-testid="button-signup-back" className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-white/10 px-5 text-sm font-semibold text-[#e7dce3] transition-colors hover:bg-white/[.04] disabled:opacity-30"><ArrowLeft size={17} />Back</button>
        <button type="submit" disabled={!valid || busy || fetchStatus === 'fetching'} data-testid="button-signup-next" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-bold text-[#24111b] transition-colors hover:bg-[#ff68aa] disabled:cursor-not-allowed disabled:opacity-35">
          {busy ? 'Please wait…' : step === 12 ? 'Send code' : step === LAST ? 'Verify and finish' : (step === 9 && !a.bio.trim()) || (step === 10 && !a.interests.length) || ((step === 3 || step === 4) && !(step === 3 ? a.stateCode : a.city)) ? 'Skip' : 'Next'}
          {!busy && <ArrowRight size={17} />}
        </button>
      </div>
    </form>
  </Frame>;
}

function errorLinksToSignIn(msg: string) { return msg.startsWith('An account already uses this email'); }

function Frame({ children }: { children: ReactNode }) {
  return <div className="onboarding-video-form grain flex min-h-[100dvh] flex-col bg-background">
    <OnboardingVideoBackground form/>
    <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-5 pt-6">
      <Link href="/" className="inline-flex items-center gap-2.5" data-testid="link-signup-brand">
        <img src={`${basePath}/icon.png`} alt="" className="h-9 w-9 rounded-xl ring-1 ring-white/10" />
        <span className="brand text-[20px] font-extrabold text-[#fff2f7]">My<span className="text-primary">age</span></span>
      </Link>
      <Link href="/sign-in" data-testid="link-signin-from-signup" className="min-h-[44px] content-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground">Sign in</Link>
    </header>
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-8">
      <section className="flex flex-1 flex-col rounded-[24px] border border-white/[.09] bg-[#1d1a21] p-6 sm:p-8">{children}</section>
      <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck size={14} className="text-[#86d9b6]" />Adults 18+ only. Your answers stay on this device until you verify your email.</p>
      <p className="mt-3 text-center text-xs text-muted-foreground"><Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link><span className="px-2">·</span><Link href="/terms" className="hover:text-primary">Terms of Service</Link></p>
    </main>
  </div>;
}

function Q({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <div>
    <h1 className="brand text-[1.85rem] font-bold leading-[1.15] text-[#fff2f7] sm:text-[2.1rem]">{title}</h1>
    {hint && <p className="mt-2.5 text-[15px] leading-6 text-[#b9adb6]">{hint}</p>}
    <div className="mt-7">{children}</div>
  </div>;
}

function Choices({ options, value, onPick, testId }: { options: string[]; value: string; onPick: (v: string) => void; testId: string }) {
  return <div className="grid gap-2.5" role="radiogroup">
    {options.map(o => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onPick(o)} data-testid={`option-${testId}-${o.toLowerCase().replace(/\s+/g, '-')}`}
      className={`flex min-h-[56px] items-center justify-between rounded-2xl border px-5 text-left text-[15px] font-semibold transition-colors ${value === o ? 'border-primary/70 bg-primary/[.1] text-[#ffd3e6]' : 'border-white/10 bg-[#19161c] text-[#e7dce3] hover:border-white/20'}`}>
      {o}{value === o && <Check size={18} className="text-primary" />}
    </button>)}
  </div>;
}

function GeoPicker({ load, deps, value, label, onPick, onEmpty, emptyText, placeholder, testId }: {
  load: () => Promise<GeoOption[]>; deps: string; value: string; label: string; onPick: (o: GeoOption) => void;
  onEmpty?: (empty: boolean) => void; emptyText: string; placeholder: string; testId: string;
}) {
  const [opts, setOpts] = useState<GeoOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load); loadRef.current = load;
  const onEmptyRef = useRef(onEmpty); onEmptyRef.current = onEmpty;
  useEffect(() => {
    let alive = true; setOpts(null); setFailed(false);
    loadRef.current().then(o => { if (alive) { setOpts(o); onEmptyRef.current?.(o.length === 0); } }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [deps, attempt]);
  const filtered = useMemo(() => {
    if (!opts) return [];
    const n = q.trim().toLowerCase();
    const list = n ? opts.filter(o => o.name.toLowerCase().includes(n)) : opts;
    return list.slice(0, 150);
  }, [opts, q]);
  if (failed) return <div className="rounded-2xl border border-white/10 p-5 text-sm text-muted-foreground">Location data could not load.<button type="button" onClick={() => setAttempt(x => x + 1)} data-testid={`button-retry-${testId}`} className="ml-2 font-bold text-primary">Try again</button></div>;
  if (!opts) return <div className="space-y-2" aria-label="Loading locations">{[0, 1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[.04]" />)}</div>;
  if (!opts.length) return <p data-testid={`status-${testId}-empty`} className="rounded-2xl border border-white/10 bg-white/[.02] px-5 py-4 text-sm leading-6 text-[#c3b7c0]"><MapPin size={15} className="mr-2 inline text-primary" />{emptyText}</p>;
  return <div>
    {value && <div className="mb-3 flex items-center gap-2 text-sm text-[#ffd3e6]" data-testid={`text-${testId}-selected`}><Check size={16} className="text-primary" />{label}</div>}
    <div className="relative">
      <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} data-testid={`input-search-${testId}`} className="field signup-input !pl-11" />
      {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" data-testid={`button-clear-${testId}`} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted-foreground"><X size={16} /></button>}
    </div>
    <ul className="hide-scrollbar mt-3 max-h-[300px] overflow-y-auto rounded-2xl border border-white/[.08] bg-[#19161c]" role="listbox">
      {filtered.map(o => <li key={o.code}><button type="button" role="option" aria-selected={o.code === value} onClick={() => onPick(o)} data-testid={`option-${testId}-${o.code}`}
        className={`flex min-h-[48px] w-full items-center justify-between border-b border-white/[.05] px-4 text-left text-[15px] transition-colors last:border-0 ${o.code === value ? 'bg-primary/[.1] font-semibold text-[#ffd3e6]' : 'text-[#e7dce3] hover:bg-white/[.04]'}`}>
        {o.name}{o.code === value && <Check size={16} className="text-primary" />}</button></li>)}
      {!filtered.length && <li className="px-4 py-4 text-sm text-muted-foreground">No matches for “{q}”.</li>}
    </ul>
    {opts.length > 150 && filtered.length === 150 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 150. Type to narrow it down.</p>}
  </div>;
}

function PhotoPicker({ photo, onPick }: { photo: File | null; onPick: (f: File) => void }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!photo) { setUrl(''); return; }
    const u = URL.createObjectURL(photo); setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return <div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" data-testid="input-signup-photo"
      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const v = validatePhoto(f); if (v) { setErr(v); return; } setErr(''); onPick(f); }} />
    <button type="button" onClick={() => input.current?.click()} data-testid="button-signup-photo"
      className="relative flex aspect-[4/5] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-white/15 bg-[#19161c] transition-colors hover:border-primary/50">
      {url ? <>
        <img src={url} alt="Your selected profile photo" className="absolute inset-0 h-full w-full object-cover" data-testid="img-signup-photo-preview" />
        <span className="absolute inset-x-3 bottom-3 rounded-xl bg-[#141117]/80 px-3 py-2.5 text-sm font-semibold text-[#fff2f7] backdrop-blur">Change photo</span>
      </> : <span className="flex flex-col items-center gap-3 px-6 text-center text-sm text-[#c3b7c0]"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary"><ImagePlus size={24} /></span><span className="font-semibold text-[#fff2f7]">Choose a photo</span><span className="text-xs text-muted-foreground">JPEG, PNG, WebP or HEIC · up to 15 MB</span></span>}
    </button>
    {photo && url && !/heic|heif/i.test(photo.type + photo.name) ? null : photo && <p className="mt-3 text-xs text-muted-foreground">{photo.name} is selected. Some browsers can't preview HEIC photos, but it will still upload.</p>}
    {err && <p role="alert" data-testid="error-signup-photo" className="mt-3 text-sm text-rose-300">{err}</p>}
  </div>;
}

function Interests({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const toggle = (i: string) => onChange(value.includes(i) ? value.filter(x => x !== i) : value.length >= 12 ? value : [...value, i]);
  const all = [...SUGGESTED, ...value.filter(v => !SUGGESTED.includes(v))];
  function add() { const t = custom.trim().slice(0, 32); if (!t || value.some(v => v.toLowerCase() === t.toLowerCase()) || value.length >= 12) return; onChange([...value, t]); setCustom(''); }
  return <div>
    <div className="flex flex-wrap gap-2">
      {all.map(i => <button key={i} type="button" onClick={() => toggle(i)} aria-pressed={value.includes(i)} data-testid={`chip-interest-${i.toLowerCase().replace(/\s+/g, '-')}`}
        className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors ${value.includes(i) ? 'border-primary/70 bg-primary/[.12] text-[#ffd3e6]' : 'border-white/10 text-[#c3b7c0] hover:border-white/25'}`}>{i}</button>)}
    </div>
    <div className="mt-5 flex gap-2">
      <input value={custom} maxLength={32} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Add your own" data-testid="input-signup-interest" className="field" />
      <button type="button" onClick={add} disabled={!custom.trim() || value.length >= 12} data-testid="button-add-interest" className="min-h-[44px] rounded-xl bg-secondary px-4 text-sm font-bold disabled:opacity-40">Add</button>
    </div>
  </div>;
}

function Range({ label, value, min, max, unit, onChange, testId }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void; testId: string }) {
  return <label className="block">
    <span className="flex items-baseline justify-between"><span className="text-sm font-semibold text-[#e7dce3]">{label}</span><span className="brand text-2xl font-bold tabular-nums text-[#fff2f7]" data-testid={`text-pref-${testId}`}>{value}{unit}</span></span>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} data-testid={`input-pref-${testId}`} className="field mt-3 w-full accent-[#f34e9a]" />
  </label>;
}

export default ProfileFirstSignup;
