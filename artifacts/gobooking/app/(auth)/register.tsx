import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { getDashboardPath, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: "client" | "user" | "compagnie" | "company_admin" | "agent" | "admin" | "super_admin";
    createdAt: string;
  };
}

type RoleKey = "client" | "agent" | "compagnie" | "admin";

interface RoleOption {
  key: RoleKey;
  label: string;
  description: string;
  icon: "user" | "briefcase" | "truck" | "shield";
  color: string;
  bg: string;
  border: string;
}

const ROLES: RoleOption[] = [
  {
    key: "client",
    label: "Client",
    description: "Réserver des billets",
    icon: "user",
    color: "#0891B2",
    bg: "#ECFEFF",
    border: "#A5F3FC",
  },
  {
    key: "agent",
    label: "Agent",
    description: "Scanner & embarquer",
    icon: "briefcase",
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
  },
  {
    key: "compagnie",
    label: "Compagnie",
    description: "Gérer les voyages",
    icon: "truck",
    color: "#1A56DB",
    bg: "#EEF2FF",
    border: "#C7D2FE",
  },
  {
    key: "admin",
    label: "Admin",
    description: "Accès complet",
    icon: "shield",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
  },
];

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole]                 = useState<RoleKey>("client");
  const [loading, setLoading]           = useState(false);
  const [fieldError, setFieldError]     = useState("");
  const [serverError, setServerError]   = useState("");

  const clearErrors = () => { setFieldError(""); setServerError(""); };

  const handleRegister = async () => {
    clearErrors();

    if (!name.trim() && !email.trim() && !password.trim()) {
      setFieldError("Veuillez remplir tous les champs.");
      return;
    }
    if (!name.trim()) {
      setFieldError("Le nom complet est requis.");
      return;
    }
    if (!email.trim()) {
      setFieldError("L'adresse email est requise.");
      return;
    }
    if (!email.includes("@") || !email.includes(".")) {
      setFieldError("Veuillez entrer une adresse email valide.");
      return;
    }
    if (!password.trim()) {
      setFieldError("Le mot de passe est requis.");
      return;
    }
    if (password.length < 6) {
      setFieldError("Le mot de passe doit contenir au moins 6 caractères.");
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
          role,
        }),
      });
      await login(res.token, res.user);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
      const dashPath = getDashboardPath(res.user.role);
      if (dashPath) {
        router.replace(dashPath as never);
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Inscription échouée. Veuillez réessayer.";
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const errorMessage = fieldError || serverError;
  const isServerErr  = !!serverError && !fieldError;

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
        {/* ── Header gradient ── */}
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryDark]}
          style={styles.headerGradient}
        >
          <View style={styles.logoCircle}>
            <Feather name="user-plus" size={30} color="white" />
          </View>
          <Text style={styles.appName}>GoBooking</Text>
          <Text style={styles.tagline}>Créez votre compte en 1 minute</Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <Text style={styles.welcomeTitle}>Créer un compte</Text>
          <Text style={styles.welcomeSubtitle}>Rejoignez des milliers de voyageurs</Text>

          {/* ── Message d'erreur inline ── */}
          {!!errorMessage && (
            <View style={[styles.errorBanner, isServerErr && styles.errorBannerServer]}>
              <Feather
                name={isServerErr ? "alert-circle" : "alert-triangle"}
                size={15}
                color={isServerErr ? "#B91C1C" : "#92400E"}
              />
              <Text style={[styles.errorText, isServerErr && styles.errorTextServer]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* ── Nom ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom complet</Text>
            <View style={[
              styles.inputContainer,
              fieldError.includes("nom") && styles.inputError,
            ]}>
              <Feather name="user" size={18} color={Colors.light.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Kouassi Yao"
                placeholderTextColor={Colors.light.textMuted}
                value={name}
                onChangeText={(t) => { setName(t); clearErrors(); }}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* ── Email ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[
              styles.inputContainer,
              fieldError.includes("email") && styles.inputError,
            ]}>
              <Feather name="mail" size={18} color={Colors.light.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="vous@exemple.com"
                placeholderTextColor={Colors.light.textMuted}
                value={email}
                onChangeText={(t) => { setEmail(t); clearErrors(); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* ── Mot de passe ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={[
              styles.inputContainer,
              fieldError.includes("mot de passe") && styles.inputError,
            ]}>
              <Feather name="lock" size={18} color={Colors.light.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={Colors.light.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); clearErrors(); }}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.light.textMuted} />
              </Pressable>
            </View>
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1,2,3,4].map((lvl) => (
                  <View
                    key={lvl}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          password.length >= lvl * 3
                            ? password.length >= 10 ? "#059669" : "#F59E0B"
                            : "#E2E8F0",
                      },
                    ]}
                  />
                ))}
                <Text style={styles.strengthLabel}>
                  {password.length < 6 ? "Faible" : password.length < 10 ? "Moyen" : "Fort"}
                </Text>
              </View>
            )}
          </View>

          {/* ── Sélecteur de rôle ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Je suis…</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => {
                const isActive = role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    style={[
                      styles.roleCard,
                      isActive
                        ? { backgroundColor: r.bg, borderColor: r.color, borderWidth: 2 }
                        : { backgroundColor: Colors.light.background, borderColor: Colors.light.border, borderWidth: 1.5 },
                    ]}
                    onPress={() => { setRole(r.key); clearErrors(); }}
                  >
                    <View
                      style={[
                        styles.roleIcon,
                        { backgroundColor: isActive ? r.color : Colors.light.border + "66" },
                      ]}
                    >
                      <Feather name={r.icon} size={18} color={isActive ? "white" : Colors.light.textMuted} />
                    </View>
                    <Text style={[styles.roleLabel, isActive && { color: r.color }]}>
                      {r.label}
                    </Text>
                    <Text style={[styles.roleDesc, isActive && { color: r.color + "CC" }]}>
                      {r.description}
                    </Text>
                    {isActive && (
                      <View style={[styles.roleCheck, { backgroundColor: r.color }]}>
                        <Feather name="check" size={10} color="white" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Bouton S'inscrire ── */}
          <Pressable
            style={({ pressed }) => [
              styles.registerButton,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather name="user-check" size={18} color="white" />
                <Text style={styles.registerButtonText}>S'inscrire</Text>
              </>
            )}
          </Pressable>

          {/* ── Mention sécurité ── */}
          <View style={styles.securityNote}>
            <Feather name="shield" size={13} color={Colors.light.textMuted} />
            <Text style={styles.securityText}>
              Données chiffrées SSL · Confidentiel
            </Text>
          </View>

          {/* ── Lien connexion ── */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ?</Text>
            <Pressable onPress={() => router.back()}>
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
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
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

  /* Error banner */
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
  errorBannerServer: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#92400E",
  },
  errorTextServer: {
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FFF5F5",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  eyeButton: {
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
    fontFamily: "Inter_500Medium",
    color: Colors.light.textMuted,
    marginLeft: 4,
  },

  /* Role selector */
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleCard: {
    width: "47%",
    borderRadius: 14,
    padding: 14,
    alignItems: "flex-start",
    position: "relative",
    gap: 6,
  },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  roleLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  roleDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },
  roleCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Button */
  registerButton: {
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
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },

  /* Security note */
  securityNote: {
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
