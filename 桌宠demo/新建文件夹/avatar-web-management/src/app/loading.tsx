import { Spin } from 'antd';

export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#09090F',
    }}>
      <Spin size="large" />
    </div>
  );
}
