/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import ChatPanel from '@/components/pet/preview/ChatPanel';
import type { ChatMessage, VoiceState } from '@/types/pet-preview';

Element.prototype.scrollIntoView = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, Record<string, string>> = {
      'pet.chat': {
        welcomeTitle: '开始聊天',
        welcomeDesc: '和你的桌宠对话吧',
        inputPlaceholder: '输入消息...',
        send: '发送',
        stopRecording: '停止录音',
        voiceInput: '语音输入',
      },
      'pet.voiceLabels': {
        listening: '正在听',
        thinking: '思考中',
        speaking: '说话中',
      },
    };
    return (key: string) => keys[ns]?.[key] ?? key;
  },
}));

jest.mock('@ant-design/icons', () => ({
  SendOutlined: () => <span data-testid="icon-send" />,
  AudioOutlined: () => <span data-testid="icon-audio" />,
  AudioMutedOutlined: () => <span data-testid="icon-audio-muted" />,
  RobotOutlined: () => <span data-testid="icon-robot" />,
  UserOutlined: () => <span data-testid="icon-user" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: '1',
    role: 'user',
    content: '你好',
    timestamp: new Date('2026-01-01T12:00:00').getTime(),
    ...overrides,
  };
}

describe('ChatPanel', () => {
  const baseProps = {
    messages: [] as ChatMessage[],
    onSend: jest.fn(),
    disabled: false,
    voiceState: 'idle' as VoiceState,
    onStartVoice: jest.fn(),
    onStopVoice: jest.fn(),
    voiceSupported: true,
    voiceActive: false,
    voiceText: '',
  };

  beforeEach(() => jest.clearAllMocks());

  describe('empty state', () => {
    it('shows welcome screen when no messages', () => {
      render(<ChatPanel {...baseProps} />, { wrapper: Wrapper });
      expect(screen.getByText('开始聊天')).toBeDefined();
      expect(screen.getByText('和你的桌宠对话吧')).toBeDefined();
    });

    it('does not render message bubbles when empty', () => {
      render(<ChatPanel {...baseProps} />, { wrapper: Wrapper });
      expect(screen.queryByText('你好')).toBeNull();
    });
  });

  describe('message rendering', () => {
    it('renders user and AI messages', () => {
      const messages: ChatMessage[] = [
        createMessage({ id: '1', role: 'user', content: '你好' }),
        createMessage({ id: '2', role: 'assistant', content: '你好呀！' }),
      ];
      render(<ChatPanel {...baseProps} messages={messages} />, { wrapper: Wrapper });
      expect(screen.getByText('你好')).toBeDefined();
      expect(screen.getByText('你好呀！')).toBeDefined();
    });

    it('hides welcome when messages exist', () => {
      render(<ChatPanel {...baseProps} messages={[createMessage()]} />, { wrapper: Wrapper });
      expect(screen.queryByText('开始聊天')).toBeNull();
    });
  });

  describe('input send', () => {
    it('calls onSend with trimmed text on Enter', () => {
      const onSend = jest.fn();
      render(<ChatPanel {...baseProps} onSend={onSend} />, { wrapper: Wrapper });

      const textarea = screen.getByPlaceholderText('输入消息...');
      fireEvent.change(textarea, { target: { value: '  你好世界  ' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(onSend).toHaveBeenCalledWith('你好世界');
    });

    it('calls onSend on send button click', () => {
      const onSend = jest.fn();
      render(<ChatPanel {...baseProps} onSend={onSend} />, { wrapper: Wrapper });

      const textarea = screen.getByPlaceholderText('输入消息...');
      fireEvent.change(textarea, { target: { value: '测试' } });

      const sendButton = screen.getByTestId('icon-send').closest('button')!;
      fireEvent.click(sendButton);
      expect(onSend).toHaveBeenCalledWith('测试');
    });

    it('does not send empty input', () => {
      const onSend = jest.fn();
      render(<ChatPanel {...baseProps} onSend={onSend} />, { wrapper: Wrapper });

      fireEvent.keyDown(screen.getByPlaceholderText('输入消息...'), { key: 'Enter' });
      expect(onSend).not.toHaveBeenCalled();
    });

    it('Shift+Enter does not send', () => {
      const onSend = jest.fn();
      render(<ChatPanel {...baseProps} onSend={onSend} />, { wrapper: Wrapper });

      const textarea = screen.getByPlaceholderText('输入消息...');
      fireEvent.change(textarea, { target: { value: '测试' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(onSend).not.toHaveBeenCalled();
    });

    it('sends voiceText when input is empty and voiceText exists', () => {
      const onSend = jest.fn();
      render(
        <ChatPanel {...baseProps} onSend={onSend} voiceText="语音识别结果" voiceActive />,
        { wrapper: Wrapper }
      );

      fireEvent.keyDown(screen.getByPlaceholderText('输入消息...'), { key: 'Enter' });
      expect(onSend).toHaveBeenCalledWith('语音识别结果');
    });
  });

  describe('disabled state', () => {
    it('disables input and send button when disabled', () => {
      render(<ChatPanel {...baseProps} disabled />, { wrapper: Wrapper });
      expect(screen.getByPlaceholderText('输入消息...')).toBeDisabled();
    });
  });

  describe('voice button', () => {
    it('shows voice button when voiceSupported', () => {
      render(<ChatPanel {...baseProps} voiceSupported />, { wrapper: Wrapper });
      expect(screen.getByTestId('icon-audio')).toBeDefined();
    });

    it('hides voice button when not voiceSupported', () => {
      render(<ChatPanel {...baseProps} voiceSupported={false} />, { wrapper: Wrapper });
      expect(screen.queryByTestId('icon-audio')).toBeNull();
    });

    it('calls onStartVoice on voice button click when inactive', () => {
      const onStartVoice = jest.fn();
      render(<ChatPanel {...baseProps} onStartVoice={onStartVoice} voiceActive={false} />, {
        wrapper: Wrapper,
      });

      const voiceBtn = screen.getByTestId('icon-audio').closest('button')!;
      fireEvent.click(voiceBtn);
      expect(onStartVoice).toHaveBeenCalled();
    });

    it('calls onStopVoice on voice button click when active', () => {
      const onStopVoice = jest.fn();
      render(
        <ChatPanel {...baseProps} onStopVoice={onStopVoice} voiceActive />,
        { wrapper: Wrapper }
      );

      const voiceBtn = screen.getByTestId('icon-audio-muted').closest('button')!;
      fireEvent.click(voiceBtn);
      expect(onStopVoice).toHaveBeenCalled();
    });
  });

  describe('voice state banner', () => {
    it('shows voice state banner when not idle', () => {
      render(<ChatPanel {...baseProps} voiceState="listening" />, { wrapper: Wrapper });
      expect(screen.getByText('正在听...')).toBeDefined();
    });

    it('hides banner when voiceState is idle', () => {
      render(<ChatPanel {...baseProps} voiceState="idle" />, { wrapper: Wrapper });
      expect(screen.queryByText('正在听...')).toBeNull();
    });
  });

  describe('voice text indicator', () => {
    it('shows interim voice text when voiceActive', () => {
      render(
        <ChatPanel {...baseProps} voiceActive voiceText="用户正在说..." />,
        { wrapper: Wrapper }
      );
      expect(screen.getByText('用户正在说...')).toBeDefined();
    });

    it('hides voice text when voice not active', () => {
      render(
        <ChatPanel {...baseProps} voiceActive={false} voiceText="用户正在说..." />,
        { wrapper: Wrapper }
      );
      expect(screen.queryByText('用户正在说...')).toBeNull();
    });
  });
});
