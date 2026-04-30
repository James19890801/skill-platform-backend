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
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card, Input, Button, Typography, Space, Avatar, Tag, Spin,
  Select, Empty, Tooltip, Drawer, List, message, Grid,
} from 'antd';
import {
  SendOutlined, RobotOutlined, UserOutlined, ClearOutlined,
  AppstoreOutlined, CodeOutlined, FileTextOutlined, CloseOutlined,
  CopyOutlined, EyeOutlined, HistoryOutlined, PlusOutlined,
  DeleteOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

interface Message { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date; artifacts?: Artifact[]; }
interface Artifact { id: string; type: 'code' | 'table' | 'document'; title: string; content: string; language?: string; }
interface ConversationSummary { threadId: string; messageCount: number; firstMessage: string; }

const API_BASE = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';

const AgentChatCanvas: React.FC = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen-plus');
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<'preview' | 'code'>('preview');
  const [leftWidth, setLeftWidth] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState('thread-' + Date.now());
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartLeftWidth = useRef(0);

  useEffect(() => {
    const styleId = 'artifact-card-hover-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = '.artifact-card:hover .artifact-actions{opacity:1}.artifact-table{border-collapse:collapse;width:100%;font-size:13px}.artifact-table th,.artifact-table td{border:1px solid #ddd;padding:8px 12px;text-align:left}.artifact-table th{background-color:#f5f5f5;font-weight:600}.artifact-table tr:nth-child(even){background-color:#f9f9f9}.artifact-table-container{overflow:auto;max-height:400px}';
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const parseArtifacts = useCallback((content: string): Artifact[] => {
    const artifacts: Artifact[] = [];
    const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let match; let idx = 0;
    while ((match = codeRegex.exec(content)) !== null) {
      artifacts.push({ id: 'artifact-code-' + (idx++), type: 'code', title: (match[1] || '代码') + ' 产物', content: match[2].trim(), language: match[1] || 'text' });
    }
    const tablePattern = '\\|[^\\n]+\\|\\n\\|[-:\\s|]+\\|\\n(?:\\|[^\\n]+\\|\\n?)+';
    const tableRegex = new RegExp(tablePattern, 'g');
    idx = 0;
    while ((match = tableRegex.exec(content)) !== null) {
      artifacts.push({ id: 'artifact-table-' + (idx++), type: 'table', title: '表格产物', content: match[0] });
    }
    return artifacts;
  }, []);

  const renderMessageContent = (msg: Message) => {
    const artifacts: JSX.Element[] = [];
    if (msg.artifacts && msg.artifacts.length > 0) {
      msg.artifacts.forEach((artifact) => {
        if (artifact.type === 'table') return;
        artifacts.push(
          <div key={artifact.id} className="artifact-card" style={{ marginTop: 12, padding: '8px 12px', background: '#f0f5ff', border: '1px dashed #b7c8f0', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }} onClick={() => openCanvas(artifact)}>
            <Space>
              <Tag color="blue" style={{ margin: 0 }}>📄 {artifact.title}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>点击在 Canvas 中查看</Text>
            </Space>
            {artifact.type === 'code' && (
              <pre style={{ margin: '8px 0 0', padding: 8, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 6, fontSize: 11, maxHeight: 80, overflow: 'hidden', lineHeight: 1.4 }}>
                <code>{artifact.content.slice(0, 200)}{artifact.content.length > 200 ? '...' : ''}</code>
              </pre>
            )}
            <div className="artifact-actions" style={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.2s', background: 'rgba(255,255,255,0.9)', borderRadius: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <Tooltip title="复制内容">
                <Button size="small" icon={<CopyOutlined />} type="text" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(artifact.content); }} style={{ padding: '2px 4px' }} />
              </Tooltip>
            </div>
          </div>
        );
      });
    }
    const renderContentWithTables = (content: string) => {
      const tablePattern = /\|(.+)\|(?:\n\|[-:\s|]+\|(?:\n\|.+?\|)*)/g;
      const parts: (string | JSX.Element)[] = [];
      let lastIdx = 0;
      let match: RegExpExecArray | null;
      while ((match = tablePattern.exec(content)) !== null) {
        if (match.index > lastIdx) {
          const textBefore = content.slice(lastIdx, match.index).trim();
          if (textBefore) {
            parts.push(<Text key={'text-' + lastIdx} style={{ whiteSpace: 'pre-wrap', display: 'block', marginBottom: 8 }}>{textBefore.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^#+\s+/gm, '').replace(/^\s*[-*+]\s+/gm, '• ')}</Text>);
          }
        }
        const tableLines = match[0].trim().split('\n').filter(l => l.trim());
        if (tableLines.length >= 2) {
          let sepIdx = -1;
          for (let i = 0; i < tableLines.length; i++) { if (tableLines[i].includes('---') || tableLines[i].includes(':-')) { sepIdx = i; break; } }
          if (sepIdx === -1) sepIdx = 0;
          const parseRow = (line: string) => line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim()).filter(Boolean);
          const headers = sepIdx > 0 ? parseRow(tableLines[sepIdx - 1]) : [];
          const dataRows = tableLines.slice(sepIdx + 1).map(parseRow);
          if (headers.length > 0 && dataRows.length > 0) {
            parts.push(
              <div key={'table-' + match.index} style={{ overflow: 'auto', marginBottom: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  <thead><tr style={{ background: '#f1f5f9' }}>{headers.map((h, i) => <th key={i} style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                  <tbody>{dataRows.map((row, ri) => <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>{row.map((cell, ci) => <td key={ci} style={{ padding: '6px 12px', borderBottom: '1px solid #e2e8f0' }}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          }
        }
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < content.length) { const remaining = content.slice(lastIdx).trim(); if (remaining) { parts.push(<Text key="text-end" style={{ whiteSpace: 'pre-wrap', display: 'block' }}>{remaining.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^#+\s+/gm, '').replace(/^\s*[-*+]\s+/gm, '• ')}</Text>); } }
      if (parts.length === 0 && content.trim()) { parts.push(<Text key="fallback" style={{ whiteSpace: 'pre-wrap' }}>{content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^#+\s+/gm, '').replace(/^\s*[-*+]\s+/gm, '• ')}</Text>); }
      return parts;
    };
    return (
      <div>
        {renderContentWithTables(msg.content)}
        {artifacts}
        {msg.role === 'assistant' && msg.content.trim() && (
          <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
            <Button size="small" icon={<FileTextOutlined />} onClick={async () => {
              try {
                const resp = await fetch(API_BASE + '/ai/export-docx', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: msg.content, format: 'docx', filename: '对话回复_' + Date.now() + '.docx' }),
                });
                if (!resp.ok) throw new Error('导出失败');
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = '回复_' + Date.now() + '.docx'; a.click();
                URL.revokeObjectURL(url);
              } catch (e: any) { message.error('导出 Word 失败: ' + e.message); }
            }}>下载 Word</Button>
            <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(msg.content); message.success('已复制'); }}>复制</Button>
          </div>
        )}
      </div>
    );
  };

  const openCanvas = (artifact: Artifact) => { setCurrentArtifact(artifact); setCanvasOpen(true); setCanvasViewMode('preview'); setLeftWidth(60); };
  const closeCanvas = () => { setCanvasOpen(false); setCurrentArtifact(null); setLeftWidth(100); };

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

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    const userMessage: Message = { id: 'msg-' + Date.now(), role: 'user', content: inputValue.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    try {
      const response = await fetch(API_BASE + '/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: currentThreadId, message: userMessage.content, model: selectedModel, agentId: agentId ? Number(agentId) : undefined, stream: true }),
      });
      if (!response.ok) throw new Error('API 响应失败: ' + response.status);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (dataStr === '[DONE]' || dataStr === '') continue;
              try {
                const data = JSON.parse(dataStr);
                if (data.type === 'content' && data.content) {
                  assistantContent += data.content;
                  setMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === 'assistant' && lastMsg.id.startsWith('msg-assistant')) {
                      return [...prev.slice(0, -1), { ...lastMsg, content: assistantContent }];
                    }
                    return [...prev, { id: 'msg-assistant-' + Date.now(), role: 'assistant', content: assistantContent, timestamp: new Date() }];
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant') {
          const artifacts = parseArtifacts(lastMsg.content);
          return [...prev.slice(0, -1), { ...lastMsg, artifacts }];
        }
        return prev;
      });
    } catch (error: any) {
      setMessages((prev) => [...prev, { id: 'msg-fallback-' + Date.now(), role: 'assistant', content: '⚠️ API 连接失败，请检查配置。\n\n错误信息: ' + error.message, timestamp: new Date() }]);
    }
    setIsLoading(false);
  };

  const clearChat = () => { setMessages([]); setCanvasOpen(false); setCurrentArtifact(null); setLeftWidth(100); };

  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const resp = await fetch(API_BASE + '/ai/conversations');
      if (resp.ok) { const data = await resp.json(); setConversations(data || []); }
    } catch {} finally { setLoadingHistory(false); }
  }, []);

  const switchConversation = async (threadId: string) => {
    setHistoryVisible(false);
    setCurrentThreadId(threadId);
    setMessages([]);
    setCanvasOpen(false);
    setIsLoading(true);
    try {
      const resp = await fetch(API_BASE + '/ai/conversations/' + encodeURIComponent(threadId));
      if (resp.ok) {
        const data = await resp.json();
        const historyMessages: Message[] = (data.messages || []).map((m: { role: string; content: string }, i: number) => ({
          id: 'msg-history-' + i + '-' + Date.now(), role: m.role as 'user' | 'assistant', content: m.content, timestamp: new Date(),
        }));
        setMessages(historyMessages);
      }
    } catch { message.error('加载历史会话失败'); } finally { setIsLoading(false); }
  };

  const newConversation = () => {
    setMessages([]);
    setCurrentThreadId('thread-' + Date.now());
    setCanvasOpen(false);
    setCurrentArtifact(null);
    setLeftWidth(100);
    setHistoryVisible(false);
  };

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (messages.length > 0) { loadConversations(); } }, [messages.length]);

  const renderCanvasContent = () => {
    if (!currentArtifact) {
      return <Empty description="点击对话中的产物卡片查看详情" image={Empty.PRESENTED_IMAGE_SIMPLE}><Text type="secondary">产物将在 Canvas 中展开展示</Text></Empty>;
    }
    const { content, type } = currentArtifact;
    if (type === 'code' || canvasViewMode === 'code') {
      return <pre style={{ margin: 0, padding: 16, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6 }}><code>{content}</code></pre>;
    }
    if (type === 'table') {
      const rows = content.trim().split('\n').filter(row => row.trim() !== '');
      if (rows.length < 2) return <Text>无法解析表格数据</Text>;
      let separatorIndex = -1;
      for (let i = 0; i < rows.length; i++) { if (rows[i].includes('|---') || rows[i].includes(':-') || rows[i].includes('-:')) { separatorIndex = i; break; } }
      if (separatorIndex === -1) separatorIndex = 0;
      const headers = rows[separatorIndex - 1]?.split('|').filter(Boolean).map(h => h.trim()) || [];
      const dataRows = rows.slice(separatorIndex + 1).map(row => row.split('|').filter(Boolean).map(c => c.trim()));
      return (
        <div className="artifact-table-container">
          <table className="artifact-table">
            <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{dataRows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    return <Text>{content}</Text>;
  };

  return (
    <div ref={containerRef} style={{ height: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 56px - 32px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: isMobile ? '8px 12px' : '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        {isMobile ? (
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')} style={{ fontSize: 16, color: '#333' }} />
            <RobotOutlined style={{ color: '#6366f1', fontSize: 16 }} />
            <Text strong style={{ fontSize: 15 }}>{agentId ? 'Agent #' + agentId : 'AI 对话'}</Text>
          </Space>
        ) : (
          <Space>
            <RobotOutlined style={{ color: '#6366f1', fontSize: 18 }} />
            <Text strong style={{ fontSize: 15 }}>Agent 对话</Text>
            {agentId && <Tag>{agentId}</Tag>}
            <Tag color="default" style={{ fontSize: 11 }}>{currentThreadId.slice(0, 16)}...</Tag>
          </Space>
        )}
        <Space>
          {isMobile ? (
            <>
              <Tooltip title="历史会话"><Button icon={<HistoryOutlined />} size="small" type="text" onClick={() => { loadConversations(); setHistoryVisible(true); }} /></Tooltip>
              <Tooltip title="新建对话"><Button type="text" icon={<PlusOutlined />} size="small" onClick={newConversation} /></Tooltip>
            </>
          ) : (
            <>
              <Tooltip title="历史会话"><Button icon={<HistoryOutlined />} size="small" onClick={() => { loadConversations(); setHistoryVisible(true); }} /></Tooltip>
              <Select value={selectedModel} onChange={setSelectedModel} size="small" style={{ width: 130 }} options={[{ value: 'qwen-turbo', label: 'Turbo' }, { value: 'qwen-plus', label: 'Plus' }, { value: 'qwen-max', label: 'Max' }]} />
              <Button icon={<ClearOutlined />} size="small" onClick={clearChat}>清空</Button>
            </>
          )}
        </Space>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width: leftWidth + '%', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: isDragging ? 'none' : 'width 0.2s', minWidth: 0 }}>
          <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '8px 12px' : '16px 20px', background: '#fafafa' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80 }}>
                <RobotOutlined style={{ fontSize: 56, color: '#6366f1', marginBottom: 16 }} />
                <Title level={4}>开始对话</Title>
                <Text type="secondary">输入问题，Agent 将为您分析和解答</Text>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={{ display: 'flex', marginBottom: 20, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  <Avatar icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />} style={{ backgroundColor: msg.role === 'user' ? '#10b981' : '#6366f1', flexShrink: 0 }} />
                  <div style={{ maxWidth: '78%', marginLeft: msg.role === 'user' ? 0 : 12, marginRight: msg.role === 'user' ? 12 : 0, padding: '12px 16px', borderRadius: 12, background: msg.role === 'user' ? '#e8f5e9' : '#fff', boxShadow: msg.role === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.06)', border: msg.role === 'user' ? 'none' : '1px solid #f0f0f0' }}>
                    {renderMessageContent(msg)}
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#6366f1', flexShrink: 0 }} />
                <Card size="small" style={{ background: '#f5f5f5', border: 'none' }}><Spin size="small" tip="Agent 思考中..." /></Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: isMobile ? '8px 12px' : '12px 20px', borderTop: '1px solid #f0f0f0', background: '#fff', flexShrink: 0 }}>
            <Space.Compact style={{ width: '100%' }}>
              <TextArea value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="输入您的消息..." autoSize={{ minRows: 1, maxRows: 4 }} onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendMessage(); } }} disabled={isLoading} style={{ borderRadius: '8px 0 0 8px' }} />
              <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} loading={isLoading} style={{ background: '#6366f1', borderRadius: '0 8px 8px 0', height: 'auto' }}>发送</Button>
            </Space.Compact>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: isMobile ? 4 : 6 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>按 Enter 发送</Text>
              {!isMobile && <Tooltip title="新建对话"><Button type="text" icon={<PlusOutlined />} size="small" onClick={newConversation} style={{ color: '#bbb' }} /></Tooltip>}
            </div>
          </div>
        </div>

        {canvasOpen && <div onMouseDown={handleDragStart} style={{ width: 5, cursor: 'col-resize', background: isDragging ? '#6366f1' : '#e0e0e0', flexShrink: 0, transition: isDragging ? 'none' : 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="拖拽调整宽度"><div style={{ width: 2, height: 24, background: isDragging ? '#fff' : '#bbb', borderRadius: 1 }} /></div>}

        {canvasOpen && (
          <div style={{ width: 100 - leftWidth + '%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid #f0f0f0', background: '#fff', transition: isDragging ? 'none' : 'width 0.2s', minWidth: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafafa' }}>
              <Space><AppstoreOutlined style={{ color: '#6366f1' }} /><Text strong>🎨 Canvas</Text>{currentArtifact && <Tag color="blue">{currentArtifact.title}</Tag>}</Space>
              <Space>
                <Button size="small" icon={<EyeOutlined />} type={canvasViewMode === 'preview' ? 'primary' : 'default'} onClick={() => setCanvasViewMode('preview')}>预览</Button>
                <Button size="small" icon={<CodeOutlined />} type={canvasViewMode === 'code' ? 'primary' : 'default'} onClick={() => setCanvasViewMode('code')}>源码</Button>
                {currentArtifact && <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(currentArtifact.content); }}>复制</Button>}
                <Button size="small" icon={<CloseOutlined />} onClick={closeCanvas} />
              </Space>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>{renderCanvasContent()}</div>
          </div>
        )}
      </div>

      <Drawer title="历史会话" placement="left" open={historyVisible} onClose={() => setHistoryVisible(false)} width={340}>
        <List loading={loadingHistory} dataSource={conversations}
          renderItem={(item) => (
            <List.Item onClick={() => switchConversation(item.threadId)} style={{ cursor: 'pointer' }}
              actions={[
                <Button type="text" icon={<DeleteOutlined />} size="small" danger onClick={async (e) => { e.stopPropagation(); try { await fetch(API_BASE + '/ai/conversations/' + encodeURIComponent(item.threadId), { method: 'DELETE' }); message.success('已删除'); loadConversations(); } catch { message.error('删除失败'); } }} />
              ]}>
              <List.Item.Meta title={item.firstMessage || '(空对话)'} description={item.messageCount + ' 条消息'} />
            </List.Item>
          )}
          locale={{ emptyText: '暂无历史对话' }}
        />
      </Drawer>
    </div>
  );
};

export default AgentChatCanvas;