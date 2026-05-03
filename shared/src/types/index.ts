// ============================================
// Skill Platform - Shared Types and Constants
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

// 命名空间域 - 华为 L1 流程架构体系（16 业务域 + 其他）
export enum SkillDomain {
  MTL_MARKET = 'mtl_market',           // 市场管理
  LTC_SALES = 'ltc_sales',             // 销售管理
  ITR_SERVICE = 'itr_service',         // 客户服务
  IPD_RD = 'ipd_rd',                   // 产品研发
  SCM = 'scm',                         // 供应链
  PROCUREMENT = 'procurement',         // 采购
  MANUFACTURING = 'manufacturing',     // 制造
  DELIVERY = 'delivery',               // 交付
  FINANCE = 'finance',                 // 财务
  HR = 'hr',                           // 人力资源
  IT = 'it',                           // 信息技术
  LEGAL = 'legal',                     // 法务合规
  STRATEGY = 'strategy',               // 战略管理
  QUALITY = 'quality',                 // 质量管理
  RISK = 'risk',                       // 风险管理
  ADMIN = 'admin',                     // 行政管理
  OTHER = 'other',                     // 其他
}

// 子域映射
export const SubDomainMap: Record<SkillDomain, string[]> = {
  [SkillDomain.MTL_MARKET]: ['brand', 'marketing', 'customer_insight', 'product_marketing'],
  [SkillDomain.LTC_SALES]: ['lead', 'opportunity', 'contract', 'billing'],
  [SkillDomain.ITR_SERVICE]: ['ticket', 'troubleshooting', 'rma', 'customer_feedback'],
  [SkillDomain.IPD_RD]: ['planning', 'design', 'testing', 'release'],
  [SkillDomain.SCM]: ['planning', 'sourcing', 'logistics', 'inventory'],
  [SkillDomain.PROCUREMENT]: ['sourcing', 'evaluation', 'contract', 'supplier'],
  [SkillDomain.MANUFACTURING]: ['production', 'quality_control', 'maintenance', 'scheduling'],
  [SkillDomain.DELIVERY]: ['project', 'installation', 'acceptance', 'handover'],
  [SkillDomain.FINANCE]: ['accounting', 'tax', 'budget', 'audit'],
  [SkillDomain.HR]: ['recruitment', 'onboarding', 'performance', 'training'],
  [SkillDomain.IT]: ['development', 'testing', 'deployment', 'security'],
  [SkillDomain.LEGAL]: ['contract', 'litigation', 'patent', 'compliance'],
  [SkillDomain.STRATEGY]: ['planning', 'investment', 'partnership', 'transformation'],
  [SkillDomain.QUALITY]: ['inspection', 'audit', 'improvement', 'certification'],
  [SkillDomain.RISK]: ['identification', 'assessment', 'mitigation', 'monitoring'],
  [SkillDomain.ADMIN]: ['facility', 'travel', 'document', 'meeting'],
  [SkillDomain.OTHER]: ['miscellaneous'],
};

// ============================================
// 基础接口定义 (占位，后续填充)
// ============================================

// 基础实体接口
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Skill 基础接口
export interface ISkill extends BaseEntity {
  name: string;
  description: string;
  scope: SkillScope;
  type: SkillType;
  status: SkillStatus;
  domain: SkillDomain;
  subDomain?: string;
  version: string;
  priority: SkillPriority;
  tags?: string[];
  authorId: string;
}

// 审核相关接口
export interface IReview extends BaseEntity {
  skillId: string;
  reviewerId: string;
  status: ReviewStatus;
  comment?: string;
}

// 用户接口
export interface IUser extends BaseEntity {
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  department?: string;
  role: string;
}

// API 响应接口
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 分页请求接口
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 分页响应接口
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
