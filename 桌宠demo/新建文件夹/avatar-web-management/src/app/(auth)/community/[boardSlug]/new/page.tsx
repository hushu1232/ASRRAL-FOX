'use client';

import { useState, useCallback } from 'react';
import { Button, Input, Select, App, Card, Tabs, Typography } from 'antd';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiGet } from '@/lib/use-api';
import { apiPost } from '@/lib/api-client';

const { TextArea } = Input;
const { Title } = Typography;

interface Board {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export default function NewPostPage() {
  const t = useTranslations('community');
  const { boardSlug } = useParams<{ boardSlug: string }>();
  const router = useRouter();
  const { message } = App.useApp();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<string>('discussion');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: boardRes, isLoading } = useApiGet<Board>(
    `/api/community/boards/slug/${boardSlug}`,
  );

  const board = boardRes?.success ? boardRes.data : null;

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      message.warning(t('post.validation.required'));
      return;
    }
    if (!board) return;

    setSubmitting(true);
    try {
      const tagArr = tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiPost<{ id: string }>(`/api/community/boards/${board.id}/posts`, {
        title: title.trim(),
        content: content.trim(),
        type: postType,
        tags: JSON.stringify(tagArr),
      });

      if (res.success) {
        message.success(t('post.createSuccess'));
        router.push(`/community/${boardSlug}/${res.data!.id}`);
      } else {
        message.error(res.error || t('post.createError'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [title, content, tags, postType, board, boardSlug, router, message, t]);

  if (!board && !isLoading) {
    return <div style={{ padding: 24 }}>{t('empty.noBoards')}</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={4}>
        {t('post.create')} — {board?.name}
      </Title>

      <Card style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Input
            size="large"
            placeholder={t('post.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder={t('post.tagsPlaceholder')}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        {board?.type !== 'official' && (
          <div style={{ marginBottom: 16 }}>
            <Select
              value={postType}
              onChange={setPostType}
              options={[
                { label: t('post.type.discussion'), value: 'discussion' },
                { label: t('post.type.qa'), value: 'qa' },
              ]}
              style={{ width: 200 }}
            />
          </div>
        )}

        <Tabs
          items={[
            {
              key: 'write',
              label: t('post.write'),
              children: (
                <TextArea
                  rows={12}
                  placeholder={t('post.contentPlaceholder')}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              ),
            },
            {
              key: 'preview',
              label: t('post.preview'),
              children: (
                <div
                  className="markdown-preview"
                  style={{ minHeight: 200, padding: 12, border: '1px solid #30363d', borderRadius: 8 }}
                >
                  {content ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
                  ) : (
                    <span style={{ color: '#6b7280' }}>{t('post.previewEmpty')}</span>
                  )}
                </div>
              ),
            },
          ]}
        />

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => router.back()}>{t('post.cancel')}</Button>
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            {t('post.submit')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
