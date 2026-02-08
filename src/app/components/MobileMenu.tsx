/**
 * Mobile menu: high-frequency actions. Plan Phase 4.4.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface MobileMenuProps {
  visible: boolean;
  onClose: () => void;
}

const MENU_ITEMS: { label: string; screen: string; params?: object }[] = [
  { label: 'Manage', screen: 'Manage' },
  { label: 'Downloads', screen: 'Downloads' },
  { label: 'Subscriptions', screen: 'Subscriptions' },
  { label: 'Settings', screen: 'MainTabs', params: { screen: 'Settings' } },
  { label: 'Collections', screen: 'MainTabs', params: { screen: 'Collections' } },
  { label: 'Authors', screen: 'Author' },
  { label: 'Instruction', screen: 'Instruction' },
];

export function MobileMenu({ visible, onClose }: MobileMenuProps) {
  const navigation = useNavigation();

  const handlePress = useCallback(
    (screen: string, params?: object) => {
      onClose();
      if (!screen) return;
      const nav = navigation as { navigate: (s: string, p?: object) => void };
      if (screen === 'MainTabs' && params) {
        nav.navigate('MainTabs', params);
      } else {
        nav.navigate(screen, params);
      }
    },
    [navigation, onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.menu}>
          <View style={styles.header}>
            <Text style={styles.title}>Menu</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.item}
              onPress={() => handlePress(item.screen, item.params)}
              disabled={!item.screen}
            >
              <Text style={[styles.itemText, !item.screen && styles.itemTextDisabled]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  menu: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#aaa',
    fontSize: 18,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  itemText: {
    color: '#fff',
    fontSize: 16,
  },
  itemTextDisabled: {
    color: '#666',
  },
});
