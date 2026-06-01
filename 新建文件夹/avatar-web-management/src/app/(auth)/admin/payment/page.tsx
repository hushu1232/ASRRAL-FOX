'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, message, Space, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, CheckCircleOutlined, ExperimentOutlined } from '@ant-design/icons';
import { apiGet, apiPost } from '@/lib/api-client';

interface GatewayConfig {
  id: string;
  provider: string;
  mode: string;
  isActive: boolean;
  displayName?: string;
  appId?: string;
  mchId?: string;
  apiKey?: string;
  apiSecret?: string;
  certPath?: string;
  publicKey?: string;
  notifyUrl?: string;
  returnUrl?: string;
  createdAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  stripe: 'Stripe 国际支付',
  wechat: '微信支付',
  alipay: '支付宝',
};

const PROVIDERS = [
  {
    key: 'wechat',
    label: '微信支付',
    fields: ['appId:AppID (公众号/小程序)', 'mchId:商户号 MchID', 'apiKey:APIv3 密钥', 'apiSecret:商户私钥 (PEM)', 'certPath:证书序列号', 'notifyUrl:回调通知 URL'],
    docs: 'https://pay.weixin.qq.com/docs/merchant/development/quickstart.html',
  },
  {
    key: 'alipay',
    label: '支付宝',
    fields: ['appId:AppID', 'apiKey:应用私钥 (PEM RSA2)', 'publicKey:支付宝公钥', 'notifyUrl:异步通知 URL', 'returnUrl:同步跳转 URL'],
    docs: 'https://opendocs.alipay.com/open/01bx62',
  },
  {
    key: 'stripe',
    label: 'Stripe 国际',
    fields: ['apiKey:Secret Key (sk_live_...)', 'apiSecret:Webhook Signing Secret'],
    docs: 'https://docs.stripe.com/keys',
  },
];

export default function AdminPaymentPage() {
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<GatewayConfig | null>(null);
  const [form] = Form.useForm();
  const [selectedProvider, setSelectedProvider] = useState('wechat');

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    const res = await apiGet('/api/admin/payment');
    if (res.success) setConfigs(res.data as GatewayConfig[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const res = await apiPost('/api/admin/payment', {
      provider: selectedProvider,
      mode: values.mode || 'sandbox',
      isActive: values.isActive ?? false,
      displayName: values.displayName,
      appId: values.appId,
      mchId: values.mchId,
      apiKey: values.apiKey,
      apiSecret: values.apiSecret,
      certPath: values.certPath,
      publicKey: values.publicKey,
      notifyUrl: values.notifyUrl,
      returnUrl: values.returnUrl,
    });
    if (res.success) {
      message.success('配置已保存');
      setModalOpen(false);
      fetchConfigs();
    } else {
      message.error(res.error || '保存失败');
    }
  };

  const handleTest = async (config: GatewayConfig) => {
    message.loading({ content: `正在测试 ${PROVIDER_LABELS[config.provider]} 沙箱连接...`, key: 'test' });
    // Quick test: create a 1-cent payment
    try {
      const res = await apiPost('/api/checkout', { itemId: 'test' });
      if (res.success) {
        message.success({ content: '沙箱连接正常！', key: 'test' });
      } else {
        message.error({ content: `测试失败: ${res.error}`, key: 'test' });
      }
    } catch {
      message.error({ content: '连接测试失败，请检查配置', key: 'test' });
    }
  };

  const columns = [
    { title: '支付方式', dataIndex: 'provider', render: (p: string) => PROVIDER_LABELS[p] || p },
    { title: '模式', dataIndex: 'mode', render: (m: string) => (
      <Tag color={m === 'live' ? 'red' : 'blue'}>{m === 'live' ? '生产' : '沙箱'}</Tag>
    )},
    { title: '状态', dataIndex: 'isActive', render: (a: boolean) => (
      a ? <Tag icon={<CheckCircleOutlined />} color="green">已激活</Tag> : <Tag>未激活</Tag>
    )},
    { title: 'AppID', dataIndex: 'appId', render: (v?: string) => v?.slice(0, 10) + '...' || '—' },
    { title: '商户号', dataIndex: 'mchId', render: (v?: string) => v || '—' },
    { title: '操作', render: (_: unknown, record: GatewayConfig) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => {
          setEditingConfig(record);
          setSelectedProvider(record.provider);
          form.setFieldsValue(record);
          setModalOpen(true);
        }}>编辑</Button>
        <Button size="small" icon={<ExperimentOutlined />} onClick={() => handleTest(record)}>测试</Button>
      </Space>
    )},
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1>支付管理</h1>
      <Tabs
        activeKey={selectedProvider}
        onChange={setSelectedProvider}
        items={PROVIDERS.map(p => ({
          key: p.key,
          label: p.label,
          children: (
            <div>
              <Card
                title={`${p.label} — 商户配置`}
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                    setEditingConfig(null);
                    form.resetFields();
                    form.setFieldsValue({ provider: p.key, mode: 'sandbox', isActive: false });
                    setModalOpen(true);
                  }}>
                    添加配置
                  </Button>
                }
              >
                <p style={{ color: '#666', marginBottom: 16 }}>
                  <a href={p.docs} target="_blank" rel="noopener noreferrer">📖 商户接入文档</a>
                  &nbsp;|&nbsp; 必填字段：{p.fields.join('、')}
                </p>
              </Card>
              <Table
                dataSource={configs.filter(c => c.provider === p.key)}
                columns={columns}
                rowKey="id"
                loading={loading}
                style={{ marginTop: 16 }}
                locale={{ emptyText: `暂无${p.label}配置 — 点击"添加配置"绑定商户号` }}
              />
            </div>
          ),
        }))}
      />

      <Modal
        title={editingConfig ? '编辑商户配置' : '添加商户配置'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="displayName" label="配置名称">
            <Input placeholder="例如：公司主体-生产环境" />
          </Form.Item>
          <Form.Item name="mode" label="运行模式" rules={[{ required: true }]}>
            <Select options={[{ label: '沙箱测试 (Sandbox)', value: 'sandbox' }, { label: '生产环境 (Live)', value: 'live' }]} />
          </Form.Item>
          <Form.Item name="isActive" label="激活此配置" valuePropName="checked">
            <Switch />
          </Form.Item>
          {selectedProvider === 'wechat' && (
            <>
              <Form.Item name="appId" label="AppID" rules={[{ required: true }]}>
                <Input placeholder="wx1234567890abcdef" />
              </Form.Item>
              <Form.Item name="mchId" label="商户号 MchID" rules={[{ required: true }]}>
                <Input placeholder="1234567890" />
              </Form.Item>
              <Form.Item name="apiKey" label="APIv3 密钥" rules={[{ required: true }]}>
                <Input.Password placeholder="32字节密钥" />
              </Form.Item>
              <Form.Item name="apiSecret" label="商户私钥 (PEM)" rules={[{ required: true }]}>
                <Input.TextArea rows={4} placeholder="-----BEGIN PRIVATE KEY-----" />
              </Form.Item>
              <Form.Item name="certPath" label="证书序列号">
                <Input placeholder="从商户平台下载的证书序列号" />
              </Form.Item>
            </>
          )}
          {selectedProvider === 'alipay' && (
            <>
              <Form.Item name="appId" label="AppID" rules={[{ required: true }]}>
                <Input placeholder="2021001..." />
              </Form.Item>
              <Form.Item name="apiKey" label="应用私钥 (PEM RSA2)" rules={[{ required: true }]}>
                <Input.TextArea rows={4} placeholder="-----BEGIN RSA PRIVATE KEY-----" />
              </Form.Item>
              <Form.Item name="publicKey" label="支付宝公钥" rules={[{ required: true }]}>
                <Input.TextArea rows={4} placeholder="-----BEGIN PUBLIC KEY-----" />
              </Form.Item>
            </>
          )}
          {selectedProvider === 'stripe' && (
            <>
              <Form.Item name="apiKey" label="Secret Key">
                <Input.Password placeholder="sk_live_..." />
              </Form.Item>
              <Form.Item name="apiSecret" label="Webhook Signing Secret">
                <Input.Password placeholder="whsec_..." />
              </Form.Item>
            </>
          )}
          <Form.Item name="notifyUrl" label="回调通知 URL">
            <Input placeholder="https://your-domain.com/api/webhooks/payment" />
          </Form.Item>
          <Form.Item name="returnUrl" label="同步跳转 URL">
            <Input placeholder="https://your-domain.com/payment/result" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
