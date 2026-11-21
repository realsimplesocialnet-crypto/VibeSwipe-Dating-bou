import { lazy, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  checkAdditionalProfilePhoto,
  getGetMyProfileQueryKey,
  useGetMyProfile,
  useGetVibeSwipeSettings,
  useRequestProfileMediaUpload,
  useSaveMyProfile,
  useTranscodeProfileVideo,
  type MediaUploadInputContentType,
  type Profile,
  type ProfileInput,
} from "@workspace/api-client-react";
import { ArrowLeft, MapPin, Mars, Navigation, NonBinary, Pencil, Settings, Venus, X } from "lucide-react";
import { Empty, MediaImage, ProfileLoading, Retry } from "@/App";
import { VerifiedBadge } from "@/components/verified-badge";
import { Link, Redirect, useLocation } from "@/lib/router-compat";
import { isProfileMissing, shouldRetryProfile } from "@/lib/profile-query-state";
import { PROFILE_PHOTO_ACCEPT, prepareProfilePhoto, uploadProfilePhotoBytes, validatePhotoFile } from "@/lib/profile-photo-upload";
import { userErrorMessage } from "@/lib/user-errors";
import { useAppLanguage } from "@/lib/app-language";

const ProfileSocialActions = lazy(() => import("@/components/social-hub").then((module) => ({ default: module.ProfileSocialActions })));
const ReferralProfileCard = lazy(() => import("@/components/referrals/referral-profile-card").then((module) => ({ default: module.ReferralProfileCard })));
const ProfileReelsSection = lazy(() => import("@/components/profile-reels-section").then((module) => ({ default: module.ProfileReelsSection })));
const HobbyMultiSelect = lazy(() => import("@/components/profile-field-selectors").then((module) => ({ default: module.HobbyMultiSelect })));
const OccupationSelect = lazy(() => import("@/components/profile-field-selectors").then((module) => ({ default: module.OccupationSelect })));

const emptyProfile: ProfileInput = {
  name: "",
  age: 18,
  gender: "",
  lookingFor: "Everyone",
  bio: "",
  city: "",
  country: null,
  state: null,
  interests: [],
  occupation: "Prefer not to say",
  occupationOther: "",
  photos: [],
  videoUrl: null,
  preferences: { ageMin: 22, ageMax: 35, gender: "Everyone", distanceKm: 50 },
};

function ProfileEditFrame({ children }: { children: ReactNode }) {
  return <div className="profile-edit -mb-24 min-h-[100dvh] lg:mb-0"><div className="page-in mx-auto max-w-[560px] px-4 pt-[calc(1rem+env(safe-area-inset-top))]">{children}</div></div>;
}

function OwnProfileFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    const element = document.documentElement;
    element.classList.add("op-lock");
    return () => element.classList.remove("op-lock");
  }, []);
  return <div className="own-profile op-fit -mb-24 lg:mb-0"><div className="page-in mx-auto flex h-full max-w-[560px] flex-col px-4 pt-3 md:pt-6">{children}</div></div>;
}

function genderIcon(gender: string) {
  const value = gender.toLowerCase();
  if (/^(man|male|men)\b/.test(value)) return Mars;
  if (/^(woman|female|women)\b/.test(value)) return Venus;
  return NonBinary;
}

function OwnProfileOverview({ profile, travelCity }: { profile: Profile; travelCity?: string | null }) {
  const { t } = useAppLanguage();
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [profile.photos?.[0]]);
  const GenderIcon = genderIcon(profile.gender || "");
  const place = [...new Set([profile.city, profile.state, profile.country].map((part) => part?.trim()).filter(Boolean))].join(", ");
  const work = profile.occupation === "Other" ? profile.occupationOther || "Other" : profile.occupation || "Prefer not to say";
  const bio = profile.bio || "Add a bio so people can get to know you.";
  const shown = profile.interests.slice(0, 5);
  const more = profile.interests.length - shown.length;

  return <div data-testid="section-own-profile" className="op-overview flex min-h-0 flex-1 flex-col gap-[clamp(6px,1.4dvh,14px)] pb-[clamp(8px,1.6dvh,16px)]">
    <div className="op-toolbar grid shrink-0 grid-cols-[40px_1fr_40px] items-center">
      <Link href="/discover" data-testid="link-profile-back" aria-label="Back to Discover" title="Back to Discover" className="op-toolbar-action inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95"><ArrowLeft size={20} aria-hidden="true" /></Link>
      <h2 data-testid="text-my-profile-heading" className="op-title text-center">{t("My Profile")}</h2>
      <Link href="/settings?returnTo=%2Fprofile" data-testid="link-profile-settings" aria-label="Settings" title="Settings" className="op-toolbar-action inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-full transition-transform active:scale-95"><Settings size={18} aria-hidden="true" /></Link>
    </div>
    <section className="op-card op-identity op-identity-modern flex shrink-0 flex-col text-left">
      <div className="op-hero-photo relative aspect-[16/7.5] w-full overflow-hidden rounded-[18px]" data-testid="profile-main-photo">
        {profile.photos?.[0] && !broken
          ? <MediaImage reference={profile.photos[0]} onError={() => setBroken(true)} loading="eager" fetchPriority="high" className="h-full w-full object-cover" alt={`${profile.name}'s main profile photo`} />
          : <div className="flex h-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,#392331,#17131a)] text-primary"><span className="text-5xl font-bold">{profile.name?.slice(0, 1)?.toUpperCase()}</span><span className="text-xs font-semibold text-white/70">{t("Add a main photo")}</span></div>}
      </div>
      <div className="op-person-details mt-2 text-left">
        <h1 data-testid="text-profile-name" title={profile.name} className="brand max-w-full truncate text-[clamp(26px,7vw,38px)] font-extrabold leading-[1.08] tracking-[-.04em]">{profile.name}{profile.age !== null ? `, ${profile.age}` : ""}<VerifiedBadge verified={profile.isVerified} /></h1>
        {(place || profile.gender || travelCity) && <div className="op-profile-meta mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px]">
          {place && <span data-testid="text-profile-city" title={place} className="op-muted inline-flex max-w-full items-center gap-1.5 truncate"><MapPin size={16} className="shrink-0 text-primary" aria-hidden="true" />{place}</span>}
          {profile.gender && <span data-testid="text-profile-gender" className="op-muted inline-flex items-center gap-1.5">{place && <span aria-hidden="true" className="op-meta-separator">|</span>}<GenderIcon size={16} className="text-primary" aria-hidden="true" />{profile.gender}</span>}
          {travelCity && <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary" data-testid="badge-travel" title={`Traveling in ${travelCity}`}><Navigation size={12} />Traveling in {travelCity}</span>}
        </div>}
      </div>
      <ProfileSocialActions profileId={profile.id} viewerId={profile.id} showAction={false} compact />
      <Link href="/profile/edit?returnTo=%2Fprofile" data-testid="button-edit-profile" aria-label={t("Edit profile")} title={t("Edit profile")} className="op-edit inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><Pencil size={18} aria-hidden="true" /></Link>
    </section>
    <div className="op-rule shrink-0" aria-hidden="true" />
    <section className="op-section min-w-0 shrink-0"><h3 className="op-label">{t("About me")}</h3><p data-testid="text-profile-bio" title={bio} className="mt-1.5 line-clamp-3 text-[14px] leading-[1.5]">{bio}</p></section>
    <section className="op-section shrink-0"><h3 className="op-label">{t("Hobbies")}</h3>{profile.interests.length ? <div className="mt-2 flex flex-wrap gap-2" title={profile.interests.join(", ")} aria-label={`${t("Hobbies")}: ${profile.interests.join(", ")}`}>{shown.map((interest) => <span key={interest} className="op-chip max-w-[46%] truncate rounded-full px-3.5 py-1.5 text-[13px] font-semibold">{interest}</span>)}{more > 0 && <Link href="/profile/edit?returnTo=%2Fprofile" data-testid="link-more-hobbies" className="op-chip rounded-full px-3.5 py-1.5 text-[13px] font-bold">+{more}</Link>}</div> : <p className="op-muted mt-1.5 text-[13px]">{t("Add a few hobbies to your profile.")}</p>}</section>
    <section className="op-section shrink-0"><h3 className="op-label">{t("Work")}</h3><span data-testid="text-profile-occupation" title={work} className="op-chip mt-2 inline-flex max-w-full truncate rounded-full px-3.5 py-1.5 text-[13px] font-semibold">{work}</span></section>
    <section className="op-section shrink-0"><h3 className="op-label">{t("Photos")}</h3>
       {profile.photos.length ? <div className="mt-2 grid grid-cols-5 gap-2" data-testid="profile-photo-strip" aria-label={`${t("Profile photos")}, ${profile.photos.length} ${t("total")}`}>{profile.photos.slice(0, 5).map((photo, index) => <div key={`${photo}-${index}`} className="op-thumb relative aspect-square overflow-hidden rounded-xl"><MediaImage reference={photo} alt={`${t("Profile photo")} ${index + 1}${index === 0 ? ` (${t("main")})` : ""}`} className="h-full w-full object-cover" />{index === 0 && <span className="absolute inset-x-0 bottom-0 bg-[#F34E9A] text-center text-[9px] font-bold leading-[14px] text-[#24111b]">{t("Main")}</span>}</div>)}</div> : <p className="op-muted mt-1.5 text-[13px]">{t("Add photos in Edit profile.")}</p>}
    </section>
    <ProfileReelsSection profileId={profile.id} returnTo="/profile" own />
    <ReferralProfileCard />
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-xs font-semibold text-muted-foreground">{label}{children}</label>;
}

export function ProfilePage({ mode = "view", returnTo = "/profile" }: { mode?: "view" | "edit"; returnTo?: string }) {
  const { t } = useAppLanguage();
  const query = useGetMyProfile<Profile>({ query: { refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 0, retry: shouldRetryProfile } });
  const settings = useGetVibeSwipeSettings();
  const edit = mode === "edit";
  const [, setLocation] = useLocation();
  const [saveError, setSaveError] = useState("");
  const save = useSaveMyProfile();
  const requestUpload = useRequestProfileMediaUpload();
  const transcode = useTranscodeProfileVideo();
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileInput>(emptyProfile);
  const [formReady, setFormReady] = useState(false);
  const mediaInput = useRef<HTMLInputElement>(null);
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const photoPreviewUrls = useRef(new Map<string, string>());

  useEffect(() => () => {
    for (const url of photoPreviewUrls.current.values()) URL.revokeObjectURL(url);
    photoPreviewUrls.current.clear();
  }, []);
  useEffect(() => {
    if (query.data && !formReady) {
      setForm({ ...emptyProfile, ...query.data, age: query.data.age ?? 18, preferences: { ...emptyProfile.preferences, ...query.data.preferences }, interests: query.data.interests ?? [], photos: query.data.photos ?? [] });
      setFormReady(true);
    }
  }, [query.data, formReady]);

  const change = (key: keyof ProfileInput, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  function removeProfilePhoto(index: number) {
    const reference = form.photos[index];
    const preview = photoPreviewUrls.current.get(reference);
    if (preview) {
      URL.revokeObjectURL(preview);
      photoPreviewUrls.current.delete(reference);
      setPhotoPreviews((current) => {
        const next = { ...current };
        delete next[reference];
        return next;
      });
    }
    change("photos", form.photos.filter((_, photoIndex) => photoIndex !== index));
  }
  async function uploadProfileMedia(file?: File) {
    if (!file || uploading) return;
    const video = file.type.startsWith("video/");
    setUploading(true);
    setSaveError("");
    try {
      if (!video) validatePhotoFile(file);
      const prepared = video ? file : await prepareProfilePhoto(file);
      const contentType: MediaUploadInputContentType = video ? file.type === "video/quicktime" ? "video/quicktime" : "video/mp4" : "image/jpeg";
      const result = await requestUpload.mutateAsync({ data: { name: prepared.name, size: prepared.size, contentType, mediaType: video ? "video" : "image" } });
      if (video) {
        const uploaded = await fetch(result.uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: prepared });
        if (!uploaded.ok) throw { status: uploaded.status };
        const done = await transcode.mutateAsync({ mediaId: result.mediaId });
        change("videoUrl", done.mediaReference);
      } else {
        await uploadProfilePhotoBytes(result.uploadURL, prepared);
        const checked = await checkAdditionalProfilePhoto(result.mediaId);
        const preview = URL.createObjectURL(prepared);
        photoPreviewUrls.current.set(checked.mediaReference, preview);
        setPhotoPreviews((current) => ({ ...current, [checked.mediaReference]: preview }));
        setForm((current) => ({ ...current, photos: [...current.photos, checked.mediaReference].slice(0, 6) }));
      }
    } catch (error) {
      setSaveError(userErrorMessage(error, "Your picture could not be uploaded. Choose the photo again to retry."));
    } finally {
      setUploading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    if (!form.photos.length) {
      setSaveError("Keep at least one profile photo. Add a photo before saving.");
      return;
    }
    try {
      const updated = await save.mutateAsync({ data: form });
      queryClient.setQueryData(getGetMyProfileQueryKey(), updated);
      void queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      setLocation(returnTo);
    } catch (error) {
      setSaveError(userErrorMessage(error, "Your changes haven’t saved yet. Check your details and try again."));
    }
  }

  if (query.isError && isProfileMissing(query.error)) return <Redirect to="/onboarding" />;
  const heading = edit ? <div className="pe-head"><Link href={returnTo} data-testid="link-edit-profile-back" aria-label={returnTo.startsWith("/settings") ? `${t("Back to")} ${t("Settings")}` : `${t("Back to")} ${t("Profile")}`} className="pe-round"><ArrowLeft size={19} /></Link><h1 className="pe-title">{t("Edit Profile")}</h1><span className="w-10" aria-hidden="true" /></div> : null;
  const Frame = edit ? ProfileEditFrame : OwnProfileFrame;

  return <Frame>{heading}{query.isLoading || edit && !formReady ? <ProfileLoading /> : query.isError && !query.data ? <Retry text={query.error?.status === 401 ? "Your session has expired. Please sign in again." : "We couldn’t load your profile. Check your connection and try again."} onRetry={() => void query.refetch()} /> : !query.data ? <Empty title="Your profile is waiting" detail="Finish a few details to begin discovering people." action={<Link href="/onboarding" data-testid="link-profile-onboarding" className="rounded-xl bg-primary px-4 py-3 font-bold text-[#26111b]">Set up profile</Link>} /> : <>{!edit && <OwnProfileOverview profile={query.data} travelCity={settings.data?.travelMode ? settings.data.travelCity : null} />}
    {edit && <form onSubmit={(event) => void submit(event)} className="pb-[calc(7rem+env(safe-area-inset-bottom))]" data-testid="form-edit-profile">
      <section className="pe-card" data-testid="section-edit-photos"><div className="flex items-baseline justify-between"><h2 className="pe-label">Photos</h2><span className="text-sm font-bold text-[hsl(var(--pe-pink))]" data-testid="text-photo-count">{form.photos.length}/6</span></div>
        <div className="mt-4 grid grid-cols-3 gap-3">{Array.from({ length: 6 }, (_, index) => {
          const photo = form.photos[index];
          return photo ? <div key={`${photo}-${index}`} className="pe-slot relative overflow-hidden"><MediaImage reference={photo} fallbackSrc={photoPreviews[photo]} alt={`Profile photo ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <span className="pe-main">Main photo</span>}<button type="button" onClick={() => removeProfilePhoto(index)} aria-label={`Remove profile photo ${index + 1}`} data-testid={`button-remove-profile-photo-${index}`} className="pe-x"><X size={14} strokeWidth={2.6} /></button></div> : <button key={`empty-${index}`} type="button" disabled={uploading || form.photos.length >= 6} onClick={() => mediaInput.current?.click()} aria-label="Add a photo" data-testid={`button-add-profile-photo-slot-${index}`} className="pe-slot pe-empty">{uploading && index === form.photos.length ? <span className="text-[11px] font-semibold text-[hsl(var(--pe-muted))]">Uploading…</span> : <span className="pe-plus"><span className="sr-only">Add</span>+</span>}</button>;
        })}</div>
        <p className="mt-4 text-center text-[13px] text-[hsl(var(--pe-muted))]">{form.photos.length === 0 ? "Add at least one photo before saving." : "Add up to 6 photos to show your vibe."} New photos are kept after you tap Save profile.</p>
        <input ref={mediaInput} data-testid="input-profile-media" type="file" accept={`${PROFILE_PHOTO_ACCEPT},video/mp4,video/quicktime`} className="sr-only" tabIndex={-1} disabled={uploading} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file && !file.type.startsWith("video/") && form.photos.length >= 6) { setSaveError("You can add up to 6 photos. Remove one to add another."); return; } void uploadProfileMedia(file); }} />
        <button type="button" disabled={uploading} onClick={() => mediaInput.current?.click()} data-testid="button-add-profile-video" className="mt-3 w-full rounded-xl border border-dashed border-[hsl(var(--pe-pink)/.45)] py-2.5 text-[13px] font-semibold text-[hsl(var(--pe-pink))] disabled:opacity-50">{form.videoUrl ? "Profile video ready · replace media" : "Add photo or profile video"}</button>
      </section>
      <section className="pe-card mt-4"><h2 className="pe-label mb-4">About you</h2><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input data-testid="input-profile-name" required maxLength={60} value={form.name} onChange={(event) => change("name", event.target.value)} className="field" /></Field>
        <Field label="Age (18+)"><input data-testid="input-profile-age" required type="number" min="18" max="120" value={form.age} onChange={(event) => change("age", Number(event.target.value))} className="field" /></Field>
        <Field label="Gender"><input data-testid="input-profile-gender" value={form.gender} onChange={(event) => change("gender", event.target.value)} className="field" /></Field>
        <Field label="Looking for"><input data-testid="input-profile-looking" value={form.lookingFor} onChange={(event) => change("lookingFor", event.target.value)} className="field" /></Field>
        <Field label="City"><input data-testid="input-profile-city" value={form.city} onChange={(event) => change("city", event.target.value)} className="field" /></Field>
        <Field label="Bio"><textarea data-testid="input-profile-bio" maxLength={500} rows={4} value={form.bio} onChange={(event) => change("bio", event.target.value)} className="field" /></Field>
        <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold text-muted-foreground">Hobbies</p><HobbyMultiSelect value={form.interests} onChange={(value) => change("interests", value)} testIdPrefix="profile-edit" /></div>
        <div className="sm:col-span-2"><OccupationSelect value={form.occupation || "Prefer not to say"} otherValue={form.occupationOther || ""} onChange={(value) => change("occupation", value)} onOtherChange={(value) => change("occupationOther", value)} testIdPrefix="profile-edit" /></div>
      </div></section>
      <div className="pe-savebar">{saveError && <p role="alert" data-testid="error-edit-profile" className="pe-error">{saveError}</p>}<button disabled={save.isPending || uploading} data-testid="button-save-profile" className="pe-save">{save.isPending ? "Saving…" : uploading ? "Uploading…" : "Save profile"}</button></div>
    </form>}</>}</Frame>;
}
