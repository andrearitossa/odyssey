import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Button } from './Button';
import { theme } from '../theme';

export const LoadingView: React.FC<{ label?: string; style?: ViewStyle | ViewStyle[] }> = ({
  label = 'Loading...',
  style,
}) => {
  return (
    <View style={[styles.centered, style]}>
      <ActivityIndicator size="large" color={theme.colors.wine} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

export const ErrorView: React.FC<{
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle | ViewStyle[];
}> = ({ message, onRetry, retryLabel = 'Retry', style }) => {
  return (
    <View style={[styles.centered, style]}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? <Button label={retryLabel} onPress={onRetry} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  label: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.wineDark,
    marginBottom: 6,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
});
