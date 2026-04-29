import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Space, Typography, Breadcrumb, Button, Tag } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  PlusOutlined,
  MessageOutlined,
  ShopOutlined,
  DatabaseOutlined,
  CloudOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  SwapOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

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

// 管理员菜单配置
const adminMenuConfig = [
  {
    groupTitle: '管理员',
    items: [
      { key: '/admin/agents', icon: <AppstoreOutlined />, label: '所有 Agent' },
      { key: '/admin/knowledge', icon: <DatabaseOutlined />, label: '所有知识库' },
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

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tenant, logout } = useAuthStore();

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
    // 处理管理员菜单项
    if (key.startsWith('/admin/')) {
      // 对于管理员菜单，重定向到相应的管理页面
      if (key === '/admin/agents') {
        navigate('/agents'); // 管理员查看所有agent的页面（已在agents页面实现权限控制）
      } else if (key === '/admin/knowledge') {
        navigate('/knowledge'); // 管理员查看所有知识库的页面（已在knowledge页面实现权限控制）
      }
    } else {
      navigate(key);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user?.role === 'admin' ? '管理员' : '用户'}
          </Text>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'switch',
      icon: <SwapOutlined />,
      label: '切换用户',
      onClick: () => { logout(); navigate('/login'); },
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ];

  // 构建菜单项
  const buildMenuItems = () => {
    const items: any[] = [];
    
    // 添加普通菜单项
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
    
    // 如果是管理员，添加管理员菜单项
    if (user?.role === 'admin' || user?.role === 'super-admin') {
      adminMenuConfig.forEach((group, groupIndex) => {
        if (group.groupTitle && !collapsed) {
          items.push({
            key: `admin-group-${groupIndex}`,
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
    }
    
    return items;
  };

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
            {tenant?.name && (
              <Tag color="purple" style={{ marginLeft: 12 }}>{tenant.name}</Tag>
            )}
          </Space>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#6366f1' }}
              />
              <Text>{user?.name || '用户'}</Text>
            </Space>
          </Dropdown>
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