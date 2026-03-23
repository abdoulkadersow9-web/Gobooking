import { router } from "expo-router";
import { useEffect } from "react";

export default function AdminDashboard() {
  useEffect(() => {
    router.replace("/dashboard/super-admin");
  }, []);
  return null;
}
