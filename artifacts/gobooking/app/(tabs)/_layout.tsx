import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import Colors from "@/constants/colors";

function TabIcon({
  name,
  focused,
  color,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  focused: boolean;
  color: string;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? Colors.light.primaryLight : "transparent",
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 5,
        marginTop: 2,
      }}
    >
      <Feather name={name} size={22} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : "white",
          borderTopWidth: 1,
          borderTopColor: "#E2E8F0",
          elevation: 12,
          shadowColor: "#0B3C5D",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.10,
          shadowRadius: 16,
          height: isWeb ? 76 : 66,
          paddingBottom: isWeb ? 14 : 10,
          paddingTop: 4,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "white" }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Trajets",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bookmark" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="colis"
        options={{
          title: "Colis",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="package" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="suivi"
        options={{
          title: "Suivi",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="map-pin" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="user" focused={focused} color={color} />
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
