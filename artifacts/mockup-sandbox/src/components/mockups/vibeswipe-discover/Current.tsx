import "./_group.css";
import {
  Compass,
  Eye,
  Heart,
  House,
  MapPin,
  MessageCircle,
  SlidersHorizontal,
  Star,
  UserRound,
  X,
} from "lucide-react";

const sample = "/__mockup/images/vibeswipe-discover-sample.png";

export function Current() {
  return (
    <main className="current-screen">
      <header className="current-header">
        <div>
          <div className="current-brand">vibe<span>swipe</span></div>
          <div className="current-hint">Discover your next connection</div>
        </div>
        <button className="current-filter" aria-label="Open discovery filters">
          <SlidersHorizontal size={18} />
        </button>
      </header>

      <section className="current-deck" aria-label="Profile card">
        <div className="current-card">
          <img src={sample} alt="Jordan's profile" />
          <div className="current-gradient" />
          <div className="current-demo"><Eye size={12} /> SAMPLE PROFILE</div>
          <div className="current-copy">
            <div className="current-location"><MapPin size={13} /> San Francisco</div>
            <div className="current-name">Jordan, 26</div>
            <p>Looking for someone to try every coffee shop in the city with.</p>
            <div className="current-tags">
              <span>Coffee</span><span>Live music</span><span>Hiking</span>
            </div>
          </div>
        </div>
      </section>

      <div className="current-actions" aria-label="Profile actions">
        <button className="current-action"><span className="current-action-circle"><X size={22} /></span><span>Pass</span></button>
        <button className="current-action"><span className="current-action-circle current-small current-star"><Star size={19} /></span><span>Super like</span></button>
        <button className="current-action"><span className="current-action-circle current-like"><Heart size={22} /></span><span>Like</span></button>
      </div>

      <nav className="current-tabs" aria-label="Main navigation">
        <div className="current-tab current-tab-active"><Compass size={19} /><span>Discover</span></div>
        <div className="current-tab"><Heart size={19} /><span>Matches</span></div>
        <div className="current-tab"><MessageCircle size={19} /><span>Chat</span></div>
        <div className="current-tab"><UserRound size={19} /><span>Profile</span></div>
      </nav>
    </main>
  );
}

const css = `
.current-screen{height:100dvh;min-height:700px;display:flex;flex-direction:column;padding:42px 18px 84px;background:var(--background);position:relative;overflow:hidden}
.current-header{height:56px;flex:none;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.current-brand{font-size:22px;font-weight:800;letter-spacing:-.7px}
.current-brand span{color:var(--primary)}
.current-hint{font-size:11px;margin-top:1px;color:var(--muted-foreground)}
.current-filter{width:42px;height:42px;border:1px solid var(--border);border-radius:15px;background:var(--card);color:var(--foreground);display:grid;place-items:center}
.current-deck{position:relative;flex:1;min-height:250px}
.current-card{position:absolute;inset:0;border-radius:28px;overflow:hidden;background:#181316}
.current-card img{width:100%;height:100%;object-fit:cover;display:block}
.current-gradient{position:absolute;inset:0;background:linear-gradient(180deg,transparent 25%,rgba(9,7,9,.18) 56%,rgba(9,7,9,.95) 100%)}
.current-demo{position:absolute;top:17px;left:17px;display:flex;align-items:center;gap:6px;border-radius:16px;background:rgba(0,0,0,.55);padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.8px}
.current-copy{position:absolute;left:22px;right:22px;bottom:20px}
.current-location{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;margin-bottom:4px}
.current-name{font-size:31px;font-weight:700;letter-spacing:-.8px}
.current-copy p{font-size:14px;line-height:20px;color:rgba(255,255,255,.88);margin:4px 0 0;max-width:310px}
.current-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
.current-tags span{border-radius:20px;background:rgba(255,255,255,.18);padding:6px 10px;font-size:11px;font-weight:600}
.current-actions{display:flex;align-items:center;justify-content:center;gap:28px;flex:none;padding:14px 0 8px}
.current-action{border:0;background:transparent;color:#b6a8af;font-size:10px;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:6px}
.current-action-circle{width:58px;height:58px;border-radius:50%;background:var(--card);color:var(--foreground);display:grid;place-items:center;box-shadow:0 7px 18px rgba(0,0,0,.18)}
.current-small{width:46px;height:46px}
.current-star{color:#dfb44c}
.current-like{background:var(--primary);color:#fff}
.current-tabs{position:absolute;bottom:0;left:0;right:0;height:84px;border-top:1px solid var(--border);background:rgba(12,10,12,.97);display:flex;align-items:center;justify-content:space-around;padding-bottom:10px}
.current-tab{display:flex;flex-direction:column;align-items:center;gap:5px;color:var(--muted-foreground);font-size:10px}
.current-tab-active{color:var(--primary)}
@media(max-height:760px){.current-screen{min-height:0;padding-top:32px}.current-header{margin-bottom:6px}.current-actions{padding-top:10px}.current-action-circle{width:52px;height:52px}.current-small{width:42px;height:42px}}
`;

if (typeof document !== "undefined" && !document.getElementById("vibeswipe-current-style")) {
  const style = document.createElement("style");
  style.id = "vibeswipe-current-style";
  style.textContent = css;
  document.head.append(style);
}
