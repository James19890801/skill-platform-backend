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
