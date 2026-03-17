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
14. **Company Dashboard** (bus fleet, routes, colis, agents management — blue theme)
15. **Agent Dashboard** (mission info, passenger boarding validation, parcel pickup/transit/delivery — green theme)
16. **Super Admin Dashboard** (global stats, companies, users, cities, payment breakdown — purple theme)

## Role-based Dashboards
- `/dashboard/company` — Company Admin: fleet, routes, parcels, agents
- `/dashboard/agent` — Agent: daily mission, passenger boarding, parcel actions
- `/dashboard/super-admin` — Super Admin: global platform view, 42.9M FCFA revenue, 8 companies, 1248 users
- All 3 show demo data unauthenticated; fetch real API data when logged in with correct role
- Accessible from Profile tab → "Tableaux de bord" section

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
      admin            # Legacy admin dashboard
      parcel/          # Parcel send/track/confirmation/tracking
      dashboard/
        company.tsx    # Company dashboard (blue, #1A56DB)
        agent.tsx      # Agent dashboard (green, #059669)
        super-admin.tsx # Super admin dashboard (purple, #7C3AED)
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
      company.ts       # Company stats, buses, agents, routes
      agent.ts         # Agent boarding, parcel pickup/transit/deliver
      index.ts         # Route aggregator

lib/
  db/                  # Shared Drizzle schema + db client
    src/schema/
      index.ts         # users, trips, seats, bookings, parcels,
                       # companies, buses, agents, cities, payments, notifications
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
