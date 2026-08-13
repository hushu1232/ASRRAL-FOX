// /dashboard/pet/voice — 自定义音色训练页面
import VoiceCloningWizard from '@/components/pet/VoiceCloningWizard';

export const dynamic = 'force-dynamic';

export default function VoiceCloningPage() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px' }}>
      <VoiceCloningWizard />
    </div>
  );
}
