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
1. Login / Registration (token-based auth with SHA256 password hashing)
2. Home screen with bus search (from/to/date/passengers)
3. Search results with sort options (price/duration/departure)
4. Trip detail with amenities, stops, policies
5. Seat selection (visual bus layout with available/booked/selected states)
6. Passenger information form
7. Payment page with card, UPI, wallet, netbanking methods
8. Booking confirmation with e-ticket view
9. User dashboard (Bookings tab + Profile tab)
10. Admin dashboard (Overview/Bookings/Trips/Users tabs)

## Project Structure
```
artifacts/
  gobooking/           # Expo mobile app
    app/
      (auth)/          # Login, Register
      (tabs)/          # Home, Bookings, Profile
      trip/[id]        # Trip details
      seats/[tripId]   # Seat selection
      passengers       # Passenger info
      payment          # Payment
      confirmation/[bookingId]  # Booking confirmed
      booking/[id]     # Booking detail
      admin            # Admin dashboard
    context/
      AuthContext      # Auth state + AsyncStorage
      BookingContext   # Multi-step booking flow
    utils/api.ts       # apiFetch utility
    constants/colors   # Blue theme tokens
  api-server/          # Express REST API
    src/routes/
      auth.ts          # POST /login, /register, GET /me
      trips.ts         # GET /search, /:id, /:id/seats
      bookings.ts      # POST /, GET /, /:id, POST /:id/cancel
      admin.ts         # GET /stats, /bookings, /trips, /users
      index.ts         # Route aggregator

lib/
  db/                  # Shared Drizzle schema + db client
    src/schema/
      users.ts
      trips.ts
      seats.ts
      bookings.ts
```

## Demo Accounts
- Admin: admin@gobooking.com / admin123
- User: user@gobooking.com / user123

## API Base URL
The Expo app reads `EXPO_PUBLIC_DOMAIN` to build the API URL: `https://{domain}/api`

## Database
PostgreSQL via Replit Database. Schema pushed with `pnpm --filter @workspace/db exec drizzle-kit push`.
Seeded 8 trips across popular US routes.
