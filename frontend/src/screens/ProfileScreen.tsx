import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabParamList, RootStackParamList } from "../types";
import {
  ProfileAPI,
  ProfileResponse,
  SUPPORTED_LANGUAGES,
} from "../api/profile";
import { AccountSettings } from "../components/AccountSettings";
import { useAuth } from "../contexts/AuthContext";
import { Action } from "../components/Action";
import { colors, layout, fontFamily } from "../theme";
type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, "Profile">,
  NativeStackScreenProps<RootStackParamList>
>;
export function ProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      setSaved(false);
      ProfileAPI.getProfile()
        .then((data) => {
          if (active) {
            setProfile(data);
            setName(data.user.name);
            setLanguage(data.user.language);
          }
        })
        .catch(() => {
          if (active) setError("Your profile couldn’t load. Try again.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt, user?.id]),
  );
  const save = async () => {
    if (pending.current || !name.trim()) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      setProfile(
        await ProfileAPI.updateProfile({ name: name.trim(), language }),
      );
      setName(name.trim());
      setSaved(true);
    } catch {
      setError("Your changes couldn’t be saved. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const changed =
    profile &&
    (name.trim() !== profile.user.name || language !== profile.user.language);
  const adventures =
    profile?.userWorlds.filter(
      (world, index, worlds) =>
        worlds.findIndex(
          (candidate) => candidate.world_id === world.world_id,
        ) === index,
    ) ?? [];
  return (
    <SafeAreaView edges={["top"]} style={layout.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[layout.page, { maxWidth: 760, paddingTop: 48 }]}
      >
        <Text style={layout.eyebrow}>PROFILE</Text>
        <Text style={layout.title}>Your profile</Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            {!!error && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {error}
              </Text>
            )}
            {!profile ? (
              <Action
                label="Try again"
                onPress={() => setAttempt((n) => n + 1)}
              />
            ) : (
              <>
                <Text style={styles.label}>What should we call you?</Text>
                <TextInput
                  accessibilityLabel="Your name"
                  style={layout.input}
                  value={name}
                  maxLength={100}
                  editable={!busy}
                  onChangeText={(value) => {
                    setName(value);
                    setSaved(false);
                  }}
                />
                <Text style={styles.label}>Tell my stories in</Text>
                <View style={[layout.row, { flexWrap: "wrap" }]}>
                  {SUPPORTED_LANGUAGES.map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: value === language }}
                      disabled={busy}
                      onPress={() => {
                        setLanguage(value);
                        setSaved(false);
                      }}
                      style={[
                        styles.language,
                        value === language && {
                          borderColor: colors.accent,
                          backgroundColor: colors.raised,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            value === language ? colors.accent : colors.muted,
                        }}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Action
                  label={
                    busy
                      ? "Saving…"
                      : saved
                        ? "Changes saved ✓"
                        : "Save changes"
                  }
                  onPress={save}
                  busy={busy}
                  disabled={!changed || !name.trim()}
                />
                <Text style={styles.section}>Your adventures</Text>
                {adventures.length ? (
                  adventures.map((world) => (
                    <Pressable
                      key={world.session_id}
                      accessibilityRole="button"
                      accessibilityLabel={`Continue ${world.world_title}`}
                      onPress={() =>
                        navigation.navigate("Session", {
                          worldId: world.world_id,
                          worldTitle: world.world_title,
                        })
                      }
                      style={styles.adventure}
                    >
                      <Text
                        style={[layout.body, { flex: 1, color: colors.text }]}
                      >
                        {world.world_title}
                      </Text>
                      <Text style={{ color: colors.accent }}>Continue ↗</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={layout.body}>
                    Your adventures will find a home here.
                  </Text>
                )}
              </>
            )}
          </>
        )}
        <AccountSettings />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 14 },
  language: {
    padding: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  section: {
    color: colors.text,
    fontFamily: fontFamily,
    fontSize: 28,
    marginTop: 24,
  },
  adventure: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
});
