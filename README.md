# סידור — Shift Management PWA

> **מסמך זה משמש גם כ-Dev Log חי. לאחר כל /clear, קרא את הסעיף "Status" כדי לדעת מה בוצע ומה נותר.**
>
> **This document also serves as a live Dev Log. After every /clear, read the "Status" section to know what's done and what's left.**

---

## Overview · סקירה כללית

**סידור** is a Hebrew-first, RTL Progressive Web App (PWA) for managing weekly work shifts.
Built with **Next.js 15 App Router + TypeScript + Tailwind CSS + next-pwa**.

**סידור** היא אפליקציה PWA בעברית לניהול משמרות עבודה שבועיות.
נבנתה עם Next.js 15 App Router + TypeScript + Tailwind CSS + next-pwa.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 |
| Font | Rubik (Google Fonts, RTL) |
| PWA | next-pwa (workbox) |
| State | React useState + localStorage |
| Icons | Inline SVG |

---

## Installation · התקנה

```bash
git clone https://github.com/Amitreuveni-dev/Sidur.git
cd Sidur
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build
npm start          # Production server
```

---

## Mobile Setup (PWA Install) · התקנה על הנייד

### iOS (Safari)
1. פתח את האתר ב-Safari
2. לחץ על כפתור השיתוף (□↑)
3. בחר "הוסף למסך הבית"

### Android (Chrome)
1. פתח את האתר בכרום
2. לחץ על התפריט (⋮)
3. בחר "הוסף למסך הבית"

---

## Architecture · ארכיטקטורה

```
src/
├── app/
│   ├── layout.tsx          # Root layout: RTL, Rubik font, BottomNav
│   ├── globals.css          # Tailwind base + Rubik import + iOS zoom fix
│   ├── page.tsx             # Dashboard: Today + Tomorrow shifts
│   ├── weekly/page.tsx      # Weekly calendar + WhatsApp export
│   ├── team/page.tsx        # Team management (stub)
│   └── settings/page.tsx    # Settings (stub)
├── components/
│   ├── BottomNav.tsx        # Fixed bottom navigation (4 tabs)
│   ├── ShiftCard.tsx        # Color-coded shift card component
│   └── AddShiftModal.tsx    # Bottom-sheet modal for adding shifts
├── store/
│   └── shiftsStore.ts       # useShiftsStore hook (localStorage)
├── types/
│   └── shift.ts             # Shift types, colors, labels, default times
└── lib/
    └── dateHelpers.ts       # Hebrew date formatting utilities
public/
├── manifest.json            # PWA manifest (name: סידור, theme: violet)
└── icons/
    ├── icon-placeholder.svg # Reference SVG logo (purple, letter ס)
    └── README.txt           # Instructions to generate PNG icons
```

---

## Color System · מערכת צבעים

| Shift Type | Background | Text |
|---|---|---|
| בוקר (Morning) | `bg-blue-50` | `text-blue-700` |
| אחה"צ (Afternoon) | `bg-amber-50` | `text-amber-700` |

---

## Dev Log — Feature Status

### ✅ DONE

- [x] **Project scaffold** — Next.js 16 + TypeScript + Tailwind + next-pwa
- [x] **RTL layout** — `dir="rtl"`, Rubik font, `lang="he"` on `<html>`
- [x] **iOS zero-zoom** — all inputs forced to `font-size: 16px`
- [x] **PWA manifest** — `public/manifest.json` (name: סידור, theme: #6D28D9)
- [x] **PWA config** — `next.config.ts` (TypeScript) with `next-pwa` (offline, standalone)
- [x] **Placeholder icons** — SVG reference in `public/icons/` with README
- [x] **.gitignore** — node_modules, .next, sw.js, workbox files, .env
- [x] **Bottom Navigation Bar** — 4 tabs: בית, יומן, צוות, הגדרות + glassmorphism + animated active pill
- [x] **Shift types** — morning/afternoon/night/rest with colors & Hebrew labels
- [x] **ShiftCard component** — glassmorphism, color accent bar, emoji, badge
- [x] **AddShiftModal** — bottom-sheet, spring animation, employee dropdown
- [x] **Dashboard (/)** — Today + Tomorrow + animated cards (Framer Motion) + empty states
- [x] **"Now" card** — auto-detects current shift and shows who is on duty with pulse indicator
- [x] **Weekly view (/weekly)** — Scrollable week, prev/next navigation
- [x] **WhatsApp export** — "שתף בוואטסאפ" button formats Hebrew text + opens wa.me
- [x] **localStorage store** — `useShiftsStore` + `useEmployeesStore` persist client-side
- [x] **Hebrew date helpers** — `formatHebrewDate`, `shortDay`, week utils
- [x] **Employee Management** — CRUD in Settings: add/edit/delete employees with avatar colors
- [x] **Team page (/team)** — Grid view of all employees with avatar cards
- [x] **Employee dropdown** — AddShiftModal uses employee list; falls back to free text with hint
- [x] **Framer Motion** — Page animations, modal spring, list enter/exit, FAB press
- [x] **Glassmorphism** — BottomNav, ShiftCard, modals use `backdrop-blur` + semi-transparent white
- [x] **Gradient background** — Soft purple→blue→green gradient across all pages
- [x] **next.config.ts** — Config converted to TypeScript (was .mjs)
- [x] **Hover effects & micro-animations** — All interactive buttons have tasteful hover states (Tailwind `hover:`, `transition-all`) and Framer Motion scale effects on FAB/gear button; respects dark/light mode

---

- [x] **Morning/Evening split in WeekCalendarModal** — each day-cell is split into ☀ בוקר (startTime < 16:00) / 🌙 ערב (startTime ≥ 16:00) zones with colored labels and a divider
- [x] **Friday / Shabbat handling** — Friday DayCard disables the + button and shows a "שבת שלום 🕯️" banner with candle-lighting time (fetched from HebCal); Saturday card shows "צאת שבת ✨" time; shifts on Saturday after havdalah are tagged **מוצ״ש** (in both ShiftRow and the WeekCalendarModal grid)
- [x] **HebCal Shabbat times in WeekCalendarModal** — Friday and Saturday column headers display candle-lighting / havdalah times fetched live from HebCal
- [x] **AI Shift Sorter** (`AIShiftSorter.tsx`) — "🤖 AI ייבוא" button in admin action bar opens a bottom-sheet; paste text like `יוחאי: ראשון בוקר, שני ערב` or `Yochai: Sun morning, Mon evening`; parser maps Hebrew/English day names + morning/evening keywords → generates previewed Shift objects; Friday mentions are flagged as errors; unrecognised employees surface as warnings; one-tap import saves all parsed shifts
- [x] **Manager note at end of WhatsApp export** — moved from header position to after the confirmation link (format: `📝 הערת מנהל:\n...`)

### 🔲 TODO — Next Features

- [ ] **Real PNG icons** — Generate 192x192 and 512x512 from the SVG placeholder
- [ ] **Edit shift** — Long-press or swipe to edit existing shifts
- [ ] **Double Shift Detection** — Warn when an employee has two shifts on the same day (e.g. "עומר עובד כפולה ביום ראשון - שים לב") during add and AI import
- [ ] **Toast Duration Fix** — Increase AI-import yellow warning toasts from ~0.5s to 3–4s so they are readable on mobile
- [ ] **UI Contrast Upgrade** — Employee names and shift times need to be bolder and darker for readability in direct sunlight / glare conditions
- [ ] **Background Polish** — Refine the app's light background color so cards pop more while preserving the warm "living" aesthetic
- [ ] **Recurring shifts** — Repeat a shift pattern weekly
- [ ] **Notifications** — Push reminders before a shift starts
- [ ] **Multi-user / sync** — Cloud backend (Supabase / Firebase)
- [ ] **Export to PDF** — Weekly schedule as printable PDF
- [ ] **Statistics page** — Hours per employee per week/month

---

## 🚀 Roadmap & Pending Tasks

### 1. Smart Parser Upgrades (NLP)

- [ ] **Partial Name Matching** — Improve `matchEmployee` to identify employees by first name only when it is unique in the team (e.g. `"עומר"` instead of `"עומר מזרחי"`). Levenshtein fuzzy matching already exists; extend it to split on space and try each part independently.

- [ ] **Collective Expressions** — Add support for phrases like `"פול שבוע"` / `"כל השבוע"` that automatically generate morning **and** evening shifts for all active days (Sun–Thu + Sat after havdalah).

- [ ] **Deep Time Recognition** — Fix "can work from \[time\]" logic. When only a start time is supplied without an explicit end (e.g. `"מ-19:30"`), the parser should default the end time to closing (`23:00`) instead of snapping to a shift-type bucket.

### 2. New Features

- [ ] **Weather Integration** — Show a weather icon / temperature near each day-header in the main schedule (WeekTimeline). Source: Open-Meteo free API (no key required).

- [ ] **Role Tags** — Add a `role` field (`"manager" | "employee"`) to the Employee DB. Display a distinct icon/color badge for managers in the UI (WeekTimeline pills, employee management panel, WhatsApp export).

### 3. Logic & Safety

- [ ] **Double Shift Detection** — During both manual add (`AddShiftModal`) and AI import (`AIShiftSorter`), check if the target employee already has a shift on the same day. Surface a Hebrew warning banner: `"⚠️ עומר עובד כפולה ביום ראשון - שים לב"`. Allow the manager to proceed anyway (soft warning, not a blocker).

### 4. UI/UX Final Polish

- [ ] **Final Deletion Fix** — Verify AI Import preview (`AIShiftSorter.tsx`) is strictly read-only end-to-end: no `onClick`, no `selectedShifts` state, no "לחץ על שם למחיקה" hint anywhere in the tree. *(Completed 2026-03-27 — leaving here as a regression checkpoint.)*

- [ ] **Mobile Scroll Locking** — Add `overscroll-behavior-y: contain` (Tailwind: `overscroll-y-contain`) on the shifts container in WeekTimeline and WeekCalendarModal to prevent accidental pull-to-refresh on iOS/Android Chrome.

- [ ] **Toast Duration** — AI-import result toasts (yellow warnings, green success) should display for 3–4 seconds. Confirm `duration` prop in all `toast()` calls inside `AIShiftSorter.tsx`.

- [ ] **UI Contrast Upgrade** — Shift details (employee name, start/end time) should use heavier font-weight and a darker text color. Audit `ShiftRow.tsx`, `ShiftCard.tsx`, and calendar pills for readability against the gradient background.

- [ ] **Background Polish** — Evaluate replacing the current gradient with a slightly warmer or more opaque base so card `bg-warm-50` / `dark:bg-slate-800` stands out. Must preserve the "living" feel and remain visually calm on iPhone screen sizes.

---

## Notes for Claude (After /clear)

- All state is in **localStorage** via `useShiftsStore` — no backend yet
- The FAB (`+` button) is **bottom-left**, fixed, z-40
- WhatsApp share uses `wa.me/?text=` — no API key needed
- Icons are **placeholders** — user will supply real logo later
- Branch strategy: every feature in its own branch, then PR to main
- Commits in **Hebrew or English** with descriptive messages

