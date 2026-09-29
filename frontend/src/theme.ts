import { Platform, StyleSheet } from "react-native";

export const colors = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  raised: "#F3EEFF",
  text: "#1E293B",
  muted: "#64748B",
  accent: "#8B5CF6",
  line: "#E2E8F0",
  danger: "#DC2626",
  ink: "#FFFFFF",
};
export const fontFamily = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
});
export const layout = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    padding: 24,
    gap: 24,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontFamily,
    fontSize: 30,
    lineHeight: 38,
  },
  body: { color: colors.muted, fontSize: 16, lineHeight: 25 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});
