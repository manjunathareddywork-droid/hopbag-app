import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
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

const adminHeader = (title: string) => ({
  headerShown: true,
  title,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { fontFamily: fonts.bold },
});

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
    Outfit_700Bold,
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
 * signed out -> welcome/intro/sign-in/verify; signed in without profile -> onboarding;
 * else the tabs and the screens they open.
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
        // Screens draw their own header (back button and title), as in the designs.
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="verify" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasProfile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && hasProfile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="requests/new" />
        <Stack.Screen name="requests/[id]" />
        <Stack.Screen name="offers/[id]" />
        <Stack.Screen name="pay/[requestId]" />
        <Stack.Screen name="paid/[requestId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="handover-code/[requestId]" />
        <Stack.Screen name="delivered/[requestId]" />
        <Stack.Screen name="dispute/[requestId]" />
        <Stack.Screen name="chat/[requestId]" />
        <Stack.Screen name="updates" />
        <Stack.Screen name="not-allowed" />
        <Stack.Screen name="traveler/verify-id" />
        <Stack.Screen name="traveler/status" />
        <Stack.Screen name="traveler/trips/new" />
        <Stack.Screen name="traveler/trips/[id]" />
        <Stack.Screen name="traveler/requests/[id]" />
        <Stack.Screen name="traveler/offer-sent" options={{ gestureEnabled: false }} />
        <Stack.Screen name="traveler/pickup/[requestId]" />
        <Stack.Screen name="traveler/deliver/[requestId]" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="support" />
        <Stack.Screen name="how-payments" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="report/[userId]" />
        <Stack.Screen name="blocked" />

        {/* Admin tools keep the plain header. They check admin rights themselves (AdminOnly);
            the database enforces them. */}
        <Stack.Screen name="admin/dashboard" options={adminHeader(t('adminDashboard.title'))} />
        <Stack.Screen
          name="admin/reports/index"
          options={adminHeader(t('adminDashboard.reports'))}
        />
        <Stack.Screen
          name="admin/reports/[id]"
          options={adminHeader(t('adminDashboard.reports'))}
        />
        <Stack.Screen name="admin/errors" options={adminHeader(t('adminDashboard.errors'))} />
        <Stack.Screen name="admin/index" options={adminHeader(t('admin.title'))} />
        <Stack.Screen name="admin/verifications/[id]" options={adminHeader(t('admin.title'))} />
        <Stack.Screen name="admin/trips/[id]" options={adminHeader(t('admin.title'))} />
        <Stack.Screen
          name="admin/disputes/[requestId]"
          options={adminHeader(t('adminDisputes.title'))}
        />
      </Stack.Protected>
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/terms" />
    </Stack>
  );
}
