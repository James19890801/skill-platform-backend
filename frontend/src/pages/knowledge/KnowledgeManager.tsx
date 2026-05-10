import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  DatabaseOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeSearchResult,
  knowledgeApi,
} from '../../services/api';

const { Text, Title } = Typography;
const { TextArea } = Input;

const panelStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
};

const KnowledgeManager: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [textIndexing, setTextIndexing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [createForm] = Form.useForm();
  const [textForm] = Form.useForm();
  const [searchForm] = Form.useForm();

  const stats = useMemo(() => {
    const docs = knowledgeBases.reduce((sum, kb) => sum + (kb.documentCount || 0), 0);
    const chunks = knowledgeBases.reduce((sum, kb) => sum + (kb.chunkCount || 0), 0);
    return { docs, chunks };
  }, [knowledgeBases]);

  const fetchKnowledgeBases = async () => {
    try {
      setLoading(true);
      const data = await knowledgeApi.list();
      setKnowledgeBases(data || []);
    } catch {
      message.error('知识库加载失败');
    } finally {
      setLoading(false);
    }
  };

  const refreshSelected = async (kbId: number) => {
    const [detail, docs] = await Promise.all([
      knowledgeApi.getById(kbId),
      knowledgeApi.listDocuments(kbId),
    ]);
    setSelectedKb(detail);
    setDocuments(docs);
    await fetchKnowledgeBases();
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const handleCreate = async (values: { name: string; description?: string }) => {
    try {
      const kb = await knowledgeApi.create({
        ...values,
        source: 'local',
      });
      message.success('知识库已创建');
      setCreateOpen(false);
      createForm.resetFields();
      await fetchKnowledgeBases();
      setSelectedKb(kb);
      setDrawerOpen(true);
      await refreshSelected(kb.id);
    } catch {
      message.error('创建失败');
    }
  };

  const openWorkbench = async (kb: KnowledgeBase) => {
    setSelectedKb(kb);
    setDrawerOpen(true);
    setSearchResults([]);
    await refreshSelected(kb.id);
  };

  const handleUpload = async (file: File) => {
    if (!selectedKb) return false;

    try {
      setUploading(true);
      await knowledgeApi.uploadDocument(selectedKb.id, file, {
        chunkSize: 1000,
        chunkOverlap: 180,
      });
      message.success(`${file.name} 已完成索引`);
      await refreshSelected(selectedKb.id);
    } catch {
      message.error(`${file.name} 索引失败`);
    } finally {
      setUploading(false);
    }

    return false;
  };

  const handleTextIngest = async () => {
    if (!selectedKb) return;

    try {
      const values = await textForm.validateFields();
      setTextIndexing(true);
      await knowledgeApi.ingestText(selectedKb.id, {
        name: values.name || '文本知识.txt',
        content: values.content,
        chunkSize: 1000,
        chunkOverlap: 180,
      });
      message.success('文本已完成索引');
      textForm.resetFields();
      await refreshSelected(selectedKb.id);
    } catch (error: any) {
      if (!error?.errorFields) message.error('文本索引失败');
    } finally {
      setTextIndexing(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedKb) return;

    try {
      const values = await searchForm.validateFields();
      setSearching(true);
      const result = await knowledgeApi.search(selectedKb.id, {
        query: values.query,
        topK: 5,
      });
      setSearchResults(result.results || []);
    } catch (error: any) {
      if (!error?.errorFields) message.error('检索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '删除知识库',
      content: '知识库、文档和切片都会删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        await knowledgeApi.delete(id);
        message.success('已删除');
        if (selectedKb?.id === id) {
          setDrawerOpen(false);
          setSelectedKb(null);
        }
        await fetchKnowledgeBases();
      },
    });
  };

  const columns = [
    {
      title: '知识库',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: KnowledgeBase) => (
        <Space direction="vertical" size={2}>
          <Space>
            <DatabaseOutlined style={{ color: '#2563eb' }} />
            <Text strong>{name}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description || '本地文档知识库'}</Text>
        </Space>
      ),
    },
    {
      title: '索引',
      key: 'index',
      render: (_: unknown, record: KnowledgeBase) => (
        <Space>
          <Tag color="blue">{record.documentCount || 0} 文档</Tag>
          <Tag color="green">{record.chunkCount || 0} 切片</Tag>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: KnowledgeBase['status']) => (
        <Tag color={status === 'error' ? 'red' : status === 'syncing' ? 'gold' : 'green'}>
          {status === 'error' ? '异常' : status === 'syncing' ? '处理中' : '可检索'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: KnowledgeBase) => (
        <Space>
          <Button icon={<FileSearchOutlined />} onClick={() => openWorkbench(record)}>
            管理
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  const docColumns = [
    {
      title: '文件',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Space><FileTextOutlined />{name}</Space>,
    },
    {
      title: '切片',
      dataIndex: 'chunkCount',
      key: 'chunkCount',
      width: 90,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: KnowledgeDocument['status']) => (
        <Tag color={status === 'error' ? 'red' : status === 'processing' ? 'gold' : 'green'}>
          {status === 'error' ? '失败' : status === 'processing' ? '处理中' : '已索引'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f6f8fb', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>知识库</Title>
          <Text type="secondary">离线文档解析、自动切片、语义检索和 Agent 引用</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建知识库
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card style={panelStyle}>
            <Text type="secondary">知识库</Text>
            <Title level={2} style={{ margin: '8px 0 0' }}>{knowledgeBases.length}</Title>
          </Card>
        </Col>
        <Col span={8}>
          <Card style={panelStyle}>
            <Text type="secondary">已索引文档</Text>
            <Title level={2} style={{ margin: '8px 0 0' }}>{stats.docs}</Title>
          </Card>
        </Col>
        <Col span={8}>
          <Card style={panelStyle}>
            <Text type="secondary">可检索切片</Text>
            <Title level={2} style={{ margin: '8px 0 0' }}>{stats.chunks}</Title>
          </Card>
        </Col>
      </Row>

      <Card style={panelStyle}>
        <Table
          dataSource={knowledgeBases}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="暂无知识库" /> }}
        />
      </Card>

      <Modal
        title="新建知识库"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：合同制度库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="知识库的覆盖范围" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>创建</Button>
        </Form>
      </Modal>

      <Drawer
        title={selectedKb?.name || '知识库工作台'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={920}
      >
        {selectedKb ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="上传文档" style={panelStyle}>
              <Upload.Dragger
                multiple
                showUploadList={false}
                beforeUpload={(file) => handleUpload(file as File)}
                disabled={uploading}
                accept=".pdf,.docx,.pptx,.xlsx,.xls,.txt,.md,.csv,.json,.html,.xml,.yaml,.yml"
              >
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">拖拽或选择文件</p>
                <p className="ant-upload-hint">支持 Word、PPT、Excel、PDF、Markdown、纯文本和结构化文本</p>
              </Upload.Dragger>
            </Card>

            <Card title="写入文本" style={panelStyle}>
              <Form form={textForm} layout="vertical">
                <Form.Item name="name" label="标题">
                  <Input placeholder="例如：客服 SOP" />
                </Form.Item>
                <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
                  <TextArea rows={5} placeholder="粘贴制度、FAQ、流程说明或业务资料" />
                </Form.Item>
                <Button icon={<UploadOutlined />} loading={textIndexing} onClick={handleTextIngest}>
                  写入知识库
                </Button>
              </Form>
            </Card>

            <Card title="检索测试" style={panelStyle}>
              <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
                <Form.Item name="query" rules={[{ required: true, message: '请输入问题' }]} style={{ flex: 1 }}>
                  <Input placeholder="输入一个问题，检查召回内容" />
                </Form.Item>
                <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
                  检索
                </Button>
              </Form>
              {searchResults.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无检索结果" />
              ) : (
                <List
                  dataSource={searchResults}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={<Space><Tag color="blue">{item.score.toFixed(3)}</Tag><Text>切片 #{item.id}</Text></Space>}
                        description={<Text style={{ whiteSpace: 'pre-wrap' }}>{item.content}</Text>}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <Card title="文档索引" style={panelStyle}>
              <Table
                dataSource={documents}
                columns={docColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 6 }}
                locale={{ emptyText: <Empty description="暂无文档" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default KnowledgeManager;
