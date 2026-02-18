/**
 * Global header: logo/title, search input, and menu.
 * Visible on all authenticated screens except login.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import type { MainStackParamList } from '../navigation/RootNavigator';
import { MobileMenu } from './MobileMenu';
import { SettingsRepository, settingsQueryKeys } from '../../core/repositories';
import { useAuth } from '../../core/auth/AuthContext';

export function AppTopBar() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [menuVisible, setMenuVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const { passwordEnabled } = useAuth();

  const settingsQuery = useQuery({
    queryKey: settingsQueryKeys.settings,
    queryFn: () => SettingsRepository.getSettings(),
  });

  const websiteName = useMemo(() => {
    const fromSettings = settingsQuery.data?.websiteName?.trim();
    if (fromSettings) return fromSettings;
    const fromAuthConfig = passwordEnabled?.websiteName?.trim();
    if (fromAuthConfig) return fromAuthConfig;
    return 'MyTube';
  }, [passwordEnabled?.websiteName, settingsQuery.data?.websiteName]);

  const handleSubmit = useCallback(() => {
    const q = inputText.trim();
    if (!q) return;
    setInputText('');
    navigation.navigate('Search', { query: q });
  }, [inputText, navigation]);

  const handleGoHome = useCallback(() => {
    const parentNavigation = navigation.getParent();
    if (parentNavigation != null) {
      parentNavigation.dispatch(
        CommonActions.navigate('MainTabs', { screen: 'Home' })
      );
      return;
    }
    navigation.navigate('MainTabs', { screen: 'Home' });
  }, [navigation]);

  const openMenu = useCallback(() => setMenuVisible(true), []);
  const closeMenu = useCallback(() => setMenuVisible(false), []);

  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={styles.logoWrap}
        onPress={handleGoHome}
        accessibilityRole="button"
        accessibilityLabel="Go to home"
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {websiteName}
          </Text>
          {websiteName !== 'MyTube' && (
            <Text style={styles.subtitle} numberOfLines={1}>
              Powered by MyTube
            </Text>
          )}
        </View>
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

      <TouchableOpacity style={styles.menuButton} onPress={openMenu} accessibilityLabel="Menu">
        <Text style={styles.menuIcon}>☰</Text>
      </TouchableOpacity>
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
    height: 60,
    paddingHorizontal: 8,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    maxWidth: 148,
  },
  logo: {
    width: 30,
    height: 30,
  },
  titleWrap: {
    marginLeft: 6,
    flexShrink: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 10,
    lineHeight: 12,
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
    marginRight: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
  },
});
