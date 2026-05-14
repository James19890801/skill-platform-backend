export interface DefaultProcessArchitectureNode {
  id: number;
  parentId: number | null;
  code: string | null;
  name: string;
  level: number;
  sortOrder: number;
  description: string | null;
}

export const defaultProcessArchitectureTree = {
  "name": "真实流程架构",
  "description": "从 1.流程架构(1).xlsx 导入，按合并单元格恢复 A-E 列层级。",
  "source": "excel",
  "version": "1.0.0",
  "status": "active"
} as const;

export const defaultProcessArchitectureNodes: DefaultProcessArchitectureNode[] = [
  {
    "id": 2,
    "parentId": null,
    "code": "1.0",
    "name": "DSTE战略规划到执行",
    "level": 1,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 12,
    "parentId": null,
    "code": "3.0",
    "name": "IPD集成产品开发流程",
    "level": 1,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 22,
    "parentId": null,
    "code": "4.0",
    "name": "LTC线索到回款",
    "level": 1,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 59,
    "parentId": null,
    "code": "5.0",
    "name": "1-N定制产品开发",
    "level": 1,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 106,
    "parentId": null,
    "code": "6.0",
    "name": "OTD订单到交付",
    "level": 1,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 137,
    "parentId": null,
    "code": "7.0",
    "name": "供应商开发",
    "level": 1,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 152,
    "parentId": null,
    "code": "8.0",
    "name": "ITR客户问题到解决",
    "level": 1,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 158,
    "parentId": null,
    "code": "9.0",
    "name": "人力资源和行政",
    "level": 1,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 183,
    "parentId": null,
    "code": "10.0",
    "name": "财务管理",
    "level": 1,
    "sortOrder": 8,
    "description": null
  },
  {
    "id": 220,
    "parentId": null,
    "code": "11.0",
    "name": "数字化管理",
    "level": 1,
    "sortOrder": 9,
    "description": null
  },
  {
    "id": 267,
    "parentId": null,
    "code": "12.0",
    "name": "基础支撑",
    "level": 1,
    "sortOrder": 10,
    "description": null
  },
  {
    "id": 3,
    "parentId": 2,
    "code": "1.1",
    "name": "战略规划流程",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 13,
    "parentId": 12,
    "code": null,
    "name": "锂电IPD",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 23,
    "parentId": 22,
    "code": null,
    "name": "锂电-LTC（优化前）",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 60,
    "parentId": 59,
    "code": null,
    "name": "锂电-1-N",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 107,
    "parentId": 106,
    "code": null,
    "name": "锂电-OTD",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 138,
    "parentId": 137,
    "code": null,
    "name": "锂电-供应商开发",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 153,
    "parentId": 152,
    "code": null,
    "name": "锂电-ITR",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 159,
    "parentId": 158,
    "code": null,
    "name": "全集团",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 184,
    "parentId": 183,
    "code": null,
    "name": "全集团",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 221,
    "parentId": 220,
    "code": null,
    "name": "全集团",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 268,
    "parentId": 267,
    "code": null,
    "name": "全集团",
    "level": 2,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 5,
    "parentId": 2,
    "code": "1.2",
    "name": "战略制定流程",
    "level": 2,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 25,
    "parentId": 22,
    "code": null,
    "name": "锂电-LTC（优化后）",
    "level": 2,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 83,
    "parentId": 59,
    "code": null,
    "name": "铁芯-1-N",
    "level": 2,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 125,
    "parentId": 106,
    "code": null,
    "name": "铁芯-OTD",
    "level": 2,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 139,
    "parentId": 137,
    "code": "7.1",
    "name": "供应商开发",
    "level": 2,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 155,
    "parentId": 152,
    "code": null,
    "name": "客户质量索赔流程",
    "level": 2,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 9,
    "parentId": 2,
    "code": "1.3",
    "name": "战略执行、监控、评估流程",
    "level": 2,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 38,
    "parentId": 22,
    "code": null,
    "name": "铁芯-LTC",
    "level": 2,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 141,
    "parentId": 137,
    "code": "7.1.2",
    "name": "供应商认证（寻源到合格）",
    "level": 2,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 156,
    "parentId": 152,
    "code": null,
    "name": "铁芯-ITR",
    "level": 2,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 142,
    "parentId": 137,
    "code": "7.2",
    "name": "供应商管理",
    "level": 2,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 144,
    "parentId": 137,
    "code": "7.2.2",
    "name": "供应商质量索赔流程",
    "level": 2,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 145,
    "parentId": 137,
    "code": "7.2.3",
    "name": "供应商交期延误索赔",
    "level": 2,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 146,
    "parentId": 137,
    "code": "7.2.4",
    "name": "供应商风险管理（sop）",
    "level": 2,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 147,
    "parentId": 137,
    "code": "7.4",
    "name": "新项目管理",
    "level": 2,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 149,
    "parentId": 137,
    "code": "7.5",
    "name": "成本管理",
    "level": 2,
    "sortOrder": 8,
    "description": null
  },
  {
    "id": 151,
    "parentId": 137,
    "code": null,
    "name": "铁芯-供应商开发",
    "level": 2,
    "sortOrder": 9,
    "description": null
  },
  {
    "id": 4,
    "parentId": 3,
    "code": "1.1.1",
    "name": "战略地图编制流程",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 6,
    "parentId": 5,
    "code": "1.2.1",
    "name": "年度业务计划",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 10,
    "parentId": 9,
    "code": "1.3.1",
    "name": "战略执行、监控、复盘流程",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 14,
    "parentId": 13,
    "code": null,
    "name": "IPD主流程",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 24,
    "parentId": 23,
    "code": null,
    "name": "LTC主流程",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 26,
    "parentId": 25,
    "code": "4.1",
    "name": "线索阶段",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 39,
    "parentId": 38,
    "code": "4.1",
    "name": "线索管理",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 61,
    "parentId": 60,
    "code": null,
    "name": "1-N主流程",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 84,
    "parentId": 83,
    "code": "5.1",
    "name": "项目开工阶段",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 108,
    "parentId": 107,
    "code": "6.1",
    "name": "销售模块",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 126,
    "parentId": 125,
    "code": "6.4",
    "name": "SOP阶段",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 140,
    "parentId": 139,
    "code": "7.1.1",
    "name": "供应商开发需求与规划管理（制度）",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 143,
    "parentId": 142,
    "code": "7.2.1",
    "name": "供应商绩效管理",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 148,
    "parentId": 147,
    "code": "7.4.1",
    "name": "供应商定点管理",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 150,
    "parentId": 149,
    "code": "7.5.3",
    "name": "定价管理",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 154,
    "parentId": 153,
    "code": null,
    "name": "ITR客户问题到解决主流程",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 157,
    "parentId": 156,
    "code": null,
    "name": "ITR客户问题到解决主流程",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 160,
    "parentId": 159,
    "code": "9.1",
    "name": "组织规划与发展",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 185,
    "parentId": 184,
    "code": "10.1",
    "name": "预算管理",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 222,
    "parentId": 221,
    "code": null,
    "name": "数字化战略规划",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 269,
    "parentId": 268,
    "code": "12.1",
    "name": "投资流程",
    "level": 3,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 7,
    "parentId": 5,
    "code": "1.2.2",
    "name": "全面预算制定及发布流程",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 11,
    "parentId": 9,
    "code": "1.3.2",
    "name": "组织绩效评价、反馈、申诉及应用流程",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 15,
    "parentId": 13,
    "code": "3.1",
    "name": "产品规划",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 29,
    "parentId": 25,
    "code": "4.2",
    "name": "机会阶段",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 41,
    "parentId": 38,
    "code": "4.1.2",
    "name": "客户拜访及客户来访接待流程",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 62,
    "parentId": 60,
    "code": "5.1",
    "name": "项目启动策划阶段（至T0）",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 86,
    "parentId": 83,
    "code": "5.1.2",
    "name": "项目变更流程（内部）",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 110,
    "parentId": 107,
    "code": "6.2",
    "name": "主数据模块",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 128,
    "parentId": 125,
    "code": "6.4.2",
    "name": "订单评审及计划排产流程",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 162,
    "parentId": 159,
    "code": "9.2",
    "name": "招聘管理",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 187,
    "parentId": 184,
    "code": "10.1.2",
    "name": "预算调整",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 224,
    "parentId": 221,
    "code": null,
    "name": "数字化战略执行跟踪与调整流程",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 271,
    "parentId": 268,
    "code": null,
    "name": "行业调研（关键活动）",
    "level": 3,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 8,
    "parentId": 5,
    "code": "1.2.3",
    "name": "组织绩效制定流程",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 18,
    "parentId": 13,
    "code": "3.2",
    "name": "产品开发与生命周期管理",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 33,
    "parentId": 25,
    "code": "4.3",
    "name": "谈判并生成合同阶段",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 42,
    "parentId": 38,
    "code": "4.2",
    "name": "机会管理",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 73,
    "parentId": 60,
    "code": "5.2",
    "name": "样件试制及认可阶段",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 87,
    "parentId": 83,
    "code": "5.1.3",
    "name": "阶段评审流程-G1",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 112,
    "parentId": 107,
    "code": null,
    "name": "BOM创建、变更流程",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 129,
    "parentId": 125,
    "code": "6.4.3",
    "name": "制造执行流程",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 166,
    "parentId": 159,
    "code": "9.3",
    "name": "培训管理",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 188,
    "parentId": 184,
    "code": "10.1.3",
    "name": "预算执行监控与评估（关键活动）",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 225,
    "parentId": 221,
    "code": null,
    "name": "数字化系统建设",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 272,
    "parentId": 268,
    "code": null,
    "name": "投资方案制定（关键活动）",
    "level": 3,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 35,
    "parentId": 25,
    "code": "4.4",
    "name": "合同执行阶段",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 44,
    "parentId": 38,
    "code": "4.2.2",
    "name": "客户需求评审及TR制作流程",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 76,
    "parentId": 60,
    "code": "5.3",
    "name": "布线启动-PPAP通过阶段",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 88,
    "parentId": 83,
    "code": "5.2",
    "name": "产品过程开发阶段",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 113,
    "parentId": 107,
    "code": "6.3",
    "name": "计划模块",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 130,
    "parentId": 125,
    "code": "6.4.4",
    "name": "发货与对账及开票流程",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 169,
    "parentId": 159,
    "code": "9.4",
    "name": "绩效管理",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 189,
    "parentId": 184,
    "code": "10.2",
    "name": "成本管理",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 228,
    "parentId": 221,
    "code": null,
    "name": "整体变更控制程序",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 273,
    "parentId": 268,
    "code": "12.2",
    "name": "流程管理",
    "level": 3,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 45,
    "parentId": 38,
    "code": "4.2.3",
    "name": "客户拒单流程",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 79,
    "parentId": 60,
    "code": "5.4",
    "name": "爬坡及量产",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 90,
    "parentId": 83,
    "code": "5.2.2",
    "name": "模具开发流程",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 115,
    "parentId": 107,
    "code": "6.4",
    "name": "采购管理",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 131,
    "parentId": 125,
    "code": "6.5",
    "name": "EOP阶段",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 171,
    "parentId": 159,
    "code": "9.5",
    "name": "薪酬管理",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 191,
    "parentId": 184,
    "code": "10.2.2",
    "name": "成本核算",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 229,
    "parentId": 221,
    "code": null,
    "name": "数字化需求管理流程",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 284,
    "parentId": 268,
    "code": "12.3",
    "name": "审计流程",
    "level": 3,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 46,
    "parentId": 38,
    "code": "4.2.4",
    "name": "成本分析及报价流程",
    "level": 3,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 91,
    "parentId": 83,
    "code": "5.2.3",
    "name": "工装检具开发流程",
    "level": 3,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 117,
    "parentId": 107,
    "code": "6.5",
    "name": "生产管理",
    "level": 3,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 133,
    "parentId": 125,
    "code": "6.5.2",
    "name": "EOP售后交付流程",
    "level": 3,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 176,
    "parentId": 159,
    "code": "9.6",
    "name": "人事和员工关系管理",
    "level": 3,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 192,
    "parentId": 184,
    "code": "10.2.3",
    "name": "成本分析与管控（关键活动）",
    "level": 3,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 230,
    "parentId": 221,
    "code": null,
    "name": "数字化系统设计规划流程",
    "level": 3,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 290,
    "parentId": 268,
    "code": "12.4",
    "name": "法务流程",
    "level": 3,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 47,
    "parentId": 38,
    "code": "4.2.5",
    "name": "客户审核及供应商代码获取流程",
    "level": 3,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 92,
    "parentId": 83,
    "code": "5.2.4",
    "name": "设备开发流程",
    "level": 3,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 119,
    "parentId": 107,
    "code": "6.6",
    "name": "仓储物流管理",
    "level": 3,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 134,
    "parentId": 125,
    "code": "6.5.3",
    "name": "项目资产处置流程",
    "level": 3,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 193,
    "parentId": 184,
    "code": "10.3",
    "name": "费用管理",
    "level": 3,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 231,
    "parentId": 221,
    "code": null,
    "name": "数字化自研系统开发管理流程",
    "level": 3,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 304,
    "parentId": 268,
    "code": "12.5",
    "name": "EHS流程",
    "level": 3,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 48,
    "parentId": 38,
    "code": "4.2.6",
    "name": "项目定点流程",
    "level": 3,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 93,
    "parentId": 83,
    "code": "5.2.5",
    "name": "包装开发流程",
    "level": 3,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 121,
    "parentId": 107,
    "code": "6.6.2",
    "name": "呆滞品处理流程",
    "level": 3,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 135,
    "parentId": 125,
    "code": "6.7",
    "name": "对账管理",
    "level": 3,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 195,
    "parentId": 184,
    "code": "10.3.2",
    "name": "费用申请与报销管理（标准或规则）",
    "level": 3,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 233,
    "parentId": 221,
    "code": null,
    "name": "自研系统发布管理流程",
    "level": 3,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 309,
    "parentId": 268,
    "code": "12.6",
    "name": "采购蓝军",
    "level": 3,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 49,
    "parentId": 38,
    "code": "4.3",
    "name": "谈判并生成合同",
    "level": 3,
    "sortOrder": 8,
    "description": null
  },
  {
    "id": 94,
    "parentId": 83,
    "code": "5.2.6",
    "name": "阶段评审流程-G2",
    "level": 3,
    "sortOrder": 8,
    "description": null
  },
  {
    "id": 122,
    "parentId": 107,
    "code": "6.6.3",
    "name": "内部物流管理（包含配送）流程",
    "level": 3,
    "sortOrder": 8,
    "description": null
  },
  {
    "id": 196,
    "parentId": 184,
    "code": "10.3.3",
    "name": "费用控制与分析（标准或规则）",
    "level": 3,
    "sortOrder": 8,
    "description": null
  },
  {
    "id": 234,
    "parentId": 221,
    "code": null,
    "name": "源代码版本管控流程",
    "level": 3,
    "sortOrder": 8,
    "description": null
  },
  {
    "id": 51,
    "parentId": 38,
    "code": "4.4",
    "name": "合同执行",
    "level": 3,
    "sortOrder": 9,
    "description": null
  },
  {
    "id": 95,
    "parentId": 83,
    "code": "5.3",
    "name": "产品过程验证阶段",
    "level": 3,
    "sortOrder": 9,
    "description": null
  },
  {
    "id": 123,
    "parentId": 107,
    "code": "6.6.4",
    "name": "外部物流管理流程",
    "level": 3,
    "sortOrder": 9,
    "description": null
  },
  {
    "id": 197,
    "parentId": 184,
    "code": "10.3.4",
    "name": "薪资支付流程（含海外）",
    "level": 3,
    "sortOrder": 9,
    "description": null
  },
  {
    "id": 235,
    "parentId": 221,
    "code": null,
    "name": "数字化标准系统开发与实施管理",
    "level": 3,
    "sortOrder": 9,
    "description": null
  },
  {
    "id": 53,
    "parentId": 38,
    "code": "4.4.2",
    "name": "合同变更流程",
    "level": 3,
    "sortOrder": 10,
    "description": null
  },
  {
    "id": 97,
    "parentId": 83,
    "code": "5.3.2",
    "name": "OTS认可流程",
    "level": 3,
    "sortOrder": 10,
    "description": null
  },
  {
    "id": 124,
    "parentId": 107,
    "code": "6.6.5",
    "name": "成品交付管理流程",
    "level": 3,
    "sortOrder": 10,
    "description": null
  },
  {
    "id": 198,
    "parentId": 184,
    "code": "10.4",
    "name": "资产管理",
    "level": 3,
    "sortOrder": 10,
    "description": null
  },
  {
    "id": 237,
    "parentId": 221,
    "code": null,
    "name": "数字化系统导入与评估流程（作废）",
    "level": 3,
    "sortOrder": 10,
    "description": null
  },
  {
    "id": 54,
    "parentId": 38,
    "code": "4.4.3",
    "name": "项目变更流程（客户需求变更）",
    "level": 3,
    "sortOrder": 11,
    "description": null
  },
  {
    "id": 98,
    "parentId": 83,
    "code": "5.3.3",
    "name": "产能爬坡验证流程",
    "level": 3,
    "sortOrder": 11,
    "description": null
  },
  {
    "id": 200,
    "parentId": 184,
    "code": "10.4.1.1",
    "name": "资产到厂验收",
    "level": 3,
    "sortOrder": 11,
    "description": null
  },
  {
    "id": 238,
    "parentId": 221,
    "code": null,
    "name": "系统构建和系统配置",
    "level": 3,
    "sortOrder": 11,
    "description": null
  },
  {
    "id": 55,
    "parentId": 38,
    "code": "4.4.4",
    "name": "管理回款流程",
    "level": 3,
    "sortOrder": 12,
    "description": null
  },
  {
    "id": 99,
    "parentId": 83,
    "code": "5.3.4",
    "name": "PSO审核流程",
    "level": 3,
    "sortOrder": 12,
    "description": null
  },
  {
    "id": 201,
    "parentId": 184,
    "code": "10.4.1.2",
    "name": "资产盘点管理",
    "level": 3,
    "sortOrder": 12,
    "description": null
  },
  {
    "id": 239,
    "parentId": 221,
    "code": null,
    "name": "系统测试实施流程",
    "level": 3,
    "sortOrder": 12,
    "description": null
  },
  {
    "id": 56,
    "parentId": 38,
    "code": "4.4.5",
    "name": "客户满意度管理流程",
    "level": 3,
    "sortOrder": 13,
    "description": null
  },
  {
    "id": 100,
    "parentId": 83,
    "code": "5.3.5",
    "name": "PPAP认可流程",
    "level": 3,
    "sortOrder": 13,
    "description": null
  },
  {
    "id": 202,
    "parentId": 184,
    "code": "10.4.1.3",
    "name": "资产处置流程",
    "level": 3,
    "sortOrder": 13,
    "description": null
  },
  {
    "id": 240,
    "parentId": 221,
    "code": null,
    "name": "系统上线管理流程",
    "level": 3,
    "sortOrder": 13,
    "description": null
  },
  {
    "id": 57,
    "parentId": 38,
    "code": "4.4.6",
    "name": "项目立项流程",
    "level": 3,
    "sortOrder": 14,
    "description": null
  },
  {
    "id": 101,
    "parentId": 83,
    "code": "5.3.6",
    "name": "阶段评审流程-G3",
    "level": 3,
    "sortOrder": 14,
    "description": null
  },
  {
    "id": 203,
    "parentId": 184,
    "code": "10.4.1.4",
    "name": "资产调拨流程",
    "level": 3,
    "sortOrder": 14,
    "description": null
  },
  {
    "id": 241,
    "parentId": 221,
    "code": null,
    "name": "系统验收管理流程",
    "level": 3,
    "sortOrder": 14,
    "description": null
  },
  {
    "id": 58,
    "parentId": 38,
    "code": "4.4.7",
    "name": "价格管理流程",
    "level": 3,
    "sortOrder": 15,
    "description": null
  },
  {
    "id": 102,
    "parentId": 83,
    "code": "5.3.7",
    "name": "项目总结流程",
    "level": 3,
    "sortOrder": 15,
    "description": null
  },
  {
    "id": 204,
    "parentId": 184,
    "code": "10.4.1.5",
    "name": "资产改造流程",
    "level": 3,
    "sortOrder": 15,
    "description": null
  },
  {
    "id": 242,
    "parentId": 221,
    "code": null,
    "name": "数字化项目运营管理流程",
    "level": 3,
    "sortOrder": 15,
    "description": null
  },
  {
    "id": 103,
    "parentId": 83,
    "code": "5.3.8",
    "name": "量产项目前期样品交付流程",
    "level": 3,
    "sortOrder": 16,
    "description": null
  },
  {
    "id": 205,
    "parentId": 184,
    "code": "10.4.2",
    "name": "资产核算（关键活动）",
    "level": 3,
    "sortOrder": 16,
    "description": null
  },
  {
    "id": 244,
    "parentId": 221,
    "code": null,
    "name": "数字化项目变更管理流程",
    "level": 3,
    "sortOrder": 16,
    "description": null
  },
  {
    "id": 104,
    "parentId": 83,
    "code": "5.3.9",
    "name": "样品项目样品订单交付流程",
    "level": 3,
    "sortOrder": 17,
    "description": null
  },
  {
    "id": 206,
    "parentId": 184,
    "code": "10.5",
    "name": "往来管理",
    "level": 3,
    "sortOrder": 17,
    "description": null
  },
  {
    "id": 245,
    "parentId": 221,
    "code": null,
    "name": "数字化项目绩效管理",
    "level": 3,
    "sortOrder": 17,
    "description": null
  },
  {
    "id": 105,
    "parentId": 83,
    "code": "5.4",
    "name": "1-N过程问题升级流程",
    "level": 3,
    "sortOrder": 18,
    "description": null
  },
  {
    "id": 208,
    "parentId": 184,
    "code": "10.5.2",
    "name": "应付管理（关键活动）",
    "level": 3,
    "sortOrder": 18,
    "description": null
  },
  {
    "id": 246,
    "parentId": 221,
    "code": null,
    "name": "数字化运维",
    "level": 3,
    "sortOrder": 18,
    "description": null
  },
  {
    "id": 209,
    "parentId": 184,
    "code": "10.5.3",
    "name": "关联交易管理（关键活动）",
    "level": 3,
    "sortOrder": 19,
    "description": null
  },
  {
    "id": 249,
    "parentId": 221,
    "code": null,
    "name": "ISSUE管理",
    "level": 3,
    "sortOrder": 19,
    "description": null
  },
  {
    "id": 210,
    "parentId": 184,
    "code": "10.6",
    "name": "资金管理",
    "level": 3,
    "sortOrder": 20,
    "description": null
  },
  {
    "id": 250,
    "parentId": 221,
    "code": null,
    "name": "配置管理",
    "level": 3,
    "sortOrder": 20,
    "description": null
  },
  {
    "id": 212,
    "parentId": 184,
    "code": "10.6.2",
    "name": "现金收支管理（标准或规则）",
    "level": 3,
    "sortOrder": 21,
    "description": null
  },
  {
    "id": 251,
    "parentId": 221,
    "code": null,
    "name": "系统发布管理流程",
    "level": 3,
    "sortOrder": 21,
    "description": null
  },
  {
    "id": 213,
    "parentId": 184,
    "code": "10.6.3",
    "name": "银行账户管理（SOP）",
    "level": 3,
    "sortOrder": 22,
    "description": null
  },
  {
    "id": 252,
    "parentId": 221,
    "code": null,
    "name": "变更管理",
    "level": 3,
    "sortOrder": 22,
    "description": null
  },
  {
    "id": 214,
    "parentId": 184,
    "code": "10.7",
    "name": "税务管理",
    "level": 3,
    "sortOrder": 23,
    "description": null
  },
  {
    "id": 253,
    "parentId": 221,
    "code": null,
    "name": "数字化资源（含系统权限）",
    "level": 3,
    "sortOrder": 23,
    "description": null
  },
  {
    "id": 216,
    "parentId": 184,
    "code": "10.8",
    "name": "总账与报表管理",
    "level": 3,
    "sortOrder": 24,
    "description": null
  },
  {
    "id": 255,
    "parentId": 221,
    "code": null,
    "name": "IT服务器资源申请",
    "level": 3,
    "sortOrder": 24,
    "description": null
  },
  {
    "id": 218,
    "parentId": 184,
    "code": "10.8.2",
    "name": "报表合并与报表分析",
    "level": 3,
    "sortOrder": 25,
    "description": null
  },
  {
    "id": 256,
    "parentId": 221,
    "code": null,
    "name": "IT系统账号及权限申请",
    "level": 3,
    "sortOrder": 25,
    "description": null
  },
  {
    "id": 219,
    "parentId": 184,
    "code": "10.8.3",
    "name": "财务报告发布管理",
    "level": 3,
    "sortOrder": 26,
    "description": null
  },
  {
    "id": 257,
    "parentId": 221,
    "code": null,
    "name": "数字化运维交接流程",
    "level": 3,
    "sortOrder": 26,
    "description": null
  },
  {
    "id": 258,
    "parentId": 221,
    "code": null,
    "name": "数字化使能",
    "level": 3,
    "sortOrder": 27,
    "description": null
  },
  {
    "id": 261,
    "parentId": 221,
    "code": null,
    "name": "流程数字化",
    "level": 3,
    "sortOrder": 28,
    "description": null
  },
  {
    "id": 263,
    "parentId": 221,
    "code": null,
    "name": "流程数字化组织 角色标准化管理流程",
    "level": 3,
    "sortOrder": 29,
    "description": null
  },
  {
    "id": 264,
    "parentId": 221,
    "code": null,
    "name": "数据管理",
    "level": 3,
    "sortOrder": 30,
    "description": null
  },
  {
    "id": 266,
    "parentId": 221,
    "code": null,
    "name": "业务主数据新增变更申请流程",
    "level": 3,
    "sortOrder": 31,
    "description": null
  },
  {
    "id": 16,
    "parentId": 15,
    "code": "3.1.1",
    "name": "产品及工艺规划",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 19,
    "parentId": 18,
    "code": "3.2.1",
    "name": "研发项目立项流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 27,
    "parentId": 26,
    "code": "4.1.1",
    "name": "市场洞察和线索管理流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 30,
    "parentId": 29,
    "code": "4.2.1",
    "name": "商机分析及立项管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 34,
    "parentId": 33,
    "code": "4.3.1",
    "name": "商务谈判、合同签订及变更流程(含RFQ资料包输出)",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 36,
    "parentId": 35,
    "code": "4.4.1",
    "name": "管理对账、回款流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 40,
    "parentId": 39,
    "code": "4.1.1",
    "name": "线索发现至形成决策流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 43,
    "parentId": 42,
    "code": "4.2.1",
    "name": "机会点及需求分析流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 50,
    "parentId": 49,
    "code": "4.3.1",
    "name": "合同谈判与签订流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 52,
    "parentId": 51,
    "code": "4.4.1",
    "name": "解决方案输出流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 63,
    "parentId": 62,
    "code": "5.1.1",
    "name": "项目立项启动（SOP）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 74,
    "parentId": 73,
    "code": "5.2.1",
    "name": "样品试制及总结流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 77,
    "parentId": 76,
    "code": "5.3.1",
    "name": "产品工业化流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 80,
    "parentId": 79,
    "code": "5.4.1",
    "name": "产能爬坡及验证流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 85,
    "parentId": 84,
    "code": "5.1.1",
    "name": "客户需求评审及内部数据释放流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 89,
    "parentId": 88,
    "code": "5.2.1",
    "name": "项目工艺开发流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 96,
    "parentId": 95,
    "code": "5.3.1",
    "name": "产线验证流程（单机、连线）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 109,
    "parentId": 108,
    "code": "6.1.1",
    "name": "销售订单创建及变更流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 111,
    "parentId": 110,
    "code": null,
    "name": "物料编码申请流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 114,
    "parentId": 113,
    "code": "6.3.1",
    "name": "主生产计划管理流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 116,
    "parentId": 115,
    "code": "6.4.1",
    "name": "订购管理流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 118,
    "parentId": 117,
    "code": "6.5.1",
    "name": "生产领料、退料、补料管理流程（SOP）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 120,
    "parentId": 119,
    "code": "6.6.1",
    "name": "仓库管理规范（SOP）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 127,
    "parentId": 126,
    "code": "6.4.1",
    "name": "Safelaunch安全投产流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 132,
    "parentId": 131,
    "code": "6.5.1",
    "name": "呆滞品管理流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 136,
    "parentId": 135,
    "code": "6.7.1",
    "name": "对账开票管理流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 161,
    "parentId": 160,
    "code": "9.1.1",
    "name": "组织设置管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 163,
    "parentId": 162,
    "code": "9.2.1",
    "name": "员工招聘需求管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 167,
    "parentId": 166,
    "code": "9.3.1",
    "name": "培训需求管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 170,
    "parentId": 169,
    "code": "9.4.1",
    "name": "员工绩效管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 172,
    "parentId": 171,
    "code": "9.5.1",
    "name": "员工薪酬管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 177,
    "parentId": 176,
    "code": "9.6.1",
    "name": "考勤管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 186,
    "parentId": 185,
    "code": "10.1.1",
    "name": "预算编制",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 190,
    "parentId": 189,
    "code": "10.2.1",
    "name": "管理成本核算原则与方法（标准或规则）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 194,
    "parentId": 193,
    "code": "10.3.1",
    "name": "费用政策管理（标准或规则）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 199,
    "parentId": 198,
    "code": "10.4.1",
    "name": "管理资产",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 207,
    "parentId": 206,
    "code": "10.5.1",
    "name": "应收管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 211,
    "parentId": 210,
    "code": "10.6.1",
    "name": "资金计划管理（标准或规则）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 215,
    "parentId": 214,
    "code": "10.7.1",
    "name": "税务筹划与管理（SOP）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 217,
    "parentId": 216,
    "code": "10.8.1",
    "name": "管理经营报表",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 223,
    "parentId": 222,
    "code": null,
    "name": "数字化战略制定与分解流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 226,
    "parentId": 225,
    "code": null,
    "name": "数字化系统需求与变更管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 232,
    "parentId": 231,
    "code": null,
    "name": "软件开发流程（自研项目）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 236,
    "parentId": 235,
    "code": null,
    "name": "系统调研和蓝图确认",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 243,
    "parentId": 242,
    "code": null,
    "name": "数字化项目立项准备流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 247,
    "parentId": 246,
    "code": null,
    "name": "数字化运维管理流程（ITIL）",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 254,
    "parentId": 253,
    "code": null,
    "name": "IT需求申请流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 259,
    "parentId": 258,
    "code": null,
    "name": "信息安全",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 262,
    "parentId": 261,
    "code": null,
    "name": "流程数字化变更及发布管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 265,
    "parentId": 264,
    "code": null,
    "name": "数字化系统数据调用调整管理流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 270,
    "parentId": 269,
    "code": null,
    "name": "投资规划管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 274,
    "parentId": 273,
    "code": "12.2.1",
    "name": "流程规划",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 285,
    "parentId": 284,
    "code": "12.3.1",
    "name": "举报信息收集、提交、审批、调查、通报流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 291,
    "parentId": 290,
    "code": "12.4.1",
    "name": "合同管理",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 305,
    "parentId": 304,
    "code": "13.4.1",
    "name": "识别EHS风险与制定方案",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 310,
    "parentId": 309,
    "code": "12.6.1",
    "name": "降本项目确定流程",
    "level": 4,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 17,
    "parentId": 15,
    "code": "3.1.2",
    "name": "产品迭代流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 20,
    "parentId": 18,
    "code": "3.1.2",
    "name": "产品设计与开发",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 28,
    "parentId": 26,
    "code": "4.1.2",
    "name": "客户拜访及客户来访接待流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 31,
    "parentId": 29,
    "code": "4.2.2",
    "name": "客户需求评审、成本分析、报价及项目定点评审流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 37,
    "parentId": 35,
    "code": "4.4.2",
    "name": "客户满意度管理流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 64,
    "parentId": 62,
    "code": "5.1.2",
    "name": "产品图纸设计流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 75,
    "parentId": 73,
    "code": "5.2.2",
    "name": "产品认可流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 78,
    "parentId": 76,
    "code": "5.3.2",
    "name": "PPAP认可流程（从PPA前准备至TR通过）",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 81,
    "parentId": 79,
    "code": "5.4.2",
    "name": "财务阀审核流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 164,
    "parentId": 162,
    "code": "9.2.2",
    "name": "员工招聘管理",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 168,
    "parentId": 166,
    "code": "9.3.2",
    "name": "培训管理",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 173,
    "parentId": 171,
    "code": "9.5.2",
    "name": "员工福利管理",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 178,
    "parentId": 176,
    "code": "9.6.2",
    "name": "劳务管理",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 277,
    "parentId": 273,
    "code": "12.2.2",
    "name": "流程建设",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 286,
    "parentId": 284,
    "code": "12.3.2",
    "name": "审计计划签批流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 292,
    "parentId": 290,
    "code": "12.4.2",
    "name": "印章管理",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 306,
    "parentId": 304,
    "code": "13.4.2",
    "name": "EHS运作与控制",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 311,
    "parentId": 309,
    "code": "12.6.2",
    "name": "降本项目实施流程",
    "level": 4,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 21,
    "parentId": 18,
    "code": "3.1.3",
    "name": "管理产品生命周期",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 32,
    "parentId": 29,
    "code": "4.2.3",
    "name": "客户审核及导入流程",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 65,
    "parentId": 62,
    "code": "5.1.3",
    "name": "工艺开发流程",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 82,
    "parentId": 79,
    "code": "5.4.3",
    "name": "项目总结（SOP）",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 165,
    "parentId": 162,
    "code": "9.2.3",
    "name": "招聘供应商管理",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 174,
    "parentId": 171,
    "code": "9.5.3",
    "name": "员工保险管理",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 179,
    "parentId": 176,
    "code": "9.6.3",
    "name": "档案管理",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 281,
    "parentId": 273,
    "code": "12.2.3",
    "name": "流程绩效",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 287,
    "parentId": 284,
    "code": "12.3.3",
    "name": "审计项目开展流程",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 293,
    "parentId": 290,
    "code": "12.4.3",
    "name": "保险管理",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 307,
    "parentId": 304,
    "code": "13.4.3",
    "name": "EHS监测与度量",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 312,
    "parentId": 309,
    "code": "12.6.3",
    "name": "供应链委员会管理流程",
    "level": 4,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 66,
    "parentId": 62,
    "code": "5.1.4",
    "name": "工模检具开发流程",
    "level": 4,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 175,
    "parentId": 171,
    "code": "9.5.4",
    "name": "员工奖惩管理",
    "level": 4,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 180,
    "parentId": 176,
    "code": "9.6.4",
    "name": "人员异动管理",
    "level": 4,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 288,
    "parentId": 284,
    "code": "12.3.4",
    "name": "审计披露（对外）",
    "level": 4,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 301,
    "parentId": 290,
    "code": "12.4.4",
    "name": "法务纠纷管理",
    "level": 4,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 308,
    "parentId": 304,
    "code": "13.4.4",
    "name": "EHS评审与改进",
    "level": 4,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 67,
    "parentId": 62,
    "code": "5.1.5",
    "name": "设备开发流程",
    "level": 4,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 181,
    "parentId": 176,
    "code": "9.6.5",
    "name": "人才管理",
    "level": 4,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 289,
    "parentId": 284,
    "code": "12.3.5",
    "name": "廉洁文化建设",
    "level": 4,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 302,
    "parentId": 290,
    "code": "12.4.5",
    "name": "证件管理",
    "level": 4,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 68,
    "parentId": 62,
    "code": "5.1.6",
    "name": "包装开发流程",
    "level": 4,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 182,
    "parentId": 176,
    "code": "9.6.6",
    "name": "入离职管理",
    "level": 4,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 303,
    "parentId": 290,
    "code": "12.4.6",
    "name": "知识产权管理",
    "level": 4,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 69,
    "parentId": 62,
    "code": "5.1.7",
    "name": "质量策划及控制流程",
    "level": 4,
    "sortOrder": 6,
    "description": null
  },
  {
    "id": 70,
    "parentId": 62,
    "code": "5.1.8",
    "name": "项目变更流程",
    "level": 4,
    "sortOrder": 7,
    "description": null
  },
  {
    "id": 71,
    "parentId": 62,
    "code": "5.1.9",
    "name": "阶段评审流程（G1、G2、G3）",
    "level": 4,
    "sortOrder": 8,
    "description": null
  },
  {
    "id": 72,
    "parentId": 62,
    "code": "5.1.10",
    "name": "模具开发流程",
    "level": 4,
    "sortOrder": 9,
    "description": null
  },
  {
    "id": 227,
    "parentId": 226,
    "code": null,
    "name": "数字化系统需求与变更管理流程",
    "level": 5,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 248,
    "parentId": 247,
    "code": null,
    "name": "CASE管理",
    "level": 5,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 260,
    "parentId": 259,
    "code": null,
    "name": "信息安全管理流程",
    "level": 5,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 275,
    "parentId": 274,
    "code": null,
    "name": "流程架构规划（关键活动）",
    "level": 5,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 278,
    "parentId": 277,
    "code": null,
    "name": "流程建设、变更流程",
    "level": 5,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 282,
    "parentId": 281,
    "code": null,
    "name": "流程IT",
    "level": 5,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 294,
    "parentId": 293,
    "code": "12.4.3.1",
    "name": "产品责任险选定及购买流程",
    "level": 5,
    "sortOrder": 0,
    "description": null
  },
  {
    "id": 276,
    "parentId": 274,
    "code": null,
    "name": "流程Owner任命（关键活动）",
    "level": 5,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 279,
    "parentId": 277,
    "code": null,
    "name": "流程审批与授权（关键活动）",
    "level": 5,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 283,
    "parentId": 281,
    "code": null,
    "name": "流程审计与优化",
    "level": 5,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 295,
    "parentId": 293,
    "code": "12.4.3.2",
    "name": "财产、机器险选定及购买流程",
    "level": 5,
    "sortOrder": 1,
    "description": null
  },
  {
    "id": 280,
    "parentId": 277,
    "code": null,
    "name": "流程层级、编码规则（关键活动）",
    "level": 5,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 296,
    "parentId": 293,
    "code": "12.4.3.3",
    "name": "雇主责任险保险申报及评审流程",
    "level": 5,
    "sortOrder": 2,
    "description": null
  },
  {
    "id": 297,
    "parentId": 293,
    "code": "12.4.3.4",
    "name": "车险保险申报及评审流程",
    "level": 5,
    "sortOrder": 3,
    "description": null
  },
  {
    "id": 298,
    "parentId": 293,
    "code": "12.4.3.5",
    "name": "产品责任险理赔流程",
    "level": 5,
    "sortOrder": 4,
    "description": null
  },
  {
    "id": 299,
    "parentId": 293,
    "code": "12.4.3.6",
    "name": "财产、机器险保险理赔流程",
    "level": 5,
    "sortOrder": 5,
    "description": null
  },
  {
    "id": 300,
    "parentId": 293,
    "code": "12.4.3.7",
    "name": "雇主责任险报险及索赔流程",
    "level": 5,
    "sortOrder": 6,
    "description": null
  }
];
