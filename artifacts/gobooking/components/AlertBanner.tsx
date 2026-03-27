/**
 * Module 6 — AlertBanner
 * Bannière d'alerte persistante affichée sur les pages agents.
 *
 * Deux types d'alertes :
 *   pre_departure  → "Départ dans X min — Validez votre départ"
 *   validation     → "Départ validé — Impression disponible"
 *
 * Reste visible jusqu'à ce que l'utilisateur la ferme OU que le trip passe
 * en_route (détecté via le polling 30s du hook useRealtime).
 */
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { PreDepartureAlert, RealtimeNotif } from "@/hooks/useRealtime";

const AMBER  = "#D97706";
const A_DARK = "#92400E";
const A_LIGHT= "#FEF3C7";
const GREEN  = "#059669";
const G_LIGHT= "#DCFCE7";
const RED    = "#DC2626";

/* ── Props ── */
interface Props {
  preDepartureAlerts : PreDepartureAlert[];
  validationAlerts   : RealtimeNotif[];
  agentRole          : string | null;
  /** Called when the user taps the action button */
  onAction?          : (tripId: string, type: "pre_departure" | "validation") => void;
}

/* ── Composant ── */
export default function AlertBanner({ preDepartureAlerts, validationAlerts, agentRole, onAction }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [anim] = useState(new Animated.Value(0));

  const activePre = preDepartureAlerts.filter(a => !dismissed.has(`pre_${a.id}`));
  const activeVal = validationAlerts.filter(a => !dismissed.has(`val_${a.id}`));
  const hasAlerts = activePre.length > 0 || activeVal.length > 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: hasAlerts ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [hasAlerts]);

  if (!hasAlerts) return null;

  const dismiss = (key: string) => setDismissed(prev => new Set([...prev, key]));

  return (
    <Animated.View style={[SL.container, { opacity: anim, transform: [{ scaleY: anim }] }]}>

      {/* ── Pre-departure alerts ── */}
      {activePre.map(alert => {
        const urgent = alert.minutesLeft <= 2;
        return (
          <View key={alert.id} style={[SL.banner, urgent ? SL.bannerUrgent : SL.bannerAmber]}>
            <View style={[SL.iconBox, { backgroundColor: urgent ? RED + "20" : A_LIGHT }]}>
              <Feather name="alert-triangle" size={18} color={urgent ? RED : A_DARK} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[SL.title, { color: urgent ? RED : A_DARK }]}>
                {urgent ? "🚨 Départ immédiat !" : `🕐 Départ dans ${alert.minutesLeft} min`}
              </Text>
              <Text style={SL.msg} numberOfLines={2}>
                {agentRole === "validation_depart"
                  ? `L'agent de validation attend validation pour ${alert.from} → ${alert.to} (${alert.departureTime})`
                  : `Agent, veuillez valider votre départ ${alert.from} → ${alert.to}`}
              </Text>
              <TouchableOpacity
                style={[SL.actionBtn, { backgroundColor: urgent ? RED : AMBER }]}
                onPress={() => {
                  onAction?.(alert.id, "pre_departure");
                  dismiss(`pre_${alert.id}`);
                }}>
                <Feather name="check-circle" size={12} color="#fff" />
                <Text style={SL.actionTxt}>Aller au bordereau</Text>
              </TouchableOpacity>
            </View>
            <Pressable onPress={() => dismiss(`pre_${alert.id}`)} hitSlop={12} style={SL.closeBtn}>
              <Feather name="x" size={16} color={urgent ? RED : A_DARK} />
            </Pressable>
          </View>
        );
      })}

      {/* ── Validation complete alerts ── */}
      {activeVal.map(alert => (
        <View key={alert.id} style={[SL.banner, SL.bannerGreen]}>
          <View style={[SL.iconBox, { backgroundColor: G_LIGHT }]}>
            <Feather name="check-circle" size={18} color={GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[SL.title, { color: GREEN }]}>✅ Départ validé</Text>
            <Text style={SL.msg} numberOfLines={2}>{alert.message}</Text>
            <TouchableOpacity
              style={[SL.actionBtn, { backgroundColor: GREEN }]}
              onPress={() => {
                onAction?.(alert.refId ?? "", "validation");
                dismiss(`val_${alert.id}`);
              }}>
              <Feather name="printer" size={12} color="#fff" />
              <Text style={SL.actionTxt}>Imprimer la feuille de route</Text>
            </TouchableOpacity>
          </View>
          <Pressable onPress={() => dismiss(`val_${alert.id}`)} hitSlop={12} style={SL.closeBtn}>
            <Feather name="x" size={16} color={GREEN} />
          </Pressable>
        </View>
      ))}

    </Animated.View>
  );
}

const SL = StyleSheet.create({
  container:    { overflow: "hidden" },

  banner:       { flexDirection: "row", alignItems: "flex-start", gap: 10,
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },

  bannerAmber:  { backgroundColor: "#FFFBEB" },
  bannerUrgent: { backgroundColor: "#FFF1F2" },
  bannerGreen:  { backgroundColor: "#F0FDF4" },

  iconBox:      { width: 36, height: 36, borderRadius: 10,
                  justifyContent: "center", alignItems: "center" },

  title:        { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  msg:          { fontSize: 12, color: "#374151", lineHeight: 17 },

  actionBtn:    { flexDirection: "row", alignItems: "center", gap: 5,
                  alignSelf: "flex-start", marginTop: 8,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  actionTxt:    { fontSize: 11, fontWeight: "700", color: "#fff" },

  closeBtn:     { paddingTop: 2 },
});
