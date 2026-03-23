/**
 * OfflineBanner — toast flottant moderne (pill style)
 */
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NetworkStatus } from "@/utils/offline";

interface Props {
  status: NetworkStatus;
  accentColor?: string;
}

export default function OfflineBanner({ status, accentColor = "#FF3B30" }: Props) {
  const { isOnline, pendingCount, syncNow, isSyncing, lastSyncResult } = status;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const visible =
    !isOnline ||
    pendingCount > 0 ||
    (lastSyncResult != null && lastSyncResult.synced > 0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: visible ? 0 : 20,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  /* ── Couleur & contenu selon l'état ── */
  let bg = accentColor;
  let iconName: React.ComponentProps<typeof Feather>["name"] = "wifi-off";
  let iconColor = "#fff";
  let label = "Mode hors ligne";
  let sublabel =
    pendingCount > 0
      ? `${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente`
      : null;
  let showSync = false;
  let showHistory = false;

  if (isOnline && pendingCount > 0) {
    bg = "#0B3C5D";
    iconName = isSyncing ? "refresh-cw" : "upload-cloud";
    iconColor = "#6EE7B7";
    label = isSyncing ? "Synchronisation…" : "Actions en attente";
    sublabel = isSyncing
      ? null
      : `${pendingCount} action${pendingCount > 1 ? "s" : ""} à envoyer`;
    showSync = !isSyncing;
    showHistory = !isSyncing;
  } else if (isOnline && pendingCount === 0 && lastSyncResult && lastSyncResult.synced > 0) {
    bg = "#065F46";
    iconName = "check-circle";
    iconColor = "#6EE7B7";
    label = `${lastSyncResult.synced} synchronisée${lastSyncResult.synced > 1 ? "s" : ""}`;
    sublabel = null;
    showHistory = true;
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity, transform: [{ translateY }], pointerEvents: "box-none" },
      ]}
    >
      <View style={[styles.pill, { backgroundColor: bg }]}>
        {/* Icône */}
        <View style={[styles.iconWrap, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          {isSyncing && isOnline && pendingCount > 0 ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name={iconName} size={14} color={iconColor} />
          )}
        </View>

        {/* Texte */}
        <View style={styles.textBlock}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {sublabel ? (
            <Text style={styles.sublabel} numberOfLines={1}>{sublabel}</Text>
          ) : null}
        </View>

        {/* Actions */}
        {showSync && (
          <TouchableOpacity style={styles.actionBtn} onPress={syncNow} activeOpacity={0.75}>
            <Feather name="refresh-cw" size={11} color="#fff" />
            <Text style={styles.actionText}>Sync</Text>
          </TouchableOpacity>
        )}
        {showHistory && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
            onPress={() => router.push("/offline/history")}
            activeOpacity={0.75}
          >
            <Feather name="clock" size={11} color="#fff" />
          </TouchableOpacity>
        )}
        {!isOnline && pendingCount > 0 && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
            onPress={() => router.push("/offline/history")}
            activeOpacity={0.75}
          >
            <Feather name="list" size={11} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    maxWidth: 320,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sublabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  actionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
