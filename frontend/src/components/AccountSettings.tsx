import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { Action } from "./Action";
import { colors, layout } from "../theme";
export function AccountSettings() {
  const { user, saveAccount, signOut } = useAuth();
  const [mode, setMode] = useState<"register" | "login" | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy || !mode || !validUsername || password.length < 10) return;
    setBusy(true);
    setError("");
    try {
      await saveAccount(username, password, mode === "login");
      setPassword("");
      setMode(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save account. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const validUsername = /^[a-zA-Z0-9_]{3,30}$/.test(username.trim());
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 18, color: colors.text, fontWeight: "600" }}>
        {user?.isGuest
          ? "Playing as a guest"
          : `Signed in as ${user?.username}`}
      </Text>
      <Text style={layout.body}>
        {user?.isGuest
          ? "Start playing right away. Add an account whenever you want to pick up your stories on another device."
          : "Your stories are linked to your account."}
      </Text>
      {user?.isGuest ? (
        !mode ? (
          <>
            <Action
              label="Add username & password"
              onPress={() => {
                setError("");
                setMode("register");
              }}
            />
            <Action
              label="I already have an account"
              secondary
              onPress={() => {
                setError("");
                setMode("login");
              }}
            />
          </>
        ) : (
          <>
            <Text style={layout.body}>
              {mode === "register"
                ? "Choose a username and password. Your stories will stay with you."
                : "Your current stories will join your account when you sign in."}
            </Text>
            <TextInput
              accessibilityLabel="Username"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              editable={!busy}
              maxLength={30}
              placeholder="Username"
              placeholderTextColor={colors.muted}
              value={username}
              onChangeText={setUsername}
              style={layout.input}
            />
            {mode === "register" && (
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                3–30 letters, numbers, or underscores.
              </Text>
            )}
            <TextInput
              accessibilityLabel="Password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              editable={!busy}
              maxLength={128}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              style={layout.input}
              onSubmitEditing={submit}
            />
            {mode === "register" && (
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                At least 10 characters.
              </Text>
            )}
            <Action
              label={mode === "register" ? "Save my account" : "Sign in"}
              busy={busy}
              disabled={!validUsername || password.length < 10}
              onPress={submit}
            />
            <Action
              label="Keep playing as guest"
              secondary
              disabled={busy}
              onPress={() => {
                setMode(null);
                setPassword("");
                setError("");
              }}
            />
          </>
        )
      ) : (
        <Action
          label="Sign out"
          secondary
          busy={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await signOut();
            } catch {
              setError("Could not sign out. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
}
