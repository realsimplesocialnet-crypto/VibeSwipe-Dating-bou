import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, useClerk, useSignUp, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  getGetBlockedProfilesQueryKey, getGetChatReadReceiptQueryKey, getGetDailyLikeStatusQueryKey,
  getGetDiscoverProfilesQueryKey, getGetMatchesQueryKey, getGetMessagesQueryKey, getGetBoostStatusQueryKey,
  getStreamMatchMessagesQueryKey, getGetTypingStatusQueryKey,
  getGetMyProfileQueryKey, getGetNotificationsQueryKey, getGetOnboardingDraftQueryKey, getGetProfileMediaQueryKey,
  getGetProfileByIdQueryKey, getGetStoriesQueryKey, getGetSuperLikeStatusQueryKey, getGetVibeSwipeSettingsQueryKey,
  getGetWhoViewedYouQueryKey, getGetMatchPresenceQueryKey,
  useActivateBoost, useBlockProfile, useClearChat,
  useClearOnboardingDraft, useCreateReaction, useDeleteChat, useDeleteMessage,
  useGetBoostStatus, useGetChatReadReceipt, useGetDailyLikeStatus,
  useGetDiscoverProfiles, useGetIcebreakers, useGetMatches, useGetMessages, useGetMyProfile,
  useGetNotifications, useGetOnboardingDraft, useGetProfileById, useGetProfileMedia, useGetStories, useGetSuperLikeStatus, useGetVibeSwipeSettings,
  useGetTypingStatus, useGetMatchPresence, useGetWhoViewedYou, useMarkChatRead,
  useMarkNotificationRead, useRecordProfileView, useReportProfile, useSaveMyProfile,
  useSaveOnboardingDraft, useSendMessage, useTranscodeProfileVideo, useUnblockProfile,
  useUndoLastPass, useUnmatchMatch, useUpdateChatTheme, useUpdateTypingStatus, useHeartbeatPresence,
  useRequestChatMediaUpload, useRequestProfileMediaUpload,
  type ChatTheme, type Message, type Profile, type ProfileInput, type ReportInputReason, type MediaUploadInputContentType,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowLeft, ArrowRight, Bell, Check, ChevronDown, ChevronRight, CircleHelp, Compass, Eye, EyeOff,
  Heart, ImagePlus, LogOut, MapPin, MessageCircle, MoreHorizontal, Navigation, Search, Settings,
  Shield, SlidersHorizontal, Sparkles, Star, UserRound, Users, Volume2, X, Zap,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import SafetyCenterPage from '@/pages/safety-center';
import CommunityGuidelinesPage from '@/pages/community-guidelines';
import PrivacyPolicyPage from '@/pages/privacy-policy';
import ReportSafetyPage from '@/pages/report-safety';
import PublicLocationSharePage from '@/pages/public-location-share';
import { InstallAction } from '@/components/install-action';
import { InstalledWelcome } from '@/components/installed-welcome';
import { DiscoverSwipePage } from '@/components/discover-swipe-page';
import { MatchStoryAvatar, StoryComposerPage } from '@/components/stories/stories-ui';
import { SignupPasswordField } from '@/components/signup-password-field';
import { ProfileFirstSignup } from '@/components/profile-first-signup';
import { LocationChoice } from '@/components/location-choice';
import { HobbyMultiSelect, OccupationSelect } from '@/components/profile-field-selectors';
import { ConnectionNotice } from '@/components/connection-notice';
import { isDiscoverSetupRequired, isProfileMissing, shouldRetryDiscover, shouldRetryProfile } from '@/lib/profile-query-state';
import { PROFILE_PHOTO_ACCEPT, photoUploadCanRetry, prepareProfilePhoto, uploadProfilePhotoBytes, validatePhotoFile } from '@/lib/profile-photo-upload';
import { userErrorMessage } from '@/lib/user-errors';
import { SettingsIndexPage, SettingsSectionPage } from '@/components/settings/settings-pages';
import '@/styles/landing.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 12_000, retry: 1 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const pathFor = (path: string) => `${basePath}${path === '/' ? '/' : path}`;
function safeAppReturnPath(value: string | null, fallback: string) {
  if (!value || value.startsWith('//')) return fallback;
  try {
    const resolved = new URL(value, window.location.origin);
    if (resolved.origin !== window.location.origin) return fallback;
    const pathname = basePath && resolved.pathname.startsWith(basePath)
      ? resolved.pathname.slice(basePath.length) || '/'
      : resolved.pathname;
    return `${pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
const mediaUrl = (ref?: string | null) => ref ? (ref.startsWith('http') ? ref : ref.startsWith('media:') ? `/api/vibeswipe/media/${encodeURIComponent(ref.slice(6))}` : ref.startsWith('demo:') ? '' : `/api/storage${ref.startsWith('/') ? ref : `/${ref}`}`) : '';

const appearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#f34e9a', colorForeground: '#f5edf1', colorMutedForeground: '#a79ca5', colorDanger: '#f06b76', colorBackground: '#211d25', colorInput: '#19161c', colorInputForeground: '#f5edf1', colorNeutral: '#f5edf1', fontFamily: 'DM Sans', borderRadius: '14px' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#211d25] rounded-2xl w-[440px] max-w-full overflow-hidden border border-white/10',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#fff2f7] font-bold', headerSubtitle: 'text-[#b9adb6]', socialButtonsBlockButtonText: 'text-[#f6edf2]',
    formFieldLabel: 'text-[#e7dce3]', footerActionLink: 'text-[#ff6bad]', footerActionText: 'text-[#a99ca6]',
    dividerText: 'text-[#a99ca6]', identityPreviewEditButton: 'text-[#ff6bad]', formFieldSuccessText: 'text-[#8dd6b4]',
    alertText: 'text-[#ffe6ea]', logoBox: 'rounded-xl', logoImage: 'rounded-lg', socialButtonsBlockButton: 'border-white/10 bg-[#2b2630]',
    formButtonPrimary: 'bg-[#f34e9a] hover:bg-[#ff68aa] text-[#21111a]', formFieldInput: 'bg-[#19161c] border-white/10 text-[#f5edf1]',
    footerAction: 'bg-transparent', dividerLine: 'bg-white/10', alert: 'bg-[#40252d] border-[#7e3b4a]',
    otpCodeFieldInput: 'bg-[#19161c] border-white/10 text-white', formFieldRow: 'gap-2', main: 'bg-transparent',
  },
};

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="inline-flex items-center gap-2.5" data-testid="link-brand">
    <img src={pathFor('/icon.png')} alt="" className="h-9 w-9 rounded-xl ring-1 ring-white/10" />
    {!compact && <span className="brand text-[21px] font-extrabold text-foreground">My<span className="text-primary">age</span></span>}
  </Link>;
}

const navItems = [
  { href: '/discover', label: 'Discover', icon: Compass }, { href: '/matches', label: 'Matches', icon: Heart },
  { href: '/views', label: 'Views', icon: Eye }, { href: '/notifications', label: 'Activity', icon: Bell },
];

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const showMainNavigation = ['/discover', '/matches', '/views', '/notifications', '/profile'].includes(location);
  const settingsReturnTo = `${location}${window.location.search}${window.location.hash}`;
  const { user } = useUser();
  const profile = useGetMyProfile();
  const { signOut } = useClerk();
  const activeName = profile.data?.name || user?.firstName || 'Your profile';
  return <div className="min-h-[100dvh] bg-background text-foreground">
    {showMainNavigation && <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-background px-5 py-6 lg:flex">
        <Brand />
        <div className="mb-4 mt-11 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">Your space</div>
        <nav className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${location === href || (href === '/matches' && location.startsWith('/chat/')) ? 'bg-accent text-[#ff80b6]' : 'text-muted-foreground hover:bg-white/[.04] hover:text-foreground'}`}><Icon size={18}/>{label}</Link>)}
        </nav>
        <div className="mt-auto space-y-2 border-t border-white/[.08] pt-4">
          <Link href="/profile" data-testid="nav-profile" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${location === '/profile' ? 'bg-accent text-[#ff80b6]' : 'text-muted-foreground hover:bg-white/[.04]'}`}><UserRound size={18}/><span className="truncate">{activeName}</span></Link>
          <Link href={`/settings?returnTo=${encodeURIComponent(settingsReturnTo)}`} data-testid="nav-settings" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-white/[.04]"><Settings size={18}/>Settings</Link>
          <InstallAction className="px-1 pt-2"/>
          <button onClick={() => void signOut({ redirectUrl: pathFor('/') })} data-testid="button-sign-out" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground hover:bg-white/[.04]"><LogOut size={17}/>Sign out</button>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-[66px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden">
        <Brand compact/><span className="brand text-lg font-extrabold">vibe<span className="text-primary">swipe</span></span><InstallAction/>
      </header>
    </>}
    <main className={showMainNavigation ? "min-h-[calc(100dvh-66px)] pb-24 lg:ml-[248px] lg:min-h-[100dvh] lg:pb-0" : "min-h-[100dvh]"}>{children}</main>
    {showMainNavigation && <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl lg:hidden">
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`mobile-nav-${label.toLowerCase()}`} className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-semibold ${location === href || (href === '/matches' && location.startsWith('/chat/')) ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={19}/>{label}</Link>)}
      <Link href="/profile" data-testid="mobile-nav-profile" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-semibold ${location === '/profile' ? 'text-primary' : 'text-muted-foreground'}`}><UserRound size={19}/>Profile</Link>
    </nav>}
  </div>;
}

function Gate({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/welcome"/></Show></>;
}
function RequiredProfile({ children }: { children: ReactNode }) {
  const profile=useGetMyProfile<Profile>({query:{retry:shouldRetryProfile,staleTime:0,refetchOnMount:'always'}});
  if(profile.isError&&isProfileMissing(profile.error))return <Redirect to="/onboarding"/>;
  if(profile.isLoading||!profile.data)return <div className="min-h-[100dvh] bg-background text-foreground"><header className="p-6"><Brand/></header><PageFrame>{profile.isError?<Retry text="We couldn’t check your profile. Check your connection and try again." onRetry={()=>void profile.refetch()}/>:<ProfileLoading/>}</PageFrame></div>;
  return <AppShell>{children}</AppShell>;
}
function ShellPage({ children }: { children: ReactNode }) { return <Gate><RequiredProfile>{children}</RequiredProfile></Gate>; }

function Landing() {
  const { isSignedIn } = useUser();
  if (isSignedIn) return <Redirect to="/discover"/>;
  const principles = [
    { n: '01', icon: UserRound, title: 'A fuller picture', copy: 'Photos are the start. Your words and interests make a profile yours.' },
    { n: '02', icon: Heart, title: 'A mutual yes', copy: 'Only a mutual match opens the door to a conversation.' },
    { n: '03', icon: Shield, title: 'Room to be real', copy: 'Block, report or take a pause. Your boundaries stay in your hands.' },
  ];
  return <div className="landing grain min-h-[100dvh] overflow-x-hidden">
    <header className="landing-header mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 md:px-10">
      <Brand/>
      <nav className="flex items-center gap-1.5 sm:gap-2">
        <Link href="/sign-in" data-testid="link-sign-in" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:px-4">Sign in</Link>
        <Link href="/sign-up" data-testid="link-sign-up" className="whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-[#25111d] transition-colors hover:bg-[#ff68aa]">Join<span className="hidden sm:inline"> Myage</span></Link>
      </nav>
    </header>

    <section className="landing-rise mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-8 md:grid-cols-[1.1fr_.9fr] md:items-center md:gap-16 md:px-10 md:pb-24 md:pt-16">
      <div>
        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.2em] text-[#ff91c1]"><span className="h-px w-8 bg-primary"/>For adults who mean it</div>
        <h1 className="brand mt-6 text-[clamp(2.75rem,11vw,5.6rem)] font-extrabold leading-[1.02] tracking-[-.055em] text-[#fff3f8]">Less swiping.<br/><span className="text-primary">More feeling.</span></h1>
        <p className="mt-6 max-w-[460px] text-[17px] leading-[1.7] text-[#c3b7c0]">Meet people who show up as themselves. Make a real connection, then let the conversation take its time.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/sign-up" data-testid="button-start-meeting" className="inline-flex items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-4 text-[15px] font-bold text-[#24111b] transition-colors hover:bg-[#ff68aa]">Find your person <ArrowRight size={17}/></Link>
          <InstallAction/>
        </div>
      </div>

      <div className="w-full md:max-w-[420px] md:justify-self-end">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1d1a21]">
          <div className="relative aspect-[4/3.4] overflow-hidden bg-[linear-gradient(160deg,#3c2836,#874a62_55%,#c27c84)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_22%,rgba(255,215,190,.45),transparent_40%)]"/>
            <div className="absolute left-1/2 top-[16%] h-[44%] w-[40%] -translate-x-1/2 rounded-[48%_48%_42%_42%] bg-[linear-gradient(160deg,#e6a98b,#a35d57)]"/>
            <div className="absolute bottom-0 left-1/2 h-[42%] w-[72%] -translate-x-1/2 rounded-t-[46%] bg-[linear-gradient(160deg,#e0c1b6,#915561_75%)]"/>
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1d1a21] to-transparent"/>
            <div className="absolute inset-x-5 top-5 flex gap-1.5"><span className="h-1 flex-1 rounded-full bg-white/90"/><span className="h-1 flex-1 rounded-full bg-white/30"/><span className="h-1 flex-1 rounded-full bg-white/30"/></div>
          </div>
          <div className="px-6 pb-6 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-[.18em] text-muted-foreground">Illustrative profile</div>
            <div className="brand mt-2 text-2xl font-bold text-[#fff2f7]">A little about me</div>
            <p className="mt-1 text-sm text-[#c3b7c0]">Good conversation, always.</p>
          </div>
          <div className="grid border-t border-white/[.08] sm:grid-cols-2">
            <div className="flex gap-3 px-6 py-5"><Heart size={17} className="mt-0.5 shrink-0 fill-primary text-primary"/><div><div className="text-sm font-bold">A better first hello</div><p className="mt-1 text-[13px] leading-5 text-muted-foreground">Start with more than a photo.</p></div></div>
            <div className="flex gap-3 border-t border-white/[.08] px-6 py-5 sm:border-l sm:border-t-0"><Shield size={17} className="mt-0.5 shrink-0 text-[#86d9b6]"/><div><div className="text-sm font-bold">Your boundaries</div><p className="mt-1 text-[13px] leading-5 text-muted-foreground">Block, report or pause.</p></div></div>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 md:px-10">
      <dl className="grid grid-cols-3 border-y border-white/[.08]">
        {[['18+','Adults only'],['Mutual','Matches to message'],['Your call','Privacy controls']].map(([v,l],i)=><div key={v} className={`py-6 pr-2 ${i>0?'border-l border-white/[.08] pl-4 md:pl-8':''}`}><dt className="text-[12px] leading-5 text-muted-foreground md:text-sm">{l}</dt><dd className="brand order-first mt-1 text-lg font-bold text-foreground md:text-2xl">{v}</dd></div>)}
      </dl>
    </section>

    <section className="mx-auto max-w-6xl px-5 py-20 md:px-10 md:py-28">
      <div className="grid gap-10 md:grid-cols-[.8fr_1.2fr] md:gap-16">
        <div><span className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">A different kind of spark</span><h2 className="brand mt-4 max-w-sm text-[2.1rem] font-bold leading-[1.12] tracking-[-.045em] md:text-[2.6rem]">Chemistry starts with showing up.</h2></div>
        <div className="divide-y divide-white/[.08] border-y border-white/[.08]">
          {principles.map(({n,icon:Icon,title,copy})=><article key={n} className="grid grid-cols-[auto_1fr] gap-5 py-7"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/[.08] text-primary"><Icon size={18}/></div><div><div className="flex items-baseline gap-3"><span className="text-xs font-bold tabular-nums text-primary">{n}</span><h3 className="text-lg font-bold">{title}</h3></div><p className="mt-2 max-w-md text-[15px] leading-7 text-muted-foreground">{copy}</p></div></article>)}
        </div>
      </div>
    </section>

    <section className="mx-auto mb-16 max-w-6xl px-5 md:px-10">
      <div className="rounded-[28px] border border-white/[.09] bg-[linear-gradient(135deg,#231d27,#2a1c26)] px-6 py-12 md:px-14 md:py-16">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div><span className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">The next good thing</span><h2 className="brand mt-4 text-[2.1rem] font-bold leading-[1.1] tracking-[-.045em] md:text-5xl">Make space for a spark.</h2><p className="mt-3 text-[15px] text-muted-foreground">Myage is for adults 18 and over.</p></div>
          <Link href="/sign-up" data-testid="button-join-bottom" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-bold text-[#24111b] transition-colors hover:bg-[#ff68aa] sm:w-auto">Create your profile <ArrowRight size={16}/></Link>
        </div>
      </div>
    </section>

    <footer className="mx-auto flex max-w-6xl flex-col gap-5 border-t border-white/[.08] px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-10"><Brand/><span>Genuine connection, with your safety in mind.</span><div className="flex flex-wrap gap-5"><Link href="/privacy-policy" data-testid="footer-privacy" className="hover:text-foreground">Privacy Policy</Link><Link href="/terms" data-testid="footer-terms" className="hover:text-foreground">Terms</Link><Link href="/sign-in" data-testid="footer-signin" className="hover:text-foreground">Sign in</Link><Link href="/sign-up" data-testid="footer-signup" className="hover:text-foreground">Join</Link></div></footer>
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">{eyebrow}</div><h1 className="brand mt-2 text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}</div>;
}
function PageFrame({ children }: { children: ReactNode }) { return <div className="page-in mx-auto max-w-[1200px] px-4 py-7 md:px-8 md:py-10">{children}</div>; }
function Busy({ label = 'Loading' }: { label?: string }) { return <div className="space-y-4" aria-label={label}>{[0,1,2].map(i=><div key={i} className="h-24 animate-pulse rounded-2xl border border-white/[.05] bg-white/[.035]"/>)}</div>; }
function Retry({ onRetry, text = 'We couldn’t load this screen. Check your connection and try again.', error }: { onRetry: () => void; text?: string; error?: unknown }) { return <div role="alert" className="rounded-2xl border border-white/10 bg-card p-7 text-center"><p className="text-sm text-muted-foreground">{userErrorMessage(error,text)}</p><button type="button" onClick={onRetry} data-testid="button-retry" className="mt-4 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold">Try again</button></div>; }
function Avatar({ profile, size = 'md' }: { profile: Profile; size?: 'sm'|'md'|'lg' }) {
  const [broken,setBroken]=useState(false); const src=mediaUrl(profile.photos?.[0]); const classes=size==='lg'?'h-24 w-24 text-2xl':size==='sm'?'h-11 w-11 text-sm':'h-14 w-14 text-lg';
  useEffect(()=>setBroken(false),[profile.photos?.[0]]);
  return <div className={`${classes} shrink-0 overflow-hidden rounded-full bg-[linear-gradient(145deg,#703a58,#302333)] ring-1 ring-white/10`} data-testid={`avatar-${profile.id}`}>{src&&!broken?<MediaImage reference={profile.photos?.[0]} onError={()=>setBroken(true)} className="h-full w-full object-cover" alt={`${profile.name}'s profile`}/>:<span className="flex h-full items-center justify-center font-bold text-[#ffd3e6]">{profile.name?.slice(0,1)?.toUpperCase()||'V'}</span>}</div>;
}
function MediaImage({reference,className,alt,onError}:{reference?:string;className:string;alt:string;onError?:()=>void}) {
  const id=reference?.startsWith('media:')?reference.slice(6):'';
  const media=useGetProfileMedia(id,{query:{enabled:!!id,queryKey:getGetProfileMediaQueryKey(id)}});
  const [objectUrl,setObjectUrl]=useState('');
  useEffect(()=>{if(!media.data)return;const url=URL.createObjectURL(media.data);setObjectUrl(url);return()=>URL.revokeObjectURL(url)},[media.data]);
  const src=id?objectUrl:mediaUrl(reference);
  return src?<img src={src} onError={onError} className={className} alt={alt}/>:null;
}
function Empty({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) { return <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[.02] px-6 py-14 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary"><Sparkles size={23}/></div><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{detail}</p>{action&&<div className="mt-5">{action}</div>}</div>; }

export function LegacyDiscoverPage() {
  const qc=useQueryClient(); const [index,setIndex]=useState(0); const [ageMin,setAgeMin]=useState(22); const [ageMax,setAgeMax]=useState(35); const [gender,setGender]=useState('Everyone'); const [city,setCity]=useState(''); const [filters,setFilters]=useState(false); const [detail,setDetail]=useState(false); const [notice,setNotice]=useState(''); const [lastPass,setLastPass]=useState<string|null>(null);
  const params=useMemo(()=>({ageMin,ageMax,gender,...(city.trim()?{city:city.trim()}:{})}),[ageMin,ageMax,gender,city]);
  const discover=useGetDiscoverProfiles<Profile[]>(params,{query:{queryKey:getGetDiscoverProfilesQueryKey(params),refetchOnWindowFocus:false,retry:shouldRetryDiscover}});
  const profiles=discover.data??[]; const profile=profiles[index]; const reaction=useCreateReaction(); const undo=useUndoLastPass(); const likes=useGetDailyLikeStatus({query:{queryKey:getGetDailyLikeStatusQueryKey(),refetchInterval:60000}}); const superStatus=useGetSuperLikeStatus({query:{queryKey:getGetSuperLikeStatusQueryKey(),refetchInterval:60000}}); const boost=useGetBoostStatus({query:{queryKey:getGetBoostStatusQueryKey(),refetchInterval:10000}}); const activate=useActivateBoost(); const recordView=useRecordProfileView(); const block=useBlockProfile(); const report=useReportProfile(); const sentView=useRef(new Set<string>());
  useEffect(()=>{if(profile&&!profile.isDemo&&!sentView.current.has(profile.id)){sentView.current.add(profile.id);recordView.mutate({profileId:profile.id});}},[profile?.id]);
  async function act(type:'like'|'pass'|'super') {
    if(!profile)return;
    if(type==='like'&&likes.data?.remaining===0){setNotice('You have reached today’s like limit.');return}
    const current=profile; setIndex(v=>v+1); setNotice('');
    try {const result=await reaction.mutateAsync({data:{toUserId:current.id,type}}); setLastPass(type==='pass'?current.id:null); if(type==='like')void qc.invalidateQueries({queryKey:getGetDailyLikeStatusQueryKey()});if(type==='super')void qc.invalidateQueries({queryKey:getGetSuperLikeStatusQueryKey()});if(result.matched){await qc.invalidateQueries({queryKey:getGetMatchesQueryKey()});setNotice(`You and ${current.name} matched.`)}}
    catch{setIndex(v=>Math.max(0,v-1));setNotice('That swipe did not save. Try again.')}
  }
  async function blockCurrent(){if(!profile)return;if(!window.confirm(`Block ${profile.name}? You will no longer see each other or be able to chat.`))return;try{await block.mutateAsync({data:{targetUserId:profile.id}});setDetail(false);await qc.invalidateQueries({queryKey:getGetDiscoverProfilesQueryKey(params)});}catch{setNotice('Could not block this profile. Try again.')}}
  async function reportCurrent(reason:ReportInputReason){if(!profile)return;try{await report.mutateAsync({data:{targetUserId:profile.id,reason}});setNotice('Report received. Thank you for looking out for the community.');}catch{setNotice('Could not submit report. Try again.')}}
  if(discover.isLoading)return <PageFrame><PageHeading eyebrow="Discover" title="Finding your next spark"/><Busy/></PageFrame>;
  if(discover.isError&&isDiscoverSetupRequired(discover.error))return <Redirect to="/onboarding"/>;
  if(discover.isError)return <PageFrame><Retry onRetry={()=>void discover.refetch()} text="Discovery could not load right now."/></PageFrame>;
  if(!profile)return <PageFrame><PageHeading eyebrow="Discover" title="That's everyone for now" description="Try broadening your filters, or check back soon."/><Empty title="You’re all caught up" detail="Your next connection might be just outside your current filters." action={<button data-testid="button-open-filters-empty" onClick={()=>setFilters(true)} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-[#24111b]">Adjust filters</button>}/></PageFrame>;
  return <PageFrame><PageHeading eyebrow="Discover / a little serendipity" title="Meet someone new" description={`${likes.data?.remaining??'—'} likes left today · ${superStatus.data?.remaining??'—'} super likes available`} action={<div className="flex gap-2"><button disabled={!boost.data?.available||activate.isPending} onClick={()=>activate.mutate(undefined,{onSuccess:()=>{void qc.invalidateQueries({queryKey:getGetBoostStatusQueryKey()});setNotice('Your boost is active for 30 minutes.')}})} data-testid="button-activate-boost" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold disabled:opacity-40"><Zap size={15} className="text-amber-300"/>Boost</button><button onClick={()=>setFilters(true)} data-testid="button-discovery-filters" className="rounded-xl border border-white/10 p-2.5"><SlidersHorizontal size={17}/></button></div>}/>
    {notice&&<div role="status" data-testid="status-discover" className="mb-4 rounded-xl border border-primary/20 bg-accent px-4 py-3 text-sm text-[#ffafd1]">{notice}<button onClick={()=>setNotice('')} data-testid="button-dismiss-notice" className="float-right"><X size={16}/></button></div>}
    <div className="grid gap-5 lg:grid-cols-[minmax(360px,530px)_1fr]">
      <article className="relative min-h-[540px] overflow-hidden rounded-[30px] border border-white/10 bg-[#25202a] shadow-xl md:min-h-[630px]" onTouchStart={(e)=>{(e.currentTarget as HTMLElement).dataset.touchX=String(e.touches[0].clientX)}} onTouchEnd={(e)=>{const x=Number((e.currentTarget as HTMLElement).dataset.touchX);const dx=e.changedTouches[0].clientX-x;if(Math.abs(dx)>90)void act(dx>0?'like':'pass')}} data-testid={`card-discover-${profile.id}`}>
        {profile.photos?.[0]&&<MediaImage reference={profile.photos[0]} className="absolute inset-0 h-full w-full object-cover" alt={`${profile.name}${profile.age!==null?`, ${profile.age}`:''}`}/>}
        {!profile.photos?.[0]&&<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,#9f6076,#382b3a_55%,#1b1820)]"><div className="absolute left-[25%] top-[12%] h-[36%] w-[50%] rounded-[50%] bg-[linear-gradient(140deg,#d6a28c,#83515a)]"/><div className="absolute bottom-[-12%] left-[9%] h-[62%] w-[82%] rounded-t-[48%] bg-[linear-gradient(140deg,#d1b2a4,#745061)]"/></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-[#130f16] via-[#17121a]/10 to-[#17121a]/20"/>
        {profile.superLikedYou&&<span className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-xs font-bold text-amber-200 backdrop-blur"><Star size={14}/>Super liked you</span>}
        <button onClick={()=>setDetail(!detail)} data-testid="button-profile-details" aria-label="Profile details" className="absolute inset-0 z-[1]"/>
        <div className="absolute inset-x-5 bottom-24 z-[2] pointer-events-none"><div className="flex items-end gap-2"><h2 className="text-4xl font-bold tracking-tight">{profile.name}</h2>{profile.age!==null&&<span className="pb-1 text-2xl">{profile.age}</span>}</div><div className="mt-2 flex items-center gap-1.5 text-sm text-white/75"><MapPin size={14}/>{profile.city||'Nearby'}{profile.country?`, ${profile.country}`:''}</div><p className="mt-4 line-clamp-3 max-w-lg text-sm leading-6 text-white/85">{profile.bio}</p><div className="mt-3 flex flex-wrap gap-2">{profile.interests?.slice(0,4).map(i=><span key={i} className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs backdrop-blur">{i}</span>)}</div></div>
        <div className="absolute inset-x-0 bottom-0 z-[3] flex items-center justify-center gap-4 bg-gradient-to-t from-[#141117] via-[#141117]/80 to-transparent px-4 pb-5 pt-9">
          <button onClick={()=>void act('pass')} disabled={reaction.isPending} data-testid="button-pass-profile" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#28232d] text-muted-foreground hover:text-foreground"><X size={23}/></button>
          <button onClick={()=>{if(lastPass)undo.mutate(undefined,{onSuccess:async r=>{if(r.undone){setIndex(v=>Math.max(0,v-1));setLastPass(null);await qc.invalidateQueries({queryKey:getGetDiscoverProfilesQueryKey(params)})}}})}} disabled={!lastPass||undo.isPending} data-testid="button-undo-pass" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#28232d] text-muted-foreground disabled:opacity-40"><ArrowLeft size={17}/></button>
          <button onClick={()=>void act('super')} disabled={reaction.isPending||superStatus.data?.remaining===0} data-testid="button-super-like" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3c75c] text-[#211a11] shadow-lg disabled:opacity-40"><Star size={21}/></button>
          <button onClick={()=>void act('like')} disabled={reaction.isPending||likes.data?.remaining===0} data-testid="button-like-profile" className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[#27101d] shadow-[0_8px_30px_rgba(243,78,154,.32)] disabled:opacity-40"><Heart size={25} fill="currentColor"/></button>
        </div>
      </article>
      <aside className="hidden rounded-[28px] border border-white/[.08] bg-card p-7 lg:block">
        <div className="text-xs font-bold uppercase tracking-[.18em] text-primary">Your discovery</div><h3 className="brand mt-3 text-2xl font-bold">Curiosity looks good on you.</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Take a moment with the full profile. The best conversations often begin with one good detail.</p>
        <div className="mt-7 space-y-4 border-t border-white/[.08] pt-5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Likes remaining</span><strong>{likes.data?.remaining??'—'}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Super likes</span><strong>{superStatus.data?.remaining??'—'}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Boost</span><strong>{boost.data?.active?'Active':boost.data?.available?'Ready':'Cooling down'}</strong></div></div>
        <button onClick={()=>setDetail(true)} data-testid="button-open-full-profile" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-bold">Read {profile.name}’s profile <ArrowRight size={15}/></button>
        <div className="mt-7 rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-xs leading-5 text-muted-foreground"><div className="mb-2 flex items-center gap-2 font-bold text-foreground"><Shield size={14} className="text-[#8ed9b7]"/>Your safety is in your hands</div>Block or report any profile that crosses your boundaries.</div>
      </aside>
    </div>
    {detail&&<Dialog title={`${profile.name}${profile.age!==null?`, ${profile.age}`:''}`} onClose={()=>setDetail(false)}><div className="space-y-4"><p className="text-sm text-muted-foreground">{profile.city} · {profile.gender} · Looking for {profile.lookingFor}</p><p className="whitespace-pre-wrap text-sm leading-6">{profile.bio||'No bio added yet.'}</p><div className="flex flex-wrap gap-2">{profile.interests?.map(i=><span key={i} className="rounded-full bg-accent px-3 py-1.5 text-xs text-[#ffafd1]">{i}</span>)}</div><div className="grid grid-cols-2 gap-2 pt-2"><button onClick={()=>void reportCurrent('inappropriate')} data-testid="button-report-profile" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold">Report</button><button onClick={()=>void blockCurrent()} data-testid="button-block-profile" className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-semibold text-rose-300">Block profile</button></div></div></Dialog>}
    {filters&&<Dialog title="Discovery filters" onClose={()=>setFilters(false)}><div className="space-y-5"><div className="grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">Age from<input data-testid="input-filter-age-min" type="number" min="18" value={ageMin} onChange={e=>setAgeMin(Number(e.target.value))} className="field mt-2"/></label><label className="text-xs text-muted-foreground">Age to<input data-testid="input-filter-age-max" type="number" min={ageMin} value={ageMax} onChange={e=>setAgeMax(Number(e.target.value))} className="field mt-2"/></label></div><label className="block text-xs text-muted-foreground">Interested in<select data-testid="select-filter-gender" value={gender} onChange={e=>setGender(e.target.value)} className="field mt-2"><option>Everyone</option><option>Woman</option><option>Man</option><option>Non-binary</option></select></label><label className="block text-xs text-muted-foreground">City<input data-testid="input-filter-city" value={city} onChange={e=>setCity(e.target.value)} placeholder="Any city" className="field mt-2"/></label><button onClick={()=>{setIndex(0);setFilters(false)}} data-testid="button-apply-filters" className="w-full rounded-xl bg-primary py-3 font-bold text-[#27101d]">Show people</button></div></Dialog>}
  </PageFrame>;
}
function DiscoverPage(){return <DiscoverSwipePage/>}
function Dialog({ title, children, onClose }: { title:string; children:ReactNode; onClose:()=>void }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#211d25] p-5 shadow-2xl sm:rounded-[26px] sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="brand text-2xl font-bold">{title}</h2><button onClick={onClose} data-testid="button-close-dialog" aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"><X size={19}/></button></div>{children}</section></div>; }

function MatchesPage() {
  const qc=useQueryClient(); const [,setLocation]=useLocation(); const matches=useGetMatches({query:{refetchInterval:15000}}); const stories=useGetStories({query:{queryKey:getGetStoriesQueryKey(),refetchInterval:30000}}); const prompts=useGetIcebreakers(); const send=useSendMessage(); const block=useBlockProfile(); const report=useReportProfile(); const del=useDeleteChat(); const unmatch=useUnmatchMatch(); const [target,setTarget]=useState<Profile|null>(null);
  const refresh=async()=>Promise.all([qc.invalidateQueries({queryKey:getGetMatchesQueryKey()}),qc.invalidateQueries({queryKey:getGetBlockedProfilesQueryKey()})]);
  async function safety(action:'block'|'report',p:Profile){try{if(action==='block')await block.mutateAsync({data:{targetUserId:p.id}});if(action==='report')await report.mutateAsync({data:{targetUserId:p.id,reason:'other'}});setTarget(null);await refresh()}catch{window.alert(`Could not ${action} this profile. Try again.`)}}
  async function opener(matchId:string, content:string){try{await send.mutateAsync({matchId,data:{content}});await refresh()}catch{window.alert('Could not send that opener.')}}
  async function removeChat(id:string,kind:'delete'|'unmatch'){const msg=kind==='delete'?'Hide this conversation for you only?':'Unmatch? This removes the match and shared chat for both of you.';if(!window.confirm(msg))return;try{if(kind==='delete')await del.mutateAsync({matchId:id});else await unmatch.mutateAsync({matchId:id});await refresh()}catch{window.alert('That action could not be completed.')}}
  return <PageFrame>
    <div className="-mt-3" data-testid="matches-page-content">
      <h1 className="brand text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">Matches</h1>
      {matches.isLoading ? <div className="mt-6"><Busy /></div>
        : matches.isError ? <div className="mt-6"><Retry onRetry={() => void matches.refetch()} /></div>
        : matches.data?.length
          ? <div data-testid="section-matches-list" className="mt-6 grid gap-3 md:grid-cols-2">
            {matches.data.map(m => <article key={m.id} data-testid={`card-match-${m.id}`} className="rounded-[22px] border border-white/[.08] bg-card p-4 transition-colors hover:border-white/[.14]"><div className="flex items-start gap-3"><MatchStoryAvatar matchId={m.id} profile={m.profile} storyGroup={stories.data?.matches.find((group) => group.matchId === m.id)} disabled={m.blockedByMe || m.blockedMe} /><Link href={`/chat/${m.id}`} data-testid={`link-match-chat-${m.id}`} className={`flex min-w-0 flex-1 items-center gap-3 ${m.blockedByMe || m.blockedMe ? 'pointer-events-none opacity-60' : ''}`}><div className="min-w-0 flex-1"><div className="font-bold">{m.profile.name}{m.profile.age !== null && `, ${m.profile.age}`}</div>{(m.blockedByMe || m.blockedMe || m.lastMessage) && <div className={`mt-1 truncate text-xs ${m.blockedByMe || m.blockedMe ? 'text-rose-300' : 'text-muted-foreground'}`}>{m.blockedByMe ? 'Blocked by you' : m.blockedMe ? 'This person blocked you' : m.lastMessage}</div>}</div><MessageCircle size={18} className="text-primary" /></Link><Link href={`/profile/${m.profile.id}?returnTo=%2Fmatches`} data-testid={`link-match-profile-${m.id}`} aria-label={`View ${m.profile.name}’s profile`} className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"><UserRound size={18} /></Link><button onClick={() => setTarget(m.profile)} data-testid={`button-match-actions-${m.id}`} aria-label={`More actions for ${m.profile.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"><MoreHorizontal size={19} /></button></div>
              {!m.blockedByMe && !m.blockedMe && !m.lastMessage && prompts.data && prompts.data.length > 0 && <div className="mt-4 border-t border-white/[.07] pt-3"><button disabled={send.isPending} onClick={() => void opener(m.id, prompts.data[0].question)} data-testid={`button-icebreaker-${m.id}`} className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/[.035] p-3 text-left text-xs leading-5 hover:bg-white/[.06]"><span>{prompts.data[0].question}</span><ArrowRight size={14} className="shrink-0 text-primary" /></button></div>}
            </article>)}
          </div>
          : <div className="mt-7">
            <Link href="/discover" data-testid="link-discover-empty" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-[#26111b]">Explore profiles <ArrowRight size={16} /></Link>
          </div>}
    </div>
    {target&&<Dialog title={target.name} onClose={()=>setTarget(null)}><div className="space-y-2"><button onClick={()=>void safety('report',target)} data-testid="button-report-from-match" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Report profile</button><button onClick={()=>void safety('block',target)} data-testid="button-block-from-match" className="w-full rounded-xl border border-rose-400/20 p-3 text-left text-sm text-rose-300">Block profile</button>{matches.data?.find(m=>m.profile.id===target.id)&&<><button onClick={()=>void removeChat(matches.data!.find(m=>m.profile.id===target.id)!.id,'delete')} data-testid="button-delete-chat" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Delete chat for me</button><button onClick={()=>void removeChat(matches.data!.find(m=>m.profile.id===target.id)!.id,'unmatch')} data-testid="button-unmatch" className="w-full rounded-xl border border-rose-400/20 p-3 text-left text-sm text-rose-300">Unmatch both of you</button></>}</div></Dialog>}
  </PageFrame>;
}

function ChatPage({matchId}:{matchId:string}) {
  const qc=useQueryClient(); const profile=useGetMyProfile(); const matches=useGetMatches({query:{refetchInterval:12000}}); const match=matches.data?.find(m=>m.id===matchId); const blocked=!!match?.blockedByMe||!!match?.blockedMe;
  const msgs=useGetMessages(matchId,{query:{enabled:!!match,queryKey:getGetMessagesQueryKey(matchId),refetchInterval:10000}}); const typing=useGetTypingStatus(matchId,{query:{enabled:!!match,queryKey:['/api/vibeswipe/matches',matchId,'typing'],refetchInterval:3500}}); const receipt=useGetChatReadReceipt(matchId,{query:{enabled:!!match,queryKey:getGetChatReadReceiptQueryKey(matchId),refetchInterval:5000}}); const presence=useGetMatchPresence(matchId,{query:{enabled:!!match,queryKey:getGetMatchPresenceQueryKey(matchId),refetchInterval:15000}}); const heartbeat=useHeartbeatPresence();
  const ice=useGetIcebreakers({query:{enabled:!!match,queryKey:['/api/vibeswipe/icebreakers']}}); const send=useSendMessage(); const updateTyping=useUpdateTypingStatus(); const markRead=useMarkChatRead(); const del=useDeleteMessage(); const clear=useClearChat(); const unmatch=useUnmatchMatch(); const block=useBlockProfile(); const unblock=useUnblockProfile(); const report=useReportProfile(); const theme=useUpdateChatTheme(); const upload=useRequestChatMediaUpload(); const transcode=useTranscodeProfileVideo(); const [draft,setDraft]=useState(''); const [error,setError]=useState(''); const [actions,setActions]=useState(false); const [themeOpen,setThemeOpen]=useState(false); const [deleteTarget,setDeleteTarget]=useState<Message|null>(null); const [busy,setBusy]=useState(false); const bottom=useRef<HTMLDivElement>(null);
  const messages=(msgs.data??[]).slice().reverse(); const last=messages[messages.length-1];
  useEffect(()=>{if(last&&last.senderId!==profile.data?.id&&!last.isRead)markRead.mutate({matchId});},[last?.id,profile.data?.id]);
  useEffect(()=>{heartbeat.mutate({data:{isActive:true}});const beat=window.setInterval(()=>heartbeat.mutate({data:{isActive:document.visibilityState==='visible'}}),30000);const visibility=()=>heartbeat.mutate({data:{isActive:document.visibilityState==='visible'}});document.addEventListener('visibilitychange',visibility);return()=>{clearInterval(beat);document.removeEventListener('visibilitychange',visibility)}},[]);
  useEffect(()=>{if(blocked)return;const t=setTimeout(()=>updateTyping.mutate({matchId,data:{isTyping:!!draft.trim()}}),300);return()=>clearTimeout(t)},[draft,blocked,matchId]);
  useEffect(()=>{
    if(!match||blocked)return;
    const streamPath=getStreamMatchMessagesQueryKey(matchId)[0];
    const stream=new EventSource(streamPath,{withCredentials:true});
    stream.onmessage=(event)=>{
      try{
        const incoming=JSON.parse(event.data) as Message;
        if(incoming.matchId!==matchId)return;
        qc.setQueryData<Message[]>(getGetMessagesQueryKey(matchId),current=>{
          const byId=new Map((current??[]).map(message=>[message.id,message]));
          byId.set(incoming.id,incoming);
          return [...byId.values()].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
        });
      }catch{ /* Ignore an incomplete frame; the conversation query remains authoritative. */ }
    };
    const refreshTyping=()=>void qc.invalidateQueries({queryKey:getGetTypingStatusQueryKey(matchId)});
    const refreshRead=()=>void qc.invalidateQueries({queryKey:getGetChatReadReceiptQueryKey(matchId)});
    const refreshPresence=()=>void qc.invalidateQueries({queryKey:getGetMatchPresenceQueryKey(matchId)});
    stream.addEventListener('typing',refreshTyping);
    stream.addEventListener('read',refreshRead);
    stream.addEventListener('presence',refreshPresence);
    stream.onerror=()=>{ /* EventSource reconnects automatically and resumes with Last-Event-ID. */ };
    return()=>stream.close();
  },[matchId,Boolean(match),blocked,qc]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'})},[messages.length]);
  if(matches.isLoading||msgs.isLoading)return <PageFrame><div className="h-16 animate-pulse rounded-2xl bg-white/[.04]"/><div className="mt-6"><Busy/></div></PageFrame>;
  if(matches.isError&&!matches.data)return <PageFrame><Retry error={matches.error} text="We couldn’t load your conversations. Check your connection and try again." onRetry={()=>void matches.refetch()}/></PageFrame>;
  if(!match)return <PageFrame><Empty title="Conversation unavailable" detail="This chat may have ended or the match is no longer available." action={<Link href="/matches" data-testid="link-back-matches" className="rounded-xl bg-secondary px-4 py-2.5 font-bold">Back to matches</Link>}/></PageFrame>;
  async function sendMessage(content:string, media?:{mediaReference:string;mediaType:'image'|'video'|'audio'}){if(blocked||(!content.trim()&&!media)||send.isPending)return;const old=draft;setDraft('');try{await send.mutateAsync({matchId,data:{content:content.trim(),...media}});updateTyping.mutate({matchId,data:{isTyping:false}});void qc.invalidateQueries({queryKey:getGetMessagesQueryKey(matchId)});void qc.invalidateQueries({queryKey:getGetMatchesQueryKey()});setError('')}catch(error){setDraft(old);setError(userErrorMessage(error,'Your message wasn’t sent. Your text is still in the input—try sending again.'))}}
  async function deleteMessageFor(message:Message,forEveryone:boolean){try{await del.mutateAsync({matchId,messageId:message.id,data:{forEveryone}});if(!forEveryone)qc.setQueryData<Message[]>(getGetMessagesQueryKey(matchId),current=>(current??[]).filter(item=>item.id!==message.id));await msgs.refetch()}catch{setError('Message could not be deleted. Please try again.')}finally{setDeleteTarget(null)}}
  async function attach(file?:File){if(!file||blocked||busy||send.isPending)return;const kind=file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':'image';if(kind==='image'&&file.size>15*1024*1024){setError('Choose an image smaller than 15 MB.');return}if(kind==='video'&&file.size>500*1024*1024){setError('Choose a video smaller than 500 MB.');return}if(kind==='audio'&&file.size>25*1024*1024){setError('Choose an audio note smaller than 25 MB.');return}setBusy(true);setError('');try{const prepared=kind==='image'?await prepareProfilePhoto(file):file;const allowed:MediaUploadInputContentType[]=['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','audio/mp4','audio/m4a','audio/aac','audio/wav'];const fallback:MediaUploadInputContentType=kind==='image'?'image/jpeg':kind==='video'?'video/mp4':'audio/m4a';const contentType:MediaUploadInputContentType=allowed.includes(prepared.type as MediaUploadInputContentType)?prepared.type as MediaUploadInputContentType:fallback;const signed=await upload.mutateAsync({matchId,data:{name:prepared.name,size:prepared.size,contentType,mediaType:kind}});if(kind==='image')await uploadProfilePhotoBytes(signed.uploadURL,prepared);else{const res=await fetch(signed.uploadURL,{method:'PUT',headers:{'Content-Type':contentType},body:prepared});if(!res.ok)throw {status:res.status}}const mediaReference=kind==='video'?(await transcode.mutateAsync({mediaId:signed.mediaId})).mediaReference:signed.mediaReference;await sendMessage('',{mediaReference,mediaType:kind})}catch(error){setError(userErrorMessage(error,'Your attachment wasn’t sent. Choose the file again to retry.'))}finally{setBusy(false)}}
  async function action(a:string){if(!match)return;setActions(false);try{if(a==='block'){if(match.blockedByMe)await unblock.mutateAsync({targetUserId:match.profile.id});else if(window.confirm(`Block ${match.profile.name}?`))await block.mutateAsync({data:{targetUserId:match.profile.id}})}if(a==='report')await report.mutateAsync({data:{targetUserId:match.profile.id,reason:'other'}});if(a==='clear'){if(window.confirm('Clear messages from your view?')){await clear.mutateAsync({matchId});await qc.invalidateQueries({queryKey:getGetMessagesQueryKey(matchId)})}}if(a==='unmatch'){if(window.confirm('Unmatch and remove this shared chat?')){await unmatch.mutateAsync({matchId});void qc.invalidateQueries({queryKey:getGetMatchesQueryKey()})}}if(a==='theme')setThemeOpen(true)}catch{setError('That action did not complete. Please try again.')}}
  return <div className="mx-auto flex h-[100dvh] max-w-[1120px] flex-col px-3 py-3 md:px-7 md:py-6">
    <header className="flex items-center gap-3 border-b border-white/[.08] pb-4"><Link href="/matches" data-testid="link-chat-back" className="rounded-xl p-2 text-muted-foreground hover:bg-white/[.05]"><ArrowLeft size={19}/></Link><Avatar profile={match.profile} size="sm"/><div className="min-w-0 flex-1"><div className="font-bold">{match.profile.name}</div><div className="text-xs text-muted-foreground">{presence.data?.isOnline?<span className="text-emerald-300">Online</span>:presence.data?.lastSeenAt?`Last seen ${new Date(presence.data.lastSeenAt).toLocaleString()}`:'A conversation just for your mutual match'}</div></div><button onClick={()=>setActions(true)} data-testid="button-chat-actions" className="rounded-xl p-2 text-muted-foreground"><MoreHorizontal size={20}/></button></header>
    {blocked&&<div className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[.06] px-4 py-3 text-sm text-rose-200">Messaging is unavailable while this profile is blocked.</div>}
    {msgs.isError&&<button onClick={()=>void msgs.refetch()} data-testid="button-retry-messages" className="mt-2 rounded-lg bg-rose-300/10 p-2 text-xs text-rose-200">Messages failed to load. Tap to retry.</button>}
    <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto py-5">{!messages.length&&<div className="mx-auto max-w-sm py-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary"><MessageCircle size={22}/></div><h2 className="mt-4 font-bold">A good conversation starts here</h2><p className="mt-2 text-xs text-muted-foreground">A mutual match is an open door. Make the first message yours.</p><div className="mt-5 space-y-2">{ice.data?.slice(0,3).map(i=><button key={i.id} disabled={blocked||send.isPending} onClick={()=>void sendMessage(i.question)} data-testid={`button-chat-icebreaker-${i.id}`} className="w-full rounded-xl border border-white/10 bg-white/[.025] p-3 text-left text-xs hover:bg-white/[.05]">{i.question}</button>)}</div></div>}
      {messages.map(m=><div key={m.id} className={`group flex ${m.senderId===profile.data?.id?'justify-end':'justify-start'}`} data-testid={`message-${m.id}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 md:max-w-[65%] ${m.senderId===profile.data?.id?'bg-primary text-[#28111e]':'border border-white/[.08] bg-card'}`}>{m.deletedForEveryone?<span className="italic opacity-60">This message was deleted.</span>:<>{m.mediaType==='image'&&m.mediaReference&&<MediaImage reference={m.mediaReference} alt="Message attachment" className="mb-2 max-h-72 rounded-xl object-cover"/>}{m.mediaType==='video'&&m.mediaReference&&<video controls src={mediaUrl(m.mediaReference)} className="mb-2 max-h-72 rounded-xl"/>}{m.mediaType==='audio'&&<audio controls src={mediaUrl(m.mediaReference)} className="max-w-full"/>}{m.content}</>}<div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}{m.senderId===profile.data?.id&&m.isRead&&<span>Read</span>}<button onClick={()=>setDeleteTarget(m)} data-testid={`button-delete-message-${m.id}`} className="hidden group-hover:inline">Delete</button></div></div></div>)}
      {typing.data?.isTyping&&<div className="text-xs text-muted-foreground">{match.profile.name} is typing</div>}<div ref={bottom}/></div>
    {receipt.data?.readAt&&<div className="pb-2 text-right text-[10px] text-muted-foreground">Seen {new Date(receipt.data.readAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div>}
    {error&&<div role="alert" className="pb-2 text-xs text-rose-300">{error}</div>}
    <form onSubmit={e=>{e.preventDefault();if(!busy)void sendMessage(draft)}} className="flex items-end gap-2 border-t border-white/[.08] pt-3"><label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 text-muted-foreground hover:bg-white/[.04]" aria-label="Attach photo, video, or voice note"><ImagePlus size={18}/><input data-testid="input-chat-media" type="file" accept="image/*,video/mp4,video/quicktime,audio/*" className="hidden" disabled={blocked||busy||send.isPending} onChange={e=>{void attach(e.currentTarget.files?.[0]);e.currentTarget.value=''}}/></label><textarea data-testid="input-chat-message" value={draft} onChange={e=>setDraft(e.target.value)} disabled={blocked||busy||send.isPending} maxLength={2000} rows={1} placeholder={blocked?'Messaging unavailable':'Write a message'} className="field min-h-11 max-h-32 flex-1 resize-y py-3"/><button disabled={blocked||busy||send.isPending||(!draft.trim()&&!busy)} data-testid="button-send-message" className="h-11 rounded-xl bg-primary px-4 font-bold text-[#28111e] disabled:opacity-40">{busy?'Uploading':send.isPending?'Sending…':'Send'}</button></form>
    {actions&&<Dialog title="Conversation settings" onClose={()=>setActions(false)}><div className="space-y-2"><button onClick={()=>void action('theme')} data-testid="button-change-chat-theme" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Change chat color</button><button onClick={()=>void action('clear')} data-testid="button-clear-chat" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Clear chat for me</button><button onClick={()=>void action('report')} data-testid="button-report-chat-profile" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Report profile</button><button onClick={()=>void action('block')} data-testid="button-block-chat-profile" className="w-full rounded-xl border border-rose-300/20 p-3 text-left text-sm text-rose-300">{match.blockedByMe?'Unblock profile':'Block profile'}</button><button onClick={()=>void action('unmatch')} data-testid="button-chat-unmatch" className="w-full rounded-xl border border-rose-300/20 p-3 text-left text-sm text-rose-300">Unmatch</button></div></Dialog>}
    {themeOpen&&<Dialog title="Choose a chat color" onClose={()=>setThemeOpen(false)}><div className="grid grid-cols-2 gap-2">{(['pink','blue','purple','green','dark','light'] as ChatTheme[]).map(t=><button key={t} onClick={()=>theme.mutate({matchId,data:{theme:t}},{onSuccess:()=>{setThemeOpen(false);void qc.invalidateQueries({queryKey:getGetMatchesQueryKey()})}})} data-testid={`button-theme-${t}`} className="rounded-xl border border-white/10 p-3 text-sm font-semibold capitalize">{t}</button>)}</div></Dialog>}
    {deleteTarget&&<Dialog title="Delete message" onClose={()=>setDeleteTarget(null)}><p className="mb-4 text-sm text-muted-foreground">Choose whether to remove this message only for you or for everyone.</p><div className="space-y-2"><button disabled={del.isPending} onClick={()=>void deleteMessageFor(deleteTarget,false)} data-testid="button-delete-message-for-me" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Delete for me</button>{deleteTarget.senderId===profile.data?.id&&<button disabled={del.isPending} onClick={()=>void deleteMessageFor(deleteTarget,true)} data-testid="button-delete-message-for-everyone" className="w-full rounded-xl border border-rose-300/20 p-3 text-left text-sm text-rose-300">Delete for everyone</button>}</div></Dialog>}
  </div>;
}

function ViewsPage() {
  const q = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), refetchInterval: 30000 } });
  return <PageFrame>
    <div className="-mt-3" data-testid="views-page-content">
      <h1 className="brand text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">Who viewed you</h1>
      <div className="mt-6">
        {q.isLoading ? <Busy />
          : q.isError ? <Retry onRetry={() => void q.refetch()} />
          : !q.data?.length ? <Empty title="No views yet" detail="When someone opens your profile, they’ll appear here." />
          : <div className="space-y-2">{q.data.map(v => <Link key={`${v.profile.id}-${v.viewedAt}`} href={`/profile/${v.profile.id}?returnTo=%2Fviews`} data-testid={`link-viewer-${v.profile.id}`} className="flex items-center gap-4 rounded-2xl border border-white/[.08] bg-card p-4 hover:bg-white/[.04]"><span className="shrink-0 rounded-full border border-primary/75 p-[2px]"><Avatar profile={v.profile} /></span><div className="flex-1"><div className="font-bold">{v.profile.name}, {v.profile.age}</div><div className="mt-1 text-xs text-muted-foreground">{v.profile.city || 'Nearby'} · {new Date(v.viewedAt).toLocaleString()}</div></div><ChevronRight size={18} className="text-muted-foreground" /></Link>)}</div>}
      </div>
    </div>
  </PageFrame>;
}
function NotificationsPage() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const q = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), refetchInterval: 5000 } });
  const mark = useMarkNotificationRead();

  async function open(n: any) {
    if (!n.readAt) {
      try {
        await mark.mutateAsync({ notificationId: n.id });
        await qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      } catch {
        void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      }
    }
    if (n.matchId && (n.type === "new_match" || n.type === "new_message")) setLocation(`/chat/${n.matchId}`);
    else if (n.type === "new_match") setLocation("/matches");
    else if (n.type === "profile_view") setLocation(`/profile/${n.actor.id}/from-notifications`);
    else setLocation(`/profile/${n.actor.id}?returnTo=%2Fnotifications`);
  }

  const actionText = (n: any) => n.type === "new_match" ? "matched with you"
    : n.type === "new_message" ? "sent you a message"
    : n.type === "new_like" ? "liked you" : "viewed your profile";
  const timeAgo = (value: string) => {
    const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
    if (!Number.isFinite(elapsed)) return "";
    if (elapsed < 60_000) return "Just now";
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
    if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
    if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d ago`;
    return new Date(value).toLocaleDateString();
  };

  return <PageFrame>
    <div className="-mt-7" data-testid="notifications-page-content">
      <div className="mb-6">
        <h1 className="brand text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">Notifications</h1>
        {q.data && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{Object.values(q.data.unreadCounts ?? {}).reduce((a: any, b: any) => a + b, 0)} unread updates</p>}
      </div>
      {q.isLoading ? <Busy />
        : q.isError ? <Retry onRetry={() => void q.refetch()} />
        : !q.data?.notifications.length ? <Empty title="All caught up" detail="Your new matches, likes, messages, and profile views will show up here." />
        : <div className="space-y-3">
          {q.data.notifications.map((n) => <button
            key={n.id}
            onClick={() => void open(n)}
            data-testid={`button-notification-${n.id}`}
            aria-label={`${n.actor.name} ${actionText(n)}${n.readAt ? "" : ", unread"}`}
            className="flex w-full items-center gap-4 rounded-2xl border border-white/[.08] bg-card p-4 text-left transition-colors hover:bg-white/[.04]"
          >
            <span className="shrink-0 rounded-full border border-primary/75 p-[2px]"><Avatar profile={n.actor} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white"><span>{n.actor.name}</span>{" "}<span className="font-semibold">{actionText(n)}</span></span>
              <time dateTime={n.createdAt} className="mt-1 block text-xs text-muted-foreground">{timeAgo(n.createdAt)}</time>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            {!n.readAt && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </button>)}
        </div>}
    </div>
  </PageFrame>;
}

const emptyProfile:ProfileInput={name:'',age:18,gender:'',lookingFor:'Everyone',bio:'',city:'',country:null,state:null,interests:[],occupation:'Prefer not to say',occupationOther:'',photos:[],videoUrl:null,preferences:{ageMin:22,ageMax:35,gender:'Everyone',distanceKm:50}};
function ProfileLoading(){return <div role="status" aria-label="Loading your profile" className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-card px-6 py-12 text-sm text-muted-foreground"><span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-primary"/>Loading your profile…</div>}
function ProfilePage({mode='view',returnTo='/profile'}:{mode?:'view'|'edit';returnTo?:string}){const q=useGetMyProfile<Profile>({query:{refetchOnMount:'always',refetchOnWindowFocus:true,staleTime:0,retry:shouldRetryProfile}});const settings=useGetVibeSwipeSettings();const edit=mode==='edit';const [,setLocation]=useLocation();const [saveError,setSaveError]=useState('');const save=useSaveMyProfile();const requestUpload=useRequestProfileMediaUpload();const transcode=useTranscodeProfileVideo();const [uploading,setUploading]=useState(false);const qc=useQueryClient();const [form,setForm]=useState<ProfileInput>(emptyProfile);const [formReady,setFormReady]=useState(false);useEffect(()=>{if(q.data&&!formReady){setForm({...emptyProfile,...q.data,age:q.data.age??18,preferences:{...emptyProfile.preferences,...q.data.preferences},interests:q.data.interests??[],photos:q.data.photos??[]});setFormReady(true)}},[q.data,formReady]);const change=(key:keyof ProfileInput,value:any)=>setForm(v=>({...v,[key]:value}));
async function uploadProfileMedia(file?:File){if(!file||uploading)return;const video=file.type.startsWith('video/');setUploading(true);setSaveError('');try{if(!video)validatePhotoFile(file);const prepared=video?file:await prepareProfilePhoto(file);const contentType:MediaUploadInputContentType=video?(file.type==='video/quicktime'?'video/quicktime':'video/mp4'):'image/jpeg';const result=await requestUpload.mutateAsync({data:{name:prepared.name,size:prepared.size,contentType,mediaType:video?'video':'image'}});if(video){const uploaded=await fetch(result.uploadURL,{method:'PUT',headers:{'Content-Type':contentType},body:prepared});if(!uploaded.ok)throw {status:uploaded.status};const done=await transcode.mutateAsync({mediaId:result.mediaId});change('videoUrl',done.mediaReference)}else{await uploadProfilePhotoBytes(result.uploadURL,prepared);change('photos',[...form.photos,result.mediaReference].slice(0,6))}}catch(error){setSaveError(userErrorMessage(error,'Your picture could not be uploaded. Choose the photo again to retry.'))}finally{setUploading(false)}}
 async function submit(e:React.FormEvent){e.preventDefault();setSaveError('');if(!form.photos.length){setSaveError('Keep at least one profile photo. Add a photo before saving.');return}try{const updated=await save.mutateAsync({data:form});qc.setQueryData(getGetMyProfileQueryKey(),updated);void qc.invalidateQueries({queryKey:getGetMyProfileQueryKey()});setLocation(returnTo)}catch(error){setSaveError(userErrorMessage(error,'Your changes haven’t saved yet. Check your details and try again.'))}}
if(q.isError&&isProfileMissing(q.error))return <Redirect to="/onboarding"/>;
 const heading=edit?<><Link href={returnTo} data-testid="link-edit-profile-back" className="mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={17}/>{returnTo.startsWith('/settings')?'Back to Settings':'Back to Profile'}</Link><PageHeading eyebrow="Your profile" title="Edit profile" description="Update your photos and the details people see."/></>:<PageHeading eyebrow="You, in your own words" title="Your profile" description="The details that help a good conversation find its way." action={<Link href="/settings?returnTo=%2Fprofile" data-testid="link-profile-settings" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary"><Settings size={16}/>Settings</Link>}/>;
   return <PageFrame>{heading}{q.isLoading||edit&&!formReady?<ProfileLoading/>:q.isError&&!q.data?<Retry text={q.error?.status===401?'Your session has expired. Please sign in again.':'We couldn’t load your profile. Check your connection and try again.'} onRetry={()=>void q.refetch()}/>:!q.data?<Empty title="Your profile is waiting" detail="Finish a few details to begin discovering people." action={<Link href="/onboarding" data-testid="link-profile-onboarding" className="rounded-xl bg-primary px-4 py-3 font-bold text-[#26111b]">Set up profile</Link>}/>:<>{q.isRefetchError&&!edit&&<div role="alert" className="mb-4 rounded-xl border border-white/10 bg-card p-4 text-sm text-muted-foreground">Your saved profile is shown below. We couldn’t refresh it. <button className="font-semibold text-primary" onClick={()=>void q.refetch()}>Try again</button></div>}<section hidden={edit} className="rounded-[28px] border border-white/[.08] bg-card p-6 md:p-8"><div className="flex flex-col items-center gap-5 sm:flex-row"><Avatar profile={q.data} size="lg"/><div className="flex-1 text-center sm:text-left"><h2 className="text-2xl font-bold">{q.data.name}, {q.data.age}</h2><p className="mt-1 text-sm text-muted-foreground">{[q.data.city,q.data.state,q.data.country].filter(Boolean).join(', ')} · {q.data.gender}</p>{settings.data?.travelMode&&settings.data.travelCity&&<div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-[#ffafd1]"><Navigation size={13}/>Traveling in {settings.data.travelCity}</div>}</div><Link href="/profile/edit?returnTo=%2Fprofile" data-testid="button-edit-profile" className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#26111b]">Edit profile</Link></div></section>{saveError&&edit&&<p role="alert" className="mt-4 text-sm text-rose-300">{saveError}</p>}
  {edit&&<form onSubmit={e=>void submit(e)} className="mt-4 rounded-2xl border border-white/[.08] bg-card p-5 md:p-7"><h3 className="mb-5 text-lg font-bold">Edit your details</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><input data-testid="input-profile-name" required maxLength={60} value={form.name} onChange={e=>change('name',e.target.value)} className="field"/></Field><Field label="Age (18+)"><input data-testid="input-profile-age" required type="number" min="18" max="120" value={form.age} onChange={e=>change('age',Number(e.target.value))} className="field"/></Field><Field label="Gender"><input data-testid="input-profile-gender" value={form.gender} onChange={e=>change('gender',e.target.value)} className="field"/></Field><Field label="Looking for"><input data-testid="input-profile-looking" value={form.lookingFor} onChange={e=>change('lookingFor',e.target.value)} className="field"/></Field><Field label="City"><input data-testid="input-profile-city" value={form.city} onChange={e=>change('city',e.target.value)} className="field"/></Field><Field label="Bio"><textarea data-testid="input-profile-bio" maxLength={500} rows={4} value={form.bio} onChange={e=>change('bio',e.target.value)} className="field"/></Field><div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold text-muted-foreground">Hobbies</p><HobbyMultiSelect value={form.interests} onChange={value=>change('interests',value)} testIdPrefix="profile-edit"/></div><div className="sm:col-span-2"><OccupationSelect value={form.occupation||'Prefer not to say'} otherValue={form.occupationOther||''} onChange={value=>change('occupation',value)} onOtherChange={value=>change('occupationOther',value)} testIdPrefix="profile-edit"/></div><div className="sm:col-span-2"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Photos</p><p className="text-xs text-muted-foreground">{form.photos.length}/6</p></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{form.photos.map((photo,index)=><div key={`${photo}-${index}`} className="relative aspect-[.8] overflow-hidden rounded-xl border border-white/10 bg-black/20"><MediaImage reference={photo} alt={`Profile photo ${index+1}`} className="h-full w-full object-cover"/>{index===0&&<span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">Main photo</span>}<button type="button" onClick={()=>change('photos',form.photos.filter((_,photoIndex)=>photoIndex!==index))} aria-label={`Remove profile photo ${index+1}`} data-testid={`button-remove-profile-photo-${index}`} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white hover:bg-rose-600"><X size={15}/></button></div>)}</div></div><Field label="Add profile media"><input data-testid="input-profile-media" type="file" accept="image/*,video/mp4,video/quicktime" disabled={uploading||form.photos.length>=6} onChange={e=>{void uploadProfileMedia(e.currentTarget.files?.[0]);e.currentTarget.value=''}} className="field file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-bold"/></Field><p className="text-xs text-muted-foreground sm:col-span-2">{uploading?'Uploading media…':`${form.photos.length}/6 photos${form.videoUrl?' · profile video ready':''}${form.photos.length===0?' · add at least one photo before saving':''}`}</p><button disabled={save.isPending||uploading} data-testid="button-save-profile" className="rounded-xl bg-primary px-5 py-3 font-bold text-[#26111b] disabled:opacity-50">{save.isPending?'Saving…':'Save profile'}</button></div></form>}
   <section hidden={edit} className="mt-8 grid gap-7 md:grid-cols-[1fr_.8fr]"><div><h3 className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">A little about me</h3><p className="whitespace-pre-wrap text-sm leading-7">{q.data.bio||'Add a bio so people can get to know you.'}</p><h3 className="mb-3 mt-7 text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Work / occupation</h3><p className="text-sm">{q.data.occupation==='Other'?(q.data.occupationOther||'Other'):(q.data.occupation||'Prefer not to say')}</p><h3 className="mb-3 mt-7 text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Hobbies</h3><div className="flex flex-wrap gap-2">{q.data.interests.map(i=><span key={i} className="rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-[#ffafd1]">{i}</span>)}</div></div><div><h3 className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Photos</h3><div className="grid grid-cols-3 gap-2">{q.data.photos.map((p,i)=><MediaImage key={`${p}-${i}`} reference={p} alt={`Profile photo ${i+1}`} className="aspect-[.8] w-full rounded-xl object-cover"/>)}</div></div></section></>}</PageFrame>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="grid gap-2 text-xs font-semibold text-muted-foreground">{label}{children}</label>}


const setupSteps=['First name','Last name','Age','Gender','Looking for','Profile photo','Bio','Country','State / region','City','Hobbies','Work / occupation','Preferences'];
function normalizeHobbies(value: unknown): string[] { if(Array.isArray(value))return value.filter((item):item is string=>typeof item==='string');if(typeof value==='string')return value.split(',').map(item=>item.trim()).filter(Boolean).slice(0,12);return [] }
function OnboardingPage(){const [,setLocation]=useLocation();const q=useGetOnboardingDraft({query:{queryKey:getGetOnboardingDraftQueryKey()}});const saveDraft=useSaveOnboardingDraft();const saveProfile=useSaveMyProfile();const requestUpload=useRequestProfileMediaUpload();const qc=useQueryClient();const [uploading,setUploading]=useState(false);const [step,setStep]=useState(0);const [data,setData]=useState<Record<string,any>>({firstName:'',lastName:'',age:'',gender:'',lookingFor:'Everyone',photos:[],bio:'',country:'',countryCode:'',state:'',stateCode:'',city:'',interests:[],occupation:'Prefer not to say',occupationOther:'',ageMin:'22',ageMax:'35',distanceKm:50});const [ready,setReady]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);const currentKey=useRef('');useEffect(()=>{if(q.isSuccess&&!ready){const d=q.data.data??{};setData(v=>({...v,...d,interests:normalizeHobbies(d.interests),occupation:typeof d.occupation==='string'?d.occupation:'Prefer not to say',occupationOther:typeof d.occupationOther==='string'?d.occupationOther:''}));setStep(Math.max(0,Math.min(12,(q.data.step||1)-1)));setReady(true);currentKey.current=`${q.data.step}:${JSON.stringify(d)}`}},[q.data,q.isSuccess,ready]);const update=(k:string,v:any)=>{setData(d=>({...d,[k]:v}));setSaved(false);setError('')};
const updateLocation=(values:Record<string,string>)=>{setData(d=>({...d,...values}));setSaved(false);setError('')};
const retryPhoto=useRef<File|null>(null);const [photoRetry,setPhotoRetry]=useState(false);const [selectedPhotoPreview,setSelectedPhotoPreview]=useState('');const [uploadStatus,setUploadStatus]=useState('');const autosaveTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const latestDraftKey=useRef('');latestDraftKey.current=`${step+1}:${JSON.stringify(data)}`;
useEffect(()=>()=>{if(selectedPhotoPreview)URL.revokeObjectURL(selectedPhotoPreview)},[selectedPhotoPreview]);
async function uploadOnboardingPhoto(file?:File){if(!file||uploading)return;setError('');try{validatePhotoFile(file)}catch(error){retryPhoto.current=null;setPhotoRetry(false);setError(userErrorMessage(error,'Choose a JPG/JPEG, PNG, WebP, or HEIC/HEIF photo.'));return}retryPhoto.current=file;setPhotoRetry(false);setSelectedPhotoPreview('');setUploading(true);setUploadStatus('Reading and preparing photo…');try{const prepared=await prepareProfilePhoto(file);setSelectedPhotoPreview(URL.createObjectURL(prepared));setUploadStatus('Connecting to photo storage…');const result=await requestUpload.mutateAsync({data:{name:prepared.name,size:prepared.size,contentType:'image/jpeg',mediaType:'image'}});await uploadProfilePhotoBytes(result.uploadURL,prepared,{onAttempt:attempt=>setUploadStatus(attempt===1?'Uploading photo…':`Reconnecting… attempt ${attempt} of 3`)});update('photos',[...data.photos,result.mediaReference].slice(0,6));setSelectedPhotoPreview('');retryPhoto.current=null}catch(error){setError(userErrorMessage(error,'Your photo could not be uploaded. Choose the photo again to retry.'));setPhotoRetry(photoUploadCanRetry(error))}finally{setUploading(false);setUploadStatus('')}}
useEffect(()=>{if(!ready)return;const key=`${step+1}:${JSON.stringify(data)}`;if(key===currentKey.current)return;autosaveTimer.current=setTimeout(()=>saveDraft.mutate({data:{step:step+1,data}},{onSuccess:d=>{currentKey.current=`${d.step}:${JSON.stringify(data)}`;qc.setQueryData(getGetOnboardingDraftQueryKey(),d);setSaved(latestDraftKey.current===key)},onError:error=>{setSaved(false);setError(userErrorMessage(error,'Your latest changes haven’t saved yet. Keep this screen open and tap Continue to try again.'))}}),650);return()=>clearTimeout(autosaveTimer.current)},[ready,step,data]);
function validate(){if(step===0&&!data.firstName.trim())return 'Add your first name to continue.';if(step===1&&!data.lastName.trim())return 'Add your last name to continue.';if(step===2&&(!Number.isInteger(Number(data.age))||Number(data.age)<18))return 'Myage is for adults 18 and over.';if((step===3||step===4)&&!data[step===3?'gender':'lookingFor'])return 'Choose an option to continue.';if(step===5&&!data.photos?.length)return 'Add a profile photo to continue.';if(step===12&&(Number(data.ageMin)<18||Number(data.ageMax)<Number(data.ageMin)))return 'Set a valid age range.';return ''}
async function next(){if(uploading||saveDraft.isPending||saveProfile.isPending)return;clearTimeout(autosaveTimer.current);const message=validate();if(message){setError(message);return}setError('');try{await saveDraft.mutateAsync({data:{step:Math.min(step+2,13),data}});if(step<12){setStep(step+1);return}const profile=await saveProfile.mutateAsync({data:{name:`${data.firstName} ${data.lastName}`.trim(),age:Number(data.age),gender:data.gender,lookingFor:data.lookingFor,bio:data.bio||'',city:data.city||'',country:data.country||null,state:data.state||null,interests:normalizeHobbies(data.interests).slice(0,12),occupation:String(data.occupation||'Prefer not to say').slice(0,80),occupationOther:data.occupation==='Other'?String(data.occupationOther||'').trim().slice(0,80):'',photos:data.photos,videoUrl:null,preferences:{ageMin:Number(data.ageMin)||22,ageMax:Number(data.ageMax)||35,gender:data.lookingFor,distanceKm:Number(data.distanceKm)||50}}});qc.setQueryData(getGetMyProfileQueryKey(),profile);void qc.invalidateQueries();setLocation('/discover',{replace:true})}catch(error){setError(userErrorMessage(error,'Your setup hasn’t saved yet. Keep this screen open and tap Continue to try again.'))}}
if(q.isError&&!ready)return <PageFrame><Retry error={q.error} text="We couldn’t load your saved setup. Check your connection and try again." onRetry={()=>void q.refetch()}/></PageFrame>;
if(q.isLoading||!ready)return <PageFrame><PageHeading eyebrow="Your profile" title="Getting your space ready"/><Busy/></PageFrame>;
const choices=(values:string[],key:string)=> <div className="grid grid-cols-2 gap-2">{values.map(v=><button type="button" key={v} onClick={()=>update(key,v)} data-testid={`button-choice-${key}-${v.toLowerCase().replaceAll(' ','-')}`} className={`rounded-xl border p-3 text-sm font-semibold ${data[key]===v?'border-primary/50 bg-accent text-[#ffafd1]':'border-white/10 bg-white/[.02]'}`}>{v}</button>)}</div>;
 return <PageFrame><div className="mx-auto max-w-2xl"><PageHeading eyebrow="A good start" title="Set up your profile" description="Thirteen quick steps. Your progress saves as you go."/><div className="mb-8"><div className="flex justify-between text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground"><span>Step {step+1} of 13</span><span>{saved?'Saved':saveDraft.isError?'Not saved':'Saving as you go'}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${((step+1)/13)*100}%`}}/></div></div>
 <div className="min-h-[360px] rounded-[25px] border border-white/[.08] bg-card p-5 md:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{setupSteps[step]}</p><h2 className="brand mt-3 text-3xl font-bold tracking-[-.04em]">{['What should we call you?','And your last name?','How old are you?','How do you describe yourself?','Who would you like to meet?','Choose a profile photo.','What would you like people to know?','Where are you from?','State or region?','Which city feels like home?','Choose your hobbies.','What do you do for work?','Set your discovery preferences.'][step]}</h2><p className="mt-2 text-sm text-muted-foreground">Myage is a space for adults 18 and over.</p><div className="mt-7 max-w-lg">
{step===0&&<input autoFocus data-testid="input-onboarding-first-name" value={data.firstName} onChange={e=>update('firstName',e.target.value)} placeholder="First name" className="field"/>}
{step===1&&<input autoFocus data-testid="input-onboarding-last-name" value={data.lastName} onChange={e=>update('lastName',e.target.value)} placeholder="Last name" className="field"/>}
{step===2&&<input data-testid="input-onboarding-age" type="number" min="18" max="120" value={data.age} onChange={e=>update('age',e.target.value)} placeholder="Age" className="field max-w-40"/>}
{step===3&&choices(['Woman','Man','Non-binary','Another identity'],'gender')}
{step===4&&choices(['Everyone','Women','Men','Non-binary people'],'lookingFor')}
{step===5&&<div>{selectedPhotoPreview&&<figure className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20"><img src={selectedPhotoPreview} data-testid="img-onboarding-photo-preview" alt="Selected profile photo preview" className="mx-auto max-h-[320px] w-full object-cover"/>{uploading&&<figcaption className="px-3 py-2 text-center text-xs text-muted-foreground">{uploadStatus||'Uploading photo…'}</figcaption>}</figure>}<div className="mb-3 grid grid-cols-3 gap-2">{(data.photos as string[]).map((p:string,i:number)=><div key={p} className="relative"><MediaImage reference={p} className="aspect-[.8] w-full rounded-xl object-cover" alt={`Your photo ${i+1}`}/><button onClick={()=>update('photos',data.photos.filter((x:string)=>x!==p))} data-testid={`button-remove-onboarding-photo-${i}`} className="absolute right-1 top-1 rounded-full bg-black/70 p-1"><X size={14}/></button></div>)}</div><p className="text-xs text-muted-foreground">Add a clear, recent photo so people can recognize you.</p><label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-4 text-sm font-semibold text-primary hover:bg-white/[.03]"><ImagePlus size={17}/>{uploading?'Uploading photo…':'Choose a photo'}<input data-testid="input-onboarding-photo" type="file" accept={PROFILE_PHOTO_ACCEPT} disabled={uploading||data.photos.length>=6} className="hidden" onChange={e=>{void uploadOnboardingPhoto(e.currentTarget.files?.[0]);e.currentTarget.value=''}}/></label></div>}
{step===6&&<textarea data-testid="input-onboarding-bio" maxLength={500} rows={5} value={data.bio} onChange={e=>update('bio',e.target.value)} placeholder="A few things that make you, you…" className="field"/>}
{step===7&&<LocationChoice level="country" countryCode="" stateCode="" value={data.country} onSelect={option=>updateLocation({country:option.name,countryCode:option.code,state:'',stateCode:'',city:''})}/>}
{step===8&&<LocationChoice level="state" countryCode={data.countryCode} stateCode="" value={data.state} onSelect={option=>updateLocation({state:option.name,stateCode:option.code,city:''})} onSkip={()=>{updateLocation({state:'',stateCode:'',city:''});setStep(9)}}/>}
{step===9&&<LocationChoice level="city" countryCode={data.countryCode} stateCode={data.stateCode} value={data.city} onSelect={option=>update('city',option.name)} onSkip={()=>{update('city','');setStep(10)}}/>}
{step===10&&<HobbyMultiSelect value={normalizeHobbies(data.interests)} onChange={value=>update('interests',value)} testIdPrefix="onboarding"/>}
{step===11&&<OccupationSelect value={String(data.occupation||'Prefer not to say')} otherValue={String(data.occupationOther||'')} onChange={value=>update('occupation',value)} onOtherChange={value=>update('occupationOther',value)} testIdPrefix="onboarding"/>}
{step===12&&<div className="space-y-5"><div className="grid grid-cols-2 gap-3"><Field label="Age from"><input data-testid="input-onboarding-age-min" type="number" min="18" value={data.ageMin} onChange={e=>update('ageMin',e.target.value)} className="field"/></Field><Field label="Age to"><input data-testid="input-onboarding-age-max" type="number" value={data.ageMax} onChange={e=>update('ageMax',e.target.value)} className="field"/></Field></div><Field label={`Distance · ${data.distanceKm} km`}><input data-testid="input-onboarding-distance" type="range" min="1" max="500" value={data.distanceKm} onChange={e=>update('distanceKm',Number(e.target.value))} className="w-full accent-[#f34e9a]"/></Field></div>}
</div>{uploading&&<p role="status" className="mt-4 text-sm text-muted-foreground">{uploadStatus}</p>}{error&&<p role="alert" data-testid="text-onboarding-error" className="mt-5 text-sm text-rose-300">{error}</p>}{step===5&&photoRetry&&!uploading&&retryPhoto.current&&<button type="button" data-testid="button-retry-photo" className="mt-3 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary" onClick={()=>void uploadOnboardingPhoto(retryPhoto.current??undefined)}>Retry upload</button>}
 <div className="mt-8 flex items-center justify-between border-t border-white/[.08] pt-5"><button disabled={step===0||uploading||saveDraft.isPending||saveProfile.isPending} onClick={()=>setStep(s=>Math.max(0,s-1))} data-testid="button-onboarding-back" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold disabled:opacity-35">Back</button><button disabled={uploading||saveDraft.isPending||saveProfile.isPending||(step===5&&!data.photos.length)||(step===7&&!data.country)} onClick={()=>void next()} data-testid="button-onboarding-next" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-[#26111b] disabled:opacity-50">{saveProfile.isPending?'Saving profile…':saveDraft.isPending?'Saving…':step===12?'Finish setup':'Continue'}<ArrowRight size={16}/></button></div></div></div></PageFrame>}

function PublicProfile({id,actionReturnTo='/discover'}:{id:string;actionReturnTo?:string}){
 const q=useGetProfileById(id,{query:{queryKey:getGetProfileByIdQueryKey(id)}});const view=useRecordProfileView();const seen=useRef('');const [activePhoto,setActivePhoto]=useState(0);const [photoError,setPhotoError]=useState(false);
 const client=useQueryClient();const [,setLocation]=useLocation();const reaction=useCreateReaction();const likes=useGetDailyLikeStatus({query:{queryKey:getGetDailyLikeStatusQueryKey()}});const [likeConfirmation,setLikeConfirmation]=useState('');const [actionError,setActionError]=useState('');const [matchResult,setMatchResult]=useState<{name:string;matchId:string|null}|null>(null);const confirmationTimer=useRef<number|null>(null);
 useEffect(()=>()=>{if(confirmationTimer.current!==null)window.clearTimeout(confirmationTimer.current)},[]);
 useEffect(()=>{if(q.data?.id&&seen.current!==q.data.id){seen.current=q.data.id;view.mutate({profileId:q.data.id})}},[q.data?.id]);
 useEffect(()=>{setActivePhoto(0);setPhotoError(false)},[q.data?.id,q.data?.photos?.[0]]);
 async function passProfile(){if(!q.data||reaction.isPending)return;setActionError('');try{await reaction.mutateAsync({data:{toUserId:q.data.id,type:'pass'}});setLocation(actionReturnTo)}catch{setActionError('That pass did not save. Please try again.')}}
 async function likeProfile(){if(!q.data||reaction.isPending)return;if(likes.data?.remaining===0){setActionError('You’ve reached your daily like limit. Come back in 24 hours.');return}setActionError('');try{const result=await reaction.mutateAsync({data:{toUserId:q.data.id,type:'like'}});setLikeConfirmation(`You liked ${q.data.name}`);void client.invalidateQueries({queryKey:getGetDailyLikeStatusQueryKey()});void client.invalidateQueries({queryKey:getGetMatchesQueryKey()});void client.invalidateQueries({queryKey:getGetNotificationsQueryKey()});confirmationTimer.current=window.setTimeout(()=>{setLikeConfirmation('');if(result.matched)setMatchResult({name:q.data!.name,matchId:result.matchId??null});else setLocation(actionReturnTo)},1500)}catch{setActionError('That like did not go through. Please try again.')}}
 if(q.isLoading)return <PageFrame><Busy label="Loading profile"/></PageFrame>;
 if(q.isError||!q.data)return <PageFrame><Retry onRetry={()=>void q.refetch()} text="Profile unavailable."/></PageFrame>;
 const profile=q.data;const photos=profile.photos??[];const location=[profile.city,profile.state,profile.country].filter(Boolean).join(', ');const morePhotos=photos.slice(1);
  return <><main className="page-in w-full pb-36" data-testid="public-profile-page">
  <section className="relative isolate h-[72svh] min-h-[500px] max-h-[840px] w-full overflow-hidden bg-[linear-gradient(145deg,#38263f,#17131a)]" data-testid="public-profile-hero" aria-label={`${profile.name}${profile.age!==null?`, ${profile.age}`:''}`}>
   {photos[0]&&!photoError?<MediaImage reference={photos[0]} alt={`${profile.name}'s main profile photo`} onError={()=>setPhotoError(true)} className="absolute inset-0 h-full w-full object-cover object-center"/>:<div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_50%_35%,rgba(197,112,163,.3),transparent_58%)]"><span className="brand text-8xl font-bold text-white/20">{profile.name.trim().slice(0,1).toUpperCase()||'M'}</span></div>}
   <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent"/>
   <div className="absolute inset-x-0 bottom-0 px-5 pb-8 pt-36 text-white sm:px-8 sm:pb-10">
    <div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-white/75">A closer look</div>
    <h1 className="brand max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl md:text-6xl">{profile.name}{profile.age!==null&&<span className="font-medium text-white/80">, {profile.age}</span>}</h1>
    <p className="mt-3 flex items-center gap-2 text-sm font-medium text-white/85 sm:text-base"><MapPin size={16} className="shrink-0 text-primary"/>{location||'Location not shared'}</p>
   </div>
  </section>
  <div className="mx-auto w-full max-w-4xl px-5 pb-10 pt-8 sm:px-8 sm:pt-10">
   <section className="border-b border-white/[.09] pb-7 sm:pb-9">
    <h2 className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">About {profile.name}</h2>
    <p className="mt-3 max-w-3xl whitespace-pre-wrap text-base leading-7 text-foreground/90 sm:text-lg sm:leading-8">{profile.bio||'No bio added yet.'}</p>
   </section>
   <section className="grid gap-x-10 gap-y-6 border-b border-white/[.09] py-7 sm:grid-cols-2 sm:py-8" aria-label="Profile details">
    <div><h3 className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Work</h3><p className="mt-2 text-sm font-medium">{profile.occupation==='Other'?(profile.occupationOther||'Other'):(profile.occupation||'Prefer not to say')}</p></div>
    <div><h3 className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Gender</h3><p className="mt-2 text-sm font-medium">{profile.gender||'Not shared'}</p></div>
    <div><h3 className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Looking for</h3><p className="mt-2 text-sm font-medium">{profile.lookingFor||'Not shared'}</p></div>
    <div><h3 className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Location</h3><p className="mt-2 text-sm font-medium">{location||'Not shared'}</p></div>
   </section>
   <section className="border-b border-white/[.09] py-7 sm:py-8">
    <h3 className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Hobbies and interests</h3>
    <div className="mt-3 flex flex-wrap gap-2">{profile.interests.map(interest=><span key={interest} className="rounded-full border border-primary/15 bg-primary/[.07] px-3.5 py-2 text-xs font-semibold text-[#ffafd1]">{interest}</span>)}{!profile.interests.length&&<span className="text-sm text-muted-foreground">No interests added yet.</span>}</div>
   </section>
   {morePhotos.length>0&&<section className="py-7 sm:py-8">
    <div className="mb-3 flex items-end justify-between gap-4"><h3 className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">More photos</h3>{morePhotos.length>1&&<span className="text-xs text-muted-foreground">{activePhoto+2} / {photos.length}</span>}</div>
    <div data-testid="public-profile-gallery" className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3" onScroll={event=>setActivePhoto(Math.round(event.currentTarget.scrollLeft/Math.max(1,event.currentTarget.clientWidth)))}>
     {morePhotos.map((photo,index)=><div key={`${photo}-${index}`} className="min-w-full snap-center"><div className="aspect-[.9] w-full overflow-hidden bg-black/20 sm:aspect-[1.1]"><MediaImage reference={photo} alt={`${profile.name}'s photo ${index+2}`} className="h-full w-full object-cover"/></div></div>)}
    </div>
   </section>}
    <Link href={actionReturnTo} data-testid="link-public-profile-back" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[.06]">Back</Link>
  </div>
 </main>
  <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[29] border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl lg:bottom-5 lg:left-[calc(248px+1.5rem)] lg:right-5 lg:rounded-2xl lg:border" aria-label="Profile actions">
  <div className="flex items-center justify-center gap-6">
   <button type="button" onClick={()=>void passProfile()} disabled={reaction.isPending||!!likeConfirmation||!!matchResult} data-testid="button-viewed-profile-pass" aria-label="Pass" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#28232d] text-rose-300 shadow-lg disabled:opacity-40"><X size={23}/></button>
   <button type="button" onClick={()=>void likeProfile()} disabled={reaction.isPending||!!likeConfirmation||!!matchResult||likes.isLoading||likes.data?.remaining===0} data-testid="button-viewed-profile-like" aria-label={`Like ${q.data.name}`} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[#27101d] shadow-[0_8px_30px_rgba(243,78,154,.32)] disabled:opacity-40"><Heart size={25} fill="currentColor"/></button>
  </div>
  {likes.data?.remaining===0&&<p className="mt-1 text-center text-xs text-muted-foreground">Your daily likes are used up.</p>}
  {actionError&&<p role="alert" data-testid="error-viewed-profile-action" className="mt-2 text-center text-xs text-rose-300">{actionError}</p>}
  </div>
 {likeConfirmation&&<div className="fixed inset-x-0 top-[82px] z-[60] flex justify-center px-4" role="status" aria-live="polite" data-testid="status-viewed-profile-liked"><div className="flex items-center gap-2 rounded-full border border-primary/25 bg-[#211a27]/95 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl"><Heart size={17} fill="currentColor" className="text-primary"/>{likeConfirmation}</div></div>}
 {matchResult&&<Dialog title="It’s a match!" onClose={()=>{setMatchResult(null);setLocation(actionReturnTo)}}><p className="mb-5 text-sm leading-6 text-muted-foreground">You and {matchResult.name} liked each other. You can start chatting now.</p><div className="flex flex-col gap-2"><button type="button" onClick={()=>{if(matchResult.matchId)setLocation(`/chat/${matchResult.matchId}`);else setLocation('/matches')}} data-testid="button-start-match-chat" className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#27101d]">{matchResult.matchId?'Start chatting':'View matches'}</button><button type="button" onClick={()=>{setMatchResult(null);setLocation(actionReturnTo)}} data-testid="button-match-back" className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-foreground">Back</button></div></Dialog>}
 </>
}

function OnboardingGate(){const p=useGetMyProfile({query:{retry:shouldRetryProfile}});if(p.isLoading)return <PageFrame><ProfileLoading/></PageFrame>;if(p.data)return <Redirect to="/discover"/>;if(p.isError&&!isProfileMissing(p.error))return <PageFrame><Retry text="We couldn’t check your profile. Check your connection and try again." onRetry={()=>void p.refetch()}/></PageFrame>;return <OnboardingPage/>}
function HomeRedirect(){return <><Show when="signed-in"><Redirect to="/discover"/></Show><Show when="signed-out"><Redirect to="/welcome"/></Show></>}
function WelcomeRoute(){return <><Show when="signed-in"><Redirect to="/discover"/></Show><Show when="signed-out"><InstalledWelcome/></Show></>}
function BrandedSignUp(){
  const {signUp,fetchStatus}=useSignUp();
  const [,setLocation]=useLocation();
  const [step,setStep]=useState<'email'|'password'>('email');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [code,setCode]=useState('');
  const [verifying,setVerifying]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const emailValid=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passwordTooShort=password.length>0&&password.length<8;
  async function finish(){
    if(signUp.status!=='complete'){setError('Your account still needs verification. Check the code and try again.');return}
    const result=await signUp.finalize({navigate:({session})=>{
      if(session?.currentTask){setError('Your account needs another verification step. Please sign in to continue.');return}
      setLocation('/onboarding',{replace:true});
    }});
    if(result.error)setError(result.error.message);
  }
  async function submit(event:React.FormEvent){event.preventDefault();setError('');if(verifying){if(!code.trim())return;setBusy(true);try{const result=await signUp.verifications.verifyEmailCode({code:code.trim()});if(result.error){setError(result.error.message);return}await finish()}catch(e){setError(e instanceof Error?e.message:'The verification code could not be confirmed.')}finally{setBusy(false)}return}
    if(step==='email'){if(!emailValid)return;setStep('password');return}
    if(!emailValid||password.length<8)return;
    setBusy(true);
    try{
      const result=await signUp.password({emailAddress:email.trim(),password});
      if(result.error){setError(result.error.message);return}
      if(signUp.status==='complete'){await finish();return}
      const sent=await signUp.verifications.sendEmailCode();
      if(sent.error){setError(sent.error.message);return}
      setVerifying(true);
    }catch(e){setError(e instanceof Error?e.message:'Your account could not be created. Please try again.')}
    finally{setBusy(false)}
  }
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><div className="fixed left-6 top-6"><Brand/></div><section className="w-full max-w-[440px] rounded-[26px] border border-white/10 bg-[#211d25] p-6 shadow-2xl sm:p-8">
    <div className="mb-7"><img src={pathFor('/icon.png')} alt="" className="mb-5 h-12 w-12 rounded-2xl border border-white/10"/><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Myage · 18+</p>{!verifying&&<><p className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Account setup · {step==='email'?'1':'2'} of 2</p><div className="mt-2 flex gap-2" aria-label={`Step ${step==='email'?'1':'2'} of 2`}><span className="h-1 flex-1 rounded-full bg-primary"/><span className={`h-1 flex-1 rounded-full ${step==='password'?'bg-primary':'bg-white/10'}`}/></div></>}<h1 className="brand mt-2 text-3xl font-bold tracking-[-.05em]">{verifying?'Check your email':step==='email'?'Start with your email':'Create a password'}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{verifying?`We sent a verification code to ${email.trim()}.`:step==='email'?'Enter your email to begin creating your account.':'Choose a password with at least 8 characters.'}</p></div>
    <form onSubmit={submit} className="space-y-5" noValidate>
      {!verifying&&step==='email'?<label className="grid gap-2 text-xs font-semibold text-[#e7dce3]">Email address<input data-testid="input-signup-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={e=>{setEmail(e.target.value);setError('')}} className="field" placeholder="you@example.com"/>{email&& !emailValid&&<span className="text-xs font-normal text-rose-300" data-testid="error-signup-email">Enter a valid email address.</span>}</label>
      :!verifying?<><button type="button" onClick={()=>{setError('');setStep('email')}} data-testid="button-signup-back-email" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={14}/>Change email</button>
      <SignupPasswordField value={password} onChange={value=>{setPassword(value);setError('')}}/>{passwordTooShort&&<span className="text-xs font-normal text-rose-300" data-testid="error-signup-password">Password must be at least 8 characters</span>}
      </>:<label className="grid gap-2 text-xs font-semibold text-[#e7dce3]">Email verification code<input data-testid="input-signup-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} className="field" placeholder="Enter your code"/></label>}
      {error&&<p role="alert" data-testid="error-signup-clerk" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] px-3 py-2.5 text-xs leading-5 text-rose-200">{error}</p>}
      <button type="submit" disabled={busy||fetchStatus==='fetching'||(verifying&&!code.trim())||(!verifying&&step==='email'&&!emailValid)||(!verifying&&step==='password'&&password.length<8)} data-testid="button-signup-continue" className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-[#24111b] disabled:cursor-not-allowed disabled:opacity-40">{busy?'Please wait…':verifying?'Verify email':step==='email'?'Continue':'Create account'}{!busy&&<ArrowRight size={16}/>}</button>
      {verifying&&<button type="button" onClick={async()=>{setBusy(true);setError('');try{const result=await signUp.verifications.sendEmailCode();if(result.error)setError(result.error.message)}catch(e){setError(e instanceof Error?e.message:'Could not resend the code.')}finally{setBusy(false)}}} data-testid="button-resend-signup-code" className="w-full text-center text-xs font-semibold text-primary">Resend code</button>}
    </form>
    <p className="mt-6 border-t border-white/[.08] pt-5 text-center text-xs text-muted-foreground">Already a member? <Link href="/sign-in" data-testid="link-signin-from-signup" className="font-bold text-primary">Sign in</Link></p>
    <p className="mt-4 text-center text-[10px] leading-5 text-muted-foreground">By continuing, you confirm you are 18 or older.</p>
    <p className="mt-3 text-center text-[10px] text-muted-foreground"><Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link><span className="px-2">·</span><Link href="/terms" className="hover:text-primary">Terms of Service</Link></p>
  </section></div>;
}
function RouteShell({component:Component}:{component:()=>ReactNode}){return <ShellPage><Component/></ShellPage>}
function ChatRoute(){const params=useParams<{matchId:string}>();return <ShellPage><ChatPage matchId={params.matchId||''}/></ShellPage>}
function OnboardingRoute(){return <Gate><div className="min-h-[100dvh] bg-background text-foreground"><header className="p-6"><Brand/></header><OnboardingGate/></div></Gate>}
function ProfileRoute(){return <ShellPage><ProfilePage mode="view"/></ShellPage>}
function ProfileEditRoute(){const requested=new URLSearchParams(window.location.search).get('returnTo');const returnTo=safeAppReturnPath(requested,'/profile');return <ShellPage><ProfilePage mode="edit" returnTo={returnTo}/></ShellPage>}
function SettingsRoute(){return <ShellPage><SettingsIndexPage/></ShellPage>}
function SettingsSectionRoute(){return <ShellPage><SettingsSectionPage/></ShellPage>}
function SafetyCenterRoute(){return <ShellPage><SafetyCenterPage/></ShellPage>}
function CommunityGuidelinesRoute(){return <CommunityGuidelinesPage/>}
function PrivacyPolicyRoute(){return <PrivacyPolicyPage/>}
function ReportSafetyRoute(){return <ShellPage><ReportSafetyPage/></ShellPage>}
function PublicLocationShareRoute(){return <PublicLocationSharePage/>}
function DiscoverRoute(){return <ShellPage><DiscoverPage/></ShellPage>}
function StoryComposerRoute(){return <ShellPage><StoryComposerPage/></ShellPage>}
function MatchesRoute(){return <ShellPage><MatchesPage/></ShellPage>}
function ViewsRoute(){return <ShellPage><ViewsPage/></ShellPage>}
function NotificationsRoute(){return <ShellPage><NotificationsPage/></ShellPage>}
function ViewedNotificationProfileRoute(){const params=useParams<{profileId:string}>();return <ShellPage><PublicProfile id={params.profileId||''} actionReturnTo="/notifications"/></ShellPage>}
function PublicProfileRoute(){const params=useParams<{profileId:string}>();const returnTo=safeAppReturnPath(new URLSearchParams(window.location.search).get('returnTo'),'/discover');return <ShellPage><PublicProfile id={params.profileId||''} actionReturnTo={returnTo}/></ShellPage>}
function SettingsThemeSync() {
  const { isLoaded, isSignedIn } = useUser();
  const settings = useGetVibeSwipeSettings({ query: { enabled: Boolean(isLoaded && isSignedIn), queryKey: getGetVibeSwipeSettingsQueryKey() } });
  const lightMode = isSignedIn && settings.data?.darkMode === false;
  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.dataset.theme = lightMode ? "light" : "dark";
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", lightMode ? "#f8f6fa" : "#15131a");
    document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute("content", lightMode ? "default" : "black-translucent");
  }, [isLoaded, lightMode]);
  return null;
}
function ClerkCacheSync(){const {user}=useUser();const client=useQueryClient();const previous=useRef<string|null|undefined>(undefined);useEffect(()=>{const id=user?.id??null;if(previous.current!==undefined&&previous.current!==id)client.clear();previous.current=id},[user?.id,client]);return null}
function ClerkRoutes(){const [,setLocation]=useLocation();return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={pathFor('/sign-in')} signUpUrl={pathFor('/sign-up')} localization={{signIn:{start:{title:'Welcome back',subtitle:'Your next good conversation is waiting.'}},signUp:{start:{title:'Make room for a spark',subtitle:'Create your adults-only Myage account.'}}}} routerPush={to=>setLocation(to.startsWith(basePath)?to.slice(basePath.length)||'/':to)} routerReplace={to=>setLocation(to.startsWith(basePath)?to.slice(basePath.length)||'/':to,{replace:true})}><ClerkCacheSync/><SettingsThemeSync/><Switch>
  <Route path="/" component={HomeRedirect}/>
  <Route path="/welcome" component={WelcomeRoute}/>
  <Route path="/sign-in/*?"><div className="grain flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-10"><div className="fixed left-6 top-6"><Brand/></div><SignIn routing="path" path={pathFor('/sign-in')} signUpUrl={pathFor('/sign-up')}/><p className="mt-5 text-center text-xs text-muted-foreground"><Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link><span className="px-2">·</span><Link href="/terms" className="hover:text-primary">Terms of Service</Link></p></div></Route>
  <Route path="/sign-up/*?" component={BrandedSignUp}/>
  {import.meta.env.DEV&&<Route path="/create-account-preview"><div className="border-b border-primary/20 bg-accent px-5 py-3 text-center text-xs leading-5 text-foreground" role="note">Form preview only. Email-code signup still needs the authentication setting changed.</div><ProfileFirstSignup previewOnly/></Route>}
  <Route path="/onboarding" component={OnboardingRoute}/><Route path="/discover" component={DiscoverRoute}/><Route path="/stories/new" component={StoryComposerRoute}/><Route path="/matches" component={MatchesRoute}/>
  <Route path="/chat/:matchId" component={ChatRoute}/><Route path="/views" component={ViewsRoute}/><Route path="/notifications" component={NotificationsRoute}/>
   <Route path="/privacy-policy" component={PrivacyPolicyRoute}/><Route path="/terms" component={CommunityGuidelinesRoute}/><Route path="/community-guidelines" component={CommunityGuidelinesRoute}/>
   <Route path="/safety-center" component={SafetyCenterRoute}/><Route path="/report-safety" component={ReportSafetyRoute}/><Route path="/safety/location" component={PublicLocationShareRoute}/>
  <Route path="/profile" component={ProfileRoute}/><Route path="/profile/edit" component={ProfileEditRoute}/><Route path="/profile/:profileId/from-notifications" component={ViewedNotificationProfileRoute}/><Route path="/profile/:profileId" component={PublicProfileRoute}/><Route path="/settings" component={SettingsRoute}/><Route path="/settings/:section" component={SettingsSectionRoute}/><Route component={NotFound}/>
</Switch></ClerkProvider>}
function App(){if(!clerkPubKey)throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');return <QueryClientProvider client={queryClient}><ConnectionNotice/><WouterRouter base={basePath}><ClerkRoutes/></WouterRouter></QueryClientProvider>}
export default App;
