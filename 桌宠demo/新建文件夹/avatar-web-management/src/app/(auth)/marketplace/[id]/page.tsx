'use client';

import { useState, useCallback } from 'react';
import { Card, Button, Tag, Rate, Input, Spin, App, Divider, Empty, List, Tabs } from 'antd';
import {
  DownloadOutlined, ShoppingCartOutlined, UserOutlined, SendOutlined,
  MessageOutlined, LikeOutlined, EyeOutlined, PlusOutlined,
} from '@ant-design/icons';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiGet, useApiPaginated } from '@/lib/use-api';
import { apiPost } from '@/lib/api-client';
import Live2DViewer from '@/components/live2d/Live2DViewer';

interface MarketItemDetail {
  id: string;
  seller_id: string;
  seller_username: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  files: string | string[];
  preview_images: string | string[];
  thumbnail_url?: string;
  avatar_id?: string;
  rating: number;
  download_count: number;
  applied_count: number;
  status: string;
  purchase_count: number;
  review_count: number;
  reviews: ReviewItem[];
  created_at: string;
  updated_at: string;
}

interface ReviewItem {
  id: string;
  user_id: string;
  username: string;
  rating: number;
  comment: string;
  pet_screenshot?: string;
  created_at: string;
}

interface RelatedItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  thumbnail_url?: string;
  rating: number;
  download_count: number;
  seller_username: string;
}

interface DiscussionPost {
  id: string;
  title: string;
  voteScore: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
  board: { name: string; slug: string };
  user: { username: string };
}

function parseImages(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch { /* */ }
  return [];
}

function parseFiles(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch { /* */ }
  return [];
}

export default function MarketplaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const t = useTranslations('marketplace');
  const td = useTranslations('marketplace.detail');
  const tc = useTranslations('marketplace.categories');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [applying, setApplying] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const CATEGORY_LABELS: Record<string, string> = {
    model: tc('model'),
    personality: tc('personality'),
    voice: tc('voice'),
    animation: tc('animation'),
    theme: tc('theme'),
  };

  function formatPrice(price: number, currency: string): string {
    if (price === 0) return t('free');
    if (currency === 'CNY') return `¥${price}`;
    return `$${(price / 100).toFixed(2)}`;
  }

  const { data, isLoading, mutate } = useApiGet<MarketItemDetail>(`/api/market/items/${id}`);
  const item: MarketItemDetail | null = data?.success ? (data.data as unknown as MarketItemDetail) : null;

  // Related items from same category
  const { data: relatedData } = useApiPaginated<RelatedItem>(
    item ? '/api/market/items' : null,
    item ? { category: item.category, pageSize: '4', sort: 'popular' } : undefined,
  );
  const relatedItems: RelatedItem[] = relatedData?.success
    ? (relatedData.data as unknown as { items: RelatedItem[] })?.items?.filter((r: RelatedItem) => r.id !== id) || []
    : [];

  const files = item ? parseFiles(item.files) : [];
  const modelFile = files.find((f: string) => f.endsWith('.model3.json'));
  const isModel = item?.category === 'model' && !!modelFile;

  // Discussion posts tagged with this item
  const itemTag = `item_${id}`;
  const { data: discData, mutate: discMutate } = useApiPaginated<DiscussionPost>(
    '/api/community/posts',
    { tag: itemTag, sort: 'latest', pageSize: '10' },
  );
  const discussions: DiscussionPost[] = discData?.success
    ? (discData.data as unknown as { items: DiscussionPost[] })?.items || []
    : [];
  const [discContent, setDiscContent] = useState('');
  const [discTitle, setDiscTitle] = useState('');
  const [submittingDisc, setSubmittingDisc] = useState(false);
  const [showDiscForm, setShowDiscForm] = useState(false);

  const handleCreateDiscussion = useCallback(async () => {
    if (!discTitle.trim() || !discContent.trim()) return;
    setSubmittingDisc(true);
    try {
      // Find the discussion board (slug: 'discussion')
      const boardsRes = await fetch('/api/community/boards');
      const boardsData = await boardsRes.json();
      const boards: { id: string; slug: string }[] = boardsData.success ? boardsData.data?.items || boardsData.data : [];
      const discBoard = Array.isArray(boards) ? boards.find((b: { slug: string }) => b.slug === 'discussion') : null;

      if (!discBoard) {
        message.error('Discussion board not found');
        return;
      }

      const res = await apiPost<{ id: string }>(`/api/community/boards/${discBoard.id}/posts`, {
        title: `[Market] ${discTitle.trim()}`,
        content: discContent.trim(),
        tags: JSON.stringify([itemTag]),
      });

      if (res.success) {
        message.success('Discussion created');
        setDiscTitle('');
        setDiscContent('');
        setShowDiscForm(false);
        discMutate();
      } else {
        message.error(res.error || 'Failed to create discussion');
      }
    } finally {
      setSubmittingDisc(false);
    }
  }, [discTitle, discContent, itemTag, discMutate, message]);

  const handleApply = async () => {
    if (!item) return;
    setApplying(true);
    try {
      const res = await apiPost<{ message: string }>(`/api/market/items/${item.id}/purchase`);
      if (res.success) {
        message.success(res.data?.message || td('appliedSuccess'));
        mutate();
      } else {
        message.error(res.error || td('operationFailed'));
      }
    } catch {
      message.error(td('networkError'));
    } finally {
      setApplying(false);
    }
  };

  const handleReview = async () => {
    if (!item) return;
    setSubmittingReview(true);
    try {
      const res = await apiPost(`/api/market/items/${item.id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
      });
      if (res.success) {
        message.success(td('reviewPublished'));
        setReviewComment('');
        setReviewRating(5);
        mutate();
      } else {
        message.error(res.error || td('reviewFailed'));
      }
    } catch {
      message.error(td('networkError'));
    } finally {
      setSubmittingReview(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!item) return <div className="text-center py-20 text-gray-500">{td('itemNotFound')}</div>;

  const images = parseImages(item.preview_images);
  const displayUrl = images.length > 0 ? images[activeImageIdx] : item.thumbnail_url;
  const hasPreview = !!displayUrl;

  return (
    <div className="max-w-5xl mx-auto">
      <Button type="text" onClick={() => router.back()} className="mb-4 text-gray-400 hover:text-white">
        {td('backToMarket')}
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <Card className="!border-purple-500/10">
          {isModel ? (
            <div>
              <div className="h-80 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg flex items-center justify-center overflow-hidden">
                <Live2DViewer
                  modelUrl={modelFile!}
                  width={320}
                  height={320}
                  interactive
                  onError={(err) => console.error('Live2D load error:', err)}
                />
              </div>
              <p className="text-gray-500 text-xs text-center mt-2">{td('dragTip')}</p>
            </div>
          ) : (
            <div className="h-80 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg flex items-center justify-center overflow-hidden relative">
              {hasPreview ? (
                <Image src={displayUrl} alt={item.title} fill className="object-contain p-4" unoptimized />
              ) : (
                <Image src="/images/placeholder-template.svg" alt={item.title} fill className="object-contain p-12 opacity-40" unoptimized />
              )}
            </div>
          )}
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIdx(i)}
                  className={`w-16 h-16 rounded flex-shrink-0 overflow-hidden relative border-2 transition-colors ${
                    i === activeImageIdx ? 'border-purple-500' : 'border-transparent hover:border-purple-500/40'
                  }`}
                >
                  <Image src={img} alt={td('previewAlt', { n: i + 1 })} fill className="object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-bold text-white">{item.title}</h1>
            <span className={`text-lg font-bold ${item.price === 0 ? 'text-green-400' : 'text-purple-400'}`}>
              {formatPrice(item.price, item.currency)}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Tag color="purple">{CATEGORY_LABELS[item.category] || item.category}</Tag>
            <Rate disabled value={Math.round(item.rating)} count={5} style={{ fontSize: 14 }} />
            <span className="text-gray-400 text-sm">({item.rating.toFixed(1)})</span>
          </div>

          <div className="flex items-center gap-2 mb-4 text-gray-400 text-sm">
            <UserOutlined />
            <span
              className="text-purple-400 cursor-pointer hover:text-purple-300 hover:underline"
              onClick={() => router.push(`/marketplace/seller/${item.seller_id}`)}
            >
              {item.seller_username}
            </span>
            <Divider type="vertical" />
            <DownloadOutlined />
            <span>{td('downloadsCount', { count: item.download_count })}</span>
            <Divider type="vertical" />
            <span>{td('purchasesCount', { count: item.purchase_count })}</span>
          </div>

          <p className="text-gray-300 text-sm mb-6 leading-relaxed">
            {item.description || td('noDescription')}
          </p>

          <Button
            type="primary"
            size="large"
            block
            icon={item.price === 0 ? <DownloadOutlined /> : <ShoppingCartOutlined />}
            onClick={handleApply}
            loading={applying}
            className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 h-12 text-lg font-bold"
          >
            {item.price === 0 ? td('freeApply') : td('buyApply')}
          </Button>
        </div>
      </div>

      {/* Related Items */}
      {relatedItems.length > 0 && (
        <Card title={td('relatedTitle')} className="!border-purple-500/10 mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {relatedItems.map((r) => (
              <Card
                key={r.id}
                hoverable
                size="small"
                className="!border-purple-500/10 hover:!border-purple-500/30 transition-all cursor-pointer !p-0"
                onClick={() => router.push(`/marketplace/${r.id}`)}
                cover={
                  <div className="h-24 bg-gradient-to-br from-purple-900/30 to-blue-900/30 flex items-center justify-center overflow-hidden relative">
                    {r.thumbnail_url ? (
                      <Image src={r.thumbnail_url} alt={r.title} fill className="object-cover" unoptimized />
                    ) : (
                      <Image src="/images/placeholder-template.svg" alt={r.title} fill className="object-contain p-4 opacity-40" unoptimized />
                    )}
                  </div>
                }
              >
                <div className="text-white text-xs truncate">{r.title}</div>
                <div className="flex items-center justify-between text-gray-500 text-xs mt-0.5">
                  <span className={r.price === 0 ? 'text-green-400' : ''}>{formatPrice(r.price, r.currency)}</span>
                  <span><DownloadOutlined className="text-xs mr-0.5" />{r.download_count}</span>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Discussions */}
      <Card
        title={
          <span><MessageOutlined className="mr-2" />Discussions ({discussions.length})</span>
        }
        extra={
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusOutlined />}
            onClick={() => setShowDiscForm(!showDiscForm)}
          >
            New Discussion
          </Button>
        }
        className="!border-purple-500/10 mt-6"
      >
        {showDiscForm && (
          <div className="mb-4 p-4 rounded-lg bg-purple-500/5 border border-purple-500/10">
            <Input
              placeholder="Discussion title"
              value={discTitle}
              onChange={(e) => setDiscTitle(e.target.value)}
              className="mb-2"
            />
            <Input.TextArea
              placeholder="Write your discussion..."
              value={discContent}
              onChange={(e) => setDiscContent(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button size="small" onClick={() => setShowDiscForm(false)}>Cancel</Button>
              <Button
                size="small"
                type="primary"
                loading={submittingDisc}
                onClick={handleCreateDiscussion}
              >
                Post
              </Button>
            </div>
          </div>
        )}
        {discussions.length > 0 ? (
          <List
            size="small"
            dataSource={discussions}
            renderItem={(post: DiscussionPost) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/community/${post.board.slug}/${post.id}`)}
              >
                <div className="w-full">
                  <span className="text-white text-sm">{post.title}</span>
                  <div className="flex gap-3 text-gray-500 text-xs mt-1">
                    <span>{post.user.username}</span>
                    <span><LikeOutlined /> {post.voteScore}</span>
                    <span><MessageOutlined /> {post.replyCount}</span>
                    <span><EyeOutlined /> {post.viewCount}</span>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty
            description="No discussions yet. Start the first one!"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* Reviews */}
      <Card title={td('reviews', { count: item.review_count })} className="!border-purple-500/10 mt-6">
        {Array.isArray(item.reviews) && item.reviews.length > 0 ? (
          <List
            dataSource={item.reviews}
            renderItem={(r: ReviewItem) => (
              <List.Item>
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium">{r.username}</span>
                    <Rate disabled value={r.rating} count={5} style={{ fontSize: 12 }} />
                  </div>
                  {r.comment && <p className="text-gray-300 text-sm">{r.comment}</p>}
                  {r.pet_screenshot && (
                    <div className="mt-2 w-24 h-24 rounded overflow-hidden relative">
                      <Image src={r.pet_screenshot} alt={td('petScreenshotAlt')} fill className="object-cover" unoptimized />
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description={td('noReviews')} />
        )}

        <Divider />
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Rate value={reviewRating} onChange={setReviewRating} />
            <Input.TextArea
              placeholder={td('reviewPlaceholder')}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={2}
              className="mt-2"
            />
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleReview}
            loading={submittingReview}
          >
            {td('submitReview')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
