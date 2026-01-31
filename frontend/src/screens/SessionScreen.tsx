import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Animated, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { RootStackParamList } from '../types';
import { useSessionManager } from '../hooks/useSessionManager';

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
            worldTitle: worldTitle 
          });
        }
      }
    }
  };

  // Loading state
  if (isSessionLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Image 
          source={require('../../assets/odissea_load.gif')} 
          style={styles.loadingGif}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>Loading your adventure...</Text>
      </View>
    );
  }

  // Error state - session failed to load (only show if not loading and no session)
  if (!isSessionLoading && !currentSession) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to start adventure</Text>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.actionButtonText}>← Back to Worlds</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]} 
          onPress={initializeSession}
        >
          <Text style={styles.actionButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <PanGestureHandler onGestureEvent={handleSwipeGesture} onHandlerStateChange={handleSwipeGesture}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#8B5CF6" />
            <Text style={styles.backButtonText}>Worlds</Text>
          </TouchableOpacity>
          <Text style={styles.worldTitle} numberOfLines={1}>
            {worldTitle}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.chaptersButton} 
              onPress={() => currentSession && navigation.navigate('Chapters', { 
                sessionId: currentSession.sessionId, 
                worldTitle: worldTitle 
              })}
              disabled={!currentSession}
            >
              <Ionicons name="book-outline" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.resetButton} 
              onPress={handleResetWorld}
              disabled={isInteracting}
            >
              <Ionicons name="refresh" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>

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
                    <Ionicons name="create-outline" size={20} color="#8B5CF6" />
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
                        color={(!inputText.trim() || isInteracting) ? '#9CA3AF' : 'white'} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: '#8B5CF6',
    marginLeft: 4,
    fontWeight: '500',
  },
  worldTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chaptersButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  resetButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
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
    backgroundColor: '#8B5CF6',
    maxWidth: '80%',
  },
  narratorMessage: {
    alignSelf: 'stretch',
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  narratorMessageText: {
    color: '#1E293B',
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  messageTime: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },
  thinkingMessage: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
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
    backgroundColor: '#8B5CF6',
    marginHorizontal: 2,
  },
  thinkingText: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic',
  },
  optionsContainer: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  optionsScrollView: {
    flex: 1,
  },
  chatInputContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  chatIconContainer: {
    backgroundColor: '#F3F4F6',
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
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: '#F9FAFB',
    textAlignVertical: 'top',
  },
  chatInputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  chatSendButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  chatSendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  statusText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  loadingGif: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#8B5CF6',
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
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginHorizontal: 0,
    padding: 0,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    backgroundColor: '#0369A1',
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
    color: '#0F172A',
    fontWeight: '500',
    flex: 1,
    lineHeight: 22,
  },
  choiceTextDisabled: {
    color: '#9CA3AF',
  },
  firstChoice: {
    marginTop: 8,
  },
  subsequentChoice: {
    marginTop: 4,
  },
}); 