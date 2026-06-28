'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Form, Input, Button, Select, message, Alert, Table, Tag } from 'antd';
import { AlipayOutlined, WechatOutlined, BankOutlined, WalletOutlined } from '@ant-design/icons';
import { apiGet, apiPost } from '@/lib/api-client';

interface PaymentMethod {
  id: string;
  type: 'alipay' | 'wechat' | 'bank';
  account: string;
  accountName: string;
  isDefault: boolean;
  verified: boolean;
  createdAt: string;
}

interface PayoutRecord {
  id: string;
  amount: number;
  status: string;
  payoutRef?: string;
  createdAt: string;
}

export default function SellerPaymentPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [balance, setBalance] = useState({ pending: 0, totalPaid: 0 });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [methodsRes, payoutsRes] = await Promise.all([
      apiGet<PaymentMethod[]>('/api/seller/payment-methods'),
      apiGet<{ payouts: PayoutRecord[]; pendingBalance: number; totalPaid: number }>('/api/seller/payouts'),
    ]);
    if (methodsRes?.success) {
      setMethods(methodsRes.data ?? []);
    }
    if (payoutsRes?.success && payoutsRes.data) {
      setPayouts(payoutsRes.data.payouts ?? []);
      setBalance({
        pending: payoutsRes.data.pendingBalance ?? 0,
        totalPaid: payoutsRes.data.totalPaid ?? 0,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddMethod = async () => {
    const values = await form.validateFields();
    const res = await apiPost('/api/seller/payment-methods', values);
    if (res?.success) {
      message.success('收款方式已添加');
      setEditing(false);
      form.resetFields();
      fetchData();
    } else {
      message.error(res?.error || '添加失败');
    }
  };

  const handleSetDefault = async (id: string) => {
    const res = await apiPost(`/api/seller/payment-methods/${id}/default`);
    if (res?.success) {
      message.success('已设为默认收款方式');
      fetchData();
    }
  };

  const handlePayout = async () => {
    if (balance.pending <= 0) {
      message.warning('暂无可提现余额');
      return;
    }
    const res = await apiPost('/api/seller/payouts');
    if (res?.success) {
      message.success(`提现申请已提交：¥${(balance.pending / 100).toFixed(2)}`);
      fetchData();
    } else {
      message.error(res?.error || '提现失败');
    }
  };

  const payoutColumns = [
    { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${(v / 100).toFixed(2)}` },
    { title: '状态', dataIndex: 'status', render: (s: string) => {
      const color = s === 'paid' ? 'green' : s === 'processing' ? 'blue' : 'orange';
      const label = s === 'paid' ? '已到账' : s === 'processing' ? '处理中' : '待处理';
      return <Tag color={color}>{label}</Tag>;
    }},
    { title: '参考号', dataIndex: 'payoutRef', render: (v?: string) => v?.slice(0, 12) + '...' || '—' },
    { title: '申请时间', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1>收款管理</h1>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <WalletOutlined style={{ fontSize: 28, color: '#1890ff' }} />
            <div style={{ fontSize: 12, color: '#888' }}>待结算余额</div>
            <div style={{ fontSize: 28, fontWeight: 'bold' }}>¥{(balance.pending / 100).toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#888' }}>累计已提现</div>
            <div style={{ fontSize: 20 }}>¥{(balance.totalPaid / 100).toFixed(2)}</div>
          </div>
          <Button type="primary" size="large" onClick={handlePayout} disabled={balance.pending <= 0}>
            立即提现
          </Button>
        </div>
      </Card>

      <Tabs
        items={[
          {
            key: 'methods',
            label: '收款方式',
            children: (
              <Card
                extra={
                  <Button type="link" onClick={() => { setEditing(true); form.resetFields(); }}>
                    添加收款方式
                  </Button>
                }
              >
                {methods.length === 0 && (
                  <Alert title="尚未添加收款方式，提现前需要先绑定收款账户" type="info" showIcon style={{ marginBottom: 16 }} />
                )}
                {methods.map(m => (
                  <Card key={m.id} size="small" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {m.type === 'alipay' ? <AlipayOutlined style={{ color: '#1677ff', marginRight: 8 }} /> :
                         m.type === 'wechat' ? <WechatOutlined style={{ color: '#07c160', marginRight: 8 }} /> :
                         <BankOutlined style={{ marginRight: 8 }} />}
                        {m.accountName} — {m.account}
                      </span>
                      <span>
                        {m.verified && <Tag color="green">已认证</Tag>}
                        {m.isDefault && <Tag color="blue">默认</Tag>}
                        {!m.isDefault && (
                          <Button size="small" onClick={() => handleSetDefault(m.id)}>设为默认</Button>
                        )}
                      </span>
                    </div>
                  </Card>
                ))}
                {editing && (
                  <Card size="small" style={{ marginTop: 12, background: '#fafafa' }}>
                    <Form form={form} layout="inline">
                      <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                        <Select options={[
                          { label: '支付宝', value: 'alipay' },
                          { label: '微信支付', value: 'wechat' },
                          { label: '银行卡', value: 'bank' },
                        ]} style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item name="accountName" label="账户名" rules={[{ required: true }]}>
                        <Input placeholder="实名" />
                      </Form.Item>
                      <Form.Item name="account" label="账号" rules={[{ required: true }]}>
                        <Input placeholder="支付宝账号/银行卡号" />
                      </Form.Item>
                      <Button type="primary" onClick={handleAddMethod}>保存</Button>
                      <Button onClick={() => setEditing(false)}>取消</Button>
                    </Form>
                  </Card>
                )}
              </Card>
            ),
          },
          {
            key: 'history',
            label: '提现记录',
            children: (
              <Table dataSource={payouts} columns={payoutColumns} rowKey="id" loading={loading}
                locale={{ emptyText: '暂无提现记录' }} />
            ),
          },
        ]}
      />
    </div>
  );
}
