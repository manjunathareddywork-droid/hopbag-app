import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LoadingView } from '@/components/loading-view';
import { Text } from '@/components/text';
import { useSession } from '@/features/auth/session';
import { useChat, useSendMessage } from '@/features/chat/hooks';
import { chatOpen, containsPhoneNumber, phoneSharingAllowed } from '@/features/chat/phone';
import { useProfilesByIds } from '@/features/profile/hooks';
import { useRequest } from '@/features/requests/hooks';
import { t } from '@/i18n';
import type { Message } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDateTime } from '@/lib/dates';
import { track } from '@/lib/monitoring';
import { colors, fonts, radius, spacing } from '@/theme';

export default function ChatScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { session } = useSession();
  const me = session?.user.id;
  const request = useRequest(requestId);
  const chat = useChat(requestId);
  const send = useSendMessage(requestId);
  const people = useProfilesByIds((chat.data ?? []).map((m) => m.sender_id));
  const [draft, setDraft] = useState('');
  const [blocked, setBlocked] = useState<string>();
  const list = useRef<FlatList<Message>>(null);

  useEffect(() => {
    track('chat_opened');
  }, []);

  if (!request.data || !chat.data) {
    return (
      <LoadingView
        error={request.isError || chat.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          request.refetch();
          chat.refetch();
        }}
      />
    );
  }

  const status = request.data.status;
  const open = chatOpen(status);
  const nameOf = (id: string) =>
    id === me
      ? t('chat.you')
      : (people.data?.find((p) => p.id === id)?.full_name.split(' ')[0] ?? '');

  function submit() {
    const body = draft.trim();
    if (!body) return;
    if (!phoneSharingAllowed(status) && containsPhoneNumber(body)) {
      setBlocked(t('chat.phoneBlocked'));
      return;
    }
    setBlocked(undefined);
    send.mutate(body, { onSuccess: () => setDraft('') });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={list}
          data={chat.data}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text variant="body" muted style={styles.empty}>
              {t('chat.empty')}
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text variant="caption" style={mine ? styles.metaMine : styles.meta}>
                  {`${nameOf(item.sender_id)} · ${formatDateTime(item.created_at)}`}
                </Text>
                <Text variant="body" style={mine ? styles.textMine : undefined}>
                  {item.body}
                </Text>
              </View>
            );
          }}
        />

        {open ? (
          <View style={styles.composer}>
            {blocked || send.error ? (
              <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
                {blocked ?? dbErrorMessage(send.error, 'chat.sendFailed')}
              </Text>
            ) : null}
            <View style={styles.row}>
              <TextInput
                accessibilityLabel={t('chat.placeholder')}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={colors.textMuted}
                value={draft}
                onChangeText={(v) => {
                  setDraft(v);
                  if (blocked) setBlocked(undefined);
                }}
                maxLength={1000}
                multiline
                style={styles.input}
              />
              <View style={styles.sendButton}>
                <Button title={t('chat.send')} loading={send.isPending} onPress={submit} />
              </View>
            </View>
          </View>
        ) : (
          <Text variant="caption" muted style={styles.closed}>
            {t('chat.closed')}
          </Text>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.teal,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: {
    color: colors.textMuted,
  },
  metaMine: {
    color: colors.textOnDark,
    opacity: 0.8,
  },
  textMine: {
    color: colors.textOnDark,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sendButton: {
    width: 96,
  },
  error: {
    color: colors.danger,
  },
  closed: {
    textAlign: 'center',
    padding: spacing.md,
  },
});
