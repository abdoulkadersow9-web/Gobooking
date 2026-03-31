import { LinearGradient } from "expo-linear-gradient";
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

/* ── Constants ────────────────────────────────── */
const IS_WEB   = Platform.OS === "web";
const ND       = !IS_WEB;           /* useNativeDriver: true only on native */
const MIN_SPLASH = IS_WEB ? 1400 : 1800;

/* ══════════════════════════════════════════
   NATIVE-ONLY: Ripple ring animation
══════════════════════════════════════════ */
function Ripple({ delay, size, maxOp }: { delay: number; size: number; maxOp: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1, duration: 2200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1.5] });
  const op    = anim.interpolate({
    inputRange: [0, 0.08, 0.55, 1],
    outputRange: [0, maxOp, maxOp * 0.3, 0],
  });
  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)",
        transform: [{ scale }], opacity: op,
        pointerEvents: "none" as any,
      }}
    />
  );
}

/* ══════════════════════════════════════════
   NATIVE-ONLY: Pulsing glow orb
══════════════════════════════════════════ */
function GlowOrb() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.68, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[S.glowOrb, { opacity: pulse }]} />;
}

/* ══════════════════════════════════════════
   PROGRESS BAR
══════════════════════════════════════════ */
function ProgressBar({ width }: { width: Animated.AnimatedInterpolation<string | number> }) {
  return (
    <View style={S.barTrack}>
      <Animated.View style={[S.barFill, { width }]} />
    </View>
  );
}

/* ══════════════════════════════════════════
   MAIN SPLASH SCREEN
══════════════════════════════════════════ */
export default function SplashScreen() {
  const { user, isLoading } = useAuth();

  /* ── Shared animations ── */
  const containerOp = useRef(new Animated.Value(1)).current;
  const progress    = useRef(new Animated.Value(0)).current;

  /* ── Native-only entry animations ── */
  const logoScale = useRef(new Animated.Value(IS_WEB ? 1 : 0.25)).current;
  const logoOp    = useRef(new Animated.Value(IS_WEB ? 1 : 0)).current;
  const nameOp    = useRef(new Animated.Value(IS_WEB ? 1 : 0)).current;
  const nameY     = useRef(new Animated.Value(IS_WEB ? 0 : 24)).current;
  const tagOp     = useRef(new Animated.Value(IS_WEB ? 1 : 0)).current;

  /* ── Navigation guard ── */
  const navigatedRef = useRef(false);
  const minDoneRef   = useRef(false);
  const authDoneRef  = useRef(false);
  const userRef      = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const doNavigate = useRef(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    /* Fast, clean fade-out */
    Animated.timing(containerOp, {
      toValue: 0, duration: IS_WEB ? 180 : 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: ND,
    }).start(() => {
      const u = userRef.current;
      if (u) router.replace(getDashboardPath(u.role, u.agentRole) as never);
      else   router.replace("/(auth)/login");
    });
  }).current;

  const tryNavigate = () => {
    if (minDoneRef.current && authDoneRef.current) doNavigate();
  };

  useEffect(() => {
    if (IS_WEB) {
      /* Web: everything visible immediately — just animate the progress bar */
      Animated.timing(progress, {
        toValue: 0.9, duration: MIN_SPLASH - 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    } else {
      /* Native: crisp entry sequence */
      Animated.parallel([
        /* Logo: spring in */
        Animated.spring(logoScale, { toValue: 1, tension: 90, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOp,    { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        /* Name: slide up, delay 320ms */
        Animated.sequence([
          Animated.delay(320),
          Animated.parallel([
            Animated.timing(nameOp, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(nameY,  { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
        /* Tagline: delay 500ms */
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(tagOp, { toValue: 1, duration: 260, useNativeDriver: true }),
        ]),
        /* Progress bar: delay 640ms */
        Animated.sequence([
          Animated.delay(640),
          Animated.timing(progress, {
            toValue: 0.88, duration: MIN_SPLASH - 800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
        ]),
      ]).start();
    }

    const t = setTimeout(() => { minDoneRef.current = true; tryNavigate(); }, MIN_SPLASH);
    return () => clearTimeout(t);
  }, []);

  /* Auth done → complete the bar + navigate */
  useEffect(() => {
    if (!isLoading) {
      authDoneRef.current = true;
      Animated.timing(progress, {
        toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
      tryNavigate();
    }
  }, [isLoading, user]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <Animated.View style={[S.container, { opacity: containerOp }]}>
      {/* Gradient background */}
      <LinearGradient
        colors={["#0C1B72", "#091250", "#050B28"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0.75, y: 1 }}
      />

      {/* Native-only decorative elements (skip on web for performance) */}
      {!IS_WEB && (
        <>
          <GlowOrb />
          <View style={S.ringsWrap} pointerEvents="none">
            <Ripple delay={0}    size={220} maxOp={0.22} />
            <Ripple delay={750}  size={350} maxOp={0.14} />
            <Ripple delay={1500} size={480} maxOp={0.07} />
          </View>
        </>
      )}

      {/* Web-only: static soft glow behind logo */}
      {IS_WEB && (
        <View style={S.webGlow} pointerEvents="none" />
      )}

      {/* Logo */}
      <Animated.View
        style={[S.logoWrap, { opacity: logoOp, transform: [{ scale: logoScale }] }]}
      >
        <Image
          source={require("../assets/logo.png")}
          style={S.logo}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Animated.View>

      {/* App name + tagline */}
      <View style={S.textBlock}>
        <Animated.Text style={[S.appName, { opacity: nameOp, transform: [{ translateY: nameY }] }]}>
          GoBooking
        </Animated.Text>
        <Animated.Text style={[S.tagline, { opacity: tagOp }]}>
          Voyagez partout en Côte d'Ivoire
        </Animated.Text>
      </View>

      {/* Progress bar */}
      <View style={S.barWrap}>
        <ProgressBar width={barWidth} />
      </View>

      {/* Version */}
      <Text style={S.version}>v2.0 · Côte d'Ivoire</Text>
    </Animated.View>
  );
}

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050B28",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  glowOrb: {
    position: "absolute",
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: "#1A3ED8",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100,
    elevation: 0,
  },
  webGlow: {
    position: "absolute",
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(26,62,216,0.28)",
    top: "50%",
    left: "50%",
    marginTop: -150,
    marginLeft: -150,
  },
  ringsWrap: {
    position: "absolute",
    width: 500, height: 500,
    alignItems: "center", justifyContent: "center",
  },
  logoWrap: {
    width: 126,
    height: 126,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 38,
    elevation: 24,
    borderWidth: IS_WEB ? 0 : 1.5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  logo: {
    width: 96,
    height: 96,
  },
  textBlock: {
    alignItems: "center",
    gap: 7,
  },
  appName: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
    textShadowColor: "rgba(91,141,239,0.7)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.5,
    textAlign: "center",
    fontWeight: "500",
  },
  barWrap: {
    position: "absolute",
    bottom: IS_WEB ? 80 : 120,
    alignItems: "center",
  },
  barTrack: {
    width: 148,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#5B8DEF",
    shadowColor: "#5B8DEF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  version: {
    position: "absolute",
    bottom: IS_WEB ? 28 : 52,
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 0.8,
  },
});
