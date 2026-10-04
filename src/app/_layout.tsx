import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LoadingView } from '@/components/loading-view';
import { SessionProvider, useSession } from '@/features/auth/session';
import { useMyProfile } from '@/features/profile/hooks';
import { t } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Outfit_600SemiBold,
  });

  // Fall back to system fonts if loading fails rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SessionProvider>
    </QueryClientProvider>
  );
}

/**
 * Which screens exist depends on auth state (Expo Router protected routes):
 * signed out -> sign-in/verify; signed in without profile -> onboarding; else the app.
 * This is navigation only; access control is enforced by RLS in the database.
 */
function RootNavigator() {
  const { session, isLoading } = useSession();
  const profile = useMyProfile();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  const signedIn = !!session;
  if (signedIn && profile.isPending) return <LoadingView />;
  if (signedIn && profile.isError) {
    return (
      <LoadingView
        error={t('common.networkError')}
        retryLabel={t('common.retry')}
        onRetry={() => profile.refetch()}
      />
    );
  }
  // Profiles from before the city list existed must choose a city (onboarding again).
  const hasProfile = !!profile.data && profile.data.home_city_id !== null;

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.bold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="verify" options={{ title: '' }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasProfile}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && hasProfile}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: t('account.title') }} />
        <Stack.Screen name="edit-profile" options={{ title: t('editProfile.title') }} />
        <Stack.Screen name="requests/index" options={{ title: t('requests.listTitle') }} />
        <Stack.Screen name="requests/new" options={{ title: t('requests.newTitle') }} />
        <Stack.Screen name="requests/[id]" options={{ title: t('requests.detailTitle') }} />
        <Stack.Screen name="not-allowed" options={{ title: t('notAllowed.title') }} />
      </Stack.Protected>
    </Stack>
  );
}
