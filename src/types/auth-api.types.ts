/**
 * HMS Egypt - Auth & API Type Definitions
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  hospitalId: string;
  departmentId?: string;
  isPasswordExpired?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

export interface ServerActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
