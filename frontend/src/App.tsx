import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import AgentDashboard from './pages/AgentDashboard';
import AgentCreate from './pages/agents/AgentCreate';
import AgentEdit from './pages/agents/AgentEdit';
import AgentChatCanvas from './pages/chat/AgentChatCanvas';
import SkillHub from './pages/skills/SkillHub';
import KnowledgeManager from './pages/knowledge/KnowledgeManager';
import MemoryManager from './pages/memory/MemoryManager';
import Settings from './pages/settings/Settings';
import { useAuthStore } from './stores/useAuthStore';

// 路由守卫组件 - 免登录自动注入 mock 用户
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, setAuth } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsHydrated(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    if (isHydrated && !token) {
      const mockUser = {
        id: 1,
        name: '管理员',
        email: 'admin@example.com',
        role: 'admin' as const,
        orgId: 1,
        orgName: '总部',
        jobTitle: '平台管理员',
        tenantId: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAuth('mock-token', mockUser);
    }
  }, [isHydrated, token, setAuth]);
  
  if (!isHydrated || !token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1a1a2e' }}>
        <Spin size="large" tip="E2E AI 加载中..." />
      </div>
    );
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          {/* Agent 工作台 */}
          <Route path="dashboard" element={<AgentDashboard />} />
          
          {/* Agent 管理 */}
          <Route path="agents/create" element={<AgentCreate />} />
          <Route path="agents/edit/:id" element={<AgentEdit />} />
          
          {/* 对话 Canvas */}
          <Route path="chat" element={<AgentChatCanvas />} />
          <Route path="chat/:agentId" element={<AgentChatCanvas />} />
          
          {/* 资源管理 */}
          <Route path="skills" element={<SkillHub />} />
          <Route path="knowledge" element={<KnowledgeManager />} />
          <Route path="memory" element={<MemoryManager />} />
          
          {/* 设置 */}
          <Route path="settings" element={<Settings />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;