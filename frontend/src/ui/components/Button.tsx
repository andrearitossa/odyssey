import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost';
type Tone = 'default' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  tone?: Tone;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
};

export const Button: React.FC<Props> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  tone = 'default',
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const containerStyles: Array<ViewStyle> = [styles.base];
  const labelStyles: Array<TextStyle> = [styles.baseLabel];

  if (variant === 'primary') {
    containerStyles.push(tone === 'danger' ? styles.primaryDanger : styles.primary);
    labelStyles.push(styles.primaryLabel);
  }

  if (variant === 'secondary') {
    containerStyles.push(styles.secondary);
    labelStyles.push(styles.secondaryLabel);
  }

  if (variant === 'ghost') {
    containerStyles.push(styles.ghost);
    labelStyles.push(styles.ghostLabel);
  }

  if (isDisabled) {
    containerStyles.push(styles.disabled);
    if (variant !== 'ghost') labelStyles.push(styles.disabledLabel);
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [containerStyles, pressed && !isDisabled && styles.pressed, style]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' ? theme.colors.wine : theme.colors.textOnWine} />
      ) : (
        <Text style={[labelStyles, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  baseLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
  disabledLabel: {
    color: theme.colors.textMuted,
  },

  primary: {
    backgroundColor: theme.colors.wine,
  },
  primaryDanger: {
    backgroundColor: theme.colors.danger,
  },
  primaryLabel: {
    color: theme.colors.textOnWine,
  },

  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.wine,
  },
  secondaryLabel: {
    color: theme.colors.wine,
  },

  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  ghostLabel: {
    color: theme.colors.wine,
  },
});
