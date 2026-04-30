/**
 * MemoryManager - 记忆管理页面
 * 管理 Agent 的长期记忆
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
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
  List,
  Avatar,
  Spin,
} from 'antd';
import {
  CloudOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { memoriesApi, MemoryDTO, agentsApi, AgentDTO } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const MemoryManager: React.FC = () => {
  const [memories, setMemories] = useState<MemoryDTO[]>([]);
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryDTO | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterAgentId, setFilterAgentId] = useState<number | undefined>();
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 获取记忆列表
  const fetchMemories = async (agentId?: number) => {
    setLoading(true);
    try {
      const data = await memoriesApi.list(agentId);
      setMemories(data || []);
    } catch (error) {
      console.error('获取记忆列表失败:', error);
      message.error('获取记忆列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取 Agent 列表（用于下拉选择）
  const fetchAgents = async () => {
    try {
      const data = await agentsApi.list();
      setAgents(data?.items || []);
    } catch (error) {
      console.error('获取 Agent 列表失败:', error);
    }
  };

  useEffect(() => {
    fetchMemories();
    fetchAgents();
  }, []);

  // 按 Agent 筛选
  const handleAgentFilter = (value: number | undefined) => {
    setFilterAgentId(value);
    fetchMemories(value);
  };

  // 创建记忆
  const handleCreate = async (values: any) => {
    try {
      await memoriesApi.create(values);
      message.success('记忆已添加');
      setAddModalVisible(false);
      form.resetFields();
      fetchMemories(filterAgentId);
    } catch (error) {
      message.error('添加记忆失败');
    }
  };

  // 编辑记忆
  const handleEdit = (item: MemoryDTO) => {
    setEditingMemory(item);
    editForm.setFieldsValue({
      key: item.key,
      value: item.value,
      category: item.category,
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values: any) => {
    if (!editingMemory) return;
    try {
      await memoriesApi.update(editingMemory.id, values);
      message.success('记忆已更新');
      setEditModalVisible(false);
      setEditingMemory(null);
      editForm.resetFields();
      fetchMemories(filterAgentId);
    } catch (error) {
      message.error('更新记忆失败');
    }
  };

  // 删除记忆
  const handleDelete = (item: MemoryDTO) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除记忆 "${item.key}" 吗？`,
      onOk: async () => {
        try {
          await memoriesApi.delete(item.id);
          message.success('记忆已删除');
          fetchMemories(filterAgentId);
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  // 获取 Agent 名称
  const getAgentName = (agentId: number) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || `Agent #${agentId}`;
  };

  const filteredMemories = memories.filter(
    (m) =>
      m.key.toLowerCase().includes(searchText.toLowerCase()) ||
      m.value.toLowerCase().includes(searchText.toLowerCase())
  );

  const getCategoryTag = (category: string) => {
    const config: Record<string, { color: string; text: string }> = {
      preference: { color: 'purple', text: '偏好' },
      fact: { color: 'blue', text: '事实' },
      context: { color: 'orange', text: '上下文' },
    };
    const c = config[category] || { color: 'default', text: category };
    return <Tag color={c.color}>{c.text}</Tag>;
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

      {/* 搜索和筛选 */}
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
            value={filterAgentId}
            onChange={handleAgentFilter}
            allowClear
            options={agents.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Space>
      </Card>

      {/* 记忆列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : filteredMemories.length === 0 ? (
        <Empty description={filterAgentId ? '该 Agent 暂无记忆' : '暂无记忆数据'} />
      ) : (
        <List
          dataSource={filteredMemories}
          renderItem={(item) => (
            <Card style={{ marginBottom: 12, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <Space style={{ marginBottom: 8 }}>
                    <Avatar icon={<RobotOutlined />} size="small" style={{ backgroundColor: '#6366f1' }} />
                    <Text type="secondary">{getAgentName(item.agentId)}</Text>
                    {getCategoryTag(item.category)}
                  </Space>
                  <Title level={5} style={{ marginBottom: 4 }}>{item.key}</Title>
                  <Paragraph style={{ marginBottom: 0, color: '#666' }}>{item.value}</Paragraph>
                  <Space style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>创建：{new Date(item.createdAt).toLocaleString()}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>更新：{new Date(item.updatedAt).toLocaleString()}</Text>
                  </Space>
                </div>
                <Space>
                  <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(item)} />
                  <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(item)} />
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
        onCancel={() => {
          setAddModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Agent" name="agentId" rules={[{ required: true, message: '请选择 Agent' }]}>
            <Select
              placeholder="选择 Agent"
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>
          <Form.Item label="类型" name="category" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              placeholder="选择类型"
              options={[
                { value: 'preference', label: '偏好' },
                { value: 'fact', label: '事实' },
                { value: 'context', label: '上下文' },
              ]}
            />
          </Form.Item>
          <Form.Item label="键" name="key" rules={[{ required: true, message: '请输入键' }]}>
            <Input placeholder="例如：user_preference_language" />
          </Form.Item>
          <Form.Item label="值" name="value" rules={[{ required: true, message: '请输入值' }]}>
            <Input.TextArea placeholder="记忆内容..." rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑记忆弹窗 */}
      <Modal
        title="编辑记忆"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingMemory(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item label="类型" name="category">
            <Select
              placeholder="选择类型"
              options={[
                { value: 'preference', label: '偏好' },
                { value: 'fact', label: '事实' },
                { value: 'context', label: '上下文' },
              ]}
            />
          </Form.Item>
          <Form.Item label="键" name="key" rules={[{ required: true, message: '请输入键' }]}>
            <Input placeholder="例如：user_preference_language" />
          </Form.Item>
          <Form.Item label="值" name="value" rules={[{ required: true, message: '请输入值' }]}>
            <Input.TextArea placeholder="记忆内容..." rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MemoryManager;