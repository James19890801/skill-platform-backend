/**
 * AgentChatCanvas - Agent 对话界面（产物驱动 Canvas）
 *
 * 设计：
 * - 平时只有左侧对话区（居中/全宽），右侧 Canvas 隐藏
 * - AI 回复中的代码块、表格被识别为"产物卡片"
 * - 点击产物卡片 → 右侧 Canvas 展开展示详情
 * - 左右分栏支持拖拽调整宽度
 * - 输入框始终固定在底部
 * - 支持多会话管理：历史会话列表、新建会话
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Input,
  Button,
  Typography,
  Space,
  Avatar,
  Tag,
  Spin,
  Select,
  Empty,
  Tooltip,
  Drawer,
  List,
  Modal,
  message,
  Grid,
  Upload,
  Tabs,
  Checkbox,
  Switch,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ClearOutlined,
  AppstoreOutlined,
  CodeOutlined,
  FileTextOutlined,
  CloseOutlined,
  CopyOutlined,
  EyeOutlined,
  HistoryOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  PictureOutlined,
  PaperClipOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  FolderOutlined,
  FileOutlined,
  ReloadOutlined,
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import MermaidRenderer from '../../components/MermaidRenderer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { KnowledgeSourceReference, LlmModel, McpServerConfig, PersonalContextDTO, llmApi, personalContextApi, skillsApi } from '../../services/api';
import type { ISkill } from '../../types';
import {
  getAgentAvatarSrc,
  getAgentAvatarStyle,
  renderAgentAvatarContent,
} from '../../utils/agentAvatars';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  artifacts?: Artifact[];
  knowledgeSources?: KnowledgeSourceReference[];
  status?: 'normal' | 'error';
  retryPayload?: ChatRetryPayload;
  runId?: string;
}

type ChatAttachment = { name: string; type: string; dataUrl: string };

interface ChatRetryPayload {
  content: string;
  attachments: ChatAttachment[];
}

interface Artifact {
  id: string;
  type: 'code' | 'table' | 'document' | 'html' | 'image' | 'json';
  title: string;
  content: string;
  language?: string;
  downloadUrl?: string;  // 文档下载链接
  filename?: string;      // 文档文件名
  token?: string;         // 文档预览/下载 token
  src?: string;           // 图片/HTML 加载地址
}

// Skill 执行状态管理
interface ExecutionLogEntry {
  type: 'round_start' | 'tool_call' | 'tool_result' | 'artifact' | 'round_end' | 'error' | 'done';
  data: {
    round: number;
    action: string;
    toolName?: string;
    status: 'pending' | 'success' | 'error';
    durationMs?: number;
    message: string;
  };
  artifacts?: RuntimeArtifact[];
}

interface RuntimeArtifact {
  name: string;
  path: string;
  type: string;
  size: number;
  workspaceId?: string;
  downloadUrl?: string;
  mimeType?: string;
}

interface ExecutionState {
  skillName: string;
  skillId: number;
  logs: ExecutionLogEntry[];
  artifacts: RuntimeArtifact[];
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  runId?: string;
  lastHeartbeatAt?: number;
  heartbeatCount?: number;
  output?: string;
  totalRounds?: number;
  totalDurationMs?: number;
}

interface ConversationSummary {
  threadId: string;
  messageCount: number;
  firstMessage: string;
}

interface WorkspaceFile {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'dir' | 'directory';
  mimeType?: string;
  modifiedAt: string;
  children?: WorkspaceFile[];
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';
const STREAM_IDLE_TIMEOUT_MS = 45_000;
const CHAT_REQUEST_TIMEOUT_MS = 10 * 60_000;
const INITIAL_STREAM_RETRY_LIMIT = 2;

const AgentChatCanvas: React.FC = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const currentUser = useAuthStore((state) => state.user);
  const authToken = useAuthStore((state) => state.token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeKnowledgeSource, setActiveKnowledgeSource] = useState<KnowledgeSourceReference | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen-plus');
  const [availableModels, setAvailableModels] = useState<LlmModel[]>([]);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<'preview' | 'code'>('preview');
  const [leftWidth, setLeftWidth] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const queryThreadId = searchParams.get('threadId') || searchParams.get('thread_id') || '';

  // 会话管理状态
  const [currentThreadId, setCurrentThreadId] = useState<string>(
    `thread-${Date.now()}`
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Workspace 文件管理
  const [workspaceVisible, setWorkspaceVisible] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  // 附件上传状态
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [chatSkills, setChatSkills] = useState<ISkill[]>([]);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);

  // Skill 执行状态
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);

  // Agent 名称
  const [agentName, setAgentName] = useState<string>('');
  const [agentAvatar, setAgentAvatar] = useState<string>('');

  // 个人上下文：用户自己的知识库、MCP 和记忆
  const [personalContextOpen, setPersonalContextOpen] = useState(false);
  const [personalContext, setPersonalContext] = useState<PersonalContextDTO | null>(null);
  const [personalContextError, setPersonalContextError] = useState<string | null>(null);
  const [loadingPersonalContext, setLoadingPersonalContext] = useState(false);
  const [savingPersonalContext, setSavingPersonalContext] = useState(false);
  const [personalKnowledgeIds, setPersonalKnowledgeIds] = useState<number[]>([]);
  const [personalMcpJson, setPersonalMcpJson] = useState('{\n  "mcpServers": {}\n}');
  const [newPersonalMemory, setNewPersonalMemory] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartLeftWidth = useRef(0);
  const activeRunIdRef = useRef<string | null>(null);

  const getSkillCommand = useCallback((value: string) => {
    const slashIndex = value.lastIndexOf('/');
    if (slashIndex < 0) return null;
    const beforeSlash = slashIndex > 0 ? value[slashIndex - 1] : '';
    if (beforeSlash && !/\s/.test(beforeSlash)) return null;
    const query = value.slice(slashIndex + 1);
    if (/[\n\r]/.test(query) || query.includes(' ')) return null;
    return { slashIndex, query: query.trim().toLowerCase() };
  }, []);

  const skillCommand = useMemo(() => getSkillCommand(inputValue), [getSkillCommand, inputValue]);

  const filteredCommandSkills = useMemo(() => {
    if (!skillCommand) return [];
    const q = skillCommand.query;
    return chatSkills
      .filter((skill) => {
        if (!q) return true;
        return [
          skill.name,
          skill.namespace,
          skill.description,
          skill.domain,
          skill.subDomain,
          skill.abilityName,
        ]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(q));
      })
      .slice(0, 8);
  }, [chatSkills, skillCommand]);

  const insertSkillCommand = useCallback((skill: ISkill) => {
    const command = getSkillCommand(inputValue);
    if (!command) return;
    const prefix = inputValue.slice(0, command.slashIndex);
    const suffix = inputValue.slice(command.slashIndex + command.query.length + 1).trimStart();
    const inserted = `使用技能「${skill.name}」：`;
    setInputValue(`${prefix}${inserted}${suffix ? ` ${suffix}` : ''}`);
    setSkillPickerOpen(false);
  }, [getSkillCommand, inputValue]);

  useEffect(() => {
    llmApi.listModels()
      .then((data) => {
        const chatModels = data.filter((model) => model.capability === 'chat');
        setAvailableModels(chatModels);
        setSelectedModel((current) => (
          chatModels.length > 0 && !chatModels.some((model) => model.code === current)
            ? chatModels[0].code
            : current
        ));
      })
      .catch(() => {
        setAvailableModels([
          { code: 'qwen-plus', model: 'qwen-plus', label: 'Plus', capability: 'chat', enabled: true },
          { code: 'qwen-turbo', model: 'qwen-turbo', label: 'Turbo', capability: 'chat', enabled: true },
          { code: 'qwen-max', model: 'qwen-max', label: 'Max', capability: 'chat', enabled: true },
        ]);
      });
  }, []);

  useEffect(() => {
    skillsApi.list({ limit: 100 } as any)
      .then((data) => setChatSkills(data?.items || []))
      .catch(() => setChatSkills([]));
  }, []);

  // 添加悬停效果的样式
  useEffect(() => {
    const styleId = 'artifact-card-hover-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .artifact-card:hover .artifact-actions {
          opacity: 1;
        }
        
        .artifact-table {
          border-collapse: collapse;
          width: 100%;
          font-size: 13px;
        }
        
        .artifact-table th,
        .artifact-table td {
          border: 1px solid #ddd;
          padding: 8px 12px;
          text-align: left;
        }
        
        .artifact-table th {
          background-color: #f5f5f5;
          font-weight: 600;
        }
        
        .artifact-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        .artifact-table-container {
          overflow: auto;
          max-height: 400px;
        }
        
        .msg-bubble-wrapper .message-actions {
          opacity: 0;
          transition: opacity 0.2s;
          display: flex;
          gap: 4px;
          align-items: center;
          margin-top: 2px;
        }
        .msg-bubble-wrapper:hover .message-actions {
          opacity: 1;
        }
        .message-actions .ant-btn {
          opacity: 0.4;
          transition: opacity 0.15s;
        }
        .message-actions .ant-btn:hover {
          opacity: 1;
        }
        
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .placeholder-cursor {
          animation: blink-cursor 1s ease-in-out infinite;
          color: #111827;
          font-weight: bold;
        }
        
        /* 智能体头像：裁掉 logo 外圈白边 */
        .agent-avatar-logo .ant-avatar-img img {
          clip-path: circle(46% at 50% 50%);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildWorkspaceDownloadUrl = useCallback((filePath: string, workspaceId?: string) => {
    const pathValue = (filePath || '').trim().replace(/^\.?\//, '');
    const thread = workspaceId || currentThreadId;
    return `${API_BASE}/workspace/${encodeURIComponent(thread)}/files?download=${encodeURIComponent(pathValue)}`;
  }, [currentThreadId]);

  const getRuntimeArtifactDownloadUrl = useCallback((artifact: RuntimeArtifact) => {
    if (artifact.downloadUrl) return artifact.downloadUrl;
    return buildWorkspaceDownloadUrl(artifact.path || artifact.name, artifact.workspaceId);
  }, [buildWorkspaceDownloadUrl]);

  const normalizeMessageHref = useCallback((href?: string) => {
    if (!href) return '#';
    const trimmed = href.trim();
    if (/^(https?:|mailto:|tel:|data:|blob:)/i.test(trimmed)) return trimmed;

    const filePath = decodeURIComponent(trimmed.split('#')[0].split('?')[0] || '').replace(/^\.?\//, '');
    if (/\.(docx?|xlsx?|pptx?|pdf|html?|csv|json|md|png|jpe?g|gif|webp)$/i.test(filePath)) {
      const fileName = filePath.split('/').pop() || filePath;
      const runtimeArtifact = executionState?.artifacts.find((artifact) => (
        artifact.name === fileName ||
        artifact.name === filePath ||
        artifact.path === filePath ||
        artifact.path === fileName ||
        artifact.path.endsWith(`/${filePath}`) ||
        artifact.path.endsWith(`/${fileName}`)
      ));
      if (runtimeArtifact) {
        return getRuntimeArtifactDownloadUrl(runtimeArtifact);
      }
      return buildWorkspaceDownloadUrl(filePath);
    }

    return trimmed;
  }, [buildWorkspaceDownloadUrl, executionState?.artifacts, getRuntimeArtifactDownloadUrl]);

  // ★ 解析产物：从 AI 内容中提取代码块、表格、文档下载链接、HTML、图片
  const parseArtifacts = useCallback((content: string): Artifact[] => {
    const artifacts: Artifact[] = [];
    const seen = new Set<string>();
    let idx = 0;
    let match: RegExpExecArray | null;

    // 匹配文档下载链接：真实 URL 直接使用；相对文件名兜底改成 workspace 下载 URL
    const docRegex = /\[([^\]]+\.(?:docx?|xlsx?|pptx?|html?|pdf|csv|json))\]\(([^)\s]+)\)/gi;
    while ((match = docRegex.exec(content)) !== null) {
      const normalizedUrl = normalizeMessageHref(match[2]);
      const key = `doc-${match[1]}-${normalizedUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      artifacts.push({
        id: `artifact-doc-${idx++}`,
        type: 'document',
        title: match[1],
        content: '',
        downloadUrl: normalizedUrl,
        filename: match[1],
      });
    }

    // 匹配 HTML 代码块
    const htmlCodeRegex = /```html\n?([\s\S]*?)```/g;
    while ((match = htmlCodeRegex.exec(content)) !== null) {
      const html = match[1].trim();
      if (html.length < 50 || seen.has(`html-${html.slice(0, 40)}`)) continue;
      seen.add(`html-${html.slice(0, 40)}`);
      artifacts.push({
        id: `artifact-html-${idx++}`,
        type: 'html',
        title: 'HTML 产物',
        content: html,
      });
    }

    // 匹配完整的 HTML 文档（非代码块内）
    const fullHtmlRegex = /(?:^|\n)((?:<!DOCTYPE html>|<html)[\s\S]*?<\/html>)/i;
    while ((match = fullHtmlRegex.exec(content)) !== null) {
      const html = match[1].trim();
      if (html.length < 100 || seen.has(`doc-${html.slice(0, 40)}`)) continue;
      seen.add(`doc-${html.slice(0, 40)}`);
      artifacts.push({
        id: `artifact-doc-${idx++}`,
        type: 'html',
        title: 'HTML 文档',
        content: html,
      });
    }

    // 匹配 JSON 代码块
    const jsonCodeRegex = /```json\n?([\s\S]*?)```/g;
    while ((match = jsonCodeRegex.exec(content)) !== null) {
      const json = match[1].trim();
      if (json.length < 50 || seen.has(`json-${json.slice(0, 40)}`)) continue;
      seen.add(`json-${json.slice(0, 40)}`);
      try {
        JSON.parse(json); // 验证是合法 JSON
        artifacts.push({
          id: `artifact-json-${idx++}`,
          type: 'json',
          title: 'JSON 数据',
          content: json,
        });
      } catch { /* ignore invalid JSON */ }
    }

    // 匹配图片引用: ![alt](url) 且 url 以图片扩展名结尾
    const imgRegex = /!\[([^\]]*)\]\(([^)]+\.(?:png|jpg|jpeg|gif|svg|webp)(?:\?[^)]*)?)\)/gi;
    while ((match = imgRegex.exec(content)) !== null) {
      if (seen.has(`img-${match[2]}`)) continue;
      seen.add(`img-${match[2]}`);
      artifacts.push({
        id: `artifact-img-${idx++}`,
        type: 'image',
        title: match[1] || '图片',
        content: '',
        src: match[2],
        filename: match[2].split('/').pop(),
      });
    }

    // 匹配代码块 ```lang\ncode\n```（排除已匹配的 html/json）
    const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
    while ((match = codeRegex.exec(content)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trim();
      if (['html', 'json'].includes(lang)) continue; // 已处理
      if (code.length < 20) continue;
      const key = `code-${lang}-${code.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      artifacts.push({
        id: `artifact-code-${idx++}`,
        type: 'code',
        title: `${lang || '代码'} 产物`,
        content: code,
        language: lang,
      });
    }

    // 匹配表格 | col1 | col2 |
    const tablePattern = '\\|[^\\n]+\\|\\n\\|[-:\\s|]+\\|\\n(?:\\|[^\\n]+\\|\\n?)+';
    const tableRegex = new RegExp(tablePattern, 'g');
    while ((match = tableRegex.exec(content)) !== null) {
      const key = `table-${match[0].slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      artifacts.push({
        id: `artifact-table-${idx++}`,
        type: 'table',
        title: `表格产物`,
        content: match[0],
      });
    }

    return artifacts;
  }, [normalizeMessageHref]);

  // ★ 检测 Mermaid 代码块
  const isMermaidCode = (code: string): boolean => {
    const firstLine = code.trim().split('\n')[0].trim();
    return /^(graph\s+(TD|LR|BT|RL)|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|flowchart\s+(TD|LR|BT|RL)|journey|gitgraph|timeline|mindmap|xychart|block|packet|quadrantChart|requirementDiagram)/i.test(firstLine);
  };

  // ★ 清理 HTML 标签和 markdown 乱码
  const cleanText = (text: string): string => {
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, (m) => m.replace(/^\s*\d+\.\s+/, ''))
      .replace(/[○●◆◇]/g, '')
      .trim();
  };

  // ★ 渲染消息内容（基于 react-markdown，产物以卡片触发 Canvas，避免挤占正常对话空间）
  const renderMessageContent = (content: string, artifacts?: Artifact[], execution?: ExecutionState | null) => {
    const artifactElements: JSX.Element[] = [];
  
    if (artifacts && artifacts.length > 0) {
      artifacts.forEach((artifact) => {
        if (artifact.type === 'table') return;

        // ★ HTML 类型：点击后进入 Canvas 预览
        if (artifact.type === 'html') {
          artifactElements.push(
            <div
              key={artifact.id}
              className="artifact-card artifact-compact-card"
              onClick={() => openCanvas(artifact)}
            >
              <Space size={10}>
                <span className="artifact-card-icon"><GlobalOutlined /></span>
                <div style={{ minWidth: 0 }}>
                  <Text strong style={{ display: 'block', fontSize: 13 }} ellipsis>{artifact.title || 'HTML 页面'}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>点击在 Canvas 中预览网页</Text>
                </div>
              </Space>
              <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); openCanvas(artifact); }}>
                打开
              </Button>
            </div>
          );
          return;
        }

        // ★ 图片类型：点击后进入 Canvas 查看
        if (artifact.type === 'image') {
          const imgSrc = artifact.src || artifact.content;
          artifactElements.push(
            <div
              key={artifact.id}
              className="artifact-card artifact-compact-card"
              onClick={() => openCanvas(artifact)}
            >
              <Space size={10}>
                <img
                  src={imgSrc}
                  alt={artifact.title}
                  className="artifact-thumb"
                  loading="lazy"
                />
                <div style={{ minWidth: 0 }}>
                  <Text strong style={{ display: 'block', fontSize: 13 }} ellipsis>{artifact.filename || artifact.title}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>点击在 Canvas 中查看原图</Text>
                </div>
              </Space>
              <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); openCanvas(artifact); }}>
                查看
              </Button>
            </div>
          );
          return;
        }

        // ★ JSON 类型：点击后进入 Canvas 展开
        if (artifact.type === 'json') {
          let formatted = '';
          try {
            formatted = JSON.stringify(JSON.parse(artifact.content), null, 2);
          } catch {
            formatted = artifact.content;
          }
          artifactElements.push(
            <div
              key={artifact.id}
              className="artifact-card artifact-compact-card"
              onClick={() => openCanvas(artifact)}
            >
              <Space size={10}>
                <span className="artifact-card-icon"><FileTextOutlined /></span>
                <div style={{ minWidth: 0 }}>
                  <Text strong style={{ display: 'block', fontSize: 13 }}>JSON 数据</Text>
                  <Text type="secondary" style={{ fontSize: 11 }} ellipsis>{formatted.slice(0, 96)}</Text>
                </div>
              </Space>
              <Space size={4}>
                <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); openCanvas(artifact); }}>
                  展开
                </Button>
                <Button
                  size="small"
                  type="link"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(artifact.content); }}
                >
                  复制
                </Button>
              </Space>
            </div>
          );
          return;
        }

        // ★ 文档类型：独立渲染卡片
        if (artifact.type === 'document') {
          artifactElements.push(
            <div
              key={artifact.id}
              className="artifact-card"
              style={{
                marginTop: 10,
                padding: '8px 12px',
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8e8e8';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => openCanvas(artifact)}
            >
              <Space size={8}>
                <FileTextOutlined style={{ color: '#6366f1', fontSize: 15 }} />
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{artifact.filename}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>点击预览</Text>
              </Space>
              <Button
                size="small"
                type="link"
                onClick={(e) => {
                  e.stopPropagation();
                  if (artifact.downloadUrl) {
                    window.open(artifact.downloadUrl, '_blank');
                  }
                }}
                style={{ fontSize: 11, color: '#6366f1', padding: '0 4px' }}
              >
                下载
              </Button>
            </div>
          );
          return;
        }
          
        const isMermaid = artifact.type === 'code' && isMermaidCode(artifact.content);

        artifactElements.push(
          <div
            key={artifact.id}
            className="artifact-card"
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: '#fafbfc',
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (isMermaid) return;
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
            }}
            onMouseLeave={(e) => {
              if (isMermaid) return;
              e.currentTarget.style.borderColor = '#e8e8e8';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => !isMermaid && openCanvas(artifact)}
          >
            <Space size={8}>
              {isMermaid ? (
                <Tag color="purple" style={{ margin: 0, fontSize: 12 }}>
                  流程图
                </Tag>
              ) : (
                <>
                  <CodeOutlined style={{ color: '#6366f1', fontSize: 14 }} />
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>{artifact.title}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>点击查看</Text>
                </>
              )}
            </Space>
            {isMermaid ? (
              <MermaidRenderer chart={artifact.content} id={`inline-mermaid-${artifact.id}`} />
            ) : artifact.type === 'code' && (
              <pre
                style={{
                  margin: '6px 0 0',
                  padding: 8,
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  borderRadius: 6,
                  fontSize: 11,
                  maxHeight: 60,
                  overflow: 'hidden',
                  lineHeight: 1.4,
                }}
              >
                <code>{artifact.content.slice(0, 200)}{artifact.content.length > 200 ? '...' : ''}</code>
              </pre>
            )}
            {!isMermaid && (
              <div
                className="artifact-actions"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 8,
                  opacity: 0,
                  transition: 'opacity 0.15s',
                }}
              >
                <Tooltip title="复制">
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    type="text"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(artifact.content);
                    }}
                    style={{ fontSize: 11, color: '#999', padding: '0 4px', height: 24 }}
                  />
                </Tooltip>
              </div>
            )}
          </div>
        );
      });
    }

    // 预处理：清理 <br> 标签（ReactMarkdown 自动处理其余所有 GFM 格式）
    const preprocessed = content.replace(/<br\s*\/?>/gi, '\n');

    // ReactMarkdown 自定义组件：渲染表格/Mermaid/代码块
    const renderContent = (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 13,
                border: '1px solid #e2e8f0', borderRadius: 6,
              }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead style={{ background: '#f1f5f9' }}>{children}</thead>,
          th: ({ children }) => (
            <th style={{
              padding: '8px 12px', borderBottom: '2px solid #e2e8f0',
              textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ padding: '6px 12px', borderBottom: '1px solid #e2e8f0' }}>
              {children}
            </td>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em' }}>{children}</code>;
            }
            const codeContent = String(children).replace(/\n$/, '');
            if (isMermaidCode(codeContent)) {
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1', marginBottom: 8 }}>
                    📊 流程图
                  </div>
                  <MermaidRenderer chart={codeContent} id={`md-mermaid-${Math.random().toString(36).slice(2, 8)}`} />
                </div>
              );
            }
            return (
              <pre style={{
                background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8,
                padding: 12, fontSize: 12, overflow: 'auto', lineHeight: 1.5, marginBottom: 12,
              }}>
                <code>{codeContent}</code>
              </pre>
            );
          },
          p: ({ children }) => (
            <Text style={{ whiteSpace: 'pre-wrap', display: 'block', marginBottom: 8, lineHeight: 1.7 }}>
              {children}
            </Text>
          ),
          ul: ({ children }) => (
            <ul style={{ paddingLeft: 20, marginLeft: 0, marginBottom: 8, listStyleType: 'disc' }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ paddingLeft: 22, marginLeft: 0, marginBottom: 8 }}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li style={{ marginLeft: 0, marginBottom: 4, lineHeight: 1.7 }}>
              {children}
            </li>
          ),
          a: ({ href, children }) => {
            const safeHref = normalizeMessageHref(href);
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (safeHref === '#') event.preventDefault();
                }}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {preprocessed}
      </ReactMarkdown>
    );
  
    return (
      <div>
        {renderContent}
        {artifactElements}
        {execution && renderExecutionBox(execution)}
      </div>
    );
  };

  /**
   * 渲染 Skill 执行进度 Box（固定高度、可滚动）
   */
  const renderExecutionBox = (exec: ExecutionState): JSX.Element => {
    const isRunning = exec.status === 'running';
    const totalMs = exec.totalDurationMs || (Date.now() - exec.startTime);
    
    // 状态颜色
    const statusColor = isRunning ? '#6366f1' : exec.status === 'completed' ? '#10b981' : '#ef4444';
    const statusBg = isRunning ? '#eef2ff' : exec.status === 'completed' ? '#ecfdf5' : '#fef2f2';
    const statusText = isRunning ? '执行中...' : exec.status === 'completed' ? '执行完成' : '执行失败';
    const latestLog = exec.logs[exec.logs.length - 1];
    const liveStatusText = latestLog?.data?.message || (isRunning ? '正在等待后台进度...' : statusText);

    // 工具调用统计
    const totalCalls = exec.logs.filter(l => l.type === 'tool_call').length;
    const successCalls = exec.logs.filter(l => l.type === 'tool_result' && l.data.status === 'success').length;
    const errorCalls = exec.logs.filter(l => l.type === 'tool_result' && l.data.status === 'error').length;

    return (
      <div style={{
        marginTop: 12,
        border: `1px solid ${isRunning ? '#c7d2fe' : '#d1d5db'}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: '#fff',
      }}>
        {/* 头部 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: statusBg,
          borderBottom: `1px solid ${isRunning ? '#c7d2fe' : '#e5e7eb'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
              animation: isRunning ? 'blink-cursor 1s ease-in-out infinite' : 'none',
            }} />
            <Text strong style={{ fontSize: 13 }}>{exec.skillName}</Text>
            <Tag color={isRunning ? 'processing' : exec.status === 'completed' ? 'success' : 'error'} style={{ fontSize: 11, margin: 0 }}>
              {statusText}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {exec.logs.length} 步 · {(totalMs / 1000).toFixed(1)}s
            {exec.heartbeatCount ? ` · 心跳 ${exec.heartbeatCount}` : ''}
          </Text>
        </div>
        {isRunning && (
          <div style={{
            padding: '6px 12px',
            background: '#f8fafc',
            borderBottom: '1px solid #edf2f7',
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{liveStatusText}</Text>
          </div>
        )}

        {/* 日志列表 — 固定高度可滚动 */}
        <div style={{
          maxHeight: 280,
          overflow: 'auto',
          padding: '4px 0',
        }}>
          {exec.logs.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>正在初始化...</Text>
            </div>
          ) : (
            exec.logs.map((log, i) => {
              const d = log.data;
              const isError = d.status === 'error';
              const isPending = d.status === 'pending';
              
              // 图标
              let icon = '🔄';
              if (log.type === 'tool_call') icon = '⚡';
              else if (log.type === 'tool_result') icon = isError ? '❌' : '✅';
              else if (log.type === 'round_start') icon = '📋';
              else if (log.type === 'round_end') icon = '📦';
              else if (log.type === 'artifact') icon = '📄';
              else if (log.type === 'error') icon = '🚨';
              else if (log.type === 'done') icon = '🎉';

              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '5px 12px',
                  borderLeft: `3px solid ${isError ? '#ef4444' : isPending ? '#6366f1' : 'transparent'}`,
                  background: isError ? '#fef2f2' : isPending ? '#f8f9fb' : 'transparent',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}>
                  <span style={{ flexShrink: 0, fontSize: 13 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{
                        fontSize: 12,
                        color: isError ? '#dc2626' : isPending ? '#6366f1' : '#374151',
                        fontWeight: isPending ? 500 : 400,
                      }}>
                        {d.message}
                      </Text>
                      {d.durationMs && (
                        <Text type="secondary" style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                          {d.durationMs}ms
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {isRunning && (
            <div style={{ padding: '6px 12px', textAlign: 'center' }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                后台仍在运行，断线后会尝试接回当前任务
              </Text>
            </div>
          )}
        </div>

        {/* 底部：产物统计 */}
        {exec.artifacts.length > 0 && (
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid #f0f0f0',
            background: '#fafafa',
          }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>
              📦 交付物 ({exec.artifacts.length})
            </Text>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {exec.artifacts.map((a, i) => (
                <Button
                  key={`${a.path || a.name}-${i}`}
                  size="small"
                  type="link"
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(getRuntimeArtifactDownloadUrl(a), '_blank')}
                  style={{ height: 22, padding: '0 4px', fontSize: 11 }}
                >
                  {a.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const openCanvas = (artifact: Artifact) => {
    setCurrentArtifact(artifact);
    setCanvasOpen(true);
    setCanvasViewMode('preview');
    setLeftWidth(60);
  };

  const closeCanvas = () => {
    setCanvasOpen(false);
    setCurrentArtifact(null);
    setLeftWidth(100);
  };

  // ★ 拖拽调整宽度
  const handleDragStart = (e: React.MouseEvent) => {
    if (!canvasOpen) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartLeftWidth.current = leftWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const dx = e.clientX - dragStartX.current;
      const dxPercent = (dx / containerWidth) * 100;
      let newLeft = dragStartLeftWidth.current + dxPercent;
      newLeft = Math.max(40, Math.min(80, newLeft));
      setLeftWidth(newLeft);
    };

    const handleDragEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  const sendMessage = async (retryPayload?: ChatRetryPayload) => {
    const outgoingContent = (retryPayload?.content ?? inputValue).trim();
    if (!outgoingContent || isLoading) return;

    const outgoingAttachments = retryPayload?.attachments
      ? retryPayload.attachments.map((item) => ({ ...item }))
      : attachments.map((item) => ({ ...item }));

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: outgoingContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setAttachments([]);
    setInputValue('');
    setIsLoading(true);
    setExecutionState(null);

    // ★ 乐观渲染：立即显示占位消息，不等后端返回
    const placeholderId = `msg-assistant-opt-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: placeholderId,
      role: 'assistant',
      content: '正在准备回答...',
      timestamp: new Date(),
    }]);

    let assistantContent = '';
    let hasAssistantContent = false;
    let knowledgeSources: KnowledgeSourceReference[] = [];
    let activeRunId = '';
    activeRunIdRef.current = null;

    const updateAssistantMessage = (content: string, patch: Partial<Message> = {}) => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        const nextMessage: Message = {
          ...(lastMsg?.role === 'assistant' && lastMsg.id.startsWith('msg-assistant')
            ? lastMsg
            : {
                id: `msg-assistant-${Date.now()}`,
                role: 'assistant' as const,
                timestamp: new Date(),
              }),
          content,
          knowledgeSources,
          status: 'normal',
          retryPayload: undefined,
          ...patch,
        };
        if (lastMsg?.role === 'assistant' && lastMsg.id.startsWith('msg-assistant')) {
          return [...prev.slice(0, -1), nextMessage];
        }
        return [...prev, nextMessage];
      });
    };

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const getReadableChatError = (error: any) => {
      const raw = String(error?.message || error || '未知错误');
      if (!navigator.onLine) return '当前网络已断开，请恢复网络后重试';
      if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
        return '无法连接到服务，可能是网络波动或后端服务暂时不可用';
      }
      return raw;
    };

    const pollRunUntilDone = async (runId: string, headers: Record<string, string>) => {
      const startedAt = Date.now();
      let pollCount = 0;
      updateAssistantMessage(`${assistantContent || '后台任务已开始。'}\n\n连接中断，正在接回当前任务...`, {
        runId,
      });

      while (Date.now() - startedAt < CHAT_REQUEST_TIMEOUT_MS) {
        pollCount += 1;
        await delay(Math.min(2500 + pollCount * 500, 6000));

        const resp = await fetch(`${API_BASE}/threads/${encodeURIComponent(currentThreadId)}/runs/${encodeURIComponent(runId)}`, {
          headers,
        });
        if (!resp.ok) {
          throw new Error(`后台任务状态查询失败: ${resp.status}`);
        }

        const body = await resp.json();
        const run = body?.data || body;
        const status = run?.status || 'unknown';

        setExecutionState((prev) => prev && prev.status === 'running'
          ? {
              ...prev,
              runId,
              lastHeartbeatAt: Date.now(),
              heartbeatCount: (prev.heartbeatCount || 0) + 1,
            }
          : prev);

        if (status === 'completed') {
          const output = String(run.output || '后台任务已完成。');
          assistantContent = output;
          hasAssistantContent = true;
          updateAssistantMessage(output, { runId });
          return;
        }

        if (status === 'failed' || status === 'cancelled') {
          throw new Error(run.error || `后台任务${status === 'cancelled' ? '已取消' : '执行失败'}`);
        }

        const base = assistantContent || '后台任务仍在执行中。';
        updateAssistantMessage(`${base}\n\n连接已恢复为状态轮询：${status}，已等待 ${Math.round((Date.now() - startedAt) / 1000)} 秒...`, {
          runId,
        });
      }

      throw new Error('后台任务仍未完成，请稍后从历史会话查看结果');
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const streamRequestBody = JSON.stringify({
        input: userMessage.content,
        model: selectedModel,
        agent_id: agentId ? Number(agentId) : undefined,
        stream: true,
        attachments: outgoingAttachments.length > 0 ? outgoingAttachments : undefined,
      });
      const chatRequestBody = JSON.stringify({
        thread_id: currentThreadId,
        message: userMessage.content,
        model: selectedModel,
        agentId: agentId ? Number(agentId) : undefined,
        stream: true,
        attachments: outgoingAttachments.length > 0 ? outgoingAttachments : undefined,
      });

      const runStreamAttempt = async () => {
        const controller = new AbortController();
        let streamStarted = false;
        let abortReason = '请求已取消';
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        const totalTimer = setTimeout(() => {
          abortReason = '回答执行超过 10 分钟，已停止等待';
          controller.abort();
        }, CHAT_REQUEST_TIMEOUT_MS);

        const resetIdleTimer = () => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            abortReason = '连接长时间没有新内容，已停止等待';
            controller.abort();
          }, STREAM_IDLE_TIMEOUT_MS);
        };

        const clearTimers = () => {
          if (idleTimer) clearTimeout(idleTimer);
          clearTimeout(totalTimer);
        };

        try {
          resetIdleTimer();
          let response = await fetch(`${API_BASE}/threads/${encodeURIComponent(currentThreadId)}/runs/stream`, {
            method: 'POST',
            headers,
            body: streamRequestBody,
            signal: controller.signal,
          });
          resetIdleTimer();

          if (response.status === 404) {
            response = await fetch(`${API_BASE}/ai/chat`, {
              method: 'POST',
              headers,
              body: chatRequestBody,
              signal: controller.signal,
            });
            resetIdleTimer();
          }

          if (!response.ok) {
            const bodyText = await response.text().catch(() => '');
            const apiError = new Error(`API 响应失败: ${response.status}${bodyText ? `，${bodyText.slice(0, 180)}` : ''}`);
            (apiError as any).retryable = response.status === 408 || response.status === 429 || response.status >= 500;
            throw apiError;
          }

          streamStarted = true;
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('浏览器没有收到可读取的响应流');
          }

          const decoder = new TextDecoder();
          let pendingBuffer = '';

          for (;;) {
            const { done, value } = await reader.read();
            resetIdleTimer();
            if (done) {
              if (pendingBuffer.trim()) {
                pendingBuffer += '\n';
              } else {
                break;
              }
            } else {
              pendingBuffer += decoder.decode(value, { stream: true });
            }

            const lines = pendingBuffer.split('\n');
            pendingBuffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();
                if (dataStr === '[DONE]' || dataStr === '') continue;

                let data: any;
                try {
                  data = JSON.parse(dataStr);
                } catch {
                  continue;
                }

                if (data.type === 'heartbeat') {
                  setExecutionState((prev) => prev && prev.status === 'running'
                    ? {
                        ...prev,
                        lastHeartbeatAt: Date.now(),
                        heartbeatCount: (prev.heartbeatCount || 0) + 1,
                      }
                    : prev);
                  continue;
                }

                if (data.type === 'run_start' && data.data?.runId) {
                  activeRunId = data.data.runId;
                  activeRunIdRef.current = activeRunId;
                  updateAssistantMessage('后台任务已创建，正在进入执行队列...', { runId: activeRunId });
                  continue;
                }

                if (data.type === 'run_status' && data.data?.runId) {
                  activeRunId = data.data.runId;
                  activeRunIdRef.current = activeRunId;
                  if (!hasAssistantContent) {
                    updateAssistantMessage(data.data.status === 'running' ? '后台任务运行中，正在等待执行进度...' : `后台任务状态：${data.data.status}`, {
                      runId: activeRunId,
                    });
                  }
                  continue;
                }

                if (data.run_id && data.status) {
                  activeRunId = data.run_id;
                  activeRunIdRef.current = activeRunId;
                }

                if (data.type === 'error' || data.error) {
                  throw new Error(data.content || data.error || 'AI 服务返回错误');
                }

                // ★ 处理 Skill 执行事件
                if (data.type === 'execution_start') {
                  setExecutionState({
                    skillName: data.data.skillName,
                    skillId: data.data.skillId,
                    logs: [],
                    artifacts: [],
                    status: 'running',
                    startTime: Date.now(),
                    runId: activeRunId || undefined,
                  });
                  assistantContent += `\n\n> **Skill 执行中**: ${data.data.skillName}\n`;
                  hasAssistantContent = true;
                  updateAssistantMessage(assistantContent, { runId: activeRunId || undefined });
                  continue;
                }

                if (data.type === 'execution_progress' && data.data) {
                  const progress = data.data;
                  setExecutionState((prev) => {
                    if (!prev) return null;
                    const newLogs = [...prev.logs, {
                      type: progress.type,
                      data: progress.data,
                      artifacts: progress.artifacts,
                    }];
                    return {
                      ...prev,
                      logs: newLogs,
                      artifacts: progress.artifacts || prev.artifacts,
                    };
                  });
                  continue;
                }

                if (data.type === 'execution_done' && data.data) {
                  const doneData = data.data;
                  const artifactLines = Array.isArray(doneData.artifacts)
                    ? doneData.artifacts
                      .map((artifact: RuntimeArtifact) => {
                        const url = getRuntimeArtifactDownloadUrl(artifact);
                        return artifact?.name ? `- [${artifact.name}](${url})` : '';
                      })
                      .filter(Boolean)
                    : [];
                  setExecutionState((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      status: 'completed',
                      artifacts: doneData.artifacts || prev.artifacts,
                      totalRounds: doneData.totalRounds,
                      totalDurationMs: doneData.totalDurationMs,
                      output: doneData.output,
                    };
                  });
                  assistantContent += `\n${doneData.skillName} 执行完成。共 ${doneData.totalRounds} 轮，耗时 ${(doneData.totalDurationMs / 1000).toFixed(1)} 秒，产出 ${doneData.artifacts?.length || 0} 个交付物。`;
                  if (artifactLines.length > 0) {
                    assistantContent += `\n\n交付物\n${artifactLines.join('\n')}`;
                  }
                  updateAssistantMessage(assistantContent, { runId: activeRunId || undefined });
                  continue;
                }

                if (data.type === 'status' && data.content && !hasAssistantContent) {
                  updateAssistantMessage(data.content);
                  continue;
                }

                if (data.type === 'knowledge_sources' && Array.isArray(data.data)) {
                  knowledgeSources = data.data;
                  updateAssistantMessage(assistantContent || '正在检索知识库...');
                  continue;
                }

                if (data.type === 'content' && data.content) {
                  if (!hasAssistantContent) {
                    hasAssistantContent = true;
                    assistantContent = '';
                  }
                  assistantContent += data.content;
                  updateAssistantMessage(assistantContent);
                }
              }
            }

            if (done) break;
          }
        } catch (error: any) {
          if (controller.signal.aborted) {
            error = new Error(abortReason);
          }
          error.streamStarted = streamStarted;
          throw error;
        } finally {
          clearTimers();
        }
      };

      for (let attempt = 1; attempt <= INITIAL_STREAM_RETRY_LIMIT; attempt += 1) {
        try {
          await runStreamAttempt();
          break;
        } catch (error: any) {
          if (error.streamStarted && activeRunId) {
            await pollRunUntilDone(activeRunId, headers);
            break;
          }
          const canAutoRetry = attempt < INITIAL_STREAM_RETRY_LIMIT && error.retryable !== false && !error.streamStarted && !hasAssistantContent;
          if (!canAutoRetry) {
            throw error;
          }
          updateAssistantMessage(`连接中断，正在自动重试（${attempt + 1}/${INITIAL_STREAM_RETRY_LIMIT}）...`);
          await delay(800 * attempt);
        }
      }

      // 流式结束后，解析产物
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant') {
          const artifacts = parseArtifacts(lastMsg.content);
          return [...prev.slice(0, -1), { ...lastMsg, artifacts, knowledgeSources: lastMsg.knowledgeSources || knowledgeSources }];
        }
        return prev;
      });

    } catch (error: any) {
      const readableError = getReadableChatError(error);
      const partialContent = assistantContent.trim();
      const errorContent = partialContent
        ? `${partialContent}\n\n---\n\n回答中断：${readableError}`
        : `回答中断：${readableError}\n\n你可以检查网络后重试，或稍后再试。`;
      // 更新占位消息为错误信息
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        const retryMessagePatch = {
          content: errorContent,
          status: 'error' as const,
          retryPayload: { content: userMessage.content, attachments: outgoingAttachments },
          timestamp: new Date(),
        };
        if (lastMsg?.role === 'assistant' && lastMsg.id.startsWith('msg-assistant')) {
          return [...prev.slice(0, -1), { ...lastMsg, ...retryMessagePatch }];
        }
        return [...prev, {
          id: `msg-fallback-${Date.now()}`,
          role: 'assistant',
          ...retryMessagePatch,
        }];
      });
      message.error('回答中断，可点击重试');
    }

    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    setCanvasOpen(false);
    setCurrentArtifact(null);
    setLeftWidth(100);
    setExecutionState(null);
    activeRunIdRef.current = null;
  };

  // ★ 导出整个对话为 Word
  const exportChatAsWord = async () => {
    const fullContent = messages.map(m => (m.role === 'user' ? `用户: ${m.content}` : `助手: ${m.content}`)).join('\n\n');
    if (!fullContent.trim()) { message.warning('没有内容可导出'); return; }
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';
      const token = useAuthStore.getState().token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(`${API_BASE}/ai/export-docx`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: fullContent, format: 'docx', filename: `对话记录_${Date.now()}.docx` }),
      });
      if (!resp.ok) { throw new Error('导出失败'); }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `对话记录_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      message.error('导出失败: ' + (e.message || '未知错误'));
    }
  };

  // ★ 复制整个对话
  const copyAllMessages = () => {
    const text = messages.map(m => (m.role === 'user' ? `用户: ${m.content}` : `助手: ${m.content}`)).join('\n\n---\n\n');
    if (!text.trim()) { message.warning('没有内容可复制'); return; }
    navigator.clipboard.writeText(text);
    message.success('已复制全部对话');
  };

  // ★ 文件上传处理（限制 10MB）
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      message.warning(`文件「${file.name}」超过 10MB 大小限制，请压缩后重试`);
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setAttachments(prev => [...prev, { name: file.name, type: file.type, dataUrl }]);
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ============ 会话管理 ============

  // 加载历史会话列表
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let resp = await fetch(`${API_BASE}/threads`);
      if (resp.status === 404) {
        resp = await fetch(`${API_BASE}/ai/conversations`);
      }
      if (resp.ok) {
        const data = await resp.json();
        // 兼容全局拦截器包装格式 {success, data, timestamp}
        const raw = data?.data || data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
            ? raw.items.map((thread: any) => ({
              threadId: thread.id,
              messageCount: thread.messageCount || 0,
              firstMessage: thread.firstMessage || thread.title || '(空对话)',
              lastMessageTime: thread.updatedAt || thread.createdAt,
            }))
            : [];
        setConversations(list);
      }
    } catch {
      // 静默失败，可能是服务未启动
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // 切换到指定会话
  const switchConversation = useCallback(async (threadId: string) => {
    setHistoryVisible(false);
    setCurrentThreadId(threadId);
    setMessages([]);
    setCanvasOpen(false);
    setIsLoading(true);

    try {
      let resp = await fetch(`${API_BASE}/threads/${encodeURIComponent(threadId)}/messages`);
      if (resp.status === 404) {
        resp = await fetch(`${API_BASE}/ai/conversations/${encodeURIComponent(threadId)}`);
      }
      if (resp.ok) {
        const data = await resp.json();
        // 兼容全局拦截器包装格式 {success, data, timestamp}
        const raw = data?.data || data;
        const historyMessages: Message[] = (raw.messages || []).map(
          (m: { role: string; content: string }, i: number) => ({
            id: `msg-history-${i}-${Date.now()}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(),
          })
        );
        setMessages(historyMessages);
      }
    } catch {
      message.error('加载历史会话失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (queryThreadId && queryThreadId !== currentThreadId) {
      switchConversation(queryThreadId);
    }
  }, [currentThreadId, queryThreadId, switchConversation]);

  // 新建对话
  const newConversation = () => {
    setMessages([]);
    setCurrentThreadId(`thread-${Date.now()}`);
    setCanvasOpen(false);
    setCurrentArtifact(null);
    setLeftWidth(100);
    setHistoryVisible(false);
  };

  // 初始加载会话列表
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 每次消息变化后刷新会话列表
  useEffect(() => {
    if (messages.length > 0) {
      loadConversations();
    }
  }, [loadConversations, messages.length]);

  // ★ 获取 Agent 名称
  useEffect(() => {
    if (!agentId) return;
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`${API_BASE}/agents/${agentId}`, { headers })
      .then(res => res.json())
      .then(data => {
        const agent = data?.data || data;
        if (agent?.name) setAgentName(agent.name);
        if (agent?.avatar) setAgentAvatar(agent.avatar);
      })
      .catch(() => {});
  }, [agentId]);

  // ★ 前端预热：唤醒 Railway 冷启动 + 每4分钟心跳保活
  useEffect(() => {
    const warmup = () => {
      fetch(`${API_BASE}/ai/health`, { method: 'GET', mode: 'cors' }).catch(() => {});
    };

    warmup(); // 组件挂载时立即预热（触发 Railway 容器启动）
    const interval = setInterval(warmup, 4 * 60 * 1000); // 每4分钟保活（Railway 空闲超时 5-15分钟）
    return () => clearInterval(interval);
  }, []);

  // ============ Workspace 文件管理 ============

  const loadWorkspaceFiles = useCallback(async () => {
    if (!currentThreadId) return;
    setLoadingWorkspace(true);
    try {
      const resp = await fetch(`${API_BASE}/workspace/${encodeURIComponent(currentThreadId)}/tree`);
      if (resp.ok) {
        const data = await resp.json();
        // 兼容全局拦截器双层包装 {success,data:{success,data:{tree}}} 和单层 {success,data:{tree}}
        const tree = data?.data?.data?.tree || data?.data?.tree || data?.tree || [];
        setWorkspaceFiles(tree);
      }
    } catch {
      message.error('加载工作区文件失败');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [currentThreadId]);

  // 打开 workspace 面板时自动加载
  useEffect(() => {
    if (workspaceVisible) {
      loadWorkspaceFiles();
    }
  }, [workspaceVisible, loadWorkspaceFiles]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleWorkspaceFileClick = async (file: WorkspaceFile) => {
    if (file.type === 'directory' || file.type === 'dir') return;
    const downloadUrl = `${API_BASE}/workspace/${encodeURIComponent(currentThreadId)}/files?download=${encodeURIComponent(file.path)}`;

    // HTML 文件：直接内联预览
    if (file.mimeType === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      try {
        const resp = await fetch(downloadUrl);
        const html = await resp.text();
        openCanvas({
          id: `workspace-html-${Date.now()}`,
          type: 'html',
          title: file.name,
          content: html,
          filename: file.name,
        });
      } catch {
        window.open(downloadUrl, '_blank');
      }
      return;
    }

    // 图片文件：Canvas 预览
    if (file.mimeType?.startsWith('image/')) {
      openCanvas({
        id: `workspace-img-${Date.now()}`,
        type: 'image',
        title: file.name,
        content: '',
        src: downloadUrl,
        filename: file.name,
        downloadUrl,
      });
      return;
    }

    // JSON 文件
    if (file.mimeType === 'application/json' || file.name.endsWith('.json')) {
      try {
        const resp = await fetch(downloadUrl);
        const text = await resp.text();
        openCanvas({
          id: `workspace-json-${Date.now()}`,
          type: 'json',
          title: file.name,
          content: text,
          filename: file.name,
        });
      } catch {
        window.open(downloadUrl, '_blank');
      }
      return;
    }

    const previewTypes = ['text/plain', 'text/markdown', 'text/csv',
      'application/json', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    const canPreview = file.mimeType && previewTypes.includes(file.mimeType);

    if (canPreview) {
      window.open(downloadUrl, '_blank');
    } else {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleDeleteWorkspaceFile = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const resp = await fetch(
        `${API_BASE}/workspace/${encodeURIComponent(currentThreadId)}/files?delete=${encodeURIComponent(file.path)}`,
        { method: 'DELETE' },
      );
      if (resp.ok) {
        message.success(`已删除: ${file.name}`);
        loadWorkspaceFiles();
      } else {
        message.error('删除失败');
      }
    } catch {
      message.error('删除失败');
    }
  };

  const renderFileTree = (files: WorkspaceFile[], depth: number = 0): JSX.Element[] => {
    return files.map((file) => {
      const isDir = file.type === 'directory' || file.type === 'dir';
      const icon = isDir ? (
        <FolderOutlined style={{ color: '#faad14', fontSize: 15 }} />
      ) : (
        <FileOutlined style={{ color: '#6366f1', fontSize: 15 }} />
      );

      return (
        <div key={file.path}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              paddingLeft: 16 + depth * 20,
              borderRadius: 6,
              cursor: isDir ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => handleWorkspaceFileClick(file)}
          >
            <Space size={8} style={{ flex: 1, minWidth: 0 }}>
              {icon}
              <Text
                style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={file.name}
              >
                {file.name}
              </Text>
              {!isDir && (
                <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                  {formatFileSize(file.size)}
                </Text>
              )}
            </Space>
            {!isDir && (
              <Space size={2}>
                <Tooltip title="下载">
                  <Button
                    type="text"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWorkspaceFileClick(file);
                    }}
                    style={{ fontSize: 12, color: '#999' }}
                  />
                </Tooltip>
                <Tooltip title="删除">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDeleteWorkspaceFile(file, e)}
                    style={{ fontSize: 12, color: '#999' }}
                    danger
                  />
                </Tooltip>
              </Space>
            )}
          </div>
          {isDir && file.children && file.children.length > 0 && (
            <div>{renderFileTree(file.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  // ★ 文档预览状态
  const [docPreviewHtml, setDocPreviewHtml] = useState<string>('');
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);

  // 当文档 artifact 打开时，获取预览 HTML
  useEffect(() => {
    if (currentArtifact?.type === 'document' && currentArtifact.token) {
      setDocPreviewLoading(true);
      setDocPreviewHtml('');
      const previewUrl = `${API_BASE}/ai/preview/${currentArtifact.token}`;
      fetch(previewUrl)
        .then(res => res.text())
        .then(html => {
          setDocPreviewHtml(html);
          setDocPreviewLoading(false);
        })
        .catch(() => {
          setDocPreviewHtml('<p style="color:red;text-align:center;padding:40px;">预览加载失败，请尝试直接下载</p>');
          setDocPreviewLoading(false);
        });
    }
  }, [currentArtifact?.id, currentArtifact?.type, currentArtifact?.token]);

  // Canvas 内容渲染
  const renderCanvasContent = () => {
    if (!currentArtifact) {
      return (
        <Empty description="点击对话中的产物卡片查看详情" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Text type="secondary">产物将在 Canvas 中展开展示</Text>
        </Empty>
      );
    }

    const { content, type, language, src, filename } = currentArtifact;

    // ★ HTML 预览：内嵌完整 iframe
    if (type === 'html') {
      return (
        <iframe
          srcDoc={content}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
          title="HTML 预览"
          sandbox="allow-same-origin allow-scripts"
        />
      );
    }

    // ★ 图片预览
    if (type === 'image') {
      const imgSrc = src || content;
      return (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <img
            src={imgSrc}
            alt={filename || '图片'}
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
          />
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{filename}</Text>
          </div>
        </div>
      );
    }

    // ★ JSON 预览：格式化展示
    if (type === 'json') {
      let formatted = '';
      try {
        formatted = JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        formatted = content;
      }
      return (
        <div>
          <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>JSON · {formatted.split('\n').length} 行</Text>
          </div>
          <pre style={{ margin: 0, padding: 16, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6, maxHeight: 'calc(100vh - 250px)' }}>
            <code>{formatted}</code>
          </pre>
        </div>
      );
    }

    // ★ 文档预览：内嵌 iframe 展示 HTML（由后端 mammoth 转换）
    if (type === 'document') {
      if (docPreviewLoading) {
        return (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>正在加载文档预览...</Text>
          </div>
        );
      }
      if (!docPreviewHtml) {
        return <Text type="secondary">正在准备预览...</Text>;
      }
      return (
        <iframe
          srcDoc={docPreviewHtml}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
          title="文档预览"
          sandbox="allow-same-origin"
        />
      );
    }

    if (canvasViewMode === 'code') {
      return (
        <pre style={{ margin: 0, padding: 16, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6 }}>
          <code>{content}</code>
        </pre>
      );
    }

    // 预览模式
    if (type === 'code') {
      return (
        <pre style={{ margin: 0, padding: 16, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6 }}>
          <code>{content}</code>
        </pre>
      );
    }

    if (type === 'table') {
      // 解析表格内容
      const rows = content.trim().split('\n').filter(row => row.trim() !== '');
      if (rows.length < 2) {
        return <Text>无法解析表格数据</Text>;
      }
      
      // 找到分隔线位置（包含 --- 的行）
      let separatorIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].includes('|---') || rows[i].includes(':-') || rows[i].includes('-:')) {
          separatorIndex = i;
          break;
        }
      }
      
      if (separatorIndex === -1) {
        // 如果没有找到分隔线，则第一行为表头
        separatorIndex = 0;
      }
      
      const headers = rows[separatorIndex - 1]?.split('|').filter(Boolean).map(h => h.trim()) || [];
      const dataRows = rows.slice(separatorIndex + 1).map(row => row.split('|').filter(Boolean).map(c => c.trim()));

      return (
        <div className="artifact-table-container">
          <table className="artifact-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return <Text>{content}</Text>;
  };

  const hydratePersonalContext = (context: PersonalContextDTO) => {
    setPersonalContext(context);
    setPersonalKnowledgeIds((context.knowledgeBaseIds || []).map(Number));
    const servers = (context.mcpServers || []) as McpServerConfig[];
    setPersonalMcpJson(JSON.stringify({ mcpServers: servers }, null, 2));
  };

  const loadPersonalContext = useCallback(async () => {
    if (!authToken) {
      setPersonalContext(null);
      setPersonalKnowledgeIds([]);
      setPersonalContextError(null);
      return;
    }
    setLoadingPersonalContext(true);
    setPersonalContextError(null);
    try {
      const context = await personalContextApi.get();
      hydratePersonalContext(context);
    } catch (error: any) {
      setPersonalContextError(error?.response?.data?.message || '个人设置暂时不可用');
    } finally {
      setLoadingPersonalContext(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (personalContextOpen) {
      loadPersonalContext();
    }
  }, [personalContextOpen, loadPersonalContext]);

  const savePersonalKnowledge = async () => {
    setSavingPersonalContext(true);
    try {
      await personalContextApi.update({ knowledgeBaseIds: personalKnowledgeIds });
      await loadPersonalContext();
      message.success('个人知识库设置已保存');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '保存失败');
    } finally {
      setSavingPersonalContext(false);
    }
  };

  const savePersonalMemorySwitch = async (enabled: boolean) => {
    if (!personalContext) return;
    hydratePersonalContext({ ...personalContext, memoryEnabled: enabled });
    try {
      await personalContextApi.update({ memoryEnabled: enabled });
      await loadPersonalContext();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '保存失败');
    }
  };

  const savePersonalMcp = async () => {
    setSavingPersonalContext(true);
    try {
      const parsed = JSON.parse(personalMcpJson || '{}');
      await personalContextApi.update({ mcpServers: parsed });
      await loadPersonalContext();
      message.success('个人 MCP 已保存');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'MCP JSON 格式不正确');
    } finally {
      setSavingPersonalContext(false);
    }
  };

  const addPersonalMemory = async () => {
    const value = newPersonalMemory.trim();
    if (!value) return;
    setSavingPersonalContext(true);
    try {
      await personalContextApi.createMemory({
        key: value.slice(0, 24),
        value,
        category: 'fact',
      });
      setNewPersonalMemory('');
      await loadPersonalContext();
      message.success('个人记忆已保存');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '保存失败');
    } finally {
      setSavingPersonalContext(false);
    }
  };

  const deletePersonalMemory = async (memoryId: number) => {
    try {
      await personalContextApi.deleteMemory(memoryId);
      await loadPersonalContext();
      message.success('个人记忆已删除');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败');
    }
  };

  const addMarketplaceMcp = (server: McpServerConfig) => {
    try {
      const parsed = JSON.parse(personalMcpJson || '{}');
      const current = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.mcpServers)
          ? parsed.mcpServers
          : Object.values(parsed?.mcpServers || {});
      const nextServers = [
        ...current.filter((item: any) => item?.id !== server.id && item?.name !== server.name),
        server,
      ];
      setPersonalMcpJson(JSON.stringify({ mcpServers: nextServers }, null, 2));
      message.success(`已加入 ${server.name}，保存后生效`);
    } catch {
      setPersonalMcpJson(JSON.stringify({ mcpServers: [server] }, null, 2));
    }
  };

  const renderPersonalContextDrawer = () => {
    const knowledgeBases = personalContext?.knowledgeBases || [];
    const memories = personalContext?.memories || [];
    const marketplaceItems = personalContext?.mcpMarketplace?.items || [];

    return (
      <Drawer
        title={
          <Space>
            <SettingOutlined style={{ color: '#2563eb' }} />
            <span>个人上下文</span>
          </Space>
        }
        placement="right"
        open={personalContextOpen}
        onClose={() => setPersonalContextOpen(false)}
        width={isMobile ? '100%' : 520}
        styles={{ body: { padding: 0 } }}
      >
        {!authToken ? (
          <div className="personal-context-empty">
            <UserOutlined />
            <Title level={5}>登录后可使用个人上下文</Title>
            <Text type="secondary">个人知识库、MCP 和记忆只对你的账号生效。</Text>
            <Button type="primary" onClick={() => navigate('/login')} style={{ marginTop: 16 }}>
              去登录
            </Button>
          </div>
        ) : loadingPersonalContext ? (
          <div className="personal-context-empty">
            <Spin />
            <Text type="secondary">正在加载个人设置...</Text>
          </div>
        ) : personalContextError ? (
          <div className="personal-context-empty">
            <SettingOutlined />
            <Title level={5}>个人设置暂时不可用</Title>
            <Text type="secondary">
              主对话不受影响。你可以稍后重试，或先进入资源管理维护知识库。
            </Text>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              {personalContextError}
            </Text>
            <Space style={{ marginTop: 16 }}>
              <Button onClick={() => navigate('/knowledge')}>打开知识库</Button>
              <Button type="primary" onClick={loadPersonalContext}>重试</Button>
            </Space>
          </div>
        ) : (
          <Tabs
            className="personal-context-tabs"
            defaultActiveKey="knowledge"
            items={[
              {
                key: 'knowledge',
                label: '个人知识库',
                children: (
                  <div className="personal-context-pane">
                    <div className="personal-context-note">
                      这些知识库会和当前 Agent 的公共知识库一起检索，但只对你自己的会话生效。
                    </div>
                    {knowledgeBases.length === 0 ? (
                      <Empty description="还没有个人知识库" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                        <Button onClick={() => navigate('/knowledge')}>去创建知识库</Button>
                      </Empty>
                    ) : (
                      <Checkbox.Group
                        value={personalKnowledgeIds}
                        onChange={(values) => setPersonalKnowledgeIds(values.map(Number))}
                        style={{ width: '100%' }}
                      >
                        <div className="personal-context-list">
                          {knowledgeBases.map((kb) => (
                            <label key={kb.id} className="personal-context-row">
                              <Checkbox value={kb.id} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <Text strong style={{ display: 'block' }} ellipsis>{kb.name}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {kb.documentCount || 0} 文档 · {kb.chunkCount || 0} 切片 · {kb.status}
                                </Text>
                              </div>
                              <Button size="small" type="link" onClick={(event) => { event.preventDefault(); navigate('/knowledge'); }}>
                                管理
                              </Button>
                            </label>
                          ))}
                        </div>
                      </Checkbox.Group>
                    )}
                    <div className="personal-context-actions">
                      <Button onClick={() => navigate('/knowledge')}>打开知识库</Button>
                      <Button type="primary" loading={savingPersonalContext} onClick={savePersonalKnowledge}>
                        保存选择
                      </Button>
                    </div>
                  </div>
                ),
              },
              {
                key: 'mcp',
                label: '个人 MCP',
                children: (
                  <div className="personal-context-pane">
                    <div className="personal-context-note">
                      可从市场加入，也可粘贴 Claude / Cursor 风格 MCP JSON；保存后并入当前会话运行时。
                    </div>
                    <div className="personal-mcp-market">
                      {marketplaceItems.slice(0, 8).map((server) => (
                        <button
                          type="button"
                          key={server.id || server.name}
                          className="personal-mcp-card"
                          onClick={() => addMarketplaceMcp(server)}
                        >
                          <Text strong>{server.name}</Text>
                          <Text type="secondary">{server.description}</Text>
                        </button>
                      ))}
                    </div>
                    <TextArea
                      value={personalMcpJson}
                      onChange={(event) => setPersonalMcpJson(event.target.value)}
                      autoSize={{ minRows: 9, maxRows: 14 }}
                      spellCheck={false}
                      style={{ fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: 12 }}
                    />
                    <div className="personal-context-actions">
                      <Button onClick={() => setPersonalMcpJson(JSON.stringify({ mcpServers: [] }, null, 2))}>
                        清空
                      </Button>
                      <Button type="primary" loading={savingPersonalContext} onClick={savePersonalMcp}>
                        保存 MCP
                      </Button>
                    </div>
                  </div>
                ),
              },
              {
                key: 'memory',
                label: '个人记忆',
                children: (
                  <div className="personal-context-pane">
                    <div className="personal-memory-head">
                      <div>
                        <Text strong>个人记忆开关</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                          开启后，系统会把这些记忆注入你的对话上下文。
                        </Text>
                      </div>
                      <Switch checked={personalContext?.memoryEnabled !== false} onChange={savePersonalMemorySwitch} />
                    </div>
                    <Space.Compact style={{ width: '100%', marginBottom: 14 }}>
                      <Input
                        value={newPersonalMemory}
                        onChange={(event) => setNewPersonalMemory(event.target.value)}
                        onPressEnter={addPersonalMemory}
                        placeholder="例如：我偏好中文回答，并给出可执行步骤"
                      />
                      <Button type="primary" loading={savingPersonalContext} onClick={addPersonalMemory}>
                        添加
                      </Button>
                    </Space.Compact>
                    {memories.length === 0 ? (
                      <Empty description="暂无个人记忆" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <div className="personal-context-list">
                        {memories.map((memory) => (
                          <div key={memory.id} className="personal-context-row">
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <Text strong style={{ display: 'block' }} ellipsis>{memory.key}</Text>
                              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{memory.value}</Text>
                            </div>
                            <Button
                              danger
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => deletePersonalMemory(memory.id)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    );
  };

  const sidebarItems = conversations.length > 0
    ? conversations
    : messages.length > 0
      ? [{
          threadId: currentThreadId,
          messageCount: messages.length,
          firstMessage: messages.find(m => m.role === 'user')?.content || '当前对话',
        }]
      : [];

  const workbenchPanelOpen = canvasOpen;

  return (
    <div ref={containerRef} className="agent-workbench agent-workbench-fullscreen" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏：只保留对话必要动作 */}
      <div className="agent-chat-topbar">
        <Space size={isMobile ? 6 : 10} className="agent-chat-topbar-left">
          {isMobile && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/dashboard')}
              className="agent-plaza-button"
            />
          )}
          <div className="agent-topbar-avatar" style={{
            background: getAgentAvatarSrc(agentAvatar) ? '#eef2ff' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
            backgroundImage: getAgentAvatarSrc(agentAvatar) ? `url(${getAgentAvatarSrc(agentAvatar)})` : undefined,
            backgroundSize: 'cover',
            ...getAgentAvatarStyle(agentAvatar),
          }}>
            {renderAgentAvatarContent(agentAvatar, <RobotOutlined style={{ color: '#fff', fontSize: isMobile ? 13 : 14 }} />)}
          </div>
          <div className="agent-topbar-title">
            <Text strong ellipsis style={{ fontSize: isMobile ? 15 : 16, display: 'block', lineHeight: 1.25 }}>
              {agentName || (agentId ? `Agent #${agentId}` : 'AI 对话')}
            </Text>
            {!isMobile && (
              <Tooltip title="点击复制 Thread ID">
                <Text
                  className="agent-thread-chip"
                  onClick={() => { navigator.clipboard.writeText(currentThreadId); message.success('Thread ID 已复制'); }}
                >
                  Thread #{currentThreadId.slice(-6)}
                </Text>
              </Tooltip>
            )}
          </div>
        </Space>
        <Space size="small">
          {isMobile ? (
            <>
              <Tooltip title="个人设置">
                <Button
                  icon={<SettingOutlined />}
                  size="small"
                  type="text"
                  onClick={() => setPersonalContextOpen(true)}
                />
              </Tooltip>
              <Tooltip title="历史会话">
                <Button
                  icon={<HistoryOutlined />}
                  size="small"
                  type="text"
                  onClick={() => { loadConversations(); setHistoryVisible(true); }}
                />
              </Tooltip>
              <Tooltip title="新建对话">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={newConversation}
                  style={{ color: '#6366f1' }}
                />
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip title="历史会话">
                <Button
                  icon={<HistoryOutlined />}
                  size="small"
                  type="text"
                  onClick={() => { loadConversations(); setHistoryVisible(true); }}
                />
              </Tooltip>
              <Tooltip title="清空对话">
                <Button
                  icon={<ClearOutlined />}
                  size="small"
                  type="text"
                  onClick={clearChat}
                />
              </Tooltip>
              <Tooltip title="新建对话">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={newConversation}
                  style={{ color: '#6366f1' }}
                />
              </Tooltip>
              <Tooltip title="工作区文件">
                <Button
                  icon={<FolderOpenOutlined />}
                  size="small"
                  type="text"
                  onClick={() => setWorkspaceVisible(true)}
                />
              </Tooltip>
              <Tooltip title="个人设置">
                <Button
                  icon={<SettingOutlined />}
                  size="small"
                  type="text"
                  onClick={() => setPersonalContextOpen(true)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      </div>

      {/* 主区域：对话 + Canvas */}
      <div
        className={`agent-chat-body ${sidebarCollapsed ? 'agent-chat-body-sidebar-collapsed' : ''}`}
        style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}
      >
        {!isMobile && (
          <>
            <aside className={`agent-chat-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`} aria-hidden={sidebarCollapsed}>
              {!sidebarCollapsed && (
                <>
                  <div className="agent-chat-sidebar-header">
                    <Button icon={<AppstoreOutlined />} block onClick={() => navigate('/dashboard')} className="agent-sidebar-plaza">
                      广场
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} block onClick={newConversation}>
                      新对话
                    </Button>
                  </div>
                  <div className="agent-chat-list">
                    {loadingHistory ? (
                      <div style={{ padding: 24, textAlign: 'center' }}><Spin size="small" /></div>
                    ) : sidebarItems.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有会话" style={{ marginTop: 40 }} />
                    ) : (
                      sidebarItems.map((item) => (
                        <div
                          key={item.threadId}
                          className={`agent-chat-item ${item.threadId === currentThreadId ? 'active' : ''}`}
                          onClick={() => item.threadId !== currentThreadId && switchConversation(item.threadId)}
                        >
                          <div className="agent-chat-item-title">{item.firstMessage || '未命名对话'}</div>
                          <div className="agent-chat-item-meta">{item.messageCount} 条消息 · #{item.threadId.slice(-6)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div
                    className="agent-chat-sidebar-footer agent-chat-sidebar-footer-clickable"
                    onClick={() => setPersonalContextOpen(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setPersonalContextOpen(true);
                    }}
                  >
                    <Avatar size={28} icon={<UserOutlined />} style={{ background: '#2563eb' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text strong style={{ display: 'block', fontSize: 13 }} ellipsis>{currentUser?.email || '个人设置'}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>知识库 · MCP · 记忆</Text>
                    </div>
                    <SettingOutlined style={{ color: '#94a3b8', fontSize: 14 }} />
                  </div>
                </>
              )}
            </aside>
            <Tooltip title={sidebarCollapsed ? '展开会话列表' : '收起会话列表'} placement="right">
              <Button
                type="text"
                size="small"
                className={`agent-chat-sidebar-toggle ${sidebarCollapsed ? 'is-collapsed' : ''}`}
                icon={sidebarCollapsed ? <RightOutlined /> : <LeftOutlined />}
                onClick={() => setSidebarCollapsed((value) => !value)}
                aria-label={sidebarCollapsed ? '展开会话列表' : '收起会话列表'}
              />
            </Tooltip>
          </>
        )}
        {/* 左侧：对话区 */}
        <div
          className="agent-message-panel"
          style={{
            width: `${leftWidth}%`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: isDragging ? 'none' : 'width 0.2s',
            minWidth: 0,
          }}
        >
          {/* 消息列表 */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: isMobile ? '8px 12px' : '16px 20px',
              background: '#fff',
            }}
            className="agent-message-scroll"
          >
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                paddingTop: isMobile ? '25vh' : '18vh',
                maxWidth: 400,
                margin: '0 auto',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: getAgentAvatarSrc(agentAvatar) ? '#eef2ff' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  backgroundImage: getAgentAvatarSrc(agentAvatar) ? `url(${getAgentAvatarSrc(agentAvatar)})` : undefined,
                  backgroundSize: 'cover',
                  ...getAgentAvatarStyle(agentAvatar),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.15)',
                }}>
                  {renderAgentAvatarContent(agentAvatar, <RobotOutlined style={{ color: '#fff', fontSize: 26 }} />)}
                </div>
                <Title level={4} style={{ marginBottom: 6, fontWeight: 600, fontSize: 18 }}>
                  {agentName || 'AI 对话'}
                </Title>
                <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  输入问题，Agent 将为您分析解答
                </Text>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isLastAssistant = msg.role === 'assistant' && idx === messages.length - 1;
                const showGlobalActions = isLastAssistant && !isLoading;
                const isUser = msg.role === 'user';
                const isAssistantError = msg.role === 'assistant' && msg.status === 'error';
                return (
                  <div
                    key={msg.id}
                    className={`msg-bubble-wrapper ${isUser ? 'msg-user-row' : 'msg-assistant-row'}`}
                    style={{
                      display: 'flex',
                      marginBottom: isUser ? 12 : 10,
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-start',
                    }}
                  >
                    {!isUser && (
                      <Avatar
                        src={getAgentAvatarSrc(agentAvatar) || "/logo.png"}
                        className="agent-avatar-logo"
                        size={32}
                        style={{
                          backgroundColor: '#1a237e',
                          ...getAgentAvatarStyle(agentAvatar),
                          flexShrink: 0,
                        }}
                      >
                        {renderAgentAvatarContent(agentAvatar)}
                      </Avatar>
                    )}
                    <div
                      className={isUser ? 'user-message-plain' : undefined}
                      style={{
                        maxWidth: isUser ? 'min(760px, 76%)' : '82%',
                        marginLeft: isUser ? 0 : 8,
                        padding: isUser ? '4px 2px 6px' : '8px 16px',
                        borderRadius: isUser ? 0 : 10,
                        background: isUser ? 'transparent' : isAssistantError ? '#fff7ed' : '#fff',
                        color: '#111827',
                        boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
                        border: isUser ? 'none' : isAssistantError ? '1px solid #fdba74' : '1px solid var(--border-color)',
                        lineHeight: isUser ? 1.72 : 1.55,
                        fontSize: isUser ? 15 : undefined,
                        fontWeight: isUser ? 450 : undefined,
                      }}
                    >
                      {msg.content === '▍' ? (
                        <span className="placeholder-cursor">▍ 正在生成...</span>
                      ) : (
                        renderMessageContent(msg.content, msg.artifacts, isLastAssistant ? executionState : null)
                      )}

                      {msg.role === 'assistant' && msg.knowledgeSources && msg.knowledgeSources.length > 0 && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 10,
                            borderTop: '1px solid #eef2f7',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: 12, width: '100%' }}>引用知识库</Text>
                          {msg.knowledgeSources.map((source) => (
                            <Button
                              key={source.id}
                              size="small"
                              onClick={() => setActiveKnowledgeSource(source)}
                              style={{
                                borderRadius: 999,
                                height: 28,
                                paddingInline: 10,
                                background: '#f8fafc',
                              }}
                            >
                              {source.knowledgeBaseName} · {source.documentName} · #{source.chunkIndex + 1}
                            </Button>
                          ))}
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.status === 'error' && msg.retryPayload && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Button
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => msg.retryPayload && sendMessage(msg.retryPayload)}
                            disabled={isLoading}
                          >
                            重试
                          </Button>
                        </div>
                      )}
                      
                      {/* 助手回复的 hover 操作按钮 */}
                      {msg.role === 'assistant' && (
                        <div className="message-actions">
                          <Tooltip title="复制此回复">
                            <Button
                              type="text"
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                message.success('已复制此回复');
                              }}
                              style={{ fontSize: 11, color: '#999', padding: '2px 4px' }}
                            />
                          </Tooltip>
                          
                          {showGlobalActions && (
                            <>
                              <span style={{ color: '#e8e8e8', fontSize: 12, margin: '0 4px' }}>|</span>
                              <Tooltip title="复制全部对话">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={copyAllMessages}
                                  style={{ fontSize: 11, color: '#999', padding: '2px 4px' }}
                                />
                              </Tooltip>
                              <Tooltip title="导出 Word">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<FileTextOutlined />}
                                  onClick={exportChatAsWord}
                                  style={{ fontSize: 11, color: '#999', padding: '2px 4px' }}
                                />
                              </Tooltip>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
                <Avatar
                  src={getAgentAvatarSrc(agentAvatar) || "/logo.png"}
                  className="agent-avatar-logo"
                  size={32}
                  style={{ backgroundColor: '#1a237e', ...getAgentAvatarStyle(agentAvatar), flexShrink: 0 }}
                >
                  {renderAgentAvatarContent(agentAvatar)}
                </Avatar>
                <div style={{
                  padding: '6px 12px',
                  background: '#f8f9fb',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: 12 }}>思考中...</Text>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>



          {/* 输入区 */}
          <div style={{ padding: isMobile ? '6px 8px 8px' : '8px 16px 14px', borderTop: '1px solid var(--border-color)', background: '#fff', flexShrink: 0 }}>
            {/* 附件预览 */}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, padding: '4px 0' }}>
                {attachments.map((att, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', background: '#f0f5ff', borderRadius: 6,
                    border: '1px solid #d6e4ff', fontSize: 12,
                  }}>
                    {att.type.startsWith('image/') ? (
                      <img src={att.dataUrl} alt={att.name} style={{ width: 20, height: 20, borderRadius: 2, objectFit: 'cover' }} />
                    ) : (
                      <PaperClipOutlined style={{ color: '#6366f1' }} />
                    )}
                    <Text style={{ fontSize: 12, maxWidth: 120 }} ellipsis>{att.name}</Text>
                    <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => removeAttachment(i)} style={{ fontSize: 10, width: 18, height: 18 }} />
                  </div>
                ))}
              </div>
            )}

            {skillPickerOpen && skillCommand && (
              <div style={{
                marginBottom: 8,
                border: '1px solid #dbeafe',
                background: '#fff',
                borderRadius: 10,
                boxShadow: '0 10px 24px rgba(37, 99, 235, 0.12)',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #eef2ff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <ThunderboltOutlined style={{ color: '#2563eb' }} />
                  <Text strong style={{ fontSize: 13 }}>选择 Skill</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>/ 后输入名称可筛选，Enter 选择第一项</Text>
                </div>
                {filteredCommandSkills.length > 0 ? (
                  <div style={{ maxHeight: 240, overflow: 'auto' }}>
                    {filteredCommandSkills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          insertSkillCommand(skill);
                        }}
                        style={{
                          width: '100%',
                          border: 0,
                          background: 'transparent',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        <span style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <ThunderboltOutlined />
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <Text strong style={{ display: 'block', fontSize: 13 }} ellipsis>{skill.name}</Text>
                          <Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis>
                            {skill.namespace} · {skill.description || '暂无描述'}
                          </Text>
                        </span>
                        <Tag color={skill.status === 'published' ? 'green' : 'blue'} style={{ marginRight: 0 }}>
                          {skill.status || 'draft'}
                        </Tag>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 14 }}>
                    <Text type="secondary">没有匹配的 Skill</Text>
                  </div>
                )}
              </div>
            )}

            {/* 输入框容器 */}
            <div style={{
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}>
              <TextArea
                value={inputValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setInputValue(nextValue);
                  setSkillPickerOpen(!!getSkillCommand(nextValue));
                }}
                onFocus={() => setSkillPickerOpen(!!getSkillCommand(inputValue))}
                placeholder="输入消息，@添加上下文，/使用命令"
                autoSize={{ minRows: isMobile ? 1 : 2, maxRows: 6 }}
                onPressEnter={(e) => {
                  if (skillPickerOpen && filteredCommandSkills[0]) {
                    e.preventDefault();
                    insertSkillCommand(filteredCommandSkills[0]);
                    return;
                  }
                  if (!e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
                style={{ border: 'none', background: 'transparent', padding: '12px 14px 8px', fontSize: 14, resize: 'none', boxShadow: 'none' }}
              />
              {/* 工具栏 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 6px 12px' }}>
                <Space size={4}>
                  <Upload beforeUpload={handleFileSelect} showUploadList={false} accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv">
                    <Tooltip title="上传附件">
                      <Button type="text" icon={<PaperClipOutlined />} size="small" style={{ color: '#8a8a8a', fontSize: 16 }} />
                    </Tooltip>
                  </Upload>
                  <Upload beforeUpload={handleFileSelect} showUploadList={false} accept="image/*">
                    <Tooltip title="上传图片">
                      <Button type="text" icon={<PictureOutlined />} size="small" style={{ color: '#8a8a8a', fontSize: 16 }} />
                    </Tooltip>
                  </Upload>
                  <Select
                    value={selectedModel}
                    onChange={setSelectedModel}
                    size="small"
                    style={{ width: 110, fontSize: 12 }}
                    bordered={false}
                    options={availableModels.map((model) => ({
                      value: model.code,
                      label: model.label.replace(/^.* \/ /, ''),
                    }))}
                  />
                </Space>
                <Space size={2}>
                  <Text type="secondary" style={{ fontSize: 11, color: '#bbb' }}>↵ Enter</Text>
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<SendOutlined />}
                    onClick={() => sendMessage()}
                    loading={isLoading}
                    size="small"
                    style={{ background: '#2563eb', border: 'none', width: 28, height: 28 }}
                  />
                </Space>
              </div>
            </div>
          </div>
        </div>

        {/* 拖拽分隔条 */}
        {workbenchPanelOpen && (
          <div
            onMouseDown={handleDragStart}
            style={{
              width: 5,
              cursor: 'col-resize',
              background: isDragging ? '#6366f1' : '#e0e0e0',
              flexShrink: 0,
              transition: isDragging ? 'none' : 'background 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="拖拽调整宽度"
          >
            <div style={{ width: 2, height: 24, background: isDragging ? '#fff' : '#bbb', borderRadius: 1 }} />
          </div>
        )}

        {/* 右侧：Canvas */}
        {workbenchPanelOpen && (
          <div
            style={{
              width: `${100 - leftWidth}%`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderLeft: '1px solid var(--border-color)',
              background: '#fff',
              transition: isDragging ? 'none' : 'width 0.2s',
              minWidth: 0,
            }}
          >
            {/* Canvas / App 头部 */}
            <div className="agent-canvas-header" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fff' }}>
              <Space>
                <Text strong>{currentArtifact?.title || 'Canvas'}</Text>
                {currentArtifact?.type ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {currentArtifact.type}
                  </Text>
                ) : null}
              </Space>
              <Space>
                {currentArtifact && currentArtifact.type !== 'document' && currentArtifact.type !== 'html' && currentArtifact.type !== 'image' && currentArtifact.type !== 'json' && (
                  <>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      type={canvasViewMode === 'preview' ? 'primary' : 'default'}
                      onClick={() => setCanvasViewMode('preview')}
                    >
                      预览
                    </Button>
                    <Button
                      size="small"
                      icon={<CodeOutlined />}
                      type={canvasViewMode === 'code' ? 'primary' : 'default'}
                      onClick={() => setCanvasViewMode('code')}
                    >
                      源码
                    </Button>
                  </>
                )}
                {currentArtifact && currentArtifact.type !== 'document' && currentArtifact.type !== 'image' && currentArtifact.type !== 'html' && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(currentArtifact.content);
                    }}
                  >
                    复制
                  </Button>
                )}
                {(currentArtifact?.type === 'document' || currentArtifact?.type === 'image') && currentArtifact.downloadUrl && (
                  <Button
                    size="small"
                    type="primary"
                    icon={currentArtifact.type === 'image' ? <PictureOutlined /> : <FileTextOutlined />}
                    onClick={() => {
                      window.open(currentArtifact.downloadUrl, '_blank');
                    }}
                  >
                    下载
                  </Button>
                )}
                {currentArtifact?.type === 'html' && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(currentArtifact.content);
                    }}
                  >
                    复制源码
                  </Button>
                )}
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={closeCanvas}
                />
              </Space>
            </div>

            {/* Canvas 内容 */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {renderCanvasContent()}
            </div>
          </div>
        )}
      </div>

      {renderPersonalContextDrawer()}

      {/* 历史会话抽屉 */}
      <Drawer
        title="历史会话"
        placement="left"
        open={historyVisible}
        onClose={() => setHistoryVisible(false)}
        width={isMobile ? '100%' : 340}
        styles={{ body: { padding: isMobile ? 8 : 16 } }}
      >
        <List
          loading={loadingHistory}
          dataSource={conversations}
          renderItem={(item) => (
            <List.Item
              onClick={() => switchConversation(item.threadId)}
              style={{ cursor: 'pointer' }}
              actions={[
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      let resp = await fetch(`${API_BASE}/threads/${encodeURIComponent(item.threadId)}`, {
                        method: 'DELETE',
                      });
                      if (resp.status === 404) {
                        resp = await fetch(`${API_BASE}/ai/conversations/${encodeURIComponent(item.threadId)}`, {
                          method: 'DELETE',
                        });
                      }
                      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                      message.success('已删除');
                      loadConversations();
                    } catch {
                      message.error('删除失败');
                    }
                  }}
                />,
              ]}
            >
              <List.Item.Meta
                title={item.firstMessage || '(空对话)'}
                description={`${item.messageCount} 条消息`}
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无历史对话' }}
        />
      </Drawer>

      {/* Workspace 工作区抽屉 */}
      <Drawer
        title={
          <Space>
            <FolderOpenOutlined style={{ color: '#6366f1' }} />
            <span>工作区文件</span>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 'normal' }}>
              #{currentThreadId.slice(-6)}
            </Text>
          </Space>
        }
        placement="right"
        open={workspaceVisible}
        onClose={() => setWorkspaceVisible(false)}
        width={isMobile ? '100%' : 380}
        styles={{ body: { padding: isMobile ? 8 : 12 } }}
        extra={
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={loadWorkspaceFiles}
            loading={loadingWorkspace}
          >
            刷新
          </Button>
        }
      >
        {loadingWorkspace ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="default" />
            <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>加载中...</Text>
          </div>
        ) : workspaceFiles.length === 0 ? (
          <Empty
            description={
              <span>
                暂无文件<br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AI 生成的文档和报告将自动保存到这里
                </Text>
              </span>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
            {renderFileTree(workspaceFiles)}
          </div>
        )}
      </Drawer>

      <Modal
        title="知识库引用"
        open={Boolean(activeKnowledgeSource)}
        onCancel={() => setActiveKnowledgeSource(null)}
        footer={null}
        width={760}
      >
        {activeKnowledgeSource ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="blue">{activeKnowledgeSource.knowledgeBaseName}</Tag>
              <Tag>{activeKnowledgeSource.documentName}</Tag>
              <Tag>切片 #{activeKnowledgeSource.chunkIndex + 1}</Tag>
              <Tag color="green">score {activeKnowledgeSource.score.toFixed(3)}</Tag>
              {activeKnowledgeSource.sectionTitle ? <Tag>{activeKnowledgeSource.sectionTitle}</Tag> : null}
            </Space>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 16,
                maxHeight: 420,
                overflow: 'auto',
                lineHeight: 1.7,
              }}
            >
              {activeKnowledgeSource.content || activeKnowledgeSource.preview}
            </div>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
};

export default AgentChatCanvas;
