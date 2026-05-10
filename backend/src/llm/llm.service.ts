import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { LlmProvider, LlmModel } from '../entities';

export interface CreateProviderInput {
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey: string;
}

const PROVIDER_PRESETS: Record<string, { baseUrl: string; models: string[] }> = {
  dashscope: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  'openai-compatible': {
    baseUrl: '',
    models: [],
  },
};

@Injectable()
export class LlmService {
  constructor(
    @InjectRepository(LlmProvider)
    private providerRepository: Repository<LlmProvider>,
    @InjectRepository(LlmModel)
    private modelRepository: Repository<LlmModel>,
  ) {}

  async listProviders() {
    return this.providerRepository.find({
      relations: ['models'],
      order: { updatedAt: 'DESC' },
    });
  }

  async listModels() {
    const models = await this.modelRepository.find({
      relations: ['providerRef'],
      where: { enabled: true },
      order: { label: 'ASC' },
    });

    if (models.length === 0) {
      return fallbackModels();
    }

    return models.map((model) => this.toPublicModel(model));
  }

  async createProvider(input: CreateProviderInput) {
    const preset = PROVIDER_PRESETS[input.provider] || PROVIDER_PRESETS['openai-compatible'];
    const provider = await this.providerRepository.save(this.providerRepository.create({
      name: input.name,
      provider: input.provider,
      baseUrl: input.baseUrl || preset.baseUrl,
      apiKey: input.apiKey,
      enabled: true,
    }));

    const scanned = await this.scanProvider(provider.id);
    return { ...provider, models: scanned.models };
  }

  async scanProvider(providerId: number): Promise<{ providerId: number; models: LlmModel[] }> {
    const provider = await this.providerRepository.findOne({ where: { id: providerId } });
    if (!provider) {
      throw new NotFoundException(`Provider #${providerId} not found`);
    }

    const modelIds = await this.fetchModelIds(provider);
    await this.modelRepository.delete({ providerId: provider.id });
    const models = await this.modelRepository.save(modelIds.map((modelId) => {
      const code = `${provider.provider}:${modelId}`;
      return this.modelRepository.create({
        providerId: provider.id,
        code,
        model: modelId,
        label: `${provider.name} / ${modelId}`,
        capability: inferCapability(modelId),
        enabled: true,
      });
    }));

    return { providerId, models };
  }

  async getModelClient(codeOrModel?: string): Promise<{ client: OpenAI; model: string }> {
    if (codeOrModel) {
      const model = await this.modelRepository.findOne({
        where: [{ code: codeOrModel }, { model: codeOrModel }],
        relations: ['providerRef'],
      });

      if (model?.providerRef?.enabled) {
        return {
          client: new OpenAI({
            apiKey: model.providerRef.apiKey,
            baseURL: model.providerRef.baseUrl,
            timeout: 30_000,
            maxRetries: 1,
          }),
          model: model.model,
        };
      }
    }

    return {
      client: new OpenAI({
        apiKey: process.env.QWEN_API_KEY || '',
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        timeout: 30_000,
        maxRetries: 1,
      }),
      model: codeOrModel || 'qwen-plus',
    };
  }

  private async fetchModelIds(provider: LlmProvider): Promise<string[]> {
    const preset = PROVIDER_PRESETS[provider.provider];

    try {
      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
        timeout: 20_000,
        maxRetries: 0,
      });
      const list = await client.models.list();
      const ids = list.data.map((model) => model.id).filter(Boolean);
      if (ids.length > 0) {
        return ids.slice(0, 80);
      }
    } catch {
      if (preset?.models.length) {
        return preset.models;
      }
      throw new BadRequestException('模型扫描失败，请检查 Base URL 和 API Key');
    }

    return preset?.models.length ? preset.models : [];
  }

  private toPublicModel(model: LlmModel) {
    return {
      id: model.id,
      code: model.code,
      model: model.model,
      label: model.label,
      provider: model.providerRef?.provider,
      providerName: model.providerRef?.name,
      capability: model.capability,
      enabled: model.enabled,
    };
  }
}

function inferCapability(modelId: string): string {
  const value = modelId.toLowerCase();
  if (value.includes('embedding')) return 'embedding';
  if (value.includes('vision') || value.includes('vl')) return 'vision';
  return 'chat';
}

function fallbackModels() {
  return [
    { code: 'qwen-turbo', model: 'qwen-turbo', label: '通义千问 Turbo', provider: 'dashscope', capability: 'chat', enabled: true },
    { code: 'qwen-plus', model: 'qwen-plus', label: '通义千问 Plus', provider: 'dashscope', capability: 'chat', enabled: true },
    { code: 'qwen-max', model: 'qwen-max', label: '通义千问 Max', provider: 'dashscope', capability: 'chat', enabled: true },
  ];
}
