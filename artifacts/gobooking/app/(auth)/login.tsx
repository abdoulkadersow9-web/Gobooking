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
  TouchableOpacity,
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
    agentRole?: "embarquement" | "reception_colis" | "vente" | "validation" | null;
    createdAt: string;
  };
}

const DEMO_ACCOUNTS = [
  { label: "Entreprise", email: "compagnie@test.com", password: "test123", color: "#1A56DB", bg: "#EEF2FF", icon: "briefcase" as const },
  { label: "Agent",      email: "agent@test.com",     password: "test123", color: "#059669", bg: "#ECFDF5", icon: "user"      as const },
  { label: "Admin",      email: "admin@test.com",      password: "test123", color: "#7C3AED", bg: "#F5F3FF", icon: "shield"    as const },
  { label: "Client",     email: "user@test.com",       password: "test123", color: "#0891B2", bg: "#ECFEFF", icon: "home"      as const },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [demoLoading, setDemoLoading]   = useState<string | null>(null);
  const [fieldError, setFieldError]     = useState("");
  const [serverError, setServerError]   = useState("");

  const doLogin = async (em: string, pw: string) => {
    const res = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: em.trim(), password: pw }),
    });
    await login(res.token, res.user);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
    router.replace(getDashboardPath(res.user.role, res.user.agentRole) as never);
  };

  const handleLogin = async () => {
    setFieldError("");
    setServerError("");

    if (!email.trim() && !password.trim()) {
      setFieldError("Veuillez remplir tous les champs.");
      return;
    }
    if (!email.trim()) {
      setFieldError("L'adresse email est requise.");
      return;
    }
    if (!password.trim()) {
      setFieldError("Le mot de passe est requis.");
      return;
    }

    setLoading(true);
    try {
      await doLogin(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connexion échouée. Vérifiez vos identifiants.";
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (account: typeof DEMO_ACCOUNTS[0]) => {
    setFieldError("");
    setServerError("");
    setDemoLoading(account.label);
    try {
      await doLogin(account.email, account.password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Impossible de se connecter avec ce compte démo.";
      setServerError(msg);
    } finally {
      setDemoLoading(null);
    }
  };

  const errorMessage = fieldError || serverError;
  const isServerErr = !!serverError && !fieldError;

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
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20,
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
            <Feather name="navigation" size={32} color="white" />
          </View>
          <Text style={styles.appName}>GoBooking</Text>
          <Text style={styles.tagline}>Voyagez partout en Côte d'Ivoire</Text>
        </LinearGradient>

        <View style={styles.formCard}>
          {/* ── Accès rapide démo ── */}
          <View style={styles.demoBox}>
            <View style={styles.demoHeader}>
              <Feather name="zap" size={14} color="#D97706" />
              <Text style={styles.demoTitle}>Accès rapide (démo)</Text>
            </View>
            <View style={styles.demoGrid}>
              {DEMO_ACCOUNTS.map((acc) => (
                <TouchableOpacity
                  key={acc.label}
                  style={[styles.demoBtn, { backgroundColor: acc.bg, borderColor: acc.color + "33" }]}
                  onPress={() => handleDemoLogin(acc)}
                  activeOpacity={0.75}
                  disabled={demoLoading !== null || loading}
                >
                  {demoLoading === acc.label ? (
                    <ActivityIndicator size="small" color={acc.color} />
                  ) : (
                    <Feather name={acc.icon} size={16} color={acc.color} />
                  )}
                  <Text style={[styles.demoBtnText, { color: acc.color }]}>{acc.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou connexion manuelle</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Titre ── */}
          <Text style={styles.welcomeTitle}>Connexion</Text>
          <Text style={styles.welcomeSubtitle}>Entrez vos identifiants GoBooking</Text>

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

          {/* ── Email ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[
              styles.inputContainer,
              fieldError && !email.trim() && styles.inputError,
            ]}>
              <Feather name="mail" size={18} color={Colors.light.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="vous@exemple.com"
                placeholderTextColor={Colors.light.textMuted}
                value={email}
                onChangeText={(t) => { setEmail(t); setFieldError(""); setServerError(""); }}
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
              fieldError && !password.trim() && styles.inputError,
            ]}>
              <Feather name="lock" size={18} color={Colors.light.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Votre mot de passe"
                placeholderTextColor={Colors.light.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); setFieldError(""); setServerError(""); }}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.light.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* ── Bouton Se connecter ── */}
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
              (loading || demoLoading !== null) && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading || demoLoading !== null}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather name="log-in" size={18} color="white" />
                <Text style={styles.loginButtonText}>Se connecter</Text>
              </>
            )}
          </Pressable>

          {/* ── Lien inscription ── */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Pas encore de compte ?</Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.registerLink}>S'inscrire</Text>
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
    paddingTop: 50,
    paddingBottom: 64,
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
    paddingTop: 28,
  },

  /* Demo */
  demoBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 4,
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  demoTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#92400E",
  },
  demoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: "45%",
    flex: 1,
    justifyContent: "center",
  },
  demoBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  /* Divider */
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },

  /* Title */
  welcomeTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 2,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginBottom: 16,
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
    marginBottom: 14,
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
    marginBottom: 14,
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

  /* Button */
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 6,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },

  /* Footer */
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  registerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
});
