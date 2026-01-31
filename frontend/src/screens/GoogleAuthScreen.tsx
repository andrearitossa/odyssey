import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { CrossPlatformOAuthService } from '../services/CrossPlatformOAuthService';
import { ErrorHandlingService, ErrorDisplayInfo } from '../services/ErrorHandlingService';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'GoogleAuth'>;

export const GoogleAuthScreen: React.FC<Props> = ({ navigation }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorDisplayInfo | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  
  const { user, isAuthenticated, isAuthLoading, checkAuth } = useAuth();
  const oauthService = CrossPlatformOAuthService.getInstance();
  const errorHandler = ErrorHandlingService.getInstance();

  useEffect(() => {
    // If already authenticated, navigate to main app
    if (isAuthenticated && user) {
      navigation.replace('MainTabs');
    }
  }, [isAuthenticated, user, navigation]);

  const handleGoogleSignIn = async () => {
    // Prevent multiple simultaneous attempts
    if (oauthService.isAuthenticationInProgress()) {
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);
      
      const result = await oauthService.authenticate();
      
      if (result.success) {
        setErrorInfo(null);
        setRetryAttempts(0);
        
        // Refresh auth state and navigate
        await checkAuth();
        navigation.replace('MainTabs');
      } else if (result.cancelled) {
        setAuthError('Authentication was cancelled. Please try again.');
        setErrorInfo(null);
      } else {
        const errorDisplayInfo = errorHandler.getErrorDisplayInfo(new Error(result.error || 'Authentication failed'));
        setErrorInfo(errorDisplayInfo);
        setAuthError(errorDisplayInfo.message);
        setRetryAttempts(prev => prev + 1);
      }
    } catch (error) {
      errorHandler.logError(error, 'google_signin');
      const errorDisplayInfo = errorHandler.getErrorDisplayInfo(error);
      setErrorInfo(errorDisplayInfo);
      setAuthError(errorDisplayInfo.message);
      setRetryAttempts(prev => prev + 1);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleTryAgain = async () => {
    setAuthError(null);
    setErrorInfo(null);
    setIsAuthenticating(false);
    
    // Clear any existing auth state if this is a retry after multiple attempts
    if (retryAttempts > 2) {
      try {
        await oauthService.signOut();
        setRetryAttempts(0);
      } catch (error) {
        errorHandler.logError(error, 'clear_auth_state');
      }
    }
  };

  const handleRetryAuthentication = async () => {
    if (errorInfo?.retryable) {
      await handleGoogleSignIn();
    } else {
      await handleTryAgain();
    }
  };

  // Show loading while checking existing auth
  if (isAuthLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.gold} />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </View>
    );
  }

  // Authentication in progress
  if (isAuthenticating) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            {/* <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            /> */}
            <Text style={styles.title}>Odyssey</Text>
            <Text style={styles.subtitle}>AI-Powered Storytelling</Text>
          </View>

          <View style={styles.authContainer}>
            <ActivityIndicator size="large" color={theme.colors.gold} />
            <Text style={styles.authText}>Authenticating...</Text>
            <Text style={styles.authSubtext}>
              Complete the sign-in in your browser. We'll bring you back automatically!
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={handleTryAgain}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Error state
  if (authError) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            {/* <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            /> */}
            <Text style={styles.title}>Odyssey</Text>
            <Text style={styles.subtitle}>AI-Powered Storytelling</Text>
          </View>

          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {errorInfo?.severity === 'critical' ? '🚫' : 
               errorInfo?.severity === 'high' ? '⚠️' : 
               errorInfo?.retryable ? '🔄' : '❌'} {errorInfo?.title || 'Authentication Failed'}
            </Text>
            <Text style={styles.errorDescription}>{authError}</Text>
            
            {retryAttempts > 1 && (
              <Text style={styles.retryInfo}>
                Attempt {retryAttempts}/3
              </Text>
            )}
            
            {errorInfo?.userFriendlyCode && (
              <Text style={styles.errorCode}>
                Error Code: {errorInfo.userFriendlyCode}
              </Text>
            )}
          </View>

          <View style={styles.errorActions}>
            {errorInfo?.retryable && (
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={handleRetryAuthentication}
              >
                <Text style={styles.primaryButtonText}>
                  {retryAttempts > 1 ? 'Retry Authentication' : 'Try Again'}
                </Text>
              </TouchableOpacity>
            )}
            
            {!errorInfo?.retryable || retryAttempts > 2 ? (
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={handleTryAgain}
              >
                <Text style={styles.secondaryButtonText}>Start Over</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  // Main authentication screen
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.title}>Welcome to Odyssey</Text>
          <Text style={styles.subtitle}>Have you ever wanted to be a wizard in the Harry Potter world? Odyssey lets you become the first character in your favorite stories!</Text>
        </View>

        <View style={styles.descriptionContainer}>
          <Image 
            source={require('../../assets/odissea_load.gif')} 
            // style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.authContainer}>
          <TouchableOpacity 
            style={styles.googleButton} 
            onPress={handleGoogleSignIn}
            disabled={isAuthenticating}
          >
            <Text style={styles.googleButtonText}>
              Sign in with Google
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.wineDark,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
  logo: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.textOnWine,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.goldSoft,
    textAlign: 'center',
  },
  descriptionContainer: {
    marginVertical: 24,
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    color: '#E0E7FF',
    textAlign: 'center',
    lineHeight: 24,
  },
  pocBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: theme.colors.gold,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  pocBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.gold,
    letterSpacing: 1,
  },
  authContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  googleButton: {
    backgroundColor: theme.colors.wine,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.goldSoft,
    ...theme.shadow,
    marginBottom: 16,
    minWidth: 250,
  },
  googleButtonText: {
    color: theme.colors.textOnWine,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  authNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  authText: {
    fontSize: 18,
    color: theme.colors.textOnWine,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  authSubtext: {
    fontSize: 14,
    color: theme.colors.goldSoft,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  errorContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  errorText: {
    fontSize: 18,
    color: theme.colors.danger,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: theme.colors.goldSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: theme.colors.wine,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.goldSoft,
    ...theme.shadow,
    minWidth: 200,
    alignSelf: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.goldSoft,
    marginTop: 16,
    textAlign: 'center',
  },
  retryInfo: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorCode: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  errorActions: {
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignSelf: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.gold,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 