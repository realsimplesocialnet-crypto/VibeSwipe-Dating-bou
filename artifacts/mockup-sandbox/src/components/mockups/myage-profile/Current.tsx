import "./_group.css";
import { ArrowLeft, BriefcaseBusiness, Heart, MapPin, MoreHorizontal, Sparkles, Users } from "lucide-react";

const photos = [
  "/__mockup/images/myage-profile-one.jpg",
  "/__mockup/images/myage-profile-two.jpg",
  "/__mockup/images/myage-profile-one.jpg",
  "/__mockup/images/myage-profile-two.jpg",
  "/__mockup/images/myage-profile-one.jpg",
  "/__mockup/images/myage-profile-two.jpg",
];

export function Current() {
  const facts = [
    { icon: Sparkles, label: "Age", value: "26" },
    { icon: BriefcaseBusiness, label: "Work", value: "Designer" },
    { icon: Heart, label: "Looking for", value: "A relationship" },
    { icon: Users, label: "Gender", value: "Woman" },
  ];

  return (
    <div className="profile-extract public-profile min-h-[100dvh]">
      <main className="page-in mx-auto w-full max-w-md px-5 pb-12 pt-2">
        <div className="flex items-center justify-between">
          <button aria-label="Back" className="pp-round"><ArrowLeft size={20} /></button>
          <button aria-label="More actions" className="pp-round"><MoreHorizontal size={20} /></button>
        </div>

        <header className="mt-3 flex flex-col items-center text-center">
          <button aria-label="Open Amara's main photo" className="pp-avatar">
            <img src={photos[0]} alt="" className="h-full w-full rounded-full object-cover" />
          </button>
          <h1 className="mt-4 break-words text-[1.75rem] font-extrabold leading-tight tracking-[-.02em]">
            Amara James<span className="font-semibold text-[hsl(var(--pp-muted))]">, 26</span>
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-[hsl(var(--pp-muted))]"><MapPin size={15} className="shrink-0 text-[hsl(var(--pp-pink))]" />Lagos, Nigeria</p>
        </header>

        <section className="sh-profile-social" aria-label="Followers and actions">
          <div className="sh-profile-stats">
            <button className="sh-profile-stat"><strong>1,250</strong><span>Followers</span></button>
            <button className="sh-profile-stat"><strong>380</strong><span>Following</span></button>
          </div>
          <div className="sh-profile-actions">
            <button className="sh-follow-button">Follow</button>
            <div className="sh-dating-slot">
              <button className="sh-dating-button"><Heart size={17} />Like</button>
            </div>
          </div>
        </section>

        <section className="pp-card mt-7 divide-y divide-[hsl(var(--pp-line))] !py-1" aria-label="Profile details">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3.5 py-3">
              <span className="pp-icon"><Icon size={17} /></span>
              <span className="text-[13px] font-semibold text-[hsl(var(--pp-muted))]">{label}</span>
              <span className="ml-auto max-w-[60%] break-words text-right text-[15px] font-semibold">{value}</span>
            </div>
          ))}
        </section>

        <section className="pp-card mt-4">
          <h2 className="pp-label">About me</h2>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6">I enjoy quiet weekends, good food, and meeting people who are kind and genuine.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pp-pill">Travel</span><span className="pp-pill">Reading</span><span className="pp-pill">Cooking</span>
          </div>
          <p className="mt-4 text-[13px] text-[hsl(var(--pp-muted))]">Based in Lagos, Lagos, Nigeria</p>
        </section>

        <section className="mt-6" aria-label="Photos">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="pp-label">Photos</h2><span className="text-xs font-semibold text-[hsl(var(--pp-muted))]">6</span>
          </div>
          <div className="hide-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
            {photos.map((photo, index) => <button key={`${photo}-${index}`} aria-label={`Open photo ${index + 1} of 6`} className="pp-thumb"><img src={photo} alt="" className="h-full w-full object-cover" /></button>)}
          </div>
        </section>

        <section className="mt-6" aria-label="Reels">
          <div className="flex items-center justify-between px-1">
            <h2 className="pp-label flex items-center gap-2">Reels</h2>
          </div>
          <p className="mt-2 px-1 text-sm text-[hsl(var(--pp-muted))]">No reels yet.</p>
        </section>
      </main>
    </div>
  );
}
