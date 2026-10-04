import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LoadingView } from '@/components/loading-view';
import { SessionProvider, useSession } from '@/features/auth/session';
import { notificationRoute } from '@/features/notifications/text';
import { useMyProfile } from '@/features/profile/hooks';
import { t } from '@/i18n';
import type { ItemRequest } from '@/lib/database.types';
import { onPushTap, registerForPush } from '@/lib/push';
import { installGlobalErrorHandler, reportError, track } from '@/lib/monitoring';
import { queryClient } from '@/lib/query-client';
import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync();
installGlobalErrorHandler();
track('app_opened');

/** Shown instead of a screen that crashed while rendering; the crash is logged. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    reportError(error, { kind: 'crash', screen: 'render' });
  }, [error]);
  return <LoadingView error={t('errors.crashed')} retryLabel={t('common.retry')} onRetry={retry} />;
}

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

  const ready = !!session && !!profile.data && profile.data.home_city_id !== null;
  const userId = session?.user.id;
  const router = useRouter();

  // Push: save this phone's token once signed in (no-op in Expo Go).
  useEffect(() => {
    if (ready) registerForPush().catch(() => undefined);
  }, [ready, userId]);

  // Tapping a push opens the screen it is about.
  useEffect(() => {
    if (!ready) return;
    return onPushTap((tap) => {
      const mine =
        queryClient.getQueryData<ItemRequest[]>(['requests', 'mine', userId ?? '']) ?? [];
      router.push(
        notificationRoute(
          { kind: tap.kind, request_id: tap.requestId, trip_id: tap.tripId },
          mine.map((r) => r.id),
        ),
      );
    });
  }, [ready, router, userId]);

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
        <Stack.Screen name="traveler/index" options={{ title: t('traveler.title') }} />
        <Stack.Screen name="traveler/verify-id" options={{ title: t('verifyId.title') }} />
        <Stack.Screen name="traveler/trips/new" options={{ title: t('trips.newTitle') }} />
        <Stack.Screen name="traveler/trips/[id]" options={{ title: t('trips.detailTitle') }} />
        <Stack.Screen name="traveler/feed" options={{ title: t('offers.feedTitle') }} />
        <Stack.Screen name="pay/[requestId]" options={{ title: t('payment.title') }} />
        <Stack.Screen
          name="handover-code/[requestId]"
          options={{ title: t('delivery.codeTitle') }}
        />
        <Stack.Screen name="dispute/[requestId]" options={{ title: t('dispute.title') }} />
        <Stack.Screen name="chat/[requestId]" options={{ title: t('chat.title') }} />
        <Stack.Screen name="report/[userId]" options={{ title: t('safety.title') }} />
        <Stack.Screen name="blocked" options={{ title: t('safety.blockedListTitle') }} />
        <Stack.Screen name="admin/dashboard" options={{ title: t('adminDashboard.title') }} />
        <Stack.Screen name="admin/reports/index" options={{ title: t('adminDashboard.reports') }} />
        <Stack.Screen name="admin/reports/[id]" options={{ title: t('adminDashboard.reports') }} />
        <Stack.Screen name="admin/errors" options={{ title: t('adminDashboard.errors') }} />
        <Stack.Screen name="updates" options={{ title: t('notifications.title') }} />
        <Stack.Screen name="traveler/requests/[id]" options={{ title: t('offers.requestTitle') }} />

        {/* Admin screens check admin rights themselves (AdminOnly); the database enforces them. */}
        <Stack.Screen name="admin/index" options={{ title: t('admin.title') }} />
        <Stack.Screen name="admin/verifications/[id]" options={{ title: t('admin.title') }} />
        <Stack.Screen name="admin/trips/[id]" options={{ title: t('admin.title') }} />
        <Stack.Screen
          name="admin/disputes/[requestId]"
          options={{ title: t('adminDisputes.title') }}
        />
      </Stack.Protected>
      <Stack.Screen name="legal/privacy" options={{ title: t('legal.privacyTitle') }} />
      <Stack.Screen name="legal/terms" options={{ title: t('legal.termsTitle') }} />
    </Stack>
  );
}
