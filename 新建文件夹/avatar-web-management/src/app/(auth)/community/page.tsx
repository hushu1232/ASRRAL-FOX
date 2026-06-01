'use client';

import { Card, Row, Col, Spin, Empty, Typography, Tag, List } from 'antd';
import {
  QuestionCircleOutlined, MessageOutlined, NotificationOutlined,
  FireOutlined, EyeOutlined, LikeOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiGet, useApiPaginated } from '@/lib/use-api';
import type { PaginatedResponse } from '@/lib/use-api';

const { Title, Text, Paragraph } = Typography;

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  icon: string | null;
  color: string | null;
  postCount: number;
}

interface PostItem {
  id: string;
  title: string;
  boardId: string;
  voteScore: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
  board: { name: string; slug: string };
}

const ICON_MAP: Record<string, React.ReactNode> = {
  QuestionCircleOutlined: <QuestionCircleOutlined />,
  MessageOutlined: <MessageOutlined />,
  NotificationOutlined: <NotificationOutlined />,
};

const TYPE_COLOR: Record<string, string> = {
  qa: '#22c55e',
  discussion: '#8b5cf6',
  official: '#f59e0b',
};

export default function CommunityPage() {
  const t = useTranslations('community');
  const router = useRouter();

  const { data: boardsRes, isLoading: boardsLoading } = useApiPaginated<Board>('/api/community/boards', { pageSize: '50' });
  const { data: hotRes, isLoading: hotLoading } = useApiPaginated<PostItem>(
    '/api/community/posts',
    { sort: 'hot', pageSize: '10' },
  );

  const boards = boardsRes?.success ? (boardsRes.data as PaginatedResponse<Board>)?.items : [];
  const hotPosts = hotRes?.success ? (hotRes.data as PaginatedResponse<PostItem>)?.items : [];

  if (boardsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>{t('title')}</Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Title level={5} style={{ marginBottom: 16 }}>{t('boards')}</Title>
          {boards.length === 0 ? (
            <Empty description={t('empty.noBoards')} />
          ) : (
            <Row gutter={[16, 16]}>
              {boards.map((board) => (
                <Col xs={24} sm={12} key={board.id}>
                  <Card
                    hoverable
                    onClick={() => router.push(`/community/${board.slug}`)}
                    style={{
                      borderLeft: `4px solid ${board.color || TYPE_COLOR[board.type] || '#8b5cf6'}`,
                      height: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24, color: board.color || TYPE_COLOR[board.type] }}>
                        {board.icon && ICON_MAP[board.icon] ? ICON_MAP[board.icon] : <MessageOutlined />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text strong>{board.name}</Text>
                          {board.type === 'qa' && <Tag color="green">{t('qa.solved')}</Tag>}
                          {board.type === 'official' && <Tag color="orange">{t('type.official')}</Tag>}
                        </div>
                        {board.description && (
                          <Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ marginBottom: 4, marginTop: 4 }}>
                            {board.description}
                          </Paragraph>
                        )}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {board.postCount} {t('post.replies')}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<span><FireOutlined style={{ color: '#f97316', marginRight: 8 }} />{t('hot')}</span>}>
            {hotLoading ? (
              <Spin />
            ) : hotPosts.length === 0 ? (
              <Empty description={t('empty.noPosts')} />
            ) : (
              <List
                size="small"
                dataSource={hotPosts.slice(0, 10)}
                renderItem={(post: PostItem) => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/community/${post.board.slug}/${post.id}`)}
                  >
                    <div style={{ width: '100%' }}>
                      <Text ellipsis style={{ maxWidth: '100%' }}>{post.title}</Text>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <LikeOutlined /> {post.voteScore} &nbsp;
                          <MessageOutlined /> {post.replyCount} &nbsp;
                          <EyeOutlined /> {post.viewCount}
                        </Text>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
