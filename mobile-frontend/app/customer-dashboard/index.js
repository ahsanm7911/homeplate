import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import StarRating from "react-native-star-rating-widget";
import { useWebSocket } from "../../contexts/WebSocketContext";
import api from "../../utils/api";
import { clearAuthData } from "../../utils/auth";
import theme from "../../utils/theme";
import { showErrorToast, showInfoToast, showSuccessToast } from "../../utils/toast";

export default function CustomerDashboard() {
  const { ws, messages, connected } = useWebSocket();

  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("open");
  const [refreshing, setRefreshing] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const filters = [
    { key: "open", label: "Open Orders" },
    { key: "accepted", label: "In Progress" },
    { key: "completed", label: "Completed" },
  ];

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get("api/orders/my/");
      setOrders(response.data || []);
    } catch (error) {
      console.error(error.response?.data || error.message);
      showErrorToast("Error loading orders, please try again later.")
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  useEffect(() => {
    fetchOrders();
    if (!connected) {
      console.log("Connecting to live updates...");
      return;
    };
    console.log("Connected to live updates.");
    ws.onmessage = (event) => {
      // console.log("Event value: ", event);
      const res = JSON.parse(event.data);
      console.log("Message received: ", res);
      if (res.event === 'bid_placed') {
        showInfoToast(`You have received a new bid by chef: ${res.data.chef_name}`, 'New Bid');
        fetchOrders();
      } else if (res.event == 'order_delivered') {
        showInfoToast(`Your order ${res.data.title} was fulfilled.`, "Order fulfilled");
        fetchOrders();
      } else if (res.event == 'order_accepted') {
        showInfoToast(`Your order is assigned to ${res.data.accepted_chef_name}`, "Order assigned")
        fetchOrders();
      } else if (res.event == 'order_completed') {
        setReviewModalVisible(true);
      }
    }
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (selectedFilter === "accepted") {
      return order.status === "accepted" || order.status === "delivered";
    }
    return order.status === selectedFilter;
  });


  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // 1️⃣ Mark order as complete
  const handleMarkComplete = async (order_id) => {
    try {
      setLoading(true);
      const response = await api.post(`api/orders/${order_id}/complete/`);
      console.log("Order Completed:", response.data);
      showSuccessToast("Order marked as complete!");
      setCurrentOrderId(order_id);
    } catch (error) {
      console.error("Error marking complete:", error.response?.data || error.message);
      showErrorToast(error.response?.data?.detail || "Unable to mark order as complete");
    } finally {
      setLoading(false);
    }
  };

  // 2️⃣ Submit review
  const handleSubmitReview = async (order_id) => {
    try {
      setSubmittingReview(true);
      console.log(`Rating: ${rating}, Comment: ${comment}`);
      await api.post(
        `api/orders/${order_id}/review/`,
        { rating, comment },
      );
      showSuccessToast("Thank you for your feedback!");
      setReviewModalVisible(false);
      setRating(0);
      setComment("");
      setCurrentOrderId(null);
      fetchOrders();
    } catch (error) {
      console.error("Review error:", error.response?.data || error.message);
      showErrorToast("Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderOrderItem = ({ item }) => (
    <View>
      <TouchableOpacity
        onPress={() => router.push(`/customer-dashboard/order/${item.id}`)}
        style={{
          backgroundColor: theme.colors.card,
          marginVertical: 8,
          marginHorizontal: 16,
          borderRadius: 12,
          padding: 16,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.text }}>
            {item.title}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
            Budget: Rs. {item.max_budget}
          </Text>
          <Text style={{ color: theme.colors.textSecondary }}>
            Status: {item.status.replace("_", " ") === 'delivered' ? "Delivering" : item.status.replace("_", " ")}
          </Text>
          <Text style={{ color: theme.colors.textSecondary }}>
            Bids: {item.total_bids || 0}
          </Text>
          {item.status === 'delivered' && (

            <TouchableOpacity
              onPress={() => handleMarkComplete(item.id)}
              style={{
                backgroundColor: theme.colors.primary,
                paddingVertical: 10,
                borderRadius: 8,
                marginTop: 10,
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (

                <Text
                  style={{
                    color: "#fff",
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  Mark as Complete
                </Text>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>
      </TouchableOpacity>

      <Modal visible={reviewModalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "85%",
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text }}>
              Rate your Chef
            </Text>

            <StarRating
              rating={rating}
              onChange={setRating}
              color={theme.colors.primary}
              starSize={32}
              style={{ marginVertical: 10 }}
            />

            <TextInput
              placeholder="Write a short review (optional)"
              placeholderTextColor={theme.colors.border}
              value={comment}
              onChangeText={setComment}
              multiline
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 8,
                padding: 10,
                minHeight: 80,
                color: theme.colors.text,
                marginBottom: 15,
              }}
            />

            <TouchableOpacity
              style={{
                backgroundColor: theme.colors.primary,
                paddingVertical: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
              onPress={() => handleSubmitReview(currentOrderId)}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>
                  Submit Review
                </Text>
              )}
            </TouchableOpacity>
            
          </View>
        </View>
      </Modal>
    </View>

  );

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
        <Text style={{ color: theme.colors.lightText, fontSize: 22, fontWeight: "bold" }}>
          Customer Dashboard
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center"
          }}>
          <TouchableOpacity onPress={() => router.push("/top-chefs")}>
            <Ionicons name="restaurant-outline" size={24} color={theme.colors.lightText} />
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

      {/* Filters */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          paddingVertical: 12,
        }}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            onPress={() => setSelectedFilter(filter.key)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 16,
              borderRadius: 20,
              backgroundColor:
                selectedFilter === filter.key ? theme.colors.primary : theme.colors.softGray,
            }}
          >
            <Text
              style={{
                color:
                  selectedFilter === filter.key ? theme.colors.lightText : theme.colors.text,
                fontWeight: "500",
              }}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>


      {/* Orders Section */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : filteredOrders.length > 0 ? (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        />
      ) : (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: theme.colors.secondary, fontSize: 16 }}>
            No {selectedFilter} orders found.
          </Text>
        </View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => router.push("/create-order")}
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          backgroundColor: theme.colors.primary,
          padding: 16,
          borderRadius: 50,
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={28} color={theme.colors.lightText} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
