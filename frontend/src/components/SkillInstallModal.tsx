import React, { useState } from 'react';
import { Modal, TreeSelect, Select, Button, Space, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

interface SkillInstallModalProps {
  visible: boolean;
  skillId: number;
  skillName: string;
  onClose: () => void;
}

// Mock 组织树数据
const mockOrgTree = [
  { title: '集团总部', value: 'hq', key: 'hq', children: [
    { title: '战略规划部', value: 'strategy', key: 'strategy' },
    { title: '人力资源部', value: 'hr', key: 'hr' },
    { title: '财务部', value: 'finance', key: 'finance' },
    { title: '法务部', value: 'legal', key: 'legal' },
  ]},
  { title: '华东区域', value: 'east', key: 'east', children: [
    { title: '上海分公司', value: 'shanghai', key: 'shanghai' },
    { title: '杭州分公司', value: 'hangzhou', key: 'hangzhou' },
  ]},
  { title: '华南区域', value: 'south', key: 'south', children: [
    { title: '深圳分公司', value: 'shenzhen', key: 'shenzhen' },
    { title: '广州分公司', value: 'guangzhou', key: 'guangzhou' },
  ]},
  { title: '研发中心', value: 'rd', key: 'rd', children: [
    { title: '前端团队', value: 'frontend', key: 'frontend' },
    { title: '后端团队', value: 'backend', key: 'backend' },
    { title: '测试团队', value: 'qa', key: 'qa' },
  ]},
  { title: '财务共享中心', value: 'fsc', key: 'fsc' },
];

// Mock 岗位数据
const mockPositions = [
  { label: '合同管理岗', value: 'contract-mgr' },
  { label: '法务顾问岗', value: 'legal-advisor' },
  { label: '招聘专员岗', value: 'recruiter' },
  { label: '财务会计岗', value: 'accountant' },
  { label: '运维工程师岗', value: 'ops-engineer' },
  { label: '产品经理岗', value: 'pm' },
  { label: '前端开发岗', value: 'frontend-dev' },
  { label: '后端开发岗', value: 'backend-dev' },
  { label: '项目经理岗', value: 'project-mgr' },
  { label: '数据分析岗', value: 'data-analyst' },
];

const colors = {
  primary: '#2563eb',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
};

const SkillInstallModal: React.FC<SkillInstallModalProps> = ({
  visible,
  skillId: _skillId,
  skillName,
  onClose,
}) => {
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleInstall = async () => {
    if (selectedOrgs.length === 0 && selectedPositions.length === 0) {
      message.warning('请至少选择一个目标组织或岗位');
      return;
    }

    setLoading(true);
    
    // Mock 安装延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    message.success(
      `Skill「${skillName}」已成功安装到 ${selectedOrgs.length} 个组织、${selectedPositions.length} 个岗位`
    );
    
    setLoading(false);
    setSelectedOrgs([]);
    setSelectedPositions([]);
    onClose();
  };

  const handleCancel = () => {
    setSelectedOrgs([]);
    setSelectedPositions([]);
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DownloadOutlined style={{ color: colors.primary }} />
          <span>安装 Skill 到组织/岗位</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          <Button 
            type="primary" 
            loading={loading}
            onClick={handleInstall}
            style={{ 
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
              border: 'none', 
              borderRadius: 8,
            }}
          >
            确认安装
          </Button>
        </Space>
      }
      width={520}
      styles={{
        body: { paddingTop: 24 }
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          padding: 16, 
          background: '#f8fafc', 
          borderRadius: 8,
          marginBottom: 24,
        }}>
          <span style={{ color: colors.textSecondary }}>安装 Skill：</span>
          <span style={{ 
            fontWeight: 600, 
            color: colors.textPrimary,
            marginLeft: 8,
          }}>
            {skillName}
          </span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block',
            fontWeight: 500, 
            color: colors.textPrimary,
            marginBottom: 8,
            fontSize: 14,
          }}>
            选择目标组织
          </label>
          <TreeSelect
            treeData={mockOrgTree}
            value={selectedOrgs}
            onChange={setSelectedOrgs}
            placeholder="选择要安装到的组织"
            treeCheckable
            showCheckedStrategy={TreeSelect.SHOW_PARENT}
            style={{ width: '100%' }}
            dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
            allowClear
          />
        </div>

        <div>
          <label style={{ 
            display: 'block',
            fontWeight: 500, 
            color: colors.textPrimary,
            marginBottom: 8,
            fontSize: 14,
          }}>
            选择目标岗位
          </label>
          <Select
            mode="multiple"
            value={selectedPositions}
            onChange={setSelectedPositions}
            placeholder="选择要安装到的岗位"
            options={mockPositions}
            style={{ width: '100%' }}
            allowClear
          />
        </div>
      </div>
    </Modal>
  );
};

export default SkillInstallModal;
