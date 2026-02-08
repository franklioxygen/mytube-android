/**
 * Global header: menu and search input.
 * Visible on all authenticated screens. Plan Phase 4.1, 4.4.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/RootNavigator';
import { MobileMenu } from './MobileMenu';

export function AppTopBar() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [menuVisible, setMenuVisible] = useState(false);
  const [inputText, setInputText] = useState('');

  const handleSubmit = useCallback(() => {
    const q = inputText.trim();
    if (!q) return;
    setInputText('');
    navigation.navigate('Search', { query: q });
  }, [inputText, navigation]);

  const openMenu = useCallback(() => setMenuVisible(true), []);
  const closeMenu = useCallback(() => setMenuVisible(false), []);

  return (
    <View style={styles.bar}>
      <TouchableOpacity style={styles.menuButton} onPress={openMenu} accessibilityLabel="Menu">
        <Text style={styles.menuIcon}>☰</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        placeholder="Search videos"
        placeholderTextColor="#888"
        value={inputText}
        onChangeText={setInputText}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
      />
      <MobileMenu
        visible={menuVisible}
        onClose={closeMenu}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    color: '#fff',
    fontSize: 22,
  },
  input: {
    flex: 1,
    height: 40,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
  },
});
