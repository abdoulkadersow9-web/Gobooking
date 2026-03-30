import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
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

const { width: SCREEN_W } = Dimensions.get("window");
const ND          = Platform.OS !== "web";
const MIN_SPLASH  = 1900; // ms — durée minimale du splash (permet l'animation complète)

/* ══════════════════════════════════════════
   COMPOSANTS GRAPHIQUES
══════════════════════════════════════════ */

/* ── Anneau d'expansion (ripple) ── */
function Ripple({
  delay, size, maxOpacity,
}: { delay: number; size: number; maxOpacity: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1, duration: 2400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: ND,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: ND }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1.5] });
  const op    = anim.interpolate({
    inputRange: [0, 0.12, 0.65, 1],
    outputRange: [0, maxOpacity, maxOpacity * 0.3, 0],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.9)",
        transform: [{ scale }],
        opacity: op,
        pointerEvents: "none" as any,
      }}
    />
  );
}

/* ── Barre de progression shimmer ── */
function ProgressBar({ progress }: { progress: Animated.Value }) {
  const pct = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const shimOp = progress.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 0.9, 0.9, 0.5],
  });
  return (
    <View style={S.barTrack}>
      <Animated.View style={[S.barFill, { width: pct, opacity: shimOp }]} />
    </View>
  );
}

/* ══════════════════════════════════════════
   ÉCRAN PRINCIPAL
══════════════════════════════════════════ */
export default function SplashScreen() {
  const { user, isLoading } = useAuth();

  /* Valeurs d'animation */
  const containerOp = useRef(new Animated.Value(1)).current;
  const glowOp      = useRef(new Animated.Value(0)).current;
  const glowScale   = useRef(new Animated.Value(0.5)).current;
  const logoScale   = useRef(new Animated.Value(0.25)).current;
  const logoOp      = useRef(new Animated.Value(0)).current;
  const logoBg      = useRef(new Animated.Value(0)).current;
  const nameOp      = useRef(new Animated.Value(0)).current;
  const nameY       = useRef(new Animated.Value(28)).current;
  const tagOp       = useRef(new Animated.Value(0)).current;
  const tagY        = useRef(new Animated.Value(12)).current;
  const progress    = useRef(new Animated.Value(0)).current;
  const barOp       = useRef(new Animated.Value(0)).current;

  /* Navigation guards */
  const navigatedRef = useRef(false);
  const minDoneRef   = useRef(false);
  const authDoneRef  = useRef(false);
  const userRef      = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const doNavigate = useRef(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    Animated.timing(containerOp, {
      toValue: 0, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: ND,
    }).start(() => {
      const u = userRef.current;
      if (u) router.replace(getDashboardPath(u.role, u.agentRole) as never);
      else   router.replace("/(auth)/login");
    });
  }).current;

  function tryNavigate() {
    if (minDoneRef.current && authDoneRef.current) doNavigate();
  }

  /* ── Lancement des animations ── */
  useEffect(() => {
    Animated.parallel([
      /* 1. Lueur (glow orb) */
      Animated.parallel([
        Animated.timing(glowOp,    { toValue: 0.55, duration: 500, useNativeDriver: ND }),
        Animated.spring(glowScale, { toValue: 1, tension: 50, friction: 10, useNativeDriver: ND }),
      ]),

      /* 2. Logo — spring élastique depuis 0.25 */
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.spring(logoScale, {
            toValue: 1, tension: 85, friction: 7, useNativeDriver: ND,
          }),
          Animated.timing(logoOp, { toValue: 1, duration: 350, useNativeDriver: ND }),
          Animated.timing(logoBg, { toValue: 1, duration: 400, useNativeDriver: ND }),
        ]),
      ]),

      /* 3. Nom de l'app — glissement vers le haut */
      Animated.sequence([
        Animated.delay(420),
        Animated.parallel([
          Animated.timing(nameOp, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
          Animated.timing(nameY,  { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
        ]),
      ]),

      /* 4. Tagline */
      Animated.sequence([
        Animated.delay(660),
        Animated.parallel([
          Animated.timing(tagOp, { toValue: 1, duration: 300, useNativeDriver: ND }),
          Animated.timing(tagY,  { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
        ]),
      ]),

      /* 5. Barre de progression */
      Animated.sequence([
        Animated.delay(750),
        Animated.parallel([
          Animated.timing(barOp, { toValue: 1, duration: 200, useNativeDriver: ND }),
          Animated.timing(progress, {
            toValue: 0.82,
            duration: MIN_SPLASH - 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
        ]),
      ]),
    ]).start();

    const t = setTimeout(() => { minDoneRef.current = true; tryNavigate(); }, MIN_SPLASH);
    return () => clearTimeout(t);
  }, []);

  /* Auth terminé → compléter la barre */
  useEffect(() => {
    if (!isLoading) {
      authDoneRef.current = true;
      Animated.timing(progress, {
        toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
      tryNavigate();
    }
  }, [isLoading, user]);

  /* Fond dynamique du logo */
  const logoBgColor = logoBg.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.10)"],
  });

  return (
    <Animated.View style={[S.container, { opacity: containerOp }]}>
      {/* ── Fond dégradé ── */}
      <LinearGradient
        colors={["#0A1660", "#081040", "#04091F"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0.75, y: 1 }}
      />

      {/* ── Lueur centrale (glow) ── */}
      <Animated.View
        style={[S.glowOrb, { opacity: glowOp, transform: [{ scale: glowScale }] }]}
        pointerEvents="none"
      />

      {/* ── Anneaux ripple ── */}
      <View style={S.ringsWrap} pointerEvents="none">
        <Ripple delay={0}    size={240} maxOpacity={0.22} />
        <Ripple delay={700}  size={360} maxOpacity={0.14} />
        <Ripple delay={1400} size={480} maxOpacity={0.08} />
      </View>

      {/* ── Logo ── */}
      <Animated.View
        style={[
          S.logoWrap,
          {
            opacity: logoOp,
            transform: [{ scale: logoScale }],
            backgroundColor: logoBgColor,
          },
        ]}
      >
        <Image
          source={require("../assets/logo.png")}
          style={S.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Texte ── */}
      <View style={S.textBlock}>
        <Animated.Text
          style={[S.appName, { opacity: nameOp, transform: [{ translateY: nameY }] }]}
        >
          GoBooking
        </Animated.Text>
        <Animated.Text
          style={[S.tagline, { opacity: tagOp, transform: [{ translateY: tagY }] }]}
        >
          Voyagez partout en Côte d'Ivoire
        </Animated.Text>
      </View>

      {/* ── Barre de progression ── */}
      <Animated.View style={[S.barWrap, { opacity: barOp }]}>
        <ProgressBar progress={progress} />
      </Animated.View>

      {/* ── Version ── */}
      <Animated.Text style={[S.version, { opacity: tagOp }]}>
        v2.0 · Côte d'Ivoire
      </Animated.Text>
    </Animated.View>
  );
}

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#04091F",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  glowOrb: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#1A3ED8",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100,
    elevation: 0,
  },
  ringsWrap: {
    position: "absolute",
    width: 500,
    height: 500,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 124,
    height: 124,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    shadowColor: "#5B8DEF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  logo: {
    width: 92,
    height: 92,
  },
  textBlock: {
    alignItems: "center",
    gap: 8,
  },
  appName: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1.2,
    textShadowColor: "rgba(91,141,239,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    fontSize: 13.5,
    color: "rgba(255,255,255,0.42)",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  barWrap: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 100 : 130,
    alignItems: "center",
  },
  barTrack: {
    width: 110,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 1,
    backgroundColor: "#5B8DEF",
    shadowColor: "#5B8DEF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  version: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 40 : 64,
    fontSize: 11,
    color: "rgba(255,255,255,0.16)",
    letterSpacing: 0.7,
  },
});
