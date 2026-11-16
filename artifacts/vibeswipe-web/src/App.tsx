import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { OnboardingVideoBackground } from '@/components/onboarding-video-background';
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
  getGetMatchPresenceQueryKey,
  useActivateBoost, useBlockProfile, useClearChat,
  useClearOnboardingDraft, useCreateReaction, useDeleteChat, useDeleteMessage,
  useGetBoostStatus, useGetChatReadReceipt, useGetDailyLikeStatus,
  useGetDiscoverProfiles, useGetIcebreakers, useGetMatches, useGetMessages, useGetMyProfile,
  useGetNotifications, useGetOnboardingDraft, useGetProfileById, useGetProfileMedia, useGetStories, useGetSuperLikeStatus, useGetVibeSwipeSettings,
  useGetTypingStatus, useGetMatchPresence, useMarkChatRead, useGetWhoViewedYou,
  useMarkNotificationRead, useRecordProfileView, useReportProfile, useSaveMyProfile,
  useSaveOnboardingDraft, useSendMessage, useTranscodeProfileVideo, useUnblockProfile,
  useUndoLastPass, useUnmatchMatch, useUpdateChatTheme, useUpdateTypingStatus, useHeartbeatPresence,
  useRequestChatMediaUpload, useRequestProfileMediaUpload,
  type ChatTheme, type Message, type Profile, type ProfileInput, type ReportInputReason, type MediaUploadInputContentType,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowLeft, ArrowRight, Bell, Clapperboard, Check, ChevronDown, ChevronRight, CircleHelp, Compass, Eye, EyeOff,
  Heart, ImagePlus, MapPin, MessageCircle, MoreHorizontal, Navigation, Search, Settings,
  Shield, SlidersHorizontal, Mars, Venus, NonBinary, Briefcase, Pencil, Camera, Sparkles, Star, UserRound, Users, Volume2, X, Zap, Flag, Ban, Images, Coffee, CupSoda, Music, ImageIcon, Paperclip, SendHorizontal, LoaderCircle, MessageCircleMore,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import AdminPage from '@/pages/admin';
import SafetyCenterPage from '@/pages/safety-center';
import CommunityGuidelinesPage from '@/pages/community-guidelines';
import PrivacyPolicyPage from '@/pages/privacy-policy';
import ReportSafetyPage from '@/pages/report-safety';
import PublicLocationSharePage from '@/pages/public-location-share';
import FaceVerificationPage from '@/pages/face-verification';
import { VerifiedBadge } from '@/components/verified-badge';
import { InstallAction, MobileInstallBanner } from '@/components/install-action';
import { InstalledWelcome } from '@/components/installed-welcome';
import { DiscoverSwipePage } from '@/components/discover-swipe-page';
import { MemberSearchPage } from '@/components/member-search-page';
import { MatchCelebration } from '@/components/match-celebration';
import { MatchStoryAvatar, StoryComposerPage } from '@/components/stories/stories-ui';
import { SignupPasswordField } from '@/components/signup-password-field';
import { ProfileFirstSignup } from '@/components/profile-first-signup';
import { OnboardingCountryStep } from '@/components/onboarding-country-step';
import type { OnboardingCountry } from '@workspace/api-client-react';
import { HobbyMultiSelect, OccupationSelect } from '@/components/profile-field-selectors';
import { ConnectionNotice } from '@/components/connection-notice';
import { WebPushSettings } from '@/components/WebPushSettings';
import { ReelsFeedPage } from '@/pages/reels-feed';
import { ReelComposerPage } from '@/pages/reel-composer';
import { ReelsLibraryPage } from '@/pages/reels-library';
import { ProfileReelsSection } from '@/components/profile-reels-section';
import { sharedReelId } from '@/lib/reels';
import { ChatMessageBubble } from '@/components/chat-message-bubble';
import { ChatVoiceNoteRecorder } from '@/components/chat-voice-note-recorder';
import { chatViewportFrame } from '@/lib/chat-viewport';
import { ActivityOverview, InboundPeoplePage, MutualMatchesPage } from '@/components/social-hub';
import { isDiscoverSetupRequired, isProfileMissing, shouldRetryDiscover, shouldRetryProfile } from '@/lib/profile-query-state';
import { PROFILE_PHOTO_ACCEPT, photoUploadCanRetry, prepareProfilePhoto, uploadProfilePhotoBytes, validatePhotoFile } from '@/lib/profile-photo-upload';
import { checkAdditionalProfilePhoto } from '@workspace/api-client-react';
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
  variables: { colorPrimary: '#F34E9A', colorForeground: '#f5edf1', colorMutedForeground: '#a79ca5', colorDanger: '#f06b76', colorBackground: '#15131a', colorInput: '#19161c', colorInputForeground: '#f5edf1', colorNeutral: '#f5edf1', fontFamily: 'DM Sans', borderRadius: '14px' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#211d25] rounded-2xl w-[440px] max-w-full overflow-hidden border border-white/10',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#fff2f7] font-bold', headerSubtitle: 'text-[#b9adb6]', socialButtonsBlockButtonText: 'text-[#f6edf2]',
    formFieldLabel: 'text-[#e7dce3]', footerActionLink: 'text-[#ff6bad]', footerActionText: 'text-[#a99ca6]',
    dividerText: 'text-[#a99ca6]', identityPreviewEditButton: 'text-[#ff6bad]', formFieldSuccessText: 'text-[#8dd6b4]',
    alertText: 'text-[#ffe6ea]', logoBox: 'rounded-xl', logoImage: 'rounded-lg',
    socialButtons: { display: 'none' as const }, socialButtonsBlockButton: { display: 'none' as const }, socialButtonsIconButton: { display: 'none' as const }, dividerRow: { display: 'none' as const },
    formButtonPrimary: 'bg-[#F34E9A] hover:bg-[#ff68aa] text-[#24111b]', formFieldInput: 'bg-[#19161c] border-white/10 text-[#f5edf1]',
    footerAction: 'bg-transparent', dividerLine: 'bg-white/10', alert: 'bg-[#40252d] border-[#7e3b4a]',
    otpCodeFieldInput: 'bg-[#19161c] border-white/10 text-white', formFieldRow: 'gap-2', main: 'bg-transparent',
  },
};

function Brand({ compact = false, small = false }: { compact?: boolean; small?: boolean }) {
  return <Link href="/" className="inline-flex items-center gap-2.5" data-testid="link-brand">
    <img src={pathFor('/icon.png')} alt="" className={`${compact || small ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl'} ring-1 ring-border`} />
    {!compact && <span className={`brand ${small ? 'text-lg' : 'text-[21px]'} font-extrabold text-foreground`}>My<span className="text-primary">age</span></span>}
  </Link>;
}

const navItems = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/reels', label: 'Reels', icon: Clapperboard },
  { href: '/messages', label: 'Messages', icon: MessageCircle }, { href: '/notifications', label: 'Activity', icon: Bell },
];

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const shellRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const showMainNavigation = ['/discover', '/matches', '/messages', '/notifications', '/views', '/likes', '/profile'].includes(location);
  const isSocialPage = ['/matches', '/messages', '/notifications', '/views', '/likes'].includes(location);
  const activeLocation = ['/matches', '/views', '/likes'].includes(location) ? '/notifications' : location;
  const settingsReturnTo = `${location}${window.location.search}${window.location.hash}`;
  const { user } = useUser();
  const profile = useGetMyProfile();
  const activeName = profile.data?.name || user?.firstName || 'Your profile';
  useEffect(() => {
    if (!showMainNavigation || !mobileNavRef.current) return;
    const measure = () => shellRef.current?.style.setProperty('--mobile-nav-height', `${mobileNavRef.current?.offsetHeight ?? 0}px`);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(mobileNavRef.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [showMainNavigation, location]);
  return <div ref={shellRef} className={`app-shell min-h-[100dvh] bg-background text-foreground ${isSocialPage?'messages-shell':''} ${location==='/discover'?'discover-shell':''} ${location==='/profile'?'profile-shell':''}`}>
    {showMainNavigation && <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-background px-5 py-6 lg:flex">
        <div className="mb-4 mt-2 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">Your space</div>
        <nav className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${activeLocation === href ? 'bg-accent text-[#ff80b6]' : 'text-muted-foreground hover:bg-white/[.04] hover:text-foreground'}`}><Icon size={18}/>{label}</Link>)}
        </nav>
        <div className="mt-auto space-y-2 border-t border-white/[.08] pt-4">
          <Link href="/profile" data-testid="nav-profile" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${location === '/profile' ? 'bg-accent text-[#ff80b6]' : 'text-muted-foreground hover:bg-white/[.04]'}`}><UserRound size={18}/><span className="truncate">{activeName}</span></Link>
          <Link href={`/settings?returnTo=${encodeURIComponent(settingsReturnTo)}`} data-testid="nav-settings" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-white/[.04]"><Settings size={18}/>Settings</Link>
          <InstallAction className="px-1 pt-2"/>
        </div>
      </aside>
    </>}
    <main className={showMainNavigation ? "min-h-[100dvh] pb-24 lg:ml-[248px] lg:pb-0" : "min-h-[100dvh]"}>{children}</main>
    {profile.data?.id&&<WebPushSettings key={profile.data.id} compact visible={showMainNavigation} accountId={profile.data.id}/>}
    {showMainNavigation && <nav ref={mobileNavRef} aria-label="Primary" className={`${location==='/profile'?'profile-nav ':''}mobile-nav fixed inset-x-0 bottom-0 z-30 flex justify-around bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl lg:hidden`}>
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`mobile-nav-${label.toLowerCase()}`} aria-current={activeLocation === href ? 'page' : undefined} className={`mnav-item ${activeLocation === href ? 'is-active text-primary' : 'text-muted-foreground'}`}><span className="mnav-icon"><Icon size={19} strokeWidth={activeLocation === href ? 2.25 : 1.85}/></span><span className="mnav-label">{label}</span></Link>)}
      <Link href="/profile" data-testid="mobile-nav-profile" aria-current={location === '/profile' ? 'page' : undefined} className={`mnav-item ${location === '/profile' ? 'is-active text-primary' : 'text-muted-foreground'}`}><span className="mnav-icon"><UserRound size={19} strokeWidth={location === '/profile' ? 2.25 : 1.85}/></span><span className="mnav-label">Profile</span></Link>
    </nav>}
  </div>;
}

function Gate({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/welcome"/></Show></>;
}
function RequiredProfile({ children }: { children: ReactNode }) {
  const profile=useGetMyProfile<Profile>({query:{retry:shouldRetryProfile,staleTime:0,refetchOnMount:'always'}});
  if(profile.isError&&isProfileMissing(profile.error))return <Redirect to="/onboarding"/>;
  if(profile.isLoading||!profile.data)return <div className="min-h-[100dvh] bg-background text-foreground"><PageFrame>{profile.isError?<Retry text="We couldn’t check your profile. Check your connection and try again." onRetry={()=>void profile.refetch()}/>:<ProfileLoading/>}</PageFrame></div>;
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
 function MediaImage({reference,className,alt,onError,onLoad,fallbackSrc}:{reference?:string;className:string;alt:string;onError?:()=>void;onLoad?:()=>void;fallbackSrc?:string}) {
  const id=reference?.startsWith('media:')?reference.slice(6):'';
  const media=useGetProfileMedia(id,{query:{enabled:!!id,queryKey:getGetProfileMediaQueryKey(id)}});
  const [objectUrl,setObjectUrl]=useState('');
  useEffect(()=>{if(!media.data)return;const url=URL.createObjectURL(media.data);setObjectUrl(url);return()=>URL.revokeObjectURL(url)},[media.data]);
   const src=id?(objectUrl||fallbackSrc):mediaUrl(reference);
   return src?<img src={src} onLoad={()=>{if(!id||objectUrl)onLoad?.()}} onError={onError} className={className} alt={alt}/>:null;
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

function SharedReelContent({content,returnTo}:{content:string;returnTo:string}){const reelId=sharedReelId(content);if(!reelId)return <>{content}</>;return <Link href={`/reels/${reelId}?returnTo=${encodeURIComponent(returnTo)}`} data-testid={`link-shared-reel-${reelId}`} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5 no-underline"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/30 bg-black/20"><Clapperboard size={18}/></span><span className="min-w-0"><span className="block truncate font-semibold">{content.replace(/:\s*\S+$/,'')}</span><span className="block text-xs opacity-75">Open Reel</span></span></Link>}
function ChatPage({matchId,returnTo='/matches'}:{matchId:string;returnTo?:string}) {
  const [voiceActive,setVoiceActive]=useState(false);
  const [,setLocation]=useLocation(); const qc=useQueryClient(); const profile=useGetMyProfile(); const matches=useGetMatches({query:{refetchInterval:12000}}); const match=matches.data?.find(m=>m.id===matchId); const blocked=!!match?.blockedByMe||!!match?.blockedMe;
  const msgs=useGetMessages(matchId,{query:{enabled:!!match,queryKey:getGetMessagesQueryKey(matchId),refetchInterval:10000}}); const typing=useGetTypingStatus(matchId,{query:{enabled:!!match,queryKey:['/api/vibeswipe/matches',matchId,'typing'],refetchInterval:3500}}); const receipt=useGetChatReadReceipt(matchId,{query:{enabled:!!match,queryKey:getGetChatReadReceiptQueryKey(matchId),refetchInterval:5000}}); const presence=useGetMatchPresence(matchId,{query:{enabled:!!match,queryKey:getGetMatchPresenceQueryKey(matchId),refetchInterval:15000}}); const heartbeat=useHeartbeatPresence();
  const ice=useGetIcebreakers({query:{enabled:!!match,queryKey:['/api/vibeswipe/icebreakers']}}); const send=useSendMessage(); const updateTyping=useUpdateTypingStatus(); const markRead=useMarkChatRead(); const del=useDeleteMessage(); const clear=useClearChat(); const unmatch=useUnmatchMatch(); const block=useBlockProfile(); const unblock=useUnblockProfile(); const report=useReportProfile(); const theme=useUpdateChatTheme(); const upload=useRequestChatMediaUpload(); const transcode=useTranscodeProfileVideo(); const [draft,setDraft]=useState(''); const [error,setError]=useState(''); const [actions,setActions]=useState(false); const [themeOpen,setThemeOpen]=useState(false); const [deleteTarget,setDeleteTarget]=useState<Message|null>(null); const [busy,setBusy]=useState(false); const bottom=useRef<HTMLDivElement>(null); const inputRef=useRef<HTMLTextAreaElement>(null);
  const messages=(msgs.data??[]).slice().reverse(); const last=messages[messages.length-1];
  const [chatViewport,setChatViewport]=useState(()=>chatViewportFrame(window.visualViewport?.height??window.innerHeight,window.visualViewport?.offsetTop??0,window.innerHeight,false));
  const fullChatHeight=useRef(window.visualViewport?.height??window.innerHeight);
  useEffect(()=>{
    const viewport=window.visualViewport;
    const previousBodyOverflow=document.body.style.overflow;
    const previousHtmlOverflow=document.documentElement.style.overflow;
    document.body.style.overflow='hidden';
    document.documentElement.style.overflow='hidden';
    const resize=()=>{
      const focused=document.activeElement;
      const editing=focused instanceof HTMLElement&&(focused.tagName==='TEXTAREA'||focused.tagName==='INPUT'||focused.isContentEditable);
      const height=viewport?.height??window.innerHeight;
      const frame=chatViewportFrame(height,viewport?.offsetTop??0,Math.max(fullChatHeight.current,window.innerHeight),editing);
      if(!editing)fullChatHeight.current=height;
      setChatViewport(frame);
      if(editing)requestAnimationFrame(()=>{const list=bottom.current?.parentElement;list?.scrollTo({top:list.scrollHeight})});
    };
    resize();
    viewport?.addEventListener('resize',resize);
    viewport?.addEventListener('scroll',resize);
    window.addEventListener('resize',resize);
    document.addEventListener('focusin',resize);
    document.addEventListener('focusout',resize);
    return()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);document.removeEventListener('focusin',resize);document.removeEventListener('focusout',resize);document.body.style.overflow=previousBodyOverflow;document.documentElement.style.overflow=previousHtmlOverflow};
  },[]);
  useEffect(()=>{if(last&&last.senderId!==profile.data?.id&&!last.isRead)markRead.mutate({matchId},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getGetMatchesQueryKey()});void qc.invalidateQueries({queryKey:getGetNotificationsQueryKey()})}});},[last?.id,profile.data?.id]);
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
  useEffect(()=>{const list=bottom.current?.parentElement;list?.scrollTo({top:list.scrollHeight,behavior:'smooth'})},[messages.length]);
  if(matches.isLoading||msgs.isLoading)return <PageFrame><div className="h-16 animate-pulse rounded-2xl bg-white/[.04]"/><div className="mt-6"><Busy/></div></PageFrame>;
  if(matches.isError&&!matches.data)return <PageFrame><Retry error={matches.error} text="We couldn’t load your conversations. Check your connection and try again." onRetry={()=>void matches.refetch()}/></PageFrame>;
  if(!match)return <PageFrame><Empty title="Conversation unavailable" detail="This chat may have ended or the match is no longer available." action={<Link href={returnTo} data-testid="link-back-matches" className="rounded-xl bg-secondary px-4 py-2.5 font-bold">{returnTo==='/views'?'Back to messages':returnTo==='/notifications'?'Back to activity':'Back to matches'}</Link>}/></PageFrame>;
  async function sendMessage(content:string, media?:{mediaReference:string;mediaType:'image'|'video'|'audio'}){if(blocked||(!content.trim()&&!media)||send.isPending)return;const old=draft;if(!media)setDraft('');try{const message=await send.mutateAsync({matchId,data:{...(content.trim()?{content:content.trim()}:{}),...media}});qc.setQueryData<Message[]>(getGetMessagesQueryKey(matchId),previous=>previous?.some(item=>item.id===message.id)?previous:[...(previous??[]),message]);updateTyping.mutate({matchId,data:{isTyping:false}});void qc.invalidateQueries({queryKey:getGetMessagesQueryKey(matchId)});void qc.invalidateQueries({queryKey:getGetMatchesQueryKey()});setError('')}catch(error){if(!media)setDraft(current=>current&&current!==old?[old,current].filter(Boolean).join('\n'):old);setError(userErrorMessage(error,'Your message wasn’t sent. Your text is still in the input—try sending again.'))}}
  async function deleteMessageFor(message:Message,forEveryone:boolean){try{await del.mutateAsync({matchId,messageId:message.id,data:{forEveryone}});if(!forEveryone)qc.setQueryData<Message[]>(getGetMessagesQueryKey(matchId),current=>(current??[]).filter(item=>item.id!==message.id));await msgs.refetch()}catch{setError('Message could not be deleted. Please try again.')}finally{setDeleteTarget(null)}}
  async function attach(file?:File){if(!file||blocked||busy||send.isPending)return;const kind=file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':'image';if(kind==='image'&&file.size>15*1024*1024){setError('Choose an image smaller than 15 MB.');return}if(kind==='video'&&file.size>500*1024*1024){setError('Choose a video smaller than 500 MB.');return}if(kind==='audio'&&file.size>25*1024*1024){setError('Choose an audio note smaller than 25 MB.');return}setBusy(true);setError('');try{const prepared=kind==='image'?await prepareProfilePhoto(file):file;const allowed:MediaUploadInputContentType[]=['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','audio/mp4','audio/m4a','audio/aac','audio/wav'];const fallback:MediaUploadInputContentType=kind==='image'?'image/jpeg':kind==='video'?'video/mp4':'audio/m4a';const contentType:MediaUploadInputContentType=allowed.includes(prepared.type as MediaUploadInputContentType)?prepared.type as MediaUploadInputContentType:fallback;const signed=await upload.mutateAsync({matchId,data:{name:prepared.name,size:prepared.size,contentType,mediaType:kind}});if(kind==='image')await uploadProfilePhotoBytes(signed.uploadURL,prepared);else{const res=await fetch(signed.uploadURL,{method:'PUT',headers:{'Content-Type':contentType},body:prepared});if(!res.ok)throw {status:res.status}}const mediaReference=kind==='video'?(await transcode.mutateAsync({mediaId:signed.mediaId})).mediaReference:signed.mediaReference;await sendMessage('',{mediaReference,mediaType:kind})}catch(error){setError(userErrorMessage(error,'Your attachment wasn’t sent. Choose the file again to retry.'))}finally{setBusy(false)}}
  async function action(a:string){if(!match)return;setActions(false);try{if(a==='block'){if(match.blockedByMe)await unblock.mutateAsync({targetUserId:match.profile.id});else if(window.confirm(`Block ${match.profile.name}?`))await block.mutateAsync({data:{targetUserId:match.profile.id}})}if(a==='report')await report.mutateAsync({data:{targetUserId:match.profile.id,reason:'other'}});if(a==='clear'){if(window.confirm('Clear messages from your view?')){await clear.mutateAsync({matchId});await qc.invalidateQueries({queryKey:getGetMessagesQueryKey(matchId)})}}if(a==='unmatch'){if(window.confirm('Unmatch and remove this shared chat?')){await unmatch.mutateAsync({matchId});void qc.invalidateQueries({queryKey:getGetMatchesQueryKey()});setLocation(returnTo)}}if(a==='theme')setThemeOpen(true)}catch{setError('That action did not complete. Please try again.')}}
  const chatTheme=match.chatTheme; const darkChat=chatTheme==='dark';
  const accent=chatTheme==='blue'?'hsl(214 63% 52%)':chatTheme==='purple'?'hsl(263 55% 58%)':chatTheme==='green'?'hsl(157 60% 32%)':'hsl(var(--chat-pink))';
  const selfPath=`/chat/${matchId}${returnTo!=='/matches'?`?returnTo=${encodeURIComponent(returnTo)}`:''}`;
  const profileHref=`/profile/${match.profile.id}?returnTo=${encodeURIComponent(selfPath)}`;
  const statusLine=typing.data?.isTyping?`${match.profile.name} is typing…`:presence.data?.isOnline?'Online now':presence.data?.lastSeenAt?`Last seen ${new Date(presence.data.lastSeenAt).toLocaleString()}`:'A conversation just for your mutual match';
  const suggestionIcons=[Coffee,CupSoda,Music];
  function applySuggestion(question:string){if(blocked||busy||send.isPending)return;setDraft(question);window.requestAnimationFrame(()=>{const el=inputRef.current;if(el){el.focus();el.setSelectionRange(question.length,question.length)}})}
  return <div className={`chat-surface ${darkChat?'chat-dark':''} ${!messages.length?'chat-new-match':''} fixed inset-x-0 z-40 flex w-full flex-col overflow-hidden`} style={{['--chat-accent' as string]:accent,top:`calc(${chatViewport.top}px + var(--install-banner-height, 0px))`,height:`calc(${chatViewport.height}px - var(--install-banner-height, 0px))`}} data-testid="chat-page">
    <header className="flex shrink-0 items-center gap-1 border-b border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-card))] px-1.5 py-1 md:px-4">
      <Link href={returnTo} aria-label="Back" data-testid="link-chat-back" className="flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-[hsl(var(--chat-fg))] hover:bg-[hsl(var(--chat-soft))]"><ArrowLeft size={22}/></Link>
      <Link href={profileHref} aria-label={`View ${match.profile.name}’s profile`} data-testid="link-chat-profile" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 pr-2 hover:bg-[hsl(var(--chat-soft))]">
        <span className="relative shrink-0"><span className="block h-9 w-9 overflow-hidden rounded-full ring-2 ring-[var(--chat-accent)] [&>div]:h-full [&>div]:w-full"><Avatar profile={match.profile} size="sm"/></span>{presence.data?.isOnline&&<span aria-hidden="true" className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--chat-card))] bg-emerald-500"/>}</span>
        <span className="min-w-0"><span className="block truncate text-[16px] font-bold leading-5 text-[hsl(var(--chat-fg))]">{match.profile.name}</span><span data-testid="text-chat-status" className={`block truncate text-[12px] leading-4 ${presence.data?.isOnline||typing.data?.isTyping?'text-[var(--chat-accent)]':'text-[hsl(var(--chat-muted))]'}`}>{statusLine}</span></span>
      </Link>
      <button type="button" onClick={()=>setActions(true)} aria-label="Chat actions" data-testid="button-chat-actions" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[hsl(var(--chat-fg))] hover:bg-[hsl(var(--chat-soft))]"><MoreHorizontal size={21}/></button>
    </header>
    {blocked&&<div className="mx-4 mt-3 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-500">Messaging is unavailable while this profile is blocked.</div>}
    {msgs.isError&&<button onClick={()=>void msgs.refetch()} data-testid="button-retry-messages" className="mx-4 mt-3 rounded-xl bg-rose-400/10 p-2.5 text-xs font-semibold text-rose-500">Messages failed to load. Tap to retry.</button>}
    <div className="chat-wallpaper hide-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 pb-2 pt-1 md:px-6" data-testid="chat-message-list">
      {!messages.length&&!msgs.isError&&!blocked&&<div className="chat-empty-intro mx-auto max-w-xl pb-2 pt-2 text-center" data-testid="chat-empty-state">
        <Heart aria-hidden="true" size={56} strokeWidth={1.2} className="mx-auto fill-[var(--chat-accent)] text-[var(--chat-accent)] opacity-50"/>
        <h2 className="mt-4 font-serif text-[clamp(1.9rem,6vw,2.75rem)] leading-[1.1] tracking-[-.035em] text-[var(--chat-accent)]">A good conversation starts here</h2>
        <p className="mt-4 text-[15px] text-[hsl(var(--chat-muted))]">Break the ice with a question</p>
        <div className="mt-5 text-left">
          <h3 className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--chat-muted))]"><Sparkles size={20} className="text-[var(--chat-accent)]"/>Suggested questions</h3>
          {ice.isLoading&&<div className="mt-3 space-y-2.5">{[0,1,2].map(n=><div key={n} className="h-[60px] animate-pulse rounded-2xl bg-[hsl(var(--chat-soft))]"/>)}</div>}
          {ice.isError&&<button type="button" onClick={()=>void ice.refetch()} data-testid="button-retry-icebreakers" className="mt-3 w-full rounded-2xl border border-[hsl(var(--chat-border))] p-3 text-sm text-[hsl(var(--chat-muted))]">Suggestions couldn’t load. Tap to retry.</button>}
          <div className="mt-3 space-y-2.5">{ice.data?.slice(0,3).map((i,n)=>{const Icon=suggestionIcons[n]??Coffee;return <button key={i.id} type="button" disabled={blocked||busy||send.isPending} onClick={()=>applySuggestion(i.question)} data-testid={`button-chat-icebreaker-${i.id}`} className="flex w-full items-center gap-4 rounded-2xl border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-card))] px-4 py-4 text-left text-[15px] text-[hsl(var(--chat-fg))] shadow-[0_2px_8px_hsl(330_30%_40%/.06)] transition-colors hover:border-[var(--chat-accent)] disabled:opacity-50"><Icon size={26} strokeWidth={1.6} className="shrink-0 text-[var(--chat-accent)]"/>{i.question}</button>})}</div>
        </div>
      </div>}
      {messages.map((m,index)=>{const mine=m.senderId===profile.data?.id;const prev=messages[index-1];const grouped=!!prev&&prev.senderId===m.senderId&&new Date(m.createdAt).getTime()-new Date(prev.createdAt).getTime()<5*60_000;const voiceAvatar=mine?(profile.data?<Avatar profile={profile.data} size="sm"/>:null):<Avatar profile={match.profile} size="sm"/>;return <ChatMessageBubble key={m.id} message={m} mine={mine} myId={profile.data?.id} partnerName={match.profile.name} groupedWithPrevious={grouped} avatar={voiceAvatar?<span className="block h-full w-full [&>div]:h-full [&>div]:w-full">{voiceAvatar}</span>:null} mediaUrl={reference=>mediaUrl(reference)} renderText={text=><SharedReelContent content={text} returnTo={`/chat/${matchId}`}/>} onActions={()=>setDeleteTarget(m)}/>})}
      {typing.data?.isTyping&&<div className="mt-2 inline-block rounded-[12px] rounded-tl-[4px] bg-[hsl(var(--chat-card))] px-3 py-1.5 text-xs italic text-[hsl(var(--chat-muted))]">{match.profile.name} is typing…</div>}<div ref={bottom}/></div>
    {receipt.data?.readAt&&<div className="chat-wallpaper px-4 pb-0.5 text-right text-[10px] text-[hsl(var(--chat-muted))]">Seen {new Date(receipt.data.readAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div>}
    {error&&<div role="alert" className="px-4 pb-1 text-xs font-medium text-rose-500">{error}</div>}{busy&&<div role="status" className="px-4 pb-1 text-xs text-[hsl(var(--chat-muted))]" data-testid="status-chat-uploading">Uploading attachment…</div>}
    <div data-testid="chat-composer" className="shrink-0 px-1.5 pb-1.5 pt-1 md:px-4" style={{paddingBottom:chatViewport.keyboardOpen?0:'max(.375rem,env(safe-area-inset-bottom))'}}>
      <form onSubmit={e=>{e.preventDefault();if(!busy&&!voiceActive)void sendMessage(draft)}} className="relative flex items-end gap-1.5">
        {!voiceActive&&<div className="flex min-w-0 flex-1 items-end rounded-[22px] border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-card))] pl-1 pr-2 shadow-[0_1px_2px_hsl(330_25%_30%/.08)]">
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[hsl(var(--chat-muted))] hover:text-[var(--chat-accent)]" aria-label="Attach photo, video, or voice note" data-testid="button-chat-attach"><Paperclip size={21} strokeWidth={1.8}/><input data-testid="input-chat-media" type="file" accept="image/*,video/mp4,video/quicktime,audio/*" className="hidden" disabled={blocked||busy||send.isPending||voiceActive} onChange={e=>{void attach(e.currentTarget.files?.[0]);e.currentTarget.value=''}}/></label>
          <textarea ref={inputRef} data-testid="input-chat-message" value={draft} onChange={e=>setDraft(e.target.value)} disabled={blocked||busy||send.isPending||voiceActive} maxLength={2000} rows={1} placeholder={blocked?'Messaging unavailable':'Message'} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-0.5 py-[9px] text-base leading-[22px] text-[hsl(var(--chat-fg))] outline-none placeholder:text-[hsl(var(--chat-muted))]"/>
        </div>}
        {!voiceActive&&!!draft.trim()&&<button disabled={blocked||busy||send.isPending} aria-label="Send message" data-testid="button-send-message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--chat-accent)] text-white shadow-sm transition-opacity disabled:opacity-45">{send.isPending?<LoaderCircle size={19} className="animate-spin"/>:<SendHorizontal size={19}/>}</button>}
        <ChatVoiceNoteRecorder key={matchId} matchId={matchId} hidden={!!draft.trim()} disabled={blocked||busy||send.isPending} onActiveChange={setVoiceActive}/>
      </form>
    </div>
    {actions&&<Dialog title="Conversation settings" onClose={()=>setActions(false)}><div className="space-y-2"><Link href={profileHref} onClick={()=>setActions(false)} data-testid="link-chat-menu-profile" className="block w-full rounded-xl border border-white/10 p-3 text-left text-sm">View profile</Link><button onClick={()=>void action('theme')} data-testid="button-change-chat-theme" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Change chat color</button><button onClick={()=>void action('clear')} data-testid="button-clear-chat" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Clear chat for me</button><button onClick={()=>void action('report')} data-testid="button-report-chat-profile" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Report profile</button><button onClick={()=>void action('block')} data-testid="button-block-chat-profile" className="w-full rounded-xl border border-rose-300/20 p-3 text-left text-sm text-rose-300">{match.blockedByMe?'Unblock profile':'Block profile'}</button><button onClick={()=>void action('unmatch')} data-testid="button-chat-unmatch" className="w-full rounded-xl border border-rose-300/20 p-3 text-left text-sm text-rose-300">Unmatch</button></div></Dialog>}
    {themeOpen&&<Dialog title="Choose a chat color" onClose={()=>setThemeOpen(false)}><div className="grid grid-cols-2 gap-2">{(['pink','blue','purple','green','dark','light'] as ChatTheme[]).map(t=><button key={t} onClick={()=>theme.mutate({matchId,data:{theme:t}},{onSuccess:()=>{setThemeOpen(false);void qc.invalidateQueries({queryKey:getGetMatchesQueryKey()})}})} data-testid={`button-theme-${t}`} className="rounded-xl border border-white/10 p-3 text-sm font-semibold capitalize">{t}</button>)}</div></Dialog>}
    {deleteTarget&&<Dialog title="Delete message" onClose={()=>setDeleteTarget(null)}><p className="mb-4 text-sm text-muted-foreground">Choose whether to remove this message only for you or for everyone.</p><div className="space-y-2"><button disabled={del.isPending} onClick={()=>void deleteMessageFor(deleteTarget,false)} data-testid="button-delete-message-for-me" className="w-full rounded-xl border border-white/10 p-3 text-left text-sm">Delete for me</button>{deleteTarget.senderId===profile.data?.id&&<button disabled={del.isPending} onClick={()=>void deleteMessageFor(deleteTarget,true)} data-testid="button-delete-message-for-everyone" className="w-full rounded-xl border border-rose-300/20 p-3 text-left text-sm text-rose-300">Delete for everyone</button>}</div></Dialog>}
  </div>;
}

type MatchListExtras = { unreadCount?: number; lastMessageAt?: string | null };
function timeAgo(value?: string | null) {
  if (!value) return '';
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return '';
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d ago`;
  return new Date(value).toLocaleDateString();
}
function MessagesPage() {
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), refetchInterval: 10000, refetchOnMount: 'always', refetchOnWindowFocus: true, staleTime: 0 } });
  const stories = useGetStories({ query: { queryKey: getGetStoriesQueryKey(), refetchInterval: 60000 } });
  const list = useMemo(() => (matches.data ?? []).filter(m=>!m.profile.isDemo&&!m.blockedByMe&&!m.blockedMe).sort((a, b) => {
    const at = new Date((a as MatchListExtras).lastMessageAt ?? a.updatedAt).getTime();
    const bt = new Date((b as MatchListExtras).lastMessageAt ?? b.updatedAt).getTime();
    return bt - at;
  }), [matches.data]);
  const unreadTotal = list.reduce((sum, m) => sum + ((m as MatchListExtras).unreadCount ?? 0), 0);
  return <div className="messages-page min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]">
    <div className="page-in mx-auto max-w-[720px] px-4 pb-10 pt-6 md:px-8 md:pt-10" data-testid="messages-page-content">
      <div className="flex items-end justify-between gap-4">
        <h1 className="brand text-[2.5rem] font-extrabold leading-none tracking-[-.05em] md:text-5xl">Messages</h1>
        {unreadTotal > 0 && <span data-testid="text-unread-total" className="mb-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">{unreadTotal} unread</span>}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[15px] text-muted-foreground">Only mutual matches appear here.<Heart size={17} fill="currentColor" aria-hidden="true" className="text-primary"/></p>
      <div className="mt-6">
        {matches.isLoading ? <div className="space-y-3" aria-label="Loading conversations">{[0,1,2].map(i => <div key={i} className="msg-card flex items-center gap-4 rounded-[22px] p-4"><div className="h-[68px] w-[68px] animate-pulse rounded-full bg-muted"/><div className="flex-1 space-y-2"><div className="h-4 w-32 animate-pulse rounded bg-muted"/><div className="h-3 w-48 animate-pulse rounded bg-muted"/></div></div>)}</div>
          : matches.isError && !matches.data ? <Retry error={matches.error} text="We couldn’t load your messages. Check your connection and try again." onRetry={() => void matches.refetch()} />
          : !list.length ? <Empty title="No conversations yet" detail="When you and someone both say yes, your conversation opens here." action={<Link href="/discover" data-testid="link-messages-discover" className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Go to Discover</Link>} />
          : <ul className="space-y-3">{list.map(m => {
            const extras = m as MatchListExtras;
            const blocked = m.blockedByMe || m.blockedMe;
            const unread = !blocked && (extras.unreadCount ?? 0) > 0;
            const preview = m.blockedByMe ? 'You blocked this person. Unblock from Matches to chat again.' : m.blockedMe ? 'Messaging is unavailable with this person.' : m.lastMessage || 'You matched. Say hello.';
            return <li key={m.id} data-testid={`card-conversation-${m.id}`} className={`msg-card relative flex items-center gap-4 rounded-[22px] p-3.5 transition-transform md:p-4 ${blocked ? 'opacity-70' : 'hover:-translate-y-px'}`}>
              <div className="msg-avatar shrink-0"><MatchStoryAvatar matchId={m.id} profile={m.profile} storyGroup={stories.data?.matches.find(g => g.matchId === m.id)} disabled={blocked} returnTo="/messages" /></div>
              {blocked
                ? <div className="min-w-0 flex-1" data-testid={`status-conversation-blocked-${m.id}`}><div className="truncate text-[17px] font-bold">{m.profile.name}</div><div className="mt-1 text-sm text-destructive">{preview}</div></div>
                : <Link href={`/chat/${m.id}?returnTo=%2Fmessages`} data-testid={`link-conversation-${m.id}`} aria-label={`Open chat with ${m.profile.name}${unread ? `, ${extras.unreadCount} unread` : ''}`} className="flex min-w-0 flex-1 items-center gap-3 self-stretch">
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[17px] font-bold"><span className="truncate">{m.profile.name}</span><Heart size={15} fill="currentColor" aria-hidden="true" className="shrink-0 text-primary"/></div><div className={`mt-1 line-clamp-2 text-sm leading-5 ${unread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{preview}</div></div>
                  <div className="flex h-full shrink-0 flex-col items-end justify-between gap-5 self-stretch py-1">
                    <time dateTime={extras.lastMessageAt ?? m.updatedAt} className="text-xs text-muted-foreground">{timeAgo(extras.lastMessageAt ?? m.updatedAt)}</time>
                    {unread ? <span aria-label={`${extras.unreadCount} unread messages`} data-testid={`status-unread-${m.id}`} className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">{extras.unreadCount!>99?'99+':extras.unreadCount}</span> : <span className="h-7" />}
                  </div>
                </Link>}
            </li>;
          })}</ul>}
      </div>
    </div>
  </div>;
}
function NotificationsPage() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const q = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), refetchInterval: 5000, refetchOnWindowFocus: true } });
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), refetchInterval: 15000, refetchOnWindowFocus: true } });
  const mark = useMarkNotificationRead();
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  type Item = NonNullable<typeof q.data>['notifications'][number];
  const currentMatch = (n: Item) => matches.data?.find(m => m.profile.id === n.actor.id);

  async function markAsRead(n: Item) {
    if (n.readAt) return;
    try { await mark.mutateAsync({ notificationId: n.id }); } catch { /* destination stays reachable */ }
    void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
  }
  async function open(n: Item) {
    await markAsRead(n);
    if ((n.type === 'reel_like' || n.type === 'reel_comment_reply') && n.reelId) {
      const params = new URLSearchParams({ returnTo: '/notifications' });
      if (n.type === 'reel_comment_reply' && n.commentId) params.set('commentId', n.commentId);
      setLocation(`/reels/${n.reelId}?${params.toString()}`);
      return;
    }
    const match = currentMatch(n);
    if ((n.type === 'new_match' || n.type === 'new_message') && match && !match.blockedByMe && !match.blockedMe) setLocation(`/chat/${match.id}?returnTo=%2Fnotifications`);
    else if (n.type === 'new_match' || n.type === 'new_message') setLocation('/matches');
    else if (n.type === 'profile_view') setLocation(`/profile/${n.actor.id}/from-notifications`);
    else setLocation(`/profile/${n.actor.id}?returnTo=%2Fnotifications`);
  }
  async function message(n: Item) {
    if (timer.current) window.clearTimeout(timer.current);
    setNotice({ id: n.id, text: 'Checking your match…' });
    const fresh = await matches.refetch();
    if (fresh.isError || !fresh.data) {
      setNotice({ id: n.id, text: 'We couldn’t check your match right now. Check your connection and tap Send message again.' });
      return;
    }
    const match = fresh.data.find(m => m.profile.id === n.actor.id);
    void markAsRead(n);
    if (match && (match.blockedByMe || match.blockedMe)) {
      setNotice({ id: n.id, text: match.blockedByMe ? `You blocked ${n.actor.name}. Unblock them from Matches to message again.` : `Messaging with ${n.actor.name} isn’t available.` });
      return;
    }
    if (match) { setNotice(null); setLocation(`/chat/${match.id}?returnTo=%2Fnotifications`); return; }
    setNotice({ id: n.id, text: `Match first to message ${n.actor.name}. Opening their profile so you can like back.` });
    timer.current = window.setTimeout(() => setLocation(`/profile/${n.actor.id}?returnTo=%2Fnotifications`), 1400);
  }
  const actionText = (n: Item) => n.type === 'reel_comment_reply' ? 'replied to your Reel comment'
    : n.type === 'reel_like' ? 'liked your video' : n.type === 'new_match' ? 'matched with you'
    : n.type === 'new_message' ? 'sent you a message'
    : n.type === 'new_like' ? 'liked you' : 'viewed your profile';
  const unread = q.data ? Object.values(q.data.unreadCounts ?? {}).reduce((a, b) => a + (b as number), 0) : 0;

  return <PageFrame>
    <div className="-mt-4" data-testid="notifications-page-content">
      <div className="mb-6">
        <h1 className="brand text-[2.35rem] font-extrabold leading-tight tracking-[-.05em] md:text-5xl">Notifications</h1>
        {q.data && <p className="mt-2 max-w-2xl text-base font-semibold text-primary">{unread} unread updates</p>}
      </div>
      {q.isLoading ? <Busy />
        : q.isError ? <Retry onRetry={() => void q.refetch()} />
        : !q.data?.notifications.length ? <Empty title="All caught up" detail="Your new matches, likes, messages, and profile views will show up here." />
        : <div className="space-y-3">
          {q.data.notifications.map((n) => <div key={n.id} data-testid={`card-notification-${n.id}`} className="notification-card rounded-[24px] border border-border/40 bg-card text-card-foreground">
            <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
              <button type="button" onClick={() => void open(n)} data-testid={`button-notification-${n.id}`} aria-label={`${n.actor.name} ${actionText(n)}${n.readAt ? '' : ', unread'}`} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4">
                <span className="shrink-0 rounded-full border border-primary/75 p-[2px]"><Avatar profile={n.actor} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold leading-5 text-card-foreground"><span className="text-primary">{n.actor.name}</span>{' '}<span className="font-semibold">{actionText(n)}</span></span>
                  <span className="mt-2 block text-xs leading-4 text-muted-foreground">{n.type==='reel_comment_reply'?'Tap to open the comment and reply':n.type==='new_match'?'Start a conversation now!':n.type==='new_like'?'Tap to see who liked you':n.type==='new_message'?'Open your conversation':'Take a closer look'}</span>
                </span>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-3">
                <time dateTime={n.createdAt} className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</time>
                <div className="flex items-center gap-3">{!n.readAt&&<span aria-label="Unread" className="h-2.5 w-2.5 rounded-full bg-primary"/>}
                  {n.type !== 'reel_like' && n.type !== 'reel_comment_reply' && <button type="button" onClick={() => void message(n)} data-testid={`button-notification-message-${n.id}`} aria-label={`Send message to ${n.actor.name}`} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition-transform active:scale-95 sm:px-4">
                    <MessageCircle size={16} /><span className="hidden sm:inline">Send message</span>
                  </button>}
                </div>
              </div>
            </div>
            {notice?.id === n.id && <div role="status" data-testid={`status-notification-message-${n.id}`} className="mx-3 mb-3 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground sm:mx-4">{notice.text}</div>}
          </div>)}
        </div>}
    </div>
  </PageFrame>;
}

const emptyProfile:ProfileInput={name:'',age:18,gender:'',lookingFor:'Everyone',bio:'',city:'',country:null,state:null,interests:[],occupation:'Prefer not to say',occupationOther:'',photos:[],videoUrl:null,preferences:{ageMin:22,ageMax:35,gender:'Everyone',distanceKm:50}};
function ProfileLoading(){return <div role="status" aria-label="Loading your profile" className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-card px-6 py-12 text-sm text-muted-foreground"><span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-primary"/>Loading your profile…</div>}
 function ProfilePage({mode='view',returnTo='/profile'}:{mode?:'view'|'edit';returnTo?:string}){const q=useGetMyProfile<Profile>({query:{refetchOnMount:'always',refetchOnWindowFocus:true,staleTime:0,retry:shouldRetryProfile}});const settings=useGetVibeSwipeSettings();const edit=mode==='edit';const [,setLocation]=useLocation();const [saveError,setSaveError]=useState('');const save=useSaveMyProfile();const requestUpload=useRequestProfileMediaUpload();const transcode=useTranscodeProfileVideo();const [uploading,setUploading]=useState(false);const qc=useQueryClient();const [form,setForm]=useState<ProfileInput>(emptyProfile);const [formReady,setFormReady]=useState(false);const mediaInput=useRef<HTMLInputElement>(null);const [photoPreviews,setPhotoPreviews]=useState<Record<string,string>>({});const photoPreviewUrls=useRef(new Map<string,string>());useEffect(()=>()=>{for(const url of photoPreviewUrls.current.values())URL.revokeObjectURL(url);photoPreviewUrls.current.clear()},[]);useEffect(()=>{if(q.data&&!formReady){setForm({...emptyProfile,...q.data,age:q.data.age??18,preferences:{...emptyProfile.preferences,...q.data.preferences},interests:q.data.interests??[],photos:q.data.photos??[]});setFormReady(true)}},[q.data,formReady]);const change=(key:keyof ProfileInput,value:any)=>setForm(v=>({...v,[key]:value}));function removeProfilePhoto(index:number){const reference=form.photos[index];const preview=photoPreviewUrls.current.get(reference);if(preview){URL.revokeObjectURL(preview);photoPreviewUrls.current.delete(reference);setPhotoPreviews(current=>{const next={...current};delete next[reference];return next})}change('photos',form.photos.filter((_,photoIndex)=>photoIndex!==index))}
 async function uploadProfileMedia(file?:File){if(!file||uploading)return;const video=file.type.startsWith('video/');setUploading(true);setSaveError('');try{if(!video)validatePhotoFile(file);const prepared=video?file:await prepareProfilePhoto(file);const contentType:MediaUploadInputContentType=video?(file.type==='video/quicktime'?'video/quicktime':'video/mp4'):'image/jpeg';const result=await requestUpload.mutateAsync({data:{name:prepared.name,size:prepared.size,contentType,mediaType:video?'video':'image'}});if(video){const uploaded=await fetch(result.uploadURL,{method:'PUT',headers:{'Content-Type':contentType},body:prepared});if(!uploaded.ok)throw {status:uploaded.status};const done=await transcode.mutateAsync({mediaId:result.mediaId});change('videoUrl',done.mediaReference)}else{await uploadProfilePhotoBytes(result.uploadURL,prepared);const checked=await checkAdditionalProfilePhoto(result.mediaId);const preview=URL.createObjectURL(prepared);photoPreviewUrls.current.set(checked.mediaReference,preview);setPhotoPreviews(current=>({...current,[checked.mediaReference]:preview}));setForm(current=>({...current,photos:[...current.photos,checked.mediaReference].slice(0,6)}))}}catch(error){setSaveError(userErrorMessage(error,'Your picture could not be uploaded. Choose the photo again to retry.'))}finally{setUploading(false)}}
 async function submit(e:React.FormEvent){e.preventDefault();setSaveError('');if(!form.photos.length){setSaveError('Keep at least one profile photo. Add a photo before saving.');return}try{const updated=await save.mutateAsync({data:form});qc.setQueryData(getGetMyProfileQueryKey(),updated);void qc.invalidateQueries({queryKey:getGetMyProfileQueryKey()});setLocation(returnTo)}catch(error){setSaveError(userErrorMessage(error,'Your changes haven’t saved yet. Check your details and try again.'))}}
if(q.isError&&isProfileMissing(q.error))return <Redirect to="/onboarding"/>;
 const heading=edit?<div className="pe-head"><Link href={returnTo} data-testid="link-edit-profile-back" aria-label={returnTo.startsWith('/settings')?'Back to Settings':'Back to Profile'} className="pe-round"><ArrowLeft size={19}/></Link><h1 className="pe-title">Edit Profile</h1><span className="w-10" aria-hidden="true"/></div>:null;
   const Frame=edit?ProfileEditFrame:OwnProfileFrame;
   return <Frame>{heading}{q.isLoading||edit&&!formReady?<ProfileLoading/>:q.isError&&!q.data?<Retry text={q.error?.status===401?'Your session has expired. Please sign in again.':'We couldn’t load your profile. Check your connection and try again.'} onRetry={()=>void q.refetch()}/>:!q.data?<Empty title="Your profile is waiting" detail="Finish a few details to begin discovering people." action={<Link href="/onboarding" data-testid="link-profile-onboarding" className="rounded-xl bg-primary px-4 py-3 font-bold text-[#26111b]">Set up profile</Link>}/>:<>{q.isRefetchError&&!edit&&<div role="alert" className="mb-4 rounded-xl border border-white/10 bg-card p-4 text-sm text-muted-foreground">Your saved profile is shown below. We couldn’t refresh it. <button className="font-semibold text-primary" onClick={()=>void q.refetch()}>Try again</button></div>}{!edit&&<OwnProfileOverview profile={q.data} travelCity={settings.data?.travelMode?settings.data.travelCity:null}/>}
  {edit&&<form onSubmit={e=>void submit(e)} className="pb-[calc(7rem+env(safe-area-inset-bottom))]" data-testid="form-edit-profile">
   <section className="pe-card" data-testid="section-edit-photos"><div className="flex items-baseline justify-between"><h2 className="pe-label">Photos</h2><span className="text-sm font-bold text-[hsl(var(--pe-pink))]" data-testid="text-photo-count">{form.photos.length}/6</span></div>
     <div className="mt-4 grid grid-cols-3 gap-3">{Array.from({length:6},(_,index)=>{const photo=form.photos[index];return photo?<div key={`${photo}-${index}`} className="pe-slot relative overflow-hidden"><MediaImage reference={photo} fallbackSrc={photoPreviews[photo]} alt={`Profile photo ${index+1}`} className="h-full w-full object-cover"/>{index===0&&<span className="pe-main">Main photo</span>}<button type="button" onClick={()=>removeProfilePhoto(index)} aria-label={`Remove profile photo ${index+1}`} data-testid={`button-remove-profile-photo-${index}`} className="pe-x"><X size={14} strokeWidth={2.6}/></button></div>:<button key={`empty-${index}`} type="button" disabled={uploading||form.photos.length>=6} onClick={()=>mediaInput.current?.click()} aria-label="Add a photo" data-testid={`button-add-profile-photo-slot-${index}`} className="pe-slot pe-empty">{uploading&&index===form.photos.length?<span className="text-[11px] font-semibold text-[hsl(var(--pe-muted))]">Uploading…</span>:<span className="pe-plus"><span className="sr-only">Add</span>+</span>}</button>})}</div>
     <p className="mt-4 text-center text-[13px] text-[hsl(var(--pe-muted))]">{form.photos.length===0?'Add at least one photo before saving.':'Add up to 6 photos to show your vibe.'} New photos are kept after you tap Save profile.</p>
     <input ref={mediaInput} data-testid="input-profile-media" type="file" accept={`${PROFILE_PHOTO_ACCEPT},video/mp4,video/quicktime`} className="sr-only" tabIndex={-1} disabled={uploading} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file&&!file.type.startsWith('video/')&&form.photos.length>=6){setSaveError('You can add up to 6 photos. Remove one to add another.');return}void uploadProfileMedia(file)}}/>
    <button type="button" disabled={uploading} onClick={()=>mediaInput.current?.click()} data-testid="button-add-profile-video" className="mt-3 w-full rounded-xl border border-dashed border-[hsl(var(--pe-pink)/.45)] py-2.5 text-[13px] font-semibold text-[hsl(var(--pe-pink))] disabled:opacity-50">{form.videoUrl?'Profile video ready · replace media':'Add photo or profile video'}</button>
   </section>
   <section className="pe-card mt-4"><h2 className="pe-label mb-4">About you</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><input data-testid="input-profile-name" required maxLength={60} value={form.name} onChange={e=>change('name',e.target.value)} className="field"/></Field><Field label="Age (18+)"><input data-testid="input-profile-age" required type="number" min="18" max="120" value={form.age} onChange={e=>change('age',Number(e.target.value))} className="field"/></Field><Field label="Gender"><input data-testid="input-profile-gender" value={form.gender} onChange={e=>change('gender',e.target.value)} className="field"/></Field><Field label="Looking for"><input data-testid="input-profile-looking" value={form.lookingFor} onChange={e=>change('lookingFor',e.target.value)} className="field"/></Field><Field label="City"><input data-testid="input-profile-city" value={form.city} onChange={e=>change('city',e.target.value)} className="field"/></Field><Field label="Bio"><textarea data-testid="input-profile-bio" maxLength={500} rows={4} value={form.bio} onChange={e=>change('bio',e.target.value)} className="field"/></Field><div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold text-muted-foreground">Hobbies</p><HobbyMultiSelect value={form.interests} onChange={value=>change('interests',value)} testIdPrefix="profile-edit"/></div><div className="sm:col-span-2"><OccupationSelect value={form.occupation||'Prefer not to say'} otherValue={form.occupationOther||''} onChange={value=>change('occupation',value)} onOtherChange={value=>change('occupationOther',value)} testIdPrefix="profile-edit"/></div></div></section>
   <div className="pe-savebar">{saveError&&<p role="alert" data-testid="error-edit-profile" className="pe-error">{saveError}</p>}<button disabled={save.isPending||uploading} data-testid="button-save-profile" className="pe-save">{save.isPending?'Saving…':uploading?'Uploading…':'Save profile'}</button></div>
  </form>}
   </>}</Frame>}

function ProfileEditFrame({children}:{children:ReactNode}){return <div className="profile-edit -mb-24 min-h-[100dvh] lg:mb-0"><div className="page-in mx-auto max-w-[560px] px-4 pt-[calc(1rem+env(safe-area-inset-top))]">{children}</div></div>}
function OwnProfileFrame({children}:{children:ReactNode}){useEffect(()=>{const el=document.documentElement;el.classList.add('op-lock');return()=>el.classList.remove('op-lock')},[]);return <div className="own-profile op-fit -mb-24 lg:mb-0"><div className="page-in mx-auto flex h-full max-w-[560px] flex-col px-4 pt-3 md:pt-6">{children}</div></div>}
function genderIcon(g:string){const v=g.toLowerCase();if(/^(man|male|men)\b/.test(v))return Mars;if(/^(woman|female|women)\b/.test(v))return Venus;return NonBinary}
function OwnProfileOverview({profile,travelCity}:{profile:Profile;travelCity?:string|null}){
  const [broken,setBroken]=useState(false);useEffect(()=>setBroken(false),[profile.photos?.[0]]);
  const GenderIcon=genderIcon(profile.gender||'');const place=[[profile.city,profile.state].filter(Boolean).join(', '),profile.country].filter(Boolean).join(' · ');
  const work=profile.occupation==='Other'?(profile.occupationOther||'Other'):(profile.occupation||'Prefer not to say');
  const bio=profile.bio||'Add a bio so people can get to know you.';const shown=profile.interests.slice(0,5);const more=profile.interests.length-shown.length;
  return <div data-testid="section-own-profile" className="op-overview flex min-h-0 flex-1 flex-col gap-[clamp(6px,1.4dvh,14px)] pb-[clamp(8px,1.6dvh,16px)]">
    <div className="op-toolbar flex shrink-0 items-center justify-between"><h2 data-testid="text-my-profile-heading" className="op-title">My Profile</h2><div className="flex items-center gap-2"><Link href="/settings?returnTo=%2Fprofile" data-testid="link-profile-settings" aria-label="Settings" className="op-ghost inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-transform active:scale-95"><Settings size={16}/>Settings</Link></div></div>
    <section className="op-card op-identity flex shrink-0 flex-col items-center rounded-[26px] px-4 py-[clamp(10px,2dvh,22px)] text-center">
      <div className="op-portrait op-avatar overflow-hidden rounded-full">{profile.photos?.[0]&&!broken?<MediaImage reference={profile.photos[0]} onError={()=>setBroken(true)} className="h-full w-full object-cover" alt={`${profile.name}'s profile photo`}/>:<span className="flex h-full items-center justify-center text-4xl font-bold text-primary">{profile.name?.slice(0,1)?.toUpperCase()}</span>}</div>
      <h1 data-testid="text-profile-name" title={profile.name} className="brand mt-2 max-w-full truncate text-[clamp(22px,3.4dvh,30px)] font-extrabold leading-tight tracking-[-.03em]">{profile.name}{profile.age!==null?`, ${profile.age}`:''}<VerifiedBadge verified={profile.isVerified}/></h1>
      {place&&<p data-testid="text-profile-city" title={place} className="op-muted max-w-full truncate text-[14px]">{place}</p>}
      {(profile.gender||travelCity)&&<div className="mt-1 flex max-w-full items-center justify-center gap-2 text-[13px]">{profile.gender&&<span data-testid="text-profile-gender" className="op-muted inline-flex items-center gap-1.5"><GenderIcon size={15} aria-hidden="true"/>{profile.gender}</span>}{travelCity&&<span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary" data-testid="badge-travel" title={`Traveling in ${travelCity}`}><Navigation size={12}/>Traveling in {travelCity}</span>}</div>}
      <Link href="/profile/edit?returnTo=%2Fprofile" data-testid="button-edit-profile" className="op-edit mt-[clamp(8px,1.6dvh,16px)] flex h-[clamp(40px,6dvh,50px)] w-full max-w-[280px] items-center justify-center gap-2 rounded-full text-[16px] font-bold transition-transform active:scale-[.98]"><Pencil size={16}/>Edit profile</Link>
    </section>
    <div className="grid shrink-0 grid-cols-2 gap-[clamp(6px,1.2dvh,12px)]">
      <section className="op-section min-w-0"><h3 className="op-label"><span className="op-ico"><UserRound size={13}/></span>About</h3><p data-testid="text-profile-bio" title={bio} className="mt-1.5 line-clamp-2 text-[13.5px] leading-5">{bio}</p></section>
      <section className="op-section min-w-0"><h3 className="op-label"><span className="op-ico"><Briefcase size={13}/></span>Work</h3><p data-testid="text-profile-occupation" title={work} className="mt-1.5 line-clamp-2 text-[13.5px] leading-5">{work}</p></section>
    </div>
    <section className="op-section shrink-0"><h3 className="op-label"><span className="op-ico"><Heart size={13}/></span>Hobbies</h3>{profile.interests.length?<div className="mt-2 flex h-[28px] flex-wrap gap-1.5 overflow-hidden" title={profile.interests.join(', ')} aria-label={`Hobbies: ${profile.interests.join(', ')}`}>{shown.map(i=><span key={i} className="op-chip max-w-[46%] truncate rounded-full px-3 py-1 text-[12.5px] font-semibold">{i}</span>)}{more>0&&<Link href="/profile/edit?returnTo=%2Fprofile" data-testid="link-more-hobbies" className="op-chip rounded-full px-3 py-1 text-[12.5px] font-bold">+{more}</Link>}</div>:<p className="op-muted mt-1.5 text-[13px]">Add a few hobbies to your profile.</p>}</section>
    <section className="op-section shrink-0"><div className="flex items-center justify-between"><h3 className="op-label"><span className="op-ico"><Camera size={13}/></span>Photos <span className="op-muted ml-0.5 text-xs font-semibold tracking-normal">{profile.photos.length}/6</span></h3><Link href="/profile/edit?returnTo=%2Fprofile" data-testid="link-manage-photos" className="op-manage inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"><Camera size={12}/>Manage</Link></div>
      {profile.photos.length?<div className="mt-2 grid grid-cols-6 gap-1.5">{profile.photos.slice(0,6).map((p,i)=><div key={`${p}-${i}`} className="op-thumb relative aspect-square overflow-hidden rounded-xl"><MediaImage reference={p} alt={`Profile photo ${i+1}${i===0?' (main)':''}`} className="h-full w-full object-cover"/>{i===0&&<span className="absolute inset-x-0 bottom-0 bg-[#F34E9A] text-center text-[9px] font-bold leading-[14px] text-[#24111b]">Main</span>}</div>)}</div>:<p className="op-muted mt-1.5 text-[13px]">Add photos in Edit profile.</p>}
    </section>
     <ProfileReelsSection profileId={profile.id} returnTo="/profile" own />
  </div>;
}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="grid gap-2 text-xs font-semibold text-muted-foreground">{label}{children}</label>}


const setupSteps=['First name','Last name','Age','Gender','Looking for','Profile photo','Bio','Hobbies','Work / occupation','Preferences'];
function normalizeHobbies(value: unknown): string[] { if(Array.isArray(value))return value.filter((item):item is string=>typeof item==='string');if(typeof value==='string')return value.split(',').map(item=>item.trim()).filter(Boolean).slice(0,12);return [] }
function OnboardingPage(){const [,setLocation]=useLocation();const q=useGetOnboardingDraft({query:{queryKey:getGetOnboardingDraftQueryKey()}});const saveDraft=useSaveOnboardingDraft();const saveProfile=useSaveMyProfile();const requestUpload=useRequestProfileMediaUpload();const qc=useQueryClient();const [uploading,setUploading]=useState(false);const [step,setStep]=useState(0);const [data,setData]=useState<Record<string,any>>({firstName:'',lastName:'',age:'',gender:'',lookingFor:'Everyone',photos:[],bio:'',country:'',countryCode:'',countrySource:'',state:'',stateCode:'',city:'',interests:[],occupation:'Prefer not to say',occupationOther:'',ageMin:'22',ageMax:'35',distanceKm:50});const [ready,setReady]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);const currentKey=useRef('');useEffect(()=>{if(q.isSuccess&&!ready){const d=q.data.data??{};const source=d.countrySource==='gps'||d.countrySource==='manual'?d.countrySource:'';const clean=source?d:{...d,country:'',countryCode:'',countrySource:'',state:'',stateCode:'',city:''};setData(v=>({...v,...clean,interests:normalizeHobbies(d.interests),occupation:typeof d.occupation==='string'?d.occupation:'Prefer not to say',occupationOther:typeof d.occupationOther==='string'?d.occupationOther:''}));setStep(source?Math.max(0,Math.min(9,(q.data.step||1)-1)):0);setReady(true);currentKey.current=`${q.data.step}:${JSON.stringify(d)}`}},[q.data,q.isSuccess,ready]);const update=(k:string,v:any)=>{setData(d=>({...d,[k]:v}));setSaved(false);setError('')};const updateOnboardingCountry=(result:OnboardingCountry)=>{setData(d=>({...d,country:result.country,countryCode:result.countryCode,countrySource:result.source,state:'',stateCode:'',city:''}));setSaved(false);setError('')};
const retryPhoto=useRef<File|null>(null);const [photoRetry,setPhotoRetry]=useState(false);const [selectedPhotoPreview,setSelectedPhotoPreview]=useState('');const selectedPhotoPreviewRef=useRef('');const preparedPhotoForPreview=useRef<File|null>(null);const rawPhotoPreviewFailed=useRef(false);const [photoPreviews,setPhotoPreviews]=useState<Record<string,string>>({});const photoPreviewUrls=useRef(new Map<string,string>());const livePreviewUrls=useRef(new Set<string>());const [uploadStatus,setUploadStatus]=useState('');const autosaveTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const latestDraftKey=useRef('');latestDraftKey.current=`${step+1}:${JSON.stringify(data)}`;
useEffect(()=>()=>{for(const url of livePreviewUrls.current)URL.revokeObjectURL(url);livePreviewUrls.current.clear();photoPreviewUrls.current.clear()},[]);
function makePhotoPreview(file:Blob){const url=URL.createObjectURL(file);livePreviewUrls.current.add(url);return url}
function setPhotoPreviewFile(file:Blob){const previous=selectedPhotoPreviewRef.current;if(previous&&!Array.from(photoPreviewUrls.current.values()).includes(previous)){URL.revokeObjectURL(previous);livePreviewUrls.current.delete(previous)}const url=makePhotoPreview(file);selectedPhotoPreviewRef.current=url;setSelectedPhotoPreview(url)}
function releasePhotoPreview(reference:string){const url=photoPreviewUrls.current.get(reference);if(!url)return;URL.revokeObjectURL(url);livePreviewUrls.current.delete(url);photoPreviewUrls.current.delete(reference);setPhotoPreviews(current=>{const next={...current};delete next[reference];return next})}
function selectedPhotoPreviewError(){rawPhotoPreviewFailed.current=true;if(preparedPhotoForPreview.current)setPhotoPreviewFile(preparedPhotoForPreview.current)}
async function uploadOnboardingPhoto(file?:File){if(!file||uploading)return;setError('');try{validatePhotoFile(file)}catch(error){retryPhoto.current=null;setPhotoRetry(false);setError(userErrorMessage(error,'Choose a JPG/JPEG, PNG, WebP, or HEIC/HEIF photo.'));return}retryPhoto.current=file;setPhotoRetry(false);rawPhotoPreviewFailed.current=false;preparedPhotoForPreview.current=null;setUploading(true);setUploadStatus('Preparing photo…');try{setPhotoPreviewFile(file);const prepared=await prepareProfilePhoto(file);preparedPhotoForPreview.current=prepared;if(rawPhotoPreviewFailed.current)setPhotoPreviewFile(prepared);setUploadStatus('Connecting to photo storage…');const result=await requestUpload.mutateAsync({data:{name:prepared.name,size:prepared.size,contentType:'image/jpeg',mediaType:'image'}});await uploadProfilePhotoBytes(result.uploadURL,prepared,{onAttempt:attempt=>setUploadStatus(attempt===1?'Uploading photo…':`Reconnecting… attempt ${attempt} of 3`)});const preview=selectedPhotoPreviewRef.current;if(preview){photoPreviewUrls.current.set(result.mediaReference,preview);setPhotoPreviews(current=>({...current,[result.mediaReference]:preview}))}update('photos',[...data.photos,result.mediaReference].slice(0,6));selectedPhotoPreviewRef.current='';setSelectedPhotoPreview('');preparedPhotoForPreview.current=null;rawPhotoPreviewFailed.current=false;retryPhoto.current=null}catch(error){setError(userErrorMessage(error,'Your photo could not be uploaded. Choose the photo again to retry.'));setPhotoRetry(photoUploadCanRetry(error))}finally{setUploading(false);setUploadStatus('')}}
useEffect(()=>{if(!ready)return;const key=`${step+1}:${JSON.stringify(data)}`;if(key===currentKey.current)return;autosaveTimer.current=setTimeout(()=>saveDraft.mutate({data:{step:step+1,data}},{onSuccess:d=>{currentKey.current=`${d.step}:${JSON.stringify(data)}`;qc.setQueryData(getGetOnboardingDraftQueryKey(),d);setSaved(latestDraftKey.current===key)},onError:error=>{setSaved(false);setError(userErrorMessage(error,'Your latest changes haven’t saved yet. Keep this screen open and tap Continue to try again.'))}}),650);return()=>clearTimeout(autosaveTimer.current)},[ready,step,data]);
function validate(){if(step===0&&!data.firstName.trim())return 'Add your first name to continue.';if(step===0&&(!data.country||!data.countryCode||!data.countrySource))return 'Set your country to continue.';if(step===1&&!data.lastName.trim())return 'Add your last name to continue.';if(step===2&&(!Number.isInteger(Number(data.age))||Number(data.age)<18))return 'Myage is for adults 18 and over.';if((step===3||step===4)&&!data[step===3?'gender':'lookingFor'])return 'Choose an option to continue.';if(step===5&&!data.photos?.length)return 'Add a profile photo to continue.';if(step===9&&(Number(data.ageMin)<18||Number(data.ageMax)<Number(data.ageMin)))return 'Set a valid age range.';return ''}
async function next(){if(uploading||saveDraft.isPending||saveProfile.isPending)return;clearTimeout(autosaveTimer.current);const message=validate();if(message){setError(message);return}setError('');try{await saveDraft.mutateAsync({data:{step:Math.min(step+2,10),data}});if(step<9){setStep(step+1);return}const profile=await saveProfile.mutateAsync({data:{name:`${data.firstName} ${data.lastName}`.trim(),age:Number(data.age),gender:data.gender,lookingFor:data.lookingFor,bio:data.bio||'',city:'',country:data.country||null,state:null,interests:normalizeHobbies(data.interests).slice(0,12),occupation:String(data.occupation||'Prefer not to say').slice(0,80),occupationOther:data.occupation==='Other'?String(data.occupationOther||'').trim().slice(0,80):'',photos:data.photos,videoUrl:null,preferences:{ageMin:Number(data.ageMin)||22,ageMax:Number(data.ageMax)||35,gender:data.lookingFor,distanceKm:Number(data.distanceKm)||50}}});qc.setQueryData(getGetMyProfileQueryKey(),profile);void qc.invalidateQueries();setLocation('/discover',{replace:true})}catch(error){setError(userErrorMessage(error,'Your setup hasn’t saved yet. Keep this screen open and tap Continue to try again.'))}}
if(q.isError&&!ready)return <PageFrame><Retry error={q.error} text="We couldn’t load your saved setup. Check your connection and try again." onRetry={()=>void q.refetch()}/></PageFrame>;
if(q.isLoading||!ready)return <PageFrame><PageHeading eyebrow="Your profile" title="Getting your space ready"/><Busy/></PageFrame>;
const choices=(values:string[],key:string)=> <div className="grid grid-cols-2 gap-2">{values.map(v=><button type="button" key={v} onClick={()=>update(key,v)} data-testid={`button-choice-${key}-${v.toLowerCase().replaceAll(' ','-')}`} className={`rounded-xl border p-3 text-sm font-semibold ${data[key]===v?'border-primary/50 bg-accent text-[#ffafd1]':'border-white/10 bg-white/[.02]'}`}>{v}</button>)}</div>;
 return <PageFrame><div className="mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-4xl flex-col md:min-h-[calc(100dvh-80px)]"><div className="mb-8 shrink-0"><div className="flex justify-between text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground"><span className="text-primary">Create your profile</span><span>Step {step+1} of 10 · {saved?'Saved':saveDraft.isError?'Not saved':'Saving as you go'}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${((step+1)/10)*100}%`}}/></div></div>
  <div key={step} className="page-in flex flex-1 flex-col justify-center py-6" aria-live="polite"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{setupSteps[step]}</p><h2 className="brand mt-3 max-w-3xl text-[2.15rem] font-bold leading-tight tracking-[-.04em] sm:text-5xl">{['What should we call you?','And your last name?','How old are you?','How do you describe yourself?','Who would you like to meet?','Choose a profile photo.','What would you like people to know?','Choose your hobbies.','What do you do for work?','Set your discovery preferences.'][step]}</h2><p className="mt-3 text-sm text-muted-foreground">Myage is a space for adults 18 and over.</p><div className="mt-7 w-full max-w-2xl">
{step===0&&<input data-testid="input-onboarding-first-name" autoComplete="given-name" value={data.firstName} onChange={e=>update('firstName',e.target.value)} placeholder="First name" className="field"/>}
{step===1&&<input data-testid="input-onboarding-last-name" autoComplete="family-name" value={data.lastName} onChange={e=>update('lastName',e.target.value)} placeholder="Last name" className="field"/>}
{step===2&&<input data-testid="input-onboarding-age" type="number" min="18" max="120" value={data.age} onChange={e=>update('age',e.target.value)} placeholder="Age" className="field max-w-40"/>}
{step===3&&choices(['Woman','Man','Non-binary','Another identity'],'gender')}
{step===4&&choices(['Everyone','Women','Men','Non-binary people'],'lookingFor')}
{step===5&&<div>{selectedPhotoPreview&&<figure className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20"><img src={selectedPhotoPreview} onError={selectedPhotoPreviewError} data-testid="img-onboarding-photo-preview" alt="Selected profile photo preview" className="mx-auto max-h-[320px] w-full object-cover"/>{uploading&&<figcaption className="px-3 py-2 text-center text-xs text-muted-foreground">{uploadStatus||'Uploading photo…'}</figcaption>}</figure>}<div className="mb-3 grid grid-cols-3 gap-2">{(data.photos as string[]).map((p:string,i:number)=><div key={p} className="relative"><MediaImage reference={p} fallbackSrc={photoPreviews[p]} onLoad={()=>releasePhotoPreview(p)} className="aspect-[.8] w-full rounded-xl object-cover" alt={`Your photo ${i+1}`}/><button onClick={()=>{releasePhotoPreview(p);update('photos',data.photos.filter((x:string)=>x!==p))}} data-testid={`button-remove-onboarding-photo-${i}`} className="absolute right-1 top-1 rounded-full bg-black/70 p-1"><X size={14}/></button></div>)}</div><p className="text-xs text-muted-foreground">Add a clear, recent photo so people can recognize you.</p><label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-4 text-sm font-semibold text-primary hover:bg-white/[.03]"><ImagePlus size={17}/>{uploading?'Uploading photo…':'Choose a photo'}<input data-testid="input-onboarding-photo" type="file" accept={PROFILE_PHOTO_ACCEPT} disabled={uploading||data.photos.length>=6} className="hidden" onChange={e=>{void uploadOnboardingPhoto(e.currentTarget.files?.[0]);e.currentTarget.value=''}}/></label></div>}
{step===6&&<textarea data-testid="input-onboarding-bio" maxLength={500} rows={5} value={data.bio} onChange={e=>update('bio',e.target.value)} placeholder="A few things that make you, you…" className="field"/>}
{step===0&&<OnboardingCountryStep country={data.country} countryCode={data.countryCode} countrySource={data.countrySource} onSelect={updateOnboardingCountry}/>}
{step===7&&<HobbyMultiSelect value={normalizeHobbies(data.interests)} onChange={value=>update('interests',value)} testIdPrefix="onboarding"/>}
{step===8&&<OccupationSelect value={String(data.occupation||'Prefer not to say')} otherValue={String(data.occupationOther||'')} onChange={value=>update('occupation',value)} onOtherChange={value=>update('occupationOther',value)} testIdPrefix="onboarding"/>}
{step===9&&<div className="space-y-5"><div className="grid grid-cols-2 gap-3"><Field label="Age from"><input data-testid="input-onboarding-age-min" type="number" min="18" value={data.ageMin} onChange={e=>update('ageMin',e.target.value)} className="field"/></Field><Field label="Age to"><input data-testid="input-onboarding-age-max" type="number" value={data.ageMax} onChange={e=>update('ageMax',e.target.value)} className="field"/></Field></div><Field label={`Distance · ${data.distanceKm} km`}><input data-testid="input-onboarding-distance" type="range" min="1" max="500" value={data.distanceKm} onChange={e=>update('distanceKm',Number(e.target.value))} className="w-full accent-[#F34E9A]"/></Field></div>}
</div>{uploading&&<p role="status" className="mt-4 text-sm text-muted-foreground">{uploadStatus}</p>}{error&&<p role="alert" data-testid="text-onboarding-error" className="mt-5 text-sm text-rose-300">{error}</p>}{step===5&&photoRetry&&!uploading&&retryPhoto.current&&<button type="button" data-testid="button-retry-photo" className="mt-3 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary" onClick={()=>void uploadOnboardingPhoto(retryPhoto.current??undefined)}>Retry upload</button>}
 <div className="profile-setup-controls mt-8 flex items-center justify-between gap-3 border-t border-white/[.08] pt-5"><button disabled={step===0||uploading||saveDraft.isPending||saveProfile.isPending} onClick={()=>setStep(s=>Math.max(0,s-1))} data-testid="button-onboarding-back" className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold disabled:opacity-35">Back</button><button disabled={uploading||saveDraft.isPending||saveProfile.isPending||(step===5&&!data.photos.length)||(step===0&&(!data.country||!data.countrySource))} onClick={()=>void next()} data-testid="button-onboarding-next" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-[#26111b] disabled:opacity-50">{saveProfile.isPending?'Saving profile…':saveDraft.isPending?'Saving…':step===9?'Finish setup':'Continue'}<ArrowRight size={16}/></button></div></div></div></PageFrame>}

function Row({icon:Icon,title,children,testId}:{icon:typeof Heart;title:string;children:ReactNode;testId:string}){return <section className="pp-card flex items-center gap-3.5" data-testid={testId}><span className="pp-icon"><Icon size={22}/></span><div className="min-w-0 flex-1 text-[15px] leading-6 text-foreground"><h2 className="pp-label">{title}</h2>{children}</div></section>}
function PublicProfile({id,actionReturnTo='/discover'}:{id:string;actionReturnTo?:string}){
  const fromLikes=actionReturnTo==='/likes';
  const me=useGetMyProfile();
  const q=useGetProfileById(id,{query:{queryKey:getGetProfileByIdQueryKey(id)}});const view=useRecordProfileView();const seen=useRef('');const [photoError,setPhotoError]=useState(false);const [viewer,setViewer]=useState<number|null>(null);
  const client=useQueryClient();const [,setLocation]=useLocation();const reaction=useCreateReaction();const likes=useGetDailyLikeStatus({query:{queryKey:getGetDailyLikeStatusQueryKey()}});const supers=useGetSuperLikeStatus({query:{queryKey:getGetSuperLikeStatusQueryKey()}});
  const [confirmation,setConfirmation]=useState<{text:string;kind:'like'|'super'}|null>(null);const [actionError,setActionError]=useState('');const block=useBlockProfile();const report=useReportProfile();const [menu,setMenu]=useState(false);const [confirmSafety,setConfirmSafety]=useState<'block'|'report'|null>(null);const [safetyError,setSafetyError]=useState('');const [reported,setReported]=useState(false);const [matchResult,setMatchResult]=useState<{name:string;matchId:string|null}|null>(null);
  const confirmationTimer=useRef<number|null>(null);const busy=useRef(false);const mounted=useRef(true);const currentId=useRef(id);currentId.current=id;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(confirmationTimer.current!==null)window.clearTimeout(confirmationTimer.current)}},[]);
  useEffect(()=>{if(q.data?.id&&seen.current!==q.data.id){seen.current=q.data.id;view.mutate({profileId:q.data.id})}},[q.data?.id]);
  useEffect(()=>{setPhotoError(false);setViewer(null)},[q.data?.id,q.data?.photos?.[0]]);
  const likeRemaining=likes.data?.remaining;const superRemaining=supers.data?.remaining;
  const locked=reaction.isPending||!!confirmation||!!matchResult;
  async function react(type:'pass'|'like'|'super'){
   const target=q.data;if(!target||busy.current||locked)return;const returnTo=actionReturnTo;const targetId=target.id;const name=target.name;
   if(type==='like'&&likeRemaining===0){setActionError('You have used all of today’s likes. They reset in 24 hours.');return}
   if(type==='super'&&superRemaining===0){setActionError('You have used today’s Super Like. It resets in 24 hours.');return}
   busy.current=true;setActionError('');
   try{const result=await reaction.mutateAsync({data:{toUserId:targetId,type}});
    if(!mounted.current||currentId.current!==targetId){busy.current=false;return}
    void client.invalidateQueries({queryKey:getGetDiscoverProfilesQueryKey()});
    if(type==='pass'){busy.current=false;setLocation(returnTo);return}
    void client.invalidateQueries({queryKey:type==='like'?getGetDailyLikeStatusQueryKey():getGetSuperLikeStatusQueryKey()});void client.invalidateQueries({queryKey:getGetMatchesQueryKey()});void client.invalidateQueries({queryKey:getGetNotificationsQueryKey()});
    setConfirmation({kind:type,text:type==='like'?`You liked ${name}`:`You super liked ${name}`});
    confirmationTimer.current=window.setTimeout(()=>{confirmationTimer.current=null;busy.current=false;if(!mounted.current||currentId.current!==targetId)return;setConfirmation(null);if(result.matched)setMatchResult({name,matchId:result.matchId??null});else setLocation(returnTo)},1500);
   }catch(error){busy.current=false;if(!mounted.current||currentId.current!==targetId)return;const message=error instanceof Error?error.message:'';const capped=/limit|429|remaining|already/i.test(message);
    setActionError(type==='pass'?'That pass did not save. Please try again.':capped?(type==='super'?'Your Super Like for today is already used.':'You have reached today’s like limit.'):type==='super'?'That Super Like did not go through. Please try again.':'That like did not go through. Please try again.');
    if(type==='like')void likes.refetch();if(type==='super')void supers.refetch()}
  }
  async function runSafety(kind:'block'|'report'){if(!q.data)return;setSafetyError('');try{if(kind==='block'){await block.mutateAsync({data:{targetUserId:q.data.id}});void client.invalidateQueries({queryKey:getGetMatchesQueryKey()});setConfirmSafety(null);setMenu(false);setLocation(actionReturnTo)}else{await report.mutateAsync({data:{targetUserId:q.data.id,reason:'other'}});setReported(true);setConfirmSafety(null)}}catch(error){setSafetyError(error instanceof Error&&error.message?error.message:kind==='block'?'Could not block this profile. Please try again.':'Could not send the report. Please try again.')}}
  useEffect(()=>{if(viewer===null)return;const len=q.data?.photos?.length??0;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setViewer(null);if(e.key==='ArrowRight')setViewer(v=>v===null?v:Math.min(len-1,v+1));if(e.key==='ArrowLeft')setViewer(v=>v===null?v:Math.max(0,v-1))};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[viewer,q.data?.photos?.length]);
  if(q.isLoading)return <div className="public-profile min-h-[100dvh]"><div className="mx-auto max-w-md px-5 pt-20" aria-label="Loading profile"><div className="mx-auto h-32 w-32 animate-pulse rounded-full bg-[hsl(var(--pp-soft))]"/><div className="mx-auto mt-5 h-6 w-40 animate-pulse rounded-full bg-[hsl(var(--pp-soft))]"/><div className="mt-8 h-40 animate-pulse rounded-3xl bg-[hsl(var(--pp-card))]"/></div></div>;
  if(q.isError||!q.data)return <div className="public-profile min-h-[100dvh] px-5 pt-6"><Link href={actionReturnTo} aria-label="Back" data-testid="link-public-profile-back-top" className="pp-round"><ArrowLeft size={20}/></Link><div className="mx-auto mt-16 max-w-sm"><Retry onRetry={()=>void q.refetch()} text="Profile unavailable."/></div></div>;
  const profile=q.data;const photos=profile.photos??[];const location=[profile.city,profile.state,profile.country].filter(Boolean).join(', ');const headerLocation=[profile.city,profile.state].filter(Boolean).join(', ')||location;
  const work=profile.occupation==='Other'?(profile.occupationOther||'Other'):(profile.occupation||'');
  const facts=[profile.showAge&&profile.age!==null?{icon:Sparkles,label:'Age',value:String(profile.age)}:null,{icon:Briefcase,label:'Work',value:work||'Not shared'},{icon:Heart,label:'Looking for',value:profile.lookingFor||'Not shared'},{icon:Users,label:'Gender',value:profile.gender||'Not shared'}].filter(Boolean) as {icon:typeof Heart;label:string;value:string}[];
  const likeOut=likeRemaining===0;const superOut=superRemaining===0;
  return <div className="public-profile min-h-[100dvh]"><main className="page-in mx-auto w-full max-w-md px-5 pt-[max(env(safe-area-inset-top),0.5rem)] pb-[calc(11rem+env(safe-area-inset-bottom))]" data-testid="public-profile-page">
   <div className="flex items-center justify-between">
    <Link href={actionReturnTo} aria-label="Back" data-testid="link-public-profile-back-top" className="pp-round"><ArrowLeft size={20}/></Link>
    <button type="button" onClick={()=>{setSafetyError('');setConfirmSafety(null);setMenu(true)}} aria-label={`More actions for ${profile.name}`} data-testid="button-public-profile-more" className="pp-round"><MoreHorizontal size={20}/></button>
   </div>
    <header className="mt-3 flex flex-col items-center text-center">
    <button type="button" disabled={!photos.length} onClick={()=>setViewer(0)} aria-label={`Open ${profile.name}'s main photo`} data-testid="button-public-profile-avatar" className={`pp-avatar ${fromLikes?'pp-avatar-hero':''}`}>
     {photos.length&&!photoError?<MediaImage reference={photos[0]} alt={`${profile.name}'s main photo`} onError={()=>setPhotoError(true)} className={`h-full w-full object-cover ${fromLikes?'rounded-[24px]':'rounded-full'}`}/>:<span className="brand text-5xl font-bold">{profile.name.trim().slice(0,1).toUpperCase()}</span>}
    </button>
    <h1 data-testid="text-public-profile-name" className="mt-4 break-words text-[1.75rem] font-extrabold leading-tight tracking-[-.02em]">{profile.name}{profile.showAge&&profile.age!==null&&<span className="font-semibold text-[hsl(var(--pp-muted))]">, {profile.age}</span>}<VerifiedBadge verified={profile.isVerified}/></h1>
    <p data-testid="text-public-profile-location" className="mt-1 flex items-center gap-1.5 text-[14px] text-[hsl(var(--pp-muted))]"><MapPin size={15} className="shrink-0 text-[hsl(var(--pp-pink))]"/>{headerLocation||'Location not shared'}</p>
   </header>
   <section className="pp-card mt-7 divide-y divide-[hsl(var(--pp-line))] !py-1" data-testid="section-facts">
    {facts.map(f=><div key={f.label} className="flex items-center gap-3.5 py-3" data-testid={`section-${f.label.toLowerCase().replace(/\s/g,'-')}`}><span className="pp-icon"><f.icon size={17}/></span><span className="text-[13px] font-semibold text-[hsl(var(--pp-muted))]">{f.label}</span><span className="ml-auto max-w-[60%] break-words text-right text-[15px] font-semibold">{f.value}</span></div>)}
   </section>
   <section className="pp-card mt-4" data-testid="section-about"><h2 className="pp-label">About me</h2><p className="mt-2 whitespace-pre-wrap text-[15px] leading-6">{profile.bio||'No bio added yet.'}</p>
    {profile.interests.length>0&&<div className="mt-4 flex flex-wrap gap-2" data-testid="section-interests">{profile.interests.map(interest=><span key={interest} className="pp-pill">{interest}</span>)}</div>}
    {location&&location!==headerLocation&&<p className="mt-4 text-[13px] text-[hsl(var(--pp-muted))]">Based in {location}</p>}
   </section>
   <section className="mt-6" data-testid="section-more-photos"><div className="flex items-baseline justify-between px-1"><h2 className="pp-label">Photos</h2><span className="text-xs font-semibold text-[hsl(var(--pp-muted))]">{photos.length}</span></div>
    {photos.length?<div data-testid="public-profile-gallery" className="hide-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">{photos.map((photo,index)=><button key={`${photo}-${index}`} type="button" onClick={()=>setViewer(index)} aria-label={`Open photo ${index+1} of ${photos.length}`} data-testid={`button-public-profile-photo-${index}`} className="pp-thumb"><MediaImage reference={photo} alt={`${profile.name}'s photo ${index+1}`} className="h-full w-full object-cover"/></button>)}</div>:<p className="mt-2 px-1 text-sm text-[hsl(var(--pp-muted))]">No photos shared yet.</p>}
   </section>
    <ProfileReelsSection profileId={profile.id} returnTo={`/profile/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(actionReturnTo)}`} />
  </main>
   <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[29] flex flex-col items-center gap-3 px-3">
    {(actionError||(likeOut&&superOut))&&<p role={actionError?'alert':'status'} data-testid="error-viewed-profile-action" className="pp-toast pointer-events-auto max-w-[92vw] rounded-full px-4 py-2 text-center text-xs font-semibold">{actionError||'Today’s likes and Super Like are used up.'}</p>}
    <div className="pointer-events-none flex items-end justify-center gap-5 min-[380px]:gap-8" role="group" aria-label="Profile actions" data-testid="public-profile-actions">
     <button type="button" onClick={()=>void react('pass')} disabled={locked} data-testid="button-viewed-profile-pass" aria-label={`Pass on ${profile.name}`} className="pp-action"><span className="pp-fab pp-fab-white h-[58px] w-[58px]"><X size={26} strokeWidth={2.6} className="text-[hsl(var(--pp-muted))]"/></span><span className="pp-cap">Pass</span></button>
     <button type="button" onClick={()=>void react('like')} disabled={locked||likes.isLoading||likeOut} data-testid="button-viewed-profile-like" aria-label={fromLikes?`Like ${profile.name} back`:`Like ${profile.name}`} className="pp-action"><span className="pp-fab pp-fab-pink h-[74px] w-[74px]"><Heart size={32} fill="currentColor"/></span><span className="pp-cap">{likeOut?'No likes left':fromLikes?'Like Back':'Like to match'}</span></button>
     {!fromLikes&&<button type="button" onClick={()=>void react('super')} disabled={locked||supers.isLoading||superOut} data-testid="button-viewed-profile-super-like" aria-label={`Super Like ${profile.name}`} className="pp-action"><span className="pp-fab pp-fab-white h-[58px] w-[58px]"><Star size={25} fill="currentColor" className="text-[hsl(var(--pp-gold))]"/></span><span className="pp-cap">{superOut?'Used today':'Super Like'}</span></button>}
    </div>
   </div>
   {viewer!==null&&photos[viewer]&&<div className="fixed inset-0 z-[70] flex flex-col bg-[hsl(330_20%_6%/.94)]" role="dialog" aria-modal="true" aria-label={`${profile.name}'s photos`} data-testid="public-profile-photo-viewer" onTouchStart={e=>{(e.currentTarget as HTMLElement).dataset.x=String(e.touches[0].clientX)}} onTouchEnd={e=>{const start=Number((e.currentTarget as HTMLElement).dataset.x);const dx=e.changedTouches[0].clientX-start;if(Math.abs(dx)>50)setViewer(v=>v===null?v:Math.max(0,Math.min(photos.length-1,v+(dx<0?1:-1))))}}>
    <div className="flex items-center justify-between px-4 pt-[calc(1rem+env(safe-area-inset-top))] text-[hsl(330_30%_96%)]"><span className="text-sm font-semibold">{viewer+1} / {photos.length}</span><button type="button" autoFocus onClick={()=>setViewer(null)} aria-label="Close photos" data-testid="button-close-photo-viewer" className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(0_0%_100%/.12)]"><X size={22}/></button></div>
    <div className="relative flex flex-1 items-center justify-center p-4"><MediaImage reference={photos[viewer]} alt={`${profile.name}'s photo ${viewer+1}`} className="max-h-full max-w-full rounded-2xl object-contain"/>
     {viewer>0&&<button type="button" onClick={()=>setViewer(viewer-1)} aria-label="Previous photo" className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(0_0%_100%/.14)] text-[hsl(330_30%_96%)]"><ArrowLeft size={20}/></button>}
     {viewer<photos.length-1&&<button type="button" onClick={()=>setViewer(viewer+1)} aria-label="Next photo" className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(0_0%_100%/.14)] text-[hsl(330_30%_96%)]"><ArrowRight size={20}/></button>}
    </div>
   </div>}
   {menu&&<Dialog title={profile.name} onClose={()=>{setMenu(false);setConfirmSafety(null)}}>{confirmSafety?<div><p className="mb-4 text-sm leading-6 text-muted-foreground">{confirmSafety==='block'?`Block ${profile.name}? They won’t be able to see you or message you, and any match will end.`:`Report ${profile.name} to our safety team? They won’t be told who reported them.`}</p>{safetyError&&<p role="alert" data-testid="error-public-profile-safety" className="mb-3 rounded-xl bg-destructive/15 px-3 py-2 text-xs font-semibold text-destructive">{safetyError}</p>}<div className="flex flex-col gap-2"><button type="button" disabled={block.isPending||report.isPending} onClick={()=>void runSafety(confirmSafety)} data-testid="button-confirm-public-profile-safety" className="w-full rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground disabled:opacity-60">{block.isPending||report.isPending?'Working…':confirmSafety==='block'?'Block':'Send report'}</button><button type="button" onClick={()=>{setConfirmSafety(null);setSafetyError('')}} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold">Cancel</button></div></div>:<div className="flex flex-col gap-2">{reported&&<p role="status" className="mb-1 text-sm text-muted-foreground">Thanks, your report was sent.</p>}<button type="button" disabled={reported} onClick={()=>setConfirmSafety('report')} data-testid="button-public-profile-report" className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm font-semibold disabled:opacity-50"><Flag size={17} className="text-primary"/>{reported?'Reported':'Report profile'}</button><button type="button" onClick={()=>setConfirmSafety('block')} data-testid="button-public-profile-block" className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm font-semibold text-destructive"><Ban size={17}/>Block {profile.name}</button></div>}</Dialog>}
  {confirmation&&<div className="fixed inset-x-0 top-[calc(5rem+env(safe-area-inset-top))] z-[60] flex justify-center px-4" role="status" aria-live="polite" data-testid="status-viewed-profile-liked"><div data-testid="text-viewed-profile-liked" className="pp-confirm flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold">{confirmation.kind==='super'?<Star size={17} fill="currentColor" className="text-[hsl(var(--pp-gold))]"/>:<Heart size={17} fill="currentColor" className="text-[hsl(var(--pp-pink))]"/>}{confirmation.text}</div></div>}
  <MatchCelebration visible={!!matchResult} self={me.data??null} other={q.data??null} canMessage={!!matchResult?.matchId}
    onMessage={()=>{const matchId=matchResult?.matchId;if(!matchId)return;setMatchResult(null);const origin=`/profile/${id}?returnTo=${encodeURIComponent(actionReturnTo)}`;setLocation(`/chat/${matchId}?returnTo=${encodeURIComponent(origin)}`)}}
    onKeepSwiping={()=>{setMatchResult(null);setLocation('/discover')}}/>
  </div>
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
  const passwordTooShort=password.length>0&&password.length<15;
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
    if(!emailValid||password.length<15)return;
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
  return <div className="onboarding-video-form auth-sign-up grain flex min-h-[100dvh] items-center justify-center bg-background px-4"><OnboardingVideoBackground form/><div className="auth-sign-up-brand"><Brand/></div><section className="w-full max-w-[440px] rounded-[26px] border border-white/10 bg-[#211d25] p-6 shadow-2xl sm:p-8">
    <div className="mb-7"><img src={pathFor('/icon.png')} alt="" className="mb-5 h-12 w-12 rounded-2xl border border-white/10"/><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Myage · 18+</p>{!verifying&&<><p className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Account setup · {step==='email'?'1':'2'} of 2</p><div className="mt-2 flex gap-2" aria-label={`Step ${step==='email'?'1':'2'} of 2`}><span className="h-1 flex-1 rounded-full bg-primary"/><span className={`h-1 flex-1 rounded-full ${step==='password'?'bg-primary':'bg-white/10'}`}/></div></>}<h1 className="brand mt-2 text-3xl font-bold tracking-[-.05em]">{verifying?'Check your email':step==='email'?'Start with your email':'Create a password'}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{verifying?`We sent a verification code to ${email.trim()}.`:step==='email'?'Enter your email to begin creating your account.':'Choose a password with at least 15 characters.'}</p></div>
    <form onSubmit={submit} className="space-y-5" noValidate>
      {!verifying&&step==='email'?<label className="grid gap-2 text-xs font-semibold text-[#e7dce3]">Email address<input data-testid="input-signup-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={e=>{setEmail(e.target.value);setError('')}} className="field" placeholder="you@example.com"/>{email&& !emailValid&&<span className="text-xs font-normal text-rose-300" data-testid="error-signup-email">Enter a valid email address.</span>}</label>
      :!verifying?<><button type="button" onClick={()=>{setError('');setStep('email')}} data-testid="button-signup-back-email" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={14}/>Change email</button>
      <SignupPasswordField value={password} onChange={value=>{setPassword(value);setError('')}}/>{passwordTooShort&&<span className="text-xs font-normal text-rose-300" data-testid="error-signup-password">Password must be at least 15 characters</span>}
      </>:<label className="grid gap-2 text-xs font-semibold text-[#e7dce3]">Email verification code<input data-testid="input-signup-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} className="field" placeholder="Enter your code"/></label>}
      {error&&<p role="alert" data-testid="error-signup-clerk" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] px-3 py-2.5 text-xs leading-5 text-rose-200">{error}</p>}
      <button type="submit" disabled={busy||fetchStatus==='fetching'||(verifying&&!code.trim())||(!verifying&&step==='email'&&!emailValid)||(!verifying&&step==='password'&&password.length<15)} data-testid="button-signup-continue" className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-[#24111b] disabled:cursor-not-allowed disabled:opacity-40">{busy?'Please wait…':verifying?'Verify email':step==='email'?'Continue':'Create account'}{!busy&&<ArrowRight size={16}/>}</button>
      {verifying&&<button type="button" onClick={async()=>{setBusy(true);setError('');try{const result=await signUp.verifications.sendEmailCode();if(result.error)setError(result.error.message)}catch(e){setError(e instanceof Error?e.message:'Could not resend the code.')}finally{setBusy(false)}}} data-testid="button-resend-signup-code" className="w-full text-center text-xs font-semibold text-primary">Resend code</button>}
    </form>
    <p className="mt-6 border-t border-white/[.08] pt-5 text-center text-xs text-muted-foreground">Already a member? <Link href="/sign-in" data-testid="link-signin-from-signup" className="font-bold text-primary">Sign in</Link></p>
    <p className="mt-4 text-center text-[10px] leading-5 text-muted-foreground">By continuing, you confirm you are 18 or older.</p>
    <p className="mt-3 text-center text-[10px] text-muted-foreground"><Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link><span className="px-2">·</span><Link href="/terms" className="hover:text-primary">Terms of Service</Link></p>
  </section></div>;
}
function RouteShell({component:Component}:{component:()=>ReactNode}){return <ShellPage><Component/></ShellPage>}
const CHAT_RETURN_PATHS=['/views','/messages','/notifications','/matches','/discover','/likes'];
function ChatRoute(){const params=useParams<{matchId:string}>();const requested=safeAppReturnPath(new URLSearchParams(window.location.search).get('returnTo'),'/matches');const returnTo=CHAT_RETURN_PATHS.includes(requested)||requested.startsWith('/profile/')?requested:'/matches';return <ShellPage><ChatPage matchId={params.matchId||''} returnTo={returnTo}/></ShellPage>}
function OnboardingRoute(){return <Gate><div className="onboarding-video-form profile-setup-shell min-h-[100dvh] bg-background text-foreground"><OnboardingVideoBackground form/><OnboardingGate/></div></Gate>}
function ProfileRoute(){return <ShellPage><ProfilePage mode="view"/></ShellPage>}
function ProfileEditRoute(){const requested=new URLSearchParams(window.location.search).get('returnTo');const returnTo=safeAppReturnPath(requested,'/profile');return <ShellPage><ProfilePage mode="edit" returnTo={returnTo}/></ShellPage>}
function SettingsRoute(){return <ShellPage><SettingsIndexPage/></ShellPage>}
function FaceVerificationRoute(){return <ShellPage><FaceVerificationPage/></ShellPage>}
function SettingsSectionRoute(){return <ShellPage><SettingsSectionPage/></ShellPage>}
function SafetyCenterRoute(){return <ShellPage><SafetyCenterPage/></ShellPage>}
function CommunityGuidelinesRoute(){return <CommunityGuidelinesPage/>}
function PrivacyPolicyRoute(){return <PrivacyPolicyPage/>}
function ReportSafetyRoute(){return <ShellPage><ReportSafetyPage/></ShellPage>}
function PublicLocationShareRoute(){return <PublicLocationSharePage/>}
function DiscoverRoute(){return <ShellPage><DiscoverPage/></ShellPage>}
function SearchRoute(){return <ShellPage><MemberSearchPage/></ShellPage>}
function ReelsRoute(){return <ShellPage><ReelsFeedPage/></ShellPage>}
function ReelRoute(){const params=useParams<{reelId:string}>();return <ShellPage><ReelsFeedPage key={params.reelId} initialReelId={params.reelId}/></ShellPage>}
function ReelComposerRoute(){return <ShellPage><ReelComposerPage/></ShellPage>}
function ReelsLibraryRoute(){return <ShellPage><ReelsLibraryPage/></ShellPage>}
function StoryComposerRoute(){return <ShellPage><StoryComposerPage/></ShellPage>}
function MatchesRoute(){return <ShellPage><MutualMatchesPage avatar={p=><Avatar profile={p}/>}/></ShellPage>}
function VisitorsPage(){
  const visitors=useGetWhoViewedYou({query:{refetchInterval:30000,refetchOnMount:'always'}});
  return <PageFrame><section className="-mt-3" data-testid="visitors-page">
    <h1 className="brand text-[2.35rem] font-bold tracking-[-.04em] md:text-5xl">Who viewed you</h1>
    <p className="mb-6 mt-2 border-b border-primary/10 pb-5 text-sm text-muted-foreground">People who viewed your profile recently</p>
    {visitors.isLoading?<Busy/>:visitors.isError&&!visitors.data?<Retry text="We couldn’t load your profile visitors. Please try again." onRetry={()=>void visitors.refetch()}/>:!visitors.data?.length?<p className="py-8 text-center text-sm text-muted-foreground">No profile views yet.</p>:<ul className="space-y-3">{visitors.data.map(({profile})=><li key={profile.id}><Link href={`/profile/${profile.id}?returnTo=%2Fviews`} data-testid={`card-visitor-${profile.id}`} className="visitor-card flex items-center gap-4 rounded-[24px] border border-border/50 bg-card px-4 py-5 shadow-[0_4px_18px_rgba(90,40,65,.05)]"><span className="shrink-0 rounded-full border border-primary/70 p-[3px]"><Avatar profile={profile}/></span><span className="min-w-0 flex-1"><span className="block text-[17px] font-bold leading-6 text-foreground">{profile.name}{profile.age!=null?`, ${profile.age}`:''}<Heart size={16} aria-hidden="true" fill="currentColor" className="ml-2 inline text-primary"/></span><span className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin size={15} className="mt-0.5 shrink-0 text-primary"/>{profile.city?.trim()||profile.state?.trim()||profile.country?.trim()||'Location not shared'}</span></span><ChevronRight size={21} className="shrink-0 text-primary"/></Link></li>)}</ul>}
  </section></PageFrame>;
}
function ViewsRoute(){return <ShellPage><InboundPeoplePage kind="views" avatar={p=><Avatar profile={p}/>}/></ShellPage>}
function LikesRoute(){return <ShellPage><InboundPeoplePage kind="likes" avatar={p=><Avatar profile={p}/>}/></ShellPage>}
function MessagesRoute(){return <ShellPage><MessagesPage/></ShellPage>}
function NotificationsRoute(){return <ShellPage><ActivityOverview avatar={p=><Avatar profile={p}/>}/></ShellPage>}
function ViewedNotificationProfileRoute(){const params=useParams<{profileId:string}>();return <ShellPage><PublicProfile id={params.profileId||''} actionReturnTo="/notifications"/></ShellPage>}
function PublicProfileRoute(){const params=useParams<{profileId:string}>();const returnTo=safeAppReturnPath(new URLSearchParams(window.location.search).get('returnTo'),'/discover');return <ShellPage><PublicProfile id={params.profileId||''} actionReturnTo={returnTo}/></ShellPage>}
function SettingsThemeSync() {
  const { isLoaded, isSignedIn } = useUser();
  const settings = useGetVibeSwipeSettings({ query: { enabled: Boolean(isLoaded && isSignedIn), queryKey: getGetVibeSwipeSettingsQueryKey() } });
  const lightMode = isSignedIn && settings.data?.darkMode === false;
  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.dataset.theme = lightMode ? "light" : "dark";
    const syncBrowserColor = () => {
      const onProfile = document.documentElement.classList.contains("op-lock");
      const color = onProfile ? (lightMode ? "#fde4ec" : "#3a2232") : (lightMode ? "#f8f6fa" : "#15131a");
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", color);
    };
    syncBrowserColor();
    const observer = new MutationObserver(syncBrowserColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute("content", lightMode ? "default" : "black-translucent");
    return () => observer.disconnect();
  }, [isLoaded, lightMode]);
  return null;
}
function ClerkCacheSync(){const {user}=useUser();const client=useQueryClient();const previous=useRef<string|null|undefined>(undefined);useEffect(()=>{const id=user?.id??null;if(previous.current!==undefined&&previous.current!==id)client.clear();previous.current=id},[user?.id,client]);return null}
function ClerkRoutes(){const [,setLocation]=useLocation();return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={pathFor('/sign-in')} signUpUrl={pathFor('/sign-up')} localization={{signIn:{start:{title:'Welcome back',subtitle:'Your next good conversation is waiting.'}},signUp:{start:{title:'Make room for a spark',subtitle:'Create your adults-only Myage account.'}}}} routerPush={to=>setLocation(to.startsWith(basePath)?to.slice(basePath.length)||'/':to)} routerReplace={to=>setLocation(to.startsWith(basePath)?to.slice(basePath.length)||'/':to,{replace:true})}><ClerkCacheSync/><SettingsThemeSync/><Switch>
  <Route path="/" component={HomeRedirect}/>
  <Route path="/welcome" component={WelcomeRoute}/>
  <Route path="/admin" component={AdminPage}/><Route path="/admin/:section" component={AdminPage}/>
  <Route path="/sign-in/*?"><div className="auth-sign-in grain flex min-h-[100dvh] flex-col bg-background px-4"><header className="mb-6 shrink-0 px-2" data-testid="header-sign-in-brand"><Brand/></header><main className="flex w-full flex-1 flex-col items-center justify-center"><SignIn routing="path" path={pathFor('/sign-in')} signUpUrl={pathFor('/sign-up')}/><p className="mt-5 text-center text-xs text-muted-foreground"><Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link><span className="px-2">·</span><Link href="/terms" className="hover:text-primary">Terms of Service</Link></p></main></div></Route>
  <Route path="/sign-up/*?" component={BrandedSignUp}/>
  {import.meta.env.DEV&&<Route path="/create-account-preview"><div className="border-b border-primary/20 bg-accent px-5 py-3 text-center text-xs leading-5 text-foreground" role="note">Form preview only. Email-code signup still needs the authentication setting changed.</div><ProfileFirstSignup previewOnly/></Route>}
  <Route path="/onboarding" component={OnboardingRoute}/><Route path="/discover" component={DiscoverRoute}/><Route path="/search" component={SearchRoute}/><Route path="/stories/new" component={StoryComposerRoute}/><Route path="/reels" component={ReelsRoute}/><Route path="/reels/new" component={ReelComposerRoute}/><Route path="/reels/saved" component={ReelsLibraryRoute}/><Route path="/reels/:reelId" component={ReelRoute}/><Route path="/matches" component={MatchesRoute}/>
  <Route path="/chat/:matchId" component={ChatRoute}/><Route path="/views" component={ViewsRoute}/><Route path="/likes" component={LikesRoute}/><Route path="/messages" component={MessagesRoute}/><Route path="/notifications" component={NotificationsRoute}/>
   <Route path="/privacy-policy" component={PrivacyPolicyRoute}/><Route path="/terms" component={CommunityGuidelinesRoute}/><Route path="/community-guidelines" component={CommunityGuidelinesRoute}/>
   <Route path="/safety-center" component={SafetyCenterRoute}/><Route path="/report-safety" component={ReportSafetyRoute}/><Route path="/safety/location" component={PublicLocationShareRoute}/>
  <Route path="/profile" component={ProfileRoute}/><Route path="/profile/edit" component={ProfileEditRoute}/><Route path="/profile/:profileId/from-notifications" component={ViewedNotificationProfileRoute}/><Route path="/profile/:profileId" component={PublicProfileRoute}/><Route path="/verify-profile" component={FaceVerificationRoute}/><Route path="/settings" component={SettingsRoute}/><Route path="/settings/:section" component={SettingsSectionRoute}/><Route component={NotFound}/>
</Switch></ClerkProvider>}
function ConsumerInstallBanner(){const [location]=useLocation();return location.startsWith('/admin')||location.startsWith('/reels')?null:<MobileInstallBanner/>}
function App(){if(!clerkPubKey)throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');return <QueryClientProvider client={queryClient}><ConnectionNotice/><WouterRouter base={basePath}><ConsumerInstallBanner/><ClerkRoutes/></WouterRouter></QueryClientProvider>}
export default App;
