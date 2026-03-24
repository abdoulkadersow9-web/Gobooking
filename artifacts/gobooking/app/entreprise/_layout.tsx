import { router, Stack, useSegments } from "expo-router";
import React, { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";

const ALLOWED = ["compagnie", "company_admin"];

export default function EntrepriseLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    if (!ALLOWED.includes(user.role)) {
      router.replace("/(auth)/login");
    }
  }, [user, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="reservations" />
      <Stack.Screen name="trajets" />
      <Stack.Screen name="colis" />
      <Stack.Screen name="live-tracking" />
      <Stack.Screen name="alertes" />
      <Stack.Screen name="analytiques" />
      <Stack.Screen name="sms" />
      <Stack.Screen name="marketing" />
      <Stack.Screen name="agences" />
      <Stack.Screen name="routes" />
      <Stack.Screen name="buses" />
      <Stack.Screen name="embarquement" />
      <Stack.Screen name="colis-historique" />
      <Stack.Screen name="avis" />
      <Stack.Screen name="bus-suivi" />
      <Stack.Screen name="maintenance-bus" />
      <Stack.Screen name="carburant" />
      <Stack.Screen name="bus-agents" />
      <Stack.Screen name="agents" />
      <Stack.Screen name="rentabilite" />
      <Stack.Screen name="comparaison" />
    </Stack>
  );
}
