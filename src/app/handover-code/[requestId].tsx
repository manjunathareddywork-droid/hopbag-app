import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useIssueHandoverCode } from '@/features/delivery/hooks';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { colors, fonts, radius, spacing } from '@/theme';

/** Big, readable code for the requester to show the traveler at handover. */
export default function HandoverCodeScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const issue = useIssueHandoverCode();
  const { mutate } = issue;

  useEffect(() => {
    mutate(requestId);
  }, [mutate, requestId]);

  return (
    <Screen>
      <Text variant="body">{t('delivery.codeHelp')}</Text>
      <View style={styles.codeBox} accessibilityLabel={issue.data?.split('').join(' ')}>
        {issue.isPending ? (
          <ActivityIndicator size="large" color={colors.textOnDark} />
        ) : (
          <Text style={styles.code}>
            {issue.data ? `${issue.data.slice(0, 3)} ${issue.data.slice(3)}` : '— — —'}
          </Text>
        )}
      </View>
      {issue.error ? (
        <Text variant="body" style={styles.error}>
          {dbErrorMessage(issue.error, 'delivery.actionFailed')}
        </Text>
      ) : null}
      <Text variant="caption" muted>
        {t('delivery.codeOneTime')}
      </Text>
      <Button
        title={t('delivery.codeNew')}
        variant="secondary"
        loading={issue.isPending}
        onPress={() => mutate(requestId)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    backgroundColor: colors.teal,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  code: {
    fontFamily: fonts.bold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 6,
    color: colors.textOnDark,
  },
  error: {
    color: colors.danger,
  },
});
