import { db, tripsTable, seatsTable } from "@workspace/db";

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const STC_AIR_TRIPS = [
  // STC routes
  {
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "07:30",
    arrivalTime: "13:00",
    date: "2026-03-20",
    price: 5000,
    busType: "Premium",
    busName: "STC Premium",
    totalSeats: 40,
    duration: "5h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Blanket"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ", "Sièges inclinables"],
  },
  {
    from: "Abidjan",
    to: "Yamoussoukro",
    departureTime: "08:00",
    arrivalTime: "10:30",
    date: "2026-03-20",
    price: 3000,
    busType: "Premium",
    busName: "STC Confort",
    totalSeats: 40,
    duration: "2h 30m",
    amenities: ["AC", "WiFi", "Charging"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "San Pedro",
    departureTime: "07:30",
    arrivalTime: "11:30",
    date: "2026-03-20",
    price: 4000,
    busType: "Premium",
    busName: "STC Sud",
    totalSeats: 40,
    duration: "4h",
    amenities: ["AC", "WiFi"],
    stops: [],
    policies: ["Annulation gratuite 24h avant"],
  },
  {
    from: "Abidjan",
    to: "Korhogo",
    departureTime: "05:30",
    arrivalTime: "14:30",
    date: "2026-03-20",
    price: 8000,
    busType: "Premium",
    busName: "STC Grand Nord",
    totalSeats: 40,
    duration: "9h",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Blanket"],
    stops: [{ name: "Bouaké", time: "11:00" }],
    policies: ["Annulation gratuite 48h avant", "Repas inclus"],
  },
  {
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "07:30",
    arrivalTime: "13:00",
    date: "2026-03-21",
    price: 5000,
    busType: "Premium",
    busName: "STC Premium",
    totalSeats: 40,
    duration: "5h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Blanket"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "Yamoussoukro",
    departureTime: "08:00",
    arrivalTime: "10:30",
    date: "2026-03-21",
    price: 3000,
    busType: "Premium",
    busName: "STC Confort",
    totalSeats: 40,
    duration: "2h 30m",
    amenities: ["AC", "WiFi", "Charging"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },

  // Air Côte d'Ivoire Bus routes
  {
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "11:00",
    arrivalTime: "16:30",
    date: "2026-03-20",
    price: 6500,
    busType: "Premium",
    busName: "Air Côte d'Ivoire Bus",
    totalSeats: 36,
    duration: "5h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Entertainment"],
    stops: [],
    policies: ["Annulation gratuite 48h avant le départ", "Service hôtesse à bord"],
  },
  {
    from: "Abidjan",
    to: "Yamoussoukro",
    departureTime: "12:00",
    arrivalTime: "14:30",
    date: "2026-03-20",
    price: 4500,
    busType: "Premium",
    busName: "Air Côte d'Ivoire Bus",
    totalSeats: 36,
    duration: "2h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "San Pedro",
    departureTime: "10:00",
    arrivalTime: "14:00",
    date: "2026-03-20",
    price: 5500,
    busType: "Premium",
    busName: "Air Côte d'Ivoire Bus",
    totalSeats: 36,
    duration: "4h",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Entertainment"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ", "Snacks offerts"],
  },
  {
    from: "Abidjan",
    to: "Korhogo",
    departureTime: "07:00",
    arrivalTime: "16:00",
    date: "2026-03-20",
    price: 12000,
    busType: "Premium",
    busName: "Air Côte d'Ivoire Bus",
    totalSeats: 36,
    duration: "9h",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Entertainment", "Blanket"],
    stops: [{ name: "Yamoussoukro", time: "09:30" }, { name: "Bouaké", time: "12:00" }],
    policies: ["Annulation gratuite 48h avant", "Repas et boissons inclus", "Service premium"],
  },
  {
    from: "Abidjan",
    to: "Daloa",
    departureTime: "08:30",
    arrivalTime: "13:30",
    date: "2026-03-20",
    price: 5000,
    busType: "Premium",
    busName: "Air Côte d'Ivoire Bus",
    totalSeats: 36,
    duration: "5h",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "11:00",
    arrivalTime: "16:30",
    date: "2026-03-21",
    price: 6500,
    busType: "Premium",
    busName: "Air Côte d'Ivoire Bus",
    totalSeats: 36,
    duration: "5h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks", "Entertainment"],
    stops: [],
    policies: ["Annulation gratuite 48h avant le départ"],
  },
  {
    from: "Abidjan",
    to: "Yamoussoukro",
    departureTime: "12:00",
    arrivalTime: "14:30",
    date: "2026-03-21",
    price: 4500,
    busType: "Premium",
    busName: "Air Côte d'Ivoire Bus",
    totalSeats: 36,
    duration: "2h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    stops: [],
    policies: ["Annulation gratuite 24h avant le départ"],
  },
];

async function seedCI3() {
  console.log("Seeding STC and Air Côte d'Ivoire Bus routes...");

  try {
    for (const tripData of STC_AIR_TRIPS) {
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
          const isBooked = Math.random() < 0.25;

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

    console.log(`\nDone! Seeded ${STC_AIR_TRIPS.length} STC + Air CI routes.`);
  } catch (err) {
    console.error("Seed error:", err);
    throw err;
  }
}

seedCI3().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
