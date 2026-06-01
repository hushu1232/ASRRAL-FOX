'use client';

import { useState, useCallback } from 'react';
import { Card, Button, Tag, Spin, Empty, Pagination, Segmented, App } from 'antd';
import {
  PlusOutlined, PushpinOutlined, EyeOutlined, MessageOutlined,
  LikeOutlined, BellOutlined, BellFilled,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiGet, useApiPaginated } from '@/lib/use-api';
import { apiPost } from '@/lib/api-client';

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  postCount: number;
}

interface PostItem {
  id: string;
  title: string;
  type: string;
  isPinned: boolean;
  isLocked: boolean;
  voteScore: number;
  replyCount: number;
  viewCount: number;
  tags: string;
  createdAt: string;
  user: { id: string; username: string; role: string };
}

export default function BoardPage() {
  const t = useTranslations('community');
  const { boardSlug } = useParams<{ boardSlug: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const [sort, setSort] = useState<string>('latest');
  const [page, setPage] = useState(1);
  const [subscribed, setSubscribed] = useState(false);

  const { data: boardRes, isLoading: boardLoading } = useApiGet<Board>(
    `/api/community/boards/slug/${boardSlug}`,
  );

  const { data: postsRes, isLoading: postsLoading, mutate } = useApiPaginated<PostItem>(
    boardRes?.success ? `/api/community/boards/${boardRes.data.id}/posts` : null,
    { sort, page: String(page), pageSize: '20' },
  );

  const board = boardRes?.success ? boardRes.data : null;
  const posts = postsRes?.success ? postsRes.data : null;

  const handleSubscribe = useCallback(async () => {
    if (!board) return;
    const res = await apiPost<{ subscribed: boolean }>('/api/community/subscriptions', {
      targetType: 'board',
      targetId: board.id,
    });
    if (res.success) {
      setSubscribed(res.data!.subscribed);
      message.success(res.data!.subscribed ? t('board.subscribed') : t('board.unsubscribed'));
    }
  }, [board, message, t]);

  if (boardLoading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  if (!board) {
    return <Empty description={t('empty.noBoards')} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>{board.name}</h2>
            {board.description && (
              <p style={{ color: '#6b7280', marginTop: 4 }}>{board.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              icon={subscribed ? <BellFilled /> : <BellOutlined />}
              onClick={handleSubscribe}
            >
              {subscribed ? t('board.subscribed') : t('board.subscribe')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push(`/community/${boardSlug}/new`)}
            >
              {t('board.createPost')}
            </Button>
          </div>
        </div>
      </div>

      <Segmented
        value={sort}
        onChange={(val) => { setSort(val as string); setPage(1); }}
        options={[
          { label: t('latest'), value: 'latest' },
          { label: t('hot'), value: 'hot' },
          { label: t('top'), value: 'top' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {postsLoading ? (
        <Spin />
      ) : !posts || posts.items.length === 0 ? (
        <Empty description={t('empty.noPosts')} />
      ) : (
        <>
          {posts.items.map((post) => (
            <Card
              key={post.id}
              hoverable
              onClick={() => router.push(`/community/${boardSlug}/${post.id}`)}
              style={{ marginBottom: 12 }}
              styles={{ body: post.isPinned ? { background: 'rgba(139, 92, 246, 0.04)' } : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {post.isPinned && <PushpinOutlined style={{ color: '#8b5cf6' }} />}
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{post.title}</span>
                    {post.type === 'qa' && (
                      <Tag>{post.isLocked ? t('qa.solved') : t('qa.unsolved')}</Tag>
                    )}
                    {post.isLocked && <Tag color="default">{t('post.locked')}</Tag>}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    {(() => {
                      try {
                        const tags: string[] = JSON.parse(post.tags);
                        return tags.map((tag: string) => (
                          <Tag key={tag} color="blue">{tag}</Tag>
                        ));
                      } catch { return null; }
                    })()}
                  </div>
                  <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 13 }}>
                    <span>{post.user.username}</span>
                    <span style={{ margin: '0 12px' }}>{new Date(post.createdAt).toLocaleDateString()}</span>
                    <LikeOutlined /> {post.voteScore}
                    <MessageOutlined style={{ marginLeft: 12 }} /> {post.replyCount}
                    <EyeOutlined style={{ marginLeft: 12 }} /> {post.viewCount}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Pagination
              current={page}
              total={posts.total}
              pageSize={20}
              onChange={(p) => setPage(p)}
              showSizeChanger={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
