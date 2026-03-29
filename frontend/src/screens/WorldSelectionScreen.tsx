import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList, RootStackParamList, World } from '../types';
import { GoogleTokenManager, getAllWorlds, createWorld } from '../api';
import { AppHeader, Button, ErrorView, LoadingView, ModalHeader, Screen, TextField, theme } from '../ui';

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
      <Screen>
        <LoadingView label="Loading worlds..." />
      </Screen>
    );
  }

  // Error state
  if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={loadWorlds} />
      </Screen>
    );
  }

  // Main content
  return (
    <Screen>
      <AppHeader
        title="Choose Your Adventure"
        center={
          isSearchActive ? (
            <View style={styles.searchBarContainer}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search worlds (use * and ? wildcards)"
                placeholderTextColor={theme.colors.textMuted}
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
            <View style={styles.headerTitleBlock}>
              <Text style={styles.title}>Choose Your Adventure</Text>
              <Text style={styles.subtitle}>Select a world to begin your story</Text>
            </View>
          )
        }
        right={
          isSearchActive ? (
            <TouchableOpacity style={styles.searchButton} onPress={closeSearch}>
              <Text style={styles.searchButtonText}>✕</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.searchButton} onPress={openSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          )
        }
      />

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
              maxLength={500}
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
  headerTitleBlock: {
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
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
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  worldTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  worldDescription: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  playButton: {
    backgroundColor: theme.colors.wine,
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
    color: theme.colors.textMuted,
  },
  addButton: {
    backgroundColor: theme.colors.wine,
    padding: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: theme.colors.wine,
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
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  searchClearButton: {
    marginLeft: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  createCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: theme.colors.goldSoft,
    backgroundColor: theme.colors.surfaceAlt,
  },
  createCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.wine,
    marginBottom: 6,
  },
  createCardSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  modalContent: {
    padding: 20,
  },
  textArea: {
    height: 120,
  },
  modalFooter: {
    marginTop: theme.spacing.sm,
  },
}); 