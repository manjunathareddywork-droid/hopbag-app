import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { NotificationKind } from './database.types';
import { supabase } from './supabase';

/**
 * Remote push needs a real build: Expo Go has none on Android since SDK 53, and
 * simply loading expo-notifications there prints a warning. So the module is only
 * loaded outside Expo Go. The in-app Updates screen works everywhere.
 */
const pushAvailable =
  Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const projectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

let handlerSet = false;

async function notificationsModule() {
  const Notifications = await import('expo-notifications');
  if (!handlerSet) {
    // Show pushes as banners while the app is open too.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerSet = true;
  }
  return Notifications;
}

/** Asks for permission and saves this phone's Expo push token for the signed-in user. */
export async function registerForPush(): Promise<'registered' | 'unsupported' | 'denied'> {
  const id = projectId();
  if (!pushAvailable || !id) return 'unsupported';
  const Notifications = await notificationsModule();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Hopbag',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return 'denied';

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;
  return 'registered';
}

/** Stop pushes to this phone for the user who is signing out. */
export async function unregisterPush(): Promise<void> {
  const id = projectId();
  if (!pushAvailable || !id) return;
  try {
    const Notifications = await notificationsModule();
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // Signing out must never fail because of push clean-up.
  }
}

export type PushTap = {
  kind: NotificationKind;
  requestId: string | null;
  tripId: string | null;
};

/** Calls onTap when the user taps a Hopbag push. Returns an unsubscribe function. */
export function onPushTap(onTap: (tap: PushTap) => void): () => void {
  if (!pushAvailable) return () => undefined;
  let remove: (() => void) | undefined;
  let cancelled = false;
  notificationsModule().then((Notifications) => {
    if (cancelled) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Partial<PushTap>;
      if (data?.kind) {
        onTap({ kind: data.kind, requestId: data.requestId ?? null, tripId: data.tripId ?? null });
      }
    });
    remove = () => sub.remove();
  });
  return () => {
    cancelled = true;
    remove?.();
  };
}
