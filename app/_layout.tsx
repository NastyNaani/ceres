import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  Orbitron_500Medium,
  Orbitron_600SemiBold,
  Orbitron_700Bold,
} from '@expo-google-fonts/orbitron';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Onboarding } from '../components/Onboarding';
import { HistoryProvider } from '../lib/history';
import { SettingsProvider, useSettings } from '../lib/settings';
import { colors } from '../theme';

export default function RootLayout() {
  const [loaded] = useFonts({
    Orbitron_500Medium,
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.void).catch(() => {});
  }, []);

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: colors.void }} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SettingsProvider>
          <HistoryProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.void },
                animation: 'fade',
                animationDuration: 180,
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="privacy" options={{ animation: 'fade', presentation: 'card' }} />
            </Stack>
            <OnboardingGate />
          </HistoryProvider>
        </SettingsProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

function OnboardingGate() {
  const { settings, ready, update } = useSettings();
  if (!ready || settings.onboarded) return null;
  return <Onboarding onDone={() => update('onboarded', true)} />;
}
