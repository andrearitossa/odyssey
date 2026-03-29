import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
};

export const Screen: React.FC<Props> = ({ children, style, padded = false }) => {
  return (
    <SafeAreaView style={[styles.container, padded && styles.padded, style]} edges={['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  padded: {
    padding: theme.spacing.md,
  },
});
