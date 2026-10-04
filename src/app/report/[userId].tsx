import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SelectField } from '@/components/select-field';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useProfilesByIds } from '@/features/profile/hooks';
import { useBlock, useMyBlocks, useReport, useUnblock } from '@/features/safety/hooks';
import { t, type StringKey } from '@/i18n';
import type { ReportCategory } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { colors, radius, spacing } from '@/theme';

const CATEGORIES: ReportCategory[] = ['fraud', 'abuse', 'no_show', 'prohibited_item', 'other'];

export default function ReportOrBlockScreen() {
  const { userId, requestId } = useLocalSearchParams<{ userId: string; requestId?: string }>();
  const router = useRouter();
  const person = useProfilesByIds([userId]).data?.[0];
  const blocks = useMyBlocks();
  const report = useReport();
  const block = useBlock();
  const unblock = useUnblock();
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string>();
  const name = person?.full_name.split(' ')[0] ?? '';
  const isBlocked = (blocks.data ?? []).includes(userId);

  function sendReport() {
    if (!category) return setError(t('safety.categoryRequired'));
    setError(undefined);
    report.mutate(
      {
        reportedUserId: userId,
        requestId: requestId ?? null,
        category: category as ReportCategory,
        details: details.trim(),
      },
      {
        onSuccess: () =>
          Alert.alert(t('safety.reportSent'), undefined, [{ text: 'OK', onPress: router.back }]),
      },
    );
  }

  function confirmBlock() {
    Alert.alert(t('safety.blockConfirm', { name }), undefined, [
      { text: t('offers.back'), style: 'cancel' },
      { text: t('safety.blockYes'), style: 'destructive', onPress: () => block.mutate(userId) },
    ]);
  }

  return (
    <Screen>
      <Text variant="title">{t('safety.aboutPerson', { name: person?.full_name ?? '' })}</Text>

      <View style={styles.box}>
        <Text variant="heading">{t('safety.reportTitle')}</Text>
        <SelectField
          label={t('safety.categoryLabel')}
          placeholder={t('safety.categoryPlaceholder')}
          items={CATEGORIES.map((c) => ({
            value: c,
            label: t(`safety.categories.${c}` as StringKey),
          }))}
          value={category}
          onChange={setCategory}
          error={error}
        />
        <TextField
          label={`${t('safety.detailsLabel')} ${t('common.optional')}`}
          placeholder={t('safety.detailsPlaceholder')}
          value={details}
          onChangeText={setDetails}
          maxLength={1000}
          multiline
        />
        {report.error ? (
          <Text variant="body" style={styles.error}>
            {dbErrorMessage(report.error, 'safety.reportFailed')}
          </Text>
        ) : null}
        <Button title={t('safety.sendReport')} loading={report.isPending} onPress={sendReport} />
      </View>

      <View style={styles.box}>
        <Text variant="heading">{t('safety.blockTitle')}</Text>
        <Text variant="body" muted>
          {t('safety.blockHelp')}
        </Text>
        {isBlocked ? (
          <Button
            title={t('safety.unblock')}
            variant="secondary"
            loading={unblock.isPending}
            onPress={() => unblock.mutate(userId)}
          />
        ) : (
          <Button
            title={t('safety.block')}
            variant="secondary"
            loading={block.isPending}
            onPress={confirmBlock}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
