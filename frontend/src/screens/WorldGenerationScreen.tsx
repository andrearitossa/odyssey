import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
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
import { RootStackParamList } from '../types';
import { WorldGenerationAPI } from '../api/worldGeneration';
import { getWorldById, updateWorld, GoogleTokenManager } from '../api';

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

  useEffect(() => {
    setupAudio();
    loadWorld();
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
    if (responseAudioSource) {
      URL.revokeObjectURL(responseAudioSource);
    }
  };

  const resetToInitialState = () => {
    // Clean up response audio
    if (responseAudioSource) {
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
      if (responseAudioSource) {
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
      return '#EF4444'; // Red when recording
    }
    return '#8B5CF6'; // Purple default
  };

  // Status text removed — UI shows only buttons and rendered document

  return (
    <View style={styles.container}>
      {/* Back button top-left */}
      <View style={styles.backContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Response Audio Controls - Top Right */}
        <View style={styles.responseContainer}>
          {audioState.isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
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

        <View style={styles.documentContainer}>
          {isWorldLoading ? (
            <ActivityIndicator size="small" color="#8B5CF6" />
          ) : (
            <>
              <TextInput
                style={styles.titleInput}
                value={worldTitle}
                onChangeText={setWorldTitle}
                placeholder="World title"
                placeholderTextColor="#94A3B8"
                editable={!isSaving && !audioState.isLoading}
              />
              <Text style={styles.divider}>--</Text>
              <TextInput
                style={styles.descriptionInput}
                value={worldDescription}
                onChangeText={setWorldDescription}
                placeholder="World description"
                placeholderTextColor="#94A3B8"
                multiline
                editable={!isSaving && !audioState.isLoading}
              />

              <TouchableOpacity
                style={[styles.saveButton, (isSaving || audioState.isLoading) && styles.saveButtonDisabled]}
                onPress={saveWorldEdits}
                disabled={isSaving || audioState.isLoading}
              >
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.bottomButton, { backgroundColor: getBottomButtonColor() }]}
          onPress={handleBottomButtonPress}
          disabled={audioState.isLoading}
        >
          <Text style={styles.bottomButtonText}>
            {getBottomButtonIcon()}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 22,
    color: '#0F172A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 40,
    textAlign: 'center',
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 300,
  },
  placeholderText: {
    fontSize: 48,
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  responseContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
  },
  documentContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxWidth: 700,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 8,
  },
  divider: {
    color: '#94A3B8',
    marginVertical: 6,
    fontSize: 16,
  },
  descriptionInput: {
    fontSize: 16,
    color: '#0F172A',
    lineHeight: 22,
    minHeight: 160,
    textAlignVertical: 'top',
    paddingVertical: 8,
  },
  saveButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
  responseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  responseButtonText: {
    fontSize: 24,
    color: 'white',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
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
    color: 'white',
    fontWeight: 'bold',
  },
}); 