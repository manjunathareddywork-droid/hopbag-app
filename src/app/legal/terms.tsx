import { LegalPage } from '@/components/legal-page';
import { t } from '@/i18n';

export default function TermsScreen() {
  return <LegalPage body={t('legal.termsBody')} />;
}
