import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabParamList, RootStackParamList, World } from "../types";
import { getAllWorlds } from "../api";
import { ProfileAPI } from "../api/profile";
import { useAuth } from "../contexts/AuthContext";
import { SessionManager } from "../utils/storage";
import { colors, layout, fontFamily } from "../theme";
import { Action } from "../components/Action";
type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, "WorldSelection">,
  NativeStackScreenProps<RootStackParamList>
>;
export function WorldSelectionScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [active, setActive] = useState<string[]>([]);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [recentExcerpt, setRecentExcerpt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { width } = useWindowDimensions();
  useEffect(() => {
    let current = true;
    setRecentExcerpt("");
    if (recentId) {
      void SessionManager.getSessionByWorld(recentId)
        .then(({ messages }) => {
          const scene = [...(messages ?? [])]
            .reverse()
            .find((message) => message.type === "narrator");
          if (current)
            setRecentExcerpt(scene?.text.replace(/\s+/g, " ").trim() ?? "");
        })
        .catch(() => {});
    }
    return () => {
      current = false;
    };
  }, [recentId, user?.id]);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      setLoading(true);
      setError("");
      setQuery("");
      setActive([]);
      setRecentId(null);
      void ProfileAPI.getProfile()
        .then((profile) => {
          if (current) {
            if (profile.userWorlds[0])
              setRecentId(profile.userWorlds[0].world_id);
            setActive((activeWorlds) => [
              ...new Set([
                ...activeWorlds,
                ...profile.userWorlds.map((world) => world.world_id),
              ]),
            ]);
          }
        })
        .catch(() => {});
      Promise.all([getAllWorlds(), SessionManager.getAllActiveSessions()])
        .then(([data, sessions]) => {
          if (current) {
            setWorlds(data);
            const mostRecent = sessions.sort(
              (a, b) => b.lastActive.getTime() - a.lastActive.getTime(),
            )[0];
            if (mostRecent)
              setRecentId(
                (currentRecent) => currentRecent ?? mostRecent.worldId,
              );
            setActive((activeWorlds) => [
              ...new Set([...activeWorlds, ...sessions.map((s) => s.worldId)]),
            ]);
          }
        })
        .catch(() => {
          if (current)
            setError("Your worlds couldn’t load. Let’s try that again.");
        })
        .finally(() => {
          if (current) setLoading(false);
        });
      return () => {
        current = false;
      };
    }, [attempt, user?.id]),
  );
  const visible = worlds
    .filter((world) =>
      `${world.title} ${world.description ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
    )
    .sort((a, b) => Number(b.id === recentId) - Number(a.id === recentId));
  return (
    <SafeAreaView edges={["top"]} style={layout.screen}>
      <ScrollView
        contentContainerStyle={layout.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={layout.eyebrow}>ODYSSEY</Text>
            <Text style={styles.heading}>Explore</Text>
          </View>
          <Action
            label="Create a world  +"
            secondary
            onPress={() => navigation.navigate("WorldGeneration")}
          />
        </View>
        <Text style={styles.intro}>
          Continue a story or step into a new world.
        </Text>
        {worlds.length > 0 && (
          <TextInput
            accessibilityLabel="Search worlds"
            value={query}
            onChangeText={setQuery}
            placeholder="Search worlds"
            placeholderTextColor={colors.muted}
            style={styles.search}
          />
        )}
        {loading ? (
          <ActivityIndicator style={{ padding: 40 }} color={colors.accent} />
        ) : error ? (
          <View style={styles.empty}>
            <Text accessibilityRole="alert" style={layout.body}>
              {error}
            </Text>
            <Action
              label="Try again"
              onPress={() => setAttempt((n) => n + 1)}
            />
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {visible.map((world) => (
                <Pressable
                  key={world.id}
                  onHoverIn={() => setHovered(world.id)}
                  onHoverOut={() => setHovered(null)}
                  accessibilityRole="button"
                  accessibilityLabel={`${active.includes(world.id) ? "Continue" : "Enter"} ${world.title}`}
                  onPress={() =>
                    navigation.navigate("Session", {
                      worldId: world.id,
                      worldTitle: world.title,
                    })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    {
                      width: width >= 800 ? "48.5%" : "100%",
                      borderColor:
                        hovered === world.id || world.id === recentId
                          ? colors.accent
                          : colors.line,
                      backgroundColor:
                        world.id === recentId ? colors.raised : colors.surface,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={styles.cardBody}>
                    {world.id === recentId && (
                      <Text style={layout.eyebrow}>
                        PICK UP WHERE YOU LEFT OFF
                      </Text>
                    )}
                    <Text style={styles.cardTitle}>{world.title}</Text>
                    <Text numberOfLines={2} style={styles.description}>
                      {(world.id === recentId && recentExcerpt) ||
                        world.description ||
                        "A new story starts here."}
                    </Text>
                    <Text style={styles.enter}>
                      {active.includes(world.id)
                        ? "Continue story"
                        : "Start story"}
                      {"  →"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {!visible.length && (
              <View style={styles.empty}>
                <Text style={styles.section}>
                  {query ? "No worlds found." : "No worlds yet."}
                </Text>
                <Text style={layout.body}>
                  {query
                    ? "Try another name."
                    : "Create one to start your first story."}
                </Text>
                {query && (
                  <Action label="Clear search" onPress={() => setQuery("")} />
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  heading: { color: colors.text, fontFamily, fontSize: 30, marginTop: 6 },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  section: { color: colors.text, fontFamily: fontFamily, fontSize: 22 },
  search: { ...layout.input, paddingVertical: 12, paddingHorizontal: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardBody: { padding: 20, gap: 9 },
  cardTitle: { color: colors.text, fontFamily: fontFamily, fontSize: 21 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  enter: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 14,
    marginTop: 3,
  },
  empty: { paddingVertical: 32, alignItems: "center", gap: 16 },
});
