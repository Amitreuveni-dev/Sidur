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

### 🔲 TODO — Next Features

- [ ] **Real PNG icons** — Generate 192x192 and 512x512 from the SVG placeholder
- [ ] **Edit shift** — Long-press or swipe to edit existing shifts
- [ ] **Recurring shifts** — Repeat a shift pattern weekly
- [ ] **Notifications** — Push reminders before a shift starts
- [ ] **Multi-user / sync** — Cloud backend (Supabase / Firebase)
- [ ] **Export to PDF** — Weekly schedule as printable PDF
- [ ] **Statistics page** — Hours per employee per week/month

---

## Notes for Claude (After /clear)

- All state is in **localStorage** via `useShiftsStore` — no backend yet
- The FAB (`+` button) is **bottom-left**, fixed, z-40
- WhatsApp share uses `wa.me/?text=` — no API key needed
- Icons are **placeholders** — user will supply real logo later
- Branch strategy: every feature in its own branch, then PR to main
- Commits in **Hebrew or English** with descriptive messages

