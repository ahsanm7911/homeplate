import React, { useEffect, useRef } from "react";
import { View, Text, Animated, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { getAuthData } from "../utils/auth";
import theme from "../utils/theme";

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    const checkAuth = async () => {
      try {
        const authData = await getAuthData();

        setTimeout(() => {
          if (authData && authData.token && authData.userType) {
            // Redirect to correct dashboard
            router.replace(
              authData.userType === "chef"
                ? "/chef-dashboard" : authData.userType === 'customer' 
                ? "/customer-dashboard" : '/admin-dashboard'
            );
          } else {
            router.replace("/login");
          }
        }, 1500); // slight delay for splash animation
      } catch (error) {
        console.error("Error checking auth:", error);
        router.replace("/login");
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.logo}>🍲 HomePlate</Text>
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={{ marginTop: 20 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    fontSize: 36,
    fontWeight: "700",
    color: theme.colors.primary,
  },
});
