import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/loading-view';
import { SelectField } from '@/components/select-field';
import { Text } from '@/components/text';
import { FeedCard } from '@/features/offers/feed-card';
import { useFeed } from '@/features/offers/hooks';
import { useCities } from '@/features/places/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { useCategories } from '@/features/requests/hooks';
import { categoryText } from '@/features/requests/labels';
import { useMyTrips } from '@/features/travelers/hooks';
import { t } from '@/i18n';
import { formatDate, todayIst } from '@/lib/dates';
import { colors, fonts, radius, spacing } from '@/theme';

export default function FeedScreen() {
  const { data: profile } = useMyProfile();
  const trips = useMyTrips();
  const cities = useCities();
  const categories = useCategories();

  const today = todayIst();
  const usableTrips = useMemo(
    () =>
      profile?.traveler_verified_at
        ? (trips.data ?? []).filter(
            (tr) =>
              tr.status === 'active' && tr.ticket_status === 'approved' && tr.travel_date >= today,
          )
        : [],
    [profile, trips.data, today],
  );

  const [chosenTripId, setChosenTripId] = useState<string>();
  const tripId = chosenTripId ?? usableTrips[0]?.id;
  const [exactOnly, setExactOnly] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const feed = useFeed(tripId);

  if (!trips.data || !cities.data || !categories.data) {
    const failed = trips.isError || cities.isError || categories.isError;
    return (
      <LoadingView
        error={failed ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          trips.refetch();
          cities.refetch();
          categories.refetch();
        }}
      />
    );
  }

  if (usableTrips.length === 0) {
    return <LoadingView error={t('offers.noApprovedTrips')} />;
  }

  const cityName = (id: number) => cities.data.find((c) => c.id === id)?.name ?? '';
  const tripItems = usableTrips.map((tr) => ({
    value: tr.id,
    label: `${t('requests.route', {
      from: cityName(tr.from_city_id),
      to: cityName(tr.to_city_id),
    })}, ${formatDate(tr.travel_date)}`,
  }));
  const visible = (feed.data ?? []).filter(
    (r) => (!exactOnly || r.exact_match) && (!category || r.category_id === category),
  );

  const header = (
    <View style={styles.filters}>
      <SelectField
        label={t('offers.chooseTrip')}
        placeholder=""
        items={tripItems}
        value={tripId ?? ''}
        onChange={setChosenTripId}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <FilterChip
          label={t('offers.allCategories')}
          selected={category === null}
          onPress={() => setCategory(null)}
        />
        {categories.data.map((c) => (
          <FilterChip
            key={c.id}
            label={categoryText(c).name}
            selected={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </ScrollView>
      <View style={styles.toggle}>
        <Text variant="body">{t('offers.exactOnly')}</Text>
        <Switch
          accessibilityLabel={t('offers.exactOnly')}
          value={exactOnly}
          onValueChange={setExactOnly}
          trackColor={{ true: colors.teal, false: colors.border }}
          thumbColor={colors.white}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <FlatList
        data={visible}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        refreshing={feed.isRefetching}
        onRefresh={() => feed.refetch()}
        renderItem={({ item }) => (
          <FeedCard
            request={item}
            tripId={tripId!}
            cities={cities.data}
            categories={categories.data}
          />
        )}
        ListEmptyComponent={
          feed.isPending ? null : (
            <Text variant="body" muted style={styles.empty}>
              {feed.isError ? t('common.networkError') : t('offers.empty')}
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text variant="caption" style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  filters: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  chips: {
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.medium,
  },
  chipTextSelected: {
    color: colors.textOnDark,
  },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
