import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileDoneOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  EvaluationCaseDTO,
  EvaluationRunDTO,
  EvaluationSuiteDTO,
  EvaluationTargetDTO,
  EvaluationTargetType,
  evaluationsApi,
} from '../../services/api';

const { Paragraph, Text, Title } = Typography;

const targetTypeOptions: Array<{ value: EvaluationTargetType; label: string; icon: React.ReactNode }> = [
  { value: 'agent', label: 'Agent', icon: <RobotOutlined /> },
  { value: 'skill', label: 'Skill', icon: <ThunderboltOutlined /> },
  { value: 'knowledge', label: '知识库', icon: <DatabaseOutlined /> },
  { value: 'workflow', label: '流程编排', icon: <NodeIndexOutlined /> },
];

const targetTypeLabel: Record<EvaluationTargetType, string> = {
  agent: 'Agent',
  skill: 'Skill',
  knowledge: '知识库',
  workflow: '流程编排',
};

const gradeColor = (score?: number) => {
  if (!score) return '#94a3b8';
  if (score >= 90) return '#16a34a';
  if (score >= 80) return '#2563eb';
  if (score >= 70) return '#f59e0b';
  return '#dc2626';
};

const statusTag = (status?: string) => {
  const colorMap: Record<string, string> = {
    draft: 'blue',
    generated: 'blue',
    labeled: 'cyan',
    running: 'gold',
    scored: 'purple',
    completed: 'green',
    active: 'green',
    deprecated: 'default',
    failed: 'red',
    blocked: 'red',
    passed: 'green',
    partial: 'gold',
  };
  return <Tag color={colorMap[status || ''] || 'default'}>{status || 'unknown'}</Tag>;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const panelStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
};

const EvaluationCenter: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [suites, setSuites] = useState<EvaluationSuiteDTO[]>([]);
  const [targets, setTargets] = useState<EvaluationTargetDTO[]>([]);
  const [targetType, setTargetType] = useState<EvaluationTargetType>('agent');
  const [targetId, setTargetId] = useState<number | undefined>();
  const [suiteName, setSuiteName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<EvaluationSuiteDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [runningSuiteId, setRunningSuiteId] = useState<number | null>(null);
  const [promotingRunId, setPromotingRunId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, suitesData, targetsData] = await Promise.all([
        evaluationsApi.summary(),
        evaluationsApi.listSuites({ targetType }),
        evaluationsApi.targets({ targetType }),
      ]);
      setSummary(summaryData);
      setSuites(suitesData.items || []);
      setTargets(targetsData.items || []);
      if (targetId && !(targetsData.items || []).some((item) => item.targetId === targetId)) {
        setTargetId(undefined);
      }
    } catch (error) {
      message.error('评测数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  const targetOptions = useMemo(() => targets.map((item) => ({
    value: item.targetId,
    label: `${item.targetName}${item.namespace ? ` · ${item.namespace}` : ''}`,
  })), [targets]);

  const createSuite = async () => {
    if (!targetId) {
      message.warning('请先选择评测对象');
      return;
    }
    const target = targets.find((item) => item.targetId === targetId);
    setCreating(true);
    try {
      const created = await evaluationsApi.createSuite({
        name: suiteName.trim() || `${target?.targetName || targetTypeLabel[targetType]} 评测套件`,
        targetType,
        targetId,
        level: targetType === 'workflow' ? 'L3' : 'L2',
        stage: targetType === 'knowledge' ? 'R1' : targetType === 'workflow' ? 'W1' : 'S1',
      });
      await evaluationsApi.generateCases(created.id, { replace: true });
      const detail = await evaluationsApi.getSuite(created.id);
      setSelectedSuite(detail);
      setDrawerOpen(true);
      setSuiteName('');
      message.success('评测套件已创建，并已生成首批用例');
      await load();
    } catch (error) {
      message.error('创建评测套件失败');
    } finally {
      setCreating(false);
    }
  };

  const openSuite = async (suite: EvaluationSuiteDTO) => {
    try {
      const detail = await evaluationsApi.getSuite(suite.id);
      setSelectedSuite(detail);
      setDrawerOpen(true);
    } catch {
      message.error('评测套件详情加载失败');
    }
  };

  const regenerateCases = async (suite: EvaluationSuiteDTO) => {
    try {
      await evaluationsApi.generateCases(suite.id, { replace: true });
      message.success('用例已重新生成');
      const detail = await evaluationsApi.getSuite(suite.id);
      setSelectedSuite(detail);
      await load();
    } catch {
      message.error('用例生成失败');
    }
  };

  const runSuite = async (suite: EvaluationSuiteDTO) => {
    setRunningSuiteId(suite.id);
    try {
      const run = await evaluationsApi.createRun({ suiteId: suite.id, mode: 'live' });
      message.success(`评测完成：${run.score} 分`);
      const detail = await evaluationsApi.getSuite(suite.id);
      setSelectedSuite(detail);
      setDrawerOpen(true);
      await load();
    } catch {
      message.error('评测运行失败');
    } finally {
      setRunningSuiteId(null);
    }
  };

  const promoteBenchmark = async (suite: EvaluationSuiteDTO, run?: EvaluationRunDTO | null) => {
    const targetRun = run || suite.latestRun || suite.runs?.[0];
    if (!targetRun || targetRun.status !== 'completed') {
      message.warning('请先完成一次评测运行');
      return;
    }
    setPromotingRunId(targetRun.id);
    try {
      await evaluationsApi.promoteBenchmark({
        runId: targetRun.id,
        name: `${suite.targetName} Benchmark`,
        makeActive: true,
      });
      message.success('Benchmark 已固化');
      const detail = await evaluationsApi.getSuite(suite.id);
      setSelectedSuite(detail);
      await load();
    } catch {
      message.error('Benchmark 固化失败');
    } finally {
      setPromotingRunId(null);
    }
  };

  const summaryByType = (type: EvaluationTargetType) => {
    return summary?.byTargetType?.find((item: any) => item.targetType === type) || { benchmarkCount: 0, averageScore: 0 };
  };

  const suiteColumns = [
    {
      title: '评测套件',
      key: 'suite',
      render: (_: unknown, record: EvaluationSuiteDTO) => (
        <Space direction="vertical" size={2}>
          <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 600 }} onClick={() => openSuite(record)}>
            {record.name}
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {targetTypeLabel[record.targetType]} · {record.targetName}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: statusTag,
    },
    {
      title: '用例',
      dataIndex: 'caseCount',
      width: 90,
      render: (value: number) => <Tag>{value || 0} 条</Tag>,
    },
    {
      title: '最近得分',
      key: 'score',
      width: 150,
      render: (_: unknown, record: EvaluationSuiteDTO) => record.latestRun ? (
        <Space>
          <Text strong style={{ color: gradeColor(record.latestRun.score) }}>{record.latestRun.score}</Text>
          <Tag>{record.latestRun.grade || '-'}</Tag>
        </Space>
      ) : <Text type="secondary">未运行</Text>,
    },
    {
      title: 'Benchmark',
      key: 'benchmark',
      width: 150,
      render: (_: unknown, record: EvaluationSuiteDTO) => record.benchmark ? (
        <Space>
          <CheckCircleOutlined style={{ color: '#16a34a' }} />
          <Text>{record.benchmark.score} 分</Text>
        </Space>
      ) : <Text type="secondary">未固化</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: EvaluationSuiteDTO) => (
        <Space wrap>
          <Button size="small" icon={<AuditOutlined />} onClick={() => regenerateCases(record)}>
            生成用例
          </Button>
          <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={runningSuiteId === record.id} onClick={() => runSuite(record)}>
            跑评测
          </Button>
          <Button size="small" icon={<FileDoneOutlined />} loading={promotingRunId === record.latestRun?.id} onClick={() => promoteBenchmark(record)}>
            固化
          </Button>
        </Space>
      ),
    },
  ];

  const caseColumns = [
    { title: '用例', dataIndex: 'caseKey', width: 220 },
    { title: '类别', dataIndex: 'category', width: 120, render: (value: string) => <Tag>{value}</Tag> },
    { title: '输入', dataIndex: 'input', render: (value: string) => <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{value}</Paragraph> },
    { title: '预期', dataIndex: 'expected', render: (value: string) => <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{value}</Paragraph> },
    { title: '权重', dataIndex: 'weight', width: 80 },
    { title: '优先级', dataIndex: 'priority', width: 90, render: (value: string) => <Tag color={value === 'P0' ? 'red' : value === 'P1' ? 'gold' : 'blue'}>{value}</Tag> },
  ];

  const runColumns = [
    { title: 'Run ID', dataIndex: 'id', width: 90 },
    { title: '状态', dataIndex: 'status', width: 100, render: statusTag },
    { title: '分数', dataIndex: 'score', width: 100, render: (value: number) => <Text strong style={{ color: gradeColor(value) }}>{value}</Text> },
    { title: '等级', dataIndex: 'grade', width: 100, render: (value: string) => <Tag>{value || '-'}</Tag> },
    { title: '完成时间', dataIndex: 'completedAt', render: formatDate },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_: unknown, record: EvaluationRunDTO) => selectedSuite ? (
        <Button size="small" icon={<FileDoneOutlined />} loading={promotingRunId === record.id} onClick={() => promoteBenchmark(selectedSuite, record)}>
          固化
        </Button>
      ) : null,
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f6f8fb', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>评测中心</Title>
          <Text type="secondary">统一管理 Agent、Skill、知识库和流程编排的用例、评测运行与 Benchmark</Text>
        </div>
        <Button icon={<ExperimentOutlined />} loading={loading} onClick={load}>刷新</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card style={panelStyle}>
            <Statistic title="评测套件" value={summary?.suiteCount || 0} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={panelStyle}>
            <Statistic title="测试用例" value={summary?.caseCount || 0} prefix={<AuditOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={panelStyle}>
            <Statistic title="Benchmark" value={summary?.activeBenchmarkCount || 0} prefix={<FileDoneOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={panelStyle}>
            <Statistic title="平均分" value={summary?.averageScore || 0} suffix="/ 100" valueStyle={{ color: gradeColor(summary?.averageScore) }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ ...panelStyle, marginBottom: 16 }}>
        <Tabs
          activeKey={targetType}
          onChange={(key) => {
            setTargetType(key as EvaluationTargetType);
            setTargetId(undefined);
          }}
          items={targetTypeOptions.map((item) => {
            const typeSummary = summaryByType(item.value);
            return {
              key: item.value,
              label: (
                <Space>
                  {item.icon}
                  {item.label}
                  <Tag>{typeSummary.benchmarkCount} 个基线</Tag>
                </Space>
              ),
              children: (
                <Row gutter={[12, 12]} align="middle">
                  <Col xs={24} md={9}>
                    <Select
                      showSearch
                      placeholder={`选择${item.label}`}
                      value={targetId}
                      options={targetOptions}
                      onChange={setTargetId}
                      style={{ width: '100%' }}
                      optionFilterProp="label"
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Input
                      placeholder="套件名称，可留空"
                      value={suiteName}
                      onChange={(event) => setSuiteName(event.target.value)}
                    />
                  </Col>
                  <Col xs={24} md={7}>
                    <Space wrap>
                      <Button type="primary" icon={<ExperimentOutlined />} loading={creating} onClick={createSuite}>
                        创建并生成用例
                      </Button>
                      <Text type="secondary">平均 {typeSummary.averageScore || 0} 分</Text>
                    </Space>
                  </Col>
                </Row>
              ),
            };
          })}
        />
      </Card>

      <Card title="评测套件" style={panelStyle}>
        <Table
          rowKey="id"
          loading={loading}
          columns={suiteColumns}
          dataSource={suites}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="暂无评测套件" /> }}
        />
      </Card>

      <Drawer
        title={selectedSuite ? selectedSuite.name : '评测套件'}
        width={920}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={selectedSuite ? (
          <Space>
            <Button icon={<AuditOutlined />} onClick={() => regenerateCases(selectedSuite)}>生成用例</Button>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={runningSuiteId === selectedSuite.id} onClick={() => runSuite(selectedSuite)}>跑评测</Button>
          </Space>
        ) : null}
      >
        {selectedSuite ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={12}>
              <Col span={8}>
                <Card size="small" style={panelStyle}>
                  <Statistic title="评测对象" value={selectedSuite.targetName} valueStyle={{ fontSize: 18 }} />
                  <Tag>{targetTypeLabel[selectedSuite.targetType]}</Tag>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={panelStyle}>
                  <Statistic title="用例数" value={selectedSuite.cases?.length || selectedSuite.caseCount || 0} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={panelStyle}>
                  <Statistic title="最新得分" value={selectedSuite.runs?.[0]?.score || 0} suffix="/ 100" valueStyle={{ color: gradeColor(selectedSuite.runs?.[0]?.score) }} />
                  <Progress percent={selectedSuite.runs?.[0]?.score || 0} showInfo={false} strokeColor={gradeColor(selectedSuite.runs?.[0]?.score)} />
                </Card>
              </Col>
            </Row>

            <Tabs
              items={[
                {
                  key: 'cases',
                  label: '用例与标注',
                  children: (
                    <Table<EvaluationCaseDTO>
                      rowKey="id"
                      columns={caseColumns as any}
                      dataSource={selectedSuite.cases || []}
                      pagination={{ pageSize: 6 }}
                      locale={{ emptyText: <Empty description="暂无用例" /> }}
                    />
                  ),
                },
                {
                  key: 'runs',
                  label: '运行结果',
                  children: (
                    <Table<EvaluationRunDTO>
                      rowKey="id"
                      columns={runColumns as any}
                      dataSource={selectedSuite.runs || []}
                      pagination={{ pageSize: 6 }}
                      locale={{ emptyText: <Empty description="暂无运行" /> }}
                    />
                  ),
                },
                {
                  key: 'benchmarks',
                  label: 'Benchmark',
                  children: selectedSuite.benchmarks?.length ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {selectedSuite.benchmarks.map((benchmark) => (
                        <Card key={benchmark.id} size="small" style={panelStyle}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Space direction="vertical" size={2}>
                              <Text strong>{benchmark.name}</Text>
                              <Text type="secondary">版本 {benchmark.version} · Run #{benchmark.runId} · {formatDate(benchmark.createdAt)}</Text>
                            </Space>
                            <Space>
                              {statusTag(benchmark.status)}
                              <Text strong style={{ color: gradeColor(benchmark.score) }}>{benchmark.score} 分</Text>
                              <Tag>{benchmark.grade || '-'}</Tag>
                            </Space>
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  ) : <Empty description="暂无 Benchmark" />,
                },
              ]}
            />
          </Space>
        ) : (
          <Empty description="请选择评测套件" />
        )}
      </Drawer>
    </div>
  );
};

export default EvaluationCenter;
