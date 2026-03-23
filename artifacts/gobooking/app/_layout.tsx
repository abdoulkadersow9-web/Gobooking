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

/* ─── Rôles autorisés par groupe de routes ───────────────── */
const ROUTE_ROLES: Record<string, string[]> = {
  client:     ["client", "user"],
  entreprise: ["compagnie", "company_admin"],
  admin:      ["admin", "super_admin"],
};

/* ─── Rôles qui n'ont accès QU'à leur espace (jamais /(tabs)) ─── */
const DASHBOARD_ONLY_ROLES = ["agent", "compagnie", "company_admin", "admin", "super_admin"];

/* ─── Routes publiques ────────────────────────────────────── */
const PUBLIC_ROOTS = ["index", "(auth)", "live-tracking", "cars-en-route-map", "offline"];

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const root = segments[0] as string | undefined;
    const isPublic = !root || PUBLIC_ROOTS.includes(root);

    /* Non connecté → login si route protégée */
    if (!user) {
      if (!isPublic) router.replace("/(auth)/login");
      return;
    }

    /* Connecté sur écran d'auth → son espace */
    if (root === "(auth)") {
      router.replace(getDashboardPath(user.role, user.agentRole) as never);
      return;
    }

    /* Client ne peut pas accéder aux espaces pro */
    if (root === "(tabs)" && DASHBOARD_ONLY_ROLES.includes(user.role)) {
      router.replace(getDashboardPath(user.role, user.agentRole) as never);
      return;
    }

    /* Protection espace /client */
    if (root === "client") {
      const allowed = ROUTE_ROLES.client ?? [];
      if (!allowed.includes(user.role)) {
        router.replace(getDashboardPath(user.role, user.agentRole) as never);
      }
      return;
    }

    /* Protection espace /entreprise */
    if (root === "entreprise") {
      const allowed = ROUTE_ROLES.entreprise ?? [];
      if (!allowed.includes(user.role)) {
        router.replace(getDashboardPath(user.role, user.agentRole) as never);
      }
      return;
    }

    /* Protection espace /admin */
    if (root === "admin") {
      const allowed = ROUTE_ROLES.admin ?? [];
      if (!allowed.includes(user.role)) {
        router.replace(getDashboardPath(user.role, user.agentRole) as never);
      }
      return;
    }

    /* Protection espace /agent */
    if (root === "agent") {
      if (user.role !== "agent") {
        router.replace(getDashboardPath(user.role, user.agentRole) as never);
      }
      return;
    }

    /* Accès dashboard legacy → redirige vers le bon espace */
    if (root === "dashboard") {
      const requestedDash = segments[1] as string | undefined;
      if (requestedDash === "company" && !["compagnie", "company_admin"].includes(user.role)) {
        router.replace(getDashboardPath(user.role, user.agentRole) as never);
        return;
      }
      if (requestedDash === "super-admin" && !["admin", "super_admin"].includes(user.role)) {
        router.replace(getDashboardPath(user.role, user.agentRole) as never);
        return;
      }
      if (requestedDash === "agent" && user.role !== "agent") {
        router.replace(getDashboardPath(user.role, user.agentRole) as never);
        return;
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
        {/* Splash */}
        <Stack.Screen name="index" />

        {/* Auth */}
        <Stack.Screen name="(auth)" options={{ presentation: "modal", headerShown: false }} />

        {/* Toutes les autres routes sont auto-découvertes par Expo Router depuis le filesystem */}
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
