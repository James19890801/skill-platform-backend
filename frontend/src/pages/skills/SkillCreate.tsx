import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FileZipOutlined,
  InboxOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { DomainLabels, SkillDomain, SkillScope, SkillType, ISkillFile } from '../../types';
import { skillsApi } from '../../services/api';

const { Text, Title } = Typography;
const { TextArea } = Input;

type PackageFileType = ISkillFile['type'];

const skillTemplate = `---
name: 新建 Skill
description: 用一句话描述这个 Skill 能解决什么问题
---

# 角色定义
你是一个专业的业务执行助手。

## 交付物
1. 结构化分析结果
2. 可执行建议
3. 风险和缺口说明

## 输入
- 用户的任务描述
- 必要的业务材料或参考文件

## 执行步骤
1. 读取用户任务并确认目标
2. 检索 references/ 中的规则、案例或说明
3. 按 templates/ 中的格式组织输出
4. 如需确定性处理，可调用 scripts/ 中的脚本

## 输出
使用 Markdown 输出，结论先行，必要时附表格。

## 约束
- 不确定的信息要明确标注
- 不编造不存在的事实或来源
`;

const folderByType: Record<PackageFileType, string> = {
  script: 'scripts',
  template: 'templates',
  reference: 'references',
  asset: 'assets',
  data: 'data',
};

const panelStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
};

function inferPackageFileType(fileName: string): PackageFileType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['py', 'sh', 'js', 'ts', 'tsx'].includes(ext)) return 'script';
  if (['docx', 'xlsx', 'pptx', 'doc', 'xls'].includes(ext)) return 'template';
  if (['csv', 'parquet'].includes(ext)) return 'data';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ttf', 'otf'].includes(ext)) return 'asset';
  return 'reference';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const SkillCreate: React.FC = () => {
  const navigate = useNavigate();
  const [manualForm] = Form.useForm();
  const [zipForm] = Form.useForm();
  const [skillMarkdown, setSkillMarkdown] = useState(skillTemplate);
  const [packageFiles, setPackageFiles] = useState<ISkillFile[]>([]);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const packagePreview = useMemo(() => [
    'SKILL.md',
    'skill.json',
    ...packageFiles.map((file) => file.path),
  ], [packageFiles]);

  const handlePackageFile = async (file: File) => {
    const type = inferPackageFileType(file.name);
    const content = await readFileAsDataUrl(file);
    const path = `${folderByType[type]}/${file.name}`;

    setPackageFiles((prev) => [
      ...prev.filter((item) => item.path !== path),
      {
        name: file.name,
        path,
        type,
        content,
        encoding: 'base64',
        mimeType: file.type,
        size: file.size,
      },
    ]);
    message.success(`${file.name} 已加入 Skill 包`);
    return false;
  };

  const handleManualSave = async () => {
    try {
      const values = await manualForm.validateFields();
      if (!skillMarkdown.trim()) {
        message.warning('请填写 SKILL.md');
        return;
      }

      setSaving(true);
      const triggers = String(values.triggers || '')
        .split(/[,，\n]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => ({ type: 'keyword', value }));
      const manifest = {
        schemaVersion: 'skill-package/v1',
        id: values.namespace,
        namespace: values.namespace,
        name: values.name,
        version: '1.0.0',
        description: values.description || '',
        domain: values.domain,
        subDomain: values.subDomain,
        abilityName: values.abilityName,
        entrypoint: 'SKILL.md',
        triggers,
        files: packageFiles.map(({ content, ...file }) => file),
        runtime: {
          permissions: { network: values.network || 'none', domains: [], secrets: [] },
          maxRounds: values.maxRounds || 15,
        },
      };

      await skillsApi.create({
        namespace: values.namespace,
        name: values.name,
        domain: values.domain,
        subDomain: values.subDomain,
        abilityName: values.abilityName,
        description: values.description,
        scope: values.scope,
        type: values.type,
        content: skillMarkdown,
        files: JSON.stringify(packageFiles),
        manifest: JSON.stringify(manifest, null, 2),
        runtimePolicy: JSON.stringify(manifest.runtime, null, 2),
        triggerRules: JSON.stringify(triggers),
        executionType: 'agent',
      } as any);

      message.success('Skill 包草稿已创建');
      navigate('/skills');
    } catch (error: any) {
      if (!error?.errorFields) message.error('创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleZipImport = async () => {
    if (!zipFile) {
      message.warning('请先选择 zip 包');
      return;
    }

    try {
      const values = await zipForm.validateFields();
      setSaving(true);
      await skillsApi.importPackage(zipFile, values);
      message.success('Skill zip 包已导入为草稿');
      navigate('/skills');
    } catch (error: any) {
      if (!error?.errorFields) message.error('导入失败');
    } finally {
      setSaving(false);
    }
  };

  const basicFields = (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="name" label="Skill 名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="合同风险快筛" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="namespace" label="命名空间" rules={[{ required: true, message: '请输入命名空间' }]}>
            <Input placeholder="legal.contract.risk-check" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="domain" label="业务域" rules={[{ required: true, message: '请选择业务域' }]}>
            <Select>
              {Object.values(SkillDomain).map((domain) => (
                <Select.Option key={domain} value={domain}>
                  {DomainLabels[domain]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="subDomain" label="子域" rules={[{ required: true, message: '请输入子域' }]}>
            <Input placeholder="contract" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="abilityName" label="能力名称" rules={[{ required: true, message: '请输入能力名称' }]}>
            <Input placeholder="风险识别" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="scope" label="范围" initialValue={SkillScope.PERSONAL}>
            <Select
              options={[
                { value: SkillScope.PERSONAL, label: '个人' },
                { value: SkillScope.BUSINESS, label: '业务' },
                { value: SkillScope.PLATFORM, label: '平台' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="type" label="类型" initialValue={SkillType.PURE_BUSINESS}>
            <Select
              options={[
                { value: SkillType.PURE_BUSINESS, label: '纯业务型' },
                { value: SkillType.LIGHT_TECH, label: '轻技术型' },
                { value: SkillType.HEAVY_TECH, label: '重技术型' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="network" label="联网权限" initialValue="none">
            <Select
              options={[
                { value: 'none', label: '关闭' },
                { value: 'allowlist', label: '白名单' },
                { value: 'all', label: '允许' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="description" label="描述">
        <TextArea rows={3} placeholder="一句话说明这个 Skill 的用途" />
      </Form.Item>
      <Form.Item name="triggers" label="触发词">
        <Input placeholder="合同, 风险, 条款审查" />
      </Form.Item>
    </>
  );

  return (
    <div style={{ padding: 24, background: '#f6f8fb', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/skills')}>返回</Button>
          <div>
            <Title level={3} style={{ margin: 0 }}>创建 Skill 包</Title>
            <Text type="secondary">构建可安装、可导出、可运行的标准 Skill zip 包</Text>
          </div>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="manual"
        items={[
          {
            key: 'manual',
            label: '从零创建',
            children: (
              <Row gutter={20}>
                <Col span={15}>
                  <Card title="基本信息" style={panelStyle}>
                    <Form form={manualForm} layout="vertical">
                      {basicFields}
                    </Form>
                  </Card>
                  <Card title="SKILL.md" style={{ ...panelStyle, marginTop: 16 }}>
                    <TextArea
                      value={skillMarkdown}
                      onChange={(event) => setSkillMarkdown(event.target.value)}
                      rows={22}
                      style={{
                        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                        fontSize: 13,
                        lineHeight: 1.7,
                      }}
                    />
                  </Card>
                </Col>
                <Col span={9}>
                  <Card title="资源文件" style={panelStyle}>
                    <Upload.Dragger
                      multiple
                      showUploadList={false}
                      beforeUpload={(file) => handlePackageFile(file as File)}
                    >
                      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                      <p className="ant-upload-text">上传 references、templates、scripts 或 assets</p>
                    </Upload.Dragger>
                    <List
                      style={{ marginTop: 16 }}
                      dataSource={packageFiles}
                      locale={{ emptyText: '暂无资源文件' }}
                      renderItem={(file) => (
                        <List.Item
                          actions={[
                            <Button
                              key="delete"
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => setPackageFiles((prev) => prev.filter((item) => item.path !== file.path))}
                            />,
                          ]}
                        >
                          <List.Item.Meta
                            title={<Space><Text>{file.name}</Text><Tag>{folderByType[file.type]}/</Tag></Space>}
                            description={file.path}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                  <Card title="包结构预览" style={{ ...panelStyle, marginTop: 16 }}>
                    <List
                      size="small"
                      dataSource={packagePreview}
                      renderItem={(item) => <List.Item><Text code>{item}</Text></List.Item>}
                    />
                  </Card>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    block
                    size="large"
                    style={{ marginTop: 16 }}
                    onClick={handleManualSave}
                  >
                    保存 Skill 包草稿
                  </Button>
                </Col>
              </Row>
            ),
          },
          {
            key: 'zip',
            label: '上传 zip 包',
            children: (
              <Row gutter={20}>
                <Col span={14}>
                  <Card title="导入标准 Skill 包" style={panelStyle}>
                    <Upload.Dragger
                      maxCount={1}
                      accept=".zip"
                      beforeUpload={(file) => {
                        setZipFile(file as File);
                        return false;
                      }}
                      onRemove={() => setZipFile(null)}
                    >
                      <p className="ant-upload-drag-icon"><FileZipOutlined /></p>
                      <p className="ant-upload-text">选择或拖入 zip 包</p>
                      <p className="ant-upload-hint">包内应包含 SKILL.md，可选 skill.json、references/、templates/、scripts/、assets/</p>
                    </Upload.Dragger>
                  </Card>
                </Col>
                <Col span={10}>
                  <Card title="覆盖信息" style={panelStyle}>
                    <Form form={zipForm} layout="vertical">
                      <Form.Item name="name" label="名称">
                        <Input placeholder="留空则读取 zip 中的配置" />
                      </Form.Item>
                      <Form.Item name="namespace" label="命名空间">
                        <Input placeholder="留空则读取 zip 中的配置" />
                      </Form.Item>
                      <Form.Item name="domain" label="业务域">
                        <Select allowClear>
                          {Object.values(SkillDomain).map((domain) => (
                            <Select.Option key={domain} value={domain}>
                              {DomainLabels[domain]}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Form>
                    <Button
                      type="primary"
                      icon={<FileZipOutlined />}
                      loading={saving}
                      block
                      size="large"
                      onClick={handleZipImport}
                    >
                      导入为 Skill 草稿
                    </Button>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
};

export default SkillCreate;
