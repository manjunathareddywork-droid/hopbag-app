import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Button } from './button';
import { Text } from './text';

type Props = {
  error?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

/** Full-screen spinner, or an error message with a retry button. */
export function LoadingView({ error, retryLabel, onRetry }: Props) {
  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text variant="body" style={styles.text}>
            {error}
          </Text>
          {onRetry && retryLabel ? <Button title={retryLabel} onPress={onRetry} /> : null}
        </>
      ) : (
        <ActivityIndicator size="large" color={colors.teal} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  text: {
    textAlign: 'center',
  },
});
