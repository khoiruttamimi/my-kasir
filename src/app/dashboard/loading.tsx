import { Spin } from 'antd';

export default function Loading() {
  return (
    <div
      style={{
        height: 'calc(100vh - 136px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    >
      <Spin size="large" />;
    </div>
  );
}
