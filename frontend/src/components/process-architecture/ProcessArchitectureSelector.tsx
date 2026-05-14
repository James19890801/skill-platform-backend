import React, { useEffect, useMemo, useState } from 'react';
import { Empty, Spin, TreeSelect } from 'antd';
import {
  ProcessArchitectureNodeSnapshot,
  processArchitectureApi,
} from '../../services/api';

interface ProcessArchitectureSelectorProps {
  value?: number[];
  onChange?: (value: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function toTreeData(nodes: ProcessArchitectureNodeSnapshot[]): any[] {
  return nodes.map((node) => ({
    title: [node.code, node.name].filter(Boolean).join(' · '),
    value: node.id,
    key: node.id,
    children: toTreeData(node.children || []),
  }));
}

const ProcessArchitectureSelector: React.FC<ProcessArchitectureSelectorProps> = ({
  value,
  onChange,
  placeholder = '选择流程架构节点',
  disabled,
}) => {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<ProcessArchitectureNodeSnapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    processArchitectureApi
      .getActive()
      .then((tree) => {
        if (!cancelled) setSnapshot(tree.snapshot || []);
      })
      .catch(() => {
        if (!cancelled) setSnapshot([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const treeData = useMemo(() => toTreeData(snapshot), [snapshot]);

  if (loading) {
    return <Spin size="small" />;
  }

  if (!treeData.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无流程架构" />;
  }

  return (
    <TreeSelect
      value={value}
      onChange={(nextValue) => onChange?.((nextValue || []).map((item: number | string) => Number(item)).filter(Boolean))}
      treeData={treeData}
      treeCheckable
      showCheckedStrategy={TreeSelect.SHOW_PARENT}
      placeholder={placeholder}
      allowClear
      disabled={disabled}
      style={{ width: '100%' }}
      maxTagCount="responsive"
    />
  );
};

export default ProcessArchitectureSelector;
