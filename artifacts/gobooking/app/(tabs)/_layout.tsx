import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const _ws = (css: string): any => Platform.OS === "web" ? { boxShadow: css } : {};

function TabIcon({
  name,
  focused,
  color,
  label,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  focused: boolean;
  color: string;
  label: string;
}) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.92)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.92,
        speed: 20,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0.6,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={[styles.tabItem, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      <View
        style={[
          styles.iconPill,
          focused && styles.iconPillActive,
        ]}
      >
        <Feather name={name} size={22} color={color} />
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? Colors.light.primary : "#94A3B8" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const { bottom: bottomInset } = useSafeAreaInsets();

  const tabBarHeight = Platform.OS === "web" ? 82 : 68 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isIOS ? "transparent" : "white",
          borderTopWidth: 1,
          borderTopColor: "#DDE4F5",
          elevation: 24,
          shadowColor: "#1650D0",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.10,
          shadowRadius: 16,
          height: tabBarHeight,
          paddingBottom: Platform.OS === "web" ? 10 : bottomInset + 2,
          zIndex: 1000,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={95}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "white" }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" focused={focused} color={color} label="Accueil" />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Trajets",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="map" focused={focused} color={color} label="Trajets" />
          ),
        }}
      />
      <Tabs.Screen
        name="colis"
        options={{
          title: "Colis",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="package" focused={focused} color={color} label="Colis" />
          ),
        }}
      />
      <Tabs.Screen
        name="suivi"
        options={{
          title: "Suivi",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="map-pin" focused={focused} color={color} label="Suivi" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="user" focused={focused} color={color} label="Profil" />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 6,
    minWidth: 56,
  },
  iconPill: {
    width: 64,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconPillActive: {
    backgroundColor: "#1650D0",
    shadowColor: "#1650D0",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 9,
    ..._ws("0 5px 14px rgba(22,80,208,0.42)"),
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.15,
    textAlign: "center",
  },
});
