import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList, RootStackParamList, World } from '../types';
import { GoogleTokenManager, createWorld, getMyWorlds, listSessions, SessionSummary } from '../api';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorldTitle, setNewWorldTitle] = useState('');
  const [newWorldDescription, setNewWorldDescription] = useState('');

  const formatDbDate = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return 'Unknown';
    const normalized = trimmed.includes(' ') && !trimmed.includes('T') ? `${trimmed.replace(' ', 'T')}Z` : trimmed;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString();
  };

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const authResult = await GoogleTokenManager.checkExistingAuth();
      if (!authResult.isAuthenticated) {
        navigation.getParent()?.navigate('GoogleAuth');
        return;
      }

      const token = await GoogleTokenManager.getValidToken();
      if (!token) {
        navigation.getParent()?.navigate('GoogleAuth');
        return;
      }

      const [worldsData, sessionsData] = await Promise.all([
        getMyWorlds(token),
        listSessions(),
      ]);
      setWorlds(worldsData);
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading your worlds:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        setError('Unable to connect to server.');
      } else if (error instanceof Error && error.message.includes('Authentication')) {
        navigation.getParent()?.navigate('GoogleAuth');
        return;
      } else {
        setError('Failed to load your data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectWorld = (world: World) => {
    navigation.navigate('WorldGeneration', { worldId: world.id });
  };

  const selectSession = (session: SessionSummary) => {
    navigation.getParent()?.navigate('Session', {
      worldId: session.world_id,
      worldTitle: session.world_title,
      sessionId: session.session_id,
    });
  };

  const handleNewSession = () => {
    navigation.navigate('Search');
  };

  const handleCreateWorld = async () => {
    if (!newWorldTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your world.');
      return;
    }

    try {
      setIsCreating(true);
      const token = await GoogleTokenManager.getValidToken();

      if (!token) {
        throw new Error('No valid authentication token. Please sign in again.');
      }

      await createWorld(token, newWorldTitle.trim(), newWorldDescription.trim() || undefined);

      setNewWorldTitle('');
      setNewWorldDescription('');
      setIsCreateModalVisible(false);

      await checkAuthAndLoadData();
    } catch (error) {
      console.error('Failed to create world:', error);
      Alert.alert('Error', 'Failed to create world. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const openCreateModal = () => {
    setNewWorldTitle('');
    setNewWorldDescription('');
    setIsCreateModalVisible(true);
  };

  const closeCreateModal = () => {
    setNewWorldTitle('');
    setNewWorldDescription('');
    setIsCreateModalVisible(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.statusText}>Loading your worlds...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.actionButton} onPress={checkAuthAndLoadData}>
          <Text style={styles.actionButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.appHeader}>
        <Text style={styles.appHeaderText}>-- Odissea --</Text>
      </View>
      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.mainScrollContent}>
        {/* Worlds section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Worlds</Text>
          <Text style={styles.sectionSubtitle}>Tap one to interact and evolve it</Text>
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalListContent}
        >
          <TouchableOpacity
            key="new-world"
            style={styles.horizontalCard}
            onPress={openCreateModal}
            activeOpacity={0.7}
          >
            <View style={styles.newCardContent}>
              <Text style={styles.newCardText}>New World</Text>
            </View>
          </TouchableOpacity>
          {worlds.map((world) => (
            <TouchableOpacity
              key={world.id}
              style={styles.horizontalCard}
              onPress={() => selectWorld(world)}
              activeOpacity={0.7}
            >
              <Text style={styles.worldTitle} numberOfLines={2}>
                {world.title}
              </Text>
              {world.description ? (
                <Text style={styles.worldDescription} numberOfLines={3}>
                  {world.description}
                </Text>
              ) : null}
              <View style={styles.playButton}>
                <Text style={styles.playButtonText}>Evolve →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sessions section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Sessions</Text>
          <Text style={styles.sectionSubtitle}>Continue where you left off</Text>
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalListContent}
        >
          <TouchableOpacity
            key="new-session"
            style={styles.horizontalCard}
            onPress={handleNewSession}
            activeOpacity={0.7}
          >
            <View style={styles.newCardContent}>
              <Text style={styles.newCardText}>New Session</Text>
            </View>
          </TouchableOpacity>
          {sessions.map((session) => (
            <TouchableOpacity
              key={session.session_id}
              style={styles.horizontalCard}
              onPress={() => selectSession(session)}
              activeOpacity={0.7}
            >
              <Text style={styles.sessionLabel}>Session</Text>
              <Text style={styles.worldTitle} numberOfLines={2}>
                {session.world_title}
              </Text>
              <Text style={styles.sessionMeta} numberOfLines={1}>
                Last active: {formatDbDate(session.updated_at)}
              </Text>
              <View style={styles.playButton}>
                <Text style={styles.playButtonText}>Continue →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeCreateModal}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create New World</Text>
            <TouchableOpacity
              onPress={handleCreateWorld}
              disabled={isCreating || !newWorldTitle.trim()}
              style={[styles.modalSaveButton, (!newWorldTitle.trim() || isCreating) && styles.modalSaveButtonDisabled]}
            >
              <Text style={[styles.modalSaveText, (!newWorldTitle.trim() || isCreating) && styles.modalSaveTextDisabled]}>
                {isCreating ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={newWorldTitle}
                onChangeText={setNewWorldTitle}
                placeholder="Enter world title"
                placeholderTextColor="#94A3B8"
                maxLength={100}
                editable={!isCreating}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newWorldDescription}
                onChangeText={setNewWorldDescription}
                placeholder="Describe your world..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                maxLength={2000}
                editable={!isCreating}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appHeader: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  appHeaderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    paddingTop: 14,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  horizontalListContent: {
    paddingRight: 16,
    gap: 12,
  },
  horizontalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  worldTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  worldDescription: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 12,
  },
  playButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  playButtonText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  newCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newCardText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  sessionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  statusText: {
    marginTop: 10,
    color: '#64748B',
  },
  errorText: {
    color: '#EF4444',
    paddingHorizontal: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  actionButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCancelText: {
    color: '#64748B',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalSaveButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  modalSaveText: {
    color: 'white',
    fontWeight: '600',
  },
  modalSaveTextDisabled: {
    color: '#94A3B8',
  },
  modalContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 8,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#0F172A',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
