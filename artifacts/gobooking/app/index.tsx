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

const ND       = Platform.OS !== "web";
const IS_WEB   = Platform.OS === "web";

/* Durée minimale du splash — assez pour voir l'animation complète */
const MIN_SPLASH = 2000;

/* ══════════════════════════════════════════
   COMPOSANTS GRAPHIQUES
══════════════════════════════════════════ */

/* ── Anneau d'expansion (ripple) ── */
function Ripple({ delay, size, maxOp }: { delay: number; size: number; maxOp: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1, duration: 2500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: ND,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: ND }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1.6] });
  const op    = anim.interpolate({
    inputRange: [0, 0.1, 0.6, 1],
    outputRange: [0, maxOp, maxOp * 0.35, 0],
  });
  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)",
        transform: [{ scale }], opacity: op,
        pointerEvents: "none" as any,
      }}
    />
  );
}

/* ── Barre de progression ── */
function ProgressBar({ progress }: { progress: Animated.Value }) {
  const pct = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={S.barTrack}>
      <Animated.View style={[S.barFill, { width: pct }]} />
    </View>
  );
}

/* ── Pulsation du glow (loop) ── */
function GlowOrb() {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.65, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
        Animated.timing(pulse, { toValue: 0.45, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[S.glowOrb, { opacity: pulse }]} />;
}

/* ══════════════════════════════════════════
   ÉCRAN PRINCIPAL
══════════════════════════════════════════ */
export default function SplashScreen() {
  const { user, isLoading } = useAuth();

  /*
   * Sur web : tout démarre VISIBLE (opacity=1, translateY=0, scale=1)
   * L'animation est du polish — elle ne cache pas le contenu.
   * Sur native : séquence d'entrée dramatique depuis 0.
   */
  const containerOp = useRef(new Animated.Value(1)).current;
  const logoScale   = useRef(new Animated.Value(IS_WEB ? 1   : 0.2)).current;
  const logoOp      = useRef(new Animated.Value(IS_WEB ? 1   : 0  )).current;
  const nameOp      = useRef(new Animated.Value(IS_WEB ? 1   : 0  )).current;
  const nameY       = useRef(new Animated.Value(IS_WEB ? 0   : 30 )).current;
  const tagOp       = useRef(new Animated.Value(IS_WEB ? 1   : 0  )).current;
  const tagY        = useRef(new Animated.Value(IS_WEB ? 0   : 12 )).current;
  const progress    = useRef(new Animated.Value(0)).current;
  const barOp       = useRef(new Animated.Value(IS_WEB ? 1   : 0  )).current;

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
      toValue: 0, duration: 300,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: ND,
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
    if (IS_WEB) {
      /* Web : logo déjà visible, on anime juste le bounce + progress bar */
      Animated.sequence([
        /* Léger bounce du logo (déjà à scale 1, petit effet de vie) */
        Animated.spring(logoScale, {
          toValue: 1.04, tension: 200, friction: 4, useNativeDriver: false,
        }),
        Animated.spring(logoScale, {
          toValue: 1.0, tension: 150, friction: 6, useNativeDriver: false,
        }),
      ]).start();

      /* Barre de progression — remplit sur MIN_SPLASH */
      Animated.timing(progress, {
        toValue: 0.88,
        duration: MIN_SPLASH - 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    } else {
      /* Native : animation complète d'entrée */
      Animated.parallel([
        Animated.parallel([
          Animated.spring(logoScale, { toValue: 1, tension: 80, friction: 7, useNativeDriver: ND }),
          Animated.timing(logoOp,   { toValue: 1, duration: 340, useNativeDriver: ND }),
        ]),
        Animated.sequence([
          Animated.delay(350),
          Animated.parallel([
            Animated.timing(nameOp, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
            Animated.timing(nameY,  { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(560),
          Animated.parallel([
            Animated.timing(tagOp, { toValue: 1, duration: 300, useNativeDriver: ND }),
            Animated.timing(tagY,  { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(700),
          Animated.parallel([
            Animated.timing(barOp, { toValue: 1, duration: 200, useNativeDriver: ND }),
            Animated.timing(progress, {
              toValue: 0.85, duration: MIN_SPLASH - 900,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
          ]),
        ]),
      ]).start();
    }

    const t = setTimeout(() => { minDoneRef.current = true; tryNavigate(); }, MIN_SPLASH);
    return () => clearTimeout(t);
  }, []);

  /* Auth terminé → compléter la barre + naviguer */
  useEffect(() => {
    if (!isLoading) {
      authDoneRef.current = true;
      Animated.timing(progress, {
        toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
      tryNavigate();
    }
  }, [isLoading, user]);

  return (
    <Animated.View style={[S.container, { opacity: containerOp }]}>
      {/* ── Fond dégradé ── */}
      <LinearGradient
        colors={["#0C1B72", "#091250", "#050B28"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* ── Orbe lumineux pulsant ── */}
      <GlowOrb />

      {/* ── Anneaux ripple ── */}
      <View style={S.ringsWrap} pointerEvents="none">
        <Ripple delay={0}    size={230} maxOp={0.20} />
        <Ripple delay={800}  size={360} maxOp={0.13} />
        <Ripple delay={1600} size={490} maxOp={0.07} />
      </View>

      {/* ── Logo ── */}
      <Animated.View
        style={[
          S.logoWrap,
          { opacity: logoOp, transform: [{ scale: logoScale }] },
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
    backgroundColor: "#050B28",
    justifyContent: "center",
    alignItems: "center",
    gap: 22,
  },
  glowOrb: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#1A3ED8",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 90,
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
    width: 130,
    height: 130,
    borderRadius: 38,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 20,
  },
  logo: {
    width: 98,
    height: 98,
  },
  textBlock: {
    alignItems: "center",
    gap: 8,
  },
  appName: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.8,
    textShadowColor: "rgba(91,141,239,0.65)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.62)",
    letterSpacing: 0.6,
    textAlign: "center",
    fontWeight: "500",
  },
  barWrap: {
    position: "absolute",
    bottom: IS_WEB ? 96 : 128,
    alignItems: "center",
  },
  barTrack: {
    width: 140,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#5B8DEF",
    shadowColor: "#5B8DEF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  version: {
    position: "absolute",
    bottom: IS_WEB ? 38 : 62,
    fontSize: 11,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: 0.8,
  },
});
