"""
Deep Agent Runtime - FastAPI 入口
提供 Agent 执行的 HTTP API
"""
import os
import sys
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

# 添加 src 目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from config.settings import settings
from agent.deep_agent_runtime import DeepAgentRuntime, get_runtime
from tools.bailian_adapter import list_available_models
from api.chat_service import get_chat_service
from tools.planning_tool import get_planning_tool
from api.session_manager import get_session_manager
from skills.loader import scan_skills_directory, load_skill_metadata, load_skill_instructions

# 创建 FastAPI 应用
app = FastAPI(
    title="Deep Agent Runtime API",
    description="基于 Deep Agent SDK 的智能体运行时服务",
    version="1.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ 请求/响应模型 ============

class ChatRequest(BaseModel):
    """对话请求"""
    thread_id: str
    message: str
    model: Optional[str] = None
    skills: Optional[List[str]] = None
    stream: bool = True


class ChatResponse(BaseModel):
    """对话响应"""
    thread_id: str
    response: str
    metadata: Dict[str, Any] = {}


class SkillInfo(BaseModel):
    """Skill 信息"""
    name: str
    description: str
    version: str
    author: str
    instructions_preview: str  # SKILL.md 前 200 字符


class CreateAgentRequest(BaseModel):
    """创建 Agent 请求"""
    thread_id: str
    system_prompt: Optional[str] = None
    skills: Optional[List[str]] = None
    model: Optional[str] = None


class CreateTasksRequest(BaseModel):
    """创建任务请求"""
    tasks: List[Dict[str, Any]]
    thread_id: Optional[str] = "default"


class UpdateTaskRequest(BaseModel):
    """更新任务请求"""
    task_id: str
    status: str
    result: Optional[str] = None


# ============ API 端点 ============

@app.get("/")
async def root():
    """服务状态"""
    return {
        "service": "Deep Agent Runtime",
        "status": "running",
        "version": "1.0.0",
        "default_model": settings.default_model,
    }


@app.get("/models")
async def get_models():
    """获取可用模型列表"""
    return {
        "models": list_available_models(),
        "default": settings.default_model,
    }


@app.post("/agent/create")
async def create_agent(request: CreateAgentRequest):
    """创建新的 Agent 会话"""
    runtime = get_runtime()
    
    try:
        agent = runtime.create_agent(
            thread_id=request.thread_id,
            system_prompt=request.system_prompt,
            skills=request.skills,
            model=request.model,
        )
        
        return {
            "success": True,
            "thread_id": request.thread_id,
            "message": "Agent created successfully",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    对话接口
    
    支持流式和非流式输出
    """
    runtime = get_runtime()
    session_manager = get_session_manager()
    
    # 确保会话存在并获取历史上下文
    session = session_manager.ensure_session_for_thread(
        thread_id=request.thread_id,
        model=request.model or settings.default_model,
    )
    history = session_manager.get_history(session.session_id)
    
    if request.model:
        runtime.model = request.model
    
    # 先保存用户消息
    session_manager.add_message(
        session_id=session.session_id,
        role="user",
        content=request.message,
        metadata={"model": request.model or settings.default_model},
    )
    
    try:
        if request.stream:
            # 流式输出
            async def generate():
                full_response = ""
                async for chunk in runtime.run_stream(
                    thread_id=request.thread_id,
                    user_input=request.message,
                    history=history,
                ):
                    # 收集完整响应用于保存
                    if isinstance(chunk, dict) and chunk.get("type") == "content":
                        full_response += chunk.get("content", "")
                    elif isinstance(chunk, dict) and chunk.get("type") == "done":
                        if full_response:
                            session_manager.add_message(
                                session_id=session.session_id,
                                role="assistant",
                                content=full_response,
                            )
                    # 解析 chunk 并格式化
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
            )
        else:
            # 非流式输出
            result = await runtime.run(
                thread_id=request.thread_id,
                user_input=request.message,
                history=history,
                stream=False,
            )
            
            result_str = str(result)
            
            # 保存助手回复
            if result_str:
                session_manager.add_message(
                    session_id=session.session_id,
                    role="assistant",
                    content=result_str,
                )
            
            return ChatResponse(
                thread_id=request.thread_id,
                response=result_str,
                metadata={"model": runtime.model},
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v2/chat")
async def chat_v2(request: ChatRequest):
    """
    对话接口 V2 - 直接调用百炼模型
    
    用于测试百炼 API 流式输出，无需 Deep Agent SDK
    """
    chat_service = get_chat_service()
    session_manager = get_session_manager()
    
    # 确保会话存在并获取历史上下文
    session = session_manager.ensure_session_for_thread(
        thread_id=request.thread_id,
        model=request.model or settings.default_model,
    )
    history = session_manager.get_history(session.session_id)
    
    # 系统提示
    system_prompt = """你是一个智能流程自动化助手，具备以下核心能力：

1. Planning - 任务分解与追踪：将复杂任务分解为可执行的步骤
2. Context Management - 上下文管理：有效管理大量信息，防止信息丢失
3. Subagent Spawning - 子任务派发：将子任务派发给专门的子智能体
4. Memory - 持久记忆：记住用户偏好和历史交互

执行原则：
- 先规划，再执行
- 验证每个步骤的结果
- 保持上下文清晰
- 及时总结和汇报
"""
    
    # 先保存用户消息
    session_manager.add_message(
        session_id=session.session_id,
        role="user",
        content=request.message,
        metadata={"model": request.model or settings.default_model},
    )
    
    try:
        if request.stream:
            # 流式输出
            async def generate():
                full_response = ""
                async for chunk in chat_service.chat(
                    message=request.message,
                    model=request.model,
                    system_prompt=system_prompt,
                    history=history,
                    stream=True,
                ):
                    if chunk.get("type") == "content":
                        full_response += chunk.get("content", "")
                    elif chunk.get("type") == "done":
                        # 流结束，保存助手回复
                        if full_response:
                            session_manager.add_message(
                                session_id=session.session_id,
                                role="assistant",
                                content=full_response,
                            )
                    yield chat_service.format_sse(chunk)
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
            )
        else:
            # 非流式输出
            full_content = ""
            async for chunk in chat_service.chat(
                message=request.message,
                model=request.model,
                system_prompt=system_prompt,
                history=history,
                stream=False,
            ):
                if chunk.get("type") == "content":
                    full_content += chunk.get("content", "")
            
            # 保存助手回复
            if full_content:
                session_manager.add_message(
                    session_id=session.session_id,
                    role="assistant",
                    content=full_content,
                )
            
            return ChatResponse(
                thread_id=request.thread_id,
                response=full_content,
                metadata={"model": request.model or settings.default_model},
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/skills")
async def list_skills():
    """列出所有可用 Skills（扫描 skills 目录）"""
    runtime = get_runtime()
    
    # 扫描 skills 目录
    scanned_skills = scan_skills_directory(runtime.skills_dir)
    
    skills_info = []
    
    # 添加已加载的 Skills
    for name, skill in runtime._loaded_skills.items():
        preview = skill.instructions[:200] if skill.instructions else ""
        skills_info.append({
            "name": skill.name,
            "description": skill.description,
            "version": skill.version,
            "author": skill.author,
            "instructions_preview": preview,
            "status": "loaded",
        })
    
    # 添加扫描发现的 Skills（未加载）
    for name, skill_data in scanned_skills.items():
        if name not in runtime._loaded_skills:
            metadata = skill_data.get("metadata")
            instructions = skill_data.get("instructions", "")
            skills_info.append({
                "name": name,
                "description": metadata.description if metadata else "",
                "version": metadata.version if metadata else "1.0.0",
                "author": metadata.author if metadata else "",
                "instructions_preview": instructions[:200],
                "status": "available",
            })
    
    return {"skills": skills_info, "total": len(skills_info)}


@app.post("/skills/load")
async def load_skill(skill_name: str, skill_path: str = None):
    """加载 Skill"""
    runtime = get_runtime()
    
    # 默认从 skills 目录加载
    if not skill_path:
        skill_path = os.path.join(runtime.skills_dir, skill_name)
    
    if not os.path.exists(skill_path):
        raise HTTPException(status_code=404, detail=f"Skill not found: {skill_path}")
    
    try:
        skill = runtime.load_skill(skill_path)
        return {
            "success": True,
            "skill": SkillInfo(
                name=skill.name,
                description=skill.description,
                version=skill.version,
                author=skill.author,
                instructions_preview=skill.instructions[:200],
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/skills/upload")
async def upload_skill(file: UploadFile = File(...)):
    """上传 Skill 文件包（ZIP）"""
    # TODO: 实现 Skill 上传和解压
    return {"success": True, "message": "Skill uploaded", "filename": file.filename}


@app.delete("/agent/{thread_id}")
async def delete_agent(thread_id: str):
    """删除 Agent 会话"""
    runtime = get_runtime()
    runtime.clear_memory(thread_id)
    return {"success": True, "thread_id": thread_id}


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


# ============ Planning API ============

@app.post("/planning/tasks")
async def create_tasks(request: CreateTasksRequest):
    """
    创建任务列表 (write_todos)
    
    将复杂任务分解为可执行的子任务
    """
    planning = get_planning_tool()
    
    try:
        result = planning.write_todos(request.tasks, request.thread_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/planning/tasks/{task_id}")
async def update_task(task_id: str, request: UpdateTaskRequest):
    """更新任务状态"""
    planning = get_planning_tool()
    
    try:
        result = planning.update_task(task_id, request.status, request.result)
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/planning/tasks")
async def list_tasks(status: Optional[str] = None, priority: Optional[str] = None):
    """列出任务"""
    planning = get_planning_tool()
    return {"tasks": planning.list_tasks(status, priority)}


@app.get("/planning/tasks/{task_id}")
async def get_task(task_id: str):
    """获取任务详情"""
    planning = get_planning_tool()
    task = planning.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    
    return {"task": task}


@app.get("/planning/progress")
async def get_progress():
    """获取整体进度"""
    planning = get_planning_tool()
    return planning.get_progress()


@app.delete("/planning/tasks")
async def clear_tasks():
    """清空所有任务"""
    planning = get_planning_tool()
    planning.clear_tasks()
    return {"success": True, "message": "所有任务已清空"}


# ============ Document Generation API ============

class GenerateDocxRequest(BaseModel):
    """生成 Word 文档请求"""
    title: str = "文档"
    sections: List[Dict[str, Any]] = []
    process_data: Optional[Dict[str, Any]] = None
    process_name: Optional[str] = None
    doc_type: str = "report"  # "report" or "process"


@ app.post("/tools/generate-docx")
async def generate_docx(request: GenerateDocxRequest):
    """
    生成 Word 文档
    
    - doc_type="report": 使用 sections 参数生成报告文档
    - doc_type="process": 使用 process_data 和 process_name 生成流程文档
    """
    from tools.document_generator import (
        generate_report_document,
        generate_process_document,
    )
    
    try:
        if request.doc_type == "process" and request.process_data:
            filepath = generate_process_document(
                process_name=request.process_name or request.title,
                process_data=request.process_data,
            )
        else:
            filepath = generate_report_document(
                title=request.title,
                sections=request.sections,
            )
        
        filename = os.path.basename(filepath)
        
        return {
            "success": True,
            "filename": filename,
            "path": filepath,
            "download_url": f"/tools/download/{filename}",
            "message": f"文档已生成: {filename}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@ app.get("/tools/download/{filename}")
async def download_docx(filename: str):
    """下载生成的文档"""
    from tools.document_generator import DOCUMENTS_OUTPUT_DIR
    
    # 安全检查：防止路径穿越
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(DOCUMENTS_OUTPUT_DIR, safe_filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"文件不存在: {safe_filename}")
    
    # 根据扩展名设置 Content-Type
    ext = os.path.splitext(safe_filename)[1].lower()
    media_types = {
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    
    from fastapi.responses import FileResponse
    return FileResponse(
        path=filepath,
        filename=safe_filename,
        media_type=media_types.get(ext, "application/octet-stream"),
    )


@ app.get("/tools/documents")
async def list_documents():
    """列出已生成的文档"""
    from tools.document_generator import list_generated_docs
    docs = list_generated_docs()
    return {"documents": docs, "total": len(docs)}


# ============ Session API ============

@app.post("/sessions")
async def create_session(
    user_id: Optional[str] = None,
    model: Optional[str] = None,
    skills: Optional[List[str]] = None,
):
    """创建新会话"""
    session_manager = get_session_manager()
    
    session = session_manager.create_session(
        user_id=user_id,
        model=model or settings.default_model,
        skills=skills,
    )
    
    return {"success": True, "session": session}


@app.get("/sessions")
async def list_sessions(user_id: Optional[str] = None):
    """列出会话"""
    session_manager = get_session_manager()
    sessions = session_manager.list_sessions(user_id)
    return {"sessions": sessions, "total": len(sessions)}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """获取会话详情"""
    session_manager = get_session_manager()
    session = session_manager.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    
    return {"session": session}


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """删除会话"""
    session_manager = get_session_manager()
    
    if not session_manager.delete_session(session_id):
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    
    return {"success": True, "message": "会话已删除"}


@app.get("/sessions/{session_id}/history")
async def get_session_history(session_id: str):
    """获取会话历史"""
    session_manager = get_session_manager()
    history = session_manager.get_history(session_id)
    
    return {"session_id": session_id, "history": history}


# ============ 启动入口 ============

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.agent_runtime_host,
        port=settings.agent_runtime_port,
        reload=True,
    )