import { useState } from "react";
import {
  Bell,
  Bookmark,
  Briefcase,
  Camera,
  Check,
  Clapperboard,
  Copy,
  Heart,
  House,
  Pencil,
  Repeat2,
  Settings,
  Share2,
  Sparkles,
  UserRound,
} from "lucide-react";
import "./_group.css";

const imageOne = "/__mockup/images/myage-profile-one.jpg";
const imageTwo = "/__mockup/images/myage-profile-two.jpg";
const photos = [imageOne, imageTwo, imageOne, imageTwo, imageOne, imageTwo];

const mediaTabs = [
  { id: "reels", label: "Reels", Icon: Clapperboard },
  { id: "reposts", label: "Reposts", Icon: Repeat2 },
  { id: "saved", label: "Saved", Icon: Bookmark },
  { id: "liked", label: "Likes", Icon: Heart },
] as const;

type MediaTab = (typeof mediaTabs)[number]["id"];

export function Flat() {
  const [activeTab, setActiveTab] = useState<MediaTab>("reels");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  function announce(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function copyReferral() {
    try {
      await navigator.clipboard.writeText("4CIZB81D");
      setCopied(true);
      announce("Referral code copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      announce("Copy is unavailable in this preview");
    }
  }

  async function shareReferral() {
    const invite = "Join me on MYAGEBEAUTY with my referral code 4CIZB81D.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "MYAGEBEAUTY", text: invite });
      } else {
        await navigator.clipboard.writeText(invite);
        announce("Invite copied");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      announce("Sharing is unavailable in this preview");
    }
  }

  const tabPosts: Record<MediaTab, string[]> = {
    reels: [imageOne, imageTwo, imageOne, imageTwo, imageOne, imageTwo],
    reposts: [imageTwo, imageOne, imageTwo],
    saved: [imageOne, imageTwo, imageOne, imageTwo],
    liked: [imageTwo, imageOne, imageTwo, imageOne, imageTwo, imageOne],
  };

  return (
    <div className="myage-flat">
      <style>{`
        .myage-flat {
          --pink: #f34e9a;
          --pink-soft: #f8b8d5;
          --ink: #f7f1f4;
          --muted: #aaa1aa;
          --surface: #0f0f12;
          min-height: 100dvh;
          background: var(--surface);
          color: var(--ink);
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .myage-flat * { box-sizing: border-box; }
        .myage-flat button { color: inherit; font: inherit; }
        .mf-shell { width: min(100%, 760px); height: 100dvh; min-height: 0; margin: 0 auto; display: flex; flex-direction: column; overflow: hidden; }
        .mf-header { height: 58px; flex: 0 0 58px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
        .mf-header h1 { margin: 0; font-size: 17px; font-weight: 760; letter-spacing: -.045em; }
        .mf-header button, .mf-inline-action { display: inline-flex; align-items: center; gap: 8px; border: 0; background: transparent; color: #d7cbd3; padding: 8px 0; font-size: 12px; font-weight: 650; cursor: pointer; }
        .mf-header button:hover, .mf-inline-action:hover { color: var(--pink-soft); }
        .mf-main { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; padding: 4px 26px 34px; }
        .mf-main::-webkit-scrollbar { display: none; }
        .mf-content { width: 100%; max-width: 610px; margin: 0 auto; display: flex; flex-direction: column; gap: 26px; }
        .mf-identity { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 0 2px; }
        .mf-avatar { width: 92px; height: 92px; border-radius: 50%; padding: 3px; background: linear-gradient(145deg, #f8a9cc, #f34e9a 50%, #703548); margin-bottom: 12px; }
        .mf-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; border: 3px solid var(--surface); }
        .mf-name { margin: 0; font-size: clamp(24px, 6vw, 31px); line-height: 1.08; letter-spacing: -.055em; font-weight: 780; }
        .mf-place { margin: 7px 0 0; color: var(--muted); font-size: 13px; }
        .mf-stats { display: flex; align-items: center; justify-content: center; gap: 38px; margin-top: 19px; }
        .mf-stat { min-width: 64px; padding: 0; border: 0; background: transparent; text-align: center; cursor: pointer; }
        .mf-stat strong { display: block; font-size: 17px; line-height: 1.1; font-weight: 760; letter-spacing: -.03em; }
        .mf-stat span { display: block; margin-top: 4px; color: var(--muted); font-size: 11px; }
        .mf-edit { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: min(100%, 260px); height: 42px; margin-top: 19px; border: 0; border-radius: 999px; background: var(--pink); color: #26121c !important; font-size: 13px; font-weight: 760; cursor: pointer; transition: transform .18s ease, background .18s ease; }
        .mf-edit:hover { background: #ff70ae; transform: translateY(-1px); }
        .mf-referral { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 3px 0; }
        .mf-section-title { display: flex; align-items: center; gap: 9px; margin: 0; font-size: 11px; font-weight: 780; letter-spacing: .12em; text-transform: uppercase; color: #e8dfe5; }
        .mf-section-icon { display: inline-flex; width: 23px; height: 23px; align-items: center; justify-content: center; color: var(--pink); border-radius: 50%; background: #321d29; }
        .mf-referral-code { margin: 7px 0 0 32px; font-size: 14px; font-weight: 720; letter-spacing: .16em; }
        .mf-referral-meta { margin: 4px 0 0 32px; color: var(--muted); font-size: 11px; }
        .mf-referral-actions { display: flex; gap: 16px; flex: 0 0 auto; }
        .mf-referral-actions button { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--pink-soft); padding: 7px 0; font-size: 11px; font-weight: 720; cursor: pointer; }
        .mf-two { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .mf-copy { margin: 9px 0 0 32px; color: #ece4e9; font-size: 13px; line-height: 1.45; }
        .mf-hobbies { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0 32px; }
        .mf-hobby { border-radius: 999px; background: #321d29; color: #f5b5d2; padding: 6px 12px; font-size: 11px; font-weight: 650; }
        .mf-photo-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .mf-photo-count { color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: 0; }
        .mf-manage { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; background: #321d29; color: var(--pink-soft) !important; padding: 7px 11px; font-size: 11px; font-weight: 720; cursor: pointer; }
        .mf-photos { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; margin-top: 12px; }
        .mf-photo { aspect-ratio: 1; overflow: hidden; border-radius: 12px; background: #252127; }
        .mf-photo img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .35s ease; }
        .mf-photo:hover img { transform: scale(1.04); }
        .mf-media { margin-top: 3px; }
        .mf-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 11px; }
        .mf-tab { position: relative; display: grid; place-items: center; min-height: 42px; border: 0; background: transparent; color: #877e88; cursor: pointer; transition: color .18s ease; }
        .mf-tab:hover, .mf-tab.active { color: var(--pink); }
        .mf-tab.active::after { content: ""; position: absolute; bottom: -1px; left: 33%; right: 33%; height: 2px; border-radius: 2px; background: var(--pink); }
        .mf-tab span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
        .mf-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
        .mf-reel { position: relative; aspect-ratio: 3 / 4; overflow: hidden; background: #252127; }
        .mf-reel img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .35s ease, opacity .35s ease; }
        .mf-reel:hover img { transform: scale(1.04); opacity: .85; }
        .mf-reel-play { position: absolute; right: 9px; bottom: 9px; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: rgb(15 15 18 / .65); color: white; }
        .mf-bottom { position: relative; z-index: 2; display: flex; flex: 0 0 auto; justify-content: space-around; align-items: center; min-height: 62px; padding: 6px 7px max(6px, env(safe-area-inset-bottom)); background: rgb(15 15 18 / .96); backdrop-filter: blur(16px); }
        .mf-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 54px; border: 0; background: transparent; color: #89818a; font-size: 9px; cursor: pointer; }
        .mf-nav-item.active { color: var(--pink); }
        .mf-toast { position: fixed; z-index: 5; left: 50%; bottom: 78px; transform: translateX(-50%); padding: 10px 15px; border-radius: 999px; background: #f7edf2; color: #2b1722; font-size: 12px; font-weight: 700; box-shadow: 0 8px 25px rgb(0 0 0 / .24); white-space: nowrap; }
        @media (min-width: 700px) {
          .mf-shell { height: 100dvh; }
          .mf-header { padding-inline: 35px; }
          .mf-main { padding: 14px 36px 38px; }
          .mf-content { gap: 31px; }
          .mf-identity { padding-top: 5px; }
          .mf-avatar { width: 102px; height: 102px; }
          .mf-grid { gap: 5px; }
          .mf-bottom { width: 100%; margin: auto; }
        }
        @media (max-width: 420px) {
          .mf-header { padding-inline: 18px; height: 52px; flex-basis: 52px; }
          .mf-main { padding: 3px 18px 27px; }
          .mf-content { gap: 22px; }
          .mf-photos { gap: 6px; }
          .mf-photo { border-radius: 9px; }
          .mf-referral { gap: 8px; }
          .mf-referral-actions { gap: 10px; }
          .mf-referral-actions button { font-size: 10px; }
          .mf-two { gap: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .myage-flat *, .myage-flat *::before, .myage-flat *::after { transition-duration: .01ms !important; }
        }
      `}</style>
      <div className="mf-shell">
        <header className="mf-header">
          <h1>My Profile</h1>
          <button type="button" onClick={() => announce("Settings")}>
            <Settings size={16} strokeWidth={1.8} /> Settings
          </button>
        </header>

        <main className="mf-main">
          <div className="mf-content">
            <section className="mf-identity" aria-label="Profile identity">
              <div className="mf-avatar"><img src={imageOne} alt="Amara's profile" /></div>
              <h2 className="mf-name">Amara James, 26</h2>
              <p className="mf-place">Lagos, Nigeria · Woman</p>
              <div className="mf-stats" aria-label="Social activity">
                <button type="button" className="mf-stat" onClick={() => announce("128 followers")}>
                  <strong>128</strong><span>Followers</span>
                </button>
                <button type="button" className="mf-stat" onClick={() => announce("47 following")}>
                  <strong>47</strong><span>Following</span>
                </button>
              </div>
              <button type="button" className="mf-edit" onClick={() => announce("Edit profile")}>
                <Pencil size={15} /> Edit profile
              </button>
            </section>

            <section className="mf-referral" aria-label="Referral points">
              <div>
                <h3 className="mf-section-title"><span className="mf-section-icon"><Sparkles size={13} /></span>Referral points</h3>
                <p className="mf-referral-code">4CIZB81D</p>
                <p className="mf-referral-meta">0 points · 0 joined</p>
              </div>
              <div className="mf-referral-actions">
                <button type="button" onClick={() => void copyReferral()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}</button>
                <button type="button" onClick={() => void shareReferral()}><Share2 size={14} />Share</button>
              </div>
            </section>

            <div className="mf-two">
              <section>
                <h3 className="mf-section-title"><span className="mf-section-icon"><UserRound size={13} /></span>About</h3>
                <p className="mf-copy">Love you</p>
              </section>
              <section>
                <h3 className="mf-section-title"><span className="mf-section-icon"><Briefcase size={13} /></span>Work</h3>
                <p className="mf-copy">Prefer not to say</p>
              </section>
            </div>

            <section>
              <h3 className="mf-section-title"><span className="mf-section-icon"><Heart size={13} /></span>Hobbies</h3>
              <div className="mf-hobbies"><span className="mf-hobby">Music</span><span className="mf-hobby">Travel</span></div>
            </section>

            <section>
              <div className="mf-photo-heading">
                <h3 className="mf-section-title"><span className="mf-section-icon"><Camera size={13} /></span>Photos <span className="mf-photo-count">2/6</span></h3>
                <button type="button" className="mf-manage" onClick={() => announce("Manage photos")}><Camera size={12} />Manage</button>
              </div>
              <div className="mf-photos">
                {photos.map((src, index) => (
                  <div className="mf-photo" key={`${src}-${index}`}><img src={src} alt={`Profile photo ${index + 1}`} /></div>
                ))}
              </div>
            </section>

            <section className="mf-media" aria-label="Profile posts">
              <div className="mf-tabs" role="tablist" aria-label="Profile videos">
                {mediaTabs.map(({ id, label, Icon }) => (
                  <button key={id} type="button" role="tab" aria-label={label} aria-selected={activeTab === id}
                    className={`mf-tab${activeTab === id ? " active" : ""}`} onClick={() => setActiveTab(id)}>
                    <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="mf-grid" role="tabpanel" aria-label={`${mediaTabs.find((tab) => tab.id === activeTab)?.label} posts`}>
                {tabPosts[activeTab].map((src, index) => (
                  <div className="mf-reel" key={`${activeTab}-${index}`}>
                    <img src={src} alt="" />
                    {activeTab === "reels" && <span className="mf-reel-play"><Clapperboard size={12} /></span>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>

        <nav className="mf-bottom" aria-label="Main navigation">
          {[
            { label: "Discover", Icon: House },
            { label: "Reels", Icon: Clapperboard },
            { label: "Chats", Icon: Heart },
            { label: "Activity", Icon: Bell },
            { label: "Profile", Icon: UserRound, active: true },
          ].map(({ label, Icon, active }) => (
            <button type="button" className={`mf-nav-item${active ? " active" : ""}`} key={label} onClick={() => !active && announce(label)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      {notice && <div className="mf-toast" role="status">{notice}</div>}
    </div>
  );
}
