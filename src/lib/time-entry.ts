export interface TimeEntry {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string | null;
  user: string;
}

export function formatDuration(ms: number): string {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
}
