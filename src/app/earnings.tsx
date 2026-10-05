import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { InfoBox } from '@/components/info-box';
import { MenuGroup } from '@/components/menu';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { useMyPayouts } from '@/features/delivery/hooks';
import { useRequestsByIds } from '@/features/offers/hooks';
import { useHeldForMe } from '@/features/payments/hooks';
import { useCities } from '@/features/places/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { t } from '@/i18n';
import { formatShortDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, fonts, spacing } from '@/theme';

/** Traveler balances: unlocked, still held by Razorpay, and everything earned. */
export default function EarningsScreen() {
  const payouts = useMyPayouts().data ?? [];
  const held = useHeldForMe().data ?? [];
  const requests = useRequestsByIds(payouts.map((p) => p.request_id)).data ?? [];
  const people = useProfilesByIds(requests.map((r) => r.requester_id)).data ?? [];
  const cities = useCities().data;
  const [showSoon, setShowSoon] = useState(false);

  // A captured payment stays 'captured' after release; released ones have a payout.
  const released = new Set(payouts.map((p) => p.payment_id));
  // The traveler gets item price + fare; the fee goes to Hopbag.
  const pending = held
    .filter((p) => !released.has(p.id))
    .reduce((sum, p) => sum + p.item_price_paise + p.fare_paise, 0);
  const available = payouts
    .filter((p) => p.status === 'ready')
    .reduce((s, p) => s + p.net_paise, 0);
  const lifetime = payouts.reduce((s, p) => s + p.net_paise, 0);
  const cityName = (id: number) => cities?.find((c) => c.id === id)?.name ?? '';
  const recent = [...payouts].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Screen>
      <ScreenHeader title={t('earnings.title')} />
      <Card tone="dark" style={styles.hero}>
        <Text variant="caption" style={styles.muted}>
          {t('earnings.available')}
        </Text>
        <Text style={styles.amount}>{formatPaise(available)}</Text>
        <View style={styles.row}>
          <Text variant="caption" style={[styles.muted, styles.flex]}>
            {t('earnings.pending', { amount: formatPaise(pending) })}
          </Text>
          <Text variant="caption" style={styles.muted}>
            {t('earnings.lifetime', { amount: formatPaise(lifetime) })}
          </Text>
        </View>
        <Button title={t('earnings.withdraw')} variant="accent" onPress={() => setShowSoon(true)} />
      </Card>
      {showSoon ? (
        <InfoBox tone="neutral" icon="info">
          {t('earnings.withdrawSoon')}
        </InfoBox>
      ) : null}

      <Text variant="heading">{t('earnings.recent')}</Text>
      {recent.length === 0 ? (
        <Text variant="body" muted>
          {t('earnings.empty')}
        </Text>
      ) : (
        <MenuGroup>
          {recent.map((p, i) => {
            const r = requests.find((x) => x.id === p.request_id);
            const who = firstName(people.find((x) => x.id === r?.requester_id)?.full_name);
            return (
              <View key={p.id} style={[styles.item, i < recent.length - 1 && styles.divider]}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">
                    {t('earnings.itemFor', { item: r?.item_name ?? '', name: who })}
                  </Text>
                  <Text variant="caption" muted>
                    {r
                      ? `${t('requests.route', { from: cityName(r.from_city_id), to: cityName(r.to_city_id) })} · ${formatShortDate(p.created_at.slice(0, 10))}`
                      : formatShortDate(p.created_at.slice(0, 10))}
                  </Text>
                </View>
                <Text style={styles.plus}>{`+ ${formatPaise(p.net_paise)}`}</Text>
              </View>
            );
          })}
        </MenuGroup>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, paddingVertical: spacing.lg },
  muted: { color: colors.textOnDarkMuted },
  amount: { fontFamily: fonts.heading, fontSize: 44, lineHeight: 52, color: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  flex: { flex: 1, gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.md,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  plus: { fontFamily: fonts.bold, fontSize: 17, color: colors.success },
});
