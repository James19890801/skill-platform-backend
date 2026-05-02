import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AgentDashboard from './pages/AgentDashboard';
import AgentCreate from './pages/agents/AgentCreate';
import AgentEdit from './pages/agents/AgentEdit';
import AgentChatCanvas from './pages/chat/AgentChatCanvas';
import SkillHub from './pages/skills/SkillHub';
import SkillDetail from './pages/skills/SkillDetail';
import SkillCreate from './pages/skills/SkillCreate';
import SkillEdit from './pages/skills/SkillEdit';
import KnowledgeManager from './pages/knowledge/KnowledgeManager';
import MemoryManager from './pages/memory/MemoryManager';
import Settings from './pages/settings/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
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
          <Route path="skills/:id" element={<SkillDetail />} />
          <Route path="skills/create" element={<SkillCreate />} />
          <Route path="skills/edit/:id" element={<SkillEdit />} />
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