import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { State } from '@/lib/database.types';
import { colors, radius, spacing } from '@/theme';

import { Button } from './button';
import { Text } from './text';

type Props = {
  label: string;
  placeholder: string;
  closeLabel: string;
  states: State[];
  value: string;
  onChange: (code: string) => void;
  error?: string;
};

/** Tap to open a full-screen list; easier on small screens than a dropdown. */
export function StatePicker({
  label,
  placeholder,
  closeLabel,
  states,
  value,
  onChange,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = states.find((s) => s.code === value);

  return (
    <View style={styles.wrapper}>
      <Text variant="label">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.name ?? placeholder }}
        onPress={() => setOpen(true)}
        style={[styles.box, error ? styles.boxError : null]}
      >
        <Text variant="body" muted={!selected}>
          {selected?.name ?? placeholder}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <Text variant="heading" style={styles.modalTitle}>
            {label}
          </Text>
          <FlatList
            data={states}
            keyExtractor={(s) => s.code}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.code === value }}
                onPress={() => {
                  onChange(item.code);
                  setOpen(false);
                }}
                style={[styles.row, item.code === value && styles.rowSelected]}
              >
                <Text variant="body">{item.name}</Text>
              </Pressable>
            )}
          />
          <View style={styles.footer}>
            <Button title={closeLabel} variant="secondary" onPress={() => setOpen(false)} />
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
  },
  row: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
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
