import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Camera, Lightbulb, LoaderCircle, LockKeyhole, RotateCcw, ScanFace, ShieldCheck, UserRound, Users, Hand, ImagePlus } from 'lucide-react';
import {
  getGetDiscoverProfilesQueryKey, getGetFaceVerificationStatusQueryKey, getGetMatchesQueryKey, getGetMyProfileQueryKey, getGetProfileMediaQueryKey,
  useCompleteFaceVerification, useGetFaceVerificationStatus, useGetMyProfile, useGetProfileMedia, useStartFaceVerification,
} from '@workspace/api-client-react';
import { userErrorMessage } from '@/lib/user-errors';

type Phase = 'intro' | 'opening' | 'live' | 'submitting' | 'failed' | 'success';
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

function MainPhoto({ reference, name }: { reference?: string; name: string }) {
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
  { icon: Camera, text: 'Hold still while you take the photo' },
];

export default function FaceVerificationPage() {
  const qc = useQueryClient();
  const profile = useGetMyProfile();
  const status = useGetFaceVerificationStatus({ query: { queryKey: getGetFaceVerificationStatusQueryKey(), staleTime: 0 } });
  const start = useStartFaceVerification();
  const complete = useCompleteFaceVerification();

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

  async function openCamera() {
    if (busy.current || !consent) return;
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
        s = await start.mutateAsync({ data: { consent: true } });
        session.current = s;
      }
      const result = await complete.mutateAsync({ sessionId: s.sessionId, data: blob });
      session.current = null;
      if (result.verified === true) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
          qc.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() }),
          qc.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
          qc.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
        ]);
        setPhase('success');
      } else {
        setError('We couldn’t confirm it’s you this time. Try again facing the camera in good light.');
        setPhase('failed');
      }
    } catch (e) {
      session.current = null;
      const st = e && typeof e === 'object' && 'status' in e ? (e as { status: unknown }).status : undefined;
      setError(apiMessage(e, st === 410 || st === 404 ? 'Your verification session expired. Start again for a fresh one.' : 'Verification didn’t go through. Please try again.'));
      setPhase('failed');
    } finally { busy.current = false; }
  }

  const p = profile.data;
  const s = status.data;
  const loading = profile.isLoading || status.isLoading;
  const verified = phase === 'success' || s?.verified === true;
  const hasPhoto = !!s?.hasPhoto && !!p?.photos?.[0];

  return <div className="page-in min-h-[100dvh] bg-[radial-gradient(120%_60%_at_50%_0%,hsl(var(--accent)),hsl(var(--background))_65%)] text-foreground">
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-5">
      <header className="mb-6 grid grid-cols-[44px_1fr_44px] items-center">
        <Link href="/settings" onClick={release} aria-label="Back to settings" data-testid="link-verify-back" className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary ring-1 ring-border transition-transform hover:-translate-x-0.5"><ArrowLeft size={19}/></Link>
        <h1 className="brand text-center text-xl font-extrabold">Face verification</h1><span/>
      </header>

      {loading ? <div className="space-y-4" aria-label="Loading verification">{[0,1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-3xl bg-card/70"/>)}</div>
      : status.isError || profile.isError ? <div role="alert" className="rounded-3xl border border-border bg-card p-6 text-center"><p className="text-sm text-muted-foreground">{apiMessage(status.error ?? profile.error, 'We couldn’t load verification right now.')}</p><button type="button" data-testid="button-retry-status" onClick={() => { void status.refetch(); void profile.refetch(); }} className="mt-4 rounded-xl bg-secondary px-4 py-2 text-sm font-bold">Try again</button></div>
      : verified ? <section className="flex flex-1 flex-col items-center justify-center text-center" data-testid="state-verified">
          <div className="relative h-36 w-36 overflow-hidden rounded-full ring-4 ring-primary/70"><MainPhoto reference={p?.photos?.[0]} name={p?.name ?? ''}/></div>
          <div className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background"><BadgeCheck size={22}/></div>
          <h2 className="brand mt-5 text-3xl font-extrabold">You’re verified</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Your verified badge is visible to other members. Face verification checks your main profile photo, not your legal identity.</p>
          <Link href="/settings" data-testid="link-verify-done" className="mt-8 w-full rounded-full bg-primary py-4 text-center font-bold text-primary-foreground">Done</Link>
        </section>
      : !s?.available ? <div role="status" className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground"><ShieldCheck className="mx-auto mb-3 text-primary"/>Face verification isn’t available right now. Please check back later.</div>
      : !hasPhoto ? <section className="rounded-3xl border border-dashed border-primary/40 bg-card p-7 text-center" data-testid="state-no-photo">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary"><ImagePlus size={24}/></div>
          <h2 className="mt-4 text-lg font-bold">Add a main photo first</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">We compare your selfie with your main profile photo, so you’ll need one that clearly shows your face.</p>
          <Link href={`/profile/edit?returnTo=${encodeURIComponent('/verify-profile')}`} data-testid="link-add-photo" className="mt-5 inline-flex rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Add a photo</Link>
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
          <div className="relative h-32 w-32 overflow-hidden rounded-full ring-2 ring-primary/40"><MainPhoto reference={p?.photos?.[0]} name={p?.name ?? ''}/><div className="absolute inset-0 animate-pulse bg-primary/20"/></div>
          <LoaderCircle className="mt-6 animate-spin text-primary"/>
          <h2 className="mt-3 text-lg font-bold">Checking your photo</h2>
          <p className="mt-1 text-sm text-muted-foreground">This usually takes a few seconds.</p>
        </section>
      : <section className="space-y-5">
          <div className="flex items-center gap-4 rounded-3xl bg-card p-4 ring-1 ring-border">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-accent"><MainPhoto reference={p?.photos?.[0]} name={p?.name ?? ''}/></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Your main photo</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Your selfie will be compared with this photo. <Link href={`/profile/edit?returnTo=${encodeURIComponent('/verify-profile')}`} className="font-semibold text-primary underline-offset-4 hover:underline">Change it</Link></p></div>
          </div>

          {phase === 'failed' && error && <div role="alert" data-testid="verify-error" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground">{error}</div>}

          <div>
            <h2 className="brand text-2xl font-extrabold">Show it’s really you</h2>
            <p className="mt-1 text-sm text-muted-foreground">Take one live selfie. A few tips for a quick pass:</p>
            <p className="mt-2 text-xs text-muted-foreground">Changing your main profile photo means verifying again. This badge does not verify your legal identity.</p>
            <ul className="mt-4 space-y-2.5">{tips.map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-3 text-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Icon size={17}/></span>{text}</li>)}</ul>
          </div>

          <label className="flex cursor-pointer gap-3 rounded-2xl bg-card p-4 text-[13px] leading-5 text-muted-foreground ring-1 ring-border has-[:checked]:ring-primary/60">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} data-testid="checkbox-consent" aria-label="I consent to face verification" className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]"/>
            <span><LockKeyhole size={13} className="mr-1 inline text-primary"/>I agree that my live selfie and my main profile photo are sent to Luxand.cloud to check liveness and that the faces match. Myage does not save the selfie.</span>
          </label>

          <button type="button" onClick={() => void openCamera()} disabled={!consent} data-testid={phase === 'failed' ? 'button-retry-verification' : 'button-open-camera'} aria-label={phase === 'failed' ? 'Try verification again' : 'Open camera'} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-primary-foreground transition-transform active:scale-[.98] disabled:opacity-45">
            {phase === 'failed' ? <><RotateCcw size={18}/>Try again</> : <><Camera size={18}/>Open camera</>}
          </button>
          <p className="text-center text-xs text-muted-foreground">Photos from your gallery can’t be used for verification.</p>
        </section>}
    </div>
  </div>;
}
