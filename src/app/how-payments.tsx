import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { t } from '@/i18n';

export default function HowPaymentsScreen() {
  return (
    <Screen>
      <ScreenHeader title={t('howPayments.title')} />
      <Card>
        <Text variant="body">{t('howPayments.body')}</Text>
      </Card>
    </Screen>
  );
}
