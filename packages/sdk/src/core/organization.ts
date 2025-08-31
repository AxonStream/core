/**
 * 🏢 Organization Management Client
 * 
 * Provides comprehensive organization management functionality
 * for multi-tenant applications with proper RBAC enforcement.
 */

import { BaseClient } from './base-client';
import { AxonPulsError } from './errors';
import type { AxonPulsEvent } from '../types/schemas';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: OrganizationSettings;
  features: string[];
  limits: OrganizationLimits;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'suspended' | 'pending';
  subscription?: {
    plan: string;
    status: string;
    expiresAt?: string;
  };
}

export interface OrganizationSettings {
  timezone: string;
  locale: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  security: {
    enforceSSO: boolean;
    requireMFA: boolean;
    sessionTimeout: number;
    allowedDomains?: string[];
  };
  notifications: {
    email: boolean;
    slack: boolean;
    webhook?: string;
  };
}

export interface OrganizationLimits {
  maxUsers: number;
  maxConnections: number;
  maxEvents: number;
  maxChannels: number;
  maxStorage: number;
  maxApiCalls: number;
}

export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
  description?: string;
  settings?: Partial<OrganizationSettings>;
  features?: string[];
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  settings?: Partial<OrganizationSettings>;
  features?: string[];
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  joinedAt: string;
  lastActiveAt?: string;
  status: 'active' | 'invited' | 'suspended';
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
}

export interface InviteMemberRequest {
  email: string;
  role: string;
  permissions?: string[];
  message?: string;
}

export interface OrganizationUsage {
  organizationId: string;
  period: {
    start: string;
    end: string;
  };
  usage: {
    users: number;
    connections: number;
    events: number;
    channels: number;
    storage: number;
    apiCalls: number;
  };
  limits: OrganizationLimits;
  percentages: {
    users: number;
    connections: number;
    events: number;
    channels: number;
    storage: number;
    apiCalls: number;
  };
}

export class OrganizationClient extends BaseClient {
  /**
   * Create a new organization
   */
  async create(data: CreateOrganizationRequest): Promise<Organization> {
    try {
      const response = await this.apiClient.post('/api/v1/organizations', data);
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to create organization',
        'ORG_CREATE_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * List all organizations for the current user
   */
  async list(): Promise<Organization[]> {
    try {
      const response = await this.apiClient.get('/api/v1/organizations');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to list organizations',
        'ORG_LIST_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get organization by ID or slug
   */
  async get(idOrSlug: string): Promise<Organization> {
    try {
      const response = await this.apiClient.get(`/api/v1/organizations/${idOrSlug}`);
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get organization',
        'ORG_GET_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Update organization
   */
  async update(idOrSlug: string, data: UpdateOrganizationRequest): Promise<Organization> {
    try {
      const response = await this.apiClient.put(`/api/v1/organizations/${idOrSlug}`, data);
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to update organization',
        'ORG_UPDATE_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Delete organization
   */
  async delete(idOrSlug: string): Promise<void> {
    try {
      await this.apiClient.delete(`/api/v1/organizations/${idOrSlug}`);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to delete organization',
        'ORG_DELETE_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get organization members
   */
  async getMembers(idOrSlug: string): Promise<OrganizationMember[]> {
    try {
      const response = await this.apiClient.get(`/api/v1/organizations/${idOrSlug}/members`);
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get organization members',
        'ORG_MEMBERS_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Invite member to organization
   */
  async inviteMember(idOrSlug: string, data: InviteMemberRequest): Promise<OrganizationMember> {
    try {
      const response = await this.apiClient.post(`/api/v1/organizations/${idOrSlug}/members`, data);
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to invite member',
        'ORG_INVITE_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Remove member from organization
   */
  async removeMember(idOrSlug: string, userId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/api/v1/organizations/${idOrSlug}/members/${userId}`);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to remove member',
        'ORG_REMOVE_MEMBER_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Update member role and permissions
   */
  async updateMember(
    idOrSlug: string,
    userId: string,
    data: { role?: string; permissions?: string[] }
  ): Promise<OrganizationMember> {
    try {
      const response = await this.apiClient.put(
        `/api/v1/organizations/${idOrSlug}/members/${userId}`,
        data
      );
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to update member',
        'ORG_UPDATE_MEMBER_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get organization usage statistics
   */
  async getUsage(idOrSlug: string, period?: { start: string; end: string }): Promise<OrganizationUsage> {
    try {
      const params = period ? { start: period.start, end: period.end } : {};
      const response = await this.apiClient.get(`/api/v1/organizations/${idOrSlug}/usage`, { params });
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get organization usage',
        'ORG_USAGE_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get organization settings
   */
  async getSettings(idOrSlug: string): Promise<OrganizationSettings> {
    try {
      const response = await this.apiClient.get(`/api/v1/organizations/${idOrSlug}/settings`);
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get organization settings',
        'ORG_SETTINGS_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Update organization settings
   */
  async updateSettings(idOrSlug: string, settings: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
    try {
      const response = await this.apiClient.put(`/api/v1/organizations/${idOrSlug}/settings`, settings);
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to update organization settings',
        'ORG_UPDATE_SETTINGS_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }
}
