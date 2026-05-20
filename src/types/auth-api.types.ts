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
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    [key: string]: any;
  };
}

export interface ServerActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
