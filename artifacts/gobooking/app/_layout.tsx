import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Ionicons, Feather } from "@expo/vector-icons";
import { QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { BackHandler, InteractionManager, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import { AuthProvider, getDashboardPath, useAuth } from "@/context/AuthContext";
import { queryClient } from "@/utils/queryClient";
import { BookingProvider } from "@/context/BookingContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ParcelProvider } from "@/context/ParcelContext";
import { BASE_URL } from "@/utils/api";
import { setupNotificationListeners } from "@/utils/notifications";
import { useNetworkStatus } from "@/utils/offline";

SplashScreen.preventAutoHideAsync();


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

/* ─── Indicateur offline global — monté après le premier rendu ── */
function GlobalNetworkMonitor() {
  const insets  = useSafeAreaInsets();
  const network = useNetworkStatus(BASE_URL);
  return (
    <View
      style={{
        position: "absolute",
        top: insets.top + 12,
        left: 24,
        right: 24,
        zIndex: 999,
        alignItems: "center",
        pointerEvents: "box-none",
      }}
    >
      <OfflineBanner status={network} />
    </View>
  );
}

/** Intercepts Android hardware back button globally.
 *  If there is a valid screen to go back to → go back.
 *  Otherwise → redirect to the tab home (never crash with GO_BACK unhandled). */
function BackHandlerGuard() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      router.replace("/(tabs)");
      return true;
    });
    return () => sub.remove();
  }, []);
  return null;
}

function RootLayoutNav() {
  /* Defer the network monitor until after the first interaction completes —
     avoids blocking the initial render with a NetInfo subscription. */
  const [networkReady, setNetworkReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setNetworkReady(true);
    });
    return () => task.cancel();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {networkReady && <GlobalNetworkMonitor />}
      <AuthGuard />
      <BackHandlerGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 200,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      >
        {/* Root screens — no previous screen exists, swipe-back must be disabled */}
        <Stack.Screen name="index" options={{ animation: "none", gestureEnabled: false }} />
        <Stack.Screen name="(auth)" options={{ presentation: "modal", headerShown: false, animation: "slide_from_bottom", animationDuration: 260, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade", animationDuration: 180, gestureEnabled: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
    ...Feather.font,
  });

  /* Hide the native splash screen immediately — our custom animated
     splash in index.tsx takes over and handles the transition. */
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  /* Supress unused warning — fonts still warm up in background */
  void fontsLoaded;
  void fontError;

  /* Notification listeners — deferred until after first interactions complete
     so they don't compete with the initial render pipeline. */
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const cleanup = setupNotificationListeners(
        (_notification) => {},
        (_response) => {},
      );
      return cleanup;
    });
    return () => task.cancel();
  }, []);

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
