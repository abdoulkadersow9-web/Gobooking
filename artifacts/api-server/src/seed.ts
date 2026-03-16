import { db, tripsTable, seatsTable, usersTable } from "@workspace/db";
import crypto from "crypto";

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "gobooking_salt_2024").digest("hex");
}

const TRIPS = [
  {
    from: "New York",
    to: "Boston",
    departureTime: "08:00",
    arrivalTime: "12:30",
    date: "2026-03-20",
    price: 35,
    busType: "Premium",
    busName: "Express Coach 101",
    totalSeats: 40,
    duration: "4h 30m",
    amenities: ["WiFi", "AC", "Charging", "Snacks"],
    stops: [{ name: "Hartford", time: "10:00" }],
    policies: ["Free cancellation up to 24h before departure", "No refunds within 24 hours"],
  },
  {
    from: "New York",
    to: "Boston",
    departureTime: "14:00",
    arrivalTime: "18:30",
    date: "2026-03-20",
    price: 28,
    busType: "Standard",
    busName: "Comfort Coach 205",
    totalSeats: 44,
    duration: "4h 30m",
    amenities: ["AC", "WiFi"],
    stops: [],
    policies: ["No cancellation after booking"],
  },
  {
    from: "Los Angeles",
    to: "San Francisco",
    departureTime: "07:00",
    arrivalTime: "13:00",
    date: "2026-03-20",
    price: 28,
    busType: "Standard",
    busName: "Pacific Liner 301",
    totalSeats: 44,
    duration: "6h",
    amenities: ["AC", "WiFi", "Charging"],
    stops: [{ name: "Bakersfield", time: "10:00" }],
    policies: ["Free cancellation up to 48h before departure"],
  },
  {
    from: "Los Angeles",
    to: "San Francisco",
    departureTime: "10:00",
    arrivalTime: "16:00",
    date: "2026-03-20",
    price: 35,
    busType: "Premium",
    busName: "Golden State Express",
    totalSeats: 36,
    duration: "6h",
    amenities: ["WiFi", "AC", "Charging", "Snacks", "Blanket"],
    stops: [],
    policies: ["Cancellation allowed up to 24h", "Seat change allowed once"],
  },
  {
    from: "Chicago",
    to: "Detroit",
    departureTime: "09:00",
    arrivalTime: "13:00",
    date: "2026-03-20",
    price: 22,
    busType: "Standard",
    busName: "Midwest Coach 401",
    totalSeats: 44,
    duration: "4h",
    amenities: ["AC", "WiFi"],
    stops: [],
    policies: ["No cancellations"],
  },
  {
    from: "Miami",
    to: "Orlando",
    departureTime: "08:30",
    arrivalTime: "12:00",
    date: "2026-03-20",
    price: 18,
    busType: "Standard",
    busName: "Sunshine Express 501",
    totalSeats: 50,
    duration: "3h 30m",
    amenities: ["AC", "WiFi"],
    stops: [],
    policies: ["Free cancellation up to 12h before departure"],
  },
  {
    from: "New York",
    to: "Boston",
    departureTime: "08:00",
    arrivalTime: "12:30",
    date: "2026-03-21",
    price: 35,
    busType: "Premium",
    busName: "Express Coach 101",
    totalSeats: 40,
    duration: "4h 30m",
    amenities: ["WiFi", "AC", "Charging", "Snacks"],
    stops: [{ name: "Hartford", time: "10:00" }],
    policies: ["Free cancellation up to 24h before departure"],
  },
  {
    from: "Seattle",
    to: "Portland",
    departureTime: "09:00",
    arrivalTime: "12:00",
    date: "2026-03-20",
    price: 20,
    busType: "Standard",
    busName: "Northwest Shuttle 601",
    totalSeats: 44,
    duration: "3h",
    amenities: ["AC", "WiFi", "Charging"],
    stops: [],
    policies: ["Free cancellation up to 24h"],
  },
];

async function seed() {
  console.log("Starting seed...");

  try {
    // Seed admin user
    const adminEmail = "admin@gobooking.com";
    const existingAdmin = await db.select().from(usersTable).limit(1);
    
    if (existingAdmin.length === 0) {
      await db.insert(usersTable).values({
        id: generateId(),
        name: "Admin User",
        email: adminEmail,
        phone: "+1 (555) 000-0000",
        passwordHash: hashPassword("admin123"),
        role: "admin",
      }).onConflictDoNothing();
      
      await db.insert(usersTable).values({
        id: generateId(),
        name: "John Smith",
        email: "user@gobooking.com",
        phone: "+1 (555) 123-4567",
        passwordHash: hashPassword("user123"),
        role: "user",
      }).onConflictDoNothing();
      
      console.log("Seeded users: admin@gobooking.com / admin123, user@gobooking.com / user123");
    } else {
      console.log("Users already seeded, skipping...");
    }

    // Seed trips
    const existingTrips = await db.select().from(tripsTable).limit(1);
    if (existingTrips.length === 0) {
      for (const tripData of TRIPS) {
        const tripId = generateId();
        await db.insert(tripsTable).values({
          id: tripId,
          from: tripData.from,
          to: tripData.to,
          departureTime: tripData.departureTime,
          arrivalTime: tripData.arrivalTime,
          date: tripData.date,
          price: tripData.price,
          busType: tripData.busType,
          busName: tripData.busName,
          totalSeats: tripData.totalSeats,
          duration: tripData.duration,
          amenities: tripData.amenities,
          stops: tripData.stops,
          policies: tripData.policies,
        });

        // Generate seats for each trip
        const seatsPerRow = 4;
        const totalRows = Math.ceil(tripData.totalSeats / seatsPerRow);
        
        for (let row = 1; row <= totalRows; row++) {
          for (let col = 1; col <= 4; col++) {
            const seatNum = (row - 1) * 4 + col;
            if (seatNum > tripData.totalSeats) break;
            
            const seatLetter = ["A", "B", "C", "D"][col - 1];
            const type = col === 1 || col === 4 ? "window" : "aisle";
            
            // Randomly book some seats (about 30%)
            const isBooked = Math.random() < 0.3;
            
            await db.insert(seatsTable).values({
              id: generateId(),
              tripId,
              number: `${row}${seatLetter}`,
              row,
              column: col,
              type,
              status: isBooked ? "booked" : "available",
              price: tripData.price,
            });
            
            // Small delay to ensure unique IDs
            await new Promise((r) => setTimeout(r, 1));
          }
        }
        
        console.log(`Seeded trip: ${tripData.from} → ${tripData.to} on ${tripData.date}`);
      }
    } else {
      console.log("Trips already seeded, skipping...");
    }

    console.log("Seed complete!");
  } catch (err) {
    console.error("Seed error:", err);
    throw err;
  }
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
