// /preview/pet — 桌宠 Web 预览页面
import { getTranslations } from 'next-intl/server';
import PetPreview from '@/components/pet/preview/PetPreview';

export const dynamic = 'force-dynamic';

export default async function PetPreviewPage() {
  const t = await getTranslations('pet');

  return <PetPreview />;
}
