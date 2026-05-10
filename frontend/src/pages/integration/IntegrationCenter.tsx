import React from 'react';
import { Button, Card, Col, Input, Row, Space, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  CodeOutlined,
  MessageOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const apiBase = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
  height: '100%',
};

const IntegrationCenter: React.FC = () => {
  const navigate = useNavigate();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://e2e-ai.pages.dev';
  const sdkSnippet = `import { E2EAIClient } from '@e2e-ai/sdk';

const client = new E2EAIClient({
  apiKey: process.env.E2E_AI_API_KEY,
  baseURL: '${apiBase}',
});

const answer = await client.chat({
  agentId: 2,
  message: '帮我审查这份合同',
});`;
  const iframeSnippet = `<iframe
  src="${origin}/embed/chat/2"
  width="100%"
  height="720"
  style="border:0;border-radius:12px"
></iframe>`;
  const restSnippet = `POST ${apiBase}/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "thread_id": "thread-demo",
  "agentId": 2,
  "message": "帮我生成一份项目周报",
  "stream": true
}`;

  return (
    <div style={{ padding: 24, background: '#f6f8fb', minHeight: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>平台调用中心</Title>
        <Text type="secondary">API/SDK、嵌入式组件、平台内对话三种入口统一管理</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card style={cardStyle}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Space>
                <ApiOutlined style={{ fontSize: 22, color: '#2563eb' }} />
                <Title level={4} style={{ margin: 0 }}>后端 API / SDK</Title>
              </Space>
              <Paragraph type="secondary">服务端系统直接调用 Agent、Skill 和知识库检索接口。</Paragraph>
              <Space wrap>
                <Tag color="blue">REST</Tag>
                <Tag color="green">SSE</Tag>
                <Tag>OpenAI 兼容</Tag>
              </Space>
              <TextArea value={restSnippet} rows={9} readOnly style={{ fontFamily: 'monospace', fontSize: 12 }} />
              <TextArea value={sdkSnippet} rows={10} readOnly style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </Space>
          </Card>
        </Col>

        <Col span={8}>
          <Card style={cardStyle}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Space>
                <CodeOutlined style={{ fontSize: 22, color: '#7c3aed' }} />
                <Title level={4} style={{ margin: 0 }}>嵌入式前端组件</Title>
              </Space>
              <Paragraph type="secondary">业务系统用 iframe 或前端组件嵌入对话能力。</Paragraph>
              <Space wrap>
                <Tag color="purple">iframe</Tag>
                <Tag color="cyan">Web Component</Tag>
                <Tag>React</Tag>
              </Space>
              <TextArea value={iframeSnippet} rows={8} readOnly style={{ fontFamily: 'monospace', fontSize: 12 }} />
              <Button icon={<NodeIndexOutlined />} onClick={() => navigate('/embed/chat/2')}>
                打开嵌入预览
              </Button>
            </Space>
          </Card>
        </Col>

        <Col span={8}>
          <Card style={cardStyle}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Space>
                <MessageOutlined style={{ fontSize: 22, color: '#059669' }} />
                <Title level={4} style={{ margin: 0 }}>平台内对话</Title>
              </Space>
              <Paragraph type="secondary">用户在平台里直接选择 Agent，调用 Skill、知识库和运行时工具。</Paragraph>
              <Space wrap>
                <Tag color="green">Agent</Tag>
                <Tag color="blue">Skill Runtime</Tag>
                <Tag color="gold">Knowledge RAG</Tag>
              </Space>
              <Button type="primary" icon={<MessageOutlined />} onClick={() => navigate('/chat/2')}>
                进入对话
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default IntegrationCenter;
