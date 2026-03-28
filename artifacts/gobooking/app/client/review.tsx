import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = Colors.light.primary;

/* ─── Star component ─────────────────────────────────────────────── */
function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={S.starsRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(n);
          }}
          activeOpacity={0.7}
        >
          <Text style={[S.star, n <= value && S.starFilled]}>
            {n <= value ? "★" : "☆"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const RATING_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: "Très mauvais",  color: "#DC2626", desc: "Je suis très insatisfait(e)" },
  2: { label: "Mauvais",       color: "#EA580C", desc: "L'expérience était décevante" },
  3: { label: "Correct",       color: "#D97706", desc: "Ni bien, ni mal" },
  4: { label: "Bien",          color: "#16A34A", desc: "Bonne expérience globale" },
  5: { label: "Excellent",     color: "#0B3C5D", desc: "Je recommande vivement !" },
};

const QUICK_COMMENTS = [
  "Ponctuel et confortable",
  "Conducteur professionnel",
  "Bus propre",
  "Bon rapport qualité-prix",
  "Personnel accueillant",
  "Climatisation agréable",
];

/* ─── Screen ─────────────────────────────────────────────────────── */
export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const params = useLocalSearchParams<{
    bookingId: string;
    tripId: string;
    companyId: string;
    from: string;
    to: string;
    date: string;
    companyName: string;
  }>();

  const [rating,   setRating]   = useState(0);
  const [comment,  setComment]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState("");

  const ratingCfg = rating ? RATING_LABELS[rating] : null;

  const submit = async () => {
    if (!rating) { setError("Veuillez choisir une note"); return; }
    setError("");
    setLoading(true);
    try {
      await apiFetch("/reviews", {
        token: token ?? undefined,
        method: "POST",
        body: {
          bookingId:  params.bookingId,
          tripId:     params.tripId,
          companyId:  params.companyId,
          rating,
          comment: comment.trim() || undefined,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  /* ── Success state ── */
  if (done) {
    return (
      <View style={[S.root, { paddingTop: insets.top }]}>
        <LinearGradient colors={[PRIMARY, "#0a2e4a"]} style={S.header}>
          <TouchableOpacity style={S.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings")}>
            <Feather name="arrow-left" size={20} color="white" />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Avis envoyé</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <View style={S.successBox}>
          <View style={S.successIcon}>
            <Feather name="check-circle" size={56} color="#16A34A" />
          </View>
          <Text style={S.successTitle}>Merci pour votre avis !</Text>
          <Text style={S.successDesc}>
            Votre note aide la communauté GoBooking et encourage les compagnies à s'améliorer.
          </Text>
          <View style={S.starsRow}>
            {[1,2,3,4,5].map(n => (
              <Text key={n} style={[S.star, n <= rating && S.starFilled]}>{n <= rating ? "★" : "☆"}</Text>
            ))}
          </View>
          <TouchableOpacity style={S.doneBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings")}>
            <Text style={S.doneBtnTxt}>Retour à mes réservations</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[S.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient colors={[PRIMARY, "#0a2e4a"]} style={S.header}>
          <TouchableOpacity style={S.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings")}>
            <Feather name="arrow-left" size={20} color="white" />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Laisser un avis</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Trip info card */}
          <View style={S.tripCard}>
            <View style={S.tripCardLeft}>
              <View style={S.tripDot} />
              <View style={S.tripLine} />
              <View style={[S.tripDot, { backgroundColor: "#FF6B00" }]} />
            </View>
            <View style={S.tripCardRight}>
              <Text style={S.tripFrom}>{params.from ?? "Départ"}</Text>
              <Text style={S.tripArrow}>→</Text>
              <Text style={S.tripTo}>{params.to ?? "Destination"}</Text>
            </View>
            <View style={S.tripMeta}>
              {params.companyName ? (
                <Text style={S.tripCompany}>{params.companyName}</Text>
              ) : null}
              {params.date ? (
                <Text style={S.tripDate}>{params.date}</Text>
              ) : null}
            </View>
          </View>

          {/* Rating section */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Votre note globale</Text>
            <Stars value={rating} onChange={setRating} />

            {ratingCfg && (
              <View style={[S.ratingPill, { backgroundColor: ratingCfg.color + "15", borderColor: ratingCfg.color + "40" }]}>
                <Text style={[S.ratingLabel, { color: ratingCfg.color }]}>{ratingCfg.label}</Text>
                <Text style={[S.ratingDesc, { color: ratingCfg.color + "CC" }]}>{ratingCfg.desc}</Text>
              </View>
            )}

            {!rating && (
              <Text style={S.tapHint}>Appuyez sur une étoile pour noter</Text>
            )}
          </View>

          {/* Quick tags */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Commentaires rapides</Text>
            <View style={S.tagsWrap}>
              {QUICK_COMMENTS.map(q => {
                const selected = comment.includes(q);
                return (
                  <Pressable
                    key={q}
                    style={[S.tag, selected && S.tagSelected]}
                    onPress={() => {
                      if (selected) {
                        setComment(prev => prev.replace(q, "").replace(/^[, ]+|[, ]+$/g, "").trim());
                      } else {
                        setComment(prev => prev ? `${prev}, ${q}` : q);
                      }
                    }}
                  >
                    <Feather name={selected ? "check" : "plus"} size={11} color={selected ? "white" : PRIMARY} />
                    <Text style={[S.tagTxt, selected && S.tagTxtSelected]}>{q}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Free comment */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Commentaire libre <Text style={S.optional}>(optionnel)</Text></Text>
            <TextInput
              style={S.textArea}
              multiline
              numberOfLines={5}
              placeholder="Décrivez votre expérience…"
              placeholderTextColor="#94A3B8"
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
            />
            <Text style={S.charCount}>{comment.length}/500</Text>
          </View>

          {/* Error */}
          {!!error && (
            <View style={S.errorBox}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={S.errorTxt}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[S.submitBtn, !rating && S.submitBtnDisabled]}
            onPress={submit}
            disabled={loading || !rating}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : (
                <>
                  <Feather name="send" size={16} color="white" />
                  <Text style={S.submitTxt}>Envoyer mon avis</Text>
                </>
              )
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "white" },

  scroll: { padding: 16, gap: 16 },

  tripCard: {
    backgroundColor: "white", borderRadius: 18, padding: 18,
    flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  tripCardLeft: { alignItems: "center", gap: 2 },
  tripDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  tripLine: { width: 2, height: 20, backgroundColor: "#CBD5E1" },
  tripCardRight: { flex: 1, gap: 2 },
  tripFrom: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  tripArrow:{ fontSize: 13, color: "#94A3B8", fontFamily: "Inter_400Regular" },
  tripTo:   { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FF6B00" },
  tripMeta: { alignItems: "flex-end", gap: 2 },
  tripCompany: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  tripDate:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },

  section: {
    backgroundColor: "white", borderRadius: 18, padding: 18, gap: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  optional:     { fontFamily: "Inter_400Regular", color: "#94A3B8" },

  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  star:       { fontSize: 46, color: "#E2E8F0" },
  starFilled: { color: "#FBBF24" },

  tapHint: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },

  ratingPill: {
    alignItems: "center", gap: 2, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  ratingLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  ratingDesc:  { fontSize: 12, fontFamily: "Inter_400Regular" },

  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: PRIMARY + "10", borderWidth: 1, borderColor: PRIMARY + "30",
  },
  tagSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tagTxt:     { fontSize: 12, fontFamily: "Inter_500Medium", color: PRIMARY },
  tagTxtSelected: { color: "white" },

  textArea: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 14,
    padding: 14, fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#0F172A", minHeight: 110, backgroundColor: "#F8FAFC",
  },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "right" },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12 },
  errorTxt: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626", flex: 1 },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16,
    shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: "#94A3B8", shadowOpacity: 0 },
  submitTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },

  successBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successTitle:{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#0F172A" },
  successDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", lineHeight: 22 },

  doneBtn: {
    marginTop: 12, backgroundColor: PRIMARY, borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  doneBtnTxt: { fontSize: 15, fontFamily: "Inter_700Bold", color: "white" },
});
