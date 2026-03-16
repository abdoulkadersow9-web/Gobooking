/**
 * Bulk-generates trips for all major Ivory Coast routes
 * covering 2026-03-16 through 2026-05-14 (60 days)
 */
import { db, tripsTable, seatsTable } from "@workspace/db";

let counter = 0;
const generateId = () => {
  counter++;
  return `d${Date.now()}${counter.toString().padStart(5, "0")}`;
};

function dateRange(start: string, days: number): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  for (let i = 0; i < days; i++) {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + i);
    dates.push(copy.toISOString().split("T")[0]);
  }
  return dates;
}

const ROUTES = [
  {
    from: "Abidjan", to: "Bouaké", duration: "5h 30m",
    buses: [
      { time: ["06:00", "11:30"], name: "UTB Express",           type: "Standard", price: 3500, seats: 44, amenities: ["AC", "WiFi"] },
      { time: ["09:00", "14:30"], name: "CTN Voyage",            type: "Standard", price: 3500, seats: 40, amenities: ["AC", "WiFi"] },
      { time: ["12:00", "17:30"], name: "Sotra Express",         type: "Standard", price: 4000, seats: 38, amenities: ["AC", "WiFi", "Charging"] },
      { time: ["07:30", "13:00"], name: "STC Premium",           type: "Premium",  price: 5000, seats: 40, amenities: ["AC", "WiFi", "Charging", "Snacks"] },
      { time: ["11:00", "16:30"], name: "Air Côte d'Ivoire Bus", type: "Premium",  price: 6500, seats: 36, amenities: ["AC", "WiFi", "Charging", "Snacks", "Entertainment"] },
      { time: ["14:00", "19:30"], name: "TCV Confort",           type: "Standard", price: 3500, seats: 42, amenities: ["AC"] },
    ],
  },
  {
    from: "Abidjan", to: "Yamoussoukro", duration: "2h 30m",
    buses: [
      { time: ["06:30", "09:00"], name: "STIF Premium",            type: "Premium",  price: 2500, seats: 36, amenities: ["AC", "WiFi", "Charging"] },
      { time: ["08:00", "10:30"], name: "STC Confort",             type: "Premium",  price: 3000, seats: 40, amenities: ["AC", "WiFi"] },
      { time: ["10:00", "12:30"], name: "Sotra Express",           type: "Standard", price: 2000, seats: 38, amenities: ["AC", "WiFi"] },
      { time: ["12:00", "14:30"], name: "Air Côte d'Ivoire Bus",   type: "Premium",  price: 4500, seats: 36, amenities: ["AC", "WiFi", "Charging", "Snacks"] },
      { time: ["14:30", "17:00"], name: "CTN Voyage",              type: "Standard", price: 2000, seats: 40, amenities: ["AC"] },
    ],
  },
  {
    from: "Abidjan", to: "Korhogo", duration: "9h",
    buses: [
      { time: ["05:00", "14:00"], name: "UTB Grand Nord",          type: "Standard", price: 6500, seats: 44, amenities: ["AC", "WiFi"] },
      { time: ["05:30", "14:30"], name: "STC Grand Nord",          type: "Premium",  price: 8000, seats: 40, amenities: ["AC", "WiFi", "Charging", "Snacks"] },
      { time: ["06:00", "15:00"], name: "TCV Nord Express",        type: "Standard", price: 6000, seats: 42, amenities: ["AC"] },
      { time: ["07:00", "16:00"], name: "Air Côte d'Ivoire Bus",   type: "Premium",  price: 12000, seats: 36, amenities: ["AC", "WiFi", "Charging", "Snacks", "Entertainment"] },
    ],
  },
  {
    from: "Bouaké", to: "Korhogo", duration: "3h 30m",
    buses: [
      { time: ["07:00", "10:30"], name: "UTB Liaison",             type: "Standard", price: 2500, seats: 40, amenities: ["AC"] },
      { time: ["10:00", "13:30"], name: "CTN Centre-Nord",         type: "Standard", price: 2500, seats: 40, amenities: ["AC", "WiFi"] },
      { time: ["14:00", "17:30"], name: "STIF Liaison",            type: "Standard", price: 3000, seats: 36, amenities: ["AC", "WiFi"] },
    ],
  },
  {
    from: "San Pedro", to: "Abidjan", duration: "4h",
    buses: [
      { time: ["06:00", "10:00"], name: "UTB Côtière",             type: "Standard", price: 3500, seats: 44, amenities: ["AC"] },
      { time: ["09:00", "13:00"], name: "CTN Sud Express",         type: "Standard", price: 3000, seats: 40, amenities: ["AC", "WiFi"] },
      { time: ["13:00", "17:00"], name: "Sotra Express",           type: "Standard", price: 4000, seats: 38, amenities: ["AC", "WiFi", "Charging"] },
    ],
  },
  {
    from: "Abidjan", to: "San Pedro", duration: "4h",
    buses: [
      { time: ["06:00", "10:00"], name: "UTB Côtière",             type: "Standard", price: 3500, seats: 44, amenities: ["AC"] },
      { time: ["09:00", "13:00"], name: "CTN Sud Express",         type: "Standard", price: 2800, seats: 40, amenities: ["AC", "WiFi"] },
      { time: ["14:00", "18:00"], name: "TCV Littoral",            type: "Standard", price: 2800, seats: 42, amenities: ["AC"] },
    ],
  },
  {
    from: "Abidjan", to: "Daloa", duration: "5h",
    buses: [
      { time: ["07:00", "12:00"], name: "STIF Centre-Ouest",       type: "Standard", price: 4000, seats: 36, amenities: ["AC"] },
      { time: ["10:00", "15:00"], name: "CTN Ouest",               type: "Standard", price: 3200, seats: 40, amenities: ["AC", "WiFi"] },
      { time: ["13:00", "18:00"], name: "TCV Midland",             type: "Standard", price: 3200, seats: 42, amenities: ["AC"] },
    ],
  },
  {
    from: "Yamoussoukro", to: "Abidjan", duration: "2h 30m",
    buses: [
      { time: ["07:00", "09:30"], name: "STIF Premium",            type: "Premium",  price: 2500, seats: 36, amenities: ["AC", "WiFi"] },
      { time: ["09:30", "12:00"], name: "Sotra Express",           type: "Standard", price: 2000, seats: 38, amenities: ["AC"] },
      { time: ["15:00", "17:30"], name: "CTN Voyage",              type: "Standard", price: 2000, seats: 40, amenities: ["AC", "WiFi"] },
    ],
  },
  {
    from: "Bouaké", to: "Abidjan", duration: "5h 30m",
    buses: [
      { time: ["06:00", "11:30"], name: "UTB Express",             type: "Standard", price: 3500, seats: 44, amenities: ["AC", "WiFi"] },
      { time: ["08:00", "13:30"], name: "Sotra Express",           type: "Standard", price: 4000, seats: 38, amenities: ["AC", "WiFi", "Charging"] },
      { time: ["13:00", "18:30"], name: "CTN Voyage",              type: "Standard", price: 3500, seats: 40, amenities: ["AC"] },
    ],
  },
];

const SEAT_LETTERS = ["A", "B", "C", "D"];

async function seedDates() {
  const dates = dateRange("2026-03-16", 60);
  console.log(`Building bulk data for ${dates.length} days across ${ROUTES.length} routes...`);

  const tripRows: (typeof tripsTable.$inferInsert)[] = [];
  const seatMap: { tripId: string; seats: number; price: number }[] = [];

  for (const date of dates) {
    for (const route of ROUTES) {
      for (const bus of route.buses) {
        const tripId = generateId();
        tripRows.push({
          id: tripId,
          from: route.from,
          to: route.to,
          departureTime: bus.time[0],
          arrivalTime: bus.time[1],
          date,
          price: bus.price,
          busType: bus.type,
          busName: bus.name,
          totalSeats: bus.seats,
          duration: route.duration,
          amenities: bus.amenities,
          stops: [],
          policies: ["Annulation gratuite 24h avant le départ"],
        });
        seatMap.push({ tripId, seats: bus.seats, price: bus.price });
      }
    }
  }

  console.log(`Inserting ${tripRows.length} trips in chunks...`);
  const TRIP_CHUNK = 200;
  for (let i = 0; i < tripRows.length; i += TRIP_CHUNK) {
    await db.insert(tripsTable).values(tripRows.slice(i, i + TRIP_CHUNK));
    process.stdout.write(`\r  trips: ${Math.min(i + TRIP_CHUNK, tripRows.length)}/${tripRows.length}`);
  }
  console.log("\nTrips done. Building seats...");

  const seatRows: (typeof seatsTable.$inferInsert)[] = [];
  for (const { tripId, seats, price } of seatMap) {
    const totalRows = Math.ceil(seats / 4);
    for (let row = 1; row <= totalRows; row++) {
      for (let col = 1; col <= 4; col++) {
        if ((row - 1) * 4 + col > seats) break;
        seatRows.push({
          id: generateId(),
          tripId,
          number: `${row}${SEAT_LETTERS[col - 1]}`,
          row,
          column: col,
          type: col === 1 || col === 4 ? "window" : "aisle",
          status: Math.random() < 0.2 ? "booked" : "available",
          price,
        });
      }
    }
  }

  console.log(`Inserting ${seatRows.length} seats in chunks...`);
  const SEAT_CHUNK = 500;
  for (let i = 0; i < seatRows.length; i += SEAT_CHUNK) {
    await db.insert(seatsTable).values(seatRows.slice(i, i + SEAT_CHUNK));
    if (i % 5000 === 0) process.stdout.write(`\r  seats: ${i}/${seatRows.length}`);
  }
  console.log(`\r  seats: ${seatRows.length}/${seatRows.length}`);
  console.log(`\nAll done! ${tripRows.length} trips, ${seatRows.length} seats.`);
}

seedDates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
