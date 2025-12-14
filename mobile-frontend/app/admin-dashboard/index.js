import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../utils/api";
import theme from "../../utils/theme";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import { useRouter } from "expo-router";
import { clearAuthData } from "../../utils/auth";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchStats = async () => {
    try {
      const res = await api.get("api/admin-dashboard/");
      console.log("admin data: ", res.data);
      setStats(res.data);
    } catch (error) {
      console.log("Inside admin error block.")
      console.error(error.response?.data || error.message);
      showErrorToast("Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const handleLogout = async () => {
    try {
      // await api.post("accounts/logout/");
      await clearAuthData();
      showSuccessToast("Logged out successfully.");
      router.replace("/login");
    } catch (error) {
      console.error("Logout error: ", error.response?.data || error.message);
      showErrorToast("Something went wrong while trying to logout, try again later.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >

        <Text style={{ color: theme.colors.lightText, fontSize: 20, fontWeight: "bold" }}>
          Admin Dashboard
        </Text>
        <TouchableOpacity onPress={handleLogout} style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="log-out-outline" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>


        {/* <View style={{ width: 24 }} /> */}
      </View>

      {/* Overview Cards */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          marginTop: 20,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: 10,
            padding: 16,
            alignItems: "center",
            width: "45%",
            elevation: 2,
          }}
        >
          <Ionicons name="cash-outline" size={28} color={theme.colors.primary} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: theme.colors.text }}>
            Total Commission
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: theme.colors.primary }}>
            Rs {stats.total_commission}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: 10,
            padding: 16,
            alignItems: "center",
            width: "45%",
            elevation: 2,
          }}
        >
          <Ionicons name="swap-horizontal-outline" size={28} color={theme.colors.primary} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: theme.colors.text }}>
            Total Transactions
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: theme.colors.primary }}>
            {stats.total_transactions}
          </Text>
        </View>
      </View>

      {/* Recent Commissions */}
      <View style={{ marginTop: 25, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text }}>
          Recent Commissions
        </Text>
      </View>

      <FlatList
        data={stats.recent}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: theme.colors.card,
              marginHorizontal: 20,
              marginTop: 10,
              borderRadius: 10,
              padding: 14,
              elevation: 1,
            }}
          >
            <Text style={{ fontWeight: "600", color: theme.colors.text }}>
              {item.chef}
            </Text>
            <Text style={{ color: theme.colors.oliveGreen }}>
              + Rs {item.amount.toFixed(2)}
            </Text>
            <Text style={{ color: theme.colors.textSecondary }}>
              Date: {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text
            style={{
              textAlign: "center",
              marginTop: 20,
              color: theme.colors.secondary,
            }}
          >
            No commission records found.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
