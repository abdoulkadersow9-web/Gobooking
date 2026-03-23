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

  const logoScale   = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  /* ── Animate logo on mount ── */
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: false,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }),
    ]).start();

    /* Mark splash timer as done after 2.5s */
    const t = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(t);
  }, []);

  /* ── Redirect when BOTH splash timer done AND auth resolved ── */
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
      <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}>
        <Image
          source={require("../assets/logo.png")}
          style={S.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={{ opacity: textOpacity, alignItems: "center" }}>
        <Text style={S.appName}>GoBooking</Text>
        <Text style={S.tagline}>Voyagez partout en Côte d'Ivoire</Text>
      </Animated.View>

      <View style={S.dots}>
        <View style={S.dot} />
        <View style={S.dot} />
        <View style={S.dot} />
      </View>

      <Text style={S.version}>v2.0 · Côte d'Ivoire 🇨🇮</Text>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B3C5D",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
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
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FF6B00",
    opacity: 0.8,
  },
  version: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 30 : 50,
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 0.5,
  },
});
