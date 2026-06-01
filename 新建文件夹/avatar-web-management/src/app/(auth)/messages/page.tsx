'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Input, Button, Spin, Empty, List, Badge, App, Typography } from 'antd';
import { SendOutlined, UserOutlined, MessageOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiGet, useApiPaginated } from '@/lib/use-api';
import { apiPost, apiPut } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface OtherUser {
  id: string;
  username: string;
  role: string;
}

interface LastMessage {
  id: string;
  content: string;
  senderId: string;
  readAt: string | null;
  createdAt: string;
}

interface ConversationItem {
  id: string;
  otherUser: OtherUser;
  lastMessage: LastMessage | null;
  unreadCount: number;
  lastMessageAt: string;
  createdAt: string;
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; username: string; role: string };
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const PAGE_SIZE = 50;

export default function MessagesPage() {
  const t = useTranslations('messages');
  const router = useRouter();
  const { message } = App.useApp();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Conversation list
  const { data: convRes, isLoading: convLoading, mutate: convMutate } = useApiPaginated<ConversationItem>(
    '/api/conversations',
    { pageSize: '50' },
  );
  const conversations = convRes?.success
    ? (convRes.data as unknown as { items: ConversationItem[] })?.items || []
    : [];

  // Messages for active conversation
  const { data: msgRes, isLoading: msgLoading, mutate: msgMutate } = useApiPaginated<MessageItem>(
    activeConvId ? `/api/conversations/${activeConvId}/messages` : null,
    { pageSize: String(PAGE_SIZE) },
  );
  const messages = msgRes?.success
    ? (msgRes.data as unknown as { items: MessageItem[] })?.items || []
    : [];

  // Auto-scroll to bottom
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Mark as read
  useEffect(() => {
    if (activeConvId) {
      apiPut(`/api/conversations/${activeConvId}/read`).then(() => convMutate());
    }
  }, [activeConvId, convMutate]);

  // WebSocket for real-time messages
  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const socket = new WebSocket(`${WS_URL}?token=${token}`);
    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'message:new') {
          const msg = data.data;
          if (msg.conversationId === activeConvId) {
            msgMutate();
            apiPut(`/api/conversations/${activeConvId}/read`);
          }
          convMutate();
        }
      } catch { /* ignore parse errors */ }
    };
    setWs(socket);
    return () => { socket.close(); };
  }, [activeConvId, convMutate, msgMutate]);

  const handleSend = useCallback(async () => {
    if (!msgInput.trim() || !activeConvId) return;
    setSending(true);
    try {
      const res = await apiPost(`/api/conversations/${activeConvId}/messages`, {
        content: msgInput.trim(),
      });
      if (res.success) {
        setMsgInput('');
        msgMutate();
      } else {
        message.error(res.error || 'Send failed');
      }
    } finally {
      setSending(false);
    }
  }, [msgInput, activeConvId, msgMutate, message]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', padding: 16, gap: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* Conversation List */}
      <div style={{ width: 320, flexShrink: 0 }}>
        <Card
          title={<Title level={5} style={{ margin: 0 }}><MessageOutlined /> {t('title')}</Title>}
          styles={{ body: { padding: 0, maxHeight: 'calc(100vh - 160px)', overflow: 'auto' } }}
        >
          {convLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : conversations.length === 0 ? (
            <Empty description={t('noConversations')} style={{ padding: 24 }} />
          ) : (
            <List
              dataSource={conversations}
              renderItem={(conv) => (
                <List.Item
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 16px',
                    background: activeConvId === conv.id ? 'rgba(139, 92, 246, 0.1)' : undefined,
                    borderLeft: activeConvId === conv.id ? '3px solid #8b5cf6' : '3px solid transparent',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 14 }}>
                        <UserOutlined style={{ marginRight: 6 }} />
                        {conv.otherUser.username}
                      </Text>
                      {conv.unreadCount > 0 && (
                        <Badge count={conv.unreadCount} size="small" overflowCount={99} />
                      )}
                    </div>
                    {conv.lastMessage && (
                      <Text
                        type="secondary"
                        ellipsis
                        style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                      >
                        {conv.lastMessage.senderId === conv.otherUser.id ? '' : 'You: '}
                        {conv.lastMessage.content}
                      </Text>
                    )}
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>

      {/* Chat Panel */}
      <div style={{ flex: 1 }}>
        {!activeConv ? (
          <Card styles={{ body: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' } }}>
            <Empty description={t('selectConversation')} />
          </Card>
        ) : (
          <Card
            title={
              <span>
                <UserOutlined style={{ marginRight: 8 }} />
                {activeConv?.otherUser.username}
              </span>
            }
            styles={{ body: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', padding: 0 } }}
          >
            {/* Message list */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {msgLoading ? (
                <div style={{ textAlign: 'center' }}><Spin /></div>
              ) : messages.length === 0 ? (
                <Empty description={t('noMessages')} />
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: msg.senderId === activeConv?.otherUser.id ? 'flex-start' : 'flex-end',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{
                      maxWidth: '70%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: msg.senderId === activeConv?.otherUser.id
                        ? 'rgba(255,255,255,0.08)'
                        : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      color: '#fff',
                    }}>
                      <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                        {msg.readAt && msg.senderId !== activeConv?.otherUser.id && ' ✓'}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(139, 92, 246, 0.1)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <TextArea
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('inputPlaceholder')}
                  rows={2}
                  autoFocus
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={sending}
                  disabled={!msgInput.trim()}
                  style={{ alignSelf: 'flex-end' }}
                />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
