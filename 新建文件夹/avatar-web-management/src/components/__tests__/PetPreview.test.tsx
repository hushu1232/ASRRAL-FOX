/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import PetPreview from '@/components/pet/preview/PetPreview';

Element.prototype.scrollIntoView = jest.fn();

const mockLoadConfig = jest.fn();
const mockSendMessage = jest.fn();
const mockClearMessages = jest.fn();
const mockSetVoiceActive = jest.fn();
const mockSetVoiceText = jest.fn();
const mockSetVoiceSupported = jest.fn();
const mockStartVoice = jest.fn();
const mockStopVoice = jest.fn();

let storeState: Record<string, unknown> = {
  config: { petName: 'TestPet', animationModel: 'live2d', modelPath: '/test.model3.json' },
  configLoading: false,
  configError: null,
  messages: [],
  voiceState: 'idle',
  isProcessing: false,
  currentEmotion: 'neutral',
  currentAction: undefined,
  audioElement: null,
  voiceActive: false,
  voiceText: '',
  voiceSupported: true,
};

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, Record<string, string>> = {
      pet: {
        'preview.loadingConfig': '加载配置中...',
        'preview.reload': '重新加载',
        'preview.webPreview': 'Web预览',
        'preview.clearChat': '清空对话',
        'preview.configInDashboard': '在控制台中配置',
        'voiceInput.notSupported': '不支持语音',
        'voiceInput.micDenied': '麦克风被拒绝',
        'voiceInput.startFailed': '启动失败',
        'voiceLabels.listening': '正在听',
        'voiceLabels.thinking': '思考中',
        'voiceLabels.speaking': '说话中',
      },
    };
    return (key: string) => keys[ns]?.[key] ?? key;
  },
}));

jest.mock('@/stores/petPreviewStore', () => ({
  usePetPreviewStore: Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => {
      const fullState = {
        ...storeState,
        loadConfig: mockLoadConfig,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        setVoiceActive: mockSetVoiceActive,
        setVoiceText: mockSetVoiceText,
        setVoiceSupported: mockSetVoiceSupported,
        setEmotion: jest.fn(),
        setAction: jest.fn(),
        setAudioElement: jest.fn(),
        showBubble: jest.fn(),
        dismissBubble: jest.fn(),
        setNightMode: jest.fn(),
        bubbleMessage: null,
        bubbleEmotion: 'neutral',
        nightMode: false,
      };
      if (selector) return selector(fullState);
      return fullState;
    }),
    {
      getState: () => ({
        ...storeState,
        loadConfig: mockLoadConfig,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        setVoiceActive: mockSetVoiceActive,
        setVoiceText: mockSetVoiceText,
        setVoiceSupported: mockSetVoiceSupported,
      }),
    }
  ),
}));

jest.mock('@/hooks/useTimeAwareness', () => ({
  useTimeAwareness: jest.fn(),
}));

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const Comp = () => <div data-testid="live2d-viewer">Live2D Mock</div>;
    Comp.displayName = 'Live2DViewer';
    return Comp;
  },
}));

jest.mock('@/components/pet/preview/ModelViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="model-viewer">ModelViewer Mock</div>,
}));

jest.mock('@/components/pet/preview/ChatPanel', () => ({
  __esModule: true,
  default: ({ onSend, voiceState, onStartVoice, onStopVoice, voiceSupported, voiceActive, voiceText, disabled, messages }: any) => (
    <div data-testid="chat-panel">
      <span data-testid="voice-state">{voiceState}</span>
      <button data-testid="send-btn" onClick={() => onSend('test')}>Send</button>
      <button data-testid="start-voice" onClick={onStartVoice}>StartVoice</button>
      <button data-testid="stop-voice" onClick={onStopVoice}>StopVoice</button>
      <span data-testid="msg-count">{messages.length}</span>
      <span data-testid="disabled">{String(disabled)}</span>
      <span data-testid="voice-active">{String(voiceActive)}</span>
      <span data-testid="voice-supported">{String(voiceSupported)}</span>
      <span data-testid="voice-text">{voiceText}</span>
    </div>
  ),
}));

jest.mock('@/components/pet/preview/TimeAwarenessOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="time-awareness">TimeAwareness Mock</div>,
}));

jest.mock('@/components/pet/preview/VoiceInput', () => ({
  useVoiceInput: ({ active, onResult, onError, onStateChange }: any) => ({
    start: mockStartVoice,
    stop: mockStopVoice,
    supported: true,
  }),
}));

jest.mock('@ant-design/icons', () => ({
  SettingOutlined: () => <span data-testid="icon-setting" />,
  ReloadOutlined: () => <span data-testid="icon-reload" />,
  ExpandOutlined: () => <span data-testid="icon-expand" />,
  CompressOutlined: () => <span data-testid="icon-compress" />,
  SunOutlined: () => <span data-testid="icon-sun" />,
  MoonOutlined: () => <span data-testid="icon-moon" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

describe('PetPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storeState = {
      config: { petName: 'TestPet', animationModel: 'live2d', modelPath: '/test.model3.json' },
      configLoading: false,
      configError: null,
      messages: [],
      voiceState: 'idle',
      isProcessing: false,
      currentEmotion: 'neutral',
      currentAction: undefined,
      audioElement: null,
      voiceActive: false,
      voiceText: '',
      voiceSupported: true,
    };
  });

  describe('loading state', () => {
    it('shows Spin when config is loading', () => {
      storeState.configLoading = true;
      storeState.config = null;
      render(<PetPreview />, { wrapper: Wrapper });
      expect(screen.getByText('加载配置中...')).toBeDefined();
    });
  });

  describe('error state', () => {
    it('shows error message and reload button', () => {
      storeState.configError = '配置加载失败';
      render(<PetPreview />, { wrapper: Wrapper });
      expect(screen.getByText('配置加载失败')).toBeDefined();
      expect(screen.getByText('重新加载')).toBeDefined();
    });

    it('calls loadConfig on reload button click', () => {
      storeState.configError = '配置加载失败';
      render(<PetPreview />, { wrapper: Wrapper });
      fireEvent.click(screen.getByText('重新加载'));
      expect(mockLoadConfig).toHaveBeenCalled();
    });
  });

  describe('normal rendering', () => {
    it('renders pet name and web preview label', () => {
      render(<PetPreview />, { wrapper: Wrapper });
      expect(screen.getByText(/TestPet/)).toBeDefined();
      expect(screen.getByText(/Web预览/)).toBeDefined();
    });

    it('renders ModelViewer and ChatPanel', () => {
      render(<PetPreview />, { wrapper: Wrapper });
      expect(screen.getByTestId('model-viewer')).toBeDefined();
      expect(screen.getByTestId('chat-panel')).toBeDefined();
    });

    it('renders TimeAwarenessOverlay', () => {
      render(<PetPreview />, { wrapper: Wrapper });
      expect(screen.getByTestId('time-awareness')).toBeDefined();
    });
  });

  describe('null config', () => {
    it('returns null when config is null', () => {
      storeState.config = null;
      storeState.configLoading = false;
      storeState.configError = null;
      render(<PetPreview />, { wrapper: Wrapper });
      // PetPreview returns null — no pet name, chat, or model viewer rendered
      expect(screen.queryByText(/TestPet/)).toBeNull();
      expect(screen.queryByTestId('chat-panel')).toBeNull();
      expect(screen.queryByTestId('model-viewer')).toBeNull();
    });
  });

  describe('voice state label', () => {
    it('shows listening label when voiceState is listening', () => {
      storeState.voiceState = 'listening';
      render(<PetPreview />, { wrapper: Wrapper });
      expect(screen.getByText('正在听')).toBeDefined();
    });

    it('shows thinking label when voiceState is thinking', () => {
      storeState.voiceState = 'thinking';
      render(<PetPreview />, { wrapper: Wrapper });
      expect(screen.getByText('思考中')).toBeDefined();
    });

    it('hides label when voiceState is idle', () => {
      render(<PetPreview />, { wrapper: Wrapper });
      expect(screen.queryByText('正在听')).toBeNull();
    });
  });

  describe('clear chat', () => {
    it('disables clear button when no messages', () => {
      storeState.messages = [];
      render(<PetPreview />, { wrapper: Wrapper });
      const clearBtn = screen.getByTestId('icon-reload').closest('button')!;
      expect(clearBtn).toBeDisabled();
    });
  });

  describe('send message', () => {
    it('calls store.sendMessage when ChatPanel sends', () => {
      render(<PetPreview />, { wrapper: Wrapper });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(mockSendMessage).toHaveBeenCalledWith('test');
    });
  });
});
