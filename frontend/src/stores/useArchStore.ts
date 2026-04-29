import { create } from 'zustand';
import { archApi, type IArchTreeResponse, type IArchNodeResponse, type IArchFileResponse } from '../services/api';
import type { IArchTree, IArchNode, IArchFile, IArchTreeVersion, ArchLevel } from '../types';

// 将后端响应转换为前端类型
// 后端 /architecture/nodes/tree 返回的是已经嵌套好的树结构，每个节点的 children 已经填充
function convertNodeResponse(node: IArchNodeResponse): IArchNode {
  // 直接使用后端返回的嵌套 children，而不是从扁平数组中重新构建
  const children = (node.children || [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(child => convertNodeResponse(child));
  
  return {
    id: String(node.id),
    name: node.name,
    level: node.level as ArchLevel,
    parentId: node.parentId ? String(node.parentId) : null,
    children,
    description: node.description,
    sortOrder: node.sortOrder,
    skillCoverage: node.skillCoverage,
    totalSkills: node.totalSkills,
    coveredSkills: node.coveredSkills,
    files: node.files?.map(f => ({
      id: String(f.id),
      name: f.name,
      type: f.type as IArchFile['type'],
      content: f.content,
      size: f.size,
      uploadedAt: f.uploadedAt,
    })),
  };
}

// 后端返回的已经是嵌套好的树结构（根节点数组，每个根节点有 children）
function buildTree(nodes: IArchNodeResponse[]): IArchNode[] {
  // nodes 是根节点数组（parentId === null 的节点），每个节点的 children 已经嵌套好
  return nodes
    .filter(n => n.parentId === null || n.parentId === undefined)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(n => convertNodeResponse(n));
}

// 辅助函数：递归查找节点
function findNode(nodes: IArchNode[], id: string): IArchNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function collectLeaves(nodes: IArchNode[]): IArchNode[] {
  const leaves: IArchNode[] = [];
  for (const n of nodes) {
    if (n.children.length === 0 && n.level >= 3) {
      leaves.push(n);
    } else {
      leaves.push(...collectLeaves(n.children));
    }
  }
  return leaves;
}

function getPath(nodes: IArchNode[], targetId: string, path: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return [...path, n.name];
    const result = getPath(n.children, targetId, [...path, n.name]);
    if (result) return result;
  }
  return null;
}

interface ArchState {
  // 状态
  archTree: IArchTree | null;
  selectedNodeId: string | null;
  loading: boolean;
  error: string | null;
  treeId: number | null; // 后端树 ID

  // 初始化（从后端加载）
  initTree: () => Promise<void>;

  // 节点选择
  selectNode: (nodeId: string | null) => void;

  // CRUD（调用 API 后更新本地状态）
  addNode: (parentId: string | null, name: string, level: ArchLevel) => Promise<void>;
  updateNode: (nodeId: string, updates: Partial<Pick<IArchNode, 'name' | 'description'>>) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;

  // 文件关联
  addFile: (nodeId: string, file: Omit<IArchFile, 'id'>) => Promise<void>;
  removeFile: (nodeId: string, fileId: string) => Promise<void>;

  // 版本管理
  saveVersion: (version: string, label?: string) => Promise<void>;

  // 辅助查询（纯前端）
  getNodeById: (nodeId: string) => IArchNode | null;
  getNodePath: (nodeId: string) => string[];
  getLeafNodes: () => IArchNode[];

  // 刷新树数据
  refreshTree: () => Promise<void>;
}

export const useArchStore = create<ArchState>()((set, get) => ({
  archTree: null,
  selectedNodeId: null,
  loading: false,
  error: null,
  treeId: null,

  initTree: async () => {
    set({ loading: true, error: null });
    try {
      // 尝试获取激活的树
      let activeTree: IArchTreeResponse | null = await archApi.getActiveTree();
      
      // 如果没有激活的树，创建一个
      if (!activeTree) {
        activeTree = await archApi.createTree({ name: '企业业务架构', currentVersion: '1.0.0' });
      }

      // 获取树节点
      const nodes = await archApi.getNodeTree(activeTree.id);
      const roots = buildTree(nodes);

      const archTree: IArchTree = {
        id: String(activeTree.id),
        name: activeTree.name,
        currentVersion: activeTree.currentVersion,
        roots,
        versions: [], // 版本列表暂不从后端获取
        createdAt: activeTree.createdAt,
        updatedAt: activeTree.updatedAt,
      };

      set({ archTree, treeId: activeTree.id, loading: false });
    } catch (error) {
      console.error('初始化架构树失败:', error);
      set({ error: '加载架构树失败', loading: false });
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addNode: async (parentId, name, level) => {
    const { treeId, archTree } = get();
    if (!treeId || !archTree) return;

    try {
      const response = await archApi.createNode({
        treeId,
        name,
        level,
        parentId: parentId ? parseInt(parentId) : undefined,
        sortOrder: 0,
      });

      // 刷新树数据
      await get().refreshTree();
    } catch (error) {
      console.error('添加节点失败:', error);
      throw error;
    }
  },

  updateNode: async (nodeId, updates) => {
    try {
      await archApi.updateNode(parseInt(nodeId), updates);
      await get().refreshTree();
    } catch (error) {
      console.error('更新节点失败:', error);
      throw error;
    }
  },

  deleteNode: async (nodeId) => {
    const { selectedNodeId } = get();
    try {
      await archApi.deleteNode(parseInt(nodeId));
      if (selectedNodeId === nodeId) {
        set({ selectedNodeId: null });
      }
      await get().refreshTree();
    } catch (error) {
      console.error('删除节点失败:', error);
      throw error;
    }
  },

  addFile: async (nodeId, file) => {
    try {
      await archApi.createFile({
        nodeId: parseInt(nodeId),
        name: file.name,
        type: file.type,
        content: file.content,
        size: file.size,
      });
      await get().refreshTree();
    } catch (error) {
      console.error('添加文件失败:', error);
      throw error;
    }
  },

  removeFile: async (_nodeId, fileId) => {
    try {
      await archApi.deleteFile(parseInt(fileId));
      await get().refreshTree();
    } catch (error) {
      console.error('删除文件失败:', error);
      throw error;
    }
  },

  saveVersion: async (version, label) => {
    const { treeId } = get();
    if (!treeId) return;

    try {
      await archApi.saveVersion(treeId, { version, label });
      await get().refreshTree();
    } catch (error) {
      console.error('保存版本失败:', error);
      throw error;
    }
  },

  getNodeById: (nodeId) => {
    const { archTree } = get();
    if (!archTree) return null;
    return findNode(archTree.roots, nodeId);
  },

  getNodePath: (nodeId) => {
    const { archTree } = get();
    if (!archTree) return [];
    return getPath(archTree.roots, nodeId) || [];
  },

  getLeafNodes: () => {
    const { archTree } = get();
    if (!archTree) return [];
    return collectLeaves(archTree.roots);
  },

  refreshTree: async () => {
    const { treeId, archTree } = get();
    if (!treeId || !archTree) return;

    try {
      // 直接获取节点树，无需再调用 getTrees() 验证
      const nodes = await archApi.getNodeTree(treeId);
      const roots = buildTree(nodes);

      set(state => ({
        archTree: state.archTree ? {
          ...state.archTree,
          roots,
          updatedAt: new Date().toISOString(),
        } : null,
      }));
    } catch (error) {
      console.error('刷新树数据失败:', error);
    }
  },
}));
