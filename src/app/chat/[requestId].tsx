import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { LoadingView } from '@/components/loading-view';
import { BackButton } from '@/components/screen-header';
import { Text } from '@/components/text';
import { useSession } from '@/features/auth/session';
import { useChat, useChatPhotoUrl, useSendMessage } from '@/features/chat/hooks';
import { chatOpen, containsPhoneNumber, phoneSharingAllowed } from '@/features/chat/phone';
import { useMarkChatRead } from '@/features/notifications/hooks';
import { useOffersForRequest } from '@/features/offers/hooks';
import { usePaymentForRequest } from '@/features/payments/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { useRequest } from '@/features/requests/hooks';
import { t } from '@/i18n';
import type { Message } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDay } from '@/lib/dates';
import { pickImage } from '@/lib/images';
import { formatPaise } from '@/lib/money';
import { track } from '@/lib/monitoring';
import { colors, fonts, radius, spacing } from '@/theme';

/** Local "YYYY-MM-DD" of a timestamp, for the day separators. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ChatScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const me = useSession().session?.user.id;
  const request = useRequest(requestId);
  const chat = useChat(requestId);
  const send = useSendMessage(requestId);
  const payment = usePaymentForRequest(requestId).data;
  const offer = useOffersForRequest(requestId).data?.find(
    (o) => o.id === request.data?.accepted_offer_id,
  );
  const otherId =
    request.data && request.data.requester_id === me
      ? offer?.traveler_id
      : request.data?.requester_id;
  const other = useProfilesByIds(otherId ? [otherId] : []).data?.[0];
  const markRead = useMarkChatRead();
  const [draft, setDraft] = useState('');
  const [blocked, setBlocked] = useState<string>();
  const list = useRef<FlatList<Message>>(null);

  const { mutate: read } = markRead;
  const count = chat.data?.length ?? 0;
  useEffect(() => {
    track('chat_opened');
  }, []);
  useEffect(() => {
    read(requestId);
  }, [read, requestId, count]);

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

  async function sendPhoto() {
    const uri = await pickImage();
    if (!uri) return;
    const body = draft.trim();
    if (body && !phoneSharingAllowed(status) && containsPhoneNumber(body)) {
      setBlocked(t('chat.phoneBlocked'));
      return;
    }
    send.mutate({ body, photoUri: uri }, { onSuccess: () => setDraft('') });
  }

  const subtitle = payment
    ? t('messages.heldLine', {
        item: request.data.item_name,
        amount: formatPaise(payment.amount_paise),
      })
    : request.data.item_name;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton />
        <Avatar name={other?.full_name} size={44} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {other?.full_name ?? ''}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          ListFooterComponent={
            open ? (
              <View style={styles.keep}>
                <Text variant="caption" style={styles.keepText}>
                  {t('messages.keep')}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const prev = chat.data?.[index - 1];
            const newDay = !prev || dayOf(prev.created_at) !== dayOf(item.created_at);
            return (
              <>
                {newDay ? (
                  <View style={styles.day}>
                    <Text variant="caption" muted>
                      {formatDay(dayOf(item.created_at))}
                    </Text>
                  </View>
                ) : null}
                <Bubble message={item} mine={item.sender_id === me} />
              </>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('messages.addPhoto')}
                onPress={sendPhoto}
                hitSlop={8}
                style={styles.photoButton}
              >
                <Icon name="camera" size={22} />
              </Pressable>
              <TextInput
                accessibilityLabel={t('messages.write')}
                placeholder={t('messages.write')}
                placeholderTextColor={colors.textSubtle}
                value={draft}
                onChangeText={(v) => {
                  setDraft(v);
                  if (blocked) setBlocked(undefined);
                }}
                maxLength={1000}
                multiline
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                disabled={send.isPending}
                onPress={submit}
                style={({ pressed }) => [styles.send, (pressed || send.isPending) && styles.dim]}
              >
                <Icon name="send" size={22} color={colors.teal} />
              </Pressable>
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

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const photo = useChatPhotoUrl(message.photo_deleted_at ? null : message.photo_path).data;
  return (
    <View
      style={[
        styles.bubble,
        mine ? styles.mine : styles.theirs,
        message.photo_path && styles.photoBubble,
      ]}
    >
      {message.photo_path ? (
        photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.photo}
            contentFit="cover"
            accessibilityLabel={t('messages.photo')}
          />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Icon name="camera" size={28} />
          </View>
        )
      ) : null}
      {message.body ? (
        <Text variant="body" style={mine ? styles.textMine : undefined}>
          {message.body}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  list: { padding: spacing.md, gap: spacing.sm + 2, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { textAlign: 'center', paddingVertical: spacing.xl },
  day: {
    alignSelf: 'center',
    backgroundColor: colors.greyTint,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: 4,
    marginVertical: spacing.sm,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.md + 2,
    padding: spacing.md - 2,
    gap: spacing.sm,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.teal },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoBubble: { padding: spacing.sm },
  photo: { width: 230, height: 150, borderRadius: radius.md },
  photoEmpty: { backgroundColor: colors.tealTint, alignItems: 'center', justifyContent: 'center' },
  textMine: { color: colors.white },
  keep: {
    alignSelf: 'center',
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  keepText: { color: colors.peachText, textAlign: 'center' },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm + 2,
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  photoButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md + 2,
    paddingTop: 14,
    paddingBottom: 14,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  send: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.6 },
  error: { color: colors.danger },
  closed: { textAlign: 'center', padding: spacing.md },
});
