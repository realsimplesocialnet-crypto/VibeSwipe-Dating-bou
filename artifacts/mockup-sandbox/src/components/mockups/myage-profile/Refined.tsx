import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clapperboard,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  ShieldAlert,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";

const portraitOne = "/__mockup/images/myage-profile-one.jpg";
const portraitTwo = "/__mockup/images/myage-profile-two.jpg";
const photos = [portraitOne, portraitTwo, portraitOne, portraitTwo, portraitOne, portraitTwo];

const facts = [
  { icon: Sparkles, label: "Age", value: "26" },
  { icon: BriefcaseBusiness, label: "Work", value: "Designer" },
  { icon: Heart, label: "Looking for", value: "A relationship" },
  { icon: UsersRound, label: "Gender", value: "Woman" },
];

export function Refined() {
  const [followState, setFollowState] = useState<"Follow" | "Follow back" | "Following">("Follow");
  const [datingState, setDatingState] = useState<"Like" | "Liked" | "Message">("Like");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="myage-profile">
      <style>{`
        .myage-profile {
          --bg: #171619;
          --surface: #222024;
          --surface-raised: #29262b;
          --line: rgba(246, 232, 238, .10);
          --ink: #f4edf0;
          --muted: #aaa0a7;
          --pink: #ed5b9b;
          --pink-soft: rgba(237, 91, 155, .12);
          min-height: 100dvh;
          background: var(--bg);
          color: var(--ink);
          font-family: "DM Sans", "Plus Jakarta Sans", system-ui, sans-serif;
          overflow: hidden;
        }
        .myage-profile * { box-sizing: border-box; }
        .myage-profile button { color: inherit; font: inherit; cursor: pointer; }
        .mp-shell { width: min(100%, 1180px); margin: 0 auto; padding: 20px 48px 72px; }
        .mp-topbar { height: 46px; display: flex; justify-content: space-between; align-items: center; }
        .mp-icon-button { display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid var(--line); border-radius: 50%; background: var(--surface); transition: transform .18s ease, background .18s ease; }
        .mp-icon-button:hover { background: var(--surface-raised); }
        .mp-icon-button:active { transform: scale(.94); }
        .mp-more-wrap { position: relative; z-index: 4; }
        .mp-menu { position: absolute; z-index: 5; top: 50px; right: 0; width: 206px; overflow: hidden; border: 1px solid var(--line); border-radius: 16px; background: #29262b; box-shadow: 0 18px 42px rgba(0,0,0,.34); animation: mp-in .16s ease-out; }
        .mp-menu button { display: flex; align-items: center; gap: 11px; width: 100%; padding: 14px 16px; border: 0; background: transparent; text-align: left; font-size: 13px; }
        .mp-menu button:hover { background: rgba(255,255,255,.05); }
        .mp-menu .mp-danger { color: #f18a9f; }
        .mp-layout { display: grid; grid-template-columns: minmax(310px, .92fr) minmax(420px, 1.08fr); gap: clamp(44px, 7vw, 100px); align-items: start; margin-top: 32px; }
        .mp-portrait-column { position: sticky; top: 24px; }
        .mp-cover { position: relative; overflow: hidden; aspect-ratio: .78; border: 1px solid rgba(255,255,255,.08); border-radius: 28px; background: var(--surface); box-shadow: 0 28px 76px rgba(0,0,0,.24); }
        .mp-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .mp-copy { min-width: 0; padding-top: 3px; }
        .mp-heading { margin: 0; font-family: "Manrope", "DM Sans", sans-serif; font-size: clamp(36px, 4.2vw, 54px); font-weight: 700; line-height: 1.08; letter-spacing: -.055em; }
        .mp-age { color: #bdb3b9; font-weight: 500; letter-spacing: -.04em; }
        .mp-verified { width: 21px; height: 21px; display: inline-grid; place-items: center; margin-left: 9px; color: var(--pink); vertical-align: 7px; }
        .mp-location { display: flex; align-items: center; gap: 8px; margin: 13px 0 0; color: var(--muted); font-size: 14px; }
        .mp-location svg { color: var(--pink); }
        .mp-social { display: flex; align-items: center; gap: 20px; padding: 25px 0 19px; margin-top: 25px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .mp-stat { min-width: 88px; display: flex; flex-direction: column; gap: 3px; }
        .mp-stat strong { font-family: "Manrope", sans-serif; font-size: 21px; letter-spacing: -.04em; }
        .mp-stat span { color: var(--muted); font-size: 11px; }
        .mp-stat-divider { width: 1px; height: 34px; background: var(--line); }
        .mp-actions { display: flex; gap: 10px; margin: 20px 0 29px; }
        .mp-action { height: 46px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--pink); border-radius: 999px; background: var(--pink); color: #21151b !important; font-size: 13px; font-weight: 800; transition: transform .18s ease, opacity .18s ease; }
        .mp-action:hover { opacity: .92; }
        .mp-action:active { transform: scale(.98); }
        .mp-action.secondary { background: transparent; color: var(--pink) !important; }
        .mp-action.secondary.is-active { background: var(--pink-soft); }
        .mp-section-label { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; color: #f3e9ee; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        .mp-section-label:after { height: 1px; flex: 1; content: ""; background: var(--line); }
        .mp-facts { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--line); border-radius: 20px; overflow: hidden; background: var(--surface); }
        .mp-fact { display: flex; gap: 11px; align-items: center; min-width: 0; padding: 15px 14px; }
        .mp-fact:nth-child(odd) { border-right: 1px solid var(--line); }
        .mp-fact:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
        .mp-fact-icon { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border-radius: 50%; background: var(--pink-soft); color: var(--pink); }
        .mp-fact-text { min-width: 0; }
        .mp-fact-text span { display: block; color: var(--muted); font-size: 10px; }
        .mp-fact-text strong { display: block; margin-top: 3px; font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
        .mp-about { margin-top: 29px; }
        .mp-bio { max-width: 560px; margin: 0; color: #e4dce1; font-size: 15px; line-height: 1.75; }
        .mp-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
        .mp-tag { padding: 8px 13px; border: 1px solid rgba(237,91,155,.2); border-radius: 999px; background: var(--pink-soft); color: #f2c5d8; font-size: 11px; font-weight: 700; }
        .mp-based { margin: 17px 0 0; color: var(--muted); font-size: 12px; }
        .mp-gallery { margin-top: 32px; }
        .mp-gallery-title { display: flex; align-items: baseline; justify-content: space-between; }
        .mp-count { color: var(--muted); font-size: 11px; }
        .mp-thumbs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; }
        .mp-thumb { aspect-ratio: .78; overflow: hidden; padding: 0; border: 1px solid var(--line); border-radius: 13px; background: var(--surface); }
        .mp-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .25s ease; }
        .mp-thumb:hover img { transform: scale(1.045); }
        .mp-reels { margin-top: 31px; padding-top: 22px; border-top: 1px solid var(--line); }
        .mp-reels-empty { display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 15px; border: 1px dashed rgba(255,255,255,.13); border-radius: 16px; color: var(--muted); font-size: 13px; }
        .mp-reels-empty svg { color: var(--pink); }
        .mp-notice { position: fixed; right: 22px; bottom: 22px; z-index: 9; display: flex; align-items: center; gap: 9px; max-width: calc(100vw - 32px); padding: 12px 15px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-raised); box-shadow: 0 12px 30px rgba(0,0,0,.3); color: var(--ink); font-size: 12px; animation: mp-in .18s ease-out; }
        .mp-notice button { display: grid; place-items: center; border: 0; background: transparent; color: var(--muted); }
        @keyframes mp-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 760px) {
          .mp-shell { padding: 12px 20px 48px; }
          .mp-topbar { height: 42px; }
          .mp-layout { display: flex; flex-direction: column; gap: 0; margin-top: 13px; }
          .mp-portrait-column { position: static; width: 100%; order: 0; }
          .mp-cover { display: block; width: 124px; height: 124px; aspect-ratio: 1; margin: 0 auto 21px; border: 3px solid var(--bg); border-radius: 50%; box-shadow: 0 0 0 1px rgba(237,91,155,.68), 0 12px 30px rgba(0,0,0,.24); }
          .mp-copy { width: 100%; order: 0; }
          .mp-profile-intro { text-align: center; }
          .mp-heading { font-size: clamp(31px, 9vw, 40px); }
          .mp-location { justify-content: center; margin-top: 10px; font-size: 13px; }
          .mp-social { justify-content: center; gap: 27px; margin-top: 21px; padding: 17px 0 14px; }
          .mp-stat { min-width: 78px; align-items: center; }
          .mp-stat strong { font-size: 19px; }
          .mp-stat span { font-size: 10px; }
          .mp-actions { gap: 9px; margin: 15px 0 25px; }
          .mp-action { height: 44px; }
          .mp-facts { grid-template-columns: 1fr; border-radius: 18px; }
          .mp-fact { padding: 11px 13px; }
          .mp-fact:nth-child(odd) { border-right: 0; }
          .mp-fact:not(:last-child) { border-bottom: 1px solid var(--line); }
          .mp-fact-icon { width: 32px; height: 32px; flex-basis: 32px; }
          .mp-fact-text { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: 1; }
          .mp-fact-text span, .mp-fact-text strong { font-size: 12px; }
          .mp-fact-text strong { text-align: right; }
          .mp-about { margin-top: 23px; padding: 17px 17px 16px; border: 1px solid var(--line); border-radius: 19px; background: var(--surface); }
          .mp-section-label { margin-bottom: 11px; font-size: 10px; }
          .mp-section-label:after { display: none; }
          .mp-bio { font-size: 14px; line-height: 1.65; }
          .mp-tags { margin-top: 14px; }
          .mp-tag { padding: 7px 11px; }
          .mp-based { margin-top: 14px; font-size: 11px; }
          .mp-gallery { margin-top: 25px; }
          .mp-thumbs { display: flex; gap: 9px; overflow-x: auto; margin: 0 -20px; padding: 0 20px 4px; scrollbar-width: none; }
          .mp-thumbs::-webkit-scrollbar { display: none; }
          .mp-thumb { width: 90px; height: 112px; flex: 0 0 90px; border-radius: 14px; }
          .mp-reels { margin-top: 25px; padding-top: 20px; }
          .mp-reels-empty { min-height: 58px; }
        }
        @media (max-width: 360px) {
          .mp-shell { padding-right: 16px; padding-left: 16px; }
          .mp-thumbs { margin-right: -16px; margin-left: -16px; padding-right: 16px; padding-left: 16px; }
          .mp-action { font-size: 12px; }
        }
      `}</style>

      <main className="mp-shell">
        <nav className="mp-topbar" aria-label="Profile navigation">
          <button className="mp-icon-button" type="button" aria-label="Back">
            <ArrowLeft size={19} />
          </button>
          <div className="mp-more-wrap">
            <button className="mp-icon-button" type="button" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              <MoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div className="mp-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <ShieldAlert size={16} /> Report profile
                </button>
                <button type="button" role="menuitem" className="mp-danger" onClick={() => setMenuOpen(false)}>
                  <X size={16} /> Block member
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="mp-layout">
          <aside className="mp-portrait-column" aria-label="Profile portrait">
            <div className="mp-cover">
              <img src={portraitOne} alt="Amara James" />
            </div>
          </aside>

          <article className="mp-copy">
            <header className="mp-profile-intro">
              <h1 className="mp-heading">Amara James<span className="mp-age">, 26</span><span className="mp-verified" aria-label="Verified"><BadgeCheck size={21} fill="currentColor" stroke="#171619" /></span></h1>
              <p className="mp-location"><MapPin size={15} /> Lagos, Nigeria</p>
            </header>

            <section className="mp-social" aria-label="Followers and following">
              <div className="mp-stat"><strong>1,250</strong><span>Followers</span></div>
              <span className="mp-stat-divider" />
              <div className="mp-stat"><strong>380</strong><span>Following</span></div>
            </section>

            <section className="mp-actions" aria-label="Connect with Amara">
              <button className="mp-action" type="button" onClick={() => setFollowState(followState === "Follow" ? "Follow back" : followState === "Follow back" ? "Following" : "Follow")}>
                {followState === "Follow" ? "Follow" : followState === "Follow back" ? "Follow back" : <><Check size={16} /> Following</>}
              </button>
              <button className={`mp-action secondary${datingState !== "Like" ? " is-active" : ""}`} type="button" onClick={() => setDatingState(datingState === "Like" ? "Liked" : datingState === "Liked" ? "Message" : "Like")}>
                {datingState === "Message" ? <MessageCircle size={16} /> : <Heart size={16} fill={datingState === "Liked" ? "currentColor" : "none"} />} {datingState}
              </button>
            </section>

            <section aria-label="Profile details">
              <h2 className="mp-section-label">Details</h2>
              <div className="mp-facts">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div className="mp-fact" key={label}>
                    <span className="mp-fact-icon"><Icon size={16} /></span>
                    <div className="mp-fact-text"><span>{label}</span><strong>{value}</strong></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mp-about" aria-label="About me">
              <h2 className="mp-section-label">About me</h2>
              <p className="mp-bio">I enjoy quiet weekends, good food, and meeting people who are kind and genuine.</p>
              <div className="mp-tags">
                <span className="mp-tag">Travel</span><span className="mp-tag">Reading</span><span className="mp-tag">Cooking</span>
              </div>
              <p className="mp-based">Based in Lagos, Lagos, Nigeria</p>
            </section>

            <section className="mp-gallery" aria-label="Photos">
              <div className="mp-gallery-title">
                <h2 className="mp-section-label">Photos</h2>
                <span className="mp-count">6 photos</span>
              </div>
              <div className="mp-thumbs">
                {photos.map((photo, index) => (
                  <button className="mp-thumb" type="button" key={`${photo}-${index}`} aria-label={`Photo ${index + 1} of 6`}>
                    <img src={photo} alt="" />
                  </button>
                ))}
              </div>
            </section>

            <section className="mp-reels" aria-label="Reels">
              <h2 className="mp-section-label"><Clapperboard size={14} /> Reels</h2>
              <div className="mp-reels-empty"><Clapperboard size={17} /><span>No reels yet.</span><ChevronRight size={15} style={{ marginLeft: "auto", opacity: .5 }} /></div>
            </section>
          </article>
        </div>
      </main>

    </div>
  );
}
