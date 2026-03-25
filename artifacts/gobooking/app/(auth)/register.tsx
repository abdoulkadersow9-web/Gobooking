import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: "client";
    createdAt: string;
  };
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [fieldError, setFieldError]   = useState("");
  const [serverError, setServerError] = useState("");

  const clearErrors = () => { setFieldError(""); setServerError(""); };

  const handleRegister = async () => {
    clearErrors();

    if (!name.trim()) { setFieldError("Le nom complet est requis."); return; }
    if (!email.trim()) { setFieldError("L'adresse email est requise."); return; }
    if (!email.includes("@") || !email.includes(".")) {
      setFieldError("Veuillez entrer une adresse email valide.");
      return;
    }
    if (!password) { setFieldError("Le mot de passe est requis."); return; }
    if (password.length < 6) {
      setFieldError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (!confirm) { setFieldError("Veuillez confirmer votre mot de passe."); return; }
    if (password !== confirm) {
      setFieldError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          ...(referralCode.trim() ? { referralCode: referralCode.trim().toUpperCase() } : {}),
        }),
      });
      await login(res.token, res.user);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Inscription échouée. Veuillez réessayer.";
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const errorMessage = fieldError || serverError;
  const isServerErr  = !!serverError && !fieldError;

  const pwStrength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : 3;
  const pwStrengthLabel = ["", "Faible", "Moyen", "Fort"][pwStrength];
  const pwStrengthColor = ["", "#EF4444", "#F59E0B", "#059669"][pwStrength];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 20,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryDark]}
          style={styles.headerGradient}
        >
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appName}>GoBooking</Text>
          <Text style={styles.tagline}>Créez votre compte voyageur</Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <Text style={styles.welcomeTitle}>Créer un compte</Text>
          <Text style={styles.welcomeSubtitle}>Rejoignez des milliers de voyageurs en Côte d'Ivoire</Text>

          {/* ── Erreur inline ── */}
          {!!errorMessage && (
            <View style={[styles.errorBanner, isServerErr && styles.errorBannerRed]}>
              <Feather
                name={isServerErr ? "alert-circle" : "alert-triangle"}
                size={15}
                color={isServerErr ? "#B91C1C" : "#92400E"}
              />
              <Text style={[styles.errorText, isServerErr && styles.errorTextRed]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* ── Nom ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom complet</Text>
            <View style={[styles.inputRow, fieldError.includes("nom") && styles.inputRowError]}>
              <Feather name="user" size={18} color={Colors.light.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Kouassi Yao"
                placeholderTextColor={Colors.light.textMuted}
                value={name}
                onChangeText={t => { setName(t); clearErrors(); }}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* ── Email ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adresse email</Text>
            <View style={[styles.inputRow, fieldError.includes("email") && styles.inputRowError]}>
              <Feather name="mail" size={18} color={Colors.light.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="vous@exemple.com"
                placeholderTextColor={Colors.light.textMuted}
                value={email}
                onChangeText={t => { setEmail(t); clearErrors(); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* ── Mot de passe ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={[styles.inputRow, fieldError.includes("mot de passe") && styles.inputRowError]}>
              <Feather name="lock" size={18} color={Colors.light.textMuted} style={styles.icon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={Colors.light.textMuted}
                value={password}
                onChangeText={t => { setPassword(t); clearErrors(); }}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eye}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.light.textMuted} />
              </Pressable>
            </View>
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3].map(lvl => (
                  <View
                    key={lvl}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: pwStrength >= lvl ? pwStrengthColor : "#E2E8F0" },
                    ]}
                  />
                ))}
                <Text style={[styles.strengthLabel, { color: pwStrengthColor }]}>
                  {pwStrengthLabel}
                </Text>
              </View>
            )}
          </View>

          {/* ── Confirmation ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <View style={[
              styles.inputRow,
              (fieldError.includes("correspon") || fieldError.includes("confirmer")) && styles.inputRowError,
              confirm.length > 0 && confirm === password && styles.inputRowSuccess,
            ]}>
              <Feather name="shield" size={18} color={Colors.light.textMuted} style={styles.icon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Répétez votre mot de passe"
                placeholderTextColor={Colors.light.textMuted}
                value={confirm}
                onChangeText={t => { setConfirm(t); clearErrors(); }}
                secureTextEntry={!showConfirm}
              />
              <Pressable onPress={() => setShowConfirm(v => !v)} style={styles.eye}>
                <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={Colors.light.textMuted} />
              </Pressable>
            </View>
            {confirm.length > 0 && confirm === password && (
              <View style={styles.matchRow}>
                <Feather name="check-circle" size={13} color="#059669" />
                <Text style={styles.matchText}>Les mots de passe correspondent</Text>
              </View>
            )}
          </View>

          {/* ── Code parrainage (optionnel) ── */}
          <View style={styles.inputGroup}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Text style={styles.label}>Code de parrainage</Text>
              <View style={{ backgroundColor: "#ECFDF5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#059669" }}>Optionnel · +500 FCFA pour votre parrain</Text>
              </View>
            </View>
            <View style={styles.inputRow}>
              <Feather name="gift" size={18} color={Colors.light.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: A3F9C2"
                placeholderTextColor={Colors.light.textMuted}
                value={referralCode}
                onChangeText={t => setReferralCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
              />
              {referralCode.length > 0 && (
                <Pressable onPress={() => setReferralCode("")} style={styles.eye}>
                  <Feather name="x" size={16} color={Colors.light.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* ── Bouton S'inscrire ── */}
          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.submitBtnPressed,
              loading && styles.submitBtnDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather name="user-check" size={18} color="white" />
                <Text style={styles.submitBtnText}>Créer mon compte</Text>
              </>
            )}
          </Pressable>

          {/* ── Mention sécurité ── */}
          <View style={styles.securityRow}>
            <Feather name="shield" size={13} color={Colors.light.textMuted} />
            <Text style={styles.securityText}>Données chiffrées SSL · Accès sécurisé</Text>
          </View>

          {/* ── Lien connexion ── */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ?</Text>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.light.background,
  },
  headerGradient: {
    paddingTop: 44,
    paddingBottom: 60,
    alignItems: "center",
    gap: 8,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 4,
  },
  appName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
  formCard: {
    backgroundColor: Colors.light.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    flex: 1,
    padding: 24,
    paddingTop: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginBottom: 20,
  },

  /* Error */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  errorBannerRed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#92400E",
  },
  errorTextRed: {
    color: "#B91C1C",
  },

  /* Inputs */
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
  },
  inputRowError: {
    borderColor: "#EF4444",
    backgroundColor: "#FFF5F5",
  },
  inputRowSuccess: {
    borderColor: "#059669",
    backgroundColor: "#F0FDF4",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  eye: {
    padding: 4,
  },

  /* Password strength */
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 4,
  },

  /* Match indicator */
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  matchText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#059669",
  },

  /* Button */
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },

  /* Security */
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  securityText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },

  /* Footer */
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
});
