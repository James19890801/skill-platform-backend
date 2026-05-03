/**
 * KnowledgeManager - 知识库管理页面
 * 管理百炼知识库的连接和文档
 */
import React, { useState, useEffect } from 'react';
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
  message,
  Empty,
  Select,
} from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  LinkOutlined,
  FileOutlined,
  SyncOutlined,
  DeleteOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import { KnowledgeBase, CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest } from '../../services/api';
import { knowledgeApi } from '../../services/api';

const { Title, Text } = Typography;

const KnowledgeManager: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [form] = Form.useForm();
  const [syncForm] = Form.useForm();

  // 获取知识库列表
  const fetchKnowledgeBases = async () => {
    try {
      setLoading(true);
      const data = await knowledgeApi.list();
      setKnowledgeBases(data || []);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      message.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const handleSync = async () => {
    try {
      const values = await syncForm.validateFields();
      // 调用知识库同步 API
      await knowledgeApi.sync({
        apiKey: values.apiKey,
        kbId: values.kbId,
      });
      message.success('知识库同步任务已提交');
      setSyncModalVisible(false);
      syncForm.resetFields();
      fetchKnowledgeBases();
    } catch (error: any) {
      if (error.errorFields) return; // 表单校验失败
      message.error('提交同步任务失败');
      console.error('Sync error:', error);
    }
  };

  const handleCreate = async (values: CreateKnowledgeBaseRequest) => {
    try {
      const data = await knowledgeApi.create(values);
      message.success('创建知识库成功');
      setCreateModalVisible(false);
      form.resetFields();
      fetchKnowledgeBases(); // 刷新列表
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      message.error('创建知识库失败');
    }
  };

  const handleUpdate = async (values: UpdateKnowledgeBaseRequest) => {
    if (!editingKnowledgeBase) return;
    
    try {
      const data = await knowledgeApi.update(editingKnowledgeBase.id, values);
      message.success('更新知识库成功');
      setEditModalVisible(false);
      form.resetFields();
      fetchKnowledgeBases(); // 刷新列表
    } catch (error) {
      console.error('Error updating knowledge base:', error);
      message.error('更新知识库失败');
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个知识库吗？此操作不可恢复。',
      onOk: async () => {
        try {
          await knowledgeApi.delete(id);
          message.success('删除成功');
          fetchKnowledgeBases(); // 刷新列表
        } catch (error) {
          console.error('Error deleting knowledge base:', error);
          message.error('删除失败');
        }
      },
    });
  };

  const handleEditClick = (record: KnowledgeBase) => {
    setEditingKnowledgeBase(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      source: record.source,
      status: record.status,
    });
    setEditModalVisible(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: KnowledgeBase) => (
        <Space>
          <DatabaseOutlined style={{ color: '#6366f1' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => description || '-',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (source: KnowledgeBase['source']) => (
        <Tag color={
          source === 'bailian' ? 'purple' :
          source === 'local' ? 'blue' :
          source === 'web' ? 'geekblue' : 'orange'
        }>
          {source === 'bailian' ? '百炼' : 
           source === 'local' ? '本地' : 
           source === 'web' ? '网页' : '文件'}
        </Tag>
      ),
    },
    {
      title: '文档数',
      dataIndex: 'documentCount',
      key: 'documentCount',
      render: (count: number) => `${count} 篇`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: KnowledgeBase['status']) => {
        const config = {
          connected: { color: 'green', text: '已连接' },
          syncing: { color: 'blue', text: '同步中' },
          error: { color: 'red', text: '异常' },
        };
        return <Tag color={config[status].color}>{config[status].text}</Tag>;
      },
    },
    {
      title: '创建者',
      dataIndex: ['user', 'name'],
      key: 'creator',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: KnowledgeBase) => (
        <Space>
          <Button 
            icon={<SyncOutlined />} 
            size="small" 
            onClick={() => setSyncModalVisible(true)}
            disabled={record.source !== 'bailian'}
          >
            同步
          </Button>
          <Button 
            icon={<LinkOutlined />} 
            size="small" 
            onClick={() => handleEditClick(record)}
          >
            编辑
          </Button>
          <Button 
            icon={<DeleteOutlined />} 
            size="small" 
            danger 
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 头部 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Title level={3}>
            <DatabaseOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            知识库管理
          </Title>
          <Text type="secondary">连接和管理知识库，为 Agent 提供知识支持</Text>
        </div>
        <Space>
          <Button icon={<LinkOutlined />} onClick={() => setSyncModalVisible(true)}>
            连接百炼 KB
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            style={{ background: '#6366f1' }}
            onClick={() => setCreateModalVisible(true)}
          >
            新建知识库
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Space style={{ marginBottom: 24 }}>
        <Card style={{ borderRadius: 12, width: 180 }}>
          <div style={{ textAlign: 'center' }}>
            <CloudOutlined style={{ fontSize: 32, color: '#6366f1' }} />
            <Title level={4} style={{ marginBottom: 0 }}>{knowledgeBases.length}</Title>
            <Text type="secondary">知识库</Text>
          </div>
        </Card>
        <Card style={{ borderRadius: 12, width: 180 }}>
          <div style={{ textAlign: 'center' }}>
            <FileOutlined style={{ fontSize: 32, color: '#10b981' }} />
            <Title level={4} style={{ marginBottom: 0 }}>
              {knowledgeBases.reduce((sum, kb) => sum + kb.documentCount, 0)}
            </Title>
            <Text type="secondary">文档</Text>
          </div>
        </Card>
      </Space>

      {/* 知识库列表 */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={knowledgeBases}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 创建知识库弹窗 */}
      <Modal
        title="新建知识库"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="输入知识库名称" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea placeholder="输入知识库描述" />
          </Form.Item>
          <Form.Item
            label="来源"
            name="source"
          >
            <Select defaultValue="local">
              <Select.Option value="local">本地</Select.Option>
              <Select.Option value="bailian">百炼</Select.Option>
              <Select.Option value="web">网页</Select.Option>
              <Select.Option value="file">文件</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              创建知识库
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑知识库弹窗 */}
      <Modal
        title="编辑知识库"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingKnowledgeBase(null);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="输入知识库名称" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea placeholder="输入知识库描述" />
          </Form.Item>
          <Form.Item
            label="来源"
            name="source"
          >
            <Select>
              <Select.Option value="local">本地</Select.Option>
              <Select.Option value="bailian">百炼</Select.Option>
              <Select.Option value="web">网页</Select.Option>
              <Select.Option value="file">文件</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
          >
            <Select>
              <Select.Option value="connected">已连接</Select.Option>
              <Select.Option value="syncing">同步中</Select.Option>
              <Select.Option value="error">异常</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              更新知识库
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 同步弹窗 */}
      <Modal
        title="连接百炼知识库"
        open={syncModalVisible}
        onCancel={() => setSyncModalVisible(false)}
        onOk={handleSync}
      >
        <Form form={syncForm} layout="vertical">
          <Form.Item label="百炼 API Key" name="apiKey">
            <Input.Password placeholder="输入百炼 API Key" />
          </Form.Item>
          <Form.Item label="知识库 ID" name="kbId">
            <Input placeholder="输入百炼知识库 ID" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgeManager;