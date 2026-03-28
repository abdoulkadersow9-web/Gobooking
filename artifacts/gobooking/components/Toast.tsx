import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

export type ToastType = "success" | "error" | "info" | "warning";

const CONFIG: Record<ToastType, { bg: string; border: string; text: string; icon: string; iconColor: string }> = {
  success: { bg: "#ECFDF5", border: "#A7F3D0", text: "#065F46", icon: "check-circle",  iconColor: "#10B981" },
  error:   { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: "x-circle",      iconColor: "#EF4444" },
  info:    { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF", icon: "info",           iconColor: "#3B82F6" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "alert-triangle", iconColor: "#F59E0B" },
};

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
}

export function Toast({ visible, message, type = "success" }: ToastState) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      speed: 22,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const c = CONFIG[type];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { backgroundColor: c.bg, borderColor: c.border },
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] }) },
            { scale:       anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        },
      ]}
    >
      <Feather name={c.icon as any} size={17} color={c.iconColor} />
      <Text style={[styles.text, { color: c.text }]} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (message: string, type: ToastType = "success", duration = 3200) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ visible: true, message, type });
    timerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, duration);
  };

  return { toast, show };
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 12,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 9999,
  },
  text: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    lineHeight: 19,
  },
});
