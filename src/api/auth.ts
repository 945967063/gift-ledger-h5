import http from './http';

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  phone?: string;
  password: string;
}

export interface UserInfo {
  id: string;
  name: string;
  phone?: string;
}

export const authApi = {
  register: (data: RegisterPayload) =>
    http.post<{ data: { token: string; user: UserInfo } }>('/auth/register', data),

  login: (data: LoginPayload) =>
    http.post<{ data: { token: string; user: UserInfo } }>('/auth/login', data),

  getProfile: () => http.get<{ data: UserInfo }>('/auth/profile'),

  updateProfile: (name: string) => http.put('/auth/profile', { name }),
};
