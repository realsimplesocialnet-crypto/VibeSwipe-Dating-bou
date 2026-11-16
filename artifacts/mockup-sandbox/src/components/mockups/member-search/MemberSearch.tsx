import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Compass,
  Heart,
  MapPin,
  MessageCircle,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Video,
  X,
} from "lucide-react";

const samplePhoto = "/__mockup/images/vibeswipe-discover-sample.png";

type Member = {
  name: string;
  age: number;
  city: string;
  distance: string;
  verified: boolean;
  online?: boolean;
  photoPosition: string;
  photo: string;
  note: string;
};

const members: Member[] = [
  {
    name: "Mira",
    age: 28,
    city: "Brooklyn, New York",
    distance: "4 miles away",
    verified: true,
    online: true,
    photoPosition: "50% 28%",
    photo: samplePhoto,
    note: "Here for good conversation, little bookstores, and long walks by the water.",
  },
  {
    name: "Amira",
    age: 27,
    city: "Queens, New York",
    distance: "7 miles away",
    verified: true,
    photoPosition: "38% 38%",
    photo: "/__mockup/images/member-search-amira.jpg",
    note: "Weekend gallery wanderer. Always making a playlist for the next trip.",
  },
  {
    name: "Mirabel",
    age: 30,
    city: "Jersey City, New Jersey",
    distance: "9 miles away",
    verified: false,
    photoPosition: "62% 32%",
    photo: "/__mockup/images/member-search-mirabel.jpg",
    note: "Into shared plates, live music, and making ordinary days feel special.",
  },
  {
    name: "Mira L.",
    age: 26,
    city: "Manhattan, New York",
    distance: "11 miles away",
    verified: true,
    photoPosition: "52% 48%",
    photo: "/__mockup/images/member-search-mira-l.jpg",
    note: "Soft spot for Sunday markets and people who are kind to the waitstaff.",
  },
];

const styleText = `
.ms-screen{--ms-bg:#1b1420;--ms-panel:#261d2a;--ms-panel-soft:#302433;--ms-ink:#fff8f8;--ms-muted:#b8aab8;--ms-pink:#f27598;--ms-pink-soft:#422631;--ms-stroke:rgba(255,236,245,.09);min-height:100dvh;width:100%;position:relative;overflow:hidden;background:radial-gradient(ellipse at 78% 0%,rgba(120,66,83,.22),transparent 36%),linear-gradient(150deg,#211722 0%,#1b1420 58%,#211720 100%);color:var(--ms-ink);font-family:'DM Sans',ui-sans-serif,system-ui,sans-serif}
.ms-screen *{box-sizing:border-box}
.ms-screen button,.ms-screen input{font:inherit}
.ms-shell{width:100%;max-width:1120px;min-height:100dvh;margin:0 auto;padding:34px 34px 46px}
.ms-topbar{display:flex;align-items:center;gap:18px;margin-bottom:38px}
.ms-back{display:flex;align-items:center;gap:9px;border:0;background:transparent;color:#e6d8e2;padding:9px 10px 9px 0;font-size:13px;font-weight:650;cursor:pointer}
.ms-back:hover{color:white}
.ms-topbar-mark{height:26px;width:1px;background:rgba(255,236,245,.13)}
.ms-kicker{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#c5aebc;font-weight:700}
.ms-title{font-family:'Manrope',ui-sans-serif,sans-serif;font-size:25px;letter-spacing:-.045em;font-weight:750;margin:2px 0 0}
.ms-desktop-grid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:34px;align-items:start}
.ms-main{min-width:0}
.ms-intro{margin-bottom:25px}
.ms-intro h1{font-family:'Manrope',ui-sans-serif,sans-serif;font-size:36px;line-height:1.1;letter-spacing:-.055em;margin:0;font-weight:750}
.ms-intro h1 em{font-style:normal;color:#f48ba6}
.ms-intro p{max-width:530px;margin:10px 0 0;color:#c2b4c1;font-size:14px;line-height:1.55}
.ms-search-wrap{position:relative;margin-bottom:16px}
.ms-search{display:flex;align-items:center;gap:12px;padding:0 16px;height:58px;border-radius:18px;background:#2b222f;border:1px solid rgba(255,225,238,.1);box-shadow:0 14px 34px rgba(6,3,8,.13);transition:border-color .18s}
.ms-search:focus-within{border-color:rgba(242,117,152,.7)}
.ms-search-icon{color:#d592a9;flex:none}
.ms-search input{width:100%;min-width:0;background:transparent;border:0;outline:none;color:var(--ms-ink);font-size:15px}
.ms-search input::placeholder{color:#a99aa8}
.ms-clear{width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(255,255,255,.07);color:#ded0db;cursor:pointer}
.ms-matching{display:flex;align-items:center;gap:8px;color:#c4b3c0;font-size:12px;padding:0 4px}
.ms-matching svg{color:#ee8ba7}
.ms-results-head{display:flex;align-items:center;justify-content:space-between;margin:23px 2px 12px}
.ms-results-head h2{margin:0;font-size:14px;font-weight:700;letter-spacing:-.01em}
.ms-count{font-size:11px;color:#b6a6b4}
.ms-results{display:grid;gap:10px}
.ms-result{display:flex;align-items:center;gap:16px;width:100%;min-height:104px;padding:12px 16px;text-align:left;border:1px solid rgba(255,236,245,.06);border-radius:20px;background:rgba(44,34,47,.84);color:var(--ms-ink);cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}
.ms-result:hover{transform:translateY(-2px);border-color:rgba(242,117,152,.32);background:#302434}
.ms-result:focus-visible,.ms-back:focus-visible,.ms-clear:focus-visible,.ms-close:focus-visible{outline:2px solid #f48ba6;outline-offset:3px}
.ms-photo-wrap{height:76px;width:68px;flex:none;position:relative;border-radius:15px;overflow:hidden;background:#513143}
.ms-photo{height:100%;width:100%;display:block;object-fit:cover;filter:saturate(.82)}
.ms-online{position:absolute;right:5px;bottom:5px;width:10px;height:10px;border-radius:50%;background:#7bd4a9;border:2px solid #332636;box-shadow:0 0 0 1px rgba(255,255,255,.35)}
.ms-result-copy{min-width:0;flex:1}
.ms-name-line{display:flex;align-items:center;gap:6px;min-width:0}
.ms-name{font-size:16px;font-weight:750;letter-spacing:-.025em;white-space:nowrap}
.ms-verified{color:#63b9ef;display:inline-flex;align-items:center}
.ms-location{display:flex;align-items:center;gap:5px;margin-top:5px;color:#cabdc8;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ms-location svg{color:#d992a8;flex:none}
.ms-online-label{margin-top:6px;color:#a8cdb9;font-size:10px;letter-spacing:.01em}
.ms-chevron{color:#897b8a;flex:none}
.ms-prototype{display:flex;gap:9px;align-items:flex-start;margin-top:18px;padding:13px 15px;border-radius:15px;background:rgba(65,43,57,.62);color:#d4c4ce;font-size:11px;line-height:1.5}
.ms-prototype svg{flex:none;color:#f08ba7;margin-top:1px}
.ms-side{position:sticky;top:30px;padding:22px;border-radius:23px;background:linear-gradient(155deg,rgba(54,39,55,.92),rgba(38,29,42,.92));box-shadow:0 20px 50px rgba(6,3,8,.12)}
.ms-side-icon{height:38px;width:38px;display:grid;place-items:center;border-radius:13px;background:#422a38;color:#f18aa6;margin-bottom:16px}
.ms-side h2{font-family:'Manrope',ui-sans-serif,sans-serif;font-size:18px;line-height:1.25;letter-spacing:-.03em;margin:0;font-weight:750}
.ms-side p{font-size:12px;line-height:1.65;color:#c4b4c2;margin:10px 0 0}
.ms-privacy-list{display:grid;gap:11px;margin-top:17px}
.ms-privacy-item{display:flex;align-items:flex-start;gap:9px;color:#e2d6df;font-size:11px;line-height:1.45}
.ms-privacy-item svg{flex:none;color:#a7d6bf;margin-top:1px}
.ms-match-note{margin-top:20px;padding:12px 13px;border-radius:14px;background:rgba(25,18,29,.45);color:#c7b7c5;font-size:11px;line-height:1.5}
.ms-match-note strong{color:#f8d9e3;font-weight:700}
.ms-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:40px 18px 36px;border-radius:21px;background:rgba(44,34,47,.65)}
.ms-empty-mark{height:52px;width:52px;display:grid;place-items:center;border-radius:18px;background:#422a38;color:#f28da8;margin-bottom:15px}
.ms-empty h3{font-family:'Manrope',sans-serif;font-size:19px;letter-spacing:-.03em;margin:0}
.ms-empty p{max-width:330px;color:#bdadbb;font-size:13px;line-height:1.55;margin:8px 0 0}
.ms-empty button{margin-top:16px;border:0;border-radius:999px;background:#ef819e;color:#291723;font-size:12px;font-weight:750;padding:10px 16px;cursor:pointer}
.ms-mobile-nav{display:none}
.ms-preview-scrim{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(12,8,15,.72);backdrop-filter:blur(8px);padding:20px}
.ms-preview{position:relative;width:min(100%,420px);max-height:min(88dvh,720px);overflow:auto;border-radius:27px;background:#2a202e;box-shadow:0 30px 100px rgba(0,0,0,.45);animation:ms-enter .2s ease-out}
.ms-preview-photo{height:260px;position:relative;overflow:hidden;background:#58364b}
.ms-preview-photo img{width:100%;height:100%;object-fit:cover;object-position:50% 30%}
.ms-preview-photo:after{content:"";position:absolute;inset:45% 0 0;background:linear-gradient(transparent,rgba(25,17,27,.82))}
.ms-close{position:absolute;top:14px;right:14px;z-index:2;height:38px;width:38px;border:1px solid rgba(255,255,255,.2);border-radius:50%;display:grid;place-items:center;color:white;background:rgba(28,20,31,.56);cursor:pointer}
.ms-preview-title{position:absolute;z-index:1;left:22px;bottom:18px;display:flex;align-items:center;gap:7px;font-family:'Manrope',sans-serif;font-size:28px;letter-spacing:-.04em;font-weight:800}
.ms-preview-body{padding:20px 22px 24px}
.ms-preview-location{display:flex;align-items:center;gap:7px;color:#d6c6d1;font-size:13px}
.ms-preview-note{font-size:14px;line-height:1.6;color:#f2e6ed;margin:16px 0 0}
.ms-preview-match{margin-top:19px;border-radius:15px;padding:13px 14px;background:#392834;color:#e3cbd7;font-size:12px;line-height:1.5}
.ms-preview-match strong{color:#f39ab0}
.ms-preview-foot{display:flex;align-items:center;gap:7px;color:#a99aa8;font-size:10px;margin-top:13px}
@keyframes ms-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:760px){
 .ms-screen{min-height:100dvh;background:radial-gradient(ellipse at 95% 0%,rgba(132,65,88,.19),transparent 32%),linear-gradient(155deg,#201722,#1b1420 60%,#201720);overflow:visible}
 .ms-shell{padding:calc(20px + env(safe-area-inset-top,0px)) 18px calc(100px + env(safe-area-inset-bottom,0px));min-height:100dvh}
 .ms-topbar{gap:12px;margin-bottom:26px}
 .ms-topbar-mark{display:none}
 .ms-title{font-size:20px}
 .ms-back{width:38px;height:38px;justify-content:center;padding:0;border-radius:13px;background:rgba(255,255,255,.055);font-size:0}
 .ms-back span{display:none}
 .ms-back svg{width:19px}
 .ms-kicker{font-size:9px}
 .ms-desktop-grid{display:block}
 .ms-intro{margin-bottom:20px}
 .ms-intro h1{font-size:30px;line-height:1.13}
 .ms-intro p{font-size:13px;line-height:1.5;margin-top:8px}
 .ms-search{height:54px;border-radius:17px;padding-inline:14px}
 .ms-results-head{margin-top:21px;margin-bottom:11px}
 .ms-results{gap:9px}
 .ms-result{min-height:88px;gap:12px;padding:10px 12px;border-radius:17px}
 .ms-photo-wrap{height:64px;width:58px;border-radius:13px}
 .ms-name{font-size:15px}
 .ms-location{font-size:11px;margin-top:4px}
 .ms-online-label{font-size:9px;margin-top:4px}
 .ms-prototype{font-size:10px;margin-top:15px;padding:11px 12px}
 .ms-side{display:none}
 .ms-mobile-nav{position:fixed;display:flex;z-index:20;left:0;right:0;bottom:0;min-height:72px;padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));align-items:center;justify-content:space-around;background:rgba(32,23,34,.96);backdrop-filter:blur(16px);box-shadow:0 -14px 34px rgba(9,5,12,.18)}
 .ms-tab{min-width:0;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:0;background:transparent;color:#aa9ba9;font-size:9px;font-weight:600;cursor:pointer}
 .ms-tab svg{width:19px;height:19px}
 .ms-tab-active{color:#f18aa6}
 .ms-tab-active:before{content:"";position:absolute;width:42px;height:27px;border-radius:30px;background:rgba(242,117,152,.12);z-index:-1}
 .ms-preview-scrim{align-items:flex-end;padding:0}
 .ms-preview{width:100%;max-height:88dvh;border-radius:25px 25px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}
 .ms-preview-photo{height:255px}
}
@media(max-height:720px) and (max-width:760px){.ms-shell{padding-top:14px}.ms-topbar{margin-bottom:17px}.ms-intro{margin-bottom:15px}.ms-intro h1{font-size:27px}.ms-result{min-height:80px}.ms-photo-wrap{height:58px;width:54px}.ms-prototype{margin-top:11px}}
@media(prefers-reduced-motion:reduce){.ms-screen *{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;

export function MemberSearch() {
  const [query, setQuery] = useState("Mira");
  const [selected, setSelected] = useState<Member | null>(null);
  const [notice, setNotice] = useState("");
  const results = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return [];
    return members.filter((member) => member.name.toLocaleLowerCase().includes(value));
  }, [query]);

  const showDiscoverNotice = () => {
    setNotice("Search opened from Discover · local prototype");
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <main className="ms-screen">
      <style>{styleText}</style>
      <div className="ms-shell">
        <header className="ms-topbar">
          <button className="ms-back" type="button" onClick={showDiscoverNotice} aria-label="Back to Discover">
            <ArrowLeft size={17} />
            <span>Back to Discover</span>
          </button>
          <span className="ms-topbar-mark" aria-hidden="true" />
          <div>
            <div className="ms-kicker">Your next connection</div>
            <div className="ms-title">Search members</div>
          </div>
        </header>

        <div className="ms-desktop-grid">
          <section className="ms-main" aria-label="Member search">
            <div className="ms-intro">
              <h1>Find someone who <em>feels right.</em></h1>
              <p>Search by display name. Only profiles that can discover one another under their settings can appear here.</p>
            </div>

            <div className="ms-search-wrap">
              <div className="ms-search">
                <Search size={19} className="ms-search-icon" aria-hidden="true" />
                <input
                  id="member-search-input"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search a display name"
                  autoComplete="off"
                  aria-label="Search by display name"
                />
                {query && (
                  <button className="ms-clear" type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="ms-matching"><Sparkles size={14} /> People who match “{query.trim() || "your search"}”</div>

            <div className="ms-results-head">
              <h2>People to discover</h2>
              <span className="ms-count">{results.length} {results.length === 1 ? "profile" : "profiles"}</span>
            </div>

            {results.length > 0 ? (
              <div className="ms-results" aria-live="polite">
                {results.map((member, index) => (
                  <button className="ms-result" type="button" key={member.name} onClick={() => setSelected(member)} aria-label={`Preview ${member.name}, ${member.age}, ${member.city}`}>
                    <span className="ms-photo-wrap">
                      <img
                        className="ms-photo"
                        src={member.photo}
                        alt={`${member.name}'s sample profile photo`}
                        style={{ objectPosition: member.photoPosition, transform: `scale(${index === 0 ? 1 : 1.12 + index * 0.04})` }}
                      />
                      {member.online && <span className="ms-online" aria-label="Online now" />}
                    </span>
                    <span className="ms-result-copy">
                      <span className="ms-name-line">
                        <span className="ms-name">{member.name}, {member.age}</span>
                        {member.verified && <span className="ms-verified" title="Verified profile" aria-label="Verified profile"><BadgeCheck size={16} fill="currentColor" stroke="#1b1420" /></span>}
                      </span>
                      <span className="ms-location"><MapPin size={13} />{member.city} · {member.distance}</span>
                      {member.online && <span className="ms-online-label">Online now</span>}
                    </span>
                    <ArrowLeft className="ms-chevron" size={17} style={{ transform: "rotate(180deg)" }} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <section className="ms-empty" aria-live="polite">
                <span className="ms-empty-mark"><Search size={22} /></span>
                <h3>No one by that name yet</h3>
                <p>Try a different spelling or a shorter name. We’ll only show people who are discoverable to you.</p>
                <button type="button" onClick={() => setQuery("Mira")}>Back to Mira</button>
              </section>
            )}

            <div className="ms-prototype">
              <Radio size={15} />
              <span><strong>Prototype search</strong> — these are local sample profiles, not live results. Search is limited by discoverability, blocks, incognito, age and gender preferences, and any saved location constraints.</span>
            </div>
            {notice && <div className="ms-prototype" role="status"><Compass size={15} />{notice}</div>}
          </section>

          <aside className="ms-side" aria-label="Privacy and safety">
            <span className="ms-side-icon"><ShieldCheck size={20} /></span>
            <h2>Your privacy sets the boundaries.</h2>
            <p>Search is personal, not a public directory. Your visibility and preferences shape who can find whom.</p>
            <div className="ms-privacy-list">
              <div className="ms-privacy-item"><Check size={14} />Discoverable profiles only</div>
              <div className="ms-privacy-item"><Check size={14} />Blocks and incognito are respected</div>
              <div className="ms-privacy-item"><Check size={14} />Age, gender, and saved location preferences apply</div>
            </div>
            <div className="ms-match-note"><strong>Messages stay match-only.</strong> Finding a profile here never starts a conversation.</div>
          </aside>
        </div>
      </div>

      <nav className="ms-mobile-nav" aria-label="Main navigation">
        <button type="button" className="ms-tab ms-tab-active" onClick={showDiscoverNotice}><Compass /><span>Discover</span></button>
        <button type="button" className="ms-tab" onClick={() => setNotice("Reels is outside this search prototype.")}><Video /><span>Reels</span></button>
        <button type="button" className="ms-tab" onClick={() => setNotice("Messages remain available after a mutual match.")}><MessageCircle /><span>Messages</span></button>
        <button type="button" className="ms-tab" onClick={() => setNotice("Activity is outside this search prototype.")}><Heart /><span>Activity</span></button>
        <button type="button" className="ms-tab" onClick={() => setNotice("Profile is outside this search prototype.")}><UserRound /><span>Profile</span></button>
      </nav>

      {selected && (
        <div className="ms-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="ms-preview" role="dialog" aria-modal="true" aria-labelledby="ms-preview-name">
            <div className="ms-preview-photo">
              <img src={selected.photo} alt={`${selected.name}'s sample profile photo`} />
              <button className="ms-close" type="button" onClick={() => setSelected(null)} aria-label="Close profile preview"><X size={19} /></button>
              <div className="ms-preview-title" id="ms-preview-name">
                {selected.name}, {selected.age}
                {selected.verified && <span className="ms-verified" aria-label="Verified profile"><BadgeCheck size={18} fill="currentColor" stroke="#1b1420" /></span>}
              </div>
            </div>
            <div className="ms-preview-body">
              <div className="ms-preview-location"><MapPin size={15} />{selected.city} · {selected.distance}</div>
              <p className="ms-preview-note">{selected.note}</p>
              <div className="ms-preview-match"><strong>Good to know:</strong> Search does not open a chat. Messaging is only available after a mutual match.</div>
              <div className="ms-preview-foot"><ShieldCheck size={13} />Shown here because this sample profile is discoverable in the prototype.</div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
