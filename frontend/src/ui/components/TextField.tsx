import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  label: string;
  required?: boolean;
  containerTestID?: string;
} & TextInputProps;

export const TextField: React.FC<Props> = ({ label, required, containerTestID, style, ...props }) => {
  return (
    <View style={styles.group} testID={containerTestID}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        {...props}
        style={[styles.input, style]}
        placeholderTextColor={theme.colors.textMuted}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  group: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  required: {
    color: theme.colors.goldDark,
    fontWeight: '900',
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  },
});
