export interface Config {
  pb_url: string;
  auth_token: string;
  user_id: string;
}

export interface TimeEntryRecord {
  id: string;
  space: string;
  specialization?: string;
  start_date: string;
  completion_time?: string;
}

export interface StructuredEntry {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string;
  duration_hours: number;
}

export interface StructuredTimerResult {
  [key: string]: unknown;
  status: string;
  message: string;
  data?: {
    id?: string;
    space?: string;
    specialization?: string;
    start_date?: string;
    elapsed_seconds?: number;
  };
  entries?: StructuredEntry[];
  stats?: {
    total_hours: number;
    session_count: number;
    overall_count: number;
  };
}

export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
}
