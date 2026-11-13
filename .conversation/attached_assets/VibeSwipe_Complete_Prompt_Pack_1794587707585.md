# VIBE SWIPE – Professional Tinder + Instagram Video Dating App
## Complete Prompt Pack & Specification
### Download this file, open it, and paste the Master Prompt into Bolt.new, Replit Agent, Cursor, or v0.app to generate a working starter in minutes.

**App Name Idea:** VibeSwipe (or your brand – MyAge, PayNation Date, etc.)  
**Core Idea:** Tinder-style swipe cards + Instagram-quality video profiles + real-time chat. Professional, polished, fast.

**Recommended Stack for Fast Build & Test:**
- **Frontend:** Expo (React Native) – works on phone + web preview instantly
- **Backend:** Supabase (Auth, Postgres, Realtime Chat, Storage for videos)
- **Video:** expo-av or react-native-video + Supabase Storage
- **UI:** NativeWind (Tailwind) or styled-components for clean Instagram-like look

**Why this stack?** One codebase, instant testing on phone via Expo Go, free tier Supabase, easy video upload.

---

## 1. MASTER PROMPT (Copy & Paste This Entire Block)

```
Build a complete professional dating app called VibeSwipe – Tinder swipe + Instagram-style video profiles.

Tech stack:
- Expo SDK 51+ with React Native + TypeScript
- Expo Router for navigation
- Supabase for auth, database, realtime, storage
- NativeWind or Tailwind-style styling
- expo-av for video playback
- Framer Motion / Reanimated for smooth swipes

Features to implement:

1. Authentication
- Email + password signup/login
- Google OAuth
- Phone OTP (optional)
- Onboarding flow after signup

2. Onboarding & Profile Setup
- Upload 1–6 photos + 1 short video (15–30 sec max)
- Name, age (must be 18+), gender, looking for, bio, location (city)
- Interests tags
- Preferences (age range, distance, gender)

3. Main Discovery Screen (Swipe)
- Stack of cards showing user’s main video (autoplay muted, loop) or first photo
- Swipe right = Like, left = Pass, up = Super Like
- Bottom buttons: Pass (X), Like (Heart), Super Like (Star)
- Tap card to expand full profile (more photos/videos, bio, interests)
- Preload next video
- Smooth 60fps swipe animations

4. Matches
- When mutual like → show “It’s a Match!” modal with both videos/photos
- List of all matches

5. Real-time Chat
- Only with matched users
- Text messages (realtime via Supabase)
- Send images
- Typing indicator
- Unread badges

6. Profile Screen
- Own profile view/edit
- Change photos/video
- Settings (notifications, logout, delete account)

7. Other
- Filters modal
- Report & Block user
- Dark/Light mode (default dark, Instagram style)
- Bottom tab navigation: Discover, Matches, Chat, Profile

UI Style:
- Clean, modern, Instagram + Tinder hybrid
- Dark theme primary (#000 / #1a1a1a background)
- Accent color: vibrant pink/red for likes (#FF2D55)
- Rounded cards, soft shadows, professional typography
- Full-screen video cards

Database (Supabase):
- users (id, email, name, age, gender, bio, city, interests[], video_url, photos[], created_at)
- likes (from_user, to_user, type)
- matches (user1, user2)
- messages (match_id, sender_id, content, created_at)

Generate:
- Complete Expo project structure
- All screens with working navigation
- Supabase client setup (with placeholder keys)
- SQL schema comments
- Mock data for testing swipe and chat
- Clean, production-ready code with comments

Make the swipe feel buttery smooth and the video autoplay reliable. Prioritize mobile UX.
```

---

## 2. SCREEN-BY-SCREEN BREAKDOWN

### Screen 1: Splash + Auth
- Logo animation
- Login / Sign Up buttons
- Social login (Google)

### Screen 2: Onboarding (multi-step)
1. Basic info (name, age, gender, looking for)
2. Photos + Video upload (progress bar)
3. Bio + Interests
4. Location + Preferences
- Progress dots at top

### Screen 3: Discover (Main Swipe)
- Full-screen card stack
- Video plays automatically (muted, loop)
- Name + age overlay bottom
- Swipe gestures + buttons
- Top right: Filter icon
- Bottom nav

### Screen 4: Match Modal
- “It’s a Match!” big text
- Both users’ videos side by side
- “Send Message” button

### Screen 5: Matches List
- Grid or list of matched users (video thumbnail)
- Tap to open chat

### Screen 6: Chat List
- Recent conversations
- Last message preview + timestamp
- Unread count

### Screen 7: Individual Chat
- Message bubbles
- Input bar with send + image button
- Realtime updates

### Screen 8: Profile
- Own video + photos carousel
- Edit button
- Settings

### Screen 9: Settings
- Edit profile
- Notifications
- Privacy
- Logout / Delete account

---

## 3. USER FLOWS

1. **New User**
   Sign Up → Onboarding (4 steps) → Discover Screen

2. **Swipe & Match**
   Discover → Swipe Right → If mutual → Match Modal → Chat

3. **Chat**
   Matches or Chat tab → Open conversation → Send messages (realtime)

4. **Edit Profile**
   Profile tab → Edit → Upload new video/photo → Save

---

## 4. SUPABASE SQL SCHEMA (Paste into Supabase SQL Editor)

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  age int check (age >= 18),
  gender text,
  looking_for text,
  bio text,
  city text,
  interests text[],
  video_url text,
  photos text[],
  created_at timestamptz default now()
);

-- Likes
create table public.likes (
  id uuid default uuid_generate_v4() primary key,
  from_user uuid references public.profiles(id),
  to_user uuid references public.profiles(id),
  type text default 'like', -- like, super, pass
  created_at timestamptz default now(),
  unique(from_user, to_user)
);

-- Matches
create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  user1 uuid references public.profiles(id),
  user2 uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique(user1, user2)
);

-- Messages
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id),
  sender_id uuid references public.profiles(id),
  content text,
  created_at timestamptz default now()
);

-- Enable Realtime for messages
alter publication supabase_realtime add table public.messages;

-- Storage bucket for videos & photos
-- Create in Supabase Dashboard → Storage → New Bucket: "media" (public)
```

---

## 5. INDIVIDUAL SCREEN PROMPTS (Use if Master Prompt is too long)

### Swipe Screen Prompt
```
Create a Tinder-style swipe screen in Expo React Native. Full-screen cards with autoplay muted looping video (expo-av). Name and age at bottom. Swipe left pass, right like. Use react-native-reanimated for smooth animations. Dark theme. Include bottom action buttons.
```

### Chat Screen Prompt
```
Build a realtime chat screen using Supabase Realtime. Message bubbles, input field, send button. Show typing indicator. Only accessible after match. Clean Instagram-like design.
```

### Onboarding Prompt
```
Multi-step onboarding flow in Expo: Step 1 basic info, Step 2 photo/video upload to Supabase Storage, Step 3 bio + interests. Progress indicator. Professional dark UI.
```

---

## 6. VIDEO BEST PRACTICES (Important)

- Max video length: 15–30 seconds
- Compress to 720p before upload
- Autoplay muted + loop on swipe card
- Preload next 1–2 videos
- Show thumbnail while loading
- Use Supabase Storage + CDN

---

## 7. QUICK START STEPS

1. Download this file
2. Go to **https://bolt.new** or open Replit
3. Paste the **Master Prompt** above
4. Create a free Supabase project → copy URL + anon key
5. Paste keys into the generated app
6. Run SQL schema
7. Test on phone with Expo Go

---

**You now have everything.**  
Master prompt + screens + schema + flows.  
Paste, generate, test today.

Good luck building. Make it professional and smooth.  
```

---
*Generated for Achiever / PayNation – Professional Video Swipe Dating App*  
*Stack: Expo + Supabase | Ready for Replit / Bolt / Cursor*
