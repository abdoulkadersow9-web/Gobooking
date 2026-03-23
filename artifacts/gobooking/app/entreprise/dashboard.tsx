import { router } from "expo-router";
import { useEffect } from "react";

export default function EntrepriseDashboard() {
  useEffect(() => {
    router.replace("/dashboard/company");
  }, []);
  return null;
}
