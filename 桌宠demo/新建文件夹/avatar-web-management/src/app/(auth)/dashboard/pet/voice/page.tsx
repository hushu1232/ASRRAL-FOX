// /dashboard/pet/voice — 自定义音色训练页面
import { getTranslations } from 'next-intl/server';
import VoiceCloningWizard from '@/components/pet/VoiceCloningWizard';

export const dynamic = 'force-dynamic';

export default async function VoiceCloningPage() {
  const t = await getTranslations('pet');

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px' }}>
      <VoiceCloningWizard />
    </div>
  );
}
