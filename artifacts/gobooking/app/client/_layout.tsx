import { router, Stack, useSegments } from "expo-router";
import React, { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";

const ALLOWED = ["client", "user"];

export default function ClientLayout() {
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
      <Stack.Screen name="home" />
      <Stack.Screen name="reservation" />
      <Stack.Screen name="colis" />
      <Stack.Screen name="factures" />
      <Stack.Screen name="compagnies" />
      <Stack.Screen name="fidelite" />
    </Stack>
  );
}
