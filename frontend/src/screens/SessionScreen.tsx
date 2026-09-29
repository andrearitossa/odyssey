import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { useSessionManager } from "../hooks/useSessionManager";
import { currentChoices } from "../utils/story";
import { colors, layout, fontFamily } from "../theme";
import { Action } from "../components/Action";
type Props = NativeStackScreenProps<RootStackParamList, "Session">;
function choiceAction(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .split(/\s+[–—-]\s+/)[0]
    .trim();
}
export function SessionScreen({ route, navigation }: Props) {
  const { worldId, worldTitle } = route.params;
  const {
    messages,
    isSessionLoading,
    isInteracting,
    error,
    saveWarning,
    failedAction,
    partialScene,
    startSession,
    resetSession,
    sendMessage,
  } = useSessionManager();
  const [input, setInput] = useState("");
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [longWait, setLongWait] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const following = useRef(true);
  const pendingSend = useRef(false);
  const busy = isSessionLoading || isInteracting;
  const choices = currentChoices(messages);
  const storyMessages = messages.filter((message) => message.type !== "choice");
  useEffect(() => {
    setInput("");
    following.current = true;
    void startSession(worldId);
  }, [worldId, startSession]);
  useEffect(() => {
    setLongWait(false);
    if (!busy) return;
    const timer = setTimeout(() => setLongWait(true), 8000);
    return () => clearTimeout(timer);
  }, [busy]);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(
      () => scroll.current?.scrollToEnd({ animated: true }),
      0,
    );
    return () => clearTimeout(timer);
  }, [error]);
  const send = async (text: string, custom = false) => {
    if (!text.trim() || busy || pendingSend.current) return;
    pendingSend.current = true;
    following.current = true;
    if (custom) setInput("");
    try {
      const success = await sendMessage(text);
      if (!success && custom) setInput(text);
    } finally {
      pendingSend.current = false;
    }
  };
  return (
    <SafeAreaView style={layout.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to worlds"
          onPress={() => navigation.popTo("MainTabs", { screen: "WorldSelection" })}
          style={styles.icon}
        >
          <Text style={styles.link}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.worldTitle}>
            {worldTitle || "Your story"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restart story"
          disabled={busy}
          onPress={() => setConfirmRestart(true)}
          style={styles.icon}
        >
          <Text style={[styles.link, busy && styles.dim]}>Restart</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.story}
          scrollEventThrottle={100}
          onScroll={({
            nativeEvent: { contentOffset, contentSize, layoutMeasurement },
          }) => {
            following.current =
              contentSize.height - contentOffset.y - layoutMeasurement.height <
              120;
          }}
          onContentSizeChange={() => {
            if (following.current && busy)
              scroll.current?.scrollToEnd({ animated: false });
          }}
        >
          {storyMessages.map((message, index) => (
            <View
              key={index}
              onLayout={({ nativeEvent }) => {
                if (
                  following.current &&
                  message.type === "narrator" &&
                  index === storyMessages.length - 1
                ) {
                  scroll.current?.scrollTo({
                    y: Math.max(0, nativeEvent.layout.y - 24),
                    animated: false,
                  });
                }
              }}
              style={message.type === "user" ? styles.user : styles.narrative}
            >
              {message.type === "user" && <Text style={styles.you}>You</Text>}
              <Text
                selectable
                style={message.type === "user" ? styles.userText : styles.prose}
              >
                {message.text}
              </Text>
            </View>
          ))}
          {!!partialScene && busy && (
            <View style={styles.narrative}>
              <Text selectable style={styles.prose}>
                {partialScene}
              </Text>
            </View>
          )}
          {busy && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Writing your story"
              style={styles.thinking}
            >
              <ActivityIndicator color={colors.accent} />
              <Text style={layout.body}>
                {longWait
                  ? "Taking longer than usual. Still working…"
                  : isSessionLoading
                    ? "Opening your world…"
                    : "Writing…"}
              </Text>
            </View>
          )}
          {!!error && (
            <View style={styles.error}>
              <Text
                accessibilityRole="alert"
                style={{ color: colors.danger, lineHeight: 24 }}
              >
                {error}
              </Text>
              {!messages.length && (
                <Action
                  label="Open story again"
                  onPress={() => startSession(worldId)}
                />
              )}
              {!!failedAction && (
                <Action
                  label="Try this action again"
                  secondary
                  onPress={() =>
                    void send(failedAction, input.trim() === failedAction)
                  }
                />
              )}
            </View>
          )}
          {!!saveWarning && (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {saveWarning}
            </Text>
          )}
          {!busy && choices.length > 0 && (
            <View style={styles.choices}>
              {choices.map((choice, index) => (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  onPress={() => send(choiceAction(choice.text))}
                  style={({ pressed }) => [
                    styles.choice,
                    {
                      backgroundColor: pressed ? colors.raised : colors.surface,
                    },
                  ]}
                >
                  <Text style={styles.choiceText}>
                    {choiceAction(choice.text)}
                  </Text>
                  <Text style={styles.link}>→</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Your own action"
              value={input}
              onChangeText={setInput}
              placeholder="Write your own action…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={500}
              editable={!busy && !!messages.length}
              returnKeyType={Platform.OS === "web" ? undefined : "send"}
              submitBehavior={Platform.OS === "web" ? undefined : "submit"}
              onSubmitEditing={() => {
                if (Platform.OS !== "web") void send(input, true);
              }}
              onKeyPress={(event) => {
                if (
                  Platform.OS === "web" &&
                  event.nativeEvent.key === "Enter" &&
                  !(event.nativeEvent as any).shiftKey &&
                  !(event.nativeEvent as any).isComposing &&
                  (event.nativeEvent as any).keyCode !== 229
                ) {
                  event.preventDefault();
                  void send(input, true);
                }
              }}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send action"
              disabled={!input.trim() || busy || !messages.length}
              onPress={() => send(input, true)}
              style={({ pressed }) => [
                styles.send,
                (!input.trim() || busy || !messages.length) && styles.dim,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ fontSize: 24, color: colors.ink }}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={confirmRestart}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmRestart(false)}
      >
        <View style={styles.scrim}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.dialogTitle}>Start this story over?</Text>
            <Text style={layout.body}>
              This replaces your progress in this world.
            </Text>
            <Action
              label="Keep my story"
              onPress={() => setConfirmRestart(false)}
            />
            <Action
              label="Start over"
              secondary
              onPress={() => {
                setConfirmRestart(false);
                setInput("");
                following.current = true;
                void resetSession(worldId);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  icon: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { color: colors.accent, fontSize: 15 },
  worldTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  story: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 24,
  },
  dialogTitle: {
    color: colors.text,
    fontFamily: fontFamily,
    fontSize: 26,
    textAlign: "center",
  },
  narrative: { marginBottom: 28 },
  prose: {
    color: colors.text,
    fontFamily: fontFamily,
    fontSize: 17,
    lineHeight: 29,
  },
  user: {
    borderLeftWidth: 2,
    borderColor: colors.accent,
    paddingLeft: 20,
    gap: 8,
    marginVertical: 20,
    marginBottom: 32,
  },
  you: { color: colors.accent, fontSize: 9, letterSpacing: 2 },
  userText: { color: colors.muted, fontSize: 16, lineHeight: 26 },
  thinking: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 28,
    alignItems: "center",
  },
  error: { gap: 16, paddingVertical: 24 },
  choices: { gap: 12, marginTop: 12 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 18,
    minHeight: 64,
  },
  choiceText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 24 },
  composerWrap: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  composer: {
    width: "100%",
    maxWidth: 732,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 28,
    padding: 8,
    paddingLeft: 20,
    gap: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 120,
    minHeight: 36,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  dim: { opacity: 0.35 },
  scrim: {
    flex: 1,
    backgroundColor: "#000B",
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  dialog: {
    width: "100%",
    maxWidth: 430,
    padding: 28,
    gap: 24,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
