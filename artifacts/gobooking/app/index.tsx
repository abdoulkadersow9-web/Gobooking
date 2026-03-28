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

const MIN_DISPLAY_MS = 300;
const ND = Platform.OS !== "web";

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const [minTimeDone, setMinTimeDone] = useState(false);
  const navigatedRef = useRef(false);

  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const logoScale      = useRef(new Animated.Value(0.85)).current;
  const textOpacity    = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity,  { toValue: 1, duration: 240, useNativeDriver: ND }),
        Animated.spring(logoScale,    { toValue: 1, tension: 100, friction: 8, useNativeDriver: ND }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity,    { toValue: 1, duration: 180, useNativeDriver: ND }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 180, useNativeDriver: ND }),
      ]),
    ]).start();

    const t = setTimeout(() => setMinTimeDone(true), MIN_DISPLAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!minTimeDone || isLoading || navigatedRef.current) return;
    navigatedRef.current = true;
    if (user) {
      router.replace(getDashboardPath(user.role, user.agentRole) as never);
    } else {
      router.replace("/(auth)/login");
    }
  }, [minTimeDone, isLoading, user]);

  return (
    <View style={S.container}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <Image
          source={require("../assets/logo.png")}
          style={S.logo}
          resizeMode="contain"
        />
      </Animated.View>

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
    backgroundColor: "#1650D0",
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
