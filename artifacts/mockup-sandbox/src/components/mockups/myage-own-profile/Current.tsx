import { useState } from "react";
import {
  Bell,
  Bookmark,
  Briefcase,
  Camera,
  Clapperboard,
  Copy,
  Heart,
  House,
  Pencil,
  Repeat2,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import "./_group.css";

const imageOne = "/__mockup/images/myage-profile-one.jpg";
const imageTwo = "/__mockup/images/myage-profile-two.jpg";
const photos = [imageOne, imageTwo, imageOne, imageTwo, imageOne, imageTwo];

export function Current() {
  const [activeTab, setActiveTab] = useState("reels");

  return (
    <div className="profile-current">
      <div className="op-current-shell">
        <header className="op-current-head">
          <h1>My Profile</h1>
          <button type="button" className="op-current-settings"><Settings size={14} /> Settings</button>
        </header>

        <main className="op-current-content">
          <div className="op-current-stack">
            <section className="op-card-current op-current-identity">
              <div className="op-current-avatar"><img src={imageOne} alt="Amara's profile" /></div>
              <h2 className="op-current-name">Amara James, 26</h2>
              <p className="op-current-place">Lagos, Nigeria · Woman</p>
              <div className="op-current-stats" aria-label="Social activity">
                <button type="button" className="op-current-stat"><strong>128</strong><span>Followers</span></button>
                <button type="button" className="op-current-stat"><strong>47</strong><span>Following</span></button>
              </div>
              <button type="button" className="op-current-edit"><Pencil size={14} /> Edit profile</button>
            </section>

            <section className="op-card-current op-current-referral">
              <div>
                <h3 className="op-current-label"><span className="op-current-icon"><Sparkles size={12} /></span>Referral points</h3>
                <p>4CIZB81D</p>
                <p className="op-current-muted">0 points · 0 joined</p>
              </div>
              <div className="op-current-actions">
                <button type="button" className="op-current-action"><Copy size={12} />Copy</button>
                <button type="button" className="op-current-action">Share</button>
              </div>
            </section>

            <div className="op-current-two">
              <section className="op-card-current">
                <h3 className="op-current-label"><span className="op-current-icon"><UserRound size={12} /></span>About</h3>
                <p className="op-current-copy">Love you</p>
              </section>
              <section className="op-card-current">
                <h3 className="op-current-label"><span className="op-current-icon"><Briefcase size={12} /></span>Work</h3>
                <p className="op-current-copy">Prefer not to say</p>
              </section>
            </div>

            <section className="op-card-current">
              <h3 className="op-current-label"><span className="op-current-icon"><Heart size={12} /></span>Hobbies</h3>
              <div className="op-current-chips"><span className="op-current-chip">Music</span><span className="op-current-chip">Travel</span></div>
            </section>

            <section className="op-card-current">
              <div className="flex items-center justify-between">
                <h3 className="op-current-label"><span className="op-current-icon"><Camera size={12} /></span>Photos <span className="op-current-muted">2/6</span></h3>
                <button type="button" className="op-current-manage"><Camera size={11} />Manage</button>
              </div>
              <div className="op-current-photos">
                {photos.map((src, index) => <div className="op-current-photo" key={`${src}-${index}`}><img src={src} alt={`Profile photo ${index + 1}`} /></div>)}
              </div>
            </section>

            <section className="op-card-current">
              <div className="op-current-tabs" role="tablist" aria-label="Profile videos">
                {[
                  { id: "reels", icon: Clapperboard, label: "Reels" },
                  { id: "reposts", icon: Repeat2, label: "Reposts" },
                  { id: "saved", icon: Bookmark, label: "Saved" },
                  { id: "liked", icon: Heart, label: "Liked" },
                ].map(({ id, icon: Icon, label }) => (
                  <button key={id} type="button" role="tab" aria-label={label} aria-selected={activeTab === id}
                    className={`op-current-tab ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)}>
                    <Icon size={17} />
                  </button>
                ))}
              </div>
              <div className="op-current-grid">
                {[imageOne, imageTwo, imageOne].map((src, index) => <div className="op-current-reel" key={`${src}-${index}`}><img src={src} alt="" /></div>)}
              </div>
            </section>
          </div>
        </main>

        <nav className="op-current-bottom" aria-label="Main navigation">
          <span><House size={17} />Discover</span>
          <span><Clapperboard size={17} />Reels</span>
          <span><Heart size={17} />Chats</span>
          <span><Bell size={17} />Activity</span>
          <span className="active"><UserRound size={17} />Profile</span>
        </nav>
      </div>
    </div>
  );
}
