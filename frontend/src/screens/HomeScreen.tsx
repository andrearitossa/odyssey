import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList, RootStackParamList, World } from '../types';
import { GoogleTokenManager, createWorld, getMyWorlds, listSessions, SessionSummary } from '../api';
import { AppHeader, Button, ErrorView, LoadingView, ModalHeader, Screen, TextField, theme } from '../ui';

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
      <Screen>
        <LoadingView label="Loading your worlds..." />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={checkAuthAndLoadData} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Odyssey" />
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
            style={[styles.horizontalCard, styles.smallCreateCard]}
            onPress={openCreateModal}
            activeOpacity={0.7}
          >
            <Text style={styles.smallCreateCardTitle}>New World</Text>
            <Text style={styles.smallCreateCardSubtitle}>Create a fresh setting</Text>
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
            style={[styles.horizontalCard, styles.smallCreateCard]}
            onPress={handleNewSession}
            activeOpacity={0.7}
          >
            <Text style={styles.smallCreateCardTitle}>New Session</Text>
            <Text style={styles.smallCreateCardSubtitle}>Pick a world to start</Text>
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
        <Screen>
          <ModalHeader
            title="Create New World"
            onCancel={closeCreateModal}
            onConfirm={handleCreateWorld}
            confirmLabel={isCreating ? 'Creating…' : 'Create'}
            confirmDisabled={!newWorldTitle.trim() || isCreating}
            confirmLoading={isCreating}
          />
          <ScrollView style={styles.modalContent}>
            <TextField
              label="Title"
              required
              value={newWorldTitle}
              onChangeText={setNewWorldTitle}
              placeholder="Enter world title"
              maxLength={100}
              editable={!isCreating}
            />

            <TextField
              label="Description"
              value={newWorldDescription}
              onChangeText={setNewWorldDescription}
              placeholder="Describe your world…"
              multiline
              numberOfLines={4}
              maxLength={2000}
              editable={!isCreating}
              style={styles.textArea}
            />
            <View style={styles.modalFooter}>
              <Button label="Close" onPress={closeCreateModal} variant="secondary" />
            </View>
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
    color: theme.colors.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  horizontalListContent: {
    paddingRight: 16,
    gap: 12,
  },
  horizontalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    width: 280,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  smallCreateCard: {
    width: 220,
    padding: 14,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: theme.colors.goldSoft,
    backgroundColor: theme.colors.surfaceAlt,
  },
  smallCreateCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.wine,
    marginBottom: 6,
  },
  smallCreateCardSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  worldTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  worldDescription: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  playButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.goldSoft,
  },
  playButtonText: {
    color: theme.colors.wineDark,
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
    color: theme.colors.wine,
  },
  sessionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.wine,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sessionMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  statusText: {
    marginTop: 10,
    color: theme.colors.textMuted,
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
  modalContent: {
    padding: 16,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalFooter: {
    marginTop: theme.spacing.sm,
  },
});
