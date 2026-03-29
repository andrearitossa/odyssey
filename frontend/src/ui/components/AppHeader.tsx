import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

type Props = {
  title: string;
  center?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export const AppHeader: React.FC<Props> = ({ title, center, left, right, style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>{center ? center : (
        <>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.goldUnderline} />
        </>
      )}</View>
      <View style={styles.side}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  side: {
    minWidth: 80,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.2,
  },
  goldUnderline: {
    height: 3,
    width: 56,
    marginTop: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.gold,
  },
});
