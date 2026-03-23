import { router } from "expo-router";
import { useEffect } from "react";

export default function ClientColis() {
  useEffect(() => {
    router.replace("/(tabs)/colis");
  }, []);
  return null;
}
