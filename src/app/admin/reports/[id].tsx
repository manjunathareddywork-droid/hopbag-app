import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { AdminOnly } from '@/features/admin/admin-only';
import { useProfilesByIds } from '@/features/profile/hooks';
import {
  useReportDetail,
  useReviewReport,
  useSetSuspension,
  useSuspension,
} from '@/features/safety/hooks';
import { t, type StringKey } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDateTime } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

function AdminReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const report = useReportDetail(id);
  const people = useProfilesByIds(
    report.data ? [report.data.reporter_id, report.data.reported_user_id] : [],
  );
  const suspensionRow = useSuspension(report.data?.reported_user_id).data;
  const review = useReviewReport();
  const suspension = useSetSuspension();
  const [note, setNote] = useState('');

  if (!report.data) {
    return (
      <LoadingView
        error={report.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => report.refetch()}
      />
    );
  }

  const r = report.data;
  const reporter = people.data?.find((p) => p.id === r.reporter_id);
  const reported = people.data?.find((p) => p.id === r.reported_user_id);
  const reportedName = reported?.full_name ?? '';
  const error = review.error ?? suspension.error;

  function closeAndSuspend() {
    Alert.alert(t('adminDashboard.suspendConfirm', { name: reportedName }), undefined, [
      { text: t('offers.back'), style: 'cancel' },
      {
        text: t('adminDashboard.suspend', { name: reportedName }),
        style: 'destructive',
        onPress: () =>
          review.mutate({ id: r.id, note: note.trim(), suspend: true }, { onSuccess: router.back }),
      },
    ]);
  }

  return (
    <Screen>
      <View style={styles.card}>
        <DetailRow
          label={t('safety.categoryLabel')}
          value={t(`safety.categories.${r.category}` as StringKey)}
        />
        <DetailRow
          label={t('adminDashboard.reportFrom', { reporter: '', reported: '' }).trim()}
          value={`${reporter?.full_name ?? ''} → ${reportedName}`}
        />
        {r.details ? <DetailRow label={t('safety.detailsLabel')} value={r.details} /> : null}
        <DetailRow
          label={t('admin.submitted', { date: '' }).trim()}
          value={formatDateTime(r.created_at)}
        />
        {suspensionRow ? (
          <DetailRow label={t('adminDashboard.suspended')} value={suspensionRow.reason ?? ''} />
        ) : null}
      </View>

      {r.status === 'open' ? (
        <View style={styles.actions}>
          <TextField
            label={t('adminDashboard.reviewNote')}
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            multiline
          />
          {error ? (
            <Text variant="body" style={styles.error}>
              {dbErrorMessage(error, 'adminDashboard.reviewFailed')}
            </Text>
          ) : null}
          <Button
            title={t('adminDashboard.closeReport')}
            loading={review.isPending}
            onPress={() =>
              review.mutate(
                { id: r.id, note: note.trim(), suspend: false },
                { onSuccess: router.back },
              )
            }
          />
          <Button
            title={t('adminDashboard.suspend', { name: reportedName })}
            variant="secondary"
            disabled={review.isPending}
            onPress={closeAndSuspend}
          />
        </View>
      ) : null}

      {suspensionRow ? (
        <Button
          title={t('adminDashboard.unsuspend', { name: reportedName })}
          variant="secondary"
          loading={suspension.isPending}
          onPress={() => suspension.mutate({ userId: r.reported_user_id, suspended: false })}
        />
      ) : null}
    </Screen>
  );
}

export default function AdminReportRoute() {
  return (
    <AdminOnly>
      <AdminReport />
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
