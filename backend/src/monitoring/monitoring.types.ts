export type OperationalEventLevel = 'info' | 'warn' | 'error';

export interface RecordOperationalEventInput {
  level?: OperationalEventLevel;
  category: string;
  message: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userId?: number;
  details?: Record<string, unknown>;
}
