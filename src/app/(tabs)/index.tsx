import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { IconTile } from '@/components/icon-tile';
import { InfoBox } from '@/components/info-box';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useSession } from '@/features/auth/session';
import { useUnreadCount } from '@/features/notifications/hooks';
import { useCities, useStates } from '@/features/places/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { formatGrams } from '@/features/requests/weight';
import { useSuspension } from '@/features/safety/hooks';
import { useMyVerification, useUpcomingTrips } from '@/features/travelers/hooks';
import { t } from '@/i18n';
import type { UpcomingTrip } from '@/lib/database.types';
import { formatDay } from '@/lib/dates';
import { colors, fonts, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const unread = useUnreadCount();
  const suspension = useSuspension(useSession().session?.user.id).data;
  const verification = useMyVerification();
  const trips = useUpcomingTrips();
  const cities = useCities();
  const states = useStates();
  const [search, setSearch] = useState('');

  const firstName = profile?.full_name.split(' ')[0] ?? '';
  const home = cities.data?.find((c) => c.id === profile?.home_city_id);
  const cityName = (id: number) => cities.data?.find((c) => c.id === id)?.name ?? '';
  const list = trips.data ?? [];
  // Trips come into the home state; name the city when they all end there.
  const place =
    home && list.every((tr) => tr.to_city_id === home.id)
      ? home.name
      : (states.data?.find((s) => s.code === profile?.home_state)?.name ?? home?.name ?? '');

  function ask(item?: string) {
    router.push({ pathname: '/requests/new', params: item ? { item } : {} });
  }

  function travelling() {
    if (profile?.traveler_verified_at) router.push('/traveler/trips/new');
    else if (verification.data?.status === 'pending') router.push('/traveler/status');
    else router.push('/traveler/verify-id');
  }

  function askOnRoute(trip: UpcomingTrip) {
    router.push({
      pathname: '/requests/new',
      params: { from: String(trip.from_city_id), to: String(trip.to_city_id) },
    });
  }

  return (
    <Screen inTabs>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="caption" muted>
            {t('homeScreen.hi', { name: firstName })}
          </Text>
          <Text variant="title">{t('homeScreen.title')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0
              ? t('notifications.openWithCount', { count: unread })
              : t('homeScreen.notifications')
          }
          onPress={() => router.push('/updates')}
          style={styles.bell}
        >
          <Icon name="bell" size={24} />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      {suspension ? (
        <InfoBox tone="danger" icon="alert-circle">
          {t('safety.suspendedBanner', { reason: suspension.reason ?? '' })}
        </InfoBox>
      ) : null}

      <View style={styles.search}>
        <Icon name="search" size={22} />
        <TextInput
          accessibilityLabel={t('common.search')}
          placeholder={t('homeScreen.search')}
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={() => ask(search.trim() || undefined)}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.actions}>
        <Card tone="dark" onPress={() => ask()} style={styles.action}>
          <IconTile name="plus" tone="orange" size={48} />
          <Text variant="bodyStrong" style={styles.onDark}>
            {t('homeScreen.ask')}
          </Text>
        </Card>
        <Card onPress={travelling} style={styles.action}>
          <IconTile name="navigation" tone="tealTint" size={48} />
          <Text variant="bodyStrong">{t('homeScreen.travelling')}</Text>
        </Card>
      </View>

      <Text variant="heading" style={styles.section}>
        {t('homeScreen.travelersComing', { place })}
      </Text>
      {trips.isSuccess && list.length === 0 ? (
        <Text variant="body" muted>
          {t('homeScreen.noTravelers')}
        </Text>
      ) : null}
      {trips.isError ? (
        <Text variant="body" muted>
          {t('common.networkError')}
        </Text>
      ) : null}
      {list.map((trip) => (
        <Card key={trip.trip_id} onPress={() => askOnRoute(trip)} style={styles.trip}>
          <Avatar name={trip.traveler_name} size={52} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">
              {`${trip.traveler_name} · ${t('requests.route', {
                from: cityName(trip.from_city_id),
                to: cityName(trip.to_city_id),
              })}`}
            </Text>
            <Text variant="caption" muted>
              {t('homeScreen.tripLine', {
                date: formatDay(trip.travel_date),
                free: formatGrams(trip.free_grams),
              })}
            </Text>
          </View>
          <Badge label={t('homeScreen.verified')} tone="green" />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  flex: { flex: 1 },
  bell: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 11,
    height: 11,
    borderRadius: 3,
    backgroundColor: colors.orange,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg - 4,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 17, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md - 4 },
  action: { flex: 1, minHeight: 132, justifyContent: 'space-between', gap: spacing.md },
  onDark: { color: colors.white },
  section: { marginTop: spacing.xs },
  trip: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
