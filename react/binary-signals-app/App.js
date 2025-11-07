import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Image, View, Text } from "react-native";

import HomeScreen from "./screens/HomeScreen";
import HistoryScreen from "./screens/HistoryScreen";
import StatsScreen from "./screens/StatsScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#fff",
          tabBarStyle: { backgroundColor: "#111" },
          tabBarActiveTintColor: "#00ff99",
          tabBarInactiveTintColor: "#999",
          tabBarIcon: ({ color, size }) => {
            let icon;
            if (route.name === "Señales") icon = "trending-up";
            if (route.name === "Historial") icon = "time";
            if (route.name === "Estadísticas") icon = "bar-chart";
            return <Ionicons name={icon} size={size} color={color} />;
          },
          // 👇 Configura encabezado con logo al lado del título
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image
                source={require("./assets/markbot.png")}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius:8,
                  marginRight: 8,
                }}
              />
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold" }}>
                {route.name}
              </Text>
            </View>
          ),
        })}
      >
        <Tab.Screen name="Señales" component={HomeScreen} />
        <Tab.Screen name="Historial" component={HistoryScreen} />
        <Tab.Screen name="Estadísticas" component={StatsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
