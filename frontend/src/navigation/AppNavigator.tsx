import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View, Text } from "react-native";
import { RootStackParamList } from "../types";
import { Action } from "../components/Action";
import { SessionScreen } from "../screens/SessionScreen";
import { BottomTabNavigator } from "./BottomTabNavigator";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { colors, layout } from "../theme";
const Stack = createNativeStackNavigator<RootStackParamList>();
function AppStack() {
  const { user, isAuthenticated, isAuthLoading, error, checkAuth } = useAuth();
  if (isAuthLoading)
    return (
      <View style={[layout.screen, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  if (!isAuthenticated)
    return (
      <View
        style={[
          layout.screen,
          {
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            gap: 20,
          },
        ]}
      >
        <Text style={layout.title}>Odyssey</Text>
        <Text accessibilityRole="alert" style={layout.body}>
          {error}
        </Text>
        <Action label="Reconnect" onPress={checkAuth} />
      </View>
    );
  return (
    <Stack.Navigator
      key={user?.id}
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="Session" component={SessionScreen} />
    </Stack.Navigator>
  );
}
export function AppNavigator() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer
            theme={{
              ...DefaultTheme,
              colors: {
                ...DefaultTheme.colors,
                background: colors.background,
                card: colors.surface,
                text: colors.text,
                primary: colors.accent,
                border: colors.line,
              },
            }}
          >
            <AppStack />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
