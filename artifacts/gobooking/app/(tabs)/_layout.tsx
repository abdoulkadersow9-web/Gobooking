import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";

import Colors from "@/constants/colors";

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
  return (
    <View style={styles.tabItem}>
      <View
        style={[
          styles.iconPill,
          focused && styles.iconPillActive,
        ]}
      >
        <Feather name={name} size={20} color={color} />
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? Colors.light.primary : "#64748B" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isIOS ? "transparent" : "white",
          borderTopWidth: 1,
          borderTopColor: "#E8EDFF",
          elevation: 24,
          shadowColor: "#1650D0",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          height: Platform.OS === "web" ? 72 : 64,
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
    gap: 2,
    paddingTop: 4,
  },
  iconPill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconPillActive: {
    backgroundColor: "#DBEAFE",
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.15,
    textAlign: "center",
  },
});
