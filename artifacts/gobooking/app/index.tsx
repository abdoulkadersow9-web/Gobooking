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
  const logoScale = useRef(new Animated.Value(IS_WEB ? 1 : 0.5)).current;
  const logoOp    = useRef(new Animated.Value(IS_WEB ? 1 : 0)).current;
  const nameOp    = useRef(new Animated.Value(IS_WEB ? 1 : 0)).current;
  const nameY     = useRef(new Animated.Value(IS_WEB ? 0 : 18)).current;
  const tagOp     = useRef(new Animated.Value(IS_WEB ? 1 : 0)).current;
  const animStarted = useRef(false);

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

  /* Called once image is loaded (native) or immediately (web) */
  const startAnimation = () => {
    if (animStarted.current) return;
    animStarted.current = true;
    Animated.parallel([
      /* Logo: scale from 0.5 → 1, fade from 0 → 1 */
      Animated.spring(logoScale, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
      Animated.timing(logoOp,    { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      /* Name: slide up + fade in */
      Animated.sequence([
        Animated.delay(280),
        Animated.parallel([
          Animated.timing(nameOp, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(nameY,  { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      /* Tagline */
      Animated.sequence([
        Animated.delay(480),
        Animated.timing(tagOp, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]),
      /* Progress bar */
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(progress, {
          toValue: 0.88, duration: MIN_SPLASH - 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  };

  useEffect(() => {
    let frameDelay: ReturnType<typeof setTimeout> | null = null;

    if (IS_WEB) {
      /* Web: everything visible immediately — just animate the progress bar */
      Animated.timing(progress, {
        toValue: 0.9, duration: MIN_SPLASH - 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    } else {
      /* Native: start after a brief frame delay to ensure React has rendered */
      frameDelay = setTimeout(startAnimation, 16);
    }

    const t = setTimeout(() => { minDoneRef.current = true; tryNavigate(); }, MIN_SPLASH);
    return () => {
      if (frameDelay) clearTimeout(frameDelay);
      clearTimeout(t);
    };
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

      {/* Web-only: animated soft glow behind logo */}
      {IS_WEB && (
        <>
          <View style={S.webGlow} pointerEvents="none" />
          <View style={S.webGlow2} pointerEvents="none" />
        </>
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
    width: 360, height: 360, borderRadius: 180,
    backgroundColor: "rgba(26,62,216,0.22)",
    top: "50%" as any,
    left: "50%" as any,
    marginTop: -180,
    marginLeft: -180,
  },
  webGlow2: {
    position: "absolute",
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(91,141,239,0.14)",
    top: "50%" as any,
    left: "50%" as any,
    marginTop: -110,
    marginLeft: -110,
  },
  ringsWrap: {
    position: "absolute",
    width: 500, height: 500,
    alignItems: "center", justifyContent: "center",
  },
  logoWrap: {
    width: 136,
    height: 136,
    borderRadius: 38,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    elevation: 28,
    borderWidth: 0,
    ...(IS_WEB
      ? { boxShadow: "0 0 60px 20px rgba(59,110,234,0.55), 0 8px 32px rgba(0,0,0,0.4)" } as any
      : {
          shadowColor: "#3B6EEA",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 52,
        }),
  },
  logo: {
    width: 104,
    height: 104,
  },
  textBlock: {
    alignItems: "center",
    gap: 7,
  },
  appName: {
    fontSize: 42,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1.2,
    ...(IS_WEB
      ? { textShadow: "0 0 32px rgba(91,141,239,0.85)" } as any
      : {
          textShadowColor: "rgba(91,141,239,0.7)",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 24,
        }),
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.58)",
    letterSpacing: 0.6,
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
