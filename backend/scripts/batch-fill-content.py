"""
批量填充所有 Skill 的 content 字段
生成标准 SKILL.md 格式：角色定义 → 核心职责 → 输入格式 → 输出格式 → 执行原则
"""
import json
import urllib.request
import urllib.error
import time

API_BASE = "https://skill-platform-backend-production.up.railway.app"

# 领域模板
DOMAIN_TEMPLATES = {
    "legal": {
        "role": "法律事务专家",
        "responsibilities": [
            ("条款分析", "深入分析合同条款，识别潜在法律风险"),
            ("合规审查", "确保内容符合相关法律法规要求"),
            ("文书生成", "生成标准化的法律文书和审查报告"),
        ],
        "inputs": ["合同文档或法律文书", "审查标准和法规要求", "特定条款关注点"],
        "output": "结构化法律分析报告，包含风险识别、合规评估和改进建议",
        "principles": ["严格遵循法律法规", "保持客观中立立场", "注重证据和事实依据", "保护商业秘密和隐私"],
    },
    "finance": {
        "role": "财务分析专家",
        "responsibilities": [
            ("数据解读", "深度解读财务数据和指标含义"),
            ("异常识别", "识别财务数据中的异常和风险信号"),
            ("分析报告", "生成结构化财务分析报告"),
        ],
        "inputs": ["财务报表或原始数据", "分析目标和关注维度", "行业基准数据"],
        "output": "结构化财务分析报告，包含数据解读、风险评估和改进建议",
        "principles": ["基于真实数据进行分析", "多维度交叉验证", "关注业务实质而非形式", "给出可执行的建议"],
    },
    "hr": {
        "role": "人力资源管理专家",
        "responsibilities": [
            ("简历分析", "快速解析简历内容，提取关键信息"),
            ("人才评估", "基于岗位要求评估候选人匹配度"),
            ("文书撰写", "生成专业的人力资源相关文书"),
        ],
        "inputs": ["简历文档或候选人信息", "岗位描述和要求", "评估标准和模板"],
        "output": "结构化评估报告，包含候选人分析、匹配度评估和面试建议",
        "principles": ["公平公正，避免歧视", "关注实际能力和潜力", "基于数据做决策", "保护候选人隐私"],
    },
    "procurement": {
        "role": "采购管理专家",
        "responsibilities": [
            ("供应商检索", "根据采购需求检索匹配的供应商"),
            ("供应商评估", "多维度评估供应商资质和能力"),
            ("采购分析", "分析采购数据和成本结构"),
        ],
        "inputs": ["采购需求描述", "供应商数据库", "评估标准和权重"],
        "output": "供应商评估报告，包含匹配度评分、风险提示和推荐建议",
        "principles": ["公平透明比选", "综合评估而非单一维度", "关注长期合作价值", "控制采购风险"],
    },
    "process": {
        "role": "流程管理专家",
        "responsibilities": [
            ("流程解析", "从文档或描述中提取流程关键信息"),
            ("风险分析", "识别流程中的瓶颈、断点和风险"),
            ("优化建议", "基于最佳实践提供流程改进方案"),
        ],
        "inputs": ["流程文档或描述", "流程节点和角色信息", "业务目标和KPI"],
        "output": "结构化流程分析报告，包含流程图、风险评估和优化建议",
        "principles": ["先理解业务本质再分析流程", "关注异常和例外路径", "结合行业最佳实践", "确保建议可落地执行"],
    },
    "strategy": {
        "role": "战略规划专家",
        "responsibilities": [
            ("方案评估", "全面评估方案的可行性和价值"),
            ("分析洞察", "从多维度分析战略问题和机会"),
            ("文档撰写", "生成高质量的战略文档"),
        ],
        "inputs": ["方案文档或战略材料", "评估标准和框架", "背景和约束条件"],
        "output": "结构化评估报告，包含多维度评分、风险分析和优化建议",
        "principles": ["系统性思考，全局视角", "基于数据和事实", "关注可执行性", "平衡短期和长期利益"],
    },
    "tech": {
        "role": "技术专家",
        "responsibilities": [
            ("技术方案", "设计和评估技术方案"),
            ("开发实现", "编写高质量的代码和配置"),
            ("调试优化", "排查问题和性能优化"),
        ],
        "inputs": ["技术需求和规格说明", "相关文档和参考资料", "环境和配置信息"],
        "output": "代码实现、技术文档或配置方案",
        "principles": ["遵循最佳实践和设计模式", "确保代码质量和可维护性", "注重安全性和性能", "提供清晰的文档说明"],
    },
    "office": {
        "role": "办公自动化专家",
        "responsibilities": [
            ("文档处理", "处理各种办公文档格式的转换和编辑"),
            ("效率提升", "通过自动化工具提升办公效率"),
            ("内容生成", "根据需求生成专业的办公文档"),
        ],
        "inputs": ["办公文档或原始数据", "格式要求和模板", "特殊功能需求"],
        "output": "处理后的文档、生成的文件或分析结果",
        "principles": ["保持文档格式一致性", "确保数据准确性", "注重用户体验", "输出可直接使用的成果"],
    },
    "marketing": {
        "role": "市场营销专家",
        "responsibilities": [
            ("内容创作", "创作高质量的市场营销内容"),
            ("文案撰写", "撰写吸引人的营销文案"),
            ("传播策划", "规划和设计内容传播策略"),
        ],
        "inputs": ["营销目标和策略", "品牌调性和风格要求", "目标受众和渠道信息"],
        "output": "营销内容、文案或传播方案",
        "principles": ["以目标受众为中心", "保持品牌调性一致", "注重内容质量和可读性", "数据驱动优化"],
    },
    "platform": {
        "role": "平台服务专家",
        "responsibilities": [
            ("平台能力", "提供平台级的基础能力服务"),
            ("工具支持", "开发和维护平台工具链"),
            ("集成对接", "支持各模块的集成和对接"),
        ],
        "inputs": ["使用需求和场景", "平台能力说明", "配置参数和选项"],
        "output": "平台服务输出或配置结果",
        "principles": ["保持平台通用性和可扩展性", "确保兼容性和稳定性", "提供清晰的接口和文档", "支持灵活配置"],
    },
    "product": {
        "role": "产品管理专家",
        "responsibilities": [
            ("文档编写", "编写高质量的产品文档"),
            ("需求分析", "分析产品需求和用户场景"),
            ("方案设计", "设计产品功能和交互方案"),
        ],
        "inputs": ["产品需求和背景", "用户反馈和数据", "市场调研信息"],
        "output": "产品文档、需求规格或设计方案",
        "principles": ["以用户为中心", "数据驱动决策", "关注可交付性", "保持文档清晰规范"],
    },
    "communication": {
        "role": "沟通表达专家",
        "responsibilities": [
            ("内容创作", "创作高质量的沟通内容"),
            ("风格把握", "根据受众和场景调整表达风格"),
            ("影响说服", "通过有效沟通影响和说服他人"),
        ],
        "inputs": ["沟通目标和受众", "核心信息和要点", "风格和格式要求"],
        "output": "沟通内容、文案或表达方案",
        "principles": ["清晰简洁", "针对受众调整", "逻辑连贯", "注重实际效果"],
    },
    "management": {
        "role": "管理咨询专家",
        "responsibilities": [
            ("目标制定", "帮助制定清晰可衡量的目标"),
            ("绩效管理", "设计和优化绩效管理机制"),
            ("管理赋能", "提供管理方法和工具支持"),
        ],
        "inputs": ["管理目标和背景", "组织架构和团队信息", "管理工具和模板"],
        "output": "管理方案、目标框架或改进建议",
        "principles": ["确保目标的SMART原则", "关注可衡量和可追踪", "结合实际情况", "注重激励和赋能"],
    },
    "general": {
        "role": "通用技能专家",
        "responsibilities": [
            ("任务执行", "高效执行各类通用任务"),
            ("内容生成", "根据需求生成高质量内容"),
            ("问题解决", "分析和解决复杂问题"),
        ],
        "inputs": ["任务需求和目标", "背景信息", "格式和规范要求"],
        "output": "完成的任务成果或内容",
        "principles": ["先理解需求再执行", "保证输出质量", "及时沟通进度", "持续优化改进"],
    },
    "innovation": {
        "role": "创新思维专家",
        "responsibilities": [
            ("创意激发", "运用结构化方法激发创新想法"),
            ("思维引导", "引导深入思考和发散讨论"),
            ("方案整合", "将创意整合为可行的方案"),
        ],
        "inputs": ["需要创新的主题或问题", "背景信息和约束条件", "创意方法和工具"],
        "output": "创新方案、创意列表或思维导图",
        "principles": ["发散与收敛结合", "鼓励大胆想法", "关注可执行性", "保持开放和包容"],
    },
    "knowledge": {
        "role": "知识管理专家",
        "responsibilities": [
            ("知识整理", "整理和结构化知识内容"),
            ("信息可视化", "将复杂信息转化为直观的可视化内容"),
            ("知识传播", "设计知识的呈现和传播方式"),
        ],
        "inputs": ["原始知识内容或数据", "呈现目标和受众", "风格和格式要求"],
        "output": "结构化的知识内容或可视化成果",
        "principles": ["保持信息准确性和完整性", "注重可读性和美观性", "以受众理解为中心", "注重知识结构化"],
    },
}


def fetch_skills():
    """获取所有 Skill"""
    url = f"{API_BASE}/api/skills?limit=200"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            return data.get("data", {}).get("items", [])
    except Exception as e:
        print(f"❌ 获取 Skills 失败: {e}")
        return []


def generate_content(skill: dict) -> str:
    """根据 Skill 元数据生成标准 SKILL.md 格式 content"""
    name = skill.get("name", "")
    description = skill.get("description", "") or ""
    domain = skill.get("domain", "general")
    sub_domain = skill.get("subDomain", "")
    ability_name = skill.get("abilityName", "")

    # 获取领域模板
    tmpl = DOMAIN_TEMPLATES.get(domain, DOMAIN_TEMPLATES["general"])

    # 根据 description 提取更具体的信息
    desc_first_line = description.split("\n")[0][:100] if description else f"专注于{domain}领域的{ability_name or sub_domain}方向"

    # 构建角色定义
    if description:
        role_def = f"你是专业的{tmpl['role']}。{desc_first_line}"
    else:
        role_def = f"你是专业的{tmpl['role']}，专注于{ability_name or sub_domain or name}方向的能力建设。"

    # 构建核心职责
    responsibilities = []
    for i, (r_name, r_desc) in enumerate(tmpl["responsibilities"]):
        # 根据具体 skill 定制部分描述
        customized_desc = r_desc
        if i == 0 and ability_name:
            customized_desc = f"在{tmpl['role'].replace('专家', '').strip()}领域运用{ability_name}能力，{r_desc}"
        responsibilities.append(f"{i+1}. **{r_name}**：{customized_desc}")

    # 构建输出格式（根据 skill 描述定制）
    if any(kw in description for kw in ["报告", "分析", "评估", "审查"]):
        output_desc = f"结构化{tmpl['role'].replace('专家', '').strip()}报告，包含结论摘要、详细分析和可执行的改进建议"
    elif any(kw in description for kw in ["生成", "创建", "撰写", "编写"]):
        output_desc = f"生成的文档或内容成果，符合专业格式要求，可直接使用"
    elif any(kw in description for kw in ["解析", "转换", "处理", "编辑"]):
        output_desc = f"处理后的结构化数据或转换后的文档"
    else:
        output_desc = tmpl["output"]

    # 构建原则（根据 skill 名称微调）
    principles = []
    for p in tmpl["principles"]:
        if ability_name and "关注" in p:
            p = f"{p}，特别关注{ability_name}相关的专业细节"
        principles.append(f"- {p}")

    content = f"""# {name}

{role_def}

## 核心职责

{chr(10).join(responsibilities)}

## 输入格式

用户将提供：
"""
    for inp in tmpl["inputs"]:
        content += f"- {inp}\n"

    content += f"""
## 输出格式

{output_desc}

## 执行原则

{chr(10).join(principles)}
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
        print(f"  ❌ HTTP {e.code}: {e.read().decode()[:200]}")
        return False
    except Exception as e:
        print(f"  ❌ 请求失败: {e}")
        return False


def main():
    print("=" * 60)
    print("📥 获取所有 Skill...")
    skills = fetch_skills()
    print(f"✅ 获取到 {len(skills)} 个 Skill\n")

    # 过滤出 content 为空的
    to_update = [s for s in skills if not s.get("content")]
    print(f"📝 需要填充 content 的 Skill: {len(to_update)} 个\n")

    success_count = 0
    fail_count = 0

    for i, skill in enumerate(to_update, 1):
        sid = skill["id"]
        sname = skill["name"]
        domain = skill.get("domain", "unknown")

        print(f"[{i}/{len(to_update)}] ID={sid} domain={domain} name={sname}")

        # 生成 content
        content = generate_content(skill)

        # 更新
        ok = update_skill_content(sid, content)
        if ok:
            success_count += 1
            print(f"  ✅ 更新成功 (content 长度: {len(content)} 字符)")
        else:
            fail_count += 1
            print(f"  ❌ 更新失败")

        # 防止太快
        time.sleep(0.5)

    print("\n" + "=" * 60)
    print(f"📊 统计:")
    print(f"  总 Skill: {len(skills)}")
    print(f"  需填充: {len(to_update)}")
    print(f"  成功: {success_count}")
    print(f"  失败: {fail_count}")
    print("=" * 60)


if __name__ == "__main__":
    main()
