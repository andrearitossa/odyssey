import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  UIManager,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { 
  useAudioRecorder, 
  useAudioRecorderState, 
  useAudioPlayer,
  useAudioPlayerStatus,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync 
} from 'expo-audio';
import Markdown from 'react-native-markdown-display';
import { RootStackParamList } from '../types';
import { WorldGenerationAPI } from '../api/worldGeneration';
import { getWorldById, updateWorld, GoogleTokenManager } from '../api';
import { Screen, theme } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'WorldGeneration'>;

interface AudioState {
  isLoading: boolean;
  hasResponse: boolean;
  permissionGranted: boolean;
  hasRecording: boolean; // Track if we have a recording ready to send
}

export const WorldGenerationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { worldId } = route.params;
  const [audioState, setAudioState] = useState<AudioState>({
    isLoading: false,
    hasResponse: false,
    permissionGranted: false,
    hasRecording: false,
  });
  // Recording setup
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  
  // Response audio playback setup - initially no source
  const [responseAudioSource, setResponseAudioSource] = useState<string | null>(null);
  const responsePlayer = useAudioPlayer(responseAudioSource);
  const playerStatus = useAudioPlayerStatus(responsePlayer);

  const [isWorldLoading, setIsWorldLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [worldTitle, setWorldTitle] = useState<string>('');
  const [worldDescription, setWorldDescription] = useState<string>('');
  const descriptionInputRef = useRef<TextInput | null>(null);
  const [descriptionHeight, setDescriptionHeight] = useState(260);

  useEffect(() => {
    setupAudio();
    loadWorld();

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    return () => {
      cleanupAudio();
    };
  }, []);

  const loadWorld = async () => {
    try {
      if (!worldId) {
        Alert.alert('Error', 'Missing world id.');
        navigation.goBack();
        return;
      }

      setIsWorldLoading(true);
      const token = await GoogleTokenManager.getValidToken();
      if (!token) {
        navigation.navigate('GoogleAuth');
        return;
      }

      const world = await getWorldById(token, worldId);
      setWorldTitle(world.title);
      setWorldDescription(world.description || '');
    } catch (error) {
      console.error('Error loading world:', error);
      Alert.alert('Error', 'Failed to load world.');
      navigation.goBack();
    } finally {
      setIsWorldLoading(false);
    }
  };

  // Handle audio completion - reset when audio finishes playing
  useEffect(() => {
    if (playerStatus && playerStatus.didJustFinish) {
      resetToInitialState();
    }
  }, [playerStatus?.didJustFinish]);

  const setupAudio = async () => {
    try {
      // Request recording permissions
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Required', 'Permission to access microphone was denied');
        return;
      }

      // Set audio mode for recording and playback
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      setAudioState(prev => ({ ...prev, permissionGranted: true }));
    } catch (error) {
      console.error('Error setting up audio:', error);
      Alert.alert('Error', 'Failed to set up audio. Please check permissions.');
    }
  };

  const cleanupAudio = () => {
    // Cleanup response audio URL if it exists
    if (responseAudioSource && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(responseAudioSource);
    }
  };

  const resetToInitialState = () => {
    // Clean up response audio
    if (responseAudioSource && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(responseAudioSource);
      setResponseAudioSource(null);
    }
    
    // Reset all state
    setAudioState(prev => ({
      ...prev,
      isLoading: false,
      hasResponse: false,
      hasRecording: false
    }));
  };

  const saveWorldEdits = async () => {
    try {
      if (!worldId) return;
      if (!worldTitle.trim()) {
        Alert.alert('Error', 'World title cannot be empty.');
        return;
      }

      setIsSaving(true);
      const token = await GoogleTokenManager.getValidToken();
      if (!token) {
        navigation.navigate('GoogleAuth');
        return;
      }

      const updated = await updateWorld(token, worldId, {
        title: worldTitle.trim(),
        description: worldDescription,
      });
      setWorldTitle(updated.title);
      setWorldDescription(updated.description || '');
    } catch (error) {
      console.error('Error saving world:', error);
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const startRecording = async () => {
    try {
      if (!audioState.permissionGranted) {
        Alert.alert('Error', 'Microphone permission not granted');
        return;
      }

      // Clear any previous response and reset recording state
      setAudioState(prev => ({ ...prev, hasResponse: false, hasRecording: false }));
      
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      // Set that we now have a recording ready to send
      setAudioState(prev => ({ ...prev, hasRecording: true }));
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const sendAudio = async () => {
    try {
      if (!audioRecorder.uri) {
        Alert.alert('Error', 'No recording to send.');
        return;
      }

      if (!worldId) {
        Alert.alert('Error', 'Missing world id.');
        return;
      }

      setAudioState(prev => ({ ...prev, isLoading: true }));

      // Convert recording to blob for API call
      const response = await fetch(audioRecorder.uri);
      const audioBlob = await response.blob();

      // Clear the recorder to go back to zero state (this clears audioRecorder.uri)
      await audioRecorder.prepareToRecordAsync();

      // Send to backend and get response
      const result = await WorldGenerationAPI.interact(worldId, audioBlob);
      const responseBlob = result.audioBlob;
      const updatedDocument = result.document;

      // Debug: Inspect received audio response
      console.log('[WorldGen] Received audio response:', responseBlob);
      if (responseBlob) {
        console.log('[WorldGen] Type:', responseBlob.type);
        console.log('[WorldGen] Size:', responseBlob.size);
        const arrayBuffer = await responseBlob.arrayBuffer();
        const byteArray = new Uint8Array(arrayBuffer);
        const header = Array.from(byteArray.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log('[WorldGen] First 16 bytes (hex):', header);
        const textHeader = String.fromCharCode(...byteArray.slice(0, 8));
        console.log('[WorldGen] First 8 bytes (ASCII):', textHeader);
        if (textHeader.startsWith('{')) {
          // Looks like JSON, not audio
          try {
            const jsonText = new TextDecoder('utf-8').decode(byteArray);
            console.log('[WorldGen] ERROR: Received JSON instead of audio:', jsonText);
          } catch (e) {
            console.log('[WorldGen] ERROR: Received non-audio, could not decode as JSON.');
          }
        } else if (!textHeader.startsWith('RIFF')) {
          console.log('[WorldGen] WARNING: Audio does not start with RIFF header, may not be WAV.');
        } else {
          console.log('[WorldGen] Audio response appears to be WAV format.');
        }
      } else {
        console.log('[WorldGen] No audio returned from server.');
      }

      // Clean up any existing response audio URL
      if (responseAudioSource && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(responseAudioSource);
      }

      // Create URL for new response audio
      const responseUrl = responseBlob ? URL.createObjectURL(responseBlob) : null;
      if (responseUrl) setResponseAudioSource(responseUrl);

      // Update UI document if provided
      if (updatedDocument) {
        console.log('[WorldGen] Updated document:', updatedDocument);
        setWorldDescription(updatedDocument);
      }

      setAudioState(prev => ({ 
        ...prev, 
        isLoading: false, 
        hasResponse: true,
        hasRecording: false // Reset to zero state after successful send
      }));

    } catch (error) {
      console.error('Error sending audio:', error);
      setAudioState(prev => ({ ...prev, isLoading: false, hasRecording: false }));
      Alert.alert('Error', 'Failed to send audio. Please try again.');
    }
  };

  const toggleResponseAudio = () => {
    try {
      if (!responsePlayer || !responseAudioSource) return;

      if (playerStatus?.playing) {
        responsePlayer.pause();
      } else {
        responsePlayer.play();
      }
    } catch (error) {
      console.error('Error toggling audio playback:', error);
      Alert.alert('Error', 'Failed to control audio playback.');
    }
  };

  const handleBottomButtonPress = async () => {
    if (recorderState.isRecording) {
      // Recording state => stop recording, show send icon
      await stopRecording();
    } else if (audioState.hasRecording) {
      // Has recording, not sent => send to backend, go back to zero state
      await sendAudio();
    } else {
      // Zero state => start recording
      await startRecording();
    }
  };

  const getBottomButtonIcon = () => {
    // Recording finished but not sent => show send icon
    if (audioState.hasRecording && !recorderState.isRecording) {
      return '>'; // Send icon
    }
    // Zero state or recording => show microphone
    return '🎤'; // Microphone icon
  };

  const getBottomButtonColor = () => {
    if (recorderState.isRecording) {
      return theme.colors.danger; // Red when recording
    }
    return theme.colors.wine; // Wine default
  };

  // Status text removed — UI shows only buttons and rendered document

  return (
    <Screen style={styles.container}>
      <View style={styles.content}>
        {/* Response Audio Controls - Top Right */}
        <View style={styles.responseContainer}>
          {audioState.isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.wine} />
            </View>
          )}
          
          {audioState.hasResponse && (
            <TouchableOpacity 
              style={styles.responseButton}
              onPress={toggleResponseAudio}
            >
              <Text style={styles.responseButtonText}>
                {playerStatus?.playing ? '⏸️' : '▶️'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isWorldLoading ? (
          <ActivityIndicator size="small" color={theme.colors.wine} />
        ) : (
          <KeyboardAvoidingView
            style={styles.editorKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <ScrollView
              style={styles.editorScroll}
              contentContainerStyle={styles.editorScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={styles.titleInput}
                value={worldTitle}
                onChangeText={setWorldTitle}
                placeholder="World title"
                placeholderTextColor={theme.colors.textMuted}
                editable={!isSaving && !audioState.isLoading}
              />

              <Text style={styles.divider}>--</Text>

              <View style={[styles.descriptionBlock, { height: Math.max(260, descriptionHeight) }]}>
                <Markdown style={markdownStyles}>
                  {(worldDescription && worldDescription.trim().length > 0)
                    ? worldDescription
                    : '*Tap to start writing your world…*'}
                </Markdown>

                <TextInput
                  ref={(r) => {
                    descriptionInputRef.current = r;
                  }}
                  style={[styles.descriptionInputOverlay, { height: Math.max(260, descriptionHeight) }]}
                  value={worldDescription}
                  onChangeText={setWorldDescription}
                  onContentSizeChange={(e) => {
                    const nextHeight = Math.ceil(e.nativeEvent.contentSize.height);
                    if (Number.isFinite(nextHeight) && nextHeight > 0) {
                      setDescriptionHeight(nextHeight);
                    }
                  }}
                  placeholder="Write world description (Markdown supported)…"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  editable={!isSaving && !audioState.isLoading}
                  textAlignVertical="top"
                  selectionColor={theme.colors.wine}
                  autoCorrect={false}
                  autoCapitalize="sentences"
                  spellCheck={false}
                  scrollEnabled={false}
                />
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Fixed Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.bottomBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.bottomBackButtonText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomButton, { backgroundColor: getBottomButtonColor() }]}
          onPress={handleBottomButtonPress}
          disabled={audioState.isLoading}
        >
          <Text style={styles.bottomButtonText}>
            {getBottomButtonIcon()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomSaveButton, (isSaving || audioState.isLoading) && styles.bottomSaveButtonDisabled]}
          onPress={saveWorldEdits}
          disabled={isSaving || audioState.isLoading}
        >
          <Text style={styles.bottomSaveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldSoft,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow,
  },
  backButtonText: {
    fontSize: 22,
    color: theme.colors.wine,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  responseContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
  },
  editorKeyboard: {
    width: '100%',
    flex: 1,
    alignSelf: 'stretch',
  },
  editorScroll: {
    width: '100%',
    maxWidth: 740,
    alignSelf: 'center',
  },
  editorScrollContent: {
    paddingTop: 6,
    paddingBottom: 140,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    paddingVertical: 8,
    textAlign: 'center',
  },
  divider: {
    color: theme.colors.goldDark,
    marginVertical: 6,
    fontSize: 16,
  },
  descriptionBlock: {
    minHeight: 260,
    paddingVertical: 2,
    position: 'relative',
  },
  descriptionInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    fontSize: 16,
    lineHeight: 22,
    color: 'transparent',
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  responseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.wine,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.goldSoft,
    ...theme.shadow,
  },
  responseButtonText: {
    fontSize: 24,
    color: 'white',
  },
  bottomSpacer: {
    height: 40,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  bottomBackButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldSoft,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow,
  },
  bottomBackButtonText: {
    fontSize: 24,
    color: theme.colors.wine,
  },
  bottomButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomButtonText: {
    fontSize: 32,
    color: theme.colors.textOnWine,
    fontWeight: 'bold',
  },
  bottomSaveButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.wine,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.goldSoft,
    ...theme.shadow,
  },
  bottomSaveButtonDisabled: {
    opacity: 0.6,
  },
  bottomSaveButtonText: {
    color: theme.colors.textOnWine,
    fontSize: 14,
    fontWeight: '600',
  },
}); 

const markdownStyles = StyleSheet.create({
  body: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  heading1: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  heading2: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  heading3: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  paragraph: {
    marginTop: 6,
    marginBottom: 6,
  },
  bullet_list: {
    marginTop: 6,
    marginBottom: 6,
  },
  ordered_list: {
    marginTop: 6,
    marginBottom: 6,
  },
  code_inline: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  code_block: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.border,
    paddingLeft: 10,
    opacity: 0.95,
  },
});