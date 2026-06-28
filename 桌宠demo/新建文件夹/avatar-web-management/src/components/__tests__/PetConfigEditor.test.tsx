/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Form } from 'antd';
import type { FormInstance } from 'antd';
import type { ReactNode } from 'react';
import PetConfigEditor from '@/components/pet/PetConfigEditor';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string, values?: Record<string, string>) => {
      if (namespace === 'pet' && key === 'model.avatarId' && values?.id) {
        return `model.avatarId:${values.id}`;
      }

      return key;
    };

    return t;
  },
}));

jest.mock('@ant-design/icons', () => ({
  CloudServerOutlined: () => <span data-testid="icon-cloud" />,
  LinkOutlined: () => <span data-testid="icon-link" />,
  PictureOutlined: () => <span data-testid="icon-picture" />,
  ShopOutlined: () => <span data-testid="icon-shop" />,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

function EditorHarness({
  onOpenAssetPicker = jest.fn(),
  onUnbindAvatar = jest.fn(),
}: {
  onOpenAssetPicker?: (type: string) => void;
  onUnbindAvatar?: () => void | Promise<void>;
}) {
  const [form] = Form.useForm();

  return (
    <PetConfigEditor
      form={form as FormInstance}
      config={{
        id: 'cfg_1',
        pet_name: 'Nova',
        personality: 'Curious and calm',
        backstory: 'Created for desktop companionship.',
        animation_model: 'live2d',
        avatar_id: 'avatar_1',
        ffmpeg_path: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
        idle_timeout: 300,
        wander_interval: 30,
      }}
      onOpenAssetPicker={onOpenAssetPicker}
      onUnbindAvatar={onUnbindAvatar}
    />
  );
}

describe('PetConfigEditor', () => {
  it('renders the basic and model tabs', () => {
    render(<EditorHarness />, { wrapper: Wrapper });

    expect(screen.getByText('tabs.basic')).toBeInTheDocument();
    expect(screen.getByText('tabs.model')).toBeInTheDocument();
    expect(screen.getByLabelText('basic.name')).toBeInTheDocument();
    expect(screen.getByLabelText('basic.personality')).toBeInTheDocument();
    expect(screen.getByLabelText('basic.backstory')).toBeInTheDocument();
  });

  it('opens asset pickers from the model tab controls', () => {
    const onOpenAssetPicker = jest.fn();
    render(<EditorHarness onOpenAssetPicker={onOpenAssetPicker} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText('tabs.model'));
    fireEvent.click(screen.getByRole('button', { name: /model.pickModel/i }));
    fireEvent.click(screen.getByRole('button', { name: /model.pickTexture/i }));
    fireEvent.click(screen.getByRole('button', { name: /model.pickAnimation/i }));

    expect(onOpenAssetPicker).toHaveBeenNthCalledWith(1, 'model');
    expect(onOpenAssetPicker).toHaveBeenNthCalledWith(2, 'texture');
    expect(onOpenAssetPicker).toHaveBeenNthCalledWith(3, 'animation');
  });

  it('renders bound avatar tag and delegates unbind through the prop', async () => {
    const onUnbindAvatar = jest.fn();
    render(<EditorHarness onUnbindAvatar={onUnbindAvatar} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText('tabs.model'));

    expect(screen.getByText('model.avatarId:avatar_1')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close'));

    await waitFor(() => expect(onUnbindAvatar).toHaveBeenCalledTimes(1));
  });
});
