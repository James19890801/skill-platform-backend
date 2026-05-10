import React from 'react';
import {
  ApartmentOutlined,
  AuditOutlined,
  BarChartOutlined,
  BookOutlined,
  BuildOutlined,
  BulbOutlined,
  CalculatorOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloudOutlined,
  CompassOutlined,
  CustomerServiceOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  GlobalOutlined,
  LineChartOutlined,
  LockOutlined,
  MessageOutlined,
  MonitorOutlined,
  PartitionOutlined,
  ProjectOutlined,
  ReadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  TranslationOutlined,
} from '@ant-design/icons';

export type AgentIconToken =
  | 'icon:ai-core'
  | 'icon:insight'
  | 'icon:research'
  | 'icon:data'
  | 'icon:process'
  | 'icon:doc'
  | 'icon:knowledge'
  | 'icon:automation'
  | 'icon:copilot'
  | 'icon:search'
  | 'icon:strategy'
  | 'icon:ops'
  | 'icon:finance'
  | 'icon:legal'
  | 'icon:design'
  | 'icon:security'
  | 'icon:meeting'
  | 'icon:analytics'
  | 'icon:workflow'
  | 'icon:quality'
  | 'icon:lab'
  | 'icon:cloud'
  | 'icon:memory'
  | 'icon:translate'
  | 'icon:planning'
  | 'icon:customer'
  | 'icon:build'
  | 'icon:monitor'
  | 'icon:writing'
  | 'icon:coach';

export interface AgentIconOption {
  token: AgentIconToken;
  label: string;
  glyph: React.ReactNode;
  background: string;
  accent: string;
}

export const DEFAULT_AGENT_ICON: AgentIconToken = 'icon:ai-core';

export const AGENT_ICON_LIBRARY: AgentIconOption[] = [
  { token: 'icon:ai-core', label: 'AI 助手', glyph: icon(RobotOutlined), background: 'linear-gradient(135deg, #2563eb, #14b8a6)', accent: '#dbeafe' },
  { token: 'icon:insight', label: '洞察', glyph: icon(BulbOutlined), background: 'linear-gradient(135deg, #4f46e5, #06b6d4)', accent: '#e0e7ff' },
  { token: 'icon:research', label: '研究', glyph: icon(ReadOutlined), background: 'linear-gradient(135deg, #4338ca, #0f766e)', accent: '#eef2ff' },
  { token: 'icon:data', label: '数据', glyph: icon(BarChartOutlined), background: 'linear-gradient(135deg, #0e7490, #22c55e)', accent: '#cffafe' },
  { token: 'icon:process', label: '流程', glyph: icon(CompassOutlined), background: 'linear-gradient(135deg, #1d4ed8, #65a30d)', accent: '#dbeafe' },
  { token: 'icon:doc', label: '文档', glyph: icon(FileTextOutlined), background: 'linear-gradient(135deg, #475569, #0ea5e9)', accent: '#e2e8f0' },
  { token: 'icon:knowledge', label: '知识库', glyph: icon(BookOutlined), background: 'linear-gradient(135deg, #0891b2, #16a34a)', accent: '#ccfbf1' },
  { token: 'icon:automation', label: '自动化', glyph: icon(SettingOutlined), background: 'linear-gradient(135deg, #334155, #2563eb)', accent: '#e2e8f0' },
  { token: 'icon:copilot', label: '副驾', glyph: icon(MessageOutlined), background: 'linear-gradient(135deg, #0f766e, #4f46e5)', accent: '#ccfbf1' },
  { token: 'icon:search', label: '搜索', glyph: icon(SearchOutlined), background: 'linear-gradient(135deg, #0284c7, #7c3aed)', accent: '#e0f2fe' },
  { token: 'icon:strategy', label: '战略', glyph: icon(ProjectOutlined), background: 'linear-gradient(135deg, #1e40af, #059669)', accent: '#dbeafe' },
  { token: 'icon:ops', label: '运营', glyph: icon(ToolOutlined), background: 'linear-gradient(135deg, #0f766e, #64748b)', accent: '#ccfbf1' },
  { token: 'icon:finance', label: '财务', glyph: icon(CalculatorOutlined), background: 'linear-gradient(135deg, #0369a1, #84cc16)', accent: '#e0f2fe' },
  { token: 'icon:legal', label: '法务', glyph: icon(SafetyCertificateOutlined), background: 'linear-gradient(135deg, #312e81, #0891b2)', accent: '#e0e7ff' },
  { token: 'icon:design', label: '设计', glyph: icon(ApartmentOutlined), background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)', accent: '#ede9fe' },
  { token: 'icon:security', label: '安全', glyph: icon(LockOutlined), background: 'linear-gradient(135deg, #0f172a, #0d9488)', accent: '#e2e8f0' },
  { token: 'icon:meeting', label: '会议', glyph: icon(TeamOutlined), background: 'linear-gradient(135deg, #4338ca, #10b981)', accent: '#e0e7ff' },
  { token: 'icon:analytics', label: '分析', glyph: icon(LineChartOutlined), background: 'linear-gradient(135deg, #0891b2, #4f46e5)', accent: '#cffafe' },
  { token: 'icon:workflow', label: '编排', glyph: icon(PartitionOutlined), background: 'linear-gradient(135deg, #2563eb, #64748b)', accent: '#dbeafe' },
  { token: 'icon:quality', label: '质量', glyph: icon(CheckCircleOutlined), background: 'linear-gradient(135deg, #15803d, #0e7490)', accent: '#dcfce7' },
  { token: 'icon:lab', label: '实验室', glyph: icon(ExperimentOutlined), background: 'linear-gradient(135deg, #0d9488, #7c3aed)', accent: '#ccfbf1' },
  { token: 'icon:cloud', label: '云端', glyph: icon(CloudOutlined), background: 'linear-gradient(135deg, #0284c7, #2563eb)', accent: '#e0f2fe' },
  { token: 'icon:memory', label: '记忆', glyph: icon(DatabaseOutlined), background: 'linear-gradient(135deg, #059669, #4338ca)', accent: '#dcfce7' },
  { token: 'icon:translate', label: '翻译', glyph: icon(TranslationOutlined), background: 'linear-gradient(135deg, #0f766e, #0ea5e9)', accent: '#ccfbf1' },
  { token: 'icon:planning', label: '规划', glyph: icon(CalendarOutlined), background: 'linear-gradient(135deg, #1d4ed8, #4d7c0f)', accent: '#dbeafe' },
  { token: 'icon:customer', label: '客户', glyph: icon(CustomerServiceOutlined), background: 'linear-gradient(135deg, #0e7490, #4d7c0f)', accent: '#cffafe' },
  { token: 'icon:build', label: '构建', glyph: icon(BuildOutlined), background: 'linear-gradient(135deg, #475569, #0d9488)', accent: '#e2e8f0' },
  { token: 'icon:monitor', label: '监控', glyph: icon(MonitorOutlined), background: 'linear-gradient(135deg, #312e81, #14b8a6)', accent: '#ede9fe' },
  { token: 'icon:writing', label: '写作', glyph: icon(EditOutlined), background: 'linear-gradient(135deg, #0891b2, #65a30d)', accent: '#cffafe' },
  { token: 'icon:coach', label: '教练', glyph: icon(AuditOutlined), background: 'linear-gradient(135deg, #2563eb, #0f766e)', accent: '#dbeafe' },
];

function icon(IconComponent: React.ComponentType<any>): React.ReactNode {
  return React.createElement(IconComponent);
}

function resolveIcon(avatar?: string): AgentIconOption | undefined {
  if (!avatar?.startsWith('icon:')) return undefined;
  if (/^icon:\d+$/.test(avatar)) return AGENT_ICON_LIBRARY[0];
  return AGENT_ICON_LIBRARY.find((item) => item.token === avatar);
}

export function renderAgentAvatarContent(avatar?: string, fallback?: React.ReactNode) {
  if (!avatar) return fallback;
  if (avatar.startsWith('data:image/')) return undefined;
  return resolveIcon(avatar)?.glyph || fallback;
}

export function getAgentAvatarStyle(avatar?: string): React.CSSProperties {
  const item = resolveIcon(avatar);
  if (item) {
    return {
      background: item.background,
      color: '#fff',
      fontSize: 22,
      fontWeight: 700,
      lineHeight: 1,
    };
  }
  return {};
}

export function getAgentAvatarSrc(avatar?: string): string | undefined {
  return avatar?.startsWith('data:image/') ? avatar : undefined;
}
