'use client';

import React, { useState } from 'react';
import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Dropdown, Grid, Layout, Menu, Space, theme } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useRoleChecking } from '@/hooks/use-auth';
import { getMenus } from './util';
import { Text } from '../antd-wrapper';

const { Header, Sider, Content } = Layout;
const SIDER_WITH = 230;
const SIDER_COLLAPSED_WITH = 80;
const HEADER_HEIGHT = 64;
const PADDING_CONTENT = 12;

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();
  const { modal } = App.useApp();
  const isHaveAccess = useRoleChecking();

  const router = useRouter();
  const pathname = usePathname();
  const layout = Grid.useBreakpoint();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    modal.confirm({
      title: 'Logout',
      content: 'Are you sure you want to logout?',
      okText: 'Logout',
      okButtonProps: { danger: true, icon: <LogoutOutlined /> },
      cancelText: 'Cancel',
      onOk: async () => {
        await signOut({ redirectTo: '/auth/login' });
      },
    });
  };

  return (
    <Layout>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ height: '100vh' }}
        breakpoint="lg"
        width={SIDER_WITH}
        collapsedWidth={layout.lg ? SIDER_COLLAPSED_WITH : 0}
      >
        <img
          src={collapsed ? '/logo/logo_icon.png' : '/logo/logo_text.png'}
          alt="logo"
          style={{ margin: '12px 0', height: 48, width: '100%', objectFit: 'cover' }}
        />
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          style={{ overflowY: 'auto', height: 'cacl(100vh - 72px)' }}
          items={getMenus(isHaveAccess)}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, height: HEADER_HEIGHT }} className="flex-between">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 64, height: '100%' }}
          />
          <Space className="pr-16" size={14} align="center">
            <div className="flex-column items-end">
              <Text strong style={{ lineHeight: 1.2 }}>
                {session?.user.name}
              </Text>
              <Text type="secondary" style={{ lineHeight: 1.2 }}>
                {session?.user.role}
              </Text>
            </div>
            <Dropdown
              trigger={['click', 'hover']}
              menu={{
                items: [
                  {
                    key: 'Logout',
                    label: 'Logout',
                    icon: <LogoutOutlined />,
                    onClick: handleLogout,
                  },
                ],
              }}
            >
              <Avatar icon={<UserOutlined />} />
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            height: `calc(100vh - ${HEADER_HEIGHT + 2 * PADDING_CONTENT}px)`,
            overflow: 'auto',
            padding: PADDING_CONTENT,
          }}
        >
          <div
            style={{
              padding: 24,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              minHeight: `calc(100vh - ${HEADER_HEIGHT + 2 * PADDING_CONTENT}px)`,
              minWidth: `calc(100vw - ${(collapsed ? SIDER_COLLAPSED_WITH : SIDER_WITH) + 2 * PADDING_CONTENT}px)`,
              width: 'fit-content',
              transition: 'all 0.2s',
            }}
          >
            {layout.xs && !collapsed ? null : children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
