import { router } from "expo-router";
import { useEffect } from "react";

export default function ClientHome() {
  useEffect(() => {
    router.replace("/(tabs)");
  }, []);
  return null;
}
