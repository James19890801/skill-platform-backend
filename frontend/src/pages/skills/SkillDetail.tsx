import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Button, Space, Tabs, Timeline, Table, Spin, Empty, message, Typography } from 'antd';
import { EditOutlined, SendOutlined, HistoryOutlined, ApartmentOutlined, ApiOutlined, CodeOutlined, RobotOutlined, SettingOutlined, FileTextOutlined, ProfileOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { SkillStatus, SkillScope, SkillType, SkillDomain, DomainLabels } from '../../types';
import { skillsApi } from '../../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Text } = Typography;

// 统一视觉语言
const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  bgMain: '#f0f4f8',
  bgCard: '#ffffff',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
};

const domainColors: Record<string, string> = {
  [SkillDomain.MTL_MARKET]: '#3b82f6',
  [SkillDomain.LTC_SALES]: '#10b981',
  [SkillDomain.ITR_SERVICE]: '#f59e0b',
  [SkillDomain.IPD_RD]: '#8b5cf6',
  [SkillDomain.SCM]: '#06b6d4',
  [SkillDomain.PROCUREMENT]: '#f97316',
  [SkillDomain.MANUFACTURING]: '#84cc16',
  [SkillDomain.DELIVERY]: '#14b8a6',
  [SkillDomain.FINANCE]: colors.green,
  [SkillDomain.HR]: colors.purple,
  [SkillDomain.IT]: '#6366f1',
  [SkillDomain.LEGAL]: colors.primary,
  [SkillDomain.STRATEGY]: '#ec4899',
  [SkillDomain.QUALITY]: '#0ea5e9',
  [SkillDomain.RISK]: colors.red,
  [SkillDomain.ADMIN]: colors.textSecondary,
  [SkillDomain.OTHER]: '#9ca3af',
};

const statusConfig: Record<SkillStatus, { color: string; bg: string; label: string }> = {
  [SkillStatus.DRAFT]: { color: colors.textSecondary, bg: '#f1f5f9', label: '草稿' },
  [SkillStatus.REVIEWING]: { color: colors.primary, bg: '#dbeafe', label: '审核中' },
  [SkillStatus.PUBLISHED]: { color: colors.green, bg: '#dcfce7', label: '已发布' },
  [SkillStatus.ARCHIVED]: { color: colors.amber, bg: '#fef3c7', label: '已归档' },
  [SkillStatus.DEPRECATED]: { color: colors.red, bg: '#fee2e2', label: '已废弃' },
};

const scopeLabels: Record<string, string> = {
  [SkillScope.PERSONAL]: '个人',
  [SkillScope.BUSINESS]: '业务',
  [SkillScope.PLATFORM]: '平台',
};

const typeLabels: Record<string, string> = {
  [SkillType.PURE_BUSINESS]: '纯业务型',
  [SkillType.LIGHT_TECH]: '轻技术型',
  [SkillType.HEAVY_TECH]: '重技术型',
};

// 执行方式标签
const executionTypeLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  api: { label: 'API 调用', color: 'blue', icon: <ApiOutlined /> },
  webhook: { label: 'Webhook', color: 'cyan', icon: <CodeOutlined /> },
  rpa: { label: 'RPA 脚本', color: 'purple', icon: <SettingOutlined /> },
  agent: { label: 'AI Agent', color: 'geekblue', icon: <RobotOutlined /> },
  manual: { label: '手动执行', color: 'default', icon: <EditOutlined /> },
};

const SkillDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [skill, setSkill] = useState<any>(null);

  // 从后端加载 Skill 详情
  useEffect(() => {
    const fetchSkill = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await skillsApi.getById(Number(id));
        setSkill({
          ...data,
          // 提供默认值
          subDomain: data.subDomain || '',
          abilityName: data.abilityName || '',
          scope: data.scope || SkillScope.BUSINESS,
          type: data.type || SkillType.LIGHT_TECH,
          status: data.status || SkillStatus.DRAFT,
          orgName: data.orgName || data.organization?.name || '',
          ownerName: data.ownerName || data.owner?.name || '',
          currentVersion: data.currentVersion || '1.0.0',
          usageCount: data.usageCount || 0,
          tags: data.tags || [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      } catch (error) {
        console.error('加载 Skill 详情失败:', error);
        message.error('加载 Skill 详情失败');
      } finally {
        setLoading(false);
      }
    };
    fetchSkill();
  }, [id]);

  // 早期返回：加载中状态
  if (loading) {
    return (
      <div style={{ padding: 24, background: colors.bgMain, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  // 早期返回：数据不存在
  if (!skill) {
    return (
      <div style={{ padding: 24, background: colors.bgMain, minHeight: '100%' }}>
        <Empty description="Skill 不存在" />
      </div>
    );
  }

  // Mock 关联流程数据（保留，后端暂无此接口）
  const relatedProcesses = [
    {
      id: 1,
      name: '合同管理流程',
      nodes: ['法务审核', '领导审批'],
      description: '在合同审核环节自动检查合同条款，识别风险点并给出修改建议，辅助法务人员完成审核工作。',
    },
  ];

  // Mock 版本历史数据（保留，后端暂无此接口）
  const versionHistory = [
    { version: skill?.currentVersion || '1.0.0', status: 'current', date: skill?.updatedAt?.split('T')[0] || '', author: skill?.ownerName || '', changes: '当前版本' },
  ];

  // Mock 岗位绑定数据（保留，后端暂无此接口）
  const boundModels = [
    { id: 1, name: '相关岗位', code: 'RELATED_JOB', orgName: skill?.orgName || '', priority: '推荐', level: 80 },
  ];

  const modelColumns = [
    { title: '岗位名称', dataIndex: 'name', key: 'name', render: (text: string, record: typeof boundModels[0]) => <a onClick={() => navigate(`/models/${record.id}`)}>{text}</a> },
    { title: '岗位代码', dataIndex: 'code', key: 'code', render: (text: string) => <code style={{ fontSize: 12, color: colors.textSecondary }}>{text}</code> },
    { title: '所属组织', dataIndex: 'orgName', key: 'orgName' },
    { title: '优先级', dataIndex: 'priority', key: 'priority', render: (p: string) => <Tag color={p === '必备' ? 'red' : p === '推荐' ? 'blue' : 'default'}>{p}</Tag> },
    { title: '要求掌握度', dataIndex: 'level', key: 'level', render: (l: number) => <span style={{ color: l >= 80 ? colors.green : l >= 60 ? colors.amber : colors.textSecondary }}>{l}%</span> },
  ];

  // ★ 安全解析 JSON
  const safeJson = (str: string | undefined, fallback: unknown = {}) => {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Descriptions bordered column={2} labelStyle={{ background: '#f8fafc', fontWeight: 500, width: 140 }} contentStyle={{ background: '#fff' }}>
          <Descriptions.Item label="Skill 名称">{skill.name}</Descriptions.Item>
          <Descriptions.Item label="命名空间"><code style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, color: colors.primary }}>{skill.namespace}</code></Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{skill.description}</Descriptions.Item>
          <Descriptions.Item label="业务域"><Tag style={{ borderRadius: 10, background: domainColors[skill.domain], color: '#fff', border: 'none' }}>{DomainLabels[skill.domain]}</Tag></Descriptions.Item>
          <Descriptions.Item label="子域">{skill.subDomain}</Descriptions.Item>
          <Descriptions.Item label="范围"><Tag color="green" style={{ borderRadius: 10 }}>{scopeLabels[skill.scope]}</Tag></Descriptions.Item>
          <Descriptions.Item label="类型"><Tag color="blue" style={{ borderRadius: 10 }}>{typeLabels[skill.type]}</Tag></Descriptions.Item>
          <Descriptions.Item label="当前版本"><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{skill.currentVersion}</span></Descriptions.Item>
          <Descriptions.Item label="使用次数"><span style={{ color: colors.amber, fontWeight: 600 }}>{skill.usageCount}</span></Descriptions.Item>
          <Descriptions.Item label="所属组织">{skill.orgName}</Descriptions.Item>
          <Descriptions.Item label="负责人">{skill.ownerName}</Descriptions.Item>
          <Descriptions.Item label="SOP 来源" span={2}><a href={skill.sopSource} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>{skill.sopSource}</a></Descriptions.Item>
          <Descriptions.Item label="标签" span={2}>{skill.tags.map(t => <Tag key={t} style={{ borderRadius: 10, marginRight: 4 }}>{t}</Tag>)}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{skill.createdAt}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{skill.updatedAt}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'process',
      label: '流程关联',
      children: (
        <div>
          {relatedProcesses.map((process) => (
            <Card key={process.id} style={{ marginBottom: 16, borderRadius: 12, border: `1px solid ${colors.border}` }} bodyStyle={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ApartmentOutlined style={{ fontSize: 24, color: colors.primary }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>{process.name}</div>
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ color: colors.textSecondary, fontSize: 13 }}>作用节点：</span>
                    {process.nodes.map(n => <Tag key={n} color="blue" style={{ borderRadius: 10, marginLeft: 8 }}>{n}</Tag>)}
                  </div>
                  <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>{process.description}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ),
    },
    {
      key: 'versions',
      label: '版本历史',
      children: (
        <Timeline items={versionHistory.map((v, idx) => ({
          color: idx === 0 ? 'green' : 'gray',
          children: (
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>v{v.version}</span>
                {v.status === 'current' && <Tag color="green" style={{ borderRadius: 10 }}>当前版本</Tag>}
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>{v.date} · {v.author}</div>
              <div style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 1.6 }}>{v.changes}</div>
            </div>
          ),
        }))} />
      ),
    },
    {
      key: 'bindings',
      label: '岗位绑定',
      children: (
        <Table columns={modelColumns} dataSource={boundModels} rowKey="id" pagination={false} />
      ),
    },
    {
      key: 'skill-content',
      label: 'Skill 内容',
      children: (
        <div>
          {skill.content ? (
            <div style={{
              padding: 24,
              background: '#fff',
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              lineHeight: 1.8,
              fontSize: 14,
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {skill.content}
              </ReactMarkdown>
            </div>
          ) : (
            <Empty description="该 Skill 尚未编写标准正文">
              <Text type="secondary">点击右上角「编辑」按钮，在「Skill 内容」Tab 中编写 Markdown 格式的 Skill 正文</Text>
            </Empty>
          )}
        </div>
      ),
    },
    {
      key: 'execution',
      label: '调用规范',
      children: (
        <div>
          {/* 执行方式概览 */}
          <Card 
            style={{ marginBottom: 16, borderRadius: 12, border: `1px solid ${colors.border}` }} 
            bodyStyle={{ padding: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 12, 
                background: '#dbeafe', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                {skill.executionType && executionTypeLabels[skill.executionType] 
                  ? executionTypeLabels[skill.executionType].icon 
                  : <ApiOutlined style={{ fontSize: 24, color: colors.primary }} />
                }
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>执行配置</div>
                <div style={{ marginTop: 4 }}>
                  <Tag color={skill.executionType && executionTypeLabels[skill.executionType]?.color || 'default'}>
                    {skill.executionType && executionTypeLabels[skill.executionType]?.label || '未配置'}
                  </Tag>
                </div>
              </div>
            </div>

            {/* API 调用配置详情 */}
            {skill.executionType === 'api' && (
              <Descriptions bordered column={1} size="small" labelStyle={{ background: '#f8fafc', width: 140 }}>
                <Descriptions.Item label="API 端点">
                  <code style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4 }}>
                    {skill.endpoint || '-'}
                  </code>
                </Descriptions.Item>
                <Descriptions.Item label="HTTP 方法">
                  <Tag color="blue">{skill.httpMethod || 'POST'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="认证方式">
                  {skill.authConfig ? JSON.parse(skill.authConfig)?.type || '-' : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="请求模板">
                  <pre style={{ 
                    margin: 0, 
                    padding: 12, 
                    background: '#f8fafc', 
                    borderRadius: 8, 
                    fontSize: 12,
                    maxHeight: 150,
                    overflow: 'auto'
                  }}>
                    {skill.requestTemplate || '{\n  "input": "{{content}}"\n}'}
                  </pre>
                </Descriptions.Item>
                <Descriptions.Item label="响应映射">
                  <pre style={{ 
                    margin: 0, 
                    padding: 12, 
                    background: '#f8fafc', 
                    borderRadius: 8, 
                    fontSize: 12 
                  }}>
                    {skill.responseMapping || '{\n  "result": "$.data"\n}'}
                  </pre>
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* AI Agent 配置详情 */}
            {skill.executionType === 'agent' && (
              <Descriptions bordered column={1} size="small" labelStyle={{ background: '#f8fafc', width: 140 }}>
                <Descriptions.Item label="Agent Prompt">
                  <pre style={{ 
                    margin: 0, 
                    padding: 12, 
                    background: '#f8fafc', 
                    borderRadius: 8, 
                    fontSize: 12,
                    maxHeight: 200,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {skill.agentPrompt || '未配置 Agent Prompt'}
                  </pre>
                </Descriptions.Item>
                <Descriptions.Item label="工具定义">
                  <pre style={{ 
                    margin: 0, 
                    padding: 12, 
                    background: '#f8fafc', 
                    borderRadius: 8, 
                    fontSize: 12,
                    maxHeight: 150,
                    overflow: 'auto'
                  }}>
                    {skill.toolDefinition || '[]'}
                  </pre>
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* 错误处理配置 */}
            {skill.errorHandling && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>错误处理策略</Text>
                <Space size={24}>
                  <span><Text type="secondary">重试次数：</Text>{JSON.parse(skill.errorHandling)?.retryCount || 3} 次</span>
                  <span><Text type="secondary">重试间隔：</Text>{JSON.parse(skill.errorHandling)?.retryInterval || 1000} ms</span>
                  <span><Text type="secondary">降级方式：</Text>{JSON.parse(skill.errorHandling)?.fallback || '默认值'}</span>
                </Space>
              </div>
            )}
          </Card>

          {/* 调用示例 */}
          <Card 
            title={<span style={{ fontWeight: 600 }}>外部调用示例</span>}
            style={{ borderRadius: 12, border: `1px solid ${colors.border}` }} 
            bodyStyle={{ padding: 20 }}
          >
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">通过以下方式调用此 Skill：</Text>
            </div>
            <pre style={{ 
              margin: 0, 
              padding: 16, 
              background: '#1e293b', 
              borderRadius: 8, 
              fontSize: 13,
              color: '#e2e8f0',
              overflow: 'auto'
            }}>
{`// cURL 示例
curl -X POST "${skill.endpoint || 'https://api.skill-platform.com/v1/skills/' + skill.id + '/execute'}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "your input content",
    "context": {}
  }'

// 响应格式
{
  "success": true,
  "data": {
    "result": "...",
    "metadata": {}
  }
}`}
            </pre>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: colors.bgMain, minHeight: '100%' }}>
      {/* 顶部信息卡片 */}
      <Card style={{ background: colors.bgCard, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 'none', marginBottom: 24 }} bodyStyle={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>{skill.name}</h1>
              <Tag style={{ borderRadius: 10, background: domainColors[skill.domain] || colors.primary, color: '#fff', border: 'none' }}>{DomainLabels[skill.domain] || skill.domain}</Tag>
              <Tag style={{ borderRadius: 10, background: statusConfig[skill.status]?.bg || '#f1f5f9', color: statusConfig[skill.status]?.color || colors.textSecondary, border: 'none' }}>{statusConfig[skill.status]?.label || skill.status}</Tag>
            </div>
            <code style={{ fontSize: 13, padding: '4px 12px', background: '#f1f5f9', borderRadius: 6, color: colors.textSecondary }}>{skill.namespace}</code>
            <div style={{ marginTop: 12, fontSize: 13, color: colors.textSecondary }}>
              创建于 {skill.createdAt} · 最后更新 {skill.updatedAt}
            </div>
          </div>
          <Space>
            <Button icon={<HistoryOutlined />} style={{ borderRadius: 8 }}>版本历史</Button>
            <Button icon={<EditOutlined />} style={{ borderRadius: 8 }} onClick={() => navigate(`/skills/edit/${id}`)}>编辑</Button>
            {skill.status === SkillStatus.DRAFT && (
              <Button type="primary" icon={<SendOutlined />} style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', borderRadius: 8 }}>
                提交审核
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* Tab 内容 */}
      <Card style={{ background: colors.bgCard, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 'none' }} bodyStyle={{ padding: 24 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  );
};

export default SkillDetail;
