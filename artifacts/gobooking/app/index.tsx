import { router } from "expo-router";
import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";

import { getDashboardPath, useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace(getDashboardPath(user.role) as never);
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [user, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
  },
});
