'use client';

import { useState, useCallback } from 'react';
import {
  Card, Button, Tag, Spin, Empty, Input, App, Breadcrumb, Space, Divider,
} from 'antd';
import {
  LikeOutlined, LikeFilled, DislikeOutlined, DislikeFilled,
  MessageOutlined, EyeOutlined, PushpinOutlined, LockOutlined,
  CheckCircleFilled, BellOutlined, BellFilled,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiGet } from '@/lib/use-api';
import { apiPost, apiPut } from '@/lib/api-client';

const { TextArea } = Input;

interface ReplyUser {
  id: string;
  username: string;
  role: string;
}

interface ReplyNode {
  id: string;
  content: string;
  voteScore: number;
  isAccepted: boolean;
  createdAt: string;
  userId: string;
  parentId: string | null;
  user: ReplyUser;
  children: ReplyNode[];
}

interface PostDetail {
  id: string;
  title: string;
  content: string;
  type: string;
  isPinned: boolean;
  isLocked: boolean;
  voteScore: number;
  viewCount: number;
  replyCount: number;
  tags: string;
  createdAt: string;
  userId: string;
  user: ReplyUser;
  board: { id: string; name: string; slug: string };
}

interface PostDetailResponse {
  post: PostDetail;
  replies: ReplyNode[];
  replyCount: number;
}

export default function PostDetailPage() {
  const t = useTranslations('community');
  const { boardSlug, postId } = useParams<{ boardSlug: string; postId: string }>();
  const router = useRouter();
  const { message } = App.useApp();

  const [replyContent, setReplyContent] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [myVote, setMyVote] = useState<number>(0);
  const [subscribed, setSubscribed] = useState(false);

  const { data, isLoading, mutate } = useApiGet<PostDetailResponse>(
    `/api/community/posts/${postId}`,
  );

  const detail = data?.success ? data.data : null;
  const post = detail?.post ?? null;

  const handleVote = useCallback(async (value: number) => {
    const res = await apiPost<{ voted: boolean }>('/api/community/votes', {
      targetType: 'post',
      targetId: postId,
      value,
    });
    if (res.success) {
      setMyVote(res.data!.voted ? value : 0);
      mutate();
    }
  }, [postId, mutate]);

  const handleSubscribe = useCallback(async () => {
    const res = await apiPost<{ subscribed: boolean }>('/api/community/subscriptions', {
      targetType: 'post',
      targetId: postId,
    });
    if (res.success) {
      setSubscribed(res.data!.subscribed);
    }
  }, [postId]);

  const handleReply = useCallback(async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiPost(`/api/community/posts/${postId}/replies`, {
        content: replyContent.trim(),
        parentId: replyParentId,
      });
      if (res.success) {
        setReplyContent('');
        setReplyParentId(null);
        mutate();
      } else {
        message.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  }, [replyContent, replyParentId, postId, mutate, message]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  if (!post) {
    return <Empty description={t('post.notFound')} />;
  }

  const tagList = (() => {
    try { return JSON.parse(post.tags) as string[]; } catch { return []; }
  })();

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb
          items={[
            { title: <a onClick={() => router.push('/community')}>{t('title')}</a> },
            { title: <a onClick={() => router.push(`/community/${boardSlug}`)}>{post.board.name}</a> },
            { title: post.title },
          ]}
        />
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {post.isPinned && <PushpinOutlined style={{ color: '#8b5cf6' }} />}
          {post.isLocked && <LockOutlined />}
          <h1 style={{ fontSize: 22, margin: 0, flex: 1 }}>{post.title}</h1>
          {post.type === 'qa' && <Tag color="green">Q&A</Tag>}
        </div>

        <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
          <span>{post.user.username}</span>
          <span style={{ margin: '0 8px' }}>·</span>
          <span>{new Date(post.createdAt).toLocaleString()}</span>
          <span style={{ margin: '0 8px' }}>·</span>
          <EyeOutlined /> {post.viewCount} {t('post.views')}
        </div>

        {tagList.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {tagList.map((tag) => <Tag key={tag}>{tag}</Tag>)}
          </div>
        )}

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
          whiteSpace: 'pre-wrap',
          fontSize: 15,
          lineHeight: 1.7,
        }}>
          {post.content}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Space>
            <Button
              icon={myVote === 1 ? <LikeFilled /> : <LikeOutlined />}
              type={myVote === 1 ? 'primary' : 'default'}
              onClick={() => handleVote(1)}
            >
              {post.voteScore}
            </Button>
            <Button
              icon={myVote === -1 ? <DislikeFilled /> : <DislikeOutlined />}
              type={myVote === -1 ? 'primary' : 'default'}
              onClick={() => handleVote(-1)}
            />
          </Space>
          <Button
            icon={subscribed ? <BellFilled /> : <BellOutlined />}
            onClick={handleSubscribe}
          >
            {subscribed ? t('board.subscribed') : t('board.subscribe')}
          </Button>
        </div>
      </Card>

      <Divider />

      <h3 style={{ marginBottom: 16 }}>
        <MessageOutlined /> {t('post.replies')} ({detail?.replyCount ?? 0})
      </h3>

      {detail?.replies && detail.replies.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          {detail.replies.map((reply) => (
            <ReplyNodeCard
              key={reply.id}
              reply={reply}
              postId={postId}
              postUserId={post.userId}
              postType={post.type}
              onReply={(parentId) => { setReplyParentId(parentId); setReplyContent(''); }}
              onRefresh={() => mutate()}
              depth={0}
              t={t}
            />
          ))}
        </div>
      ) : (
        <Empty description={t('post.noReplies')} style={{ marginBottom: 24 }} />
      )}

      {!post.isLocked && (
        <Card>
          {replyParentId && (
            <div style={{ marginBottom: 8, color: '#6b7280' }}>
              {t('post.replyingTo')}{' '}
              <Button type="link" size="small" onClick={() => setReplyParentId(null)}>
                {t('post.cancel')}
              </Button>
            </div>
          )}
          <TextArea
            rows={4}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={t('post.replyPlaceholder')}
          />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Button type="primary" loading={submitting} onClick={handleReply}>
              {t('post.submitReply')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ReplyNodeCard({
  reply,
  postId,
  postUserId,
  postType,
  onReply,
  onRefresh,
  depth,
  t,
}: {
  reply: ReplyNode;
  postId: string;
  postUserId: string;
  postType: string;
  onReply: (parentId: string) => void;
  onRefresh: () => void;
  depth: number;
  t: (key: string) => string;
}) {
  const [collapsed, setCollapsed] = useState(depth >= 2);
  const { message } = App.useApp();

  const handleChildVote = useCallback(async (replyId: string, value: number) => {
    const res = await apiPost('/api/community/votes', {
      targetType: 'reply',
      targetId: replyId,
      value,
    });
    if (res.success) onRefresh();
  }, [onRefresh]);

  const handleAccept = useCallback(async () => {
    const res = await apiPut(`/api/community/posts/${postId}/accept`, {
      replyId: reply.id,
    });
    if (res.success) {
      message.success(t('qa.accepted'));
      onRefresh();
    }
  }, [postId, reply.id, message, onRefresh, t]);

  return (
    <div style={{
      marginLeft: depth > 0 ? 24 : 0,
      marginBottom: 12,
      borderLeft: depth > 0 ? '2px solid rgba(139, 92, 246, 0.2)' : 'none',
      paddingLeft: depth > 0 ? 16 : 0,
    }}>
      <Card
        size="small"
        style={reply.isAccepted ? { borderColor: '#22c55e', background: 'rgba(34,197,94,0.04)' } : undefined}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: '#e5e7eb' }}>{reply.user.username}</span>
            <span style={{ margin: '0 8px' }}>·</span>
            <span>{new Date(reply.createdAt).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {reply.isAccepted && (
              <Tag color="green" icon={<CheckCircleFilled />}>{t('qa.acceptedAnswer')}</Tag>
            )}
          </div>
        </div>

        <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8, fontSize: 14 }}>
          {reply.content}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<LikeOutlined />}
            onClick={() => handleChildVote(reply.id, 1)}
          >
            {reply.voteScore}
          </Button>
          <Button size="small" onClick={() => onReply(reply.id)}>
            {t('post.reply')}
          </Button>
          {postType === 'qa' && !reply.isAccepted && reply.userId !== postUserId && (
            <Button size="small" type="primary" ghost onClick={handleAccept}>
              {t('qa.acceptAnswer')}
            </Button>
          )}
        </div>
      </Card>

      {reply.children.length > 0 && (
        <>
          {depth >= 2 && collapsed ? (
            <Button
              type="link"
              size="small"
              onClick={() => setCollapsed(false)}
              style={{ marginLeft: 24, marginTop: 4 }}
            >
              {t('post.showMoreReplies')} ({reply.children.length})
            </Button>
          ) : (
            reply.children.map((child) => (
              <ReplyNodeCard
                key={child.id}
                reply={child}
                postId={postId}
                postUserId={postUserId}
                postType={postType}
                onReply={onReply}
                onRefresh={onRefresh}
                depth={depth + 1}
                t={t}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
