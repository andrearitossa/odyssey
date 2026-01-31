import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList, RootStackParamList, World } from '../types';
import { GoogleTokenManager, createWorld, getMyWorlds } from '../api';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorldTitle, setNewWorldTitle] = useState('');
  const [newWorldDescription, setNewWorldDescription] = useState('');

  useEffect(() => {
    checkAuthAndLoadWorlds();
  }, []);

  const checkAuthAndLoadWorlds = async () => {
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

      const worldsData = await getMyWorlds(token);
      setWorlds(worldsData);
    } catch (error) {
      console.error('Error loading your worlds:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        setError('Unable to connect to server.');
      } else if (error instanceof Error && error.message.includes('Authentication')) {
        navigation.getParent()?.navigate('GoogleAuth');
        return;
      } else {
        setError('Failed to load your worlds. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectWorld = (world: World) => {
    navigation.navigate('WorldGeneration', { worldId: world.id });
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

      await checkAuthAndLoadWorlds();
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
        <TouchableOpacity style={styles.actionButton} onPress={checkAuthAndLoadWorlds}>
          <Text style={styles.actionButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Your Worlds</Text>
            <Text style={styles.subtitle}>Tap one to interact and evolve it</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.worldsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {worlds.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No worlds yet</Text>
            <Text style={styles.emptySubtitle}>Create your first world to start.</Text>
          </View>
        ) : (
          worlds.map((world) => (
            <TouchableOpacity
              key={world.id}
              style={styles.worldCard}
              onPress={() => selectWorld(world)}
              activeOpacity={0.7}
            >
              <Text style={styles.worldTitle}>{world.title}</Text>
              {world.description ? (
                <Text style={styles.worldDescription} numberOfLines={3}>
                  {world.description}
                </Text>
              ) : null}
              <View style={styles.playButton}>
                <Text style={styles.playButtonText}>Interact →</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
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
  header: {
    padding: 16,
    paddingTop: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  worldsContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  worldCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
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
