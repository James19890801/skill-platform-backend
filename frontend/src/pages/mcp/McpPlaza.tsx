import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Segmented,
  Space,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { McpCategory, McpMarketplaceResponse, McpServerConfig, McpTransport, mcpApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const categoryLabels: Record<McpCategory, string> = {
  files: '文件',
  web: '联网',
  data: '数据',
  memory: '记忆',
  dev: '研发',
  custom: '自定义',
};

const sourceLabels: Record<string, string> = {
  marketplace: '内置推荐',
  registered: '已注册',
  manual: '手动',
  json: 'JSON',
};

const transportOptions: Array<{ value: McpTransport; label: string }> = [
  { value: 'stdio', label: 'stdio' },
  { value: 'streamable_http', label: 'Streamable HTTP' },
  { value: 'sse', label: 'SSE' },
];

function splitList(value?: string): string[] {
  const raw = value?.trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('数组字段需要是 JSON 数组');
    return parsed.map((item) => String(item)).filter(Boolean);
  }
  return raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function parseRecord(value?: string): Record<string, string> | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('环境变量和请求头需要是 JSON 对象');
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([key, val]) => [key, val === undefined || val === null ? '' : String(val)]),
  );
}

function formatEndpoint(server: McpServerConfig): string {
  if (server.transport === 'stdio') {
    return [server.command, ...(server.args || [])].filter(Boolean).join(' ');
  }
  return server.url || '未填写 URL';
}

function exportConfig(server: McpServerConfig) {
  const config: Record<string, unknown> = {
    transport: server.transport,
    description: server.description,
  };
  if (server.transport === 'stdio') {
    config.command = server.command;
    config.args = server.args || [];
    if (server.env && Object.keys(server.env).length > 0) config.env = server.env;
  } else {
    config.url = server.url;
    if (server.headers && Object.keys(server.headers).length > 0) config.headers = server.headers;
  }
  return {
    mcpServers: {
      [server.id || server.name]: config,
    },
  };
}

const McpPlaza: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [jsonForm] = Form.useForm();
  const transport = (Form.useWatch('transport', form) || 'stdio') as McpTransport;
  const [marketplace, setMarketplace] = useState<McpMarketplaceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState<'all' | McpCategory>('all');
  const [source, setSource] = useState<'all' | 'marketplace' | 'registered'>('all');

  const loadMarketplace = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mcpApi.marketplace();
      setMarketplace(data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '加载 MCP 广场失败');
      setMarketplace({ items: [], transports: ['stdio', 'streamable_http', 'sse'], jsonExample: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace]);

  const items = marketplace?.items || [];
  const categories = marketplace?.categories?.length
    ? marketplace.categories
    : (Object.keys(categoryLabels) as McpCategory[]).map((value) => ({
      value,
      label: categoryLabels[value],
      count: items.filter((item) => item.category === value).length,
    }));

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return items.filter((item) => {
      const matchedKeyword = !keyword || [
        item.name,
        item.description,
        item.package,
        item.referenceUrl,
        ...(item.capabilities || []),
      ].some((value) => String(value || '').toLowerCase().includes(keyword));
      const matchedCategory = category === 'all' || item.category === category;
      const matchedSource = source === 'all' || item.source === source;
      return matchedKeyword && matchedCategory && matchedSource;
    });
  }, [category, items, searchText, source]);

  const stats = useMemo(() => {
    const stdioCount = items.filter((item) => item.transport === 'stdio').length;
    const remoteCount = items.filter((item) => item.transport !== 'stdio').length;
    return {
      total: marketplace?.total ?? items.length,
      builtIn: marketplace?.builtInCount ?? items.filter((item) => item.source === 'marketplace').length,
      registered: marketplace?.registeredCount ?? items.filter((item) => item.source === 'registered').length,
      stdioCount,
      remoteCount,
    };
  }, [items, marketplace]);

  const openRegister = () => {
    form.resetFields();
    form.setFieldsValue({ category: 'custom', transport: 'stdio' });
    setRegisterOpen(true);
  };

  const handleRegister = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const config: McpServerConfig = {
        name: values.name,
        description: values.description,
        category: values.category,
        transport: values.transport,
        capabilities: splitList(values.capabilitiesText),
        package: values.package,
        referenceUrl: values.referenceUrl,
        source: 'registered',
      };

      if (values.transport === 'stdio') {
        config.command = values.command;
        config.args = splitList(values.argsText);
        config.env = parseRecord(values.envJson);
      } else {
        config.url = values.url;
        config.headers = parseRecord(values.headersJson);
      }

      await mcpApi.register({ config });
      message.success('MCP 已注册到广场');
      setRegisterOpen(false);
      await loadMarketplace();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || error?.message || '注册 MCP 失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleJsonRegister = async () => {
    try {
      const values = await jsonForm.validateFields();
      setSaving(true);
      const result = await mcpApi.register({ json: values.json });
      message.success(`已注册 ${result.total} 个 MCP`);
      setJsonOpen(false);
      jsonForm.resetFields();
      await loadMarketplace();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || error?.message || 'JSON 注册失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (server: McpServerConfig) => {
    if (!server.id) return;
    try {
      await mcpApi.deleteRegistered(server.id);
      message.success('已从 MCP 广场移除');
      await loadMarketplace();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '删除失败');
    }
  };

  const copyServer = async (server: McpServerConfig) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportConfig(server), null, 2));
      message.success('MCP 配置已复制');
    } catch {
      message.error('复制失败，请检查浏览器权限');
    }
  };

  const renderServerCard = (server: McpServerConfig) => {
    const endpoint = formatEndpoint(server);
    const isRegistered = server.source === 'registered';

    return (
      <Col xs={24} md={12} xl={8} key={server.id || server.name}>
        <Card
          hoverable
          style={{ height: '100%', borderRadius: 8, borderColor: isRegistered ? '#b7eb8f' : '#e5e7eb' }}
          bodyStyle={{ minHeight: 228, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Space size={6} wrap>
                <Text strong style={{ fontSize: 16 }}>{server.name}</Text>
                <Tag color={server.transport === 'stdio' ? 'geekblue' : 'cyan'}>{server.transport}</Tag>
                <Tag color={isRegistered ? 'green' : 'blue'}>{sourceLabels[server.source || 'marketplace'] || server.source}</Tag>
              </Space>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                {categoryLabels[server.category || 'custom'] || '自定义'}
                {server.package ? ` · ${server.package}` : ''}
              </Text>
            </div>
            <ApiOutlined style={{ color: isRegistered ? '#389e0d' : '#2563eb', fontSize: 20, marginTop: 2 }} />
          </div>

          <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, color: '#475569', minHeight: 44 }}>
            {server.description || '暂无描述'}
          </Paragraph>

          <Tooltip title={endpoint}>
            <Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
              <LinkOutlined /> {endpoint}
            </Text>
          </Tooltip>

          <Space wrap size={[4, 4]} style={{ minHeight: 28 }}>
            {(server.capabilities || []).slice(0, 4).map((capability) => (
              <Tag key={capability} style={{ marginRight: 0 }}>{capability}</Tag>
            ))}
            {(server.requires || []).slice(0, 2).map((requirement) => (
              <Tag key={requirement} color="orange" style={{ marginRight: 0 }}>{requirement}</Tag>
            ))}
          </Space>

          <Space wrap style={{ marginTop: 'auto' }}>
            <Button size="small" type="primary" icon={<RobotOutlined />} onClick={() => navigate(`/agents/create?mcp=${encodeURIComponent(server.id || server.name)}`)}>
              配置到 Agent
            </Button>
            <Button size="small" icon={<CopyOutlined />} onClick={() => copyServer(server)}>
              复制 JSON
            </Button>
            {server.referenceUrl && (
              <Button size="small" href={server.referenceUrl} target="_blank">
                文档
              </Button>
            )}
            {isRegistered && (
              <Popconfirm title="从 MCP 广场移除此配置？" onConfirm={() => handleDelete(server)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        </Card>
      </Col>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ApiOutlined style={{ marginRight: 8, color: '#2563eb' }} />
            MCP 广场
          </Title>
          <Text type="secondary">统一呈现内置 MCP 与团队注册 MCP，Agent 配置时可直接装配。</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadMarketplace} loading={loading}>刷新</Button>
          <Button icon={<CodeOutlined />} onClick={() => setJsonOpen(true)}>JSON 注册</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openRegister}>注册 MCP</Button>
        </Space>
      </div>

      <Alert
        showIcon
        type="info"
        icon={<SafetyCertificateOutlined />}
        style={{ borderRadius: 8, marginBottom: 16 }}
        message="MCP 配置会作为 Agent 能力上下文保存"
        description="广场负责注册和呈现连接配置；运行时真正执行 stdio、HTTP 或 SSE 连接前，仍会按部署环境和权限策略校验。"
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><div className="mcp-stat-tile"><Statistic title="全部 MCP" value={stats.total} /></div></Col>
        <Col xs={12} md={6}><div className="mcp-stat-tile"><Statistic title="内置推荐" value={stats.builtIn} /></div></Col>
        <Col xs={12} md={6}><div className="mcp-stat-tile"><Statistic title="已注册" value={stats.registered} /></div></Col>
        <Col xs={12} md={6}><div className="mcp-stat-tile"><Statistic title="远程连接" value={stats.remoteCount} suffix={`/ ${stats.stdioCount} stdio`} /></div></Col>
      </Row>

      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
      }}>
        <Space size={12} wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索名称、能力、包名"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ width: 260 }}
          />
          <Select
            value={category}
            onChange={setCategory}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '全部分类' },
              ...categories.map((item) => ({ value: item.value, label: `${item.label} (${item.count})` })),
            ]}
          />
          <Segmented
            value={source}
            onChange={(value) => setSource(value as 'all' | 'marketplace' | 'registered')}
            options={[
              { value: 'all', label: '全部' },
              { value: 'marketplace', label: '内置' },
              { value: 'registered', label: '已注册' },
            ]}
          />
        </Space>
      </div>

      {loading ? (
        <div style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
          <Spin />
        </div>
      ) : filteredItems.length === 0 ? (
        <Empty description="暂无匹配 MCP" />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredItems.map(renderServerCard)}
        </Row>
      )}

      <Modal
        title="注册 MCP"
        open={registerOpen}
        onOk={handleRegister}
        onCancel={() => setRegisterOpen(false)}
        okText="注册"
        cancelText="取消"
        confirmLoading={saving}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ category: 'custom', transport: 'stdio' }}>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 MCP 名称' }]}>
                <Input placeholder="例如：CRM 数据连接" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                <Select options={(Object.keys(categoryLabels) as McpCategory[]).map((value) => ({ value, label: categoryLabels[value] }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="这个 MCP 能为 Agent 提供什么数据或工具" />
          </Form.Item>
          <Form.Item name="transport" label="transport" rules={[{ required: true }]}>
            <Segmented options={transportOptions} />
          </Form.Item>

          {transport === 'stdio' ? (
            <>
              <Form.Item name="command" label="启动命令" rules={[{ required: true, message: '请输入启动命令' }]}>
                <Input placeholder="npx / uvx / python" />
              </Form.Item>
              <Form.Item name="argsText" label="参数">
                <Input.TextArea rows={3} placeholder={'每行一个参数，例如：\n-y\n@modelcontextprotocol/server-filesystem\n/path/to/workspace'} />
              </Form.Item>
              <Form.Item name="envJson" label="环境变量 JSON">
                <Input.TextArea rows={3} placeholder={'{ "API_KEY": "${API_KEY}" }'} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="url" label="服务 URL" rules={[{ required: true, message: '请输入服务 URL' }]}>
                <Input placeholder="https://example.com/mcp" />
              </Form.Item>
              <Form.Item name="headersJson" label="请求头 JSON">
                <Input.TextArea rows={3} placeholder={'{ "Authorization": "Bearer ${TOKEN}" }'} />
              </Form.Item>
            </>
          )}

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="package" label="包名 / 项目">
                <Input placeholder="@modelcontextprotocol/server-filesystem" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="referenceUrl" label="文档链接">
                <Input placeholder="https://github.com/..." />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="capabilitiesText" label="能力标签">
            <Input.TextArea rows={2} placeholder="每行一个或逗号分隔，例如：crm.read, opportunity.search" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="JSON 注册 MCP"
        open={jsonOpen}
        onOk={handleJsonRegister}
        onCancel={() => setJsonOpen(false)}
        okText="解析并注册"
        cancelText="取消"
        confirmLoading={saving}
        width={720}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
          支持 Claude / Cursor 风格 <code>mcpServers</code>，也支持数组或单个 Server 对象。
        </Text>
        <Form form={jsonForm} layout="vertical">
          <Form.Item name="json" rules={[{ required: true, message: '请粘贴 MCP JSON' }]}>
            <Input.TextArea
              rows={14}
              spellCheck={false}
              placeholder={`{
  "mcpServers": {
    "remoteSearch": {
      "transport": "streamable_http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer \${TOKEN}" }
    }
  }
}`}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default McpPlaza;

