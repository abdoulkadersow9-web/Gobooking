import { db, tripsTable, seatsTable } from "@workspace/db";

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const NEW_ROUTES = [
  // Abidjan → San Pedro
  {
    from: "Abidjan",
    to: "San Pedro",
    departureTime: "06:00",
    arrivalTime: "10:00",
    date: "2026-03-20",
    price: 3500,
    busType: "Premium",
    busName: "UTB Côtière",
    totalSeats: 44,
    duration: "4h",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "San Pedro",
    departureTime: "09:00",
    arrivalTime: "13:00",
    date: "2026-03-20",
    price: 2800,
    busType: "Standard",
    busName: "CTN Sud Express",
    totalSeats: 50,
    duration: "4h",
    amenities: ["AC"],
    stops: [{ name: "Sassandra", time: "11:30" }],
    policies: ["Pas d'annulation après réservation"],
  },
  {
    from: "Abidjan",
    to: "San Pedro",
    departureTime: "14:00",
    arrivalTime: "18:00",
    date: "2026-03-20",
    price: 2800,
    busType: "Standard",
    busName: "TCV Littoral",
    totalSeats: 44,
    duration: "4h",
    amenities: ["AC", "WiFi"],
    stops: [],
    policies: ["Annulation gratuite jusqu'à 12h avant"],
  },
  {
    from: "Abidjan",
    to: "San Pedro",
    departureTime: "06:00",
    arrivalTime: "10:00",
    date: "2026-03-21",
    price: 3500,
    busType: "Premium",
    busName: "UTB Côtière",
    totalSeats: 44,
    duration: "4h",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "San Pedro",
    departureTime: "09:00",
    arrivalTime: "13:00",
    date: "2026-03-22",
    price: 2800,
    busType: "Standard",
    busName: "CTN Sud Express",
    totalSeats: 50,
    duration: "4h",
    amenities: ["AC"],
    stops: [{ name: "Sassandra", time: "11:30" }],
    policies: ["Pas d'annulation après réservation"],
  },

  // Abidjan → Daloa
  {
    from: "Abidjan",
    to: "Daloa",
    departureTime: "07:00",
    arrivalTime: "12:00",
    date: "2026-03-20",
    price: 4000,
    busType: "Premium",
    busName: "STIF Centre-Ouest",
    totalSeats: 40,
    duration: "5h",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [{ name: "Tiassalé", time: "09:00" }],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "Daloa",
    departureTime: "10:00",
    arrivalTime: "15:00",
    date: "2026-03-20",
    price: 3200,
    busType: "Standard",
    busName: "CTN Ouest",
    totalSeats: 50,
    duration: "5h",
    amenities: ["AC"],
    stops: [],
    policies: ["Pas d'annulation"],
  },
  {
    from: "Abidjan",
    to: "Daloa",
    departureTime: "13:00",
    arrivalTime: "18:00",
    date: "2026-03-20",
    price: 3200,
    busType: "Standard",
    busName: "TCV Midland",
    totalSeats: 44,
    duration: "5h",
    amenities: ["AC", "WiFi"],
    stops: [{ name: "Sinfra", time: "16:30" }],
    policies: ["Annulation gratuite jusqu'à 12h avant"],
  },
  {
    from: "Abidjan",
    to: "Daloa",
    departureTime: "07:00",
    arrivalTime: "12:00",
    date: "2026-03-21",
    price: 4000,
    busType: "Premium",
    busName: "STIF Centre-Ouest",
    totalSeats: 40,
    duration: "5h",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [{ name: "Tiassalé", time: "09:00" }],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "Daloa",
    departureTime: "10:00",
    arrivalTime: "15:00",
    date: "2026-03-22",
    price: 3200,
    busType: "Standard",
    busName: "CTN Ouest",
    totalSeats: 50,
    duration: "5h",
    amenities: ["AC"],
    stops: [],
    policies: ["Pas d'annulation"],
  },

  // San Pedro → Abidjan
  {
    from: "San Pedro",
    to: "Abidjan",
    departureTime: "05:30",
    arrivalTime: "09:30",
    date: "2026-03-20",
    price: 3500,
    busType: "Premium",
    busName: "UTB Côtière",
    totalSeats: 44,
    duration: "4h",
    amenities: ["AC", "WiFi", "Charging"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "San Pedro",
    to: "Abidjan",
    departureTime: "09:00",
    arrivalTime: "13:00",
    date: "2026-03-20",
    price: 2800,
    busType: "Standard",
    busName: "CTN Sud Express",
    totalSeats: 50,
    duration: "4h",
    amenities: ["AC"],
    stops: [{ name: "Sassandra", time: "10:30" }],
    policies: ["Pas d'annulation"],
  },
  {
    from: "San Pedro",
    to: "Abidjan",
    departureTime: "05:30",
    arrivalTime: "09:30",
    date: "2026-03-21",
    price: 3500,
    busType: "Premium",
    busName: "UTB Côtière",
    totalSeats: 44,
    duration: "4h",
    amenities: ["AC", "WiFi", "Charging"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },

  // Daloa → Abidjan
  {
    from: "Daloa",
    to: "Abidjan",
    departureTime: "06:00",
    arrivalTime: "11:00",
    date: "2026-03-20",
    price: 4000,
    busType: "Premium",
    busName: "STIF Centre-Ouest",
    totalSeats: 40,
    duration: "5h",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [{ name: "Tiassalé", time: "09:00" }],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Daloa",
    to: "Abidjan",
    departureTime: "09:00",
    arrivalTime: "14:00",
    date: "2026-03-20",
    price: 3200,
    busType: "Standard",
    busName: "CTN Ouest",
    totalSeats: 50,
    duration: "5h",
    amenities: ["AC"],
    stops: [],
    policies: ["Pas d'annulation"],
  },
  {
    from: "Daloa",
    to: "Abidjan",
    departureTime: "06:00",
    arrivalTime: "11:00",
    date: "2026-03-21",
    price: 4000,
    busType: "Premium",
    busName: "STIF Centre-Ouest",
    totalSeats: 40,
    duration: "5h",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [{ name: "Tiassalé", time: "09:00" }],
    policies: ["Annulation gratuite 24h avant le départ"],
  },

  // Bouaké → Abidjan
  {
    from: "Bouaké",
    to: "Abidjan",
    departureTime: "06:00",
    arrivalTime: "11:30",
    date: "2026-03-20",
    price: 4500,
    busType: "Premium",
    busName: "UTB Express",
    totalSeats: 44,
    duration: "5h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [{ name: "Yamoussoukro", time: "08:00" }],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Bouaké",
    to: "Abidjan",
    departureTime: "10:00",
    arrivalTime: "15:30",
    date: "2026-03-20",
    price: 3500,
    busType: "Standard",
    busName: "CTN Voyage",
    totalSeats: 50,
    duration: "5h 30m",
    amenities: ["AC", "WiFi"],
    stops: [],
    policies: ["Pas d'annulation après réservation"],
  },
  {
    from: "Bouaké",
    to: "Abidjan",
    departureTime: "06:00",
    arrivalTime: "11:30",
    date: "2026-03-21",
    price: 4500,
    busType: "Premium",
    busName: "UTB Express",
    totalSeats: 44,
    duration: "5h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [{ name: "Yamoussoukro", time: "08:00" }],
    policies: ["Annulation gratuite 24h avant le départ"],
  },

  // Korhogo → Abidjan
  {
    from: "Korhogo",
    to: "Abidjan",
    departureTime: "05:00",
    arrivalTime: "14:00",
    date: "2026-03-20",
    price: 7500,
    busType: "Premium",
    busName: "UTB Grand Sud",
    totalSeats: 44,
    duration: "9h",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Blanket"],
    stops: [{ name: "Bouaké", time: "08:30" }, { name: "Yamoussoukro", time: "11:00" }],
    policies: ["Annulation gratuite 48h avant le départ"],
  },
  {
    from: "Korhogo",
    to: "Abidjan",
    departureTime: "06:00",
    arrivalTime: "15:00",
    date: "2026-03-20",
    price: 6000,
    busType: "Standard",
    busName: "TCV Sud Express",
    totalSeats: 50,
    duration: "9h",
    amenities: ["AC", "WiFi"],
    stops: [{ name: "Bouaké", time: "09:30" }],
    policies: ["Pas d'annulation après réservation"],
  },
  {
    from: "Korhogo",
    to: "Abidjan",
    departureTime: "05:00",
    arrivalTime: "14:00",
    date: "2026-03-21",
    price: 7500,
    busType: "Premium",
    busName: "UTB Grand Sud",
    totalSeats: 44,
    duration: "9h",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Blanket"],
    stops: [{ name: "Bouaké", time: "08:30" }, { name: "Yamoussoukro", time: "11:00" }],
    policies: ["Annulation gratuite 48h avant le départ"],
  },
];

async function seedCI2() {
  console.log("Seeding San Pedro, Daloa and return routes...");

  try {
    for (const tripData of NEW_ROUTES) {
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

      const seatsPerRow = 4;
      const totalRows = Math.ceil(tripData.totalSeats / seatsPerRow);

      for (let row = 1; row <= totalRows; row++) {
        for (let col = 1; col <= 4; col++) {
          const seatNum = (row - 1) * 4 + col;
          if (seatNum > tripData.totalSeats) break;

          const seatLetter = ["A", "B", "C", "D"][col - 1];
          const type = col === 1 || col === 4 ? "window" : "aisle";
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

          await new Promise((r) => setTimeout(r, 1));
        }
      }

      console.log(`Seeded: ${tripData.from} → ${tripData.to} | ${tripData.busName} | ${tripData.date}`);
    }

    console.log(`\nDone! Seeded ${NEW_ROUTES.length} additional CI routes.`);
  } catch (err) {
    console.error("Seed error:", err);
    throw err;
  }
}

seedCI2().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
