import { LegalPage } from '@/components/legal-page';
import { t } from '@/i18n';

export default function TermsScreen() {
  return <LegalPage title={t('legal.termsTitle')} body={t('legal.termsBody')} />;
}
