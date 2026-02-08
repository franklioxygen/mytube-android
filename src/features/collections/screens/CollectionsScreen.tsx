/**
 * Collections list. Create, rename, delete for admin. Phase 7.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CollectionRepository, collectionQueryKeys } from '../../../core/repositories';
import { useAuth } from '../../../core/auth/AuthContext';
import { canMutate } from '../../../core/utils/roleGate';
import type { AppError } from '../../../core/api/client';
import { useSnackbar } from '../../../app/providers';
import type { Collection } from '../../../types';

interface CollectionsScreenProps {
  onCollectionPress?: (collectionId: string) => void;
}

export function CollectionsScreen({ onCollectionPress }: CollectionsScreenProps) {
  const { role, loginRequired } = useAuth();
  const queryClient = useQueryClient();
  const { show, showError } = useSnackbar();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [editCollection, setEditCollection] = useState<Collection | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);

  const {
    data: collections = [],
    isLoading: loading,
    isRefetching: refreshing,
    error,
    refetch,
  } = useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => CollectionRepository.getCollections(),
    select: list => (Array.isArray(list) ? list : []),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => CollectionRepository.createCollection(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
      setCreateModalVisible(false);
      setCreateName('');
      show('Collection created');
    },
    onError: (err: { message?: string }) => {
      showError(err.message ?? 'Failed to create collection');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      CollectionRepository.updateCollection(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
      setEditCollection(null);
      setRenameName('');
      show('Collection renamed');
    },
    onError: (err: { message?: string }) => {
      showError(err.message ?? 'Failed to rename collection');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => CollectionRepository.deleteCollection(id, false),
    onMutate: id => {
      setDeletingCollectionId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
      show('Collection deleted');
    },
    onError: (err: AppError) => {
      // Delete is terminal for UI; backend may respond NOT_FOUND on repeats.
      if (err.code === 'NOT_FOUND') {
        queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
        show('Collection deleted');
        return;
      }
      showError(err.message ?? 'Failed to delete collection');
    },
    onSettled: () => {
      setDeletingCollectionId(null);
    },
  });

  const errorMessage =
    error != null
      ? (error as { message?: string }).message ?? 'Failed to load collections'
      : null;

  const canEdit = canMutate(role, loginRequired);
  const hasMutationInFlight =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const openCreateModal = useCallback(() => {
    if (hasMutationInFlight) return;
    setCreateName('');
    setCreateModalVisible(true);
  }, [hasMutationInFlight]);

  const closeCreateModal = useCallback(() => {
    setCreateModalVisible(false);
    setCreateName('');
  }, []);

  const submitCreate = useCallback(() => {
    if (hasMutationInFlight) return;
    const name = createName.trim();
    if (!name) return;
    createMutation.mutate(name);
  }, [createName, createMutation, hasMutationInFlight]);

  const openRenameModal = useCallback((c: Collection) => {
    if (hasMutationInFlight) return;
    setEditCollection(c);
    setRenameName(c.name ?? c.title ?? '');
  }, [hasMutationInFlight]);

  const closeRenameModal = useCallback(() => {
    setEditCollection(null);
    setRenameName('');
  }, []);

  const submitRename = useCallback(() => {
    if (hasMutationInFlight) return;
    if (!editCollection) return;
    const name = renameName.trim();
    if (!name) return;
    updateMutation.mutate({ id: editCollection.id, name });
  }, [editCollection, renameName, updateMutation, hasMutationInFlight]);

  const confirmDelete = useCallback(
    (c: Collection) => {
      if (hasMutationInFlight) return;
      Alert.alert(
        'Delete collection',
        'Delete this collection? Videos in it are not deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteMutation.mutate(c.id),
          },
        ]
      );
    },
    [deleteMutation, hasMutationInFlight]
  );

  const renderItem = useCallback(
    ({ item }: { item: Collection }) => (
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardMain}
            onPress={() => onCollectionPress?.(item.id)}
            disabled={!onCollectionPress}
            activeOpacity={0.7}
          >
            <Text style={styles.name}>{item.name ?? item.title}</Text>
            <Text style={styles.meta}>{item.videos?.length ?? 0} videos</Text>
          </TouchableOpacity>
          {canEdit && (
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.actionBtn, hasMutationInFlight && styles.actionBtnDisabled]}
                onPress={() => openRenameModal(item)}
                disabled={hasMutationInFlight}
                accessibilityLabel="Rename collection"
              >
                <Text style={styles.actionBtnText}>
                  {updateMutation.isPending ? 'Saving…' : 'Edit'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.actionBtnDanger,
                  hasMutationInFlight && styles.actionBtnDisabled,
                ]}
                onPress={() => confirmDelete(item)}
                disabled={hasMutationInFlight}
                accessibilityLabel="Delete collection"
              >
                <Text style={styles.actionBtnText}>
                  {deleteMutation.isPending && deletingCollectionId === item.id
                    ? 'Deleting…'
                    : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    ),
    [
      canEdit,
      onCollectionPress,
      openRenameModal,
      confirmDelete,
      hasMutationInFlight,
      updateMutation.isPending,
      deleteMutation.isPending,
      deletingCollectionId,
    ]
  );

  if (loading && collections.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading collections…</Text>
      </View>
    );
  }

  if (errorMessage != null && collections.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {canEdit && (
        <View style={styles.banner}>
          <TouchableOpacity
            style={[styles.addButton, hasMutationInFlight && styles.actionBtnDisabled]}
            onPress={openCreateModal}
            disabled={hasMutationInFlight}
            accessibilityLabel="Add collection"
          >
            <Text style={styles.addButtonText}>+ Add collection</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={collections}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => refetch()}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No collections yet.</Text>
        }
      />

      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreateModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeCreateModal}>
          <Pressable style={styles.modalBox} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>New collection</Text>
            <TextInput
              style={styles.input}
              placeholder="Collection name"
              placeholderTextColor="#888"
              value={createName}
              onChangeText={setCreateName}
              autoCapitalize="words"
            />
            {createMutation.isError && (
              <Text style={styles.inlineError}>
                {(createMutation.error as { message?: string }).message}
              </Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSpacer]}
                onPress={closeCreateModal}
                disabled={hasMutationInFlight}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={submitCreate}
                disabled={!createName.trim() || hasMutationInFlight}
              >
                <Text style={styles.modalButtonText}>
                  {createMutation.isPending ? 'Creating…' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editCollection != null}
        transparent
        animationType="fade"
        onRequestClose={closeRenameModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeRenameModal}>
          <Pressable style={styles.modalBox} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Rename collection</Text>
            <TextInput
              style={styles.input}
              placeholder="Collection name"
              placeholderTextColor="#888"
              value={renameName}
              onChangeText={setRenameName}
              autoCapitalize="words"
            />
            {updateMutation.isError && (
              <Text style={styles.inlineError}>
                {(updateMutation.error as { message?: string }).message}
              </Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSpacer]}
                onPress={closeRenameModal}
                disabled={hasMutationInFlight}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={submitRename}
                disabled={!renameName.trim() || hasMutationInFlight}
              >
                <Text style={styles.modalButtonText}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
  },
  errorText: {
    color: '#f66',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  banner: {
    padding: 12,
    backgroundColor: '#2a2a2a',
  },
  addButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  cardWrap: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  cardMain: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  meta: {
    color: '#888',
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnDanger: {
    marginLeft: 8,
    backgroundColor: '#5a2a2a',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  inlineError: {
    color: '#f66',
    fontSize: 13,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  modalButtonSpacer: {
    marginRight: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#0a7ea4',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
