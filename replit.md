# GoBooking - Bus Ticket Booking App

## Overview
GoBooking is a full-stack mobile bus ticket booking application designed to streamline bus travel. It connects passengers with bus operators, facilitating ticket purchases and parcel deliveries. The platform aims to modernize inter-city travel, enhance user convenience, and provide robust management tools for transport companies and agents. Key capabilities include real-time bus search, seat selection, secure payment processing, parcel tracking, and role-based dashboards for different user types.

## User Preferences
Iterative development. Detailed explanations. Mobile icons: Ionicons or Feather ONLY. Admin web: lucide-react ONLY. API port: 8080. All routes under `/api`. Password hash: SHA-256 `password + "gobooking_salt_2024"`. Token pattern: `const { user, token: authToken } = useAuth(); const token = authToken ?? "";`.

## System Architecture

### Frontend
- **Framework**: Expo React Native with Expo Router for file-based routing.
- **Language**: TypeScript.
- **State Management**: Uses `@tanstack/react-query` for data fetching and caching.
- **Authentication**: Token-based authentication with `AsyncStorage` for persistence.
- **UI/UX Design**:
    - **Theme**: Vibrant royal blue (`#1650D0`, `#0F3DB8`, `#EEF4FF`) primary, orange accent (`#F97316`). 3-stop gradient headers, blue-tinted card shadows, orange gradient search buttons. Agent Role colors: amber for company, teal for agent, purple for super admin.
    - **Typography**: Inter font family.
    - **Components**: Clean, card-based UI inspired by Airbnb/Coinbase, utilizing `expo-linear-gradient`, `expo-haptics`, `expo-blur` for enhanced user experience.
    - **Navigation**: Full-screen modals for agent en-route actions, replacing a previous fullscreen system.
- **Features**:
    - **Dynamic En-Route Boarding**: Passengers can request to board a moving bus via a live map, with agent acceptance and QR code generation.
    - **Offline Mode**: Supports offline operations for agent tasks (boarding, sales, parcel handling) with queuing and synchronization mechanisms using `@react-native-community/netinfo`.
    - **Animated Splash Screen**: Custom animated splash screen at app startup.
    - **Functional Robustness** (added 2026-03-28): Network error banners in Bookings + Colis tabs (tap to retry), `useFocusEffect` auto-refresh when returning to a tab, Toast notification system (`components/Toast.tsx` + `useToast` hook), step-specific validation hints in the Parcel send form (shown only when Next is disabled), silent `catch {}` blocks replaced with proper error state management.
    - **Finition Produit v3** (added 2026-03-28): `suivi.tsx` — load error retry screen (3 tries, exponential backoff, visual retry UI); cockpit sync row upgraded (animated flux dot, cleaner tick labels); `route.tsx` — linkedBanner transformed into live surveillance dashboard (dark panel #052E16, animated LIVE dot, frame counter, 4-bar signal meter, HLS badge, TDC footer); header `paddingVertical` 11→14 (matches all other dashboards); logoutBtn 34→36 (matches suivi.tsx); `dashboard/agent.tsx` — `textShadow*` deprecation removed; `suivi.tsx`+`route.tsx` — `boxShadow` web fallback on statCard and connBtn; `Platform` import added to suivi.tsx.

### Backend
- **Framework**: Express.js API server.
- **ORM**: Drizzle ORM with PostgreSQL database.
- **Monorepo**: Managed with `pnpm workspace`.
- **Security**:
    - **Headers**: `helmet.js` for security headers.
    - **Rate Limiting**: Global and specific rate limits for login and registration endpoints.
    - **Authentication & Authorization**: Centralized middleware (`requireAuth`, `requireRole`, `requireSelf`) enforcing role-based access control (client, agent, company admin, super admin) and data isolation (e.g., `companyId` filtering).
    - **Session Persistence**: `PersistentTokenStore` in `auth.ts` — tokens stored in PostgreSQL `sessions` table, loaded into in-memory Map on startup. Survives server restarts/hot-reloads. `POST /auth/logout` invalidates token server-side. Client `AuthContext.logout()` calls server logout + clears AsyncStorage.
    - **Audit Logging**: `PERMISSION_DENIED` violations are logged.
    - **Payment Verification**: Server-side verification of payment transactions.
    - **Account Status**: Blocks inactive accounts.

### Data Model & Features
- **Bus Ticket Booking**: Comprehensive flow from search, seat selection (with `guichet_seats` and `online_seats` separation), passenger info, payment, to e-ticket confirmation.
- **Parcel Delivery**:
    - **Standard Parcels**: Send, track, real-time status updates.
    - **Remote Parcels**: Client-initiated parcel requests with photo upload, agent validation, and optional home delivery.
    - **Baggage Review**: For agents to validate passenger baggage, including photo viewing.
- **Agent System**:
    - **Roles**: `agent_ticket` (sales), `agent_embarquement` (boarding), `agent_colis` (parcel handling), `logistique`, `route`, `suivi`, `agent_reservation`, `bagage` (Module 2), `validation_depart` (Module 3).
    - **Module 2 — Agent Bagage**: `bagage_items` table; 5 API endpoints `/agent/bagage/*`; 4-step flow (departures → passenger lookup → form → QR ticket); color `#92400E`.
    - **Module 3 — Agent Validation Départ**: `departure-validation.tsx`; 4 API endpoints `/agent/validation-depart/*`; full bordereau (passengers, absents, bagages + photos, colis + photos, expenses); VALIDATE button → trips.status='en_route', colis→en_transit, push notifications; color `#4338CA` indigo.
    - **Module 4 — Bordereau Auto PDF**: `utils/bordereau-pdf.ts`; 2 HTML templates; `generateBordereauEntreprise` (full amounts) + `generateBordereauRoute` (no amounts); expo-print.printToFileAsync → expo-sharing.shareAsync; integrated into departure-validation.tsx; 2 PDF buttons appear after validation.
    - **Module 5 — Impression Départ**: Integrated INTO `tickets.tsx` as 3rd tab "Impression" (no new role, no new page). Shares state/context with existing agent_ticket. Fetches trips via `/agent/validation-depart/trips`, detail via `/agent/validation-depart/trip/:id`; adds expenses (péage, ration, carburant, entretien, autre) via Modal → POST `/agent/validation-depart/expenses` → auto-visible on validation bordereau; prints Route PDF (NO amounts) via expo-print + expo-sharing; same amber color scheme as Agent Guichet.
    - **Multi-agences Transit**: When a bus is en_route, destination-city agents can take over the same trip. `departure-validation.tsx` shows 2 sections: "Départs à valider" (pending) and "Trajets en transit" (en_route). Tapping an en_route trip shows a "Prendre en charge" CTA → calls `POST /agent/trips/:tripId/transit-join` → records agent in `trip_agents` with their agence info → allows adding passengers/bagages/colis + expenses. All data links to the SAME trip → syncs to bordereau, historique, company dashboard, admin. `vente.tsx` shows "En transit" badge for en_route trips and filters to today/tomorrow only.
    - **Demo accounts** (password `test123`): `agent@test.com`, `embarquement@test.com`, `reservation@test.com`, `colis@test.com`, `logistique@test.com`, `suivi@test.com`, `compagnie@test.com`, `admin@test.com`, `bagage@test.com`, `validepart@test.com`.
    - **Dashboards**: Role-specific dashboards with dedicated functionalities and UI themes.
    - **Reporting**: System for agents to submit various types of reports (incidents, problems, suggestions).
- **Company Management**: Dashboards for company administrators to manage buses, routes, agents, and view analytics.
- **Super Admin**: Global platform oversight, managing companies, users, cities, and financial analytics including a commission and invoicing system.
- **Notifications**: In-app notification system with filtering. Module 6 adds real-time polling alerts: pre-departure alerts (≤5 min before departure, pushed by scheduler every minute) and validation_complete notifications, displayed via `AlertBanner` in `home.tsx`, `tickets.tsx`, and `departure-validation.tsx`. Live trip stats (boarding, baggage, parcels, expenses) refresh every 30s in the Impression tab via `useTripLive`. New endpoints: `GET /agent/realtime/alerts`, `GET /agent/realtime/trip/:tripId`.
- **Intelligence système (Chef d'Agence)**: `chef-home.tsx` + `chef-trips.tsx` — tableau de bord chef avec smart locks (canEdit/canCancel/canTransfer/canWaypoint selon statut), 5 états de trajet (scheduled/boarding/en_route/arrived/completed), transfert d'urgence, gestion des escales.
- **Descente par passager**: Lors d'une escale (`POST /agent/chef/trips/:tripId/waypoint`), seuls les passagers dont `alighting_city` correspond à l'escale sont marqués `alighted` et leurs sièges libérés en temps réel. `boarding_city` + `alighting_city` sauvegardés à la création de réservation.
- **Visualisation des sièges**: `GET /agent/chef/trips/:tripId/seats` — grille 2D avec statut libre/occupé/libéré/réservé, groupage par ville de descente, stats. Modal carte des sièges dans `chef-trips.tsx` (vert=libre, rouge=occupé, jaune=réservé, violet=libéré).
- **Passagers en temps réel**: `GET /agent/chef/trips/:tripId/passengers` — passagers groupés par ville de descente, badge à bord/descendu.
- **Suivi bus temps réel**: champ `intelligence` JSONB sur trips mis à jour par le scheduler toutes les 30s (currentCity, nextStop, progressPct, allStops). Affiché dans chef-home et chef-trips (barre de progression + timeline des arrêts).
- **Vente guichet améliorée** (`vente.tsx`): sélection ville de montée/descente via chips horizontales (affiché seulement si le trajet a des escales), auto-assignation de siège lors de la vente, affichage du siège attribué sur le ticket de confirmation. Endpoint `/agent/trips` retourne `stops` + `allCities`.
- **Chef test**: `chef.test@gobooking.ci` / `chef1234` — compagnie 1773730836056semnyn, agence Plateau Abidjan. Trajets de simulation: `trip-sim-001` (Abidjan→Bouaké, escales Yamoussoukro+Tiébissou), `trip-sim-002` (Abidjan→Yamoussoukro), `trip-sim-003` (Bouaké→Korhogo).
- **Grille tarifaire automatique (Phase 1)**: Table `company_pricing` (id, company_id, from_city, to_city, trip_type, price, created_at, updated_at). Colonne `trip_type` ajoutée sur `trips` (standard/vip/vip_plus, défaut standard). API: `GET /company/pricing`, `GET /company/pricing/lookup?from=X&to=Y&type=Z`, `POST /company/pricing`, `DELETE /company/pricing/:id`. Logique lookup: tarif compagnie direct → symétrique → grille globale×multiplicateur (VIP=×1.4, VIP+=×1.8). Formulaire chef-trips.tsx: sélecteur de type (Standard/VIP/VIP+), auto-fetch prix au changement de from/to/type avec indicateur source (badge vert "Grille compagnie" ou jaune "Grille globale"). Paramètres mobile: nouvelle section "Grille Tarifaire" + modal d'ajout avec ville départ/arrivée/type/prix. Agent.ts chef/trips POST: accepte `tripType`, auto-lookup si prix absent/0.
- **Payment & Currency**: Supports various mobile money (Orange Money, MTN MoMo, Wave) and card payments (Visa/Mastercard) in FCFA.

### Project Structure
- `artifacts/gobooking/`: Expo mobile app.
- `artifacts/api-server/`: Express REST API.
- `lib/db/`: Shared Drizzle schema and database client.

## External Dependencies

- **Database**: PostgreSQL (via Replit Database)
- **Payment Gateways**: Orange Money, MTN MoMo, Wave, Visa/Mastercard (integrated for payment processing, CinetPay for verification)
- **Mapping**: Leaflet/OpenStreetMap (for agent en-route map on native)
- **Image Upload**: Firebase (for parcel photo uploads)
- **QR Code Generation**: `api.qrserver.com` (for dynamic boarding QR codes)
- **Networking**: `@react-native-community/netinfo` (for offline mode detection)
- **Security**: `helmet.js` (for HTTP header security)
- **Fonts**: `@expo-google-fonts/inter`
- **Other Expo Modules**: `expo-router`, `expo-linear-gradient`, `expo-haptics`, `expo-blur`