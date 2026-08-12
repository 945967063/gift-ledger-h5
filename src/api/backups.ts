import http from './http';

export interface BackupSummary {
  contacts: number;
  events: number;
  records: number;
  operationLogs: number;
}

export interface BackupPreview {
  checksum: string;
  exportedAt: string;
  appVersion: string;
  accountName: string;
  summary: BackupSummary;
}

export const backupsApi = {
  export: () => http.get<Blob>('/backups/export', { responseType: 'blob' }),

  validateImport: (backup: unknown) =>
    http.post<{ data: BackupPreview }>('/backups/import/validate', backup),

  import: (data: { backup: unknown; checksum: string; password: string }) =>
    http.post<{ data: { summary: BackupSummary } }>('/backups/import', data),
};
