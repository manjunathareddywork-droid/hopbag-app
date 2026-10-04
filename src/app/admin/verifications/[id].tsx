import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { AdminOnly } from '@/features/admin/admin-only';
import { useReviewVerification, useVerification } from '@/features/admin/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { ReviewPanel } from '@/features/admin/review-panel';
import { useSession } from '@/features/auth/session';
import { useDocumentUrl } from '@/features/travelers/hooks';
import { t, type StringKey } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDate } from '@/lib/dates';
import { colors, radius } from '@/theme';

function ReviewVerificationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const verification = useVerification(id);
  const people = useProfilesByIds(verification.data ? [verification.data.user_id] : []);
  const photo = useDocumentUrl(verification.data?.id_photo_path);
  const review = useReviewVerification();

  if (verification.data === null) return <LoadingView error={t('errors.notFound')} />;
  if (!verification.data) {
    return (
      <LoadingView
        error={verification.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => verification.refetch()}
      />
    );
  }

  const v = verification.data;
  const person = people.data?.[0];

  return (
    <Screen>
      {photo.data ? (
        <Image
          source={{ uri: photo.data }}
          style={styles.photo}
          contentFit="contain"
          accessibilityLabel={t('verifyId.photoLabel')}
        />
      ) : null}

      <View style={styles.card}>
        <DetailRow label={t('admin.person')} value={person?.full_name ?? ''} />
        <DetailRow label={t('admin.idType')} value={t(`idTypes.${v.id_type}` as StringKey)} />
        <DetailRow
          label={t('requests.fields.status')}
          value={t(`reviewStatus.${v.status}` as StringKey)}
        />
        <DetailRow
          label={t('admin.submitted', { date: '' }).trim()}
          value={formatDate(v.created_at.slice(0, 10))}
        />
      </View>

      {v.user_id === session?.user.id ? (
        <Text variant="caption" muted>
          {t('admin.ownSubmission')}
        </Text>
      ) : null}

      {v.status === 'pending' ? (
        <ReviewPanel
          saving={review.isPending}
          error={review.error ? dbErrorMessage(review.error, 'admin.reviewFailed') : undefined}
          onApprove={() =>
            review.mutate({ id: v.id, approve: true }, { onSuccess: () => router.back() })
          }
          onReject={(reason) =>
            review.mutate({ id: v.id, approve: false, reason }, { onSuccess: () => router.back() })
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

export default function ReviewVerificationScreenRoute() {
  return (
    <AdminOnly>
      <ReviewVerificationScreen />
    </AdminOnly>
  );
}
