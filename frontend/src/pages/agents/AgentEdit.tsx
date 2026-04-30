/**
 * AgentEdit - 编辑 Agent 页面
 * 加载已有 Agent 数据传给 AgentCreate 进行编辑
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import AgentCreate from './AgentCreate';
import { agentsApi, AgentDTO } from '../../services/api';

const AgentEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agentData, setAgentData] = useState<AgentDTO | null>(null);

  useEffect(() => {
    if (!id) {
      message.error('缺少 Agent ID');
      navigate('/dashboard');
      return;
    }

    const loadAgent = async () => {
      try {
        const data = await agentsApi.getById(Number(id));
        setAgentData(data);
      } catch (error: any) {
        message.error('加载 Agent 数据失败: ' + (error?.message || '未知错误'));
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadAgent();
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#999' }}>加载 Agent 数据中...</div>
      </div>
    );
  }

  if (!agentData) return null;

  return <AgentCreate editId={Number(id)} initialData={agentData} />;
};

export default AgentEdit;