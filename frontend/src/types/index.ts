// ============================================
// Skill Platform - Frontend Types
// ============================================

// Skill 相关枚举
export enum SkillScope {
  PERSONAL = 'personal',
  BUSINESS = 'business',
  PLATFORM = 'platform',
}

export enum SkillType {
  PURE_BUSINESS = 'pure-business',
  LIGHT_TECH = 'light-tech',
  HEAVY_TECH = 'heavy-tech',
}

export enum SkillStatus {
  DRAFT = 'draft',
  REVIEWING = 'reviewing',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DEPRECATED = 'deprecated',
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum SkillPriority {
  REQUIRED = 'required',
  RECOMMENDED = 'recommended',
  OPTIONAL = 'optional',
}

// 命名空间域
export enum SkillDomain {
  LEGAL = 'legal',
  FINANCE = 'finance',
  PROCUREMENT = 'procurement',
  HR = 'hr',
  TECH = 'tech',
  PLATFORM = 'platform',
}

// 子域映射
export const SubDomainMap: Record<SkillDomain, string[]> = {
  [SkillDomain.LEGAL]: ['contract', 'litigation', 'patent', 'compliance'],
  [SkillDomain.FINANCE]: ['accounting', 'tax', 'budget', 'audit'],
  [SkillDomain.PROCUREMENT]: ['sourcing', 'evaluation', 'contract', 'supplier'],
  [SkillDomain.HR]: ['recruitment', 'onboarding', 'performance', 'training'],
  [SkillDomain.TECH]: ['development', 'testing', 'deployment', 'security'],
  [SkillDomain.PLATFORM]: ['document', 'communication', 'data', 'integration'],
};

// 域名称映射
export const DomainLabels: Record<SkillDomain, string> = {
  [SkillDomain.LEGAL]: '法务',
  [SkillDomain.FINANCE]: '财务',
  [SkillDomain.PROCUREMENT]: '采购',
  [SkillDomain.HR]: '人力资源',
  [SkillDomain.TECH]: '技术',
  [SkillDomain.PLATFORM]: '平台',
};

// ============================================
// 租户相关接口
// ============================================
export interface ITenant {
  id: number;
  name: string;
  code: string;
  logo?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: 'active' | 'suspended' | 'trial';
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  dingtalkCorpId?: string;
  wecomCorpId?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 用户相关接口
// ============================================
export interface IUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  orgId: number;
  orgName: string;
  jobTitle: string;
  avatar?: string;
  tenantId: number;
  tenantName?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 组织相关接口
// ============================================
export interface IOrganization {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  path: string;
  level: number;
  managerId?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  children?: IOrganization[];
  manager?: IUser;
}

// ============================================
// Skill 相关接口
// ============================================
export interface ISkill {
  id: number;
  namespace: string;
  name: string;
  domain: SkillDomain;
  subDomain: string;
  abilityName: string;
  description: string;
  scope: SkillScope;
  type: SkillType;
  status: SkillStatus;
  priority: SkillPriority;
  ownerId: number;
  orgId: number;
  sopSource: string;
  currentVersion: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  owner?: IUser;
  organization?: IOrganization;
  versions?: ISkillVersion[];
  // 衍生字段（用于前端展示）
  orgName?: string;
  ownerName?: string;
  usageCount?: number;
  // 执行配置字段
  executionType?: 'api' | 'webhook' | 'rpa' | 'agent' | 'manual';
  endpoint?: string;
  httpMethod?: string;
  authConfig?: string;
  requestTemplate?: string;
  responseMapping?: string;
  headers?: string;
  errorHandling?: string;
  agentPrompt?: string;
  toolDefinition?: string;
  content?: string; // ★ Skill 标准正文（Markdown）：角色定义、核心职责、输入输出、执行原则
  files?: ISkillFile[]; // 捆绑文件列表
}

// Skill 捆绑文件
export interface ISkillFile {
  name: string;
  path: string;
  type: 'script' | 'template' | 'reference' | 'asset';
  content: string;
  description?: string;
}

export interface ISkillVersion {
  id: number;
  skillId: number;
  version: string;
  prompt: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  changelog: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: IUser;
}

// ============================================
// 岗位 Model 相关接口
// ============================================
export interface IJobModel {
  id: number;
  orgId: number;
  name: string;
  code: string;
  description?: string;
  responsibilities?: string;
  createdAt: string;
  updatedAt: string;
  organization?: IOrganization;
  skillBindings?: IModelSkillBinding[];
}

export interface IModelSkillBinding {
  id: number;
  modelId: number;
  skillId: number;
  priority: SkillPriority;
  requiredLevel: number;
  notes?: string;
  skill?: ISkill;
  model?: IJobModel;
}

// ============================================
// 审核相关接口
// ============================================
export interface ISkillReview {
  id: number;
  skillId: number;
  versionId: number;
  reviewerId: number;
  status: ReviewStatus;
  comment?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  skill?: ISkill;
  version?: ISkillVersion;
  reviewer?: IUser;
}

// ============================================
// API 请求/响应接口
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Skill 列表查询参数
export interface SkillListParams extends PaginationParams {
  scope?: SkillScope;
  type?: SkillType;
  status?: SkillStatus;
  domain?: SkillDomain;
  orgId?: number;
  keyword?: string;
}

// 审核列表查询参数
export interface ReviewListParams extends PaginationParams {
  status?: ReviewStatus;
  reviewerId?: number;
}

// 搜索参数
export interface SearchParams {
  keyword: string;
  scope?: SkillScope[];
  domain?: SkillDomain[];
  type?: SkillType[];
  status?: SkillStatus[];
  page?: number;
  pageSize?: number;
}

// ============================================
// 登录相关接口
// ============================================
export interface LoginRequest {
  email?: string;
  identifier?: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: IUser;
}

// 预设用户信息（用于 Mock 模式）
export interface PresetUser {
  id: number;
  name: string;
  username: string; // 用于后端登录
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'member';
  orgId: number;
  orgName: string;
  jobTitle: string;
  avatar?: string;
}

export const PRESET_USERS: PresetUser[] = [
  {
    id: 1,
    name: '系统管理员',
    username: 'admin',
    email: 'admin@skill.com',
    password: 'password123',
    role: 'admin',
    orgId: 1,
    orgName: '集团总部',
    jobTitle: '管理员',
  },
  {
    id: 2,
    name: '法务经理',
    username: 'manager',
    email: 'legal.manager@skill.com',
    password: 'password123',
    role: 'manager',
    orgId: 2,
    orgName: '法务部',
    jobTitle: '法务部经理',
  },
  {
    id: 3,
    name: '合同专员',
    username: 'member',
    email: 'contract.staff@skill.com',
    password: 'password123',
    role: 'member',
    orgId: 3,
    orgName: '法务部-合同组',
    jobTitle: '合同专员',
  },
];

// ===== 业务流程相关类型 =====
export interface IBusinessProcess {
  id: string;
  name: string;
  description: string;
  domain: string;
  nodes: IProcessNode[];
  edges: IProcessEdge[];
  sops: ISOP[];
  skillCount: number;
  coverage: number;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface IProcessNode {
  id: string;
  name: string;
  type: 'start' | 'end' | 'task' | 'decision' | 'subprocess';
  position: { x: number; y: number };
  skills: ISkillRef[];
  sops: ISOPRef[];
  description?: string;
}

export interface IProcessEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ISkillRef {
  skillId: number;
  name: string;
  namespace: string;
  status: string;
}

export interface ISOPRef {
  sopId: string;
  name: string;
  skills: ISkillRef[];
}

// ===== SOP 盘点相关类型 =====
export interface ISOP {
  id: string;
  name: string;
  processId: string;
  processName: string;
  nodeId: string;
  nodeName: string;
  description: string;
  steps: ISOPStep[];
  requiredSkills: IRequiredSkill[];
  coveredSkills: ISkillRef[];
  coverage: number;
}

export interface ISOPStep {
  order: number;
  action: string;
  description: string;
  requiredSkillName?: string;
}

export interface IRequiredSkill {
  name: string;
  description: string;
  domain: string;
  subDomain: string;
  exists: boolean;
  existingSkillId?: number;
  source: 'sop-analysis' | 'pattern-match' | 'ai-recommend';
  confidence: number;
}

// ===== Skill 挖掘相关类型 =====
export interface ISkillMiningResult {
  processId: string;
  processName: string;
  sopId: string;
  sopName: string;
  suggestedSkills: ISuggestedSkill[];
  confidence: number;
}

export interface ISuggestedSkill {
  name: string;
  description: string;
  domain: string;
  subDomain: string;
  source: 'sop-analysis' | 'process-analysis' | 'pattern-match' | 'ai-recommend';
  confidence: number;
  relatedNodes: string[];
  relatedSOPs: string[];
  exists: boolean;
  existingSkillId?: number;
}

export interface IProcessStats {
  totalProcesses: number;
  activeProcesses: number;
  totalSOPs: number;
  totalNodes: number;
  avgSkillCoverage: number;
  uncoveredNodes: number;
  totalRequiredSkills: number;
  existingSkills: number;
  gapSkills: number;
}

// ===== 业务架构树 =====

export type ArchLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface IArchNode {
  id: string;
  name: string;
  level: ArchLevel;
  parentId: string | null;
  children: IArchNode[];
  description?: string;
  sortOrder: number;
  // 末级节点关联
  files?: IArchFile[];
  processId?: string;
  // Skill 覆盖统计
  skillCoverage: number;
  totalSkills: number;
  coveredSkills: number;
}

export interface IArchFile {
  id: string;
  name: string;
  type: 'sop' | 'process-doc' | 'description' | 'other';
  content?: string;
  size?: number;
  uploadedAt: string;
}

export interface IArchTreeVersion {
  id: string;
  version: string;        // 如 "1.0.0", "1.1.0"
  label?: string;         // 版本标签如 "初始版本"
  createdAt: string;
  snapshot: IArchNode[];   // 该版本的架构快照
}

export interface IArchTree {
  id: string;
  name: string;
  currentVersion: string;
  roots: IArchNode[];
  versions: IArchTreeVersion[];
  createdAt: string;
  updatedAt: string;
}

// Skill 安装记录
export interface ISkillInstallation {
  id: string;
  skillId: number;
  skillName: string;
  installedByOrgId: number;
  installedByOrgName: string;
  installedForOrgIds: number[];
  installedForModelIds: number[];
  installedAt: string;
  status: 'active' | 'disabled';
}

// ===== 知识库相关类型 =====
export interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  source: 'bailian' | 'local' | 'web' | 'file';
  documents: string[];
  documentCount: number;
  status: 'connected' | 'syncing' | 'error';
  userId: number;
  user: IUser;
  tenantId: number;
  tenant: ITenant;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  source?: 'bailian' | 'local' | 'web' | 'file';
  documents?: string[];
  documentCount?: number;
  status?: 'connected' | 'syncing' | 'error';
}

export interface UpdateKnowledgeBaseRequest {
  name?: string;
  description?: string;
  source?: 'bailian' | 'local' | 'web' | 'file';
  documents?: string[];
  documentCount?: number;
  status?: 'connected' | 'syncing' | 'error';
}
