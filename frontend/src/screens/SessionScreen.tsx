import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Animated, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { RootStackParamList } from '../types';
import { useSessionManager } from '../hooks/useSessionManager';
import { AppHeader, Button, Screen, theme } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

export const SessionScreen: React.FC<Props> = ({ route, navigation }) => {
  const { worldId, worldTitle, sessionId } = route.params;
  const { 
    currentSession, 
    messages, 
    isSessionLoading, 
    isInteracting,
    startSession,
    resetSession,
    sendMessage 
  } = useSessionManager();

  const [inputText, setInputText] = useState('');
  const dotsOpacity = useRef(new Animated.Value(0.3)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const messageRefs = useRef<{ [key: number]: View | null }>({});

  // Initialize session when component mounts or worldId changes
  useEffect(() => {
    // Always try to start/resume session for the current world
    // The context will handle checking for existing sessions
    initializeSession();
  }, [worldId, sessionId]);

  // Handle thinking animation
  useEffect(() => {
    if (isInteracting) {
      startThinkingAnimation();
    } else {
      dotsOpacity.setValue(0.3);
    }
  }, [isInteracting]);

  // Auto-scroll to latest content
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Always scroll to end to show the latest content
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
    
    return () => clearTimeout(timer);
  }, [messages]);

  const startThinkingAnimation = () => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(dotsOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.timing(dotsOpacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start(animate);
    };
    animate();
  };

  const initializeSession = async () => {
    try {
      // startSession now handles checking for existing sessions automatically
      // It will resume if one exists, or create new if needed
      await startSession(worldId, sessionId);
    } catch (error) {
      console.error('Failed to initialize session:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isInteracting) return;

    const messageToSend = inputText.trim();
    setInputText('');

    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
      setInputText(messageToSend);
    }
  };

  const handleQuickSend = async (optionNumber: number, optionText: string) => {
    if (isInteracting) return;

    // Send the full choice text instead of just the number
    const choiceMessage = optionText;

    try {
      await sendMessage(choiceMessage);
    } catch (error) {
      console.error('Failed to send option:', error);
    }
  };

  const handleResetWorld = async () => {
    if (isInteracting) return;

    try {
      await resetSession(worldId);
    } catch (error) {
      console.error('Failed to reset world:', error);
    }
  };

  const handleSwipeGesture = (event: any) => {
    const { nativeEvent } = event;
    
    if (nativeEvent.state === State.END) {
      const { translationX, velocityX } = nativeEvent;
      
      // Check for right-to-left swipe (negative translation and velocity)
      if (translationX < -100 && velocityX < -500) {
        // Navigate to Chapters Screen if we have a session
        if (currentSession) {
          navigation.navigate('Chapters', { 
            sessionId: currentSession.sessionId, 
            worldTitle: worldTitle ?? 'Adventure',
          });
        }
      }
    }
  };

  // Loading state
  if (isSessionLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Image 
            source={require('../../assets/odissea_load.gif')} 
            style={styles.loadingGif}
            resizeMode="contain"
          />
          <Text style={styles.loadingText}>Loading your adventure...</Text>
        </View>
      </Screen>
    );
  }

  // Error state - session failed to load (only show if not loading and no session)
  if (!isSessionLoading && !currentSession) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to start adventure</Text>
          <View style={styles.errorActions}>
            <Button label="← Back to Worlds" onPress={() => navigation.goBack()} />
            <Button label="Try Again" onPress={initializeSession} variant="secondary" />
          </View>
        </View>
      </Screen>
    );
  }

  const content = (
    <Screen style={styles.container}>
        <AppHeader
          title={worldTitle ?? 'Adventure'}
          left={
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.wine} />
              <Text style={styles.backButtonText}>Worlds</Text>
            </TouchableOpacity>
          }
          right={
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.chaptersButton, !currentSession && styles.iconButtonDisabled]}
                onPress={() =>
                  currentSession &&
                  navigation.navigate('Chapters', {
                    sessionId: currentSession.sessionId,
                    worldTitle: worldTitle ?? 'Adventure',
                  })
                }
                disabled={!currentSession}
              >
                <Ionicons name="book-outline" size={16} color={theme.colors.textOnWine} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resetButton, isInteracting && styles.iconButtonDisabled]}
                onPress={handleResetWorld}
                disabled={isInteracting}
              >
                <Ionicons name="refresh" size={16} color={theme.colors.textOnWine} />
              </TouchableOpacity>
            </View>
          }
        />

        <KeyboardAvoidingView 
          style={styles.content} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.messagesContainer} 
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message, index) => (
              <View 
                key={index}
                ref={(ref) => { messageRefs.current[index] = ref; }}
                style={[
                  styles.messageContainer, 
                  message.type === 'user' ? styles.userMessage : 
                  message.type === 'choice' ? styles.choiceMessage : styles.narratorMessage,
                  // Add special spacing for choices that follow narrator messages
                  message.type === 'choice' && index > 0 && messages[index - 1]?.type === 'narrator' ? styles.firstChoice : {},
                  // Reduce spacing for subsequent choices
                  message.type === 'choice' && index > 0 && messages[index - 1]?.type === 'choice' ? styles.subsequentChoice : {}
                ]}
              >
                {message.type === 'choice' ? (
                  <TouchableOpacity
                    style={[
                      styles.choiceContent,
                      isInteracting && styles.choiceContentDisabled
                    ]}
                    onPress={() => handleQuickSend(message.choiceNumber!, message.text)}
                    disabled={isInteracting}
                    activeOpacity={isInteracting ? 1 : 0.6}
                  >
                    <View style={[
                      styles.choiceNumberContainer,
                      isInteracting && styles.choiceNumberContainerDisabled
                    ]}>
                      <Text style={[
                        styles.choiceNumber,
                        isInteracting && styles.choiceNumberDisabled
                      ]}>
                        {message.choiceNumber}
                      </Text>
                    </View>
                    <Text style={[
                      styles.choiceText,
                      isInteracting && styles.choiceTextDisabled
                    ]}>
                      {message.text}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={[
                      styles.messageText,
                      message.type === 'user' ? styles.userMessageText : styles.narratorMessageText
                    ]}>
                      {message.text}
                    </Text>
                    <Text style={styles.messageTime}>
                      {message.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
                    </Text>
                  </>
                )}
              </View>
            ))}

            {/* Show thinking indicator when processing */}
            {isInteracting && (
              <View style={[styles.messageContainer, styles.narratorMessage, styles.thinkingMessage]}>
                <View style={styles.thinkingContainer}>
                  <View style={styles.thinkingDotContainer}>
                    <Animated.View style={[styles.thinkingDot, { opacity: dotsOpacity }]} />
                    <Animated.View style={[styles.thinkingDot, { opacity: dotsOpacity }]} />
                    <Animated.View style={[styles.thinkingDot, { opacity: dotsOpacity }]} />
                  </View>
                  <Text style={styles.thinkingText}>Thinking...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Chat Input Section */}
          <View style={styles.optionsContainer}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={styles.optionsScrollView}
              keyboardShouldPersistTaps="handled"
            >
              {/* Chat Input - Custom Action */}
              <View style={styles.chatInputContainer}>
                <View style={styles.chatInputContent}>
                  <View style={styles.chatIconContainer}>
                    <Ionicons name="create-outline" size={20} color={theme.colors.goldDark} />
                  </View>
                  <View style={styles.chatInputWrapper}>
                    <TextInput
                      style={[
                        styles.chatInput,
                        isInteracting && styles.chatInputDisabled
                      ]}
                      value={inputText}
                      onChangeText={setInputText}
                      placeholder="Type your custom action..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      maxLength={500}
                      editable={!isInteracting}
                      returnKeyType="send"
                      onSubmitEditing={handleSendMessage}
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity 
                      style={[
                        styles.chatSendButton, 
                        (!inputText.trim() || isInteracting) && styles.chatSendButtonDisabled
                      ]}
                      onPress={handleSendMessage}
                      disabled={!inputText.trim() || isInteracting}
                    >
                      <Ionicons 
                        name="send" 
                        size={18} 
                        color={(!inputText.trim() || isInteracting) ? theme.colors.textMuted : theme.colors.textOnWine} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
    </Screen>
  );

  // Workaround: RNGH web delegate can crash on unmount for PanGestureHandler.
  if (Platform.OS === 'web') return content;

  return (
    <PanGestureHandler onGestureEvent={handleSwipeGesture} onHandlerStateChange={handleSwipeGesture}>
      {content}
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorActions: {
    width: '100%',
    maxWidth: 360,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.wine,
    marginLeft: 4,
    fontWeight: '500',
  },
  worldTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chaptersButton: {
    backgroundColor: theme.colors.wine,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  resetButton: {
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  iconButtonDisabled: {
    opacity: 0.55,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.wine,
    maxWidth: '80%',
  },
  narratorMessage: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginHorizontal: 0,
    padding: 20,
    borderRadius: 12,
    ...theme.shadow,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  narratorMessageText: {
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  messageTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
  thinkingMessage: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thinkingDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  thinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.goldDark,
    marginHorizontal: 2,
  },
  thinkingText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  optionsContainer: {
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  optionsScrollView: {
    flex: 1,
  },
  chatInputContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  chatInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  chatIconContainer: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatInputWrapper: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-end',
    gap: 12,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: theme.colors.surfaceAlt,
    textAlignVertical: 'top',
  },
  chatInputDisabled: {
    backgroundColor: theme.colors.border,
    color: theme.colors.textMuted,
  },
  chatSendButton: {
    backgroundColor: theme.colors.wine,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  chatSendButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  statusText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  loadingGif: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: theme.colors.wine,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#64748B',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  choiceMessage: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.goldSoft,
    marginHorizontal: 0,
    padding: 0,
    borderRadius: 12,
    marginBottom: 8,
    ...theme.shadow,
  },
  choiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  choiceContentDisabled: {
    opacity: 0.5,
  },
  choiceNumberContainer: {
    backgroundColor: theme.colors.wineDark,
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  choiceNumberContainerDisabled: {
    backgroundColor: '#9CA3AF',
  },
  choiceNumber: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },
  choiceNumberDisabled: {
    color: '#E5E7EB',
  },
  choiceText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
    flex: 1,
    lineHeight: 22,
  },
  choiceTextDisabled: {
    color: theme.colors.textMuted,
  },
  firstChoice: {
    marginTop: 8,
  },
  subsequentChoice: {
    marginTop: 4,
  },
}); 