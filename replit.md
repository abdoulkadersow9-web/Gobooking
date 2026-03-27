# GoBooking - Bus Ticket Booking App

## Overview
GoBooking is a full-stack mobile bus ticket booking application designed to streamline bus travel. It connects passengers with bus operators, facilitating ticket purchases and parcel deliveries. The platform aims to modernize inter-city travel, enhance user convenience, and provide robust management tools for transport companies and agents. Key capabilities include real-time bus search, seat selection, secure payment processing, parcel tracking, and role-based dashboards for different user types.

## User Preferences
I want iterative development. I want to be asked before making major changes. I prefer detailed explanations. Do not make changes to the folder `Z`. Do not make changes to the file `Y`.

## System Architecture

### Frontend
- **Framework**: Expo React Native with Expo Router for file-based routing.
- **Language**: TypeScript.
- **State Management**: Uses `@tanstack/react-query` for data fetching and caching.
- **Authentication**: Token-based authentication with `AsyncStorage` for persistence.
- **UI/UX Design**:
    - **Theme**: Primarily blue (`#1A56DB`, `#0F3BA0`, `#EEF2FF`) with accent colors for different dashboards (amber for company, green for agent, purple for super admin).
    - **Typography**: Inter font family.
    - **Components**: Clean, card-based UI inspired by Airbnb/Coinbase, utilizing `expo-linear-gradient`, `expo-haptics`, `expo-blur` for enhanced user experience.
    - **Navigation**: Full-screen modals for agent en-route actions, replacing a previous fullscreen system.
- **Features**:
    - **Dynamic En-Route Boarding**: Passengers can request to board a moving bus via a live map, with agent acceptance and QR code generation.
    - **Offline Mode**: Supports offline operations for agent tasks (boarding, sales, parcel handling) with queuing and synchronization mechanisms using `@react-native-community/netinfo`.
    - **Animated Splash Screen**: Custom animated splash screen at app startup.

### Backend
- **Framework**: Express.js API server.
- **ORM**: Drizzle ORM with PostgreSQL database.
- **Monorepo**: Managed with `pnpm workspace`.
- **Security**:
    - **Headers**: `helmet.js` for security headers.
    - **Rate Limiting**: Global and specific rate limits for login and registration endpoints.
    - **Authentication & Authorization**: Centralized middleware (`requireAuth`, `requireRole`, `requireSelf`) enforcing role-based access control (client, agent, company admin, super admin) and data isolation (e.g., `companyId` filtering).
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
    - **Demo accounts** (password `test123`): `agent@test.com`, `embarquement@test.com`, `reservation@test.com`, `colis@test.com`, `logistique@test.com`, `suivi@test.com`, `compagnie@test.com`, `admin@test.com`, `bagage@test.com`, `validepart@test.com`.
    - **Dashboards**: Role-specific dashboards with dedicated functionalities and UI themes.
    - **Reporting**: System for agents to submit various types of reports (incidents, problems, suggestions).
- **Company Management**: Dashboards for company administrators to manage buses, routes, agents, and view analytics.
- **Super Admin**: Global platform oversight, managing companies, users, cities, and financial analytics including a commission and invoicing system.
- **Notifications**: In-app notification system with filtering. Module 6 adds real-time polling alerts: pre-departure alerts (≤5 min before departure, pushed by scheduler every minute) and validation_complete notifications, displayed via `AlertBanner` in `home.tsx`, `tickets.tsx`, and `departure-validation.tsx`. Live trip stats (boarding, baggage, parcels, expenses) refresh every 30s in the Impression tab via `useTripLive`. New endpoints: `GET /agent/realtime/alerts`, `GET /agent/realtime/trip/:tripId`.
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