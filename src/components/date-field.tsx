import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { formatDate, formatShortDate, isoToLocalDate, localDateToIso } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

import { Button } from './button';
import { Text } from './text';

type Props = {
  label: string;
  placeholder: string;
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (isoDate: string) => void;
  minDate: string;
  maxDate: string;
  error?: string;
  /** "14 Oct" instead of "14 Oct 2026" (dates within the next weeks). */
  short?: boolean;
};

/** Native calendar: a dialog on Android, a sheet with an inline calendar on iOS. */
export function DateField({
  label,
  placeholder,
  value,
  onChange,
  minDate,
  maxDate,
  error,
  short,
}: Props) {
  const shown = value ? (short ? formatShortDate(value) : formatDate(value)) : placeholder;
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(isoToLocalDate(value || minDate));

  const pickerProps = {
    mode: 'date' as const,
    minimumDate: isoToLocalDate(minDate),
    maximumDate: isoToLocalDate(maxDate),
  };

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        ...pickerProps,
        value: isoToLocalDate(value || minDate),
        // Only fires when a date is picked; dismissing the dialog changes nothing.
        onValueChange: (_event, date) => onChange(localDateToIso(date)),
      });
    } else {
      setIosDraft(isoToLocalDate(value || minDate));
      setIosOpen(true);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text variant="label">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: shown }}
        onPress={openPicker}
        style={[styles.box, error ? styles.boxError : null]}
      >
        <Text variant="body" muted={!value} numberOfLines={1}>
          {shown}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <SafeAreaView style={styles.modal}>
            <Text variant="heading" style={styles.modalTitle}>
              {label}
            </Text>
            <DateTimePicker
              {...pickerProps}
              display="inline"
              value={iosDraft}
              onValueChange={(_event, date) => setIosDraft(date)}
            />
            <View style={styles.footer}>
              <Button
                title={t('common.done')}
                onPress={() => {
                  onChange(localDateToIso(iosDraft));
                  setIosOpen(false);
                }}
              />
              <Button
                title={t('common.cancel')}
                variant="secondary"
                onPress={() => setIosOpen(false)}
              />
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  box: {
    minHeight: 58,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md + 2,
  },
  boxError: {
    borderColor: colors.danger,
    borderWidth: 2,
  },
  error: {
    color: colors.danger,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  modalTitle: {
    paddingVertical: spacing.lg,
  },
  footer: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
});
