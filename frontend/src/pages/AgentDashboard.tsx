/**
 * AgentDashboard - Agent 工作台
 * 展示用户创建的所有 Agent，支持创建、编辑、删除、对话
 */
import React, { useState, useEffect } from 'react';
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
  Spin,
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
import { agentsApi, AgentDTO } from '../services/api';

const { Title, Text, Paragraph } = Typography;

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // 从后端获取 Agent 列表
  const fetchAgents = async () => {
    setLoading(true);
    try {
      const data = await agentsApi.list();
      setAgents(data?.items || []);
    } catch (error) {
      console.error('获取 Agent 列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDeleteAgent = async (agentId: number) => {
    Modal.confirm({
      title: '确认删除 Agent',
      content: '删除后无法恢复，确定要删除此 Agent 吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await agentsApi.delete(agentId);
          message.success('Agent 已删除');
          fetchAgents();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      active: { color: 'green', text: '运行中' },
      inactive: { color: 'orange', text: '已停用' },
      draft: { color: 'blue', text: '草稿' },
    };
    const s = config[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
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
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : agents.length === 0 ? (
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
                styles={{ body: { padding: 16 } }}
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
                  {agent.description || '暂无描述'}
                </Paragraph>

                {/* 配置信息 */}
                <div style={{ marginBottom: 12 }}>
                  <Space size={4}>
                    <Tag icon={<MessageOutlined />}>{agent.skills?.length || 0} Skills</Tag>
                    <Tag icon={<RobotOutlined />}>
                      {(agent.knowledgeBases?.length || 0) > 0 ? `${agent.knowledgeBases.length} KB` : '无 KB'}
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