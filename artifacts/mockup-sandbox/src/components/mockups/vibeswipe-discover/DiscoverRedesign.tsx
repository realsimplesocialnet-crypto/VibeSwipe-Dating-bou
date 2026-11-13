import "./_group.css";
import { Compass, Heart, MapPin, MessageCircle, SlidersHorizontal, Star, UserRound, X } from "lucide-react";

const portrait = "/__mockup/images/vibeswipe-discover-sample.png";

export function DiscoverRedesign() {
  return (
    <main className="vs-discover">
      <img className="vs-photo" src={portrait} alt="Jordan, smiling outdoors" />
      <div className="vs-photo-shade" />
      <div className="vs-top-scrim" />

      <button className="vs-filter" aria-label="Discovery filters">
        <SlidersHorizontal size={19} strokeWidth={1.8} />
      </button>

      <section className="vs-profile" aria-label="Jordan's profile">
        <div className="vs-name-line">
          <h1>Jordan</h1>
          <span className="vs-age">26</span>
        </div>
        <div className="vs-city">
          <MapPin size={14} strokeWidth={1.8} />
          <span>San Francisco</span>
        </div>
      </section>

      <div className="vs-actions" aria-label="Profile actions">
        <button className="vs-action vs-pass" aria-label="Pass">
          <X size={28} strokeWidth={2.5} />
        </button>
        <button className="vs-action vs-super" aria-label="Super Like">
          <Star size={24} strokeWidth={2.2} fill="currentColor" />
        </button>
        <button className="vs-action vs-like" aria-label="Like">
          <Heart size={27} strokeWidth={2.3} fill="currentColor" />
        </button>
      </div>

      <nav className="vs-nav" aria-label="Main navigation">
        <div className="vs-tab vs-tab-active"><Compass size={19} /><span>Discover</span></div>
        <div className="vs-tab"><Heart size={19} /><span>Matches</span></div>
        <div className="vs-tab"><MessageCircle size={19} /><span>Chat</span></div>
        <div className="vs-tab"><UserRound size={19} /><span>Profile</span></div>
      </nav>

      <style>{`
        .vs-discover {
          --ink: #fffaf8;
          position: relative;
          isolation: isolate;
          width: 100%;
          max-width: 390px;
          height: 100dvh;
          min-height: 680px;
          margin: 0 auto;
          overflow: hidden;
          background: #100e0e;
          color: var(--ink);
          font-family: "DM Sans", "Avenir Next", ui-sans-serif, system-ui, sans-serif;
        }
        .vs-photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 50% 38%;
        }
        .vs-photo-shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(12, 10, 9, .32) 0%, transparent 17%, transparent 47%, rgba(12, 9, 9, .16) 61%, rgba(12, 9, 9, .9) 79%, #100e0e 100%),
            linear-gradient(90deg, rgba(12, 9, 9, .11), transparent 28%, transparent 75%, rgba(12, 9, 9, .08));
        }
        .vs-top-scrim {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 82px;
          background: linear-gradient(180deg, rgba(9, 8, 8, .23), transparent);
          pointer-events: none;
        }
        .vs-filter {
          position: absolute;
          z-index: 1;
          top: max(18px, env(safe-area-inset-top));
          right: 19px;
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          padding: 0;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, .32);
          border-radius: 50%;
          background: rgba(25, 22, 21, .3);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .vs-profile {
          position: absolute;
          right: 25px;
          bottom: 230px;
          left: 25px;
          text-shadow: 0 2px 16px rgba(0, 0, 0, .23);
        }
        .vs-name-line {
          display: flex;
          align-items: baseline;
          gap: 11px;
        }
        .vs-name-line h1 {
          margin: 0;
          color: #fffaf8;
          font-size: 37px;
          font-weight: 720;
          letter-spacing: -1.55px;
          line-height: 1.04;
        }
        .vs-age {
          color: rgba(255, 255, 255, .78);
          font-size: 24px;
          font-weight: 430;
          letter-spacing: -.45px;
        }
        .vs-city {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          color: rgba(255, 255, 255, .84);
          font-size: 14px;
          font-weight: 480;
          letter-spacing: .04px;
        }
        .vs-city svg { opacity: .86; }
        .vs-actions {
          position: absolute;
          right: 0;
          bottom: max(112px, calc(env(safe-area-inset-bottom) + 108px));
          left: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 27px;
        }
        .vs-action {
          display: grid;
          flex: none;
          place-items: center;
          width: 62px;
          height: 62px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          box-shadow: 0 8px 28px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255, 255, 255, .26);
          transition: transform 160ms ease, filter 160ms ease;
        }
        .vs-action:active { transform: scale(.94); filter: brightness(1.08); }
        .vs-pass {
          color: #ef7683;
          background: linear-gradient(145deg, #fff3f1, #f5d8d8);
        }
        .vs-super {
          width: 54px;
          height: 54px;
          color: #d6a844;
          background: linear-gradient(145deg, #fff8e6, #f2e2bd);
        }
        .vs-like {
          color: #fff;
          background: #ff2d55;
          box-shadow: 0 9px 28px rgba(255, 45, 85, .29), inset 0 1px 0 rgba(255, 255, 255, .29);
        }
        .vs-nav {
          position: absolute;
          z-index: 2;
          right: 0;
          bottom: 0;
          left: 0;
          display: flex;
          align-items: center;
          justify-content: space-around;
          height: 84px;
          padding: 9px 12px 18px;
          border-top: 1px solid rgba(255, 255, 255, .1);
          background: rgba(8, 7, 8, .88);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .vs-tab {
          display: flex;
          min-width: 54px;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          color: rgba(255, 255, 255, .63);
          font-size: 10px;
          font-weight: 500;
        }
        .vs-tab-active { color: #ff2d55; }
        @media (max-height: 740px) {
          .vs-profile { bottom: 208px; }
          .vs-actions { bottom: max(98px, calc(env(safe-area-inset-bottom) + 92px)); }
          .vs-action { width: 56px; height: 56px; }
          .vs-super { width: 50px; height: 50px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vs-action { transition: none; }
        }
      `}</style>
    </main>
  );
}
