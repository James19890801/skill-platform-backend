/**
 * AgentDashboard - Agent 工作台
 * 保留已有 Agent 管理能力，同时提供更接近参考站的工作台式入口。
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Empty,
  Grid,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CloudOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FireOutlined,
  HeartFilled,
  HeartOutlined,
  MessageOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { agentsApi, AgentDTO, skillRuntimeApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import LoginModal from '../components/LoginModal';
import {
  getAgentAvatarSrc,
  getAgentAvatarStyle,
  renderAgentAvatarContent,
} from '../utils/agentAvatars';

const { useBreakpoint } = Grid;
const { Title, Text, Paragraph } = Typography;

type SortMode = 'hot' | 'capability' | 'updated';

type QueueStatus = {
  queued: number;
  running: number;
  concurrency: number;
};

type AgentWithSignals = AgentDTO & {
  _visits: number;
  _likes: number;
  _liked: boolean;
  _score: number;
  _statusText: string;
};

const AGENT_LIST_CACHE_KEY = 'agent-dashboard:last-list:v1';
const AGENT_LIST_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const localBlueprints = [
  {
    title: '审批快速分析',
    subtitle: '审批件摘要、风险标注、终审建议',
    source: '桌面精选 Skill',
    tags: ['approval-summary', '合规审查', '风控'],
    tone: 'blue',
  },
  {
    title: '流程挖掘与诊断',
    subtitle: '流程轨迹、瓶颈定位、改进动作',
    source: '流程管理 Skill',
    tags: ['process-mining', '流程运营', '监控'],
    tone: 'green',
  },
  {
    title: '合同文本解析',
    subtitle: '条款抽取、风险分级、谈判建议',
    source: '法务模板',
    tags: ['合同审查', 'NDA快筛', '台账'],
    tone: 'amber',
  },
  {
    title: '数字化咨询报告',
    subtitle: '问题拆解、方案框架、CEO 摘要',
    source: '咨询报告 Skill',
    tags: ['方案框架', '写报告', 'CEO汇报'],
    tone: 'violet',
  },
];

function mockHotData(id: number): { visits: number; likes: number } {
  let hash = id * 9973 + 131;
  const visits = 320 + (hash % 16800);
  hash = Math.floor(hash / 7);
  const likes = 18 + (hash % 780);
  return { visits, likes };
}

function normalizeQueueStatus(payload: unknown): QueueStatus | null {
  const candidate = payload as QueueStatus | { data?: QueueStatus } | null;
  if (!candidate) return null;
  if ('queued' in candidate) return candidate as QueueStatus;
  if ('data' in candidate && candidate.data && 'queued' in candidate.data) return candidate.data;
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readCachedAgentList(): AgentDTO[] | null {
  try {
    const raw = window.localStorage.getItem(AGENT_LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; items?: AgentDTO[] };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > AGENT_LIST_CACHE_MAX_AGE_MS) return null;
    return Array.isArray(parsed.items) ? parsed.items : null;
  } catch {
    return null;
  }
}

function writeCachedAgentList(items: AgentDTO[]) {
  try {
    window.localStorage.setItem(AGENT_LIST_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      items,
    }));
  } catch {
    // Ignore storage quota or private-mode failures; the live API remains authoritative.
  }
}

async function loadAgentsWithRetry() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await agentsApi.list();
    } catch (error) {
      lastError = error;
      if (attempt === 0) await sleep(500);
    }
  }
  throw lastError;
}

function getAgentScore(agent: AgentDTO) {
  const skillCount = agent.skills?.length || 0;
  const kbCount = agent.knowledgeBases?.length || 0;
  const memoryScore = agent.memoryEnabled ? 12 : 0;
  const statusScore = agent.status === 'active' ? 16 : agent.status === 'draft' ? 6 : 0;
  return Math.min(100, 34 + skillCount * 12 + kbCount * 10 + memoryScore + statusScore);
}

function getStatusText(status: string) {
  if (status === 'active') return '运行中';
  if (status === 'inactive') return '已停用';
  if (status === 'draft') return '草稿';
  return status || '未知';
}

function getStatusColor(status: string) {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'warning';
  if (status === 'draft') return 'processing';
  return 'default';
}

function getAgentInitials(name: string) {
  const clean = name.trim();
  if (!clean) return 'AI';
  return clean.slice(0, 2).toUpperCase();
}

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('hot');
  const [likedAgents, setLikedAgents] = useState<Set<number>>(new Set());
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [agentDetailsById, setAgentDetailsById] = useState<Record<number, AgentDTO>>({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const { isAuthenticated, isAdmin } = useAuthStore();

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const data = await loadAgentsWithRetry();
      const items = data?.items || [];
      setAgents(items);
      setSelectedAgentId((current) => current ?? items[0]?.id ?? null);
      writeCachedAgentList(items);
    } catch (error) {
      console.error('获取 Agent 列表失败:', error);
      const cachedItems = readCachedAgentList();
      if (cachedItems?.length) {
        setAgents(cachedItems);
        setSelectedAgentId((current) => current ?? cachedItems[0]?.id ?? null);
        message.warning('网络暂时不稳定，已展示上次成功加载的 Agent 列表');
      } else {
        message.warning('Agent 列表加载失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    skillRuntimeApi
      .getQueueStatus()
      .then((payload) => setQueueStatus(normalizeQueueStatus(payload)))
      .catch(() => setQueueStatus(null));
  }, []);

  const agentsWithSignals = useMemo<AgentWithSignals[]>(
    () =>
      agents.map((agent) => {
        const hot = mockHotData(agent.id);
        return {
          ...agent,
          _visits: hot.visits,
          _likes: likedAgents.has(agent.id) ? hot.likes + 1 : hot.likes,
          _liked: likedAgents.has(agent.id),
          _score: getAgentScore(agent),
          _statusText: getStatusText(agent.status),
        };
      }),
    [agents, likedAgents]
  );

  const filteredAndSorted = useMemo(() => {
    let list = [...agentsWithSignals];
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((agent) =>
        agent.name.toLowerCase().includes(q) ||
        (agent.description || '').toLowerCase().includes(q) ||
        (agent.model || '').toLowerCase().includes(q) ||
        (agent.skills || []).some((skill) => skill.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'hot') list.sort((a, b) => b._visits - a._visits || b._likes - a._likes);
    if (sortBy === 'capability') list.sort((a, b) => b._score - a._score);
    if (sortBy === 'updated') {
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    }
    return list;
  }, [agentsWithSignals, searchText, sortBy]);

  const selectedAgent = useMemo(() => {
    return agentsWithSignals.find((agent) => agent.id === selectedAgentId) || filteredAndSorted[0] || agentsWithSignals[0] || null;
  }, [agentsWithSignals, filteredAndSorted, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgent?.id || agentDetailsById[selectedAgent.id]) return;
    let cancelled = false;
    agentsApi
      .getById(selectedAgent.id)
      .then((detail) => {
        if (cancelled) return;
        setAgentDetailsById((current) => ({
          ...current,
          [selectedAgent.id]: detail,
        }));
      })
      .catch(() => {
        // The list card is still usable; detail can be fetched again when the user reselects.
      });
    return () => {
      cancelled = true;
    };
  }, [agentDetailsById, selectedAgent?.id]);

  const selectedAgentView = useMemo(() => {
    if (!selectedAgent) return null;
    const detail = agentDetailsById[selectedAgent.id];
    return detail ? { ...selectedAgent, ...detail } : selectedAgent;
  }, [agentDetailsById, selectedAgent]);

  const metrics = useMemo(() => {
    const skillBindings = agents.reduce((sum, agent) => sum + (agent.skills?.length || 0), 0);
    const knowledgeBindings = agents.reduce((sum, agent) => sum + (agent.knowledgeBases?.length || 0), 0);
    const activeAgents = agents.filter((agent) => agent.status === 'active').length;
    const memoryAgents = agents.filter((agent) => agent.memoryEnabled).length;

    return [
      { label: 'Agent 总量', value: agents.length, icon: <RobotOutlined />, tone: 'blue' },
      { label: '运行中', value: activeAgents, icon: <CheckCircleOutlined />, tone: 'green' },
      { label: 'Skill 绑定', value: skillBindings, icon: <ThunderboltOutlined />, tone: 'amber' },
      { label: '知识/记忆', value: knowledgeBindings + memoryAgents, icon: <DatabaseOutlined />, tone: 'violet' },
    ];
  }, [agents]);

  const handleLike = (agentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const requireLoginOrCreate = () => {
    if (isAuthenticated()) navigate('/agents/create');
    else setShowLoginModal(true);
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (!isAuthenticated()) {
      message.info('请先登录管理员账号后再删除 Agent');
      setShowLoginModal(true);
      return;
    }
    if (!isAdmin()) {
      message.warning('删除已有 Agent 需要超级管理员权限');
      return;
    }

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
          if (selectedAgentId === agentId) setSelectedAgentId(null);
          setAgentDetailsById((current) => {
            const next = { ...current };
            delete next[agentId];
            return next;
          });
          fetchAgents();
        } catch (error: any) {
          const detail = error?.response?.data?.message || error?.message || '删除失败';
          message.error(detail);
        }
      },
    });
  };

  const renderAgentCard = (agent: AgentWithSignals) => {
    const selected = selectedAgent?.id === agent.id;
    const menuItems = [
      { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => navigate('/agents/edit/' + agent.id) },
      { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => handleDeleteAgent(agent.id) },
    ];

    return (
      <div
        key={agent.id}
        className={'agent-op-card' + (selected ? ' selected' : '')}
        onClick={() => setSelectedAgentId(agent.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setSelectedAgentId(agent.id);
        }}
        role="button"
        tabIndex={0}
      >
        <div className="agent-op-card-head">
          <Avatar
            className="agent-op-avatar"
            src={getAgentAvatarSrc(agent.avatar)}
            style={getAgentAvatarStyle(agent.avatar)}
          >
            {renderAgentAvatarContent(agent.avatar, getAgentInitials(agent.name))}
          </Avatar>
          <div className="agent-op-title">
            <div className="agent-op-name">{agent.name}</div>
            <div className="agent-op-model">{agent.model || '未配置模型'}</div>
          </div>
          <Badge status={getStatusColor(agent.status) as any} text={agent._statusText} />
        </div>

        <Paragraph ellipsis={{ rows: 2 }} className="agent-op-desc">
          {agent.description || '这个 Agent 还没有描述。建议补齐定位、可调用 Skill 和适用场景。'}
        </Paragraph>

        <div className="agent-op-signal">
          <span><FireOutlined /> {agent._visits.toLocaleString()}</span>
          <span onClick={(e) => handleLike(agent.id, e)} className={agent._liked ? 'liked' : ''}>
            {agent._liked ? <HeartFilled /> : <HeartOutlined />} {agent._likes}
          </span>
          <span><ThunderboltOutlined /> {agent.skills?.length || 0}</span>
        </div>

        <div className="agent-op-progress">
          <Progress percent={agent._score} showInfo={false} strokeColor="#2563eb" trailColor="#e5e7eb" />
          <span>{agent._score}% 完整度</span>
        </div>

        <div className="agent-op-tags">
          {(agent.skills || []).slice(0, 2).map((skill) => <Tag key={skill}>{skill}</Tag>)}
          {(agent.knowledgeBases?.length || 0) > 0 && <Tag color="blue">{agent.knowledgeBases.length} KB</Tag>}
          {agent.memoryEnabled && <Tag color="cyan">记忆</Tag>}
          {(agent.skills?.length || 0) === 0 && <Tag color="orange">待装配 Skill</Tag>}
        </div>

        <div className="agent-op-actions" onClick={(e) => e.stopPropagation()}>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/chat/' + agent.id)}>
            对话
          </Button>
          <Button icon={<EditOutlined />} onClick={() => navigate('/agents/edit/' + agent.id)} />
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      </div>
    );
  };

  return (
    <div className="agent-dashboard-shell">
      <LoginModal visible={showLoginModal} onClose={() => setShowLoginModal(false)} redirectTo="/agents/create" />

      <section className="agent-dashboard-hero">
        <div className="agent-dashboard-hero-main">
          <div className="dashboard-eyebrow">Agent Operations</div>
          <Title level={isMobile ? 3 : 2} className="dashboard-title">
            智能体工作台
          </Title>
          <Paragraph className="dashboard-subtitle">
            把已有 Agent、Skill、知识库和运行时状态放在一个工作面上；这里不是展示空壳，而是直接进入创建、装配、对话和运营。
          </Paragraph>
          <Space wrap className="dashboard-hero-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={requireLoginOrCreate}>
              创建 Agent
            </Button>
            <Button icon={<MessageOutlined />} onClick={() => navigate(selectedAgent ? '/chat/' + selectedAgent.id : '/chat')}>
              进入对话
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => navigate('/skills')}>
              管理 Skills
            </Button>
          </Space>
        </div>

        <div className="agent-dashboard-live">
          <div className="live-header">
            <span>Runtime</span>
            <Badge status={queueStatus?.running ? 'processing' : 'success'} text={queueStatus?.running ? '运行中' : '空闲'} />
          </div>
          <div className="live-grid">
            <div>
              <strong>{queueStatus?.queued ?? 0}</strong>
              <span>排队</span>
            </div>
            <div>
              <strong>{queueStatus?.running ?? 0}</strong>
              <span>执行</span>
            </div>
            <div>
              <strong>{queueStatus?.concurrency ?? 1}</strong>
              <span>并发</span>
            </div>
          </div>
          <div className="live-note">
            P0 Skill Runtime 已接入队列、事件流和产物追踪，后续可以直接把 Skill 执行面板挂到这里。
          </div>
        </div>
      </section>

      <section className="dashboard-metrics">
        {metrics.map((metric) => (
          <div className={'metric-tile tone-' + metric.tone} key={metric.label}>
            <div className="metric-icon">{metric.icon}</div>
            <div>
              <div className="metric-value">{metric.value}</div>
              <div className="metric-label">{metric.label}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="agent-dashboard-grid">
        <main className="agent-market-workbench">
          <div className="dashboard-admin-tabs">
            <button className="active" type="button">Agent 列表</button>
            <button type="button" onClick={() => navigate('/skills')}>Skill 管理</button>
            <button type="button" onClick={() => navigate('/knowledge')}>知识库管理</button>
            <button type="button" onClick={() => navigate('/memory')}>记忆管理</button>
          </div>

          <div className="workbench-toolbar">
            <div>
              <div className="section-kicker">Agent Library</div>
              <h2>已建智能体</h2>
              <Text type="secondary">当前筛选 {filteredAndSorted.length} 个，点击卡片可在右侧查看装配状态。</Text>
            </div>
            <div className="toolbar-controls">
              <Input
                placeholder="搜索 Agent、模型或 Skill"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                allowClear
              />
              <Select
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: 'hot', label: '最热' },
                  { value: 'capability', label: '完整度' },
                  { value: 'updated', label: '最近更新' },
                ]}
              />
            </div>
          </div>

          {loading ? (
            <div className="dashboard-loading">
              <Spin size="large" />
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="dashboard-empty">
              <Empty description={searchText ? '没有匹配的 Agent' : '还没有 Agent'} />
              <Button type="primary" icon={<PlusOutlined />} onClick={requireLoginOrCreate}>
                立即创建
              </Button>
            </div>
          ) : (
            <div className="agent-op-grid">
              {filteredAndSorted.map(renderAgentCard)}
            </div>
          )}
        </main>

        <aside className="agent-side-panel">
          <div className="side-panel-card selected-agent-card">
            <div className="side-panel-header">
              <div>
                <div className="section-kicker">Selected Agent</div>
                <h3>{selectedAgent?.name || '等待选择 Agent'}</h3>
              </div>
              <Tooltip title="对话调试">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  disabled={!selectedAgent}
                  onClick={() => selectedAgent && navigate('/chat/' + selectedAgent.id)}
                />
              </Tooltip>
            </div>

            {selectedAgentView ? (
              <>
                <div className="selected-agent-score">
                  <Progress
                    type="circle"
                    percent={selectedAgentView._score}
                    size={84}
                    strokeColor="#2563eb"
                    trailColor="#e5e7eb"
                  />
                  <div>
                    <Text strong>装配完整度</Text>
                    <p>由模型、Skill、知识库、记忆和发布状态综合计算。</p>
                  </div>
                </div>

                <div className="capability-stack">
                  <div><ThunderboltOutlined /> {(selectedAgentView.skills || []).length} 个 Skill</div>
                  <div><DatabaseOutlined /> {(selectedAgentView.knowledgeBases || []).length} 个知识库</div>
                  <div><CloudOutlined /> {selectedAgentView.memoryEnabled ? '长期记忆已开' : '长期记忆未开'}</div>
                  <div><ApiOutlined /> {selectedAgentView.model || '模型未配置'}</div>
                </div>

                <div className="prompt-preview">
                  <span>系统提示词</span>
                  <p>{selectedAgentView.systemPrompt || '暂无系统提示词，建议补齐角色、边界和工具使用策略。'}</p>
                </div>

                <Space wrap>
                  <Button icon={<EditOutlined />} onClick={() => navigate('/agents/edit/' + selectedAgentView.id)}>
                    编辑配置
                  </Button>
                  <Button icon={<MessageOutlined />} onClick={() => navigate('/chat/' + selectedAgentView.id)}>
                    打开会话
                  </Button>
                </Space>
              </>
            ) : (
              <Empty description="选择一个 Agent 查看装配详情" />
            )}
          </div>

          <div className="side-panel-card">
            <div className="side-panel-header compact">
              <div>
                <div className="section-kicker">Local Templates</div>
                <h3>精选能力库存</h3>
              </div>
              <AppstoreOutlined />
            </div>
            <div className="blueprint-list">
              {localBlueprints.map((blueprint) => (
                <div className={'blueprint-item tone-' + blueprint.tone} key={blueprint.title}>
                  <div className="blueprint-icon">
                    {blueprint.tone === 'blue' && <SafetyCertificateOutlined />}
                    {blueprint.tone === 'green' && <BranchesOutlined />}
                    {blueprint.tone === 'amber' && <DatabaseOutlined />}
                    {blueprint.tone === 'violet' && <AppstoreOutlined />}
                  </div>
                  <div className="blueprint-body">
                    <strong>{blueprint.title}</strong>
                    <span>{blueprint.subtitle}</span>
                    <div>
                      <Tag>{blueprint.source}</Tag>
                      {blueprint.tags.slice(0, 2).map((tag) => <Tag key={tag}>{tag}</Tag>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AgentDashboard;
