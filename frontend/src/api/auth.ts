// src/api/auth.ts
import axios from 'axios';
import { UserCredentials, AuthResponse } from '../types/auth';

const API_BASE = process.env.REACT_APP_AUTH_SERVICE_URL || 'http://localhost:5100';

export const signup = async (data: UserCredentials): Promise<AuthResponse> => {
  const resp = await axios.post<AuthResponse>(`${API_BASE}/api/auth/signup`, data, {
    headers: { 'Content-Type': 'application/json' }
  });
  return resp.data;
};

export const login = async (data: UserCredentials): Promise<AuthResponse> => {
  const resp = await axios.post<AuthResponse>(`${API_BASE}/api/auth/login`, data, {
    headers: { 'Content-Type': 'application/json' }
  });
  return resp.data;
};