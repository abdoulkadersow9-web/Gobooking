import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getDashboardPath, useAuth } from "@/context/AuthContext";

const ND = Platform.OS !== "web";

/* ── Anneau pulsant décoratif ── */
function PulseRing({ delay, size }: { delay: number; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: ND,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: ND,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scale  = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.28, 0] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.9)",
        transform: [{ scale }],
        opacity,
        pointerEvents: "none" as any,
      }}
    />
  );
}

/* ── Dot unique animé ── */
function Dot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1,   duration: 380, useNativeDriver: ND }),
        Animated.timing(anim, { toValue: 0.3, duration: 380, useNativeDriver: ND }),
        Animated.delay(Math.max(0, 480 - delay)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "white",
        opacity: anim,
      }}
    />
  );
}

/* ── Loader 3 dots ── */
function DotLoader() {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <Dot delay={0} />
      <Dot delay={160} />
      <Dot delay={320} />
    </View>
  );
}

const MIN_SPLASH_MS = Platform.OS === "web" ? 0 : 500;

export default function SplashScreen() {
  const { user, isLoading } = useAuth();

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoScale        = useRef(new Animated.Value(0.7)).current;
  const logoOpacity      = useRef(new Animated.Value(0)).current;
  const textOpacity      = useRef(new Animated.Value(0)).current;
  const textTranslateY   = useRef(new Animated.Value(18)).current;
  const loaderOpacity    = useRef(new Animated.Value(0)).current;

  const navigatedRef  = useRef(false);
  const minDoneRef    = useRef(false);
  const authDoneRef   = useRef(false);
  const userRef       = useRef(user);

  useEffect(() => { userRef.current = user; }, [user]);

  const doNavigate = useRef(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (Platform.OS === "web") {
      const u = userRef.current;
      if (u) router.replace(getDashboardPath(u.role, u.agentRole) as never);
      else   router.replace("/(auth)/login");
      return;
    }
    Animated.timing(containerOpacity, {
      toValue: 0, duration: 160, useNativeDriver: ND,
    }).start(() => {
      const u = userRef.current;
      if (u) router.replace(getDashboardPath(u.role, u.agentRole) as never);
      else   router.replace("/(auth)/login");
    });
  }).current;

  function tryNavigate() {
    if (minDoneRef.current && authDoneRef.current) doNavigate();
  }

  useEffect(() => {
    if (Platform.OS !== "web") {
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, tension: 120, friction: 7,  useNativeDriver: ND }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 220, useNativeDriver: ND }),
        Animated.sequence([
          Animated.delay(180),
          Animated.parallel([
            Animated.timing(textOpacity,    { toValue: 1, duration: 200, useNativeDriver: ND }),
            Animated.timing(textTranslateY, { toValue: 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
          ]),
          Animated.timing(loaderOpacity, { toValue: 1, duration: 150, useNativeDriver: ND }),
        ]),
      ]).start();
    }

    const t = setTimeout(() => {
      minDoneRef.current = true;
      tryNavigate();
    }, MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      authDoneRef.current = true;
      tryNavigate();
    }
  }, [isLoading, user]);

  return (
    <Animated.View style={[S.container, { opacity: containerOpacity }]}>
      {/* Anneaux pulsants */}
      <View style={[S.ringsWrap, { pointerEvents: "none" }]}>
        <PulseRing delay={0}    size={220} />
        <PulseRing delay={500}  size={310} />
        <PulseRing delay={1000} size={400} />
      </View>

      {/* Logo */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
          ...S.logoWrap,
        }}
      >
        <Image
          source={require("../assets/logo.png")}
          style={S.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Texte */}
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textTranslateY }],
          alignItems: "center",
          gap: 6,
        }}
      >
        <Text style={S.appName}>GoBooking</Text>
        <Text style={S.tagline}>Voyagez partout en Côte d'Ivoire</Text>
      </Animated.View>

      {/* Loader dots */}
      <Animated.View style={[S.loaderWrap, { opacity: loaderOpacity }]}>
        <DotLoader />
      </Animated.View>

      <Text style={S.version}>v2.0 · Côte d'Ivoire</Text>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1E6E",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
  },
  ringsWrap: {
    position: "absolute",
    width: 400,
    height: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 130,
    height: 130,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
  },
  logo: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: 34,
    fontWeight: "800",
    color: "white",
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  loaderWrap: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 80 : 110,
  },
  version: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 30 : 52,
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    letterSpacing: 0.5,
  },
});
