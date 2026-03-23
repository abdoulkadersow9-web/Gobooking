import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, getDashboardPath, useAuth } from "@/context/AuthContext";
import { BookingProvider } from "@/context/BookingContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ParcelProvider } from "@/context/ParcelContext";
import { setupNotificationListeners } from "@/utils/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/* ─── Rôle → segments dashboard autorisés ────────────────── */
const DASHBOARD_ROLES: Record<string, string[]> = {
  company:       ["compagnie", "company_admin"],
  agent:         ["agent"],
  "super-admin": ["admin", "super_admin"],
};

/* ─── Rôles qui n'ont accès QU'à leur dashboard (jamais /(tabs)) ─── */
const DASHBOARD_ONLY_ROLES = ["agent", "compagnie", "company_admin", "admin", "super_admin"];

/* ─── Routes spécialisées agent ─────────────────────────── */
const AGENT_ROUTES = ["embarquement", "reception-colis", "vente", "validation"];

/* ─── Routes publiques (pas besoin d'être connecté) ────────── */
const PUBLIC_ROOTS = ["index", "(auth)", "live-tracking", "cars-en-route-map", "offline"];

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const root = segments[0] as string | undefined;
    const isPublic = !root || PUBLIC_ROOTS.includes(root);

    /* Utilisateur non connecté → page de login si route protégée */
    if (!user) {
      if (!isPublic) {
        router.replace("/(auth)/login");
      }
      return;
    }

    /* Utilisateur connecté sur un écran d'auth → son dashboard */
    if (root === "(auth)") {
      router.replace(getDashboardPath(user.role, user.agentRole) as never);
      return;
    }

    /* Agent / Compagnie / Admin → ne peuvent PAS accéder à /(tabs) */
    if (root === "(tabs)" && DASHBOARD_ONLY_ROLES.includes(user.role)) {
      router.replace(getDashboardPath(user.role, user.agentRole) as never);
      return;
    }

    /* Routes agent spécialisées → réservées aux agents */
    if (root === "agent") {
      if (user.role !== "agent") {
        router.replace(getDashboardPath(user.role, user.agentRole) as never);
        return;
      }
    }

    /* Contrôle d'accès aux dashboards selon le rôle */
    if (root === "dashboard") {
      const requestedDash = segments[1] as string | undefined;
      if (requestedDash) {
        const allowedRoles = DASHBOARD_ROLES[requestedDash] ?? [];
        if (!allowedRoles.includes(user.role)) {
          router.replace(getDashboardPath(user.role, user.agentRole) as never);
          return;
        }
      }
    }

    /* Client → ne peut accéder à aucun dashboard */
    if (root === "dashboard" && !DASHBOARD_ONLY_ROLES.includes(user.role)) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
    <AuthGuard />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="(auth)"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="seats/[tripId]" options={{ headerShown: false }} />
      <Stack.Screen name="passengers" options={{ headerShown: false }} />
      <Stack.Screen name="payment" options={{ headerShown: false }} />
      <Stack.Screen name="confirmation/[bookingId]" options={{ headerShown: false }} />
      <Stack.Screen name="booking/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="parcel/send" options={{ headerShown: false }} />
      <Stack.Screen name="parcel/payment" options={{ headerShown: false }} />
      <Stack.Screen name="parcel/confirmation/[parcelId]" options={{ headerShown: false }} />
      <Stack.Screen name="parcel/tracking/[parcelId]" options={{ headerShown: false }} />
      <Stack.Screen name="parcel/track" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard/company" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard/agent" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard/super-admin" options={{ headerShown: false }} />
      <Stack.Screen name="agent/embarquement" options={{ headerShown: false }} />
      <Stack.Screen name="agent/reception-colis" options={{ headerShown: false }} />
      <Stack.Screen name="agent/vente" options={{ headerShown: false }} />
      <Stack.Screen name="agent/validation" options={{ headerShown: false }} />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (notification) => {
        console.log("[GoBooking] Notification reçue:", notification.request.content.title);
      },
      (response) => {
        console.log("[GoBooking] Notification tapée:", response.notification.request.content.title);
      }
    );
    return cleanup;
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <BookingProvider>
                <ParcelProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </ParcelProvider>
              </BookingProvider>
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
