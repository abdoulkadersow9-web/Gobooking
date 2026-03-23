import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getDashboardPath, useAuth } from "@/context/AuthContext";

const { width } = Dimensions.get("window");

const PRIMARY   = "#0B3C5D";
const DARK_BG   = "#072D47";
const ACCENT    = "#FF6B00";
const SPLASH_MS = 2600;

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const [ready, setReady] = useState(false);

  /* ── Animation values ── */
  const logoScale   = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(24)).current;
  const dotScale    = useRef(new Animated.Value(0)).current;
  const shimmerX    = useRef(new Animated.Value(-width)).current;
  const taglineOp   = useRef(new Animated.Value(0)).current;

  /* ── Entrance animation ── */
  useEffect(() => {
    Animated.sequence([
      /* 1) Logo pop */
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 65,
          friction: 6,
          useNativeDriver: false,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: false,
        }),
      ]),
      /* 2) Text fade-slide up */
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(textY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
      /* 3) Tagline */
      Animated.timing(taglineOp, {
        toValue: 1,
        duration: 320,
        useNativeDriver: false,
      }),
      /* 4) Accent dot */
      Animated.spring(dotScale, {
        toValue: 1,
        tension: 80,
        friction: 5,
        useNativeDriver: false,
      }),
    ]).start();

    /* Shimmer loop */
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: width * 2,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    const shimmerTimer = setTimeout(() => shimmerLoop.start(), 700);

    return () => {
      clearTimeout(shimmerTimer);
      shimmerLoop.stop();
    };
  }, []);

  /* ── Redirect when auth ready AND minimum delay elapsed ── */
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || isLoading) return;
    if (user) {
      router.replace(getDashboardPath(user.role, user.agentRole) as never);
    } else {
      router.replace("/(auth)/login");
    }
  }, [ready, isLoading, user]);

  /* ── Dots pulse ── */
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(val, { toValue: 0.3, duration: 400, useNativeDriver: false }),
          Animated.delay(800),
        ])
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 250);
    const a3 = pulse(dot3, 500);
    const t = setTimeout(() => { a1.start(); a2.start(); a3.start(); }, 1200);
    return () => {
      clearTimeout(t);
      a1.stop(); a2.stop(); a3.stop();
    };
  }, []);

  return (
    <View style={S.container}>
      {/* ── Background gradient circles ── */}
      <View style={S.bgCircle1} />
      <View style={S.bgCircle2} />
      <View style={S.bgCircle3} />

      {/* ── Main content ── */}
      <View style={S.center}>
        {/* Logo mark */}
        <Animated.View style={[S.logoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
          {/* Shimmer overlay */}
          <Animated.View
            style={[S.shimmer, { transform: [{ translateX: shimmerX }] }]}
          />
          <Image
            source={require("../assets/logo.png")}
            style={S.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App name */}
        <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }], alignItems: "center" }}>
          <View style={S.nameRow}>
            <Text style={S.nameGo}>Go</Text>
            <Text style={S.nameBooking}>Booking</Text>
            <Animated.View style={[S.accentDot, { transform: [{ scale: dotScale }] }]} />
          </View>

          <Animated.Text style={[S.tagline, { opacity: taglineOp }]}>
            Voyagez intelligent, partout en Côte d'Ivoire
          </Animated.Text>
        </Animated.View>
      </View>

      {/* ── Loading dots ── */}
      <View style={S.dotsRow}>
        <Animated.View style={[S.dot, { opacity: dot1 }]} />
        <Animated.View style={[S.dot, { opacity: dot2 }]} />
        <Animated.View style={[S.dot, { opacity: dot3 }]} />
      </View>

      {/* ── Version ── */}
      <Text style={S.version}>v2.0 · Côte d'Ivoire 🇨🇮</Text>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Background decoration ── */
  bgCircle1: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: PRIMARY,
    opacity: 0.08,
    top: -100,
    right: -80,
  },
  bgCircle2: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: ACCENT,
    opacity: 0.05,
    bottom: 60,
    left: -80,
  },
  bgCircle3: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: PRIMARY,
    opacity: 0.12,
    bottom: 200,
    right: 20,
  },

  /* ── Logo ── */
  center: {
    alignItems: "center",
    gap: 32,
  },
  logoWrap: {
    width: 160,
    height: 160,
    borderRadius: 40,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 20,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 60,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ skewX: "-20deg" }],
    zIndex: 10,
  },

  /* Bus body */
  busBody: {
    width: 90,
    height: 44,
    backgroundColor: "white",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 8,
    gap: 5,
    overflow: "hidden",
  },
  windowsRow: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  window: {
    width: 12,
    height: 14,
    backgroundColor: PRIMARY,
    borderRadius: 3,
    opacity: 0.85,
  },
  door: {
    width: 11,
    height: 20,
    backgroundColor: ACCENT,
    borderRadius: 3,
    marginTop: 2,
  },
  wheelsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: 80,
    marginTop: -2,
  },
  wheel: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "white",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    width: 90,
    justifyContent: "center",
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
  },
  routeDash: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 1,
  },

  /* ── Name ── */
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  nameGo: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "white",
    letterSpacing: -1,
  },
  nameBooking: {
    fontSize: 48,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: -1,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    marginLeft: 3,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 6,
    letterSpacing: 0.3,
    paddingHorizontal: 20,
  },

  /* ── Loading dots ── */
  dotsRow: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 80 : 100,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },

  /* ── Version ── */
  version: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 30 : 50,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 0.5,
  },
});
