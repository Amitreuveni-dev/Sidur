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

### ✅ DONE — Sprint 1 (Foundation)

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
- [x] **Employee Management** — CRUD: add/edit/delete employees
- [x] **Team page (/team)** — Grid view of all employees
- [x] **Employee dropdown** — AddShiftModal uses employee list
- [x] **Framer Motion** — Page animations, modal spring, list enter/exit, FAB press
- [x] **Glassmorphism** — BottomNav, ShiftCard, modals use `backdrop-blur` + semi-transparent white
- [x] **Gradient background** — Soft purple→blue→green gradient across all pages
- [x] **next.config.ts** — Config converted to TypeScript (was .mjs)
- [x] **Hover effects & micro-animations** — All interactive buttons have tasteful hover states; Framer Motion scale on FAB; dark/light mode

### ✅ DONE — Sprint 2 (Calendar & AI)

- [x] **Morning/Evening split in WeekCalendarModal** — ☀ בוקר / 🌙 ערב zones with colored labels and a divider
- [x] **Friday / Shabbat handling** — שבת שלום banner, candle-lighting time, havdalah, מוצ״ש tag
- [x] **HebCal Shabbat times** — Friday and Saturday column headers display live HebCal times
- [x] **AI Shift Sorter** (`AIShiftSorter.tsx`) — paste free text → parsed shifts preview → one-tap import; Hebrew + English support; Friday rejection; unrecognised employee warnings
- [x] **Manager note at end of WhatsApp export** — format: `📝 הערת מנהל:\n...`
- [x] **Edit shift** — ✏️ button on every ShiftRow in admin mode; ShiftModal supports `editShift` prop for full update workflow
- [x] **Double Shift Detection** — ShiftModal shows animated amber warning banner when employee already has a shift on the other slot that day; AI import emits yellow toast per affected employee
- [x] **Weather Integration** — `WeatherWidget` shows live temperature + rain/cold alert from Open-Meteo API (no key required); displayed in page header

### ✅ DONE — Sprint 3 (Mobile Polish & Full Project)

- [x] **Mobile Confirmation fix** — `EmployeeConfirm.tsx`: `onPointerDown` + `e.target === e.currentTarget` guard for iOS Safari; `touch-action: manipulation` on buttons
- [x] **Partial Name Matching in AI Parser** — `matchEmployee` 4-tier: exact → substring/prefix with ambiguity warning → first-name part matching → fuzzy Levenshtein on full name AND each name part; minimum-length guard on `includes`
- [x] **UI Contrast Upgrade** — `ShiftRow.tsx`: `font-extrabold` on employee name, `text-slate-700 dark:text-slate-200` on times for sunlight readability
- [x] **Background Polish** — `globals.css`: `--bg-primary: #ede5d8` (warm-200, deeper sand) in light mode so cards pop; warm card/input tokens updated
- [x] **Toast Duration Fix** — AI-import success toast: 2500 ms → **4000 ms**; double-shift warning toasts: 3500 ms (unchanged, already correct)
- [x] **Mobile Scroll Locking** — `overscroll-y-contain` on WeekTimeline shifts container and WeekCalendarModal scrollable grid; prevents accidental pull-to-refresh on iOS/Android Chrome
- [x] **Role Tags** — `Employee` type gains optional `role: 'manager' | 'employee'`; employee panel shows ⭐/👤 toggle button; "מנהל" badge appears on ShiftRow pills for managers; backward-compatible (existing employees default to no role)
- [x] **Collective Expressions** — AI parser recognises `"כל השבוע"` / `"פול שבוע"` / `"full week"` and generates shifts for all active days (Sun–Thu + Sat), using the specified shift type or morning as default
- [x] **Deep Time Recognition** — `matchTimeToken`: threshold moved from 16:00 → **13:00**; times ≥ 13:00 default end to 23:00 (closing) instead of 17:30, covering "מ-14:00" and similar afternoon start-time entries

### ✅ DONE — Sprint 4 (Statistics & Export)

- [x] **Statistics modal** — `StatsModal.tsx`: bottom-sheet with period selector (week / month / all); hours per employee calculated from startTime/endTime (overnight-safe); sorted by hours desc; totals footer
- [x] **Export as Image** — `WeekExportView.tsx`: static inline-style grid (RTL, Hebrew, Shabbat times); captured via `html2canvas` at 2× resolution; downloads as `sidur-YYYY-Wnn.png`; export button (🖼️) in WeekCalendarModal header
- [x] **shiftValidation helper** — created missing `src/lib/shiftValidation.ts` (`formatDoubleShiftWarning`) that ShiftModal depends on

### ❌ Removed from scope

- ~~Real PNG icons~~ — user will handle later
- ~~Notifications~~ — not needed at this stage
- ~~Multi-user / sync~~ — staying client-side/localStorage only
- ~~Export to PDF~~ — replaced by Export as Image
- ~~Recurring shifts~~ — deferred indefinitely

---

## Notes for Claude (After /clear)

- All state is in **localStorage** via `useShiftsStore` — no backend yet
- The FAB (`+` button) is **bottom-left**, fixed, z-40
- WhatsApp share uses `wa.me/?text=` — no API key needed
- Icons are **placeholders** — user will supply real logo later
- Branch strategy: every feature in its own branch, then PR to main
- Commits in **Hebrew or English** with descriptive messages

