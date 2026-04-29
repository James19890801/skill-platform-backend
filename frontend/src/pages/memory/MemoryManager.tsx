/**
 * MemoryManager - 记忆管理页面
 * 管理 Agent 的长期记忆
 */
import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Typography,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Empty,
  Descriptions,
  List,
  Avatar,
} from 'antd';
import {
  CloudOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  RobotOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface MemoryItem {
  id: string;
  agentId: string;
  agentName: string;
  key: string;
  value: string;
  category: 'preference' | 'fact' | 'context';
  createdAt: string;
  updatedAt: string;
}

const mockMemories: MemoryItem[] = [
  {
    id: 'mem-1',
    agentId: 'agent-1',
    agentName: '流程分析助手',
    key: 'user_preference_format',
    value: '用户偏好 JSON 格式的输出结果',
    category: 'preference',
    createdAt: '2024-03-10',
    updatedAt: '2024-03-20',
  },
  {
    id: 'mem-2',
    agentId: 'agent-1',
    agentName: '流程分析助手',
    key: 'company_name',
    value: '用户所在公司：ABC科技',
    category: 'fact',
    createdAt: '2024-03-15',
    updatedAt: '2024-03-15',
  },
  {
    id: 'mem-3',
    agentId: 'agent-2',
    agentName: '数据分析专家',
    key: 'last_task_context',
    value: '上次任务：分析销售数据，输出趋势报告',
    category: 'context',
    createdAt: '2024-03-25',
    updatedAt: '2024-03-25',
  },
];

const MemoryManager: React.FC = () => {
  const [memories, setMemories] = useState<MemoryItem[]>(mockMemories);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const filteredMemories = memories.filter(
    (m) => m.key.includes(searchText) || m.value.includes(searchText) || m.agentName.includes(searchText)
  );

  const handleAddMemory = () => {
    message.success('记忆已添加');
    setAddModalVisible(false);
  };

  const getCategoryTag = (category: MemoryItem['category']) => {
    const config = {
      preference: { color: 'purple', text: '偏好' },
      fact: { color: 'blue', text: '事实' },
      context: { color: 'orange', text: '上下文' },
    };
    return <Tag color={config[category].color}>{config[category].text}</Tag>;
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 头部 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Title level={3}>
            <CloudOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            记忆管理
          </Title>
          <Text type="secondary">管理 Agent 的长期记忆，包括用户偏好、关键事实和对话上下文</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)} style={{ background: '#6366f1' }}>
          添加记忆
        </Button>
      </div>

      {/* 搜索 */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space>
          <Input
            placeholder="搜索记忆..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            placeholder="选择 Agent"
            style={{ width: 200 }}
            options={[
              { value: 'agent-1', label: '流程分析助手' },
              { value: 'agent-2', label: '数据分析专家' },
            ]}
            allowClear
          />
        </Space>
      </Card>

      {/* 记忆列表 */}
      {filteredMemories.length === 0 ? (
        <Empty description="暂无记忆数据" />
      ) : (
        <List
          dataSource={filteredMemories}
          renderItem={(item) => (
            <Card style={{ marginBottom: 12, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <Space style={{ marginBottom: 8 }}>
                    <Avatar icon={<RobotOutlined />} size="small" style={{ backgroundColor: '#6366f1' }} />
                    <Text type="secondary">{item.agentName}</Text>
                    {getCategoryTag(item.category)}
                  </Space>
                  <Title level={5} style={{ marginBottom: 4 }}>{item.key}</Title>
                  <Paragraph style={{ marginBottom: 0, color: '#666' }}>{item.value}</Paragraph>
                  <Space style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>创建：{item.createdAt}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>更新：{item.updatedAt}</Text>
                  </Space>
                </div>
                <Space>
                  <Button icon={<EditOutlined />} size="small" />
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Space>
              </div>
            </Card>
          )}
        />
      )}

      {/* 添加记忆弹窗 */}
      <Modal
        title="添加记忆"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddMemory}
      >
        <Form layout="vertical">
          <Form.Item label="Agent" name="agentId" rules={[{ required: true }]}>
            <Select
              placeholder="选择 Agent"
              options={[
                { value: 'agent-1', label: '流程分析助手' },
                { value: 'agent-2', label: '数据分析专家' },
              ]}
            />
          </Form.Item>
          <Form.Item label="类型" name="category" rules={[{ required: true }]}>
            <Select
              placeholder="选择类型"
              options={[
                { value: 'preference', label: '偏好' },
                { value: 'fact', label: '事实' },
                { value: 'context', label: '上下文' },
              ]}
            />
          </Form.Item>
          <Form.Item label="键" name="key" rules={[{ required: true }]}>
            <Input placeholder="例如：user_preference_language" />
          </Form.Item>
          <Form.Item label="值" name="value" rules={[{ required: true }]}>
            <Input.TextArea placeholder="记忆内容..." rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MemoryManager;