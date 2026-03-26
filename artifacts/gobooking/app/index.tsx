import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getDashboardPath, useAuth } from "@/context/AuthContext";

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  /* ── Valeurs d'animation ── */
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(30)).current; // part de 30px plus bas
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(16)).current;

  /* ── Animation au montage ── */
  useEffect(() => {
    Animated.sequence([
      /* 1. Logo : fade in + légère montée */
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 700,
          useNativeDriver: false,
        }),
      ]),
      /* 2. Texte : même effet, légèrement décalé */
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]),
    ]).start();

    /* Timer splash : 2.5s */
    const t = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(t);
  }, []);

  /* ── Redirection quand timer + auth prêts ── */
  useEffect(() => {
    if (!splashDone || isLoading) return;
    if (user) {
      router.replace(getDashboardPath(user.role, user.agentRole) as never);
    } else {
      router.replace("/(auth)/login");
    }
  }, [splashDone, isLoading, user]);

  return (
    <View style={S.container}>
      {/* Logo animé : fade in + montée */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ translateY: logoTranslateY }],
        }}
      >
        <Image
          source={require("../assets/logo.png")}
          style={S.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Texte animé : fade in + montée */}
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textTranslateY }],
          alignItems: "center",
        }}
      >
        <Text style={S.appName}>GoBooking</Text>
        <Text style={S.tagline}>Voyagez partout en Côte d'Ivoire</Text>
      </Animated.View>

      <Text style={S.version}>v2.0 · Côte d'Ivoire</Text>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B3C5D",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
  },
  logo: {
    width: 180,
    height: 180,
  },
  appName: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    marginTop: 6,
    letterSpacing: 0.3,
  },
  version: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 30 : 50,
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 0.5,
  },
});
