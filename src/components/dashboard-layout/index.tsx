'use client';

import React, { useEffect, useState } from 'react';
import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Dropdown, Grid, Layout, Menu, Space, theme } from 'antd';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useRoleChecking } from '@/hooks/use-auth';
import { getMenus } from './util';
import { Text } from '../antd-wrapper';
import { DashboardFocusMode } from './focus-mode';
import styles from './styles.module.scss';

const { Header, Sider, Content } = Layout;
const SIDER_WITH = 230;
const SIDER_COLLAPSED_WITH = 80;
const HEADER_HEIGHT = 64;
const PADDING_CONTENT = 12;

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [sidebarPreference, setSidebarPreference] = useState<boolean>();
  const [focusMode, setFocusMode] = useState(false);
  const { data: session } = useSession();
  const { modal } = App.useApp();
  const isHaveAccess = useRoleChecking();

  const router = useRouter();
  const pathname = usePathname();
  const layout = Grid.useBreakpoint();
  const isCashier = pathname === '/dashboard/cashier';
  const active = isCashier && focusMode;
  const collapsed = sidebarPreference ?? (isCashier && layout.xs === true);
  const showSidebar = !active && !(isCashier && collapsed && !layout.lg);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    if (!isCashier) setFocusMode(false);
  }, [isCashier]);

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
    <Layout className={isCashier ? styles.cashierShell : undefined}>
      {showSidebar && (
        <Sider
          className={isCashier ? styles.cashierSidebar : undefined}
          trigger={null}
          collapsible
          collapsed={collapsed}
          style={isCashier ? undefined : { height: '100vh' }}
          breakpoint="lg"
          width={SIDER_WITH}
          collapsedWidth={layout.lg ? SIDER_COLLAPSED_WITH : 0}
        >
          <div style={{ height: HEADER_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image
              src={collapsed ? '/logo/logo_icon.png' : '/logo/logo_text.png'}
              alt="logo"
              width={1024}
              height={1024}
              sizes={`${collapsed ? SIDER_COLLAPSED_WITH : SIDER_WITH}px`}
              loading="eager"
              style={{ margin: '12px 0', height: 48, width: '70%', objectFit: 'cover' }}
            />
          </div>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            style={isCashier ? { overflowY: 'auto', maxHeight: 'calc(100% - 64px)' } : { overflowY: 'auto' }}
            items={getMenus(isHaveAccess)}
            onClick={({ key }) => router.push(key)}
          />
        </Sider>
      )}
      <Layout className={isCashier ? styles.cashierMain : undefined}>
        {!active && (
          <Header style={{ padding: 0, background: colorBgContainer, height: HEADER_HEIGHT }} className="flex-between">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
              aria-expanded={!collapsed}
              onClick={() => setSidebarPreference(!collapsed)}
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
        )}
        <Content
          className={isCashier ? styles.cashierContent : undefined}
          style={
            isCashier
              ? undefined
              : {
                  height: `calc(100vh - ${HEADER_HEIGHT + 2 * PADDING_CONTENT}px)`,
                  overflow: 'auto',
                  padding: PADDING_CONTENT,
                }
          }
        >
          <div
            className={isCashier ? styles.cashierPanel : undefined}
            style={
              isCashier
                ? { background: colorBgContainer, borderRadius: borderRadiusLG }
                : {
                    padding: 24,
                    background: colorBgContainer,
                    borderRadius: borderRadiusLG,
                    minHeight: `calc(100vh - ${HEADER_HEIGHT + 2 * PADDING_CONTENT}px)`,
                    minWidth: `calc(100vw - ${(collapsed ? SIDER_COLLAPSED_WITH : SIDER_WITH) + 2 * PADDING_CONTENT}px)`,
                    width: 'fit-content',
                    transition: 'all 0.2s',
                  }
            }
          >
            <DashboardFocusMode.Provider
              value={isCashier ? { active, toggle: () => setFocusMode((previous) => !previous) } : null}
            >
              {!isCashier && layout.xs && !collapsed ? null : children}
            </DashboardFocusMode.Provider>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
