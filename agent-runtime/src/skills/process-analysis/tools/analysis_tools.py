"""
流程分析工具
"""
from langchain_core.tools import tool
import json


@tool
def analyze_process_document(document_content: str) -> str:
    """
    分析流程文档内容，提取关键节点信息
    
    Args:
        document_content: 流程文档的文本内容
        
    Returns:
        结构化的节点信息 JSON
    """
    # 基础分析逻辑（实际可接入更复杂的 NLP 处理）
    result = {
        "status": "analyzed",
        "content_length": len(document_content),
        "preview": document_content[:500] if len(document_content) > 500 else document_content,
    }
    return json.dumps(result, ensure_ascii=False)


@tool
def identify_risks(nodes_json: str) -> str:
    """
    从节点信息中识别风险点
    
    Args:
        nodes_json: 节点信息的 JSON 字符串
        
    Returns:
        风险分析结果 JSON
    """
    try:
        nodes = json.loads(nodes_json)
        risks = []
        
        for node in nodes.get("nodes", []):
            # 检查常见风险模式
            if "审批" in node.get("name", ""):
                risks.append({
                    "node": node.get("id"),
                    "risk_type": "审批瓶颈",
                    "description": "多级审批可能导致延误",
                })
            
            if not node.get("inputs"):
                risks.append({
                    "node": node.get("id"),
                    "risk_type": "信息断点",
                    "description": "节点缺少明确输入定义",
                })
        
        return json.dumps({"risks": risks}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)