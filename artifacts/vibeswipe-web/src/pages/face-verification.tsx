import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Camera, Check, Clock3, Lightbulb, LoaderCircle, LockKeyhole, RotateCcw, ScanFace, ShieldCheck, UserRound, Users, Hand, ImagePlus, Upload, XCircle } from 'lucide-react';
import {
  getGetDiscoverProfilesQueryKey, getGetFaceVerificationStatusQueryKey, getGetMatchesQueryKey, getGetMyProfileQueryKey, getGetProfileMediaQueryKey,
  useCompleteFaceVerification, useFinalizeFaceVerification, useGetFaceVerificationStatus, useGetMyProfile, useGetProfileMedia, useRequestProfileMediaUpload, useStartFaceVerification,
} from '@workspace/api-client-react';
import { userErrorMessage } from '@/lib/user-errors';
import { PROFILE_PHOTO_ACCEPT, photoUploadCanRetry, prepareProfilePhoto, uploadProfilePhotoBytes } from '@/lib/profile-photo-upload';
import { settingsBackTarget } from '@/lib/settings-navigation';

type Phase = 'intro' | 'opening' | 'live' | 'submitting' | 'failed' | 'awaiting';
type Choice = { reference: string; source: 'gallery' | 'upload'; preview?: string };
const MEDIA_REF = /^media:[0-9a-fA-F-]{36}$/;
const MAX_BYTES = 5 * 1024 * 1024;

function stopStream(stream: MediaStream | null) { stream?.getTracks().forEach(t => t.stop()); }

function apiMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const msg = (data as { error: unknown }).error;
      if (typeof msg === 'string' && msg.length > 0 && msg.length < 240 && !/https?:|stack|\bat\s+\w+\s*\(/i.test(msg)) return msg;
    }
  }
  return userErrorMessage(error, fallback);
}

function cameraMessage(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'We couldn’t find a front camera on this device.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Your camera is busy in another app. Close it there, then try again.';
  return 'The camera couldn’t start. Please try again.';
}

function captureJpeg(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return Promise.reject(new Error('Camera not ready'));
  const scale = Math.min(1, 1280 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas unavailable'));
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const encode = (q: number) => new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', q));
  return (async () => {
    for (const q of [0.9, 0.8, 0.65, 0.5]) {
      const blob = await encode(q);
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    throw new Error('Photo too large');
  })();
}

function MainPhoto({ reference, name, preview }: { reference?: string; name: string; preview?: string }) {
  if (preview) return <img src={preview} alt="Your chosen verification photo" className="h-full w-full object-cover" data-testid="img-chosen-photo"/>;
  return <MediaPhoto reference={reference} name={name}/>;
}
function MediaPhoto({ reference, name }: { reference?: string; name: string }) {
  const id = reference?.startsWith('media:') ? reference.slice(6) : '';
  const media = useGetProfileMedia(id, { query: { enabled: !!id, queryKey: getGetProfileMediaQueryKey(id) } });
  const [url, setUrl] = useState('');
  const [broken, setBroken] = useState(false);
  useEffect(() => { if (!media.data) return; const u = URL.createObjectURL(media.data); setUrl(u); return () => URL.revokeObjectURL(u); }, [media.data]);
  const direct = !id && reference && !reference.startsWith('demo:') ? (reference.startsWith('http') ? reference : `/api/storage${reference.startsWith('/') ? reference : `/${reference}`}`) : '';
  const src = id ? url : direct;
  if (media.isLoading) return <div className="h-full w-full animate-pulse bg-white/[.06]" aria-label="Loading your main photo"/>;
  if (!src || broken) return <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-primary">{name.slice(0, 1).toUpperCase() || <UserRound/>}</div>;
  return <img src={src} alt="Your current main profile photo" onError={() => setBroken(true)} className="h-full w-full object-cover" data-testid="img-main-photo"/>;
}

const tips = [
  { icon: ScanFace, text: 'Face the camera straight on' },
  { icon: Hand, text: 'Keep your face uncovered — no mask or sunglasses' },
  { icon: Lightbulb, text: 'Find soft, even light in front of you' },
  { icon: Users, text: 'Only you in the frame' },
  { icon: Camera, text: 'Hold still for your camera photo' },
];

export default function FaceVerificationPage() {
  const backTo = settingsBackTarget(new URLSearchParams(window.location.search).get('returnTo'), '/verify-profile', window.location.origin);
  const qc = useQueryClient();
  const profile = useGetMyProfile();
  const [awaitingLocal, setAwaitingLocal] = useState(false);
  const status = useGetFaceVerificationStatus({ query: { queryKey: getGetFaceVerificationStatusQueryKey(), staleTime: 0, refetchInterval: q => (awaitingLocal || q.state.data?.reviewStatus === 'awaiting_review') && !q.state.data?.verified ? 20_000 : false, refetchIntervalInBackground: false } });
  const start = useStartFaceVerification();
  const complete = useCompleteFaceVerification();
  const finalize = useFinalizeFaceVerification();
  const resumeAttempted = useRef(false);
  const [startAgain, setStartAgain] = useState(false);
  const requestUpload = useRequestProfileMediaUpload();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (choice?.preview) URL.revokeObjectURL(choice.preview); }, [choice?.preview]);

  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openToken = useRef(0);
  const busy = useRef(false);
  const session = useRef<{ sessionId: string; expiresAt: string } | null>(null);

  const release = useCallback(() => {
    openToken.current++;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    const onHide = () => { if (streamRef.current || openToken.current) { release(); setPhase(p => (p === 'live' || p === 'opening') ? 'intro' : p); } };
    const onVis = () => { if (document.visibilityState === 'hidden') onHide(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onVis); release(); };
  }, [release]);

  useEffect(() => {
    if (phase === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [phase]);
  useEffect(() => { if (status.data?.verified) release(); }, [status.data?.verified, release]);

  const supported = typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
  const p = profile.data;
  const s = status.data;
  const gallery = (p?.photos ?? []).filter(r => MEDIA_REF.test(r));
  const selectedChoice = choice ?? (gallery[0] ? { reference: gallery[0], source: 'gallery' as const } : null);

  async function pickUpload(file?: File) {
    if (!file || uploading) return;
    setUploading(true); setUploadError('');
    try {
      const prepared = await prepareProfilePhoto(file);
      const signed = await requestUpload.mutateAsync({ data: { name: prepared.name, size: prepared.size, contentType: 'image/jpeg', mediaType: 'image' } });
      await uploadProfilePhotoBytes(signed.uploadURL, prepared);
      setChoice({ reference: signed.mediaReference, source: 'upload', preview: URL.createObjectURL(prepared) });
    } catch (e) {
      setUploadError(userErrorMessage(e, photoUploadCanRetry(e) ? 'The photo didn’t upload. Choose it again to retry.' : 'Choose a clear JPG, PNG, WebP or HEIC photo.'));
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function openCamera() {
    if (busy.current || !consent || !selectedChoice) return;
    setError('');
    if (!supported) { setError('This browser can’t open the camera here. Use an up-to-date browser over a secure (https) connection.'); setPhase('failed'); return; }
    release();
    const token = ++openToken.current;
    setPhase('opening');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (token !== openToken.current) { stopStream(stream); return; }
      streamRef.current = stream;
      setPhase('live');
    } catch (e) {
      if (token !== openToken.current) return;
      setError(cameraMessage(e)); setPhase('failed');
    }
  }

  function cancel() { release(); setPhase('intro'); setError(''); }

  async function capture() {
    if (busy.current || !videoRef.current) return;
    const captureToken = openToken.current;
    busy.current = true;
    setError('');
    let blob: Blob;
    try { blob = await captureJpeg(videoRef.current); }
    catch { busy.current = false; setError('Couldn’t take the photo. Hold still and try again.'); return; }
    if (captureToken !== openToken.current) { busy.current = false; return; }
    release();
    setPhase('submitting');
    try {
      let s = session.current;
      if (!s || Date.parse(s.expiresAt) - Date.now() < 15_000) {
        if (!selectedChoice || !MEDIA_REF.test(selectedChoice.reference)) throw new Error('No photo chosen');
        s = await start.mutateAsync({ data: { consent: true, photoReference: selectedChoice.reference } });
        session.current = s;
      }
      const result = await complete.mutateAsync({ sessionId: s.sessionId, data: blob });
      session.current = null;
      if (result.verified) {
        setPhase('intro');
        await qc.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() });
      } else {
        setError('We couldn’t confirm it’s you this time. Try again facing the camera in good light.');
        setPhase('failed');
      }
    } catch (e) {
      session.current = null;
      const st = e && typeof e === 'object' && 'status' in e ? (e as { status: unknown }).status : undefined;
      setError(apiMessage(e, st === 410 || st === 404 ? 'Your verification session expired. Start again for a fresh one.' : 'Verification didn’t go through. Please try again.'));
      setPhase('failed');
      if (e && typeof e === 'object' && 'data' in e && (e.data as { checked?: boolean })?.checked) {
        resumeAttempted.current = true;
        await qc.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() });
      }
    } finally { busy.current = false; }
  }

  const loading = profile.isLoading || status.isLoading;
  const verified = s?.verified === true || complete.data?.verified === true || finalize.data?.verified === true;
  const awaiting = !verified && !startAgain && s?.reviewStatus === 'awaiting_review';
  const rejected = !awaiting && s?.reviewStatus === 'rejected';
  useEffect(() => { if (verified || (s && s.reviewStatus !== 'awaiting_review' && s.reviewStatus !== 'none')) setAwaitingLocal(false); }, [verified, s]);
  async function finishCheckedPhoto() {
    if (busy.current) return;
    busy.current = true;
    setError('');
    try {
      const result = await finalize.mutateAsync();
      if (!result.verified) throw new Error('Verification was not confirmed.');
      await qc.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() });
    } catch (e) {
      setError(apiMessage(e, 'Your photo checks could not finish. Please try again.'));
    } finally { busy.current = false; }
  }
  useEffect(() => {
    if (awaiting && s?.available && !resumeAttempted.current) {
      resumeAttempted.current = true;
      void finishCheckedPhoto();
    }
  }, [awaiting, s?.available]);
  useEffect(() => { if (verified) {
    void qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
  } }, [verified, qc]);

  return <div className="page-in min-h-[100dvh] bg-[radial-gradient(120%_60%_at_50%_0%,hsl(var(--accent)),hsl(var(--background))_65%)] text-foreground">
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-5">
      <header className="mb-6 grid grid-cols-[44px_1fr_44px] items-center">
        <Link href={backTo} replace onClick={release} aria-label="Back to settings" data-testid="link-verify-back" className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary ring-1 ring-border transition-transform hover:-translate-x-0.5"><ArrowLeft size={19}/></Link>
        <h1 className="brand text-center text-xl font-extrabold">Face verification</h1><span/>
      </header>

      {loading ? <div className="space-y-4" aria-label="Loading verification">{[0,1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-3xl bg-card/70"/>)}</div>
      : status.isError || profile.isError ? <div role="alert" className="rounded-3xl border border-border bg-card p-6 text-center"><p className="text-sm text-muted-foreground">{apiMessage(status.error ?? profile.error, 'We couldn’t load verification right now.')}</p><button type="button" data-testid="button-retry-status" onClick={() => { void status.refetch(); void profile.refetch(); }} className="mt-4 rounded-xl bg-secondary px-4 py-2 text-sm font-bold">Try again</button></div>
      : verified ? <section className="flex flex-1 flex-col items-center justify-center text-center" data-testid="state-verified">
          <div className="relative h-36 w-36 overflow-hidden rounded-full ring-4 ring-primary/70"><MainPhoto reference={p?.photos?.[0]} name={p?.name ?? ''}/></div>
          <div className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background"><BadgeCheck size={22}/></div>
          <h2 className="brand mt-5 text-3xl font-extrabold">You’re verified</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Your face checks passed. Your verified main photo and blue badge are visible to other members. This does not verify your legal identity.</p>
          <Link href={backTo} replace data-testid="link-verify-done" className="mt-8 w-full rounded-full bg-primary py-4 text-center font-bold text-primary-foreground">Done</Link>
        </section>
      : !s?.available ? <div role="status" className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground"><ShieldCheck className="mx-auto mb-3 text-primary"/>Face verification isn’t available right now. Please check back later.</div>
      : awaiting ? <section className="page-in flex flex-1 flex-col items-center justify-center text-center" role="status" data-testid="state-awaiting-review">
          <div className="relative h-36 w-36 overflow-hidden rounded-full ring-2 ring-primary/40"><MainPhoto reference={selectedChoice?.reference} preview={selectedChoice?.preview} name={p?.name ?? ''}/></div>
          <div className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary ring-4 ring-background"><Clock3 size={20}/></div>
          <h2 className="brand mt-5 text-2xl font-extrabold">Finishing your verification</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Your selfie check passed. We’re checking your gallery photos against the same face. No administrator approval is needed.</p>
          <ul className="mt-6 w-full space-y-2 text-left text-sm">
            <li className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-border"><Check size={16} className="text-primary"/>Camera check passed</li>
            <li className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-primary/40"><ShieldCheck size={16} className="text-primary"/>Gallery face checks</li>
            <li className="flex items-center gap-3 rounded-2xl bg-card/60 px-4 py-3 text-muted-foreground ring-1 ring-border"><BadgeCheck size={16}/>Blue tick activates automatically when checks pass</li>
          </ul>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          <button type="button" disabled={finalize.isPending} onClick={() => void finishCheckedPhoto()} className="mt-6 w-full rounded-full bg-primary py-4 font-bold text-primary-foreground disabled:opacity-50" data-testid="button-finish-verification">{finalize.isPending ? 'Checking your photos…' : 'Finish verification'}</button>
          {error && <button type="button" onClick={() => { setStartAgain(true); setPhase('intro'); }} className="mt-3 text-sm font-semibold text-primary">Choose another photo</button>}
          <Link href={backTo} replace data-testid="link-verify-leave" className="mt-3 text-sm font-semibold text-primary">Back to settings</Link>
        </section>
      : (phase === 'live' || phase === 'opening') ? <section className="flex flex-1 flex-col" aria-label="Camera">
          <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-[32px] bg-[#120f15] ring-1 ring-border">
            <video ref={videoRef} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" aria-label="Live front camera preview" data-testid="video-camera"/>
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-[62%] w-[60%] rounded-[50%] border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(18,15,21,.45)]"/></div>
            {phase === 'opening' && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80"><LoaderCircle className="animate-spin" size={18}/>Opening camera</div>}
            <p className="absolute inset-x-0 bottom-4 text-center text-sm font-semibold text-white/90">Face straight on, fill the oval, hold still</p>
          </div>
          {error && <p role="alert" className="mt-3 text-center text-sm text-destructive">{error}</p>}
          <div className="mt-6 flex items-center justify-center gap-6">
            <button type="button" onClick={cancel} data-testid="button-cancel-camera" className="rounded-full px-5 py-3 text-sm font-bold text-muted-foreground">Cancel</button>
            <button type="button" onClick={() => void capture()} disabled={phase !== 'live'} aria-label="Take verification photo" data-testid="button-capture" className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary bg-card transition-transform active:scale-95 disabled:opacity-40"><span className="h-14 w-14 rounded-full bg-primary"/></button>
            <span className="w-[76px]"/>
          </div>
        </section>
      : phase === 'submitting' ? <section className="flex flex-1 flex-col items-center justify-center text-center" role="status" data-testid="state-submitting">
          <div className="relative h-32 w-32 overflow-hidden rounded-full ring-2 ring-primary/40"><MainPhoto reference={selectedChoice?.reference} preview={selectedChoice?.preview} name={p?.name ?? ''}/><div className="absolute inset-0 animate-pulse bg-primary/20"/></div>
          <LoaderCircle className="mt-6 animate-spin text-primary"/>
          <h2 className="mt-3 text-lg font-bold">Checking your photo</h2>
          <p className="mt-1 text-sm text-muted-foreground">This usually takes a few seconds.</p>
        </section>
      : <section className="space-y-5">
          {rejected && <div role="alert" data-testid="state-rejected" className="page-in flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            <XCircle size={18} className="mt-0.5 shrink-0 text-destructive"/>
            <div><p className="font-bold">Your last verification did not pass</p><p className="mt-1 text-muted-foreground" data-testid="text-rejection-reason">{s?.rejectionReason || 'Please choose a clear photo of yourself.'} You can choose a photo and try again.</p></div>
          </div>}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">1. Choose the photo to verify</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">Once your face checks pass, this photo becomes your main profile photo and your blue tick appears automatically. Your other photos must match the same face.</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {gallery.map((ref, i) => { const on = selectedChoice?.reference === ref; return <button key={ref} type="button" onClick={() => setChoice({ reference: ref, source: 'gallery' })} aria-pressed={on} aria-label={i === 0 ? 'Select main profile photo for verification' : `Select gallery photo ${i + 1} for verification`} data-testid={`button-choose-photo-${i}`} className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-accent transition-transform active:scale-95 ${on ? 'ring-[3px] ring-primary' : 'ring-1 ring-border opacity-80 hover:opacity-100'}`}>
                <MediaPhoto reference={ref} name={p?.name ?? ''}/>
                {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-bold">Main</span>}
                {on && <span className="page-in absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={14}/></span>}
              </button>; })}
              {choice?.source === 'upload' && <div className="page-in relative aspect-[3/4] overflow-hidden rounded-2xl ring-[3px] ring-primary"><MainPhoto preview={choice.preview} name=""/><span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={14}/></span><span className="absolute bottom-1.5 left-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-bold">New</span></div>}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-upload-verification-photo" className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary/45 bg-card text-xs font-semibold text-primary transition-transform active:scale-95 disabled:opacity-60">
                {uploading ? <><LoaderCircle size={20} className="animate-spin"/>Uploading</> : <><Upload size={20}/>New photo</>}
              </button>
            </div>
            <input ref={fileRef} type="file" accept={PROFILE_PHOTO_ACCEPT} className="hidden" onChange={e => void pickUpload(e.target.files?.[0])} data-testid="input-verification-photo"/>
            {uploadError && <p role="alert" className="mt-2 text-sm text-destructive">{uploadError}</p>}
            {selectedChoice && <p className="page-in mt-2 text-xs text-muted-foreground" data-testid="text-choice-note">{selectedChoice.source === 'upload' ? 'Uploaded privately. After successful checks it replaces your main photo.' : selectedChoice.reference === gallery[0] ? 'Your main profile photo is selected automatically. Tap another photo or New photo if you want to switch.' : 'After successful checks this photo becomes your main profile photo.'}</p>}
            {!gallery.length && !choice && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><ImagePlus size={14}/>No gallery photos yet. Upload one that clearly shows your face.</p>}
          </div>

          {phase === 'failed' && error && <div role="alert" data-testid="verify-error" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground">{error}</div>}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">2. Take one live still selfie</p>
            <h2 className="brand mt-1 text-2xl font-extrabold">Show it’s really you</h2>
            <p className="mt-1 text-sm text-muted-foreground">We take a single still photo from your camera and check it is a live person matching the photo you chose. Successful checks activate your blue tick automatically.</p>
            <p className="mt-2 text-xs text-muted-foreground">Changing your main profile photo later means verifying again. This badge does not verify your legal identity.</p>
            <ul className="mt-4 space-y-2.5">{tips.map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-3 text-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Icon size={17}/></span>{text}</li>)}</ul>
          </div>

          <label className="flex cursor-pointer gap-3 rounded-2xl bg-card p-4 text-[13px] leading-5 text-muted-foreground ring-1 ring-border has-[:checked]:ring-primary/60">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} data-testid="checkbox-consent" aria-label="I consent to face verification" className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]"/>
            <span><LockKeyhole size={13} className="mr-1 inline text-primary"/>I agree to have my photo and live selfie checked to confirm this is me.</span>
          </label>

          <button type="button" onClick={() => void openCamera()} disabled={!consent || !selectedChoice || uploading} data-testid={phase === 'failed' ? 'button-retry-verification' : 'button-open-camera'} aria-label={phase === 'failed' ? 'Try verification again' : 'Open camera'} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-primary-foreground transition-transform active:scale-[.98] disabled:opacity-45">
            {phase === 'failed' ? <><RotateCcw size={18}/>Try again</> : <><Camera size={18}/>Open camera</>}
          </button>
          {!selectedChoice && <p className="text-center text-xs text-muted-foreground">Choose a photo above to continue.</p>}
        </section>}
    </div>
  </div>;
}
