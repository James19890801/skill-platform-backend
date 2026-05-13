import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Empty,
  Grid,
  Progress,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
  HistoryOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  AutomationRunDTO,
  AutomationTaskDTO,
  AutomationTriggerType,
  automationsApi,
} from '../../services/api';

const { Text, Title, Paragraph } = Typography;
const { useBreakpoint } = Grid;

type FilterKey = 'all' | AutomationTriggerType;

const triggerMeta: Record<AutomationTriggerType, { label: string; icon: React.ReactNode; tone: string }> = {
  time: { label: '时间驱动', icon: <ClockCircleOutlined />, tone: 'time' },
  event: { label: '事件驱动', icon: <ThunderboltOutlined />, tone: 'event' },
  flow: { label: '流程驱动', icon: <BranchesOutlined />, tone: 'flow' },
};

const referencePatterns = [
  { name: 'Codex', note: '提示词、上下文和后台任务', icon: <RobotOutlined /> },
  { name: 'GitHub Actions', note: '事件/计划触发 + run history', icon: <ApiOutlined /> },
  { name: 'n8n / Activepieces', note: '节点编排、人工审批、连接器', icon: <NodeIndexOutlined /> },
  { name: 'Trigger.dev / Windmill', note: '任务代码化、日志可追踪', icon: <HistoryOutlined /> },
];

function formatTime(value?: string) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusText(status?: string) {
  if (status === 'completed') return '完成';
  if (status === 'running') return '运行中';
  if (status === 'failed') return '失败';
  if (status === 'cancelled') return '已取消';
  return '排队中';
}

function getStatusColor(status?: string) {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'processing';
  if (status === 'failed') return 'error';
  if (status === 'cancelled') return 'default';
  return 'warning';
}

function openChatPath(task: AutomationTaskDTO | null, threadId: string) {
  const base = task?.agentId ? `/chat/${task.agentId}` : '/chat';
  return `${base}?threadId=${encodeURIComponent(threadId)}`;
}

const AutomationCenter: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [tasks, setTasks] = useState<AutomationTaskDTO[]>([]);
  const [runs, setRuns] = useState<AutomationRunDTO[]>([]);
  const [summary, setSummary] = useState({ active: 0, runsToday: 0, failedRuns: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const data = await automationsApi.list();
      setTasks(data.items || []);
      setRuns(data.runs || []);
      setSummary(data.summary || { active: 0, runsToday: 0, failedRuns: 0 });
      setSelectedId((current) => current ?? data.items?.[0]?.id ?? null);
    } catch (error) {
      console.error('加载自动化失败:', error);
      message.error('自动化任务加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAutomations();
  }, []);

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((task) => task.triggerType === filter);
  }, [filter, tasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) || filteredTasks[0] || tasks[0] || null,
    [filteredTasks, selectedId, tasks]
  );

  const selectedRuns = useMemo(() => {
    if (!selectedTask) return [];
    return runs.filter((run) => run.automationId === selectedTask.id);
  }, [runs, selectedTask]);

  const selectedFlowNodes = useMemo(() => {
    const nodes = selectedTask?.orchestration?.nodes;
    if (Array.isArray(nodes) && nodes.length > 0) return nodes.map(String);
    return ['trigger', 'agent', 'skill', 'thread_result'];
  }, [selectedTask]);

  const healthScore = useMemo(() => {
    if (!tasks.length) return 0;
    const activeScore = (summary.active / tasks.length) * 70;
    const runScore = Math.min(30, summary.runsToday * 10);
    return Math.round(activeScore + runScore);
  }, [summary.active, summary.runsToday, tasks.length]);

  const handleRun = async (task: AutomationTaskDTO) => {
    setRunningId(task.id);
    try {
      const run = await automationsApi.run(task.id, { trigger: 'manual' });
      if (run.status === 'failed') {
        message.error('自动化执行失败，已打开执行会话');
      } else {
        message.success('自动化已执行完成');
      }
      await loadAutomations();
      navigate(openChatPath(task, run.threadId));
    } catch (error) {
      console.error('运行自动化失败:', error);
      message.error('自动化运行失败');
      await loadAutomations();
    } finally {
      setRunningId(null);
    }
  };

  const metricItems = [
    { label: '自动化任务', value: tasks.length, icon: <NodeIndexOutlined />, tone: 'blue' },
    { label: '运行中配置', value: summary.active, icon: <CheckCircleOutlined />, tone: 'green' },
    { label: '今日执行', value: summary.runsToday, icon: <FireOutlined />, tone: 'amber' },
    { label: '异常记录', value: summary.failedRuns, icon: <WarningOutlined />, tone: 'red' },
  ];

  const renderTaskCard = (task: AutomationTaskDTO) => {
    const meta = triggerMeta[task.triggerType];
    const selected = selectedTask?.id === task.id;
    return (
      <button
        type="button"
        key={task.id}
        className={'automation-task-card tone-' + meta.tone + (selected ? ' selected' : '')}
        onClick={() => setSelectedId(task.id)}
      >
        <div className="automation-task-head">
          <span className="automation-task-icon">{meta.icon}</span>
          <span className="automation-task-title">{task.name}</span>
          <Badge status={task.status === 'active' ? 'success' : 'default'} text={task.status === 'active' ? '启用' : '暂停'} />
        </div>
        <p>{task.description || '暂无描述'}</p>
        <div className="automation-task-meta">
          <Tag>{meta.label}</Tag>
          <Tag color="blue">{task.triggerLabel || '手动触发'}</Tag>
          <Tag color={task.latestRun?.status === 'failed' ? 'red' : 'green'}>{task.runCount || 0} 次</Tag>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="automation-shell">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div className="automation-shell">
      <section className="automation-hero">
        <div className="automation-hero-main">
          <div className="section-kicker">Automation Center</div>
          <Title level={isMobile ? 3 : 2} className="automation-title">自动化</Title>
          <Paragraph className="automation-subtitle">
            把时间触发、流程触发和事件触发统一成可运营的自动化任务；执行仍回到中心化对话页，结果、产物和人工确认都沉淀在同一个 Thread。
          </Paragraph>
          <div className="automation-reference-strip">
            {referencePatterns.map((item) => (
              <div className="automation-reference" key={item.name}>
                <span>{item.icon}</span>
                <div>
                  <strong>{item.name}</strong>
                  <em>{item.note}</em>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="automation-health">
          <Progress type="dashboard" percent={healthScore} size={118} strokeColor="#2563eb" />
          <Text strong>自动化健康度</Text>
          <Text type="secondary">由启用率、今日执行和失败记录综合计算。</Text>
        </div>
      </section>

      <section className="automation-metrics">
        {metricItems.map((metric) => (
          <div className={'automation-metric tone-' + metric.tone} key={metric.label}>
            <span>{metric.icon}</span>
            <div>
              <strong>{metric.value}</strong>
              <em>{metric.label}</em>
            </div>
          </div>
        ))}
      </section>

      <div className="automation-workspace">
        <main className="automation-list-panel">
          <div className="automation-toolbar">
            <div>
              <div className="section-kicker">Blueprints</div>
              <h2>自动化任务</h2>
              <Text type="secondary">点击运行会立即执行配置的 Skill 和提示词，结果沉淀到中心化对话。</Text>
            </div>
            <Segmented
              value={filter}
              onChange={(value) => setFilter(value as FilterKey)}
              options={[
                { label: '全部', value: 'all' },
                { label: '时间', value: 'time' },
                { label: '事件', value: 'event' },
                { label: '流程', value: 'flow' },
              ]}
            />
          </div>

          {filteredTasks.length === 0 ? (
            <div className="automation-empty">
              <Empty description="暂无自动化任务" />
            </div>
          ) : (
            <div className="automation-task-grid">
              {filteredTasks.map(renderTaskCard)}
            </div>
          )}
        </main>

        <aside className="automation-detail-panel">
          {selectedTask ? (
            <>
              <div className="automation-detail-head">
                <div>
                  <div className="section-kicker">Selected Automation</div>
                  <h3>{selectedTask.name}</h3>
                  <Text type="secondary">{selectedTask.description}</Text>
                </div>
                <Tooltip title="立即执行并打开结果对话">
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={runningId === selectedTask.id}
                    onClick={() => handleRun(selectedTask)}
                  >
                    运行
                  </Button>
                </Tooltip>
              </div>

              <div className="automation-trigger-band">
                <div>
                  <span>{triggerMeta[selectedTask.triggerType].icon}</span>
                  <strong>{triggerMeta[selectedTask.triggerType].label}</strong>
                  <em>{selectedTask.triggerLabel || '手动触发'}</em>
                </div>
                <div>
                  <span><SyncOutlined /></span>
                  <strong>下次执行</strong>
                  <em>{formatTime(selectedTask.nextRunAt)}</em>
                </div>
              </div>

              <div className="automation-section">
                <div className="automation-section-title">编排内容</div>
                <div className="automation-flow">
                  {selectedFlowNodes.map((node, index) => (
                      <React.Fragment key={node + index}>
                        <span>{node}</span>
                        {index < selectedFlowNodes.length - 1 && <i />}
                      </React.Fragment>
                    ))}
                </div>
                <div className="automation-prompt">{selectedTask.prompt || '暂无提示词'}</div>
                <Space wrap>
                  {selectedTask.skills.map((skill) => <Tag color="blue" key={skill}>{skill}</Tag>)}
                  {selectedTask.skills.length === 0 && <Tag>未装配 Skill</Tag>}
                </Space>
              </div>

              <div className="automation-section">
                <div className="automation-section-title">执行记录</div>
                {selectedRuns.length === 0 ? (
                  <div className="automation-no-runs">
                    <HistoryOutlined />
                    <Text type="secondary">还没有执行记录，点击运行会立即执行并生成结果会话。</Text>
                  </div>
                ) : (
                  <Timeline
                    items={selectedRuns.slice(0, 8).map((run) => ({
                      color: run.status === 'failed' ? 'red' : run.status === 'running' ? 'blue' : 'green',
                      children: (
                        <div className="automation-run-row">
                          <div>
                            <Badge status={getStatusColor(run.status) as any} text={getStatusText(run.status)} />
                            <Text type="secondary"> · {formatTime(run.createdAt)} · #{run.threadId.slice(-6)}</Text>
                            <p>{run.outputPreview || '已生成执行会话'}</p>
                          </div>
                          <Button
                            size="small"
                            icon={<MessageOutlined />}
                            onClick={() => navigate(openChatPath(selectedTask, run.threadId))}
                          >
                            打开对话
                          </Button>
                        </div>
                      ),
                    }))}
                  />
                )}
              </div>
            </>
          ) : (
            <Empty description="选择一个自动化任务" />
          )}
        </aside>
      </div>
    </div>
  );
};

export default AutomationCenter;
