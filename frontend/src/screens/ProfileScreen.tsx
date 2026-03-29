import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { BottomTabParamList, User, UserWorld } from '../types';
import { ProfileAPI, SUPPORTED_LANGUAGES, SupportedLanguage } from '../api/profile';
import { AppHeader, ErrorView, LoadingView, ModalHeader, Screen, TextField, theme } from '../ui';

type Props = BottomTabScreenProps<BottomTabParamList, 'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<{ user: User; userWorlds: UserWorld[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('English');
  const [isUpdating, setIsUpdating] = useState(false);

  // Memoized profile data to avoid unnecessary re-renders
  const memoizedProfile = useMemo(() => profile, [profile]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const profileData = await ProfileAPI.getProfile();
      setProfile(profileData);
      setNewName(profileData.user.name);
      setSelectedLanguage(profileData.user.language as SupportedLanguage);
    } catch (error) {
      console.error('Failed to load profile:', error);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      setIsUpdating(true);
      const updatedProfile = await ProfileAPI.updateName(newName.trim());
      setProfile(updatedProfile);
      setIsEditNameModalVisible(false);
      Alert.alert('Success', 'Name updated successfully!');
    } catch (error) {
      console.error('Failed to update name:', error);
      Alert.alert('Error', 'Failed to update name. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateLanguage = async (language: SupportedLanguage) => {
    try {
      setIsUpdating(true);
      const updatedProfile = await ProfileAPI.updateLanguage(language);
      setProfile(updatedProfile);
      setSelectedLanguage(language);
      setIsLanguageModalVisible(false);
      Alert.alert('Success', 'Language updated successfully!');
    } catch (error) {
      console.error('Failed to update language:', error);
      Alert.alert('Error', 'Failed to update language. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditNameModal = () => {
    setNewName(memoizedProfile?.user.name || '');
    setIsEditNameModalVisible(true);
  };

  const openLanguageModal = () => {
    setSelectedLanguage((memoizedProfile?.user.language as SupportedLanguage) || 'English');
    setIsLanguageModalVisible(true);
  };

  const selectWorld = (world: UserWorld) => {
    // Navigate to world session
    navigation.getParent()?.navigate('Session', { 
      worldId: world.world_id, 
      worldTitle: world.world_title 
    });
  };

  // Loading state
  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading profile..." />
      </Screen>
    );
  }

  // Error state
  if (error || !memoizedProfile) {
    return (
      <Screen>
        <ErrorView message={error || 'Failed to load profile'} onRetry={loadProfile} retryLabel="Try Again" />
      </Screen>
    );
  }

  const { user, userWorlds } = memoizedProfile;

  return (
    <Screen>
      <AppHeader title="Profile" />

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {/* Profile Picture */}
            <View style={styles.profileImageContainer}>
              {user.picture_url ? (
                <Image 
                  source={{ uri: user.picture_url }} 
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.defaultProfileImage}>
                  <Ionicons name="person" size={32} color={theme.colors.wine} />
                </View>
              )}
            </View>

            {/* Name and Edit Button */}
            <View style={styles.profileInfo}>
              <View style={styles.nameContainer}>
                <Text style={styles.userName}>{user.name}</Text>
                <TouchableOpacity 
                  style={styles.editButton} 
                  onPress={openEditNameModal}
                >
                  <Ionicons name="pencil" size={16} color={theme.colors.goldDark} />
                </TouchableOpacity>
              </View>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>

          {/* Language Selection */}
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Language</Text>
            <TouchableOpacity 
              style={styles.languageSelector} 
              onPress={openLanguageModal}
            >
              <Text style={styles.languageText}>{user.language}</Text>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Worlds Section */}
        <View style={styles.worldsSection}>
          <Text style={styles.sectionTitle}>Your Worlds</Text>
          {userWorlds.length === 0 ? (
            <View style={styles.emptyWorlds}>
              <Ionicons name="globe-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyWorldsText}>No worlds yet</Text>
              <Text style={styles.emptyWorldsSubtext}>
                Start your first adventure to see it here!
              </Text>
            </View>
          ) : (
            userWorlds.map((world) => (
              <TouchableOpacity
                key={world.session_id}
                style={styles.worldCard}
                onPress={() => selectWorld(world)}
                activeOpacity={0.7}
              >
                <View style={styles.worldInfo}>
                  <Text style={styles.worldTitle}>{world.world_title}</Text>
                  {world.world_description && (
                    <Text style={styles.worldDescription} numberOfLines={2}>
                      {world.world_description}
                    </Text>
                  )}
                  <Text style={styles.worldDate}>
                    Last played: {new Date(world.updated_at).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.wine} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={isEditNameModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <Screen>
          <ModalHeader
            title="Edit Name"
            onCancel={() => setIsEditNameModalVisible(false)}
            onConfirm={handleUpdateName}
            confirmLabel="Save"
            confirmDisabled={!newName.trim() || isUpdating}
            confirmLoading={isUpdating}
          />
          <View style={styles.modalContent}>
            <TextField
              label="Name"
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              maxLength={50}
              editable={!isUpdating}
            />
          </View>
        </Screen>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={isLanguageModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <Screen>
          <ModalHeader
            title="Select Language"
            onCancel={() => setIsLanguageModalVisible(false)}
          />
          <ScrollView style={styles.modalContent}>
            {SUPPORTED_LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language}
                style={[
                  styles.languageOption,
                  selectedLanguage === language && styles.languageOptionSelected
                ]}
                onPress={() => handleUpdateLanguage(language)}
                disabled={isUpdating}
              >
                <Text style={[
                  styles.languageOptionText,
                  selectedLanguage === language && styles.languageOptionTextSelected
                ]}>
                  {language}
                </Text>
                {selectedLanguage === language && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.gold} />
                )}
              </TouchableOpacity>
            ))}
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.surfaceAlt,
  },
  defaultProfileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginRight: 8,
  },
  editButton: {
    padding: 4,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  languageText: {
    fontSize: 16,
    color: theme.colors.text,
    marginRight: 8,
  },
  worldsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  emptyWorlds: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  emptyWorldsText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textMuted,
    marginTop: 12,
  },
  emptyWorldsSubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  worldCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  worldInfo: {
    flex: 1,
  },
  worldTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  worldDescription: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
  worldDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  loadingText: {
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
  retryButton: {
    backgroundColor: theme.colors.wine,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  modalSaveButton: {
    backgroundColor: theme.colors.wine,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
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
  headerSpacer: {
    width: 60,
  },
  modalContent: {
    flex: 1,
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
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    fontSize: 16,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  languageOptionSelected: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  languageOptionText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  languageOptionTextSelected: {
    color: theme.colors.wine,
    fontWeight: '500',
  },
}); 