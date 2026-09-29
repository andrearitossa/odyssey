import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabParamList, RootStackParamList } from "../types";
import { createWorld } from "../api";
import { Action } from "../components/Action";
import { colors, layout } from "../theme";
type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, "WorldGeneration">,
  NativeStackScreenProps<RootStackParamList>
>;
const sparks = [
  {
    label: "✧  A little magic",
    title: "The Midnight Library",
    description:
      "A hidden library where books can open doors into other worlds. Quiet reading rooms, winding shelves and enchanted gardens offer places to explore. Librarians, curious readers and characters from books might appear. Keys, maps and unusual volumes can hold surprises. Gentle, mysterious fantasy with a sense of wonder.",
  },
  {
    label: "☾  Far from home",
    title: "Beyond the Last Star",
    description:
      "The edge of known space, with research ships, remote stations and unfamiliar planets. Explorers, engineers and unusual life forms might cross paths. Radios, star charts and strange artifacts offer possibilities for discovery. Thoughtful science fiction balancing curiosity, isolation and wonder.",
  },
  {
    label: "◇  A beautiful mystery",
    title: "The City of Lost Hours",
    description:
      "A rain-soaked city where time can behave strangely. Cafes, clock shops, old apartments and deserted streets offer possible settings. Neighbors, watchmakers and travelers may have different stories to tell. Photographs, letters and clocks can take on unexpected meaning. An atmospheric mystery with a touch of the surreal.",
  },
];
export function WorldGenerationScreen({ navigation }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const create = async () => {
    if (!title.trim() || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const world = await createWorld(
        title.trim(),
        description.trim() || undefined,
      );
      setTitle("");
      setDescription("");
      if (navigation.isFocused())
        navigation.navigate("Session", {
          worldId: world.id,
          worldTitle: world.title,
        });
    } catch {
      setError(
        "Your world couldn’t be created. Your idea is still here—try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView edges={["top"]} style={layout.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {busy ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Creating your world"
            style={styles.creating}
          >
            <ActivityIndicator color={colors.accent} />
            <Text style={layout.title}>{title.trim()}</Text>
            <Text style={layout.body}>Opening your world…</Text>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              layout.page,
              { maxWidth: 760, paddingTop: 48, gap: 28 },
            ]}
          >
            <Text style={layout.eyebrow}>NEW WORLD</Text>
            <Text style={layout.title}>Create your world.</Text>
            <Text style={layout.body}>
              Choose a setting and a tone.{"\n"}Let the narrator decide how the
              story begins.
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {error}
              </Text>
            )}
            <View style={{ gap: 12 }}>
              <Text style={styles.label}>Need a little inspiration?</Text>
              <View style={[layout.row, { flexWrap: "wrap" }]}>
                {sparks.map((s) => (
                  <Pressable
                    key={s.title}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => {
                      setTitle(s.title);
                      setDescription(s.description);
                      setError("");
                    }}
                    style={({ pressed }) => [
                      styles.spark,
                      { opacity: pressed || busy ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={{ color: colors.accent }}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <Text style={styles.label}>Name your world</Text>
              <TextInput
                accessibilityLabel="World name"
                value={title}
                onChangeText={setTitle}
                editable={!busy}
                maxLength={100}
                placeholder="Somewhere worth getting lost"
                placeholderTextColor={colors.muted}
                style={layout.input}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Text style={styles.label}>
                Describe the world{" "}
                <Text style={{ color: colors.muted }}> / optional</Text>
              </Text>
              <Text style={layout.body}>
                What places, people or objects might appear? A few possibilities
                are enough.
              </Text>
              <TextInput
                accessibilityLabel="World description"
                value={description}
                onChangeText={setDescription}
                editable={!busy}
                maxLength={500}
                multiline
                placeholder="A cozy seaside town with narrow streets, a harbor and a bookshop. Fishers, neighbors and visitors might cross paths. Old letters and curious keepsakes can spark gentle mysteries."
                placeholderTextColor={colors.muted}
                style={[
                  layout.input,
                  { minHeight: 160, textAlignVertical: "top", lineHeight: 26 },
                ]}
              />
              <Text style={styles.count}>{description.length} / 500</Text>
            </View>
            <Action
              label="Create & step inside  →"
              disabled={!title.trim()}
              onPress={create}
            />
            <Text style={[layout.body, { textAlign: "center", fontSize: 12 }]}>
              Your world is saved when you create it.
            </Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 14, fontWeight: "500" },
  spark: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  count: { color: colors.muted, fontSize: 11, textAlign: "right" },
  creating: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 32,
  },
});
