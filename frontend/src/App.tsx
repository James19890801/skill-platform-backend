import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from './layouts/MainLayout';

const AgentDashboard = lazy(() => import('./pages/AgentDashboard'));
const AgentCreate = lazy(() => import('./pages/agents/AgentCreate'));
const AgentEdit = lazy(() => import('./pages/agents/AgentEdit'));
const AgentChatCanvas = lazy(() => import('./pages/chat/AgentChatCanvas'));
const SkillHub = lazy(() => import('./pages/skills/SkillHub'));
const SkillDetail = lazy(() => import('./pages/skills/SkillDetail'));
const SkillCreate = lazy(() => import('./pages/skills/SkillCreate'));
const SkillEdit = lazy(() => import('./pages/skills/SkillEdit'));
const KnowledgeManager = lazy(() => import('./pages/knowledge/KnowledgeManager'));
const MemoryManager = lazy(() => import('./pages/memory/MemoryManager'));
const IntegrationCenter = lazy(() => import('./pages/integration/IntegrationCenter'));
const MonitoringDashboard = lazy(() => import('./pages/monitoring/MonitoringDashboard'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const UserManagement = lazy(() => import('./pages/users/UserManagement'));

const routeFallback = (
  <div style={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
    <Spin />
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Agent 工作台 */}
            <Route path="dashboard" element={<AgentDashboard />} />

            {/* Agent 管理 */}
            <Route path="agents/create" element={<AgentCreate />} />
            <Route path="agents/edit/:id" element={<AgentEdit />} />

            {/* 资源管理 */}
            <Route path="skills" element={<SkillHub />} />
            <Route path="skills/:id" element={<SkillDetail />} />
            <Route path="skills/create" element={<SkillCreate />} />
            <Route path="skills/edit/:id" element={<SkillEdit />} />
            <Route path="knowledge" element={<KnowledgeManager />} />
            <Route path="memory" element={<MemoryManager />} />
            <Route path="integrations" element={<IntegrationCenter />} />
            <Route path="monitoring" element={<MonitoringDashboard />} />

            {/* 设置 */}
            <Route path="settings" element={<Settings />} />

            {/* 用户管理（仅管理员可见） */}
            <Route path="users" element={<UserManagement />} />
          </Route>
          
          <Route path="login" element={<LoginPage />} />
          <Route path="chat" element={<AgentChatCanvas />} />
          <Route path="chat/:agentId" element={<AgentChatCanvas />} />
          <Route path="embed/chat/:agentId" element={<AgentChatCanvas />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
