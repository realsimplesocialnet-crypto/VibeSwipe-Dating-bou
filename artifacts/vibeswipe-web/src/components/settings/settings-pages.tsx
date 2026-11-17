import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import {
  ArrowLeft, ChevronRight, Eye, EyeOff, Globe2, LockKeyhole, MapPin, Moon, Shield,
  SlidersHorizontal, UserRound, Bell, Heart, MessageCircle, ShieldCheck, FileText, UserX, Check, LoaderCircle, LogOut,
} from "lucide-react";
import {
  getGetBlockedProfilesQueryKey, getGetDiscoverProfilesQueryKey, getGetMyProfileQueryKey, getGetVibeSwipeSettingsQueryKey,
  useGetBlockedProfiles, useGetMyProfile, useGetVibeSwipeSettings, useSaveMyProfile,
  useUnblockProfile, useUpdateVibeSwipeSettings,
  type Profile, type ProfileInput, type VibeSwipeSettings,
} from "@workspace/api-client-react";
import { Link, useLocation, useParams } from "wouter";
import { TravelModeSettings } from "@/components/travel-mode-settings";
import { DiscoveryLocationSettings } from "@/components/settings/discovery-location-settings";
import { WebPushSettings } from "@/components/WebPushSettings";
import { QuickmavoShopMenuItem } from "@/components/settings/quickmavo-shop";
import { settingsBackTarget } from "@/lib/settings-navigation";

type FullSettings = VibeSwipeSettings & {
  showAge: boolean;
  showDistance: boolean;
  notifyMatches: boolean;
  notifyLikes: boolean;
  notifyMessages: boolean;
  notifyProfileViews: boolean;
  darkMode: boolean;
  language: string;
  deactivated: boolean;
};

const sections = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "privacy", label: "Privacy", icon: EyeOff },
  { id: "discovery", label: "Discovery", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "safety", label: "Safety", icon: Shield },
  { id: "app", label: "App", icon: Moon },
  { id: "account-actions", label: "Account Actions", icon: UserX },
  { id: "legal", label: "Legal", icon: FileText },
] as const;

const settingDefaults: FullSettings = {
  incognito: false, showAge: true, showDistance: true, notifyMatches: true, notifyLikes: true,
  notifyMessages: true, notifyProfileViews: true, darkMode: true, language: "en",
  deactivated: false, travelMode: false, travelCity: null,
};

export function SettingsIndexPage() {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await signOut({ redirectUrl: import.meta.env.BASE_URL });
    } catch {
      setLogoutError("Couldn’t log out. Please check your connection and try again.");
      setLoggingOut(false);
    }
  }
  const returnTo = settingsBackTarget(new URLSearchParams(window.location.search).get("returnTo"), location, window.location.origin);
  const currentPath = `${location}${window.location.search}${window.location.hash}`;
  return <SettingsFrame>
    <Link href={returnTo} replace data-testid="link-settings-back-profile" className="mb-5 inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={19}/>Back</Link>
    <div className="mb-8">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Your comfort</p>
      <h1 className="brand mt-2 text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">Settings</h1>
    </div>
    <nav aria-label="Settings sections" className="max-w-2xl divide-y divide-white/[.07] border-y border-white/[.07]">
      {sections.map(({ id, label, icon: Icon }) => <Link key={id} href={`/settings/${id}?returnTo=${encodeURIComponent(currentPath)}`} data-testid={`link-settings-${id}`} className="group flex min-h-[64px] items-center gap-4 py-4 text-[15px] font-semibold transition-colors hover:text-primary">
        <SettingIcon><Icon size={18}/></SettingIcon><span className="flex-1">{label}</span><ChevronRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"/>
      </Link>)}
      <QuickmavoShopMenuItem />
      <button type="button" onClick={() => void logout()} disabled={loggingOut}
        data-testid="button-settings-log-out" aria-busy={loggingOut}
        className="flex min-h-[64px] w-full items-center gap-4 py-4 text-left text-[15px] font-semibold text-destructive transition-opacity hover:opacity-75 disabled:cursor-wait disabled:opacity-50">
        <SettingIcon><LogOut size={18} className="text-destructive"/></SettingIcon>
        <span className="flex-1">{loggingOut ? "Logging out…" : "Log out"}</span>
        {loggingOut && <LoaderCircle size={18} className="animate-spin"/>}
      </button>
    </nav>
    {logoutError && <p role="alert" className="mt-4 max-w-2xl text-sm text-destructive">{logoutError}</p>}
  </SettingsFrame>;
}

export function SettingsSectionPage() {
  const { section = "" } = useParams<{ section: string }>();
  const [location] = useLocation();
  const backTo = settingsBackTarget(new URLSearchParams(window.location.search).get("returnTo"), location, window.location.origin);
  const editReturnTo = `${location}${window.location.search}${window.location.hash}`;
  const selected = sections.find((item) => item.id === section);
  const query = useGetVibeSwipeSettings({ query: { queryKey: getGetVibeSwipeSettingsQueryKey() } });
  if (!selected) return <SettingsFrame><Link href={backTo} replace className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={17}/>Back</Link><p className="mt-8">This settings section isn’t available.</p></SettingsFrame>;
  const saved = { ...settingDefaults, ...(query.data as Partial<FullSettings> | undefined) };
  if (section === "notifications") return <div className="-mx-0 min-h-[calc(100dvh-66px)] bg-[#fdeef2] text-[#2b1d24] dark:bg-transparent dark:text-foreground"><SettingsFrame>
    <div className="mx-auto max-w-xl">
      <div className="mb-6 grid grid-cols-[44px_1fr_44px] items-center">
        <Link href={backTo} replace aria-label="Back" data-testid="link-settings-back" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fffafb] text-[#e0507f] shadow-[0_6px_18px_-8px_rgba(224,80,127,.45)] transition-transform hover:-translate-x-0.5 dark:bg-white/[.06] dark:text-primary dark:shadow-none"><ArrowLeft size={19}/></Link>
        <h1 className="text-center text-2xl font-bold tracking-[-.03em] text-[#e0507f] dark:text-primary md:text-[1.8rem]">Notification settings</h1>
        <span/>
      </div>
      <p className="mb-6 text-center text-sm text-[#8a6a78] dark:text-muted-foreground">Choose what you want to be notified about.</p>
      {query.isLoading ? <div aria-label="Loading settings" className="space-y-0 overflow-hidden rounded-[26px] bg-[#fffafb] p-2 dark:bg-card">{[0,1,2,3].map(i=><div key={i} className="m-2 h-[64px] animate-pulse rounded-2xl bg-[#fde3eb] dark:bg-white/[.04]"/>)}</div>
        : query.isError ? <div role="alert" className="rounded-2xl border border-rose-300/40 bg-[#fffafb] p-5 text-sm text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/[.06] dark:text-rose-200">Settings couldn’t load. <button data-testid="button-retry-settings" onClick={()=>void query.refetch()} className="ml-1 font-bold underline underline-offset-4">Try again</button></div>
        : <SectionContent section={section} settings={saved} editReturnTo={editReturnTo}/>}
    </div>
  </SettingsFrame></div>;
  return <SettingsFrame>
    <Link href={backTo} replace data-testid="link-settings-back" className="mb-5 inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={19}/>Back</Link>
    <header className="mb-7">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Settings</p>
      <h1 className="brand mt-2 text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">{selected.label}</h1>
    </header>
    {query.isLoading ? <div aria-label="Loading settings" className="max-w-2xl space-y-3">{[0,1,2].map(i=><div key={i} className="h-[76px] animate-pulse rounded-2xl border border-white/[.06] bg-white/[.03]"/>)}</div>
      : query.isError ? <div role="alert" className="max-w-2xl rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-5 text-sm text-rose-200">Settings couldn’t load. <button data-testid="button-retry-settings" onClick={()=>void query.refetch()} className="ml-1 font-bold underline underline-offset-4">Try again</button></div>
      : <SectionContent section={section} settings={saved} editReturnTo={editReturnTo}/>}
  </SettingsFrame>;
}

function SettingsFrame({ children }: { children: ReactNode }) {
  return <div className="settings-frame page-in mx-auto min-h-[100dvh] max-w-[1200px] px-4 pb-[max(env(safe-area-inset-bottom),28px)] pt-[calc(env(safe-area-inset-top,0px)+16px)] md:px-8">{children}</div>;
}

function SectionContent({ section, settings, editReturnTo }: { section: string; settings: FullSettings; editReturnTo: string }) {
  const profile = useGetMyProfile();
  const update = useUpdateVibeSwipeSettings();
  const saveProfile = useSaveMyProfile();
  const queryClient = useQueryClient();
  const { openUserProfile } = useClerk();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveSettings(patch: Partial<FullSettings>) {
    setMessage(""); setError("");
    try {
      const result = await update.mutateAsync({ data: { ...settings, ...patch } as VibeSwipeSettings });
      queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), { ...settings, ...result });
      setMessage("Saved");
    } catch {
      setError("Couldn’t save that change. Check your connection and try again.");
    }
  }

  async function savePreferences(changes: Partial<Profile["preferences"]>) {
    if (!profile.data) return;
    setMessage(""); setError("");
    const current = profile.data;
    const data: ProfileInput = {
      name: current.name, age: current.age ?? 18, gender: current.gender, lookingFor: current.lookingFor,
      bio: current.bio, city: current.city, country: current.country, state: current.state,
      interests: current.interests ?? [], occupation: current.occupation ?? "",
      occupationOther: current.occupationOther ?? "", photos: current.photos ?? [],
      videoUrl: current.videoUrl ?? null,
      preferences: { ...current.preferences, ...changes },
    };
    try {
      const updated = await saveProfile.mutateAsync({ data });
      queryClient.setQueryData(getGetMyProfileQueryKey(), updated);
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() });
      setMessage("Saved");
    } catch {
      setError("Your discovery preferences couldn’t be saved. Try again.");
    }
  }

  const status = (update.isPending || saveProfile.isPending)
    ? <span role="status" className="inline-flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle size={14} className="animate-spin"/>Saving</span>
    : message ? <span role="status" className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><Check size={14}/>{message}</span> : null;

  if (section === "notifications") return <div className="space-y-4">
    <section data-testid="card-notification-settings" className="rounded-[26px] bg-[#fffafb] px-4 py-2 shadow-[0_18px_40px_-24px_rgba(224,80,127,.5)] dark:border dark:border-white/[.08] dark:bg-card dark:shadow-none">
      <NotifyRow icon={<Heart size={22} fill="currentColor"/>} title="New matches" detail="When you match with someone new" checked={settings.notifyMatches} disabled={update.isPending} testId="toggle-notify-matches" onChange={value=>void saveSettings({notifyMatches:value})}/>
      <NotifyRow icon={<Heart size={22}/>} title="Likes" detail="When someone likes your profile" checked={settings.notifyLikes} disabled={update.isPending} testId="toggle-notify-likes" onChange={value=>void saveSettings({notifyLikes:value})}/>
      <NotifyRow icon={<MessageCircle size={22}/>} title="Messages" detail="When you receive a new message" checked={settings.notifyMessages} disabled={update.isPending} testId="toggle-notify-messages" onChange={value=>void saveSettings({notifyMessages:value})}/>
      <NotifyRow icon={<Eye size={22}/>} title="Views" detail="When someone views your profile" checked={settings.notifyProfileViews} disabled={update.isPending} testId="toggle-notify-profile-views" onChange={value=>void saveSettings({notifyProfileViews:value})}/>
      <p className="flex items-center gap-3 py-4 text-xs text-[#8a6a78] dark:text-muted-foreground"><ShieldCheck size={20} className="shrink-0 text-[#e0507f] dark:text-primary"/>You can change these settings anytime here.</p>
    </section>
    <div className="min-h-5 px-1">{status}</div>
    {error && <p role="alert" data-testid="settings-save-error" className="rounded-xl border border-rose-300/40 bg-[#fffafb] px-4 py-3 text-sm text-rose-700 dark:border-rose-300/15 dark:bg-rose-300/[.06] dark:text-rose-200">{error}</p>}
    <WebPushSettings/>
  </div>;

  return <div className="max-w-2xl space-y-3">
    {section === "account" && <>
      <Link href={`/profile/edit?returnTo=${encodeURIComponent(editReturnTo)}`} data-testid="link-settings-edit-profile" className="setting-row">
        <SettingIcon><UserRound size={18}/></SettingIcon><span className="min-w-0 flex-1"><strong>Edit profile</strong><small>Update your photos and the details people see.</small></span><ChevronRight size={18} className="text-muted-foreground"/>
      </Link>
      <ActionRow icon={<LockKeyhole size={18}/>} title="Change password" detail="Manage your sign-in credentials." action="Manage" onClick={()=>openUserProfile()}/>
      <div className="setting-row">
        <SettingIcon><Globe2 size={18}/></SettingIcon>
        <label className="min-w-0 flex-1"><strong>Language</strong><small>English is currently available.</small></label>
        <select aria-label="Language" data-testid="select-language" value={settings.language} disabled={update.isPending} onChange={event=>void saveSettings({language:event.target.value as "en"})} className="max-w-32 rounded-lg border border-white/10 bg-[#19161c] px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none">
          <option value="en">English</option>
        </select>
      </div>
    </>}
    {section === "privacy" && <>
      <div className="setting-row">
        <SettingIcon><Eye size={18}/></SettingIcon>
        <label className="min-w-0 flex-1" htmlFor="settings-profile-visibility"><strong>Who can see my profile</strong><small>Choose who can discover your profile.</small></label>
        <select id="settings-profile-visibility" aria-label="Who can see my profile" data-testid="select-profile-visibility" value={settings.incognito ? "liked_only" : "everyone"} disabled={update.isPending} onChange={event=>void saveSettings({incognito:event.target.value === "liked_only"})} className="max-w-40 rounded-lg border border-white/10 bg-[#19161c] px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none">
          <option value="everyone">Everyone</option>
          <option value="liked_only">People I like</option>
        </select>
      </div>
      <ToggleRow icon={<EyeOff size={18}/>} title="Incognito mode" detail="Only people you like can see your profile." checked={settings.incognito} disabled={update.isPending} testId="toggle-incognito" onChange={value=>void saveSettings({incognito:value})}/>
      <ToggleRow icon={<UserRound size={18}/>} title="Show my age" detail="Let people see your age on your profile." checked={settings.showAge} disabled={update.isPending} testId="toggle-show-age" onChange={value=>void saveSettings({showAge:value})}/>
      <ToggleRow icon={<MapPin size={18}/>} title="Show my distance" detail="Allow an approximate distance when location-based distance is available." checked={settings.showDistance} disabled={update.isPending} testId="toggle-show-distance" onChange={value=>void saveSettings({showDistance:value})}/>
      <p className="px-1 pt-2 text-xs leading-5 text-muted-foreground">Your exact location is never shown to other members.</p>
    </>}
    {section === "discovery" && <>
      {profile.isLoading ? <SettingsSkeleton/> : profile.isError ? <InlineError text="Your discovery preferences couldn’t load." onRetry={()=>void profile.refetch()}/> : profile.data && <>
        <PreferencesPanel profile={profile.data} saving={saveProfile.isPending} onSave={savePreferences}/>
        <DiscoveryLocationSettings profile={profile.data} saving={saveProfile.isPending} onSave={savePreferences}/>
      </>}
      <TravelModeSettings/>
    </>}
    {section === "notifications" && <>
      <ToggleRow icon={<Bell size={18}/>} title="New matches" detail="Know when someone you like likes you back." checked={settings.notifyMatches} disabled={update.isPending} testId="toggle-notify-matches" onChange={value=>void saveSettings({notifyMatches:value})}/>
      <ToggleRow icon={<Bell size={18}/>} title="Messages" detail="Get notified when a match sends you a message." checked={settings.notifyMessages} disabled={update.isPending} testId="toggle-notify-messages" onChange={value=>void saveSettings({notifyMessages:value})}/>
      <ToggleRow icon={<Eye size={18}/>} title="Profile views" detail="Know when someone visits your profile." checked={settings.notifyProfileViews} disabled={update.isPending} testId="toggle-notify-profile-views" onChange={value=>void saveSettings({notifyProfileViews:value})}/>
      <WebPushSettings/>
    </>}
    {section === "safety" && <>
      <BlockedProfiles/>
      <RouteLink href="/safety-center" title="Safety Center" detail="Guidance, trusted contacts, and location sharing." icon={<Shield size={18}/>}/>
      <RouteLink href="/report-safety" title="Report a safety issue" detail="Tell us about a concern or a member." icon={<Shield size={18}/>}/>
      <RouteLink href="/community-guidelines" title="Community guidelines" detail="What we expect from everyone here." icon={<FileText size={18}/>}/>
    </>}
    {section === "app" && <>
      <ToggleRow icon={<Moon size={18}/>} title="Dark theme" detail="Keep Myage in its low-light color scheme." checked={settings.darkMode} disabled={update.isPending} testId="toggle-dark-mode" onChange={value=>void saveSettings({darkMode:value})}/>
      <ActionRow icon={<Shield size={18}/>} title="Two-factor authentication" detail="Add another layer of account security." action="Manage" onClick={()=>openUserProfile()}/>
    </>}
    {section === "account-actions" && <>
      <DeactivateRow settings={settings} pending={update.isPending} onSave={saveSettings}/>
    </>}
    {section === "legal" && <>
      <RouteLink href="/privacy-policy" title="Privacy Policy" detail="How your information is handled." icon={<FileText size={18}/>}/>
      <RouteLink href="/terms" title="Terms of Service" detail="The terms for using Myage." icon={<FileText size={18}/>}/>
      <RouteLink href="/community-guidelines" title="Community Guidelines" detail="Standards for a respectful community." icon={<FileText size={18}/>}/>
    </>}
    {status}
    {error && <p role="alert" data-testid="settings-save-error" className="rounded-xl border border-rose-300/15 bg-rose-300/[.06] px-4 py-3 text-sm text-rose-200">{error}</p>}
  </div>;
}

function SettingIcon({ children }: { children: ReactNode }) {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">{children}</span>;
}

function ToggleRow({ icon, title, detail, checked, disabled, testId, onChange }: { icon: ReactNode; title: string; detail: string; checked: boolean; disabled: boolean; testId: string; onChange: (value:boolean)=>void }) {
  return <div className="setting-row">
    <SettingIcon>{icon}</SettingIcon><span className="min-w-0 flex-1"><strong>{title}</strong><small>{detail}</small></span>
    <button type="button" role="switch" aria-checked={checked} aria-label={title} data-testid={testId} disabled={disabled} onClick={()=>onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked?'bg-primary':'bg-white/15'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-[#211a20] transition-transform ${checked?'translate-x-6':'translate-x-1'}`}/>
    </button>
  </div>;
}

function NotifyRow({ icon, title, detail, checked, disabled, testId, onChange }: { icon: ReactNode; title: string; detail: string; checked: boolean; disabled: boolean; testId: string; onChange: (value:boolean)=>void }) {
  return <div className="flex items-center gap-4 border-b border-[#f6dbe4] py-4 dark:border-white/[.07]">
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fde8ee] text-[#ef5f8f] dark:bg-accent dark:text-primary">{icon}</span>
    <span className="min-w-0 flex-1"><strong className="block text-[16px] font-bold text-[#2b1d24] dark:text-foreground">{title}</strong><small className="mt-0.5 block text-[13px] text-[#7d6370] dark:text-muted-foreground">{detail}</small></span>
    <button type="button" role="switch" aria-checked={checked} aria-label={title} data-testid={testId} disabled={disabled} onClick={()=>onChange(!checked)} className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked?'bg-[#f27aa0] dark:bg-primary':'bg-[#ecd9e0] dark:bg-white/15'}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-[#fffafb] shadow-sm transition-transform ${checked?'translate-x-7':'translate-x-1'}`}/>
    </button>
  </div>;
}

function RouteLink({ href, title, detail, icon }: { href: string; title: string; detail: string; icon: ReactNode }) {
  return <Link href={href} className="setting-row transition-colors hover:border-primary/25">
    <SettingIcon>{icon}</SettingIcon><span className="min-w-0 flex-1"><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={18} className="text-muted-foreground"/>
  </Link>;
}

function ActionRow({ icon, title, detail, action, onClick }: { icon: ReactNode; title: string; detail: string; action: string; onClick: ()=>void }) {
  return <button type="button" onClick={onClick} className="setting-row w-full text-left transition-colors hover:border-primary/25">
    <SettingIcon>{icon}</SettingIcon><span className="min-w-0 flex-1"><strong>{title}</strong><small>{detail}</small></span><span className="text-xs font-bold text-primary">{action}</span>
  </button>;
}

function PreferencesPanel({ profile, saving, onSave }: { profile: Profile; saving: boolean; onSave: (changes: Partial<Profile["preferences"]>)=>void }) {
  const [min, setMin] = useState(profile.preferences.ageMin);
  const [max, setMax] = useState(profile.preferences.ageMax);
  const savedValues = `${profile.preferences.ageMin}:${profile.preferences.ageMax}`;
  const dirty = `${min}:${max}` !== savedValues;
  return <section className="rounded-2xl border border-white/[.08] bg-card p-5" data-testid="discovery-preferences">
    <div className="mb-5 flex items-center gap-3"><SettingIcon><SlidersHorizontal size={18}/></SettingIcon><div><h2 className="text-sm font-bold">Age preferences</h2><p className="mt-1 text-xs text-muted-foreground">Choose the age range you’d like to meet.</p></div></div>
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Age from<input type="number" min={18} max={max} value={min} data-testid="input-settings-age-min" onChange={e=>setMin(Number(e.target.value))} className="field"/></label>
        <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Age to<input type="number" min={min} max={120} value={max} data-testid="input-settings-age-max" onChange={e=>setMax(Number(e.target.value))} className="field"/></label>
      </div>
      {min>=18 && min<=120 && max>=min && max<=120 && <button type="button" disabled={!dirty||saving} onClick={()=>onSave({ageMin:min,ageMax:max})} data-testid="button-save-discovery-preferences" className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold disabled:opacity-45">{saving?"Saving…":"Save preferences"}</button>}
      {(min<18||max<min||max>120)&&<p role="alert" className="text-xs text-rose-300">Choose an age range from 18 to 120.</p>}
    </div>
  </section>;
}

function BlockedProfiles() {
  const blocked = useGetBlockedProfiles({ query: { queryKey: getGetBlockedProfilesQueryKey() } });
  const unblock = useUnblockProfile();
  const queryClient = useQueryClient();
  return <section className="rounded-2xl border border-white/[.08] bg-card p-5">
    <div className="mb-4 flex items-center gap-3"><SettingIcon><UserX size={18}/></SettingIcon><div><h2 className="text-sm font-bold">Blocked profiles</h2><p className="mt-1 text-xs text-muted-foreground">People you’ve blocked can’t contact or see you.</p></div></div>
    {blocked.isLoading ? <SettingsSkeleton/> : blocked.isError ? <InlineError text="Blocked profiles couldn’t load." onRetry={()=>void blocked.refetch()}/> : !blocked.data?.length ? <p className="rounded-xl border border-white/[.06] px-4 py-3 text-sm text-muted-foreground">No blocked profiles.</p> :
      <div className="space-y-2">{blocked.data.map(({profile})=><div key={profile.id} className="flex items-center gap-3 rounded-xl border border-white/[.07] p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">{profile.name.slice(0,1).toUpperCase()}</span><strong className="min-w-0 flex-1 truncate text-sm">{profile.name}</strong>
        <button type="button" disabled={unblock.isPending} onClick={()=>unblock.mutate({targetUserId:profile.id},{onSuccess:()=>void queryClient.invalidateQueries({queryKey:getGetBlockedProfilesQueryKey()})})} data-testid={`button-unblock-${profile.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-50">Unblock</button>
      </div>)}</div>}
  </section>;
}

function DeactivateRow({ settings, pending, onSave }: { settings: FullSettings; pending: boolean; onSave: (patch: Partial<FullSettings>)=>Promise<void> }) {
  const active = settings.deactivated;
  async function toggle() {
    const verb = active ? "reactivate" : "deactivate";
    if (!window.confirm(active ? "Reactivate your Myage account? Your profile will be available again." : "Deactivate your Myage account? Your profile will be hidden until you reactivate.")) return;
    await onSave({ deactivated: !active });
  }
  return <section className="rounded-2xl border border-rose-300/15 bg-rose-300/[.035] p-5">
    <div className="flex items-start gap-4"><SettingIcon><UserX size={18}/></SettingIcon><div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Account status</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{active ? "Your account is deactivated and your profile is hidden." : "Take a break by hiding your profile. You can reactivate at any time."}</p>
      <button type="button" disabled={pending} onClick={()=>void toggle()} data-testid="button-toggle-deactivation" className="mt-4 rounded-xl border border-rose-300/25 px-4 py-2.5 text-sm font-bold text-rose-200 disabled:opacity-50">{active?"Reactivate account":"Deactivate account"}</button>
    </div></div>
  </section>;
}

function SettingsSkeleton() {
  return <div aria-label="Loading" className="space-y-2">{[0,1].map(i=><div key={i} className="h-12 animate-pulse rounded-xl bg-white/[.035]"/>)}</div>;
}
function InlineError({ text, onRetry }: { text: string; onRetry: ()=>void }) {
  return <p role="alert" className="text-sm text-rose-200">{text} <button type="button" onClick={onRetry} className="font-bold underline underline-offset-4">Try again</button></p>;
}
