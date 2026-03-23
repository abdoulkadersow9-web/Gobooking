import { router } from "expo-router";
import { useEffect } from "react";

export default function ClientReservation() {
  useEffect(() => {
    router.replace("/(tabs)/bookings");
  }, []);
  return null;
}
