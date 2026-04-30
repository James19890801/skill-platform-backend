/**
 * MermaidRenderer - Mermaid 流程图渲染组件
 * 接收 Mermaid 语法字符串，渲染为可交互的 SVG 流程图
 */
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Spin } from 'antd';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    primaryColor: '#6366f1',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#6366f1',
    lineColor: '#94a3b8',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#f8fafc',
    fontSize: '14px',
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    showSequenceNumbers: false,
  },
});

interface Props {
  chart: string;
  id?: string;
}

const MermaidRenderer: React.FC<Props> = ({ chart, id: externalId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderId = useRef(externalId || `mermaid-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!containerRef.current) return;

      setLoading(true);
      setError(null);

      try {
        // 清理容器
        containerRef.current.innerHTML = '';

        // 使用 mermaid 渲染
        const { svg } = await mermaid.render(renderId.current, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || '流程图渲染失败');
          // 降级显示源码
          if (containerRef.current) {
            containerRef.current.innerHTML = `<pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:8px;overflow:auto;font-size:12px;line-height:1.5;">${escapeHtml(chart)}</pre>`;
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        padding: 16,
        marginBottom: 12,
        overflow: 'auto',
        minHeight: 100,
      }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin size="small" />
          <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>流程图渲染中...</div>
        </div>
      )}
      <div ref={containerRef} style={{ display: loading ? 'none' : 'block' }} />
      {error && (
        <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default MermaidRenderer;
