import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { colors, fonts, radius, spacing } from '@/theme';

import { Button } from './button';
import { Text } from './text';

export type SelectItem = {
  value: string;
  label: string;
  description?: string;
  /** Extra words that should match a search, e.g. old city names. */
  keywords?: string[];
};

type Props = {
  label: string;
  placeholder: string;
  items: SelectItem[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  /** Show a search box (use for long lists such as cities). */
  searchPlaceholder?: string;
};

/** Tap to open a full-screen list; easier on small screens than a dropdown. */
export function SelectField({
  label,
  placeholder,
  items,
  value,
  onChange,
  error,
  hint,
  searchPlaceholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = items.find((item) => item.value === value);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.label, ...(item.keywords ?? [])].some((text) => text.toLowerCase().includes(q)),
    );
  }, [items, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.wrapper}>
      <Text variant="label">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        onPress={() => setOpen(true)}
        style={[styles.box, error ? styles.boxError : null]}
      >
        <Text variant="body" muted={!selected}>
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>
      {hint && !error ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modal}>
          <Text variant="heading" style={styles.modalTitle}>
            {label}
          </Text>
          {searchPlaceholder ? (
            <TextInput
              accessibilityLabel={t('common.search')}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              style={styles.search}
            />
          ) : null}
          <FlatList
            data={visible}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text variant="body" muted style={styles.empty}>
                {t('common.noResults')}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === value }}
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
                style={[styles.row, item.value === value && styles.rowSelected]}
              >
                <Text variant="body">{item.label}</Text>
                {item.description ? (
                  <Text variant="caption" muted>
                    {item.description}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
          <View style={styles.footer}>
            <Button title={t('common.close')} variant="secondary" onPress={close} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  box: {
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  boxError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalTitle: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
  },
  empty: {
    padding: spacing.lg,
  },
  row: {
    minHeight: 52,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  footer: {
    padding: spacing.lg,
  },
});
