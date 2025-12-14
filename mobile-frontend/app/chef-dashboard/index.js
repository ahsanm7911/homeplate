import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../utils/api";
import { getAuthData, clearAuthData } from "../../utils/auth";
import theme from "../../utils/theme";
import { useWebSocket } from "../../contexts/WebSocketContext";
import { showErrorToast, showInfoToast, showSuccessToast } from "../../utils/toast";

import PlaceBidModal from "./PlaceBidModal";

const FILTERS = ['Open Orders', 'Bid Placed', 'Preparing', 'Delivering', 'Closed Orders'];

export default function ChefDashboard() {
  const [currentChefId, setCurrentChefId] = useState(null);
  const { ws, messages, connected } = useWebSocket();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Open Orders");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [bids, setBids] = useState([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      const response = await api.get("api/orders/", {
        headers: { Authorization: `Token ${token}` },
      });
      setOrders(response.data);
    } catch (error) {
      console.error("Order fetch error: ", error);
      showErrorToast("Failed to load orders!")
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
      const { token } = await getAuthData();
      const response = await api.get('api/bids/my-bids/', {
        headers: { Authorization: `Token ${token}` },
      });
      setBids(response.data);
    } catch (error) {
      console.error("Bid fetch error: ", error);
    }
  }


  useEffect(() => {
    const fetchChefId = async () => {
      const { user } = await getAuthData();
      const userId = JSON.parse(user).id;
      setCurrentChefId(userId);
    }
    fetchChefId();
    console.log("Current chef id: ", currentChefId);
    fetchOrders();
    fetchBids();
    if (!connected) {
      console.log("Connecting to live updates...");
      return;
    };
    console.log("Connected to live updates.");
    ws.onmessage = (event) => {
      console.log("Event value: ", event);
      const res = JSON.parse(event.data);
      console.log("Message received: ", res);
      if (res.event === 'bid_accepted') {
        showSuccessToast(`${res.data.message}`, "Bid Accepted");
      } else if (res.event === 'order_created') {
        showInfoToast("New order received, place your bid now!", "New Order!");
      } else if ((res.event === 'order_completed') && res.data.accepted_chef == currentChefId) {
        console.log("Displaying order_updated.");
        showInfoToast(`Your order was delivered to ${res.data.customer_name}`, "Order Completed")
      } else if ((res.event === 'review_updated') && res.data.accepted_chef == currentChefId) {
        console.log("Displaying review_updated");
        showInfoToast(`You have received a review by ${res.data.customer_name}`, "New Review")
      }
      fetchOrders();
      fetchBids();
    }

  }, [ws]);

  const hasPlacedBid = (orderId) => {
    return bids.some((bid) => bid.order === orderId);
  }
  const handlePlaceBid = (order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === "Open Orders")
      return order.status === "open" && !hasPlacedBid(order.id);

    if (activeFilter === "Bid Placed")
      return hasPlacedBid(order.id) && order.status === "open";

    if (activeFilter === "Preparing") {
      // show only orders whose accepted_chef matches current chef
      return (
        order.status === "accepted" && order.accepted_chef == currentChefId
      );
    }

    if (activeFilter === 'Delivering') {
      return (
        order.status === "delivered" && order.accepted_chef == currentChefId
      )
    }

    if (activeFilter === "Closed Orders")
      return order.status === "completed" && order.accepted_chef == currentChefId;

    return true;
  })

  const handleFulfillorder = async (orderId) => {
    try {
      const response = await api.post(`api/orders/${orderId}/fulfill/`);
      showSuccessToast("Order marked as deliverd.");
      await fetchOrders();
    } catch (error) {
      console.error("Fulfill order error: ", error.response?.data || error.message);
      showErrorToast((
        error.response?.data?.detail || "Failed to mark order as delivered."
      ))
    }
  }

  const handleLogout = async () => {
    try {
      // await api.post("accounts/logout/");
      ws?.close();
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
          marginBottom: 12,
        }}
      >
        <Text style={{ color: theme.colors.lightText, fontSize: 22, fontWeight: "bold" }}>
          Chef Dashboard
        </Text>

        <View style={{
          flexDirection: "row",
          alignItems: "center"
        }}>

          <TouchableOpacity onPress={() => router.push("/chef-dashboard/statistics")}>
            <Ionicons name="stats-chart-outline" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/chef-dashboard/wallet")}
            style={{
              marginHorizontal: 6,
            }}>
            <Ionicons name="wallet-outline" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>


          <TouchableOpacity
            onPress={() => router.push("/chat")}
            style={{
              marginHorizontal: 6,
              borderRadius: 50,
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout} style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="log-out-outline" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>
        </View>

      </View>

      {/* Filter Buttons */}
      <View style={{ marginBottom: 10}}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={{
                backgroundColor:
                  activeFilter === filter ? theme.colors.rusticOrange : theme.colors.oliveGreen,
                paddingVertical: 8,
                marginHorizontal: 6,
                paddingHorizontal: 12,
                height: 38,
                borderRadius: 25,
              }}
            >
              <Text style={{ color: theme.colors.creamyWhite, fontWeight: "600" }}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>


      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : filteredOrders.length === 0 ? (
        <Text style={{ textAlign: "center", color: theme.colors.charcoalGray, marginTop: 30 }}>No orders found.</Text>
      ) : (
        <FlatList
          style={{ paddingHorizontal: 16 }}
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const bidPlaced = hasPlacedBid(item.id);
            return (
              <View
                style={{
                  backgroundColor: theme.colors.card,
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={() => router.push(`/chef-dashboard/order/${item.id}`)}
                  style={{
                    backgroundColor: theme.colors.creamyWhite,
                    padding: 15,
                    borderRadius: 10,
                    marginBottom: 12,
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.text }}>{item.title}</Text>
                  <Text style={{ color: theme.colors.text, marginTop: 4 }}>{item.description}</Text>
                  <Text style={{ marginTop: 6, color: theme.colors.text }}>
                    💰 Budget: Rs. {item.max_budget} | 🕓 {new Date(item.preferred_delivery_time).toLocaleTimeString()}
                  </Text>
                </TouchableOpacity>
                {
                  item.status === 'accepted' || item.status === 'delivered' || item.status === 'completed' ? (

                    <TouchableOpacity
                      disabled={item.status === 'delivered'}
                      style={{
                        backgroundColor: theme.colors.card,
                        paddingVertical: 10,
                        borderRadius: 8,
                        marginTop: 10
                      }}
                      onPress={() => handleFulfillorder(item.id)}>
                      <Text style={{
                        color: theme.colors.oliveGreen, textAlign: "center", fontWeight: "600"
                      }}>{item.status === 'delivered' ? "Order delivered" : item.status === "completed" ? "✅ Completed" : "📦 Fulfill Order"}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      disabled={bidPlaced}
                      style={{
                        backgroundColor: bidPlaced ? theme.colors.softGray : theme.colors.rusticOrange,
                        paddingVertical: 10,
                        borderRadius: 8,
                        marginTop: 10,
                      }}
                      onPress={() => handlePlaceBid(item)}
                    >
                      <Text style={{ color: theme.colors.text, textAlign: "center", fontWeight: "600" }}>
                        {bidPlaced ? "✔️ Bid Placed" : "Place Bid"}
                      </Text>
                    </TouchableOpacity>
                  )
                }

              </View>
            )
          }}
          ListEmptyComponent={<Text style={{ color: theme.colors.text, textAlign: "center", marginTop: 50 }}>No new orders yet 🍳</Text>}
        />
      )}



      <PlaceBidModal
        visible={isModalVisible}
        onClose={() => setModalVisible(false)}
        order={selectedOrder}
        refreshOrders={fetchOrders}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filtersContainer: {
    paddingHorizontal: 10,
  }
})