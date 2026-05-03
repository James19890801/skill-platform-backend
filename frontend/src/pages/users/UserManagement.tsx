import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Typography,
  Tag,
  Space,
  Spin,
  message,
  Tooltip,
} from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  CrownOutlined,
  ClockCircleOutlined,
  LoginOutlined,
  NumberOutlined,
} from '@ant-design/icons';
import { usersApi } from '../../services/api';
import type { IUser } from '../../types';

const { Title, Text } = Typography;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.list();
      setUsers(data as unknown as IUser[]);
    } catch (error) {
      console.error('加载用户列表失败:', error);
      message.error('加载用户列表失败，请确认您有管理员权限');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      render: (id: number) => (
        <Text style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{id}</Text>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (email: string, record: IUser) => (
        <Space>
          <UserOutlined style={{ color: '#6366f1' }} />
          <Text strong>{email}</Text>
          {record.isAdmin && (
            <Tag icon={<CrownOutlined />} color="gold" style={{ marginLeft: 4 }}>
              管理员
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (phone: string) => (
        <Text style={{ fontFamily: 'monospace' }}>{phone}</Text>
      ),
    },
    {
      title: '登录次数',
      dataIndex: 'loginCount',
      key: 'loginCount',
      width: 100,
      render: (count: number) => (
        <Space>
          <NumberOutlined style={{ color: '#94a3b8' }} />
          <Text strong style={{ color: '#6366f1' }}>{count || 0}</Text>
          次
        </Space>
      ),
    },
    {
      title: '首次登录',
      dataIndex: 'firstLoginAt',
      key: 'firstLoginAt',
      width: 180,
      render: (date: string | null) => date ? (
        <Space>
          <LoginOutlined style={{ color: '#52c41a' }} />
          <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {new Date(date).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Space>
      ) : (
        <Text type="secondary">-</Text>
      ),
    },
    {
      title: '最近登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 180,
      render: (date: string | null) => date ? (
        <Space>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {new Date(date).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Space>
      ) : (
        <Text type="secondary">-</Text>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 13, color: '#94a3b8' }}>
          {new Date(date).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      ),
    },
  ];

  const stats = {
    total: users.length,
    admins: users.filter(u => u.isAdmin).length,
    newToday: users.filter(u => {
      const today = new Date();
      const created = new Date(u.createdAt || '');
      return created.toDateString() === today.toDateString();
    }).length,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8, color: '#6366f1' }} />
          用户管理
        </Title>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderRadius: 8 }}>
          <Space>
            <UserOutlined style={{ fontSize: 20, color: '#6366f1' }} />
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>总用户数</Text>
              <div><Text strong style={{ fontSize: 20, color: '#1e293b' }}>{stats.total}</Text></div>
            </div>
          </Space>
        </Card>
        <Card size="small" style={{ flex: 1, borderRadius: 8 }}>
          <Space>
            <CrownOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>管理员</Text>
              <div><Text strong style={{ fontSize: 20, color: '#1e293b' }}>{stats.admins}</Text></div>
            </div>
          </Space>
        </Card>
        <Card size="small" style={{ flex: 1, borderRadius: 8 }}>
          <Space>
            <LoginOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>今日新增</Text>
              <div><Text strong style={{ fontSize: 20, color: '#1e293b' }}>{stats.newToday}</Text></div>
            </div>
          </Space>
        </Card>
      </div>

      {/* 用户表格 */}
      <Card style={{ borderRadius: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            dataSource={users}
            columns={columns}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个用户`,
            }}
            scroll={{ x: 960 }}
          />
        )}
      </Card>
    </div>
  );
};

export default UserManagement;
