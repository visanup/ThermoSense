// src/types/auth.ts
export interface UserCredentials {
  username: string;
  email?: string; // optional for login
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}