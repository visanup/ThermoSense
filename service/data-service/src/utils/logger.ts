// src/utils/logger.ts
export function logRequest(method: string, url: string) {
  console.log(`[${new Date().toISOString()}] ${method} ${url}`);
}