/**
 * AgentEdit - 编辑 Agent 页面
 */
import React from 'react';
import AgentCreate from './AgentCreate';

const AgentEdit: React.FC = () => {
  // 编辑页面复用创建页面的表单，加载已有数据
  return <AgentCreate />;
};

export default AgentEdit;