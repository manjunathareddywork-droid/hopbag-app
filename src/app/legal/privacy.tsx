import { LegalPage } from '@/components/legal-page';
import { t } from '@/i18n';

export default function PrivacyScreen() {
  return <LegalPage title={t('legal.privacyTitle')} body={t('legal.privacyBody')} />;
}
