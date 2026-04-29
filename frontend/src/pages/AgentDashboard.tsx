/**
 * AgentDashboard - Agent 工作台
 * 展示用户创建的所有 Agent，支持创建、编辑、删除、对话
 */
import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Avatar,
  Tag,
  Space,
  Empty,
  Modal,
  Dropdown,
  message,
} from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  skills: string[];
  knowledgeBase: string[];
  memoryEnabled: boolean;
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
  lastUsed?: string;
}

// Mock Agents 数据
const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: '流程分析助手',
    description: '帮助企业分析业务流程，识别瓶颈和优化机会',
    model: 'qwen-plus',
    skills: ['process-analysis', 'risk-identification'],
    knowledgeBase: ['流程知识库'],
    memoryEnabled: true,
    status: 'active',
    createdAt: '2024-03-01',
    lastUsed: '2024-03-28',
  },
  {
    id: 'agent-2',
    name: '数据分析专家',
    description: '执行数据分析和可视化报告生成',
    model: 'qwen-max',
    skills: ['data-analysis', 'chart-generation'],
    knowledgeBase: [],
    memoryEnabled: false,
    status: 'draft',
    createdAt: '2024-03-15',
  },
];

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>(mockAgents);

  const handleDeleteAgent = (agentId: string) => {
    Modal.confirm({
      title: '确认删除 Agent',
      content: '删除后无法恢复，确定要删除此 Agent 吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        setAgents(agents.filter(a => a.id !== agentId));
        message.success('Agent 已删除');
      },
    });
  };

  const getStatusTag = (status: Agent['status']) => {
    const config = {
      active: { color: 'green', text: '运行中' },
      inactive: { color: 'orange', text: '已停用' },
      draft: { color: 'blue', text: '草稿' },
    };
    return <Tag color={config[status].color}>{config[status].text}</Tag>;
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 头部 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <RobotOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            Agent 工作台
          </Title>
          <Text type="secondary">管理您的智能助手，配置知识库、记忆和技能</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => navigate('/agents/create')}
          style={{ background: '#6366f1' }}
        >
          创建 Agent
        </Button>
      </div>

      {/* Agent 列表 */}
      {agents.length === 0 ? (
        <Empty
          description="暂无 Agent，点击上方按钮创建"
          style={{ padding: 80 }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {agents.map((agent) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={agent.id}>
              <Card
                hoverable
                style={{ borderRadius: 12, overflow: 'hidden' }}
                bodyStyle={{ padding: 16 }}
              >
                {/* Agent 头部 */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <Avatar
                    size={48}
                    icon={<RobotOutlined />}
                    style={{ backgroundColor: '#6366f1' }}
                  />
                  <div style={{ marginLeft: 12, flex: 1 }}>
                    <Text strong style={{ fontSize: 16 }}>{agent.name}</Text>
                    <div style={{ marginTop: 4 }}>
                      {getStatusTag(agent.status)}
                      <Tag color="purple" style={{ marginLeft: 4 }}>{agent.model}</Tag>
                    </div>
                  </div>
                </div>

                {/* 描述 */}
                <Paragraph
                  ellipsis={{ rows: 2 }}
                  style={{ marginBottom: 12, color: '#666' }}
                >
                  {agent.description}
                </Paragraph>

                {/* 配置信息 */}
                <div style={{ marginBottom: 12 }}>
                  <Space size={4}>
                    <Tag icon={<MessageOutlined />}>{agent.skills.length} Skills</Tag>
                    <Tag icon={<RobotOutlined />}>
                      {agent.knowledgeBase.length > 0 ? `${agent.knowledgeBase.length} KB` : '无 KB'}
                    </Tag>
                    {agent.memoryEnabled && <Tag color="cyan">记忆</Tag>}
                  </Space>
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => navigate(`/chat/${agent.id}`)}
                    style={{ background: '#6366f1', flex: 1, marginRight: 8 }}
                  >
                    对话
                  </Button>
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => navigate(`/agents/edit/${agent.id}`) },
                        { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => handleDeleteAgent(agent.id) },
                      ],
                    }}
                  >
                    <Button icon={<MoreOutlined />} />
                  </Dropdown>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default AgentDashboard;