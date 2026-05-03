/**
 * AgentDashboard - Agent 工作台
 * 展示用户创建的所有 Agent，支持搜索、排序、点赞、对话
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Button, Typography, Avatar, Tag, Space, Empty, Modal, Dropdown, message, Spin, Input, Select, Grid } from 'antd';
import {
  PlusOutlined, RobotOutlined, MessageOutlined, EditOutlined, DeleteOutlined,
  MoreOutlined, PlayCircleOutlined, SearchOutlined, FireOutlined,
  HeartOutlined, HeartFilled, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { agentsApi, AgentDTO } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import LoginModal from '../components/LoginModal';

const { useBreakpoint } = Grid;
const { Title, Text, Paragraph } = Typography;

function mockHotData(id: number): { visits: number; likes: number } {
  let hash = id * 9973 + 131;
  const visits = 100 + (hash % 9900);
  hash = Math.floor(hash / 7);
  const likes = 10 + (hash % 500);
  return { visits, likes };
}

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'hot' | 'default'>('hot');
  const [likedAgents, setLikedAgents] = useState<Set<number>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { isAuthenticated } = useAuthStore();

  const fetchAgents = async () => {
    setLoading(true);
    try { const data = await agentsApi.list(); setAgents(data?.items || []); } catch (error) { console.error('获取 Agent 列表失败:', error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAgents(); }, []);

  const agentsWithHot = useMemo(() =>
    agents.map(a => { const hot = mockHotData(a.id); return { ...a, _visits: hot.visits, _likes: likedAgents.has(a.id) ? hot.likes + 1 : hot.likes, _liked: likedAgents.has(a.id) }; }),
    [agents, likedAgents]
  );

  const filteredAndSorted = useMemo(() => {
    let list = [...agentsWithHot];
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q) || (a.model || '').toLowerCase().includes(q));
    }
    if (sortBy === 'hot') { list.sort((a, b) => b._visits - a._visits || b._likes - a._likes); }
    return list;
  }, [agentsWithHot, searchText, sortBy]);

  const handleLike = (agentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedAgents(prev => { const next = new Set(prev); if (next.has(agentId)) next.delete(agentId); else next.add(agentId); return next; });
  };

  const handleDeleteAgent = async (agentId: number) => {
    Modal.confirm({
      title: '确认删除 Agent', content: '删除后无法恢复，确定要删除此 Agent 吗？', okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
      onOk: async () => { try { await agentsApi.delete(agentId); message.success('Agent 已删除'); fetchAgents(); } catch { message.error('删除失败'); } },
    });
  };

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = { active: { color: 'green', text: '运行中' }, inactive: { color: 'orange', text: '已停用' }, draft: { color: 'blue', text: '草稿' } };
    const s = config[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  return (
    <div style={{ padding: isMobile ? 0 : 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 0 }}>
        <div>
          <Title level={isMobile ? 4 : 3} style={{ marginBottom: 4 }}><RobotOutlined style={{ marginRight: 8, color: '#6366f1' }} />AI 广场</Title>
          <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>共 {filteredAndSorted.length} 个智能助手</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size={isMobile ? 'small' : 'large'} onClick={() => {
          if (isAuthenticated()) {
            navigate('/agents/create');
          } else {
            setShowLoginModal(true);
          }
        }}
          style={{ background: '#6366f1', alignSelf: isMobile ? 'stretch' : 'auto' }}>{isMobile ? '新建' : '创建 Agent'}</Button>
      </div>

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        redirectTo="/agents/create"
      />

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input placeholder="搜索 Agent 名称或描述..." prefix={<SearchOutlined style={{ color: '#999' }} />} value={searchText}
          onChange={e => setSearchText(e.target.value)} allowClear
          style={{ width: isMobile ? '100%' : 360, borderRadius: 8 }} size={isMobile ? 'middle' : 'large'} />
        <Select value={sortBy} onChange={setSortBy} size={isMobile ? 'small' : 'large'}
          style={{ width: isMobile ? '100%' : 140 }}
          options={[{ value: 'hot', label: '🔥 最热' }, { value: 'default', label: '📋 默认' }]} />
        {searchText && <Text type="secondary">找到 {filteredAndSorted.length} 个结果</Text>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : filteredAndSorted.length === 0 ? (
        <Empty description={searchText ? '没有找到匹配的 Agent，试试其他关键词' : '暂无 Agent，点击上方按钮创建'} style={{ padding: 80 }} />
      ) : (
        <div className="agent-grid">
          <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
            {filteredAndSorted.map((agent) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={agent.id}>
                <Card hoverable style={{ borderRadius: 12, height: isMobile ? 'auto' : 310 }}
                  styles={{ body: { padding: isMobile ? 12 : 16, display: 'flex', flexDirection: 'column', height: '100%' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <Avatar size={44} icon={<RobotOutlined />} style={{ backgroundColor: agent._liked ? '#ff4d4f' : '#6366f1' }} />
                    <div style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 15 }} ellipsis>{agent.name}</Text>
                      <div style={{ marginTop: 2 }}>{getStatusTag(agent.status)}<Tag color="purple" style={{ marginLeft: 4, fontSize: 11 }}>{agent.model}</Tag></div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}><Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>{agent.description || '暂无描述'}</Paragraph></div>
                  <div style={{ marginBottom: 8 }}>
                    <Space size={4} style={{ marginBottom: 6 }}>
                      <Tag icon={<MessageOutlined />}>{agent.skills?.length || 0} Skills</Tag>
                      <Tag icon={<RobotOutlined />}>{(agent.knowledgeBases?.length || 0) > 0 ? agent.knowledgeBases.length + ' KB' : '无 KB'}</Tag>
                      {agent.memoryEnabled && <Tag color="cyan">记忆</Tag>}
                    </Space>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#999' }}>
                      <span><FireOutlined style={{ color: '#ff6b35', marginRight: 4 }} />{agent._visits}</span>
                      <span onClick={e => handleLike(agent.id, e)} style={{ cursor: 'pointer', color: agent._liked ? '#ff4d4f' : '#999' }}>
                        {agent._liked ? <HeartFilled style={{ marginRight: 4 }} /> : <HeartOutlined style={{ marginRight: 4 }} />}{agent._likes}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/chat/' + agent.id)} style={{ background: '#6366f1', flex: 1, marginRight: 8, fontSize: 13 }} size="small">对话</Button>
                    <Dropdown menu={{ items: [{ key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => navigate('/agents/edit/' + agent.id) }, { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => handleDeleteAgent(agent.id) }] }}>
                      <Button icon={<MoreOutlined />} size="small" />
                    </Dropdown>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;