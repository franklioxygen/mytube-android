/**
 * Root navigation: auth gate and main app (tabs + stack).
 * Plan: Auth stack (Login), Main = tabs (Home, Collections, Settings) + stack (VideoDetail, CollectionDetail, etc.).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../core/auth/AuthContext';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
import { VideoDetailScreen } from '../../features/player/screens/VideoDetailScreen';
import { CollectionsScreen } from '../../features/collections/screens/CollectionsScreen';
import { CollectionDetailScreen } from '../../features/collections/screens/CollectionDetailScreen';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen';
import { ManageScreen } from '../../features/manage/screens/ManageScreen';
import { AuthorScreen } from '../../features/author/screens/AuthorScreen';
import { SearchScreen } from '../../features/search/screens/SearchScreen';
import { InstructionScreen } from '../../features/instruction/screens/InstructionScreen';
import { DownloadsScreen } from '../../features/downloads/screens/DownloadsScreen';
import { SubscriptionsScreen } from '../../features/subscriptions/screens/SubscriptionsScreen';
import { AppTopBar } from '../components/AppTopBar';

export type MainTabsParamList = {
  Home: undefined;
  Collections: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined | { screen: keyof MainTabsParamList };
  VideoDetail: { videoId: string };
  CollectionDetail: { collectionId: string };
  Author: { authorName?: string };
  Manage: undefined;
  Downloads: undefined;
  Subscriptions: undefined;
  Search: { query?: string };
  Instruction: undefined;
};

interface RootNavigatorProps {
  onRequestChangeBackendUrl?: () => void;
}

const Stack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator();
const renderTopBar = () => <AppTopBar />;

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        header: renderTopBar,
        tabBarStyle: { backgroundColor: '#1a1a1a' },
        tabBarActiveTintColor: '#0a7ea4',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreenWrapper}
        options={{ title: t('home') }}
      />
      <Tab.Screen
        name="Collections"
        component={CollectionsScreenWrapper}
        options={{ title: t('collections') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreenWrapper}
        options={{ title: t('settings') }}
      />
    </Tab.Navigator>
  );
}

function HomeScreenWrapper({
  navigation,
}: {
  navigation: { navigate: (name: string, params: { videoId: string }) => void };
}) {
  return (
    <HomeScreen
      onVideoPress={videoId => navigation.navigate('VideoDetail', { videoId })}
    />
  );
}

function CollectionsScreenWrapper({
  navigation,
}: {
  navigation: { navigate: (name: string, params: { collectionId: string }) => void };
}) {
  return (
    <CollectionsScreen
      onCollectionPress={id => navigation.navigate('CollectionDetail', { collectionId: id })}
    />
  );
}

function SettingsScreenWrapper() {
  return <SettingsScreen onLogout={() => {}} />;
}

function VideoDetailScreenWrapper({
  route,
  navigation,
}: {
  route: { params: { videoId: string } };
  navigation: { goBack: () => void; navigate: (s: string, p: object) => void };
}) {
  return (
    <VideoDetailScreen
      videoId={route.params.videoId}
      onBack={() => navigation.goBack()}
      onAuthorPress={name => navigation.navigate('Author', { authorName: name })}
    />
  );
}

function AuthorScreenWrapper({
  route,
  navigation,
}: {
  route: { params: { authorName?: string } };
  navigation: { navigate: (s: string, p: object) => void };
}) {
  return (
    <AuthorScreen
      authorName={route.params?.authorName}
      onVideoPress={videoId => navigation.navigate('VideoDetail', { videoId })}
    />
  );
}

function ManageScreenWrapper({
  navigation,
}: {
  navigation: { navigate: (s: string, p: object) => void };
}) {
  return (
    <ManageScreen
      onVideoPress={videoId => navigation.navigate('VideoDetail', { videoId })}
      onCollectionPress={id => navigation.navigate('CollectionDetail', { collectionId: id })}
    />
  );
}

function MainStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator
      screenOptions={{
        header: renderTopBar,
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VideoDetail"
        component={VideoDetailScreenWrapper}
        options={{ title: t('video') }}
      />
      <Stack.Screen
        name="CollectionDetail"
        component={CollectionDetailScreen}
        options={{ title: t('collection') }}
      />
      <Stack.Screen
        name="Author"
        component={AuthorScreenWrapper}
        options={{ title: t('author') }}
      />
      <Stack.Screen
        name="Manage"
        component={ManageScreenWrapper}
        options={{ title: t('manage') }}
      />
      <Stack.Screen
        name="Downloads"
        component={DownloadsScreen}
        options={{ title: t('downloads') }}
      />
      <Stack.Screen
        name="Subscriptions"
        component={SubscriptionsScreen}
        options={{ title: t('subscriptions') }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: t('search') }}
      />
      <Stack.Screen
        name="Instruction"
        component={InstructionScreen}
        options={{ title: t('instruction') }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator({ onRequestChangeBackendUrl }: RootNavigatorProps) {
  const { loginRequired, loading, hasValidSession, refreshAuthConfig } = useAuth();
  const showLogin = loginRequired && !hasValidSession;
  const [showSlowStartupHelp, setShowSlowStartupHelp] = React.useState(false);

  React.useEffect(() => {
    if (!loading) {
      setShowSlowStartupHelp(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowSlowStartupHelp(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading…</Text>
        {showSlowStartupHelp && (
          <>
            <Text style={styles.helpText}>
              Startup is taking longer than expected. Check backend URL/server and retry.
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.retryButton]}
              onPress={() => {
                void refreshAuthConfig();
              }}
            >
              <Text style={styles.actionButtonText}>Retry startup</Text>
            </TouchableOpacity>
            {onRequestChangeBackendUrl != null && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={onRequestChangeBackendUrl}
              >
                <Text style={styles.actionButtonText}>Change backend URL</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer>
      {showLogin ? (
        <LoginScreen
          onLoginSuccess={() => {}}
          onChangeBackendUrl={onRequestChangeBackendUrl}
        />
      ) : (
        <MainStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#aaa',
  },
  helpText: {
    marginTop: 12,
    color: '#aaa',
    textAlign: 'center',
    paddingHorizontal: 24,
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
  },
  secondaryButton: {
    backgroundColor: '#3a3a3a',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
