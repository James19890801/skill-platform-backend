/**
 * UserSettings - 用户设置页面
 * 包含记忆管理、知识库管理、模型偏好设置
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Typography,
  List,
  Button,
  Space,
  Tag,
  Empty,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Descriptions,
  Divider,
  Avatar,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  BookOutlined,
  CloudOutlined,
  SettingOutlined,
  ApiOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  status: 'connected' | 'disconnected' | 'syncing';
  source: 'bailian' | 'local';
}

const UserSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('memory');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [addKbModalVisible, setAddKbModalVisible] = useState(false);
  
  const [form] = Form.useForm();
  const [kbForm] = Form.useForm();
  
  // Mock 数据
  const mockMemories: MemoryItem[] = [
    {
      id: 'mem-1',
      key: '用户偏好_语言',
      value: '中文',
      category: 'user_preference',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-15'),
    },
    {
      id: 'mem-2',
      key: '工作偏好_模型',
      value: 'qwen-plus',
      category: 'work_preference',
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
    {
      id: 'mem-3',
      key: '历史任务_流程分析',
      value: '已完成流程分析任务 3 次，主要关注审批流程',
      category: 'task_history',
      createdAt: new Date('2025-01-10'),
      updatedAt: new Date('2025-01-20'),
    },
  ];
  
  const mockKnowledgeBases: KnowledgeBase[] = [
    {
      id: 'kb-1',
      name: '流程管理知识库',
      description: '包含流程设计规范、SOP模板、最佳实践',
      documentCount: 45,
      status: 'connected',
      source: 'bailian',
    },
    {
      id: 'kb-2',
      name: '公司政策文档',
      description: '公司内部政策、规章制度',
      documentCount: 12,
      status: 'connected',
      source: 'bailian',
    },
    {
      id: 'kb-3',
      name: '本地测试库',
      description: '本地测试用知识库',
      documentCount: 3,
      status: 'disconnected',
      source: 'local',
    },
  ];
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      setMemories(mockMemories);
      setKnowledgeBases(mockKnowledgeBases);
    } finally {
      setLoading(false);
    }
  };
  
  // 添加记忆
  const addMemory = () => {
    setEditingMemory(null);
    form.resetFields();
    setEditModalVisible(true);
  };
  
  // 编辑记忆
  const editMemory = (memory: MemoryItem) => {
    setEditingMemory(memory);
    form.setFieldsValue({
      key: memory.key,
      value: memory.value,
      category: memory.category,
    });
    setEditModalVisible(true);
  };
  
  // 保存记忆
  const saveMemory = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingMemory) {
        setMemories(prev => prev.map(m =>
          m.id === editingMemory.id
            ? { ...m, ...values, updatedAt: new Date() }
            : m
        ));
        message.success('记忆已更新');
      } else {
        const newMemory: MemoryItem = {
          id: `mem-${Date.now()}`,
          ...values,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setMemories(prev => [...prev, newMemory]);
        message.success('记忆已添加');
      }
      
      setEditModalVisible(false);
    } catch (error) {
      message.error('保存失败');
    }
  };
  
  // 删除记忆
  const deleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    message.success('记忆已删除');
  };
  
  // 连接知识库
  const connectKb = async (kbId: string) => {
    message.loading('正在连接...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    setKnowledgeBases(prev => prev.map(kb =>
      kb.id === kbId ? { ...kb, status: 'connected' } : kb
    ));
    message.success('知识库已连接');
  };
  
  // 断开知识库
  const disconnectKb = (kbId: string) => {
    setKnowledgeBases(prev => prev.map(kb =>
      kb.id === kbId ? { ...kb, status: 'disconnected' } : kb
    ));
    message.success('知识库已断开');
  };
  
  // 添加知识库
  const addKnowledgeBase = async () => {
    try {
      const values = await kbForm.validateFields();
      const newKb: KnowledgeBase = {
        id: `kb-${Date.now()}`,
        ...values,
        documentCount: 0,
        status: 'disconnected',
      };
      setKnowledgeBases(prev => [...prev, newKb]);
      setAddKbModalVisible(false);
      kbForm.resetFields();
      message.success('知识库已添加');
    } catch (error) {
      message.error('添加失败');
    }
  };
  
  // 记忆管理 Tab
  const MemoryTab = () => (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<PlusOutlined />} onClick={addMemory}>
            添加记忆
          </Button>
          <Button icon={<DatabaseOutlined />}>
            AI 总结记忆
          </Button>
          <Button danger>
            清空所有记忆
          </Button>
        </Space>
      </Card>
      
      {loading ? (
        <Spin />
      ) : memories.length === 0 ? (
        <Empty description="暂无记忆数据" />
      ) : (
        <List
          dataSource={memories}
          renderItem={item => (
            <List.Item
              actions={[
                <Button icon={<EditOutlined />} onClick={() => editMemory(item)} />,
                <Popconfirm
                  title="确定删除此记忆？"
                  onConfirm={() => deleteMemory(item.id)}
                >
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<DatabaseOutlined />} style={{ backgroundColor: '#722ed1' }} />}
                title={item.key}
                description={
                  <div>
                    <Paragraph ellipsis={{ rows: 2 }}>{item.value}</Paragraph>
                    <Space>
                      <Tag color="purple">{item.category}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        更新于 {item.updatedAt.toLocaleDateString()}
                      </Text>
                    </Space>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
      
      {/* 编辑记忆 Modal */}
      <Modal
        title={editingMemory ? '编辑记忆' : '添加记忆'}
        open={editModalVisible}
        onOk={saveMemory}
        onCancel={() => setEditModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="key" label="键名" rules={[{ required: true }]}>
            <Input placeholder="例如：用户偏好_语言" />
          </Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="记忆内容" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'user_preference', label: '用户偏好' },
                { value: 'work_preference', label: '工作偏好' },
                { value: 'task_history', label: '任务历史' },
                { value: 'knowledge', label: '知识积累' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
  
  // 知识库管理 Tab
  const KnowledgeBaseTab = () => (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setAddKbModalVisible(true)}>
            添加知识库
          </Button>
          <Button icon={<CloudOutlined />}>
            从百炼导入
          </Button>
          <Button icon={<ApiOutlined />}>
            API 配置
          </Button>
        </Space>
      </Card>
      
      <List
        dataSource={knowledgeBases}
        renderItem={item => (
          <List.Item
            actions={[
              item.status === 'connected' ? (
                <Button onClick={() => disconnectKb(item.id)}>断开</Button>
              ) : (
                <Button type="primary" onClick={() => connectKb(item.id)}>连接</Button>
              ),
              <Button danger icon={<DeleteOutlined />} />,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  icon={<BookOutlined />}
                  style={{ backgroundColor: item.status === 'connected' ? '#52c41a' : '#8c8c8c' }}
                />
              }
              title={
                <Space>
                  {item.name}
                  <Tag color={item.status === 'connected' ? 'green' : 'default'}>
                    {item.status}
                  </Tag>
                  <Tag>{item.source}</Tag>
                </Space>
              }
              description={
                <div>
                  <Text>{item.description}</Text>
                  <br />
                  <Text type="secondary">文档数量：{item.documentCount}</Text>
                </div>
              }
            />
          </List.Item>
        )}
      />
      
      {/* 添加知识库 Modal */}
      <Modal
        title="添加知识库"
        open={addKbModalVisible}
        onOk={addKnowledgeBase}
        onCancel={() => setAddKbModalVisible(false)}
      >
        <Form form={kbForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="知识库名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="知识库描述" />
          </Form.Item>
          <Form.Item name="source" label="来源" initialValue="bailian">
            <Select
              options={[
                { value: 'bailian', label: '百炼知识库' },
                { value: 'local', label: '本地知识库' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
  
  // 模型偏好 Tab
  const ModelPreferenceTab = () => (
    <Card>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="默认模型">
          <Select
            defaultValue="qwen-plus"
            style={{ width: 200 }}
            options={[
              { value: 'qwen-turbo', label: '通义千问 Turbo' },
              { value: 'qwen-plus', label: '通义千问 Plus' },
              { value: 'qwen-max', label: '通义千问 Max' },
              { value: 'deepseek-v3', label: 'DeepSeek V3' },
            ]}
          />
        </Descriptions.Item>
        <Descriptions.Item label="温度参数">
          <InputNumber min={0} max={1} step={0.1} defaultValue={0.7} />
        </Descriptions.Item>
        <Descriptions.Item label="流式输出">
          <Switch defaultChecked />
        </Descriptions.Item>
        <Descriptions.Item label="自动加载 Skill">
          <Switch defaultChecked />
        </Descriptions.Item>
        <Descriptions.Item label="百炼 API Key">
          <Input.Password value="sk-xxxxx" placeholder="输入 API Key" />
        </Descriptions.Item>
        <Descriptions.Item label="LangSmith 追踪">
          <Switch />
        </Descriptions.Item>
      </Descriptions>
      
      <Divider />
      
      <Button type="primary">保存设置</Button>
    </Card>
  );
  
  // InputNumber 组件（简化版）
  const InputNumber: React.FC<{
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
  }> = ({ min = 0, max = 100, step = 1, defaultValue }) => {
    const [value, setValue] = useState(defaultValue || 0);
    return (
      <Space.Compact>
        <Button onClick={() => setValue(Math.max(min, value - step))}>-</Button>
        <Input
          style={{ width: 60, textAlign: 'center' }}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
        />
        <Button onClick={() => setValue(Math.min(max, value + step))}>+</Button>
      </Space.Compact>
    );
  };
  
  return (
    <div>
      <Title level={4}>用户设置</Title>
      <Paragraph type="secondary">
        管理您的记忆、知识库连接和模型偏好
      </Paragraph>
      
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'memory',
            label: <span><DatabaseOutlined /> 记忆管理</span>,
            children: <MemoryTab />,
          },
          {
            key: 'knowledge',
            label: <span><BookOutlined /> 知识库</span>,
            children: <KnowledgeBaseTab />,
          },
          {
            key: 'model',
            label: <span><SettingOutlined /> 模型偏好</span>,
            children: <ModelPreferenceTab />,
          },
        ]}
      />
    </div>
  );
};

export default UserSettings;