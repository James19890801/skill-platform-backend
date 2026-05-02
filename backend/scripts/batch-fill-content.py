"""
批量填充所有 Skill 的 content 字段
生成标准 SKILL.md 格式（基于 Anthropic + VS Code + agentskills.io 行业标准）：
YAML Frontmatter → 角色定义 → 交付物定义 → 实施步骤 → 工具调用说明 → 输入格式 → 输出格式 → 约束条件 → 示例
"""
import json
import urllib.request
import urllib.error
import time
from typing import Optional

API_BASE = "https://skill-platform-backend-production.up.railway.app"


# ============================================================
# 领域模板（每个领域的完整 Skill 定义）
# ============================================================
DOMAIN_TEMPLATES = {
    "legal": {
        "role": "法律事务专家",
        "description": "精通法律条文解读、合同审核、合规审查和法律风险识别",
        "deliverables": [
            ("法律风险分析报告", "包含条款风险评级、合规性评估和修改建议的结构化报告"),
            ("合同审核意见书", "对合同条款逐条审核，标注风险等级并提供修改方案"),
            ("合规检查清单", "按法规要求逐项检查的合规性清单，标注达标/不达标及整改措施"),
        ],
        "steps": [
            ("需求理解", "接收用户输入的法律文档或需求，明确审查目标和关注重点"),
            ("文档解析", "提取文档关键条款、定义、责任分配和限制条件等核心信息"),
            ("风险评估", "逐条分析条款合法性、风险等级，标注潜在法律漏洞"),
            ("合规比对", "将条款与相关法律法规进行比对，识别合规差距"),
            ("建议生成", "根据风险评估结果，生成具体的修改建议和谈判策略"),
            ("报告输出", "整理为结构化法律分析报告，标注优先级和执行建议"),
        ],
        "tools": [
            ("条款提取器", "从合同文档中自动提取关键条款和定义，用于后续分析"),
            ("法规查询", "查询特定领域的法律法规条文，支持按关键词检索"),
            ("风险评分", "对识别出的风险项进行自动评分，输出风险热力图"),
        ],
        "inputs": ["合同/法律文档（PDF/Word/纯文本）", "审查标准和重点关注领域", "相关法规清单或行业规范"],
        "output": "结构化法律分析报告，包含风险矩阵、合规评估分项、修改建议和谈判策略",
        "constraints": [
            "严格以现行法律法规为依据，不得主观臆断",
            "对于不确定的法律条款，必须标注仅供参考，建议咨询执业律师",
            "涉及商业秘密的内容应脱敏处理",
            "多个法域冲突时需特别标注说明",
        ],
        "examples": [
            ("审核一份保密协议", "NDA 合同中'保密期限'条款约定为 99 年", "评估该条款合法性，指出部分地区法律限制保密期限不超过 5 年，建议调整为 3-5 年"),
        ],
    },
    "finance": {
        "role": "财务分析专家",
        "description": "精通财务数据分析、报表解读、预算管理和财务风险评估",
        "deliverables": [
            ("财务分析报告", "包含关键指标解读、趋势分析、风险预警的综合财务报告"),
            ("预算执行分析", "预算执行情况的偏差分析，含原因诊断和调整建议"),
            ("成本优化方案", "基于数据的成本结构分析和降本增效方案"),
        ],
        "steps": [
            ("数据接入", "接收财务数据（报表/流水/预算），验证数据完整性和格式正确性"),
            ("数据清洗", "识别异常值、缺失值和重复数据，进行规范化处理"),
            ("指标计算", "计算关键财务指标（毛利率/净利率/周转率/资产负债率等）"),
            ("趋势分析", "对比历史期间数据，识别趋势变化和异常波动"),
            ("归因分析", "对显著变化进行归因分析，定位核心驱动因素"),
            ("报告输出", "生成结构化财务分析报告，包含数据可视化和可执行建议"),
        ],
        "tools": [
            ("数据透视器", "对财务数据进行多维透视分析，支持按时间/部门/科目维度切分"),
            ("指标计算器", "自动计算各类财务指标并生成趋势图表"),
            ("异常检测器", "基于统计规则自动检测财务数据中的异常值"),
        ],
        "inputs": ["财务报表（利润表/资产负债表/现金流量表）", "预算数据和实际执行数据", "行业基准值和历史对比数据"],
        "output": "结构化财务分析报告，包含关键指标看板、趋势图表、异常预警和改进建议",
        "constraints": [
            "所有分析必须基于实际数据，不得虚构数据",
            "对异常数据需先验证确认，不可直接得出结论",
            "涉及预测分析时必须标注假设条件和置信区间",
            "敏感财务数据必须脱敏处理",
        ],
        "examples": [
            ("月度经营分析", "某公司 3 月营收 500 万，环比下降 15%", "分析发现主要受 A 产品线销售额下降 30% 影响，归因为竞品降价，建议调整定价策略"),
        ],
    },
    "hr": {
        "role": "人力资源管理专家",
        "description": "精通人才招聘、绩效管理、培训发展、员工关系等人力资源全模块",
        "deliverables": [
            ("人才评估报告", "基于岗位匹配度的候选人综合评估报告"),
            ("绩效分析报告", "包含绩效分布、趋势分析和改进建议的绩效报告"),
            ("人力资源分析", "人员结构、流失率、继任计划等人力数据分析报告"),
        ],
        "steps": [
            ("需求对接", "理解人力资源业务需求，明确分析目标和标准"),
            ("数据收集", "收集相关信息（简历/绩效数据/人才档案等）"),
            ("结构化分析", "按评估维度进行系统化分析和评分"),
            ("匹配度评估", "将分析结果与标准要求进行匹配，计算匹配度"),
            ("报告生成", "生成结构化的人力资源评估或分析报告"),
            ("建议输出", "提供可执行的人力资源决策建议"),
        ],
        "tools": [
            ("简历解析器", "自动解析简历结构，提取教育背景、工作经历、技能标签等关键信息"),
            ("匹配度计算器", "将候选人能力与岗位要求进行多维度匹配计算"),
            ("人才九宫格", "基于绩效-潜力两个维度，将人才归入九宫格进行分类管理"),
        ],
        "inputs": ["简历文档或员工信息", "岗位描述和能力要求", "绩效数据和评估标准"],
        "output": "结构化人才评估报告，包含匹配度评分、维度分析和决策建议",
        "constraints": [
            "评估必须公平公正，不得有性别、年龄、地域等歧视",
            "涉及员工隐私的信息必须保护，不得外泄",
            "评估结果仅供参考，最终决策需结合面试官判断",
            "不同岗位的评估权重应根据岗位特性调整",
        ],
        "examples": [
            ("招聘评估", "某公司招聘高级 Java 工程师，收到 5 份简历", "评估 5 位候选人，推荐其中 2 位进入面试，附详细匹配度分析和面试建议"),
        ],
    },
    "procurement": {
        "role": "采购管理专家",
        "description": "精通供应商寻源、评估、谈判和采购全流程管理",
        "deliverables": [
            ("供应商评估报告", "多维度供应商综合评估报告，含评分和推荐排序"),
            ("采购分析报告", "采购数据的结构化分析，含成本分析和优化建议"),
            ("询价比价分析", "各供应商报价对比分析，含性价比评估"),
        ],
        "steps": [
            ("需求确认", "明确采购需求、规格要求和交付标准"),
            ("供应商筛选", "基于资质、能力、口碑等多维度初筛供应商"),
            ("报价分析", "收集并分析各供应商报价，进行横向比较"),
            ("综合评估", "从价格、质量、交付、服务等维度进行综合评分"),
            ("风险评估", "识别潜在供应风险（质量/交付/合规）"),
            ("推荐输出", "输出供应商推荐排序和采购建议"),
        ],
        "tools": [
            ("供应商查询器", "按品类/地区/资质等条件检索匹配的供应商库"),
            ("报价对比器", "对各供应商报价进行标准化处理并横向比较"),
            ("风险评估表", "多维度评估供应商风险并自动生成风险等级"),
        ],
        "inputs": ["采购需求描述和技术规格", "供应商清单和报价资料", "历史采购数据和行业基准"],
        "output": "供应商综合评估报告，包含评分矩阵、风险分析、推荐排序和谈判策略",
        "constraints": [
            "评估过程必须公平透明，禁止利益输送",
            "敏感价格信息必须保密处理",
            "打分标准需提前确认并保持一致",
            "战略物资采购需考虑供应链安全维度",
        ],
        "examples": [
            ("IT 设备采购", "公司采购 100 台笔记本电脑，3 家供应商报价", "评估 3 家供应商，从价格/配置/售后/交付周期综合评分，推荐最优方案"),
        ],
    },
    "tech": {
        "role": "技术架构专家",
        "description": "精通技术架构设计、代码审查、系统优化和技术方案评估",
        "deliverables": [
            ("技术方案文档", "包含架构设计、技术选型、实现路径的完整技术方案"),
            ("代码审查报告", "包含代码质量评分、问题分类和修改建议的审查报告"),
            ("性能优化方案", "基于 profiling 数据的性能瓶颈分析和优化方案"),
        ],
        "steps": [
            ("需求理解", "理解业务需求和技术目标，明确系统边界和约束条件"),
            ("方案设计", "根据需求设计技术架构，选择合适的技术栈"),
            ("实现规划", "拆分任务，制定开发计划和里程碑"),
            ("质量控制", "执行代码审查、测试验证和安全检查"),
            ("部署上线", "制定发布策略，执行部署和监控"),
            ("文档输出", "编写技术文档和运维手册"),
        ],
        "tools": [
            ("架构评估器", "按可扩展性/可维护性/性能/安全等维度评估系统架构"),
            ("代码审查器", "自动扫描代码中的潜在缺陷、安全漏洞和风格问题"),
            ("性能剖析器", "分析系统性能瓶颈，生成火焰图和优化建议"),
        ],
        "inputs": ["业务需求和技术规范", "现有系统架构和代码库", "性能指标和安全要求"],
        "output": "技术方案、代码实现或优化报告，包含架构图、核心代码和部署说明",
        "constraints": [
            "技术选型需考虑团队能力和学习成本",
            "方案设计需兼顾短期交付和长期可维护性",
            "涉及敏感数据的方案必须满足安全合规要求",
            "性能优化需有数据支撑，避免过早优化",
        ],
        "examples": [
            ("微服务拆分", "单体应用性能瓶颈突出，需要拆分为微服务架构", "设计微服务拆分方案，包含服务划分/通信方式/数据一致性/部署策略"),
        ],
    },
    "platform": {
        "role": "平台服务专家",
        "description": "精通平台架构设计、服务治理、API 管理和基础能力建设",
        "deliverables": [
            ("平台服务方案", "包含服务能力定义、接口规范和集成指南的平台方案"),
            ("集成对接文档", "包含 API 说明、数据格式和对接流程的开发者文档"),
            ("平台运营报告", "包含服务调用量、稳定性、SLA 达标的运营分析"),
        ],
        "steps": [
            ("需求分析", "理解平台使用方需求和场景，定义服务能力边界"),
            ("能力设计", "设计平台服务能力，定义接口规范和数据结构"),
            ("实现开发", "开发平台服务功能和配套工具"),
            ("测试验证", "执行接口测试、性能测试和容错测试"),
            ("发布上线", "灰度发布，监控运行状态"),
            ("运营迭代", "收集反馈，持续优化平台服务"),
        ],
        "tools": [
            ("接口测试器", "自动测试 API 接口的可用性、响应时间和返回格式"),
            ("服务监控器", "监控平台服务的运行状态、调用量和错误率"),
            ("文档生成器", "根据接口定义自动生成 API 文档"),
        ],
        "inputs": ["平台使用需求和场景描述", "现有平台能力清单", "集成方技术文档和要求"],
        "output": "平台服务交付物，包含接口定义、集成指南和配置方案",
        "constraints": [
            "接口设计需遵循向后兼容原则",
            "平台变更需有灰度发布和回滚机制",
            "服务能力设计需考虑多租户隔离",
            "平台稳定性优先于功能丰富度",
        ],
        "examples": [
            ("开放 API 设计", "需要将内部能力以 API 形式开放给第三方", "设计 RESTful API 规范，包含认证/限流/文档/SDK 等完整方案"),
        ],
    },
    "general": {
        "role": "通用技能专家",
        "description": "具备通用分析和执行能力，能够处理各类常见任务",
        "deliverables": [
            ("任务执行报告", "包含执行过程、结果数据和后续建议的完整报告"),
            ("内容产出物", "根据需求生成的专业文档或内容成果"),
            ("分析结论", "基于输入数据的结构化分析结果"),
        ],
        "steps": [
            ("需求理解", "明确任务目标、交付标准和约束条件"),
            ("信息收集", "收集和整理完成任务所需的输入信息"),
            ("方案制定", "制定执行方案，确认关键节点和检查点"),
            ("执行交付", "按方案执行任务，生成交付物"),
            ("质量检查", "对照交付标准进行质量检查"),
            ("结果输出", "提交最终交付物并说明使用方式"),
        ],
        "tools": [
            ("信息提取器", "从输入材料中提取结构化信息"),
            ("质量检查表", "逐项检查交付物是否满足质量标准"),
            ("格式转换器", "在不同文档格式之间进行转换"),
        ],
        "inputs": ["任务目标和需求说明", "相关背景信息和参考资料", "格式和规范要求"],
        "output": "完成任务所需的成果物，包含结果数据和使用说明",
        "constraints": [
            "严格按照交付标准执行",
            "遇到不确定的事项需要先确认再执行",
            "复杂任务需要拆解为可执行的子步骤",
            "交付物需经过质量检查后方可输出",
        ],
        "examples": [
            ("文档格式转换", "需要将一组 10 个 Markdown 文件统一转换为 PDF 格式", "执行批量转换，确保格式一致性和内容完整性，输出压缩包供下载"),
        ],
    },
    "process": {
        "role": "流程管理专家",
        "description": "精通 BPMN 2.0 流程建模、流程分析优化和流程文档编写",
        "deliverables": [
            ("流程分析报告", "包含流程建模、瓶颈分析和优化建议的完整报告"),
            ("流程文档", "符合 ISO 9001 标准的流程文件，含流程图和操作说明"),
            ("优化方案", "基于数据分析的流程改进方案，含预期效果评估"),
        ],
        "steps": [
            ("信息采集", "通过文档分析或访谈收集业务流程现状信息"),
            ("流程建模", "使用 BPMN 2.0 标准建立流程模型"),
            ("瓶颈分析", "识别流程中的等待、重复、返工等效率瓶颈"),
            ("优化设计", "基于最佳实践设计流程优化方案"),
            ("效果评估", "预估优化后的效率提升和风险变化"),
            ("文档输出", "生成标准流程文档和优化建议报告"),
        ],
        "tools": [
            ("流程建模器", "使用 BPMN 2.0 标准绘制流程图，支持泳道图和子流程"),
            ("瓶颈分析器", "识别流程中的瓶颈节点、等待时间和资源冲突"),
            ("成熟度评估表", "按流程管理成熟度模型（0-5级）评估流程水平"),
        ],
        "inputs": ["流程描述文档或访谈记录", "现有流程图和操作手册", "业务目标和 KPI 数据"],
        "output": "流程分析报告，包含 BPMN 流程图、瓶颈分析和可执行的优化方案",
        "constraints": [
            "流程设计需遵循 BPMN 2.0 标准",
            "优化方案需考虑落地成本和实施难度",
            "涉及跨部门流程需明确各角色职责",
            "流程变更需考虑变更管理策略",
        ],
        "examples": [
            ("报销流程优化", "公司报销流程平均耗时 7 天，员工投诉率高", "分析发现主要瓶颈在财务审核环节（平均等待 3 天），建议引入自动化初审减少 60% 等待时间"),
        ],
    },
    "marketing": {
        "role": "市场营销专家",
        "description": "精通内容营销、品牌传播、市场分析和营销策略制定",
        "deliverables": [
            ("营销内容方案", "包含目标受众分析、内容策略和投放计划的完整方案"),
            ("文案创作", "针对不同渠道优化的营销文案和创意内容"),
            ("营销分析报告", "基于数据的营销效果分析和优化建议"),
        ],
        "steps": [
            ("需求对接", "明确营销目标、目标受众和品牌调性"),
            ("受众分析", "分析目标受众特征、痛点和触媒习惯"),
            ("策略制定", "制定营销策略和内容方向"),
            ("内容创作", "创作符合品牌调性和渠道特点的营销内容"),
            ("效果预估", "预估各渠道触达效果和转化率"),
            ("方案交付", "输出完整的营销方案和内容素材包"),
        ],
        "tools": [
            ("受众画像器", "基于数据构建目标受众画像，包含人口特征/兴趣偏好/行为习惯"),
            ("内容优化器", "分析内容质量，给出标题/结构/CTA 的优化建议"),
            ("渠道分析器", "评估各营销渠道的目标受众覆盖率和 ROI"),
        ],
        "inputs": ["营销目标和 KPI 要求", "品牌调性和风格指南", "目标受众信息和市场数据"],
        "output": "营销方案和内容，包含策略、文案、投放建议和效果预估",
        "constraints": [
            "内容必须符合品牌调性和合规要求",
            "涉及竞品对比需确保数据准确",
            "不同渠道的内容需要进行适配优化",
            "营销承诺须与实际产品能力一致",
        ],
        "examples": [
            ("新品上市营销", "新产品即将上市，需要制定上市营销方案", "设计完整的上市营销方案，包含目标受众/核心卖点/渠道组合/内容日历/效果衡量"),
        ],
    },
}


def fetch_skills():
    """获取所有 Skill"""
    url = f"{API_BASE}/api/skills?limit=200"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            items = data.get("data", {}).get("items", [])
            print(f"  API 返回: {len(items)} 个 Skill")
            return items
    except Exception as e:
        print(f"❌ 获取 Skills 失败: {e}")
        return []


def generate_content(skill: dict) -> str:
    """根据 Skill 元数据生成标准 SKILL.md 格式 content（行业标准结构）"""
    name = skill.get("name", "")
    description = skill.get("description", "") or ""
    domain = skill.get("domain", "general")
    sub_domain = skill.get("subDomain", "")
    ability_name = skill.get("abilityName", "")

    # 获取领域模板
    tmpl = DOMAIN_TEMPLATES.get(domain, DOMAIN_TEMPLATES["general"])

    # ---------- YAML Frontmatter ----------
    ns = skill.get("namespace", f"skill-{skill.get('id', '')}")
    yaml_frontmatter = f"""---
name: {ns}
description: {description or tmpl['description']}
---"""

    # ---------- 角色定义 ----------
    if description:
        role_def = f"你是专业的{tmpl['role']}。{description.split(chr(10))[0][:150]}"
    else:
        role_def = f"你是专业的{tmpl['role']}，专注于{ability_name or sub_domain or name}方向，{tmpl['description']}。"

    # ---------- 交付物定义 ----------
    deliverables = []
    for i, (dl_name, dl_desc) in enumerate(tmpl["deliverables"]):
        customized = dl_desc
        if i == 0 and ability_name:
            customized += f"，在{ability_name}场景下重点关注"
        deliverables.append(f"{i+1}. **{dl_name}**：{customized}")

    # ---------- 实施步骤 ----------
    steps = []
    for i, (st_name, st_desc) in enumerate(tmpl["steps"]):
        customized = st_desc
        if ability_name and i == 0:
            customized += f"，特别聚焦{ability_name}场景"
        steps.append(f"### 第{i+1}步：{st_name}\n{customized}")

    # ---------- 工具调用说明 ----------
    tools = []
    for t_name, t_desc in tmpl["tools"]:
        tools.append(f"- **{t_name}**：{t_desc}")

    # ---------- 输入格式 ----------
    inputs = []
    for inp in tmpl["inputs"]:
        inputs.append(f"- {inp}")

    # ---------- 输出格式 ----------
    output = tmpl["output"]
    if ability_name:
        output += f"，其中{ability_name}部分需单独突出展示"

    # ---------- 约束条件 ----------
    constraints = []
    for c in tmpl["constraints"]:
        constraints.append(f"- {c}")

    # ---------- 示例 ----------
    examples = []
    for ex_title, ex_input, ex_output in tmpl["examples"]:
        examples.append(f"""### 示例：{ex_title}

**用户输入：**
> {ex_input}

**Skill 输出：**
> {ex_output}""")

    # ---------- 组装完整 Markdown ----------
    content = f"""{yaml_frontmatter}

# {name}

## 角色定义

{role_def}

## 交付物定义

本 Skill 执行后将产出以下交付物：

{chr(10).join(deliverables)}

## 实施步骤

请严格按照以下步骤执行：

{chr(10).join(steps)}

## 工具调用说明

执行过程中根据需要使用以下工具：

{chr(10).join(tools)}

## 输入格式

用户应提供以下输入：

{chr(10).join(inputs)}

## 输出格式

{output}

## 约束条件

在執行過程中务必遵守以下约束：

{chr(10).join(constraints)}

## 示例

{chr(10).join(examples)}
"""
    return content.strip()


def update_skill_content(skill_id: int, content: str) -> bool:
    """更新 Skill 的 content 字段"""
    url = f"{API_BASE}/api/skills/{skill_id}"
    data = json.dumps({"content": content}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())
            return result.get("success", False)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"  ❌ HTTP {e.code}: {body}")
        return False
    except Exception as e:
        print(f"  ❌ 请求失败: {e}")
        return False


def update_skill_content_full(skill_id: int, content: str, files_json: Optional[str] = None) -> bool:
    """更新 Skill 的 content 和 files 字段"""
    payload = {"content": content}
    if files_json:
        payload["files"] = files_json
    url = f"{API_BASE}/api/skills/{skill_id}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())
            return result.get("success", False)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"  ❌ HTTP {e.code}: {body}")
        return False
    except Exception as e:
        print(f"  ❌ 请求失败: {e}")
        return False


def main():
    print("=" * 70)
    print("📥 获取所有 Skill...")
    skills = fetch_skills()
    if not skills:
        print("❌ 未获取到 Skill 数据，退出")
        return
    print(f"✅ 获取到 {len(skills)} 个 Skill\n")

    # 更新全部 Skill（新模板与旧模板结构完全不同，全部覆盖）
    to_update = skills
    print(f"📝 将更新全部 {len(to_update)} 个 Skill 的 content\n")

    success_count = 0
    fail_count = 0

    for i, skill in enumerate(to_update, 1):
        sid = skill["id"]
        sname = skill["name"]
        domain = skill.get("domain", "unknown")

        print(f"[{i}/{len(to_update)}] ID={sid} domain={domain} name={sname}")

        # 生成 content
        content = generate_content(skill)

        # 更新（先只发 content，files 等后端部署后再启用）
        ok = update_skill_content(sid, content)
        if ok:
            success_count += 1
            content_len = len(content)
            print(f"  ✅ 更新成功 (content: {content_len} 字符)")
        else:
            fail_count += 1
            print(f"  ❌ 更新失败")

        # 防止请求过快
        time.sleep(0.3)

    print("\n" + "=" * 70)
    print(f"📊 统计:")
    print(f"  总 Skill: {len(skills)}")
    print(f"  更新: {len(to_update)}")
    print(f"  成功: {success_count}")
    print(f"  失败: {fail_count}")
    if success_count > 0:
        print(f"\n✅ 成功更新 {success_count} 个 Skill 至全新标准 SKILL.md 格式")
    print("=" * 70)


if __name__ == "__main__":
    main()
