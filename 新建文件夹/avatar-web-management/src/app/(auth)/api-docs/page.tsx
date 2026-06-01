'use client';

export const dynamic = 'force-static';

import { Card, Table, Tag, Tabs, Input, Button, Space, Select } from 'antd';
import { CopyOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const apiEndpoints = [
  { method: 'POST', path: '/api/auth/login', desc: '用户登录（邮箱+密码）', auth: false },
  { method: 'POST', path: '/api/auth/register', desc: '用户注册', auth: false },
  { method: 'POST', path: '/api/auth/refresh', desc: '刷新Token', auth: false },
  { method: 'POST', path: '/api/auth/logout', desc: '退出登录', auth: true },
  { method: 'GET', path: '/api/auth/sso', desc: '企业SSO登录跳转', auth: false },
  { method: 'GET', path: '/api/avatars', desc: '获取形象列表', auth: true },
  { method: 'POST', path: '/api/avatars', desc: '创建新形象', auth: true },
  { method: 'GET', path: '/api/avatars/:id', desc: '获取形象详情', auth: true },
  { method: 'PUT', path: '/api/avatars/:id', desc: '更新形象信息', auth: true },
  { method: 'DELETE', path: '/api/avatars/:id', desc: '删除形象', auth: true },
  { method: 'GET', path: '/api/avatars/:id/versions', desc: '获取版本列表', auth: true },
  { method: 'POST', path: '/api/avatars/:id/versions', desc: '保存新版本', auth: true },
  { method: 'GET', path: '/api/assets', desc: '获取资产列表', auth: true },
  { method: 'POST', path: '/api/assets', desc: '上传资产', auth: true },
  { method: 'GET', path: '/api/templates', desc: '获取模板列表', auth: true },
  { method: 'GET', path: '/api/admin/users', desc: '管理用户列表', auth: true, role: 'super_admin' },
  { method: 'GET', path: '/api/admin/reviews', desc: '审核队列', auth: true, role: 'super_admin' },
];

const methodColors: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
};

export default function ApiDocsPage() {
  const t = useTranslations('apiDocs');

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('title')}</h1>

      <Tabs
        defaultActiveKey="reference"
        items={[
          {
            key: 'reference',
            label: t('reference'),
            children: (
              <Card className="!border-purple-500/10">
                <Table
                  dataSource={apiEndpoints}
                  rowKey={(r) => r.method + r.path}
                  pagination={false}
                  columns={[
                    {
                      title: t('method'), dataIndex: 'method', key: 'method', width: 80,
                      render: (m: string) => <Tag color={methodColors[m]} className="font-mono font-bold">{m}</Tag>,
                    },
                    { title: t('path'), dataIndex: 'path', key: 'path', render: (p: string) => <code className="text-blue-300">{p}</code> },
                    { title: t('description'), dataIndex: 'desc', key: 'desc' },
                    {
                      title: t('authentication'), dataIndex: 'auth', key: 'auth', width: 80,
                      render: (a: boolean) => a ? <Tag color="orange">{t('authRequired')}</Tag> : <Tag>{t('public')}</Tag>,
                    },
                    {
                      title: t('role'), dataIndex: 'role', key: 'role', width: 80,
                      render: (r?: string) => r ? <Tag color="red">{r}</Tag> : <span className="text-gray-500">-</span>,
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'try',
            label: t('tryIt'),
            children: (
              <Card className="!border-purple-500/10 max-w-2xl">
                <h3 className="text-white font-medium mb-4">{t('debugTool')}</h3>
                <div className="space-y-3">
                  <Select
                    placeholder={t('selectEndpoint')}
                    style={{ width: '100%' }}
                    options={apiEndpoints.map(e => ({
                      value: e.method + ' ' + e.path,
                      label: `${e.method} ${e.path} — ${e.desc}`,
                    }))}
                  />
                  <Input.TextArea rows={6} placeholder={t('requestBody')} className="font-mono" />
                  <Button type="primary" icon={<PlayCircleOutlined />}>{t('sendRequest')}</Button>
                </div>

                <div className="mt-4 p-3 bg-[#0a0a15] rounded-lg border border-purple-500/10">
                  <p className="text-gray-500 text-xs mb-2">{t('responseHint')}</p>
                  <pre className="text-green-400 text-xs font-mono">{`{\n  "success": true,\n  "data": { ... }\n}`}</pre>
                </div>
              </Card>
            ),
          },
          {
            key: 'auth',
            label: t('auth'),
            children: (
              <Card className="!border-purple-500/10 max-w-2xl space-y-4">
                <h3 className="text-white font-medium">{t('authMethod')}</h3>
                <div className="bg-[#0a0a15] p-4 rounded-lg border border-purple-500/10">
                  <p className="text-gray-300 text-sm mb-2">{t('authHeaderDesc')}</p>
                  <pre className="text-green-400 text-xs font-mono">{`Authorization: Bearer <access_token>`}</pre>
                </div>
                <h3 className="text-white font-medium mt-6">{t('tokenFlow')}</h3>
                <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                  <li>{t('tokenStep1')}</li>
                  <li>{t('tokenStep2')}</li>
                  <li>{t('tokenStep3')}</li>
                  <li>{t('tokenStep4')}</li>
                </ol>
                <h3 className="text-white font-medium mt-6">{t('loginLimits')}</h3>
                <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                  <li>{t('limitItem1')}</li>
                  <li>{t('limitItem2')}</li>
                  <li>{t('limitItem3')}</li>
                </ul>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
