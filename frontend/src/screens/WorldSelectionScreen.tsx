import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList, RootStackParamList, World } from '../types';
import { GoogleTokenManager, getAllWorlds, createWorld } from '../api';

const buildQueryMatchers = (query: string): RegExp[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms = trimmed.split(/\s+/).filter(Boolean);

  return terms.map((term) => {
    const escaped = term.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(withWildcards, 'i');
  });
};

const matchesAll = (matchers: RegExp[], value: string | null | undefined): boolean => {
  if (matchers.length === 0) return true;
  if (!value) return false;
  return matchers.every((re) => re.test(value));
};

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'Search'>,
  NativeStackScreenProps<RootStackParamList>
>;

export const WorldSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorldTitle, setNewWorldTitle] = useState('');
  const [newWorldDescription, setNewWorldDescription] = useState('');

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    checkAuthAndLoadWorlds();
  }, []);

  useEffect(() => {
    if (!isSearchActive) return;
    const handle = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(handle);
  }, [isSearchActive]);

  const checkAuthAndLoadWorlds = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is authenticated first
      const authResult = await GoogleTokenManager.checkExistingAuth();
      if (!authResult.isAuthenticated) {
        // Redirect to authentication
        navigation.getParent()?.navigate('GoogleAuth');
        return;
      }
      
      // User is authenticated, load worlds
      const token = await GoogleTokenManager.getValidToken();
      
      if (!token) {
        // This shouldn't happen if checkExistingAuth passed, but just in case
        navigation.getParent()?.navigate('GoogleAuth');
        return;
      }
      
      const worldsData = await getAllWorlds(token);
      setWorlds(worldsData);
      
    } catch (error) {
      console.error('Error loading worlds:', error);
      
      // Check if it's a network/blocking error
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        setError('Unable to connect to server. If you\'re in development mode, this might be due to ad blockers or browser security. Please check the console for troubleshooting tips.');
      } else if (error instanceof Error && error.message.includes('Authentication')) {
        // Authentication-related errors - redirect to login
        navigation.getParent()?.navigate('GoogleAuth');
        return;
      } else {
        // Generic error
        setError('Failed to load worlds. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadWorlds = async () => {
    await checkAuthAndLoadWorlds();
  };

  const selectWorld = (world: World) => {
    navigation.getParent()?.navigate('Session', {
      worldId: world.id,
      worldTitle: world.title,
    });
  };

  const openSearch = () => {
    setIsSearchActive(true);
  };

  const closeSearch = () => {
    setIsSearchActive(false);
    setSearchQuery('');
  };

  const filteredWorlds = useMemo(() => {
    const matchers = buildQueryMatchers(searchQuery);
    if (matchers.length === 0) return worlds;

    const titleMatches: World[] = [];
    const descriptionMatches: World[] = [];

    for (const world of worlds) {
      if (matchesAll(matchers, world.title)) {
        titleMatches.push(world);
        continue;
      }

      if (matchesAll(matchers, world.description)) {
        descriptionMatches.push(world);
      }
    }

    return [...titleMatches, ...descriptionMatches];
  }, [worlds, searchQuery]);

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
      
      // Reset form and close modal
      setNewWorldTitle('');
      setNewWorldDescription('');
      setIsCreateModalVisible(false);
      
      // Reload worlds to show the new one
      await loadWorlds();
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

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.statusText}>Loading worlds...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.actionButton} onPress={loadWorlds}>
          <Text style={styles.actionButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main content
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            {isSearchActive ? (
              <View style={styles.searchBarContainer}>
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search worlds (use * and ? wildcards)"
                  placeholderTextColor="#94A3B8"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {searchQuery.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    style={styles.searchClearButton}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Text style={styles.searchClearText}>×</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <>
                <Text style={styles.title}>Choose Your Adventure</Text>
                <Text style={styles.subtitle}>Select a world to begin your story</Text>
              </>
            )}
          </View>

          {isSearchActive ? (
            <TouchableOpacity style={styles.searchButton} onPress={closeSearch}>
              <Text style={styles.searchButtonText}>✕</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.searchButton} onPress={openSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={styles.worldsContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {!isSearchActive ? (
          <TouchableOpacity
            style={[styles.worldCard, styles.createCard]}
            onPress={openCreateModal}
            activeOpacity={0.7}
          >
            <Text style={styles.createCardTitle}>Create a new world</Text>
            <Text style={styles.createCardSubtitle}>Start fresh with a new setting</Text>
          </TouchableOpacity>
        ) : null}

        {filteredWorlds.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No matches found</Text>
            <Text style={styles.emptyStateSubtitle}>Try a different search pattern.</Text>
          </View>
        ) : null}

        {filteredWorlds.map((world) => (
          <TouchableOpacity
            key={world.id}
            style={styles.worldCard}
            onPress={() => selectWorld(world)}
            activeOpacity={0.7}
          >
            <Text style={styles.worldTitle}>{world.title}</Text>
            {world.description && (
              <Text style={styles.worldDescription} numberOfLines={3}>
                {world.description}
              </Text>
            )}
            <View style={styles.playButton}>
              <Text style={styles.playButtonText}>Start Adventure →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Create World Modal */}
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
                maxLength={500}
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  worldsContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  worldCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  worldTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  worldDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  playButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  playButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  actionButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#8B5CF6',
    padding: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
  },
  searchClearButton: {
    marginLeft: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    lineHeight: 18,
  },
  createCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#C4B5FD',
    backgroundColor: '#F5F3FF',
  },
  createCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5B21B6',
    marginBottom: 6,
  },
  createCardSubtitle: {
    fontSize: 14,
    color: '#6D28D9',
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#64748B',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  modalSaveButton: {
    backgroundColor: '#8B5CF6',
    padding: 12,
    borderRadius: 8,
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  modalSaveText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSaveTextDisabled: {
    color: '#94A3B8',
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  textArea: {
    height: 120,
  },
}); 