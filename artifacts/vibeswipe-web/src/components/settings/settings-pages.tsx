import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import {
  ArrowLeft, ChevronRight, Eye, EyeOff, Globe2, LockKeyhole, MapPin, Moon, Shield,
  SlidersHorizontal, UserRound, Bell, Heart, MessageCircle, ShieldCheck, FileText, UserX, Check, LoaderCircle, LogOut, Download,
  Clock3, Filter, CircleHelp, Flag, Languages,
} from "lucide-react";
import {
  getGetBlockedProfilesQueryKey, getGetDiscoverProfilesQueryKey, getGetFollowRequestsQueryKey, getGetMyProfileQueryKey, getGetVibeSwipeSettingsQueryKey,
  getGetReelsFeedQueryKey, getGetProfileLikedReelsQueryKey, getGetProfileFollowSummaryQueryKey,
  useGetBlockedProfiles, useGetMyProfile, useGetVibeSwipeSettings, useSaveMyProfile,
  useUnblockProfile, useUpdateVibeSwipeSettings, useGetFollowRequests, useApproveFollowRequest, useDeclineFollowRequest,
  type Profile, type ProfileInput, type VibeSwipeSettings, type FollowRequest, useGetScreenTimeSummary,
} from "@workspace/api-client-react";
import { Link, useLocation, useParams } from "wouter";
import { TravelModeSettings } from "@/components/travel-mode-settings";
import { DiscoveryLocationSettings } from "@/components/settings/discovery-location-settings";
import { WebPushSettings } from "@/components/WebPushSettings";
import { QuickmavoShopMenuItem } from "@/components/settings/quickmavo-shop";
import { QuietSpinner } from "@/components/ui/quiet-spinner";
import { settingsBackTarget } from "@/lib/settings-navigation";
import { isAppLanguage, useAppLanguage } from "@/lib/app-language";

type FullSettings = VibeSwipeSettings & {
  showAge: boolean;
  showDistance: boolean;
  notifyMatches: boolean;
  notifyLikes: boolean;
  notifyMessages: boolean;
  notifyProfileViews: boolean;
  darkMode: boolean;
  language: VibeSwipeSettings["language"];
  keywordFilters: string[];
  screenTimeReminderMinutes: number | null;
  screenTimeLimitMinutes: number | null;
  deactivated: boolean;
};

const sections = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "privacy", label: "Privacy", icon: EyeOff },
  { id: "language", label: "Language", icon: Languages },
  { id: "screen-time", label: "Screen time", icon: Clock3 },
  { id: "filter-keywords", label: "Filter keywords", icon: Filter },
  { id: "follow-requests", label: "Follow Requests", icon: UserRound },
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
  keywordFilters: [], screenTimeReminderMinutes: null, screenTimeLimitMinutes: null,
  deactivated: false, travelMode: false, travelCity: null,
  privateAccount: false, whoCanComment: "everyone", whoCanMessage: "everyone",
  allowDownloads: true, likedVideoAudience: "everyone",
};

export function SettingsIndexPage() {
  const [location] = useLocation();
  const { t } = useAppLanguage();
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
  const groups = [
    { title: "Account", items: [sections.find((item) => item.id === "account")!, sections.find((item) => item.id === "privacy")!, sections.find((item) => item.id === "follow-requests")!, sections.find((item) => item.id === "account-actions")!] },
    { title: "General", items: [sections.find((item) => item.id === "language")!, sections.find((item) => item.id === "screen-time")!, sections.find((item) => item.id === "filter-keywords")!, sections.find((item) => item.id === "discovery")!, sections.find((item) => item.id === "notifications")!, sections.find((item) => item.id === "app")!] },
    { title: "Support", items: [
      { id: "report-problem", label: "Report a problem", icon: Flag, href: "/report-problem" },
      { id: "help-center", label: "Help Center", icon: CircleHelp, href: "/help" },
      sections.find((item) => item.id === "safety")!,
      sections.find((item) => item.id === "legal")!,
    ] },
  ];
  return <SettingsFrame>
    <Link href={returnTo} replace data-testid="link-settings-back-profile" className="mb-5 inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={19}/>{t("Back")}</Link>
    <div className="mb-8">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">{t("Your comfort")}</p>
      <h1 className="brand mt-2 text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">{t("Settings")}</h1>
    </div>
    <div className="max-w-2xl space-y-8" aria-label="Settings sections">
      {groups.map((group) => <section key={group.title} aria-labelledby={`settings-group-${group.title.toLowerCase()}`}>
        <h2 id={`settings-group-${group.title.toLowerCase()}`} className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-muted-foreground">{t(group.title)}</h2>
        <nav className="divide-y divide-white/[.06]">
          {group.items.map((item) => {
            const Icon = item.icon;
            const href = "href" in item ? item.href : undefined;
            return <Link key={item.id} href={href ?? `/settings/${item.id}?returnTo=${encodeURIComponent(currentPath)}`} data-testid={`link-settings-${item.id}`} className="group flex min-h-[58px] items-center gap-4 py-3 text-[15px] font-semibold transition-colors hover:text-primary">
              <SettingIcon><Icon size={18}/></SettingIcon><span className="flex-1">{t(item.label)}</span><ChevronRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"/>
            </Link>;
          })}
          {group.title === "General" && <QuickmavoShopMenuItem />}
          {group.title === "Account" && <button type="button" onClick={() => void logout()} disabled={loggingOut}
            data-testid="button-settings-log-out" aria-busy={loggingOut}
            className="flex min-h-[58px] w-full items-center gap-4 py-3 text-left text-[15px] font-semibold text-destructive transition-opacity hover:opacity-75 disabled:cursor-wait disabled:opacity-50">
            <SettingIcon><LogOut size={18} className="text-destructive"/></SettingIcon>
            <span className="flex-1">{loggingOut ? t("Logging out…") : t("Log out")}</span>
            {loggingOut && <LoaderCircle size={18} className="animate-spin"/>}
          </button>}
        </nav>
      </section>)}
    </div>
    {logoutError && <p role="alert" className="mt-4 max-w-2xl text-sm text-destructive">{logoutError}</p>}
  </SettingsFrame>;
}

export function SettingsSectionPage() {
  const { section = "" } = useParams<{ section: string }>();
  const [location] = useLocation();
  const { t } = useAppLanguage();
  const backTo = settingsBackTarget(new URLSearchParams(window.location.search).get("returnTo"), location, window.location.origin);
  const editReturnTo = `${location}${window.location.search}${window.location.hash}`;
  const selected = sections.find((item) => item.id === section);
  const query = useGetVibeSwipeSettings({ query: { queryKey: getGetVibeSwipeSettingsQueryKey() } });
  if (!selected) return <SettingsFrame><Link href={backTo} replace className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={17}/>{t("Back")}</Link><p className="mt-8">{t("This settings section isn’t available.")}</p></SettingsFrame>;
  const saved = { ...settingDefaults, ...(query.data as Partial<FullSettings> | undefined) };
  if (section === "notifications") return <div className="notification-settings min-h-[calc(100dvh-66px)] bg-background text-foreground"><SettingsFrame>
    <div className="mx-auto max-w-xl">
      <div className="mb-6 grid grid-cols-[44px_1fr_44px] items-center">
        <Link href={backTo} replace aria-label="Back" data-testid="link-settings-back" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm transition-transform hover:-translate-x-0.5"><ArrowLeft size={19}/></Link>
        <h1 className="text-center text-2xl font-bold tracking-[-.03em] text-primary md:text-[1.8rem]">{t("Notification settings")}</h1>
        <span/>
      </div>
      <p className="mb-6 text-center text-sm text-muted-foreground">{t("Choose what you want to be notified about.")}</p>
      {(query.isLoading || query.isError) && !query.data ? <div className="flex justify-center py-8"><QuietSpinner onRetry={() => void query.refetch()} /></div>
        : <SectionContent section={section} settings={saved} editReturnTo={editReturnTo}/>}
    </div>
  </SettingsFrame></div>;
  return <SettingsFrame>
    <Link href={backTo} replace data-testid="link-settings-back" className="mb-5 inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={19}/>{t("Back")}</Link>
    <header className="mb-7">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">{t("Settings")}</p>
      <h1 className="brand mt-2 text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">{t(selected.label)}</h1>
    </header>
    {(query.isLoading || query.isError) && !query.data ? <div className="flex justify-center py-8"><QuietSpinner onRetry={() => void query.refetch()} /></div>
      : <SectionContent section={section} settings={saved} editReturnTo={editReturnTo}/>}
  </SettingsFrame>;
}

function SettingsFrame({ children }: { children: ReactNode }) {
  return <div className="settings-frame page-in mx-auto min-h-[100dvh] max-w-[1200px] px-4 pb-[max(env(safe-area-inset-bottom),28px)] pt-[calc(env(safe-area-inset-top,0px)+16px)] md:px-8">{children}</div>;
}

function SectionContent({ section, settings, editReturnTo }: { section: string; settings: FullSettings; editReturnTo: string }) {
  const profile = useGetMyProfile();
  const screenTime = useGetScreenTimeSummary({ query: { enabled: section === "screen-time" } });
  const update = useUpdateVibeSwipeSettings();
  const saveProfile = useSaveMyProfile();
  const queryClient = useQueryClient();
  const { openUserProfile } = useClerk();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const { t, setLanguage } = useAppLanguage();

  async function saveSettings(patch: Partial<FullSettings>): Promise<boolean> {
    setMessage(""); setError("");
    try {
      const result = await update.mutateAsync({ data: { ...settings, ...patch } as VibeSwipeSettings });
      queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), { ...settings, ...result });
      if ("language" in patch && typeof patch.language === "string" && isAppLanguage(patch.language)) setLanguage(patch.language);
      if ("privateAccount" in patch || "incognito" in patch || "whoCanComment" in patch || "allowDownloads" in patch) {
        await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
      }
      if ("likedVideoAudience" in patch) await queryClient.invalidateQueries({ queryKey: getGetProfileLikedReelsQueryKey() });
      setMessage(t("Saved"));
      return true;
    } catch {
      setError("Couldn’t save that change. Check your connection and try again.");
      return false;
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
    <section data-testid="card-notification-settings" className="rounded-[26px] border border-border bg-card px-4 py-2 shadow-sm">
      <NotifyRow icon={<Heart size={22} fill="currentColor"/>} title="New matches" detail="When you match with someone new" checked={settings.notifyMatches} disabled={update.isPending} testId="toggle-notify-matches" onChange={value=>void saveSettings({notifyMatches:value})}/>
      <NotifyRow icon={<Heart size={22}/>} title="Likes" detail="When someone likes your profile" checked={settings.notifyLikes} disabled={update.isPending} testId="toggle-notify-likes" onChange={value=>void saveSettings({notifyLikes:value})}/>
      <NotifyRow icon={<MessageCircle size={22}/>} title="Messages" detail="When you receive a new message" checked={settings.notifyMessages} disabled={update.isPending} testId="toggle-notify-messages" onChange={value=>void saveSettings({notifyMessages:value})}/>
      <NotifyRow icon={<Eye size={22}/>} title="Views" detail="When someone views your profile" checked={settings.notifyProfileViews} disabled={update.isPending} testId="toggle-notify-profile-views" onChange={value=>void saveSettings({notifyProfileViews:value})}/>
      <p className="flex items-center gap-3 py-4 text-xs text-muted-foreground"><ShieldCheck size={20} className="shrink-0 text-primary"/>You can change these settings anytime here.</p>
    </section>
    <div className="min-h-5 px-1">{status}</div>
    {error && <p role="alert" data-testid="settings-save-error" className="rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">{error}</p>}
    <WebPushSettings/>
  </div>;

  return <div className="max-w-2xl space-y-3">
    {section === "account" && <>
      <Link href={`/profile/edit?returnTo=${encodeURIComponent(editReturnTo)}`} data-testid="link-settings-edit-profile" className="setting-row">
        <SettingIcon><UserRound size={18}/></SettingIcon><span className="min-w-0 flex-1"><strong>Edit profile</strong><small>Update your photos and the details people see.</small></span><ChevronRight size={18} className="text-muted-foreground"/>
      </Link>
      <ActionRow icon={<LockKeyhole size={18}/>} title="Change password" detail="Manage your sign-in credentials." action="Manage" onClick={()=>openUserProfile()}/>
    </>}
    {section === "language" && <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("Choose your app language.")}</p>
      <div className="setting-row">
        <SettingIcon><Globe2 size={18}/></SettingIcon>
        <label className="min-w-0 flex-1" htmlFor="settings-language"><strong>{t("Language")}</strong><small>{t("Your app menus and controls use this language.")}</small></label>
        <select id="settings-language" aria-label={t("Language")} data-testid="select-language" value={settings.language} disabled={update.isPending} onChange={event=>void saveSettings({language:event.target.value as FullSettings["language"]})} className="max-w-40 rounded-lg border border-white/10 bg-[#19161c] px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none">
          <option value="en">English</option><option value="hi">हिन्दी</option><option value="fr">Français</option><option value="yo">Yorùbá</option>
        </select>
      </div>
    </div>}
    {section === "screen-time" && <section className="space-y-5" data-testid="settings-screen-time">
      <p className="text-sm leading-6 text-muted-foreground">{t("Your time is counted only while VibeSwipes is visible. Other phone apps are not tracked.")}</p>
      {screenTime.isLoading && !screenTime.data ? <div className="flex justify-center py-8"><QuietSpinner/></div>
        : screenTime.isError && !screenTime.data ? <InlineError text={t("Your screen-time summary couldn’t load.")} onRetry={()=>void screenTime.refetch()}/>
        : <>
          <div className="setting-row">
            <SettingIcon><Clock3 size={18}/></SettingIcon>
            <span className="min-w-0 flex-1"><strong>{t("Daily screen time")}</strong><small>{t("Time spent in VibeSwipes")}</small></span>
            <strong className="text-lg tabular-nums">{formatScreenDuration(screenTime.data?.todaySeconds ?? 0)}</strong>
          </div>
          <TimePreference title={t("Daily reminder")} emptyLabel={t("No reminder")} detail={t("The app will show a reminder; it won’t block access.")} value={settings.screenTimeReminderMinutes} disabled={update.isPending} testId="select-screen-time-reminder" onChange={(value)=>void saveSettings({screenTimeReminderMinutes:value})}/>
          <TimePreference title={t("Daily limit reminder")} emptyLabel={t("No limit")} detail={t("The app will show a reminder; it won’t block access.")} value={settings.screenTimeLimitMinutes} disabled={update.isPending} testId="select-screen-time-limit" onChange={(value)=>void saveSettings({screenTimeLimitMinutes:value})}/>
          <div className="space-y-3 rounded-2xl bg-card/60 p-4">
            <h2 className="text-sm font-bold">{t("Last 7 days")}</h2>
            {(screenTime.data?.days ?? []).map((day) => <div key={day.date} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0 text-muted-foreground">{formatUsageDate(day.date, settings.language)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, day.seconds / 21_600 * 100))}%` }}/></div>
              <span className="w-14 shrink-0 text-right tabular-nums">{formatScreenDuration(day.seconds)}</span>
            </div>)}
          </div>
        </>}
    </section>}
    {section === "filter-keywords" && <section className="space-y-4" data-testid="settings-keyword-filters">
      <p className="text-sm leading-6 text-muted-foreground">{t("Matching Reel captions and comments will be hidden for you.")}</p>
      <form className="flex gap-2" onSubmit={async (event) => {
        event.preventDefault();
        const value = newKeyword.trim();
        if (!value || settings.keywordFilters.length >= 25 || settings.keywordFilters.some((word) => word.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
        if (await saveSettings({ keywordFilters: [...settings.keywordFilters, value] })) setNewKeyword("");
      }}>
        <input value={newKeyword} onChange={(event) => setNewKeyword(event.target.value.slice(0, 40))} maxLength={40} placeholder={t("Add a word or phrase")} aria-label={t("Add a word or phrase")} data-testid="input-keyword-filter" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#19161c] px-4 text-sm text-foreground outline-none focus:border-primary/50"/>
        <button type="submit" disabled={update.isPending || !newKeyword.trim() || settings.keywordFilters.length >= 25} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-[#24111b] disabled:opacity-45" data-testid="button-add-keyword-filter">{t("Add keyword")}</button>
      </form>
      {!settings.keywordFilters.length ? <p className="py-6 text-center text-sm text-muted-foreground">{t("No filtered words yet.")}</p>
        : <ul className="divide-y divide-white/[.06]">
          {settings.keywordFilters.map((word) => <li key={word} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1 break-words text-sm">{word}</span>
            <button type="button" onClick={()=>void saveSettings({keywordFilters:settings.keywordFilters.filter((item)=>item!==word)})} disabled={update.isPending} className="min-h-10 rounded-lg px-3 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50" data-testid={`button-remove-keyword-${encodeURIComponent(word)}`}>{t("Remove")}</button>
          </li>)}
        </ul>}
    </section>}
    {section === "privacy" && <>
      <SettingGroupTitle title="Privacy"/>
      <ToggleRow icon={<LockKeyhole size={18}/>} title="Private account" detail="Only approved followers can see your profile and videos." checked={settings.privateAccount} disabled={update.isPending} testId="toggle-private-account" onChange={value=>void saveSettings({privateAccount:value})}/>
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
      <SettingGroupTitle title="Interactions"/>
      <ChoiceRow icon={<MessageCircle size={18}/>} title="Who can comment" detail="Control comments on your Reels." value={settings.whoCanComment} disabled={update.isPending} testId="select-who-can-comment" options={[["everyone","Everyone"],["followers","Followers only"],["no_one","No one"]]} onChange={value=>void saveSettings({whoCanComment:value as FullSettings["whoCanComment"]})}/>
      <ChoiceRow icon={<MessageCircle size={18}/>} title="Who can message" detail="Control who can start a new chat." value={settings.whoCanMessage} disabled={update.isPending} testId="select-who-can-message" options={[["everyone","Everyone"],["followers","Followers only"],["no_one","No one"]]} onChange={value=>void saveSettings({whoCanMessage:value as FullSettings["whoCanMessage"]})}/>
      <RouteLink href="/settings/follow-requests" title="Follow requests" detail="Approve or decline people asking to follow you." icon={<UserRound size={18}/>}/>
      <SettingGroupTitle title="Content"/>
      <ToggleRow icon={<Download size={18}/>} title="Allow downloads" detail="Let other members download your video Reels." checked={settings.allowDownloads} disabled={update.isPending} testId="toggle-allow-downloads" onChange={value=>void saveSettings({allowDownloads:value})}/>
      <ChoiceRow icon={<Heart size={18}/>} title="Show liked videos" detail="Choose who can see the Reels you’ve liked." value={settings.likedVideoAudience} disabled={update.isPending} testId="select-liked-video-audience" options={[["everyone","Everyone"],["followers","Followers only"],["only_me","Only me"]]} onChange={value=>void saveSettings({likedVideoAudience:value as FullSettings["likedVideoAudience"]})}/>
    </>}
    {section === "follow-requests" && <FollowRequestsPanel/>}
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
      <ToggleRow icon={<Moon size={18}/>} title="Dark theme" detail="Keep VibeSwipes in its low-light color scheme." checked={settings.darkMode} disabled={update.isPending} testId="toggle-dark-mode" onChange={value=>void saveSettings({darkMode:value})}/>
      <ActionRow icon={<Shield size={18}/>} title="Two-factor authentication" detail="Add another layer of account security." action="Manage" onClick={()=>openUserProfile()}/>
    </>}
    {section === "account-actions" && <>
      <DeactivateRow settings={settings} pending={update.isPending} onSave={saveSettings}/>
    </>}
    {section === "legal" && <>
      <RouteLink href="/privacy-policy" title="Privacy Policy" detail="How your information is handled." icon={<FileText size={18}/>}/>
      <RouteLink href="/terms" title="Terms of Service" detail="The terms for using VibeSwipes." icon={<FileText size={18}/>}/>
      <RouteLink href="/community-guidelines" title="Community Guidelines" detail="Standards for a respectful community." icon={<FileText size={18}/>}/>
      <a href="mailto:Realsimplesocialnet@gmail.com?subject=VibeSwipes%20support%20request" data-testid="link-contact-support" className="flex min-h-[62px] flex-col justify-center rounded-2xl border border-white/10 bg-white/[.02] px-4 py-3 hover:bg-white/[.04]">
        <span className="text-sm font-bold">Contact Support</span><span className="mt-1 text-xs text-muted-foreground">Realsimplesocialnet@gmail.com</span>
      </a>
      <a href="mailto:Realsimplesocialnet@gmail.com?subject=VibeSwipes%20account%20deletion%20request" data-testid="link-request-account-deletion" className="flex min-h-[62px] flex-col justify-center rounded-2xl border border-white/10 bg-white/[.02] px-4 py-3 hover:bg-white/[.04]">
        <span className="text-sm font-bold">Request account deletion</span><span className="mt-1 text-xs text-muted-foreground">Email the support team to request account and data deletion.</span>
      </a>
    </>}
    {status}
    {error && <p role="alert" data-testid="settings-save-error" className="rounded-xl border border-rose-300/15 bg-rose-300/[.06] px-4 py-3 text-sm text-rose-200">{error}</p>}
  </div>;
}

function SettingIcon({ children }: { children: ReactNode }) {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">{children}</span>;
}

function TimePreference({ title, emptyLabel, detail, value, disabled, testId, onChange }: { title: string; emptyLabel: string; detail: string; value: number | null; disabled: boolean; testId: string; onChange: (value: number | null) => void }) {
  const options = [15, 30, 60, 90, 120, 180, 240, 360];
  return <div className="setting-row">
    <SettingIcon><Clock3 size={18}/></SettingIcon>
    <label className="min-w-0 flex-1" htmlFor={testId}><strong>{title}</strong><small>{detail}</small></label>
    <select id={testId} aria-label={title} data-testid={testId} value={value ?? ""} disabled={disabled} onChange={(event)=>onChange(event.target.value ? Number(event.target.value) : null)} className="max-w-36 rounded-lg border border-white/10 bg-[#19161c] px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none">
      <option value="">{emptyLabel}</option>
      {options.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}
    </select>
  </div>;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hr` : `${hours.toFixed(1)} hr`;
}

function formatScreenDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours) return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  return `${minutes}m`;
}

function formatUsageDate(day: string, language: string) {
  const date = new Date(`${day}T12:00:00Z`);
  const locale = language === "hi" ? "hi-IN" : language === "fr" ? "fr-FR" : language === "yo" ? "yo-NG" : "en";
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function ToggleRow({ icon, title, detail, checked, disabled, testId, onChange }: { icon: ReactNode; title: string; detail: string; checked: boolean; disabled: boolean; testId: string; onChange: (value:boolean)=>void }) {
  const { t } = useAppLanguage();
  return <div className="setting-row">
    <SettingIcon>{icon}</SettingIcon><span className="min-w-0 flex-1"><strong>{t(title)}</strong><small>{t(detail)}</small></span>
    <button type="button" role="switch" aria-checked={checked} aria-label={t(title)} data-testid={testId} disabled={disabled} onClick={()=>onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked?'bg-primary':'bg-white/15'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-[#211a20] transition-transform ${checked?'translate-x-6':'translate-x-1'}`}/>
    </button>
  </div>;
}

function SettingGroupTitle({ title }: { title: string }) {
  const { t } = useAppLanguage();
  return <h2 className="px-1 pt-4 text-[11px] font-bold uppercase tracking-[.16em] text-primary">{t(title)}</h2>;
}

function ChoiceRow({ icon, title, detail, value, options, disabled, testId, onChange }: { icon: ReactNode; title: string; detail: string; value: string; options: [string,string][]; disabled: boolean; testId: string; onChange: (value:string)=>void }) {
  const { t } = useAppLanguage();
  return <div className="setting-row">
    <SettingIcon>{icon}</SettingIcon><span className="min-w-0 flex-1"><strong>{t(title)}</strong><small>{t(detail)}</small></span>
    <select aria-label={t(title)} data-testid={testId} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)} className="max-w-40 rounded-lg border border-white/10 bg-[#19161c] px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none disabled:opacity-50">
      {options.map(([option,label])=><option key={option} value={option}>{t(label)}</option>)}
    </select>
  </div>;
}

function NotifyRow({ icon, title, detail, checked, disabled, testId, onChange }: { icon: ReactNode; title: string; detail: string; checked: boolean; disabled: boolean; testId: string; onChange: (value:boolean)=>void }) {
  const { t } = useAppLanguage();
  return <div className="flex items-center gap-4 border-b border-border py-4 last:border-b-0">
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">{icon}</span>
    <span className="min-w-0 flex-1"><strong className="block text-[16px] font-bold text-foreground">{t(title)}</strong><small className="mt-0.5 block text-[13px] text-muted-foreground">{t(detail)}</small></span>
    <button type="button" role="switch" aria-checked={checked} aria-label={t(title)} data-testid={testId} disabled={disabled} onClick={()=>onChange(!checked)} className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked?'bg-primary':'bg-muted'}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full border border-border bg-background shadow-sm transition-transform ${checked?'translate-x-7':'translate-x-1'}`}/>
    </button>
  </div>;
}

function RouteLink({ href, title, detail, icon }: { href: string; title: string; detail: string; icon: ReactNode }) {
  const { t } = useAppLanguage();
  return <Link href={href} className="setting-row transition-colors hover:border-primary/25">
    <SettingIcon>{icon}</SettingIcon><span className="min-w-0 flex-1"><strong>{t(title)}</strong><small>{t(detail)}</small></span><ChevronRight size={18} className="text-muted-foreground"/>
  </Link>;
}

function ActionRow({ icon, title, detail, action, onClick }: { icon: ReactNode; title: string; detail: string; action: string; onClick: ()=>void }) {
  const { t } = useAppLanguage();
  return <button type="button" onClick={onClick} className="setting-row w-full text-left transition-colors hover:border-primary/25">
    <SettingIcon>{icon}</SettingIcon><span className="min-w-0 flex-1"><strong>{t(title)}</strong><small>{t(detail)}</small></span><span className="text-xs font-bold text-primary">{t(action)}</span>
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

function FollowRequestsPanel() {
  const requests = useGetFollowRequests({ query: { queryKey: getGetFollowRequestsQueryKey() } });
  const me = useGetMyProfile();
  const approve = useApproveFollowRequest();
  const decline = useDeclineFollowRequest();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  async function respond(requesterId: string, action: "approve" | "decline") {
    setError("");
    try {
      if (action === "approve") await approve.mutateAsync({ requesterId });
      else await decline.mutateAsync({ requesterId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetFollowRequestsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
        me.data?.id ? queryClient.invalidateQueries({ queryKey: getGetProfileFollowSummaryQueryKey(me.data.id) }) : Promise.resolve(),
      ]);
    } catch {
      setError("That follow request couldn’t be updated. Please try again.");
    }
  }
  return <section className="rounded-2xl border border-white/[.08] bg-card p-5" data-testid="follow-requests-panel">
    <p className="mb-4 text-sm text-muted-foreground">Review requests from people who want to follow your private account.</p>
    {requests.isLoading ? <SettingsSkeleton/> : requests.isError ? <InlineError text="Follow requests couldn’t load." onRetry={()=>void requests.refetch()}/> : requests.data?.length
      ? <div className="space-y-2">{requests.data.map((request: FollowRequest)=><div key={request.requesterId} className="flex items-center gap-3 rounded-xl border border-white/[.07] p-3">
        {request.photo ? <img src={request.photo} alt="" className="h-10 w-10 rounded-full object-cover"/> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">{request.displayName.slice(0,1).toUpperCase()}</span>}
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{request.displayName}</strong><small className="text-xs text-muted-foreground">Requested {new Date(request.createdAt).toLocaleDateString()}</small></span>
        <button type="button" disabled={approve.isPending||decline.isPending} onClick={()=>void respond(request.requesterId,"decline")} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-50">Decline</button>
        <button type="button" disabled={approve.isPending||decline.isPending} onClick={()=>void respond(request.requesterId,"approve")} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">Approve</button>
      </div>)}</div> : <p className="rounded-xl border border-white/[.06] px-4 py-3 text-sm text-muted-foreground">No pending follow requests.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </section>;
}

function DeactivateRow({ settings, pending, onSave }: { settings: FullSettings; pending: boolean; onSave: (patch: Partial<FullSettings>)=>Promise<boolean> }) {
  const active = settings.deactivated;
  async function toggle() {
    const verb = active ? "reactivate" : "deactivate";
    if (!window.confirm(active ? "Reactivate your VibeSwipes account? Your profile will be available again." : "Deactivate your VibeSwipes account? Your profile will be hidden until you reactivate.")) return;
    await onSave({ deactivated: !active });
  }
  return <section className="rounded-2xl border border-rose-300/15 bg-rose-300/[.035] p-5">
    <div className="flex items-start gap-4"><SettingIcon><UserX size={18}/></SettingIcon><div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Account status</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{active ? "Your account is deactivated and your profile is hidden." : "Take a break by hiding your profile. You can reactivate at any time."}</p>
      <button type="button" disabled={pending} onClick={()=>void toggle()} data-testid="button-toggle-deactivation" className="mt-4 rounded-xl border border-rose-300/25 px-4 py-2.5 text-sm font-bold text-rose-200 disabled:opacity-50">{active?"Reactivate account":"Deactivate account"}</button>
    </div></div>
  </section>;
}

function SettingsSkeleton() {
  return <div className="flex justify-center py-8" role="status" aria-label="Loading"><QuietSpinner /></div>;
}
function InlineError({ onRetry }: { text: string; onRetry: ()=>void }) {
  return <div className="flex justify-center py-8" role="status" aria-label="Loading"><QuietSpinner onRetry={onRetry} /></div>;
}
