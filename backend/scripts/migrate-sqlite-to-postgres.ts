import 'reflect-metadata';
import Database from 'better-sqlite3';
import { Client } from 'pg';
import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';
import { DataSource } from 'typeorm';
import {
  User,
  Skill,
  SkillVersion,
  SkillExecution,
  JobModel,
  JobModelSkill,
  SkillReview,
  SkillUsageStat,
  UserSkillClaim,
  Agent,
  LlmProvider,
  LlmModel,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeChunk,
  Memory,
  SkillRuntimeArtifact,
  SkillRuntimeEvent,
  SkillRuntimeStep,
  ThreadEntity,
  MessageEntity,
  RunEntity,
} from '../src/entities';

type SqliteColumn = {
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: unknown;
  pk: 0 | 1;
};

type PgColumn = {
  column_name: string;
  data_type: string;
  udt_name: string;
};

const entities = [
  User,
  Skill,
  SkillVersion,
  JobModel,
  JobModelSkill,
  SkillReview,
  SkillUsageStat,
  UserSkillClaim,
  Agent,
  LlmProvider,
  LlmModel,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeChunk,
  Memory,
  SkillExecution,
  SkillRuntimeArtifact,
  SkillRuntimeEvent,
  SkillRuntimeStep,
  ThreadEntity,
  MessageEntity,
  RunEntity,
];

const preferredTableOrder = [
  'users',
  'agents',
  'job_models',
  'skills',
  'skill_versions',
  'job_model_skills',
  'skill_reviews',
  'skill_usage_stats',
  'user_skill_claims',
  'knowledge_bases',
  'knowledge_documents',
  'knowledge_chunks',
  'llm_providers',
  'llm_models',
  'memories',
  'skill_executions',
  'skill_runtime_artifacts',
  'skill_runtime_events',
  'skill_runtime_steps',
  'threads',
  'messages',
  'runs',
];

function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function resolveSqlitePath(): string {
  const configured = process.env.SQLITE_DATABASE_PATH || process.env.DATABASE_PATH || 'database.sqlite';
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

function getPostgresUrl(): string {
  const url = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('缺少 POSTGRES_DATABASE_URL 或 DATABASE_URL，无法连接 PostgreSQL。');
  }
  if (url.startsWith('sqlite')) {
    throw new Error('当前 DATABASE_URL 是 SQLite，不是 PostgreSQL。请改用 POSTGRES_DATABASE_URL=postgresql://...');
  }
  return url;
}

function pgSslConfig(databaseUrl: string) {
  const sslEnabled = parseBooleanEnv(process.env.DATABASE_SSL, databaseUrl.includes('sslmode=require'));
  return sslEnabled ? { rejectUnauthorized: false } : false;
}

function sqliteTypeToPostgres(type: string, isPrimaryKey: boolean): string {
  const normalized = type.trim().toUpperCase();
  if (isPrimaryKey && normalized.includes('INT')) return 'integer PRIMARY KEY';
  if (normalized.startsWith('VARCHAR')) return normalized.toLowerCase();
  if (normalized.includes('CHAR')) return 'varchar';
  if (normalized.includes('TEXT') || normalized === '') return 'text';
  if (normalized.includes('BOOL')) return 'boolean';
  if (normalized.includes('INT')) return 'integer';
  if (normalized.includes('FLOAT') || normalized.includes('DOUBLE') || normalized.includes('REAL')) return 'double precision';
  if (normalized.includes('DATE') || normalized.includes('TIME')) return 'timestamp';
  return 'text';
}

function normalizeValue(value: unknown, column?: PgColumn): unknown {
  if (value === undefined) return null;
  if (!column) return value;

  if (column.data_type === 'boolean') {
    if (value === null) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  if (column.data_type.includes('timestamp') && value === '') {
    return null;
  }

  return value;
}

async function ensureTypeOrmSchema(databaseUrl: string) {
  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: pgSslConfig(databaseUrl),
    synchronize: true,
    logging: false,
    entities,
  });
  await dataSource.initialize();
  await dataSource.destroy();
}

function sqliteTables(sqlite: Database.Database): string[] {
  return sqlite
    .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")
    .all()
    .map((row: any) => row.name as string);
}

function sqliteColumns(sqlite: Database.Database, table: string): SqliteColumn[] {
  return sqlite.prepare(`pragma table_info(${quoteIdent(table)})`).all() as SqliteColumn[];
}

async function pgTableExists(client: Client, table: string): Promise<boolean> {
  const result = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1 limit 1`,
    [table],
  );
  return result.rowCount > 0;
}

async function pgColumns(client: Client, table: string): Promise<PgColumn[]> {
  const result = await client.query(
    `select column_name, data_type, udt_name
       from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position`,
    [table],
  );
  return result.rows;
}

async function pgPrimaryColumns(client: Client, table: string): Promise<string[]> {
  const result = await client.query(
    `select a.attname as column_name
       from pg_index i
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = $1::regclass and i.indisprimary
      order by array_position(i.indkey, a.attnum)`,
    [`public.${table}`],
  );
  return result.rows.map((row) => row.column_name as string);
}

async function ensureLegacyTable(client: Client, sqlite: Database.Database, table: string) {
  if (await pgTableExists(client, table)) return;

  const columns = sqliteColumns(sqlite, table);
  if (columns.length === 0) return;

  const ddlColumns = columns.map((column) => {
    const mappedType = sqliteTypeToPostgres(column.type, column.pk === 1);
    return `${quoteIdent(column.name)} ${mappedType}`;
  });

  await client.query(`create table if not exists ${quoteIdent(table)} (${ddlColumns.join(', ')})`);
}

async function tableCount(client: Client, table: string): Promise<number> {
  const result = await client.query(`select count(*)::int as count from ${quoteIdent(table)}`);
  return result.rows[0]?.count ?? 0;
}

async function assertSafeTarget(client: Client, sourceTables: string[]) {
  if (parseBooleanEnv(process.env.ALLOW_NON_EMPTY_POSTGRES)) return;

  const nonEmpty: string[] = [];
  for (const table of sourceTables) {
    if (!(await pgTableExists(client, table))) continue;
    const count = await tableCount(client, table);
    if (count > 0) nonEmpty.push(`${table}(${count})`);
  }

  if (nonEmpty.length > 0) {
    throw new Error(
      `目标 PostgreSQL 已有数据：${nonEmpty.join(', ')}。为避免覆盖线上内容，迁移已停止。` +
        `确认已备份且要合并时，再设置 ALLOW_NON_EMPTY_POSTGRES=true。`,
    );
  }
}

async function copyTable(client: Client, sqlite: Database.Database, table: string): Promise<number> {
  const sourceColumns = sqliteColumns(sqlite, table).map((column) => column.name);
  const targetColumns = await pgColumns(client, table);
  const targetColumnMap = new Map(targetColumns.map((column) => [column.column_name, column]));
  const columns = sourceColumns.filter((column) => targetColumnMap.has(column));
  if (columns.length === 0) return 0;

  const primaryColumns = await pgPrimaryColumns(client, table);
  const conflictColumns = primaryColumns.filter((column) => columns.includes(column));
  const rows = sqlite.prepare(`select ${sourceColumns.map(quoteIdent).join(', ')} from ${quoteIdent(table)}`).all();

  if (rows.length === 0) return 0;

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const insertColumns = columns.map(quoteIdent).join(', ');
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const conflictClause =
    conflictColumns.length > 0
      ? ` on conflict (${conflictColumns.map(quoteIdent).join(', ')}) ${
          updateColumns.length > 0
            ? `do update set ${updateColumns
                .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
                .join(', ')}`
            : 'do nothing'
        }`
      : '';

  const sql = `insert into ${quoteIdent(table)} (${insertColumns}) values (${placeholders})${conflictClause}`;

  await client.query('begin');
  try {
    for (const row of rows as Record<string, unknown>[]) {
      const values = columns.map((column) => normalizeValue(row[column], targetColumnMap.get(column)));
      await client.query(sql, values);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }

  return rows.length;
}

async function resetSequence(client: Client, table: string) {
  const columns = await pgColumns(client, table);
  if (!columns.some((column) => column.column_name === 'id')) return;

  const sequenceResult = await client.query(`select pg_get_serial_sequence($1, $2) as sequence_name`, [
    `public.${table}`,
    'id',
  ]);
  const sequenceName = sequenceResult.rows[0]?.sequence_name;
  if (!sequenceName) return;

  await client.query(
    `select setval($1, coalesce((select max(${quoteIdent('id')}) from ${quoteIdent(table)}), 1), true)`,
    [sequenceName],
  );
}

async function main() {
  const sqlitePath = resolveSqlitePath();
  if (!existsSync(sqlitePath)) {
    throw new Error(`未找到 SQLite 数据库：${sqlitePath}`);
  }

  const postgresUrl = getPostgresUrl();
  console.log(`源 SQLite: ${sqlitePath}`);
  console.log('目标 PostgreSQL: 已读取连接串');

  await ensureTypeOrmSchema(postgresUrl);

  const sqlite = new Database(sqlitePath, { readonly: true });
  const client = new Client({
    connectionString: postgresUrl,
    ssl: pgSslConfig(postgresUrl),
  });

  await client.connect();
  try {
    const sourceTables = sqliteTables(sqlite);
    const orderedTables = [
      ...preferredTableOrder.filter((table) => sourceTables.includes(table)),
      ...sourceTables.filter((table) => !preferredTableOrder.includes(table)),
    ];

    for (const table of orderedTables) {
      await ensureLegacyTable(client, sqlite, table);
    }

    await assertSafeTarget(client, orderedTables);

    for (const table of orderedTables) {
      const copied = await copyTable(client, sqlite, table);
      if (copied > 0) {
        await resetSequence(client, table);
      }
      console.log(`${table}: ${copied} 行`);
    }
  } finally {
    sqlite.close();
    await client.end();
  }

  console.log('SQLite 到 PostgreSQL 迁移完成。');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
