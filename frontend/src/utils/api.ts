// src/utils/api.ts
import axios from 'axios';

export function request<T>(url: string, opts: { method?: 'get'|'post', data?: any } = {}) {
  return axios({ url, method: opts.method||'get', data: opts.data }).then(res => res.data as T);
}