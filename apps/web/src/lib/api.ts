const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type UserRole = 'MASTER' | 'ADMIN' | 'BIDDER';

export interface ApplicationOption {
  id: string;
  type: 'LOCATION' | 'SOURCE';
  value: string;
  normalizedValue: string;
  isDefault: boolean;
  sortOrder: number;
}

export interface User {
  id: string;
  email: string;
  username?: string | null;
  role: UserRole;
  firstName: string;
  lastName: string;
  canCreateApplications?: boolean;
  canGenerateResumes?: boolean;
  canDownloadDocuments?: boolean;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  getAccessToken() {
    return this.accessToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Free ngrok serves an HTML/text interstitial to browser-like clients unless skipped.
      'ngrok-skip-browser-warning': 'true',
      ...(options.headers as Record<string, string>),
    };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    const doFetch = (init?: RequestInit) =>
      fetch(`${API_URL}${path}`, {
        ...options,
        ...init,
        headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      });

    let res = await doFetch();

    if (res.status === 401 && this.refreshToken) {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (refreshRes.ok) {
        const tokens = await this.parseJson<{ accessToken: string; refreshToken: string }>(refreshRes);
        this.setTokens(tokens.accessToken, tokens.refreshToken);
        headers.Authorization = `Bearer ${tokens.accessToken}`;
        res = await doFetch();
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(Array.isArray(err.message) ? err.message[0] : err.message);
    }

    if (res.status === 204) return {} as T;
    return this.parseJson<T>(res);
  }

  private async parseJson<T>(res: Response): Promise<T> {
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Invalid API response (check ngrok / API proxy)');
    }
  }

  login(email: string, password: string) {
    return this.request<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  requestRegisterOtp(data: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
  }) {
    return this.request<{ requiresOtp: boolean; email: string; message: string }>(
      '/auth/register/request-otp',
      { method: 'POST', body: JSON.stringify(data) },
    );
  }

  verifyRegister(email: string, code: string) {
    return this.request<{ success: boolean; message: string; user: User }>('/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  forgotPassword(email: string) {
    return this.request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  resetPassword(token: string, password: string, confirmPassword: string) {
    return this.request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, confirmPassword }),
    });
  }

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  getMe() {
    return this.request<User>('/auth/me');
  }

  getDashboardMetrics(params?: {
    adminIds?: string[];
    bidderIds?: string[];
    statuses?: string[];
    startDate?: string;
    endDate?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.adminIds?.length) qs.set('adminIds', params.adminIds.join(','));
    if (params?.bidderIds?.length) qs.set('bidderIds', params.bidderIds.join(','));
    if (params?.statuses?.length) qs.set('statuses', params.statuses.join(','));
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{
      kpis: {
        total: number;
        applied: number;
        readyToApply: number;
        interviews: number;
        offers: number;
        warnings: number;
      };
      trend: Array<Record<string, string | number> & { date: string }>;
      recentGenerations: { id: string; jobTitle: string; company: string; creator: string; completedAt: string }[];
      byAdmin?: { adminId: string; name: string; total: number; interviews: number; offers: number; bidderCount: number }[];
      byBidder?: { bidderId: string; name: string; adminName: string; total: number; interviews: number; offers: number }[];
      filterOptions?: {
        admins: { id: string; name: string }[];
        bidders: { id: string; name: string; adminId: string | null }[];
      };
    }>(`/dashboard/metrics${query}`);
  }

  getApplications(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<unknown[]>(`/applications${qs}`);
  }

  getApplication(id: string) {
    return this.request<Record<string, unknown>>(`/applications/${id}`);
  }

  createApplication(data: Record<string, unknown>) {
    return this.request('/applications', { method: 'POST', body: JSON.stringify(data) });
  }

  getApplicationOptions() {
    return this.request<{
      locations: ApplicationOption[];
      sources: ApplicationOption[];
    }>('/application-options');
  }

  createApplicationOption(data: { type: 'LOCATION' | 'SOURCE'; value: string; isDefault?: boolean }) {
    return this.request<ApplicationOption>('/application-options', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateApplicationOption(id: string, data: { value?: string; isDefault?: boolean }) {
    return this.request<ApplicationOption>(`/application-options/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  deleteApplicationOption(id: string) {
    return this.request<{ ok: boolean }>(`/application-options/${id}`, { method: 'DELETE' });
  }

  updateApplication(
    id: string,
    data: {
      profileId?: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      workArrangement?: string;
      source?: string;
      jobUrl?: string;
      jobDescription?: string;
    },
  ) {
    return this.request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  deleteApplication(id: string) {
    return this.request(`/applications/${id}`, { method: 'DELETE' });
  }

  updateApplicationStatus(id: string, status: string, note?: string) {
    return this.request(`/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) });
  }

  addApplicationNote(id: string, content: string) {
    return this.request(`/applications/${id}/notes`, { method: 'POST', body: JSON.stringify({ content }) });
  }

  getProfiles() {
    return this.request<unknown[]>('/profiles');
  }

  getProfile(id: string) {
    return this.request<Record<string, unknown>>(`/profiles/${id}`);
  }

  createProfile(data: Record<string, unknown>) {
    return this.request('/profiles', { method: 'POST', body: JSON.stringify(data) });
  }

  updateProfile(id: string, data: Record<string, unknown>) {
    return this.request(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  archiveProfile(id: string) {
    return this.request(`/profiles/${id}/archive`, { method: 'PATCH' });
  }

  getAssignedProfiles() {
    return this.request<unknown[]>('/profiles/assigned');
  }

  getDefaultProfile() {
    return this.request<unknown>('/profiles/default');
  }

  setDefaultProfile(id: string) {
    return this.request<{ success: boolean; profileId: string; isDefault: boolean }>(
      `/profiles/${id}/set-default`,
      { method: 'PATCH' },
    );
  }

  getUsers() {
    return this.request<unknown[]>('/users');
  }

  createUser(data: {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role?: string;
    managedByAdminId?: string;
  }) {
    return this.request('/users', { method: 'POST', body: JSON.stringify(data) });
  }

  getAdmins() {
    return this.request<{ id: string; firstName: string; lastName: string; email: string; status: string }[]>(
      '/users/admins',
    );
  }

  updateUser(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      resetPassword?: boolean;
    },
  ) {
    return this.request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  deleteUser(id: string) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  updateUserManagedBy(id: string, managedByAdminId: string | null) {
    return this.request(`/users/${id}/managed-by`, {
      method: 'PATCH',
      body: JSON.stringify({ managedByAdminId }),
    });
  }

  updateUserAssignments(id: string, assignments: { profileId: string; isDefault?: boolean }[]) {
    return this.request(`/users/${id}/assignments`, { method: 'PATCH', body: JSON.stringify({ assignments }) });
  }

  updateUserTemplateAssignments(
    id: string,
    assignments: { templateVersionId: string; isDefault?: boolean }[],
  ) {
    return this.request(`/users/${id}/template-assignments`, {
      method: 'PATCH',
      body: JSON.stringify({ assignments }),
    });
  }

  updateUserStatus(id: string, status: string) {
    return this.request(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  updateUserPermissions(
    id: string,
    perms: {
      canCreateApplications?: boolean;
      canGenerateResumes?: boolean;
      canDownloadDocuments?: boolean;
    },
  ) {
    return this.request(`/users/${id}/permissions`, { method: 'PATCH', body: JSON.stringify(perms) });
  }

  updateUserPromptAssignment(
    id: string,
    data: { useMasterPrompt: boolean; content?: string },
  ) {
    return this.request(`/users/${id}/prompt-assignment`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getTemplates() {
    return this.request<unknown[]>('/templates');
  }

  getTemplate(id: string) {
    return this.request<Record<string, unknown>>(`/templates/${id}`);
  }

  createTemplate(data: { name: string; preset?: string; configJson?: object }) {
    return this.request<Record<string, unknown>>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateTemplate(id: string, data: Record<string, unknown>) {
    return this.request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  cloneTemplate(id: string) {
    return this.request<Record<string, unknown>>(`/templates/${id}/clone`, { method: 'POST' });
  }

  publishTemplate(id: string) {
    return this.request<Record<string, unknown>>(`/templates/${id}/publish`, { method: 'PATCH' });
  }

  setDefaultTemplate(id: string) {
    return this.request<{ success: boolean; templateId: string; isDefault: boolean }>(
      `/templates/${id}/set-default`,
      { method: 'PATCH' },
    );
  }

  archiveTemplate(id: string) {
    return this.request<Record<string, unknown>>(`/templates/${id}/archive`, { method: 'PATCH' });
  }

  getTemplatePreview(id: string) {
    return this.request<{ html: string }>(`/templates/${id}/preview`);
  }

  previewTemplateDraft(id: string, configJson: object) {
    return this.request<{ html: string }>(`/templates/${id}/preview`, {
      method: 'POST',
      body: JSON.stringify({ configJson }),
    });
  }

  previewTemplateConfig(configJson: object) {
    return this.request<{ html: string }>('/templates/preview', {
      method: 'POST',
      body: JSON.stringify({ configJson }),
    });
  }

  startGeneration(applicationId: string, templateId?: string) {
    return this.request(`/applications/${applicationId}/generations`, {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    });
  }

  getGenerations(applicationId: string) {
    return this.request<unknown[]>(`/applications/${applicationId}/generations`);
  }

  getGeneration(id: string) {
    return this.request<Record<string, unknown>>(`/generations/${id}`);
  }

  getDocumentUrl(fileId: string) {
    return `${API_URL}/documents/${fileId}/download`;
  }

  getWarningRules() {
    return this.request<unknown[]>('/settings/warning-rules');
  }

  createWarningRule(data: {
    category: string;
    pattern: string;
    severity: string;
    behavior: string;
  }) {
    return this.request('/settings/warning-rules', { method: 'POST', body: JSON.stringify(data) });
  }

  updateWarningRule(id: string, data: Record<string, unknown>) {
    return this.request(`/settings/warning-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getPrompts() {
    return this.request<unknown[]>('/settings/prompts');
  }

  createPrompt(content: string) {
    return this.request('/settings/prompts', { method: 'POST', body: JSON.stringify({ content }) });
  }

  updatePrompt(id: string, content: string) {
    return this.request(`/settings/prompts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  }

  deletePrompt(id: string) {
    return this.request<{ success: boolean; id: string }>(`/settings/prompts/${id}`, {
      method: 'DELETE',
    });
  }

  publishPrompt(id: string) {
    return this.request(`/settings/prompts/${id}/publish`, { method: 'POST' });
  }

  getMyPrompt() {
    return this.request<{
      role: 'MASTER' | 'ADMIN' | 'BIDDER';
      useMasterPrompt: boolean | null;
      promptSource?: 'initial' | 'custom' | null;
      masterPrompt: { id: string; content: string; version: number; isPublished: boolean } | null;
      myPrompt: { id: string; content: string; version: number; isPublished: boolean } | null;
      effectivePrompt: { id: string; content: string; version: number; isPublished: boolean } | null;
    }>('/settings/my-prompt');
  }

  updateMyPrompt(data: { useMasterPrompt?: boolean; content?: string }) {
    return this.request<{
      role: 'MASTER' | 'ADMIN' | 'BIDDER';
      useMasterPrompt: boolean | null;
      promptSource?: 'initial' | 'custom' | null;
      masterPrompt: { id: string; content: string; version: number; isPublished: boolean } | null;
      myPrompt: { id: string; content: string; version: number; isPublished: boolean } | null;
      effectivePrompt: { id: string; content: string; version: number; isPublished: boolean } | null;
    }>('/settings/my-prompt', { method: 'PATCH', body: JSON.stringify(data) });
  }

  getAiSettings() {
    return this.request<{ hasApiKey: boolean; model: string }>('/settings/ai');
  }

  updateAiSettings(data: { apiKey?: string; model?: string }) {
    return this.request<{ hasApiKey: boolean; model: string }>('/settings/ai', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  changePassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    return this.request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getAuditLog() {
    return this.request<unknown[]>('/audit');
  }

  getJobPool() {
    return this.request<{ enabled: boolean; message: string; jobs: unknown[]; total: number }>('/job-pool');
  }
}

export const api = new ApiClient();
