# GoBooking - Bus Ticket Booking App

## Overview
GoBooking is a full-stack mobile bus ticket booking app built with Expo React Native + Express API backend.

## Architecture
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express.js API server with Drizzle ORM + PostgreSQL
- **Monorepo**: pnpm workspace

## Tech Stack
- Expo SDK 53 / expo-router v6
- @tanstack/react-query
- AsyncStorage for auth persistence
- expo-linear-gradient, expo-haptics, expo-blur
- @expo-google-fonts/inter
- Drizzle ORM + PostgreSQL

## Design
- Blue theme: #1A56DB (primary), #0F3BA0 (dark), #EEF2FF (light)
- Inter font family
- Clean card-based UI, Airbnb/Coinbase-inspired

## Bagages & Photos Colis (dernière session)
- **parcel/send.tsx** : Étape "Photos" (step 4 sur 6) ajoutée — sélection 1–6 photos, upload Firebase, validation obligatoire avant livraison
- **parcels Drizzle schema** : Colonne `photoUrls` (jsonb) ajoutée, logique `status: en_attente_validation` si photos présentes
- **ParcelContext** : Champ `photoUrls: string[]` ajouté
- **parcel/payment.tsx** : `photoUrls` transmis à l'API lors de la création
- **agent/baggage-review.tsx** : Nouvel écran de validation des bagages passagers (≥2 bagages) avec visionneuse photo zoom, décision accepté/refusé avec note
- **agent/home.tsx** : Carte "Validation Bagages" ajoutée (pour rôles embarquement/vente)

## New Artifacts
- **GoBooking Admin Web** (`artifacts/gobooking-admin`) — React + Vite web dashboard at `/admin/` for company management (bookings, parcels, agents, trips, analytics, invoices). Uses JWT auth.
- **API Server** (`artifacts/api-server`) — All routes at `/api`, started from `index.ts`.

## Agent Roles
- `agent_ticket` / `vente` / `agent_guichet` → /agent/tickets (guichet vente)
- `agent_embarquement` / `embarquement` → /agent/embarquement
- `agent_colis` / `reception_colis` → /agent/colis (avec onglet "✅ Valider" pour colis à distance)
- `logistique` → /agent/logistique
- `route` → /agent/route
- `suivi` → /agent/suivi
- `agent_reservation` → /agent/reservation (réservations en ligne)

## Colis à Distance (nouveau)
- Client crée une demande depuis `POST /parcels/create-remote` avec photo base64
- Statut initial: `en_attente_validation`
- Agent valide via `POST /agent/parcels/:id/validate` (ajustement prix optionnel) → SMS au client
- Agent refuse via `POST /agent/parcels/:id/refuse` (motif) → SMS au client
- Livraison domicile: statut `en_attente_ramassage` → agent envoie livreur via `POST /agent/parcels/:id/send-livreur`
- Statuts ajoutés: `en_attente_validation`, `valide`, `refuse`, `en_attente_ramassage`, `ramassage_en_cours`
- Screen client: `app/client/colis-distance.tsx` — formulaire avec photo, villes, poids, valeur déclarée
- Onglet agent: "✅ Valider" dans `app/agent/colis.tsx` (4ème tab)
- Bandeau "Déposer à distance" dans `app/(tabs)/colis.tsx`

## Système de Rapports Agents (nouveau)
- Table `agent_reports` (id, agentId, agentName, companyId, agentRole, reportType, description, relatedId, statut, createdAt)
- 8 types de rapport: incident_voyage, probleme_colis, probleme_passager, probleme_vehicule, fraude, retard, suggestion, autre
- Statuts rapport: soumis → lu → en_cours → traite / rejete
- Agent: `POST /agent/reports`, `GET /agent/reports`
- Compagnie: `GET /company/reports`, `PATCH /company/reports/:id`
- Screen agent: `app/agent/rapport.tsx` (Nouveau rapport + Historique)
- Bouton "📋 Faire un rapport" rouge dans `app/agent/home.tsx`

## Demo Accounts (password: test123)
- compagnie@test.com, agent@test.com, admin@test.com
- logistique@test.com, suivi@test.com, reservation@test.com (NEW)

## Seat Separation System (trips table)
- `guichet_seats` — seats reserved for guichet sales
- `online_seats` — seats reserved for online bookings
- `bookings.booking_source` — "guichet" | "online" | "mobile"
- Guichet endpoint enforces guichetSeats limit
- Online confirmation endpoint enforces onlineSeats limit
- API: GET /agent/online-bookings, POST /agent/online-bookings/:id/confirm, GET /agent/trips/capacity/:tripId

## Features Implemented
1. Login / Registration (token-based auth with SHA256 password hashing, role-based registration, inline error messages)
2. Home screen with bus search (from/to/date/passengers) + recent activity section
3. Search results with sort options (price/duration/departure)
4. Trip detail with amenities, stops, policies
5. Seat selection (visual bus layout with available/booked/selected states)
6. Passenger information form
7. Payment page (Orange Money, MTN MoMo, Wave, Visa/Mastercard)
8. Booking confirmation with e-ticket view
9. User dashboard (Bookings tab + Profile tab)
10. Admin dashboard (Overview/Bookings/Trips/Users tabs)
11. Parcel delivery (send, track, real-time status — statuses: en_attente/pris_en_charge/en_transit/en_livraison/livre/annule)
12. Parcel tracking with QR/ref input — tracking ref format: GBX-XXXX-XXXX
13. Notifications screen (filter chips: Tous/Colis/Trajet/Promo, date separators)
14. **Company Dashboard** (bus fleet, routes, colis, agents management — amber theme)
15. **Agent Dashboard** (mission info, passenger boarding validation, parcel pickup/transit/delivery — green theme)
16. **Super Admin Dashboard** (global stats, companies, users, cities, payment breakdown — purple theme)
17. **Agent Role System** — 3 main agent roles with auto-redirect on login and dedicated screens:
    - `agent_ticket` / `vente` → `/agent/tickets` (ticket sales at counter, amber theme)
    - `agent_embarquement` / `embarquement` → `/agent/embarquement` (QR scan boarding, green theme)
    - `agent_colis` / `reception_colis` → `/agent/colis` (unified: create + receive + scan parcels, purple theme)
    - Home (`/agent/home`) redirects immediately based on agentRole; old roles kept for backward compat
    - Each screen has a role guard showing "Accès non autorisé" if wrong agent type accesses
    - Demo account `agent@test.com` uses role `agent_embarquement`
18. **Agent Creation by Company** — Modal form in company dashboard with role selector chips, email/password fields; calls `POST /company/agents` which creates both `usersTable` (role=agent) and `agentsTable` entries atomically
19. **Animated Splash Screen** (`app/index.tsx`) — fond sombre #0B1D3A, logo-bus dessiné en primitives RN, animation séquentielle (spring + fade + slide), shimmer en boucle, nom "GoBooking" avec point accent ambre, tagline, dots de chargement pulsés, 2.6 s minimum puis redirection auth-aware
20. **Commission system** (10% on bookings configurable via admin, 5% on parcels; breakdown on booking confirmation; super admin revenue ventilation bars)
21. **Billing/Invoicing system** — `invoices` table (period YYYY-MM, totalGross, totalCommission, totalNet, transactionCount, status pending/paid, paidAt); company dashboard "Factures" tab with generate + share buttons; super admin "Factures" tab with pay + share actions; backend endpoints: GET/POST /company/invoices, GET /superadmin/invoices, PUT /superadmin/invoices/:id/pay

## Role-based Dashboards
- `/dashboard/company` — Company Admin: fleet, routes, parcels, agents
- `/dashboard/agent` — Agent: daily mission, passenger boarding, parcel actions
- `/dashboard/super-admin` — Super Admin: global platform view, 42.9M FCFA revenue, 8 companies, 1248 users
- All 3 show demo data unauthenticated; fetch real API data when logged in with correct role
- Accessible from Profile tab → "Tableaux de bord" section

## Agent Sub-Roles (agentRole field in agentsTable)
- `embarquement` → `/agent/embarquement` — QR scanner for boarding passes, validate boarding, "En Route" tab for dynamic boarding
- `reception_colis` → `/agent/reception-colis` — QR scanner for parcels, confirm arrival at station
- `vente` → `/agent/vente` — Create walk-in reservations, manage payments
- `validation` → `/agent/validation` — Confirm/validate reservations by QR or reference
- No agentRole (demo) → `/dashboard/agent` — Full agent dashboard with all capabilities
- API endpoints: GET /agent/reservation/:ref, POST /agent/reservation/:id/board, POST /agent/reservation/:id/confirm, POST /agent/parcels/:id/arrive, POST /agent/requests/:id/board, GET /agent/requests/confirmed?tripId=XXX

## Dynamic En-Route Boarding (cars-en-route-map.tsx)
- Passengers can request to board a moving bus from the live map
- POST /trips/:tripId/request — send boarding request with clientName/phone/boardingPoint/seatsRequested
- Returns requestId; frontend polls GET /trips/:tripId/request/:requestId every 5s
- When accepted: QR code modal appears (from api.qrserver.com using requestId as data)
- Agent scans QR or manually accepts via company dashboard "En Route" tab
- Company endpoints: GET /company/boarding-requests, POST /company/boarding-requests/:id/accept, POST /company/boarding-requests/:id/reject
- Agent embarquement "En Route" tab: lists accepted passengers, Call button, Embarquer button

## Offline Mode
- Package: @react-native-community/netinfo
- Utility: utils/offline.ts (saveOffline, syncOfflineQueue, useNetworkStatus hook)
- Banner component: components/OfflineBanner.tsx (shows status + pending count + sync button)
- Queue stored in AsyncStorage key: "gobooking_offline_queue"
- Offline types: scan (boarding validation), reservation (walk-in sale), colis_arrive, en_route_board
- Auto-sync on reconnect; manual sync button available
- Integrated in: agent/embarquement.tsx, agent/vente.tsx, agent/reception-colis.tsx
- Offline reservations get OFFLINE-xxx ref, auto-synced when online returns

## User Roles
- `client` / `user` — regular passenger → /(tabs)
- `admin` / `super_admin` — platform admin → /dashboard/super-admin
- `compagnie` / `company_admin` — transport company manager → /dashboard/company
- `agent` — bus agent (boarding & parcel handling) → /dashboard/agent

## Auth System
- Backend: `POST /auth/register` accepts `role` field (client/agent/compagnie/admin)
- Registration redirects to appropriate dashboard based on role
- Inline error messages (no popup Alerts) for validation + server errors
- Login screen: inline banner for empty fields (yellow) + server errors (red)
- Register screen: role selector grid (4 colored cards), password strength indicator, security note
- Demo accounts: compagnie@test.com, agent@test.com, admin@test.com, user@test.com (all: test123)

## Security & Access Control (Added 2026-03)
- **helmet.js** — 5 security headers on all responses (X-Frame-Options, X-Content-Type, Referrer-Policy, CORP, COOP)
- **Global rate limiter** — 500 req / 15 min per IP; skips /api/ping
- **Login rate limiter** — max 10 attempts / 15 min per IP → HTTP 429
- **Register rate limiter** — max 5 attempts / 15 min per IP
- **Centralized auth middleware** — `src/middleware/auth.ts`: `requireAuth`, `requireRole(...roles)`, `requireSelf(getUserId)`, `getAuthUser`
- **Role guards on all routes**:
  - `POST /bookings` — blocks `agent`, `compagnie`, `company_admin` (they can't create client bookings)
  - `POST /trips/:id/seats/hold` — requires any authenticated user
  - `POST /company/trips` — requires `role === "compagnie"` (only company can create trips); stores `companyId`
  - `DELETE /buses/:id` — verifies bus belongs to requesting company
  - `requireAgent()` — checks `role in ["admin","agent"]` + `status !== "inactive"`
  - `requireCompanyAdmin()` — checks `role in ["admin","company_admin","compagnie"]` + status
  - `requireSuperAdmin()` — checks `role in ["admin","super_admin"]`
- **Company data isolation** — `GET /company/buses`, `/agents`, `/trips`, `/bookings`, `/stats` all filter by `companyId`
- **Agent data isolation** — `GET /agent/boarding` returns only bookings for the agent's assigned trip
- **PERMISSION_DENIED audit logging** — all role violations logged to `audit_logs` with `flagged: true`, IP, reason, and path
- **Server-side payment verification** — transactions verified on backend before booking confirmed (CinetPay)
- **Inactive account block** — `status === "inactive"` blocks login and all API calls

## Project Structure
```
artifacts/
  gobooking/           # Expo mobile app
    app/
      (auth)/          # Login, Register
      (tabs)/          # Home, Bookings, Profile, Suivi, Notifications
      trip/[id]        # Trip details
      seats/[tripId]   # Seat selection
      passengers       # Passenger info
      payment          # Payment
      confirmation/[bookingId]  # Booking confirmed
      booking/[id]     # Booking detail
      parcel/          # Parcel send/track/confirmation/tracking
      admin/           # Admin nested layout (guards admin/super_admin roles)
        _layout.tsx    # Auth guard + Stack for admin routes
        dashboard.tsx  # Redirect stub → /dashboard/super-admin
        stats.tsx      # Admin statistics page
      dashboard/
        company.tsx    # Company dashboard (amber, #0B3C5D) + DashboardCharts
        agent.tsx      # Agent dashboard (green, #059669)
        super-admin.tsx # Super admin dashboard (purple, #7C3AED) + DashboardCharts
    context/
      AuthContext      # Auth state + AsyncStorage
      BookingContext   # Multi-step booking flow
      LanguageContext  # FR/EN translations
    utils/api.ts       # apiFetch utility
    constants/colors   # Blue theme tokens
  api-server/          # Express REST API
    src/routes/
      auth.ts          # POST /login, /register, GET /me
      trips.ts         # GET /search, /:id, /:id/seats
      bookings.ts      # POST /, GET /, /:id, POST /:id/cancel
      admin.ts         # GET /stats, /bookings, /trips, /users
      parcels.ts       # Parcel CRUD + status updates
      superadmin.ts    # Super admin stats, companies, cities, users
      company.ts       # Company stats, buses, agents, routes, customers, SMS marketing
      agent.ts         # Agent boarding, parcel pickup/transit/deliver
      index.ts         # Route aggregator

lib/
  db/                  # Shared Drizzle schema + db client
    src/schema/
      index.ts         # users, trips, seats, bookings, parcels,
                       # companies, buses, agents, cities, payments, notifications,
                       # agent_alerts, sms_logs
```

## Demo Accounts (all password: test123)
- Entreprise: compagnie@test.com / test123
- Agent: agent@test.com / test123
- Admin: admin@test.com / test123
- Client: user@test.com / test123
- Legacy admin: admin@gobooking.com (passwordHash SHA256)
- Legacy user: user@gobooking.com (passwordHash SHA256)

## Currency & Payments
- All prices in FCFA (`.toLocaleString() FCFA`)
- Payment methods: Orange Money (#FF6B00), MTN MoMo (#FFCB00), Wave (#1BA5E0), Visa/Mastercard (#1A56DB)

## API Base URL
The Expo app reads `EXPO_PUBLIC_DOMAIN` to build the API URL: `https://{domain}/api`

## Database
PostgreSQL via Replit Database (DATABASE_URL env var).
Schema pushed with `pnpm --filter @workspace/db run push-force`.
Tables: users, trips, seats, bookings, parcels, companies, buses, agents, cities, payments, notifications.
Seeded with Côte d'Ivoire routes (Abidjan, Bouaké, Yamoussoukro, Korhogo, San Pedro, Daloa, Man, etc.).
Data: ~2708 trips, ~107680 seats, demo companies/buses/agents pre-seeded.

## Platform Notes (Web vs Native)
- `react-native-webview` not supported on Expo Web → loaded via conditional require (Platform.OS !== "web")
- `cars-en-route-map.tsx`: On web shows a fallback UI ("Carte interactive - disponible sur mobile") + bus list; on native shows Leaflet/OpenStreetMap with bus markers
- All Animated calls use `useNativeDriver: false` for web compatibility
- useNativeDriver must be false on Expo Web for all Animated calls

## Auth Token Handling
In-memory tokenStore (auth.ts) — tokens lost on server restart.
AuthContext verifies token via GET /auth/me on startup; clears if invalid (forces re-login).
EXPO_PUBLIC_DOMAIN injected via workflow command (not .env file — already set in workflow startup).
