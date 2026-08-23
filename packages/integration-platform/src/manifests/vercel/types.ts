/**
 * Vercel API Response Types
 */

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  createdAt: number;
  updatedAt: number;
  framework?: string;
  devCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
  rootDirectory?: string;
  nodeVersion?: string;
  serverlessFunctionRegion?: string;
}

export interface VercelProjectsResponse {
  projects: VercelProject[];
  pagination?: {
    count: number;
    next: number | null;
    prev: number | null;
  };
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  type: 'LAMBDAS';
  created: number;
  createdAt: number;
  buildingAt?: number;
  ready?: number;
  creator: {
    uid: string;
    email?: string;
    username?: string;
  };
  meta?: Record<string, string>;
  target?: 'production' | 'staging' | null;
  aliasError?: {
    code: string;
    message: string;
  };
  aliasAssigned?: number;
}

export interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
  pagination?: {
    count: number;
    next: number | null;
    prev: number | null;
  };
}

interface VercelWebhook {
  id: string;
  url: string;
  events: string[];
  projectIds?: string[];
  createdAt: number;
}

interface VercelUser {
  id: string;
  email: string;
  name?: string;
  username: string;
  avatar?: string;
}
