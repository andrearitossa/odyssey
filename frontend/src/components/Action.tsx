import React from "react";
import { ActivityIndicator, Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

export function Action({
  label,
  onPress,
  disabled = false,
  busy = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {busy && (
        <ActivityIndicator color={secondary ? colors.accent : colors.ink} />
      )}
      <Text style={[styles.label, secondary && { color: colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: colors.accent,
    borderRadius: 28,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: { color: colors.ink, fontSize: 15, fontWeight: "600" },
});
