/**
 * /splash-preview — Aperçu permanent du splash screen pour le canvas.
 * Même design que l'écran d'ouverture réel, mais sans minuterie de navigation.
 * Utilisé uniquement pour la prévisualisation design.
 */
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
          useNativeDriver: false,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
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
        pointerEvents: "none",
      } as any}
    />
  );
}

/* ── Orbe lumineux pulsant ── */
function GlowOrb() {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.65, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.45, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[S.glowOrb, { opacity: pulse }]} />;
}

export default function SplashPreview() {
  /* Barre de progression — loop pour la preview */
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const barW = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  /* Logo bounce décoratif */
  const logoScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.spring(logoScale, { toValue: 1.04, tension: 200, friction: 4, useNativeDriver: false }),
        Animated.spring(logoScale, { toValue: 1.0, tension: 150, friction: 6, useNativeDriver: false }),
        Animated.delay(2800),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={S.container}>
      {/* ── Fond dégradé ── */}
      <LinearGradient
        colors={["#0C1B72", "#091250", "#050B28"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* ── Orbe lumineux ── */}
      <GlowOrb />

      {/* ── Anneaux ripple ── */}
      <View style={S.ringsWrap} pointerEvents="none">
        <Ripple delay={0}    size={230} maxOp={0.20} />
        <Ripple delay={800}  size={360} maxOp={0.13} />
        <Ripple delay={1600} size={490} maxOp={0.07} />
      </View>

      {/* ── Logo ── */}
      <Animated.View style={[S.logoWrap, { transform: [{ scale: logoScale }] }]}>
        <Image
          source={require("../assets/logo.png")}
          style={S.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Texte ── */}
      <View style={S.textBlock}>
        <Text style={S.appName}>GoBooking</Text>
        <Text style={S.tagline}>Voyagez partout en Côte d'Ivoire</Text>
      </View>

      {/* ── Barre de progression (loop) ── */}
      <View style={S.barWrap}>
        <View style={S.barTrack}>
          <Animated.View style={[S.barFill, { width: barW }]} />
        </View>
      </View>

      {/* ── Version ── */}
      <Text style={S.version}>v2.0 · Côte d'Ivoire</Text>

      {/* ── Badge preview ── */}
      <View style={S.previewBadge}>
        <Text style={S.previewText}>APERÇU SPLASH</Text>
      </View>
    </View>
  );
}

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
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: "#1A3ED8",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 90,
  },
  ringsWrap: {
    position: "absolute",
    width: 500, height: 500,
    alignItems: "center", justifyContent: "center",
  },
  logoWrap: {
    width: 130, height: 130, borderRadius: 38,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45, shadowRadius: 30,
    elevation: 20,
  },
  logo: { width: 98, height: 98 },
  textBlock: { alignItems: "center", gap: 8 },
  appName: {
    fontSize: 38, fontWeight: "800", color: "#FFFFFF",
    letterSpacing: -1.2,
    textShadowColor: "rgba(91,141,239,0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  tagline: {
    fontSize: 13.5, color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5, textAlign: "center",
  },
  barWrap: {
    position: "absolute", bottom: 96,
    alignItems: "center",
  },
  barTrack: {
    width: 120, height: 2, borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%", borderRadius: 1,
    backgroundColor: "#5B8DEF",
  },
  version: {
    position: "absolute", bottom: 38,
    fontSize: 11, color: "rgba(255,255,255,0.18)",
    letterSpacing: 0.7,
  },
  previewBadge: {
    position: "absolute", top: 16, right: 16,
    backgroundColor: "rgba(91,141,239,0.25)",
    borderWidth: 1, borderColor: "rgba(91,141,239,0.5)",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  previewText: {
    fontSize: 9, fontWeight: "700",
    color: "rgba(91,141,239,0.9)", letterSpacing: 1,
  },
});
