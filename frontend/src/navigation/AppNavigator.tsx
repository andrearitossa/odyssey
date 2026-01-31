import React, { useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootStackParamList } from '../types';

import { GoogleAuthScreen } from '../screens/GoogleAuthScreen';
import { SessionScreen } from '../screens/SessionScreen';
import { WorldGenerationScreen } from '../screens/WorldGenerationScreen';
import { BottomTabNavigator } from './BottomTabNavigator';
import { ChaptersScreen } from '../screens/ChaptersScreen';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { setGlobalAuthErrorHandler } from '../api/api';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppStack: React.FC = () => {
  const { handleAuthError, setOnAuthRequired, isAuthenticated, isAuthLoading } = useAuth();
  const navigation = useNavigation<any>();

  const handleNavToAuth = useCallback(() => {
    navigation.navigate('GoogleAuth');
  }, [navigation]);

  useEffect(() => {
    // Set up global auth error handler
    setGlobalAuthErrorHandler(handleAuthError);
    
    // Set up navigation callback for auth errors
    setOnAuthRequired(handleNavToAuth);
  }, [handleAuthError, setOnAuthRequired, handleNavToAuth]);

  useEffect(() => {
    if (!isAuthLoading) {
      if (isAuthenticated) {
        navigation.navigate('MainTabs');
      } else {
        navigation.navigate('GoogleAuth');
      }
    }
  }, [isAuthLoading, isAuthenticated, navigation]);

  return (
    <Stack.Navigator 
      initialRouteName="GoogleAuth"
      screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="GoogleAuth" component={GoogleAuthScreen} />
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="WorldGeneration" component={WorldGenerationScreen} />
      <Stack.Screen name="Session" component={SessionScreen} />
      <Stack.Screen name="Chapters" component={ChaptersScreen} />
    </Stack.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NavigationContainer>
          <AppStack />
        </NavigationContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}; 