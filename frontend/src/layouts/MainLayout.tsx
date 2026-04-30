import React, { useState } from 'react';
import { Layout, Menu, Typography, Breadcrumb, Button, Space, Drawer, Grid } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  PlusOutlined,
  MessageOutlined,
  ShopOutlined,
  DatabaseOutlined,
  CloudOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

// Agent 平台菜单配置
const menuConfig = [
  {
    groupTitle: null,
    items: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Agent 工作台' },
    ],
  },
  {
    groupTitle: 'Agent 管理',
    items: [
      { key: '/agents/create', icon: <PlusOutlined />, label: '创建 Agent' },
      { key: '/chat', icon: <MessageOutlined />, label: '对话 Canvas' },
    ],
  },
  {
    groupTitle: '资源管理',
    items: [
      { key: '/skills', icon: <ShopOutlined />, label: 'Skill 市场' },
      { key: '/knowledge', icon: <DatabaseOutlined />, label: '知识库' },
      { key: '/memory', icon: <CloudOutlined />, label: '记忆管理' },
    ],
  },
  {
    groupTitle: '系统',
    items: [
      { key: '/settings', icon: <SettingOutlined />, label: '设置' },
    ],
  },
];

// 面包屑映射
const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Agent 工作台',
  '/agents/create': '创建 Agent',
  '/agents/edit': '编辑 Agent',
  '/chat': '对话 Canvas',
  '/skills': 'Skill 市场',
  '/knowledge': '知识库',
  '/memory': '记忆管理',
  '/settings': '设置',
};

// 默认用户信息（免登录）
const defaultUser = {
  name: '访客',
  role: 'guest',
};

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // 扁平化菜单项
  const flatMenuItems = menuConfig.flatMap((group) => group.items);

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    const matched = flatMenuItems.find(
      (item) => path === item.key || path.startsWith(item.key + '/')
    );
    return matched ? matched.key : '/dashboard';
  };

  // 生成面包屑
  const getBreadcrumbItems = () => {
    const path = location.pathname;
    const items: Array<{ title: string; href?: string }> = [{ title: '首页', href: '/dashboard' }];
    
    const segments = path.split('/').filter(Boolean);
    let currentPath = '';
    
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = breadcrumbMap[currentPath];
      if (label) {
        if (index === segments.length - 1) {
          items.push({ title: label });
        } else {
          items.push({ title: label, href: currentPath });
        }
      }
    });
    
    return items;
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    setMobileNavOpen(false);
  };

  // 构建菜单项
  const buildMenuItems = () => {
    const items: any[] = [];
    
    menuConfig.forEach((group, groupIndex) => {
      if (group.groupTitle && !collapsed) {
        items.push({
          key: `group-${groupIndex}`,
          type: 'group',
          label: <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{group.groupTitle}</div>,
        });
      }
      group.items.forEach((item) => {
        items.push({
          key: item.key,
          icon: item.icon,
          label: item.label,
        });
      });
    });
    
    return items;
  };

  // ============ 移动端布局 ============
  if (isMobile) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            height: 56,
            lineHeight: '56px',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={() => setMobileNavOpen(true)}
              style={{ fontSize: 18, color: '#333' }}
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '1px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              E2E AI
            </span>
          </Space>
          <Text style={{ fontSize: 13, color: '#94a3b8' }}>{defaultUser.name}</Text>
        </Header>

        <Drawer
          title={
            <span
              style={{
                fontWeight: 700,
                fontSize: 16,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              E2E AI
            </span>
          }
          placement="left"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          width={280}
        >
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            items={buildMenuItems()}
            onClick={handleMenuClick}
            style={{ borderRight: 'none', marginTop: 8 }}
          />
        </Drawer>

        <Content
          style={{
            padding: 12,
            background: '#f5f5f5',
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    );
  }

  // ============ 桌面端布局 ============
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        collapsedWidth={80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            gap: 10,
          }}
        >
          <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          {!collapsed && (
            <span
              style={{
                color: '#fff',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '2px',
                fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              E2E AI
            </span>
          )}
        </div>

        {/* 菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={buildMenuItems()}
          onClick={handleMenuClick}
          style={{ background: 'transparent', borderRight: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            height: 56,
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Space align="center">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
            <Breadcrumb items={getBreadcrumbItems()} />
          </Space>

          <Text>{defaultUser.name}</Text>
        </Header>

        <Content
          style={{
            margin: 16,
            padding: 20,
            background: '#f5f5f5',
            borderRadius: 12,
            minHeight: 'calc(100vh - 56px - 32px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;