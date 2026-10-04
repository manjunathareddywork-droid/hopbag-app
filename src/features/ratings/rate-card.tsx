import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { colors, fonts, radius, spacing } from '@/theme';

import { useMyRating, useRate } from './hooks';

type Props = {
  requestId: string;
  /** "Rate the traveler" / "Rate the requester" */
  title: string;
};

/** After a completed delivery: 1-5 stars and an optional comment, once. */
export function RateCard({ requestId, title }: Props) {
  const mine = useMyRating(requestId);
  const rate = useRate();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  if (mine.isPending) return null;
  if (mine.data) {
    return (
      <View style={styles.box}>
        <Text variant="body">{t('ratings.youRated', { stars: mine.data.stars })}</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text variant="heading">{title}</Text>
      <View style={styles.stars} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={t('ratings.starsLabel', { stars: n })}
            accessibilityState={{ selected: stars === n }}
            onPress={() => setStars(n)}
            hitSlop={8}
          >
            <Text style={[styles.star, n <= stars ? styles.starOn : styles.starOff]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextField
        label={`${t('ratings.commentLabel')} ${t('common.optional')}`}
        value={comment}
        onChangeText={setComment}
        maxLength={500}
        multiline
      />
      {rate.error ? (
        <Text variant="body" style={styles.error}>
          {dbErrorMessage(rate.error, 'ratings.failed')}
        </Text>
      ) : null}
      <Button
        title={t('ratings.submit')}
        disabled={stars === 0}
        loading={rate.isPending}
        onPress={() => rate.mutate({ requestId, stars, comment: comment.trim() })}
      />
    </View>
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
  stars: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  star: {
    fontFamily: fonts.bold,
    fontSize: 36,
    lineHeight: 42,
  },
  // Orange stars are shapes, not text to read (brand rule allows accents).
  starOn: {
    color: colors.orange,
  },
  starOff: {
    color: colors.border,
  },
  error: {
    color: colors.danger,
  },
});
