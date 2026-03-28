import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

function SkeletonPulse({ width, height = 14, br = 8 }: { width: number | string; height?: number; br?: number }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9,  duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width, height, borderRadius: br, backgroundColor: "#D1D5DB", opacity }} />;
}

export function SkeletonBookingCard() {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <SkeletonPulse width="38%" height={13} />
        <SkeletonPulse width="22%" height={24} br={12} />
      </View>
      <View style={s.separator} />
      <View style={s.routeRow}>
        <View style={{ gap: 6, flex: 1 }}>
          <SkeletonPulse width="55%" height={26} br={6} />
          <SkeletonPulse width="45%" height={13} />
        </View>
        <SkeletonPulse width={32} height={3} />
        <View style={{ gap: 6, flex: 1, alignItems: "flex-end" }}>
          <SkeletonPulse width="55%" height={26} br={6} />
          <SkeletonPulse width="45%" height={13} />
        </View>
      </View>
      <View style={[s.row, { marginTop: 14 }]}>
        <SkeletonPulse width="35%" height={12} />
        <SkeletonPulse width="22%" height={38} br={14} />
      </View>
    </View>
  );
}

export function SkeletonParcelCard() {
  return (
    <View style={s.parcelCard}>
      <View style={[s.strip]} />
      <View style={s.parcelBody}>
        <View style={s.row}>
          <SkeletonPulse width="40%" height={12} />
          <SkeletonPulse width="22%" height={22} br={11} />
        </View>
        <View style={[s.routeRow, { marginTop: 14 }]}>
          <SkeletonPulse width="28%" height={18} br={6} />
          <SkeletonPulse width={28} height={2} />
          <SkeletonPulse width="28%" height={18} br={6} />
        </View>
        <View style={[s.row, { marginTop: 14 }]}>
          <SkeletonPulse width="38%" height={20} br={10} />
          <SkeletonPulse width="22%" height={30} br={12} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonActivityCard() {
  return (
    <View style={s.actCard}>
      <View style={s.row}>
        <SkeletonPulse width={36} height={36} br={18} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonPulse width="55%" height={14} />
          <SkeletonPulse width="40%" height={12} />
        </View>
        <SkeletonPulse width="18%" height={22} br={11} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderLeftWidth: 5,
    borderLeftColor: "#E2E8F0",
  },
  parcelCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  strip:      { width: 6, backgroundColor: "#E2E8F0" },
  parcelBody: { flex: 1, padding: 18, gap: 4 },
  actCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  separator: { marginVertical: 14, height: 1, backgroundColor: "#F1F5F9" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
