import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabParamList } from "../types";
import { WorldGenerationScreen } from "../screens/WorldGenerationScreen";
import { WorldSelectionScreen } from "../screens/WorldSelectionScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { colors } from "../theme";
const Tab = createBottomTabNavigator<BottomTabParamList>();
export function BottomTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="WorldSelection"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={
              route.name === "WorldSelection"
                ? "planet-outline"
                : route.name === "WorldGeneration"
                  ? "add-circle-outline"
                  : "person-outline"
            }
            color={color}
            size={size}
          />
        ),
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.line,
          height: 76,
          paddingTop: 10,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 11, marginTop: 4 },
      })}
    >
      <Tab.Screen
        name="WorldSelection"
        component={WorldSelectionScreen}
        options={{ title: "Explore" }}
      />
      <Tab.Screen
        name="WorldGeneration"
        component={WorldGenerationScreen}
        options={{ title: "Create" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "You" }}
      />
    </Tab.Navigator>
  );
}
