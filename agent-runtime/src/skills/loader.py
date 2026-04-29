"""
Skill 动态加载模块
"""
import os
import yaml
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class SkillMetadata:
    """Skill 元数据"""
    name: str
    version: str
    author: str
    description: str
    tags: List[str]
    dependencies: Dict[str, str]
    config: Dict[str, any]


def load_skill_metadata(skill_dir: str) -> Optional[SkillMetadata]:
    """
    从 skill.yaml 加载 Skill 元数据
    
    Args:
        skill_dir: Skill 目录路径
        
    Returns:
        SkillMetadata 实例或 None
    """
    yaml_path = os.path.join(skill_dir, "skill.yaml")
    
    if not os.path.exists(yaml_path):
        return None
    
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    
    return SkillMetadata(
        name=data.get("name", ""),
        version=data.get("version", "1.0.0"),
        author=data.get("author", ""),
        description=data.get("description", ""),
        tags=data.get("tags", []),
        dependencies=data.get("dependencies", {}),
        config=data.get("config", {}),
    )


def load_skill_instructions(skill_dir: str) -> str:
    """
    从 SKILL.md 加载 Skill 指令
    
    Args:
        skill_dir: Skill 目录路径
        
    Returns:
        SKILL.md 内容
    """
    md_path = os.path.join(skill_dir, "SKILL.md")
    
    if not os.path.exists(md_path):
        return ""
    
    with open(md_path, "r", encoding="utf-8") as f:
        return f.read()


def scan_skills_directory(skills_dir: str) -> Dict[str, Dict]:
    """
    扫描 Skills 目录，返回所有 Skill 信息
    
    Args:
        skills_dir: Skills 根目录
        
    Returns:
        {skill_name: {metadata, instructions}} 字典
    """
    skills = {}
    
    if not os.path.exists(skills_dir):
        return skills
    
    for item in os.listdir(skills_dir):
        skill_path = os.path.join(skills_dir, item)
        
        if os.path.isdir(skill_path):
            metadata = load_skill_metadata(skill_path)
            instructions = load_skill_instructions(skill_path)
            
            if metadata:
                skills[metadata.name] = {
                    "metadata": metadata,
                    "instructions": instructions,
                    "path": skill_path,
                }
    
    return skills