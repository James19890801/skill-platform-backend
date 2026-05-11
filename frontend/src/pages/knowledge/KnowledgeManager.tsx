import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Progress,
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
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeSearchResult,
  knowledgeApi,
} from '../../services/api';

const { Text, Title } = Typography;
const { TextArea } = Input;

const MAX_KNOWLEDGE_UPLOAD_BYTES = 80 * 1024 * 1024;
const LARGE_FILE_WARNING_BYTES = 30 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)}${units[unitIndex]}`;
}

function getUploadErrorMessage(error: any) {
  const status = error?.response?.status || error?.response?.data?.statusCode;
  const serverMessage = error?.response?.data?.message;
  const messageText = Array.isArray(serverMessage) ? serverMessage.join('；') : serverMessage;
  if (status === 413) {
    return messageText || `文件超过当前 ${formatBytes(MAX_KNOWLEDGE_UPLOAD_BYTES)} 上限，请压缩或拆分后重试`;
  }
  if (error?.code === 'ECONNABORTED' || String(error?.message || '').includes('timeout')) {
    return '上传或索引超过 10 分钟仍未完成，请先拆分文档后重试';
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return '当前网络已断开，请恢复网络后重试';
  }
  return messageText || error?.message || '服务暂时没有返回明确原因';
}

const panelStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
};

const KnowledgeManager: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [chunkTotal, setChunkTotal] = useState(0);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [activeChunk, setActiveChunk] = useState<KnowledgeChunk | KnowledgeSearchResult | null>(null);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
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
    const [detail, docs, chunkPage] = await Promise.all([
      knowledgeApi.getById(kbId),
      knowledgeApi.listDocuments(kbId),
      knowledgeApi.listChunks(kbId, { limit: 200 }),
    ]);
    setSelectedKb(detail);
    setDocuments(docs);
    setChunks(chunkPage.items || []);
    setChunkTotal(chunkPage.total || 0);
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
    if (!selectedKb) return Upload.LIST_IGNORE;
    if (file.size > MAX_KNOWLEDGE_UPLOAD_BYTES) {
      message.error(
        `${file.name} 是 ${formatBytes(file.size)}，超过当前单文件上限 ${formatBytes(MAX_KNOWLEDGE_UPLOAD_BYTES)}，请压缩或拆分后上传`,
      );
      return Upload.LIST_IGNORE;
    }

    const messageKey = `knowledge-upload-${file.name}-${file.size}`;
    try {
      setUploadProgress(0);
      setUploadFileName(file.name);
      setUploadPhase('正在上传文件');
      setUploading(true);
      if (file.size >= LARGE_FILE_WARNING_BYTES) {
        message.warning(
          `${file.name} 较大（${formatBytes(file.size)}），支持上传，但解析、切片和向量化可能需要几分钟，请保持页面打开。`,
          8,
        );
      }
      message.loading({ key: messageKey, content: `${file.name} 正在上传...`, duration: 0 });
      await knowledgeApi.uploadDocument(selectedKb.id, file, {
        chunkSize: 1000,
        chunkOverlap: 180,
        timeoutMs: 600000,
        onUploadProgress: ({ percent }) => {
          if (percent !== undefined) {
            setUploadProgress(percent);
            setUploadPhase(percent >= 100 ? '上传完成，正在解析、切片和构建索引' : `正在上传 ${percent}%`);
          }
        },
      });
      message.success({ key: messageKey, content: `${file.name} 已完成索引`, duration: 4 });
      await refreshSelected(selectedKb.id);
    } catch (error) {
      message.error({
        key: messageKey,
        content: `${file.name} 索引失败：${getUploadErrorMessage(error)}`,
        duration: 8,
      });
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setUploadPhase('');
      setUploadFileName('');
    }

    return Upload.LIST_IGNORE;
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
      setSearchResults((result.sources || result.results || []).map((item: any) => ({
        id: item.chunkId || item.id,
        documentId: item.documentId,
        documentName: item.documentName,
        knowledgeBaseName: item.knowledgeBaseName,
        chunkIndex: item.chunkIndex,
        content: item.content || item.preview,
        score: item.score,
        metadata: item.metadata || { sectionTitle: item.sectionTitle },
      })));
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

  const chunkColumns = [
    {
      title: '切片',
      key: 'chunk',
      render: (_: unknown, record: KnowledgeChunk) => (
        <Space direction="vertical" size={3} style={{ maxWidth: 520 }}>
          <Space wrap>
            <Tag color="blue">#{(record.chunkIndex ?? 0) + 1}</Tag>
            <Text strong>{record.documentName || `文档 ${record.documentId}`}</Text>
            {record.metadata?.sectionTitle ? <Tag>{String(record.metadata.sectionTitle)}</Tag> : null}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.content.slice(0, 140)}{record.content.length > 140 ? '...' : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '范围',
      key: 'range',
      width: 120,
      render: (_: unknown, record: KnowledgeChunk) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.metadata?.start ?? '-'} - {record.metadata?.end ?? '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 92,
      render: (_: unknown, record: KnowledgeChunk) => (
        <Button size="small" icon={<FileSearchOutlined />} onClick={() => setActiveChunk(record)}>
          查看
        </Button>
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
                <p className="ant-upload-hint">
                  支持 Word、PPT、Excel、PDF、Markdown、纯文本和结构化文本；单文件上限 {formatBytes(MAX_KNOWLEDGE_UPLOAD_BYTES)}
                </p>
              </Upload.Dragger>
              <Alert
                style={{ marginTop: 12 }}
                type="info"
                showIcon
                message="大文件会先上传，再解析、切片和向量化"
                description={`30MB 以上文件会显示进度；上传到 100% 后仍需等待索引完成。超过 ${formatBytes(MAX_KNOWLEDGE_UPLOAD_BYTES)} 会在本地直接拦截并提示。`}
              />
              {uploading ? (
                <div style={{ marginTop: 12 }}>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Text strong>{uploadFileName}</Text>
                    <Progress percent={uploadProgress ?? 0} status="active" />
                    <Text type="secondary">{uploadPhase || '正在处理'}</Text>
                  </Space>
                </div>
              ) : null}
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
                        title={(
                          <Space wrap>
                            <Tag color="blue">{item.score.toFixed(3)}</Tag>
                            <Text>{item.knowledgeBaseName || selectedKb.name}</Text>
                            <Text type="secondary">{item.documentName || `文档 ${item.documentId}`}</Text>
                            <Tag>#{(item.chunkIndex ?? 0) + 1}</Tag>
                          </Space>
                        )}
                        description={(
                          <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Text style={{ whiteSpace: 'pre-wrap' }}>{item.content}</Text>
                            <Button size="small" icon={<FileSearchOutlined />} onClick={() => setActiveChunk(item)}>
                              查看切片详情
                            </Button>
                          </Space>
                        )}
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

            <Card
              title="切片内容"
              extra={<Tag color="green">{chunkTotal} 片</Tag>}
              style={panelStyle}
            >
              <Table
                dataSource={chunks}
                columns={chunkColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 8 }}
                locale={{ emptyText: <Empty description="暂无切片" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title={activeChunk ? `切片 #${((activeChunk as any).chunkIndex ?? 0) + 1}` : '切片详情'}
        open={Boolean(activeChunk)}
        onCancel={() => setActiveChunk(null)}
        footer={null}
        width={760}
      >
        {activeChunk ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="blue">{(activeChunk as any).knowledgeBaseName || selectedKb?.name || '知识库'}</Tag>
              <Tag>{(activeChunk as any).documentName || `文档 ${(activeChunk as any).documentId}`}</Tag>
              {(activeChunk as any).metadata?.sectionTitle ? <Tag>{String((activeChunk as any).metadata.sectionTitle)}</Tag> : null}
              {typeof (activeChunk as any).score === 'number' ? <Tag color="green">score {(activeChunk as any).score.toFixed(3)}</Tag> : null}
            </Space>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 16,
                maxHeight: 420,
                overflow: 'auto',
                lineHeight: 1.7,
              }}
            >
              {(activeChunk as any).content || (activeChunk as any).preview}
            </div>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
};

export default KnowledgeManager;
