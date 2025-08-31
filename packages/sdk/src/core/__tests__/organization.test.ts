/**
 * 🧪 Organization Client Tests
 * 
 * Comprehensive test suite for organization management functionality
 */

import { OrganizationClient } from '../organization';
import { AxonPulsError, ValidationError, AuthenticationError } from '../errors';

// Mock API client
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

const mockConfig = {
  baseURL: 'https://api.axonstream.ai',
  timeout: 5000,
};

describe('OrganizationClient', () => {
  let organizationClient: OrganizationClient;

  beforeEach(() => {
    organizationClient = new OrganizationClient(mockApiClient as any, mockConfig);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create organization successfully', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        settings: {
          timezone: 'UTC',
          locale: 'en',
          security: {
            enforceSSO: false,
            requireMFA: false,
            sessionTimeout: 3600,
          },
          notifications: {
            email: true,
            slack: false,
          },
        },
        features: ['collaboration', 'analytics'],
        limits: {
          maxUsers: 100,
          maxConnections: 1000,
          maxEvents: 10000,
          maxChannels: 50,
          maxStorage: 1000000,
          maxApiCalls: 100000,
        },
      };

      mockApiClient.post.mockResolvedValue({ data: mockOrganization });

      const result = await organizationClient.create({
        name: 'Test Organization',
        slug: 'test-org',
        features: ['collaboration', 'analytics'],
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/organizations', {
        name: 'Test Organization',
        slug: 'test-org',
        features: ['collaboration', 'analytics'],
      });
      expect(result).toEqual(mockOrganization);
    });

    it('should handle creation errors', async () => {
      mockApiClient.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Organization name already exists' },
        },
      });

      await expect(organizationClient.create({
        name: 'Duplicate Org',
      })).rejects.toThrow(AxonPulsError);
    });
  });

  describe('list', () => {
    it('should list organizations successfully', async () => {
      const mockOrganizations = [
        { id: 'org-1', name: 'Org 1', slug: 'org-1' },
        { id: 'org-2', name: 'Org 2', slug: 'org-2' },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockOrganizations });

      const result = await organizationClient.list();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/organizations');
      expect(result).toEqual(mockOrganizations);
    });
  });

  describe('get', () => {
    it('should get organization by ID', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
      };

      mockApiClient.get.mockResolvedValue({ data: mockOrganization });

      const result = await organizationClient.get('org-123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/organizations/org-123');
      expect(result).toEqual(mockOrganization);
    });

    it('should get organization by slug', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
      };

      mockApiClient.get.mockResolvedValue({ data: mockOrganization });

      const result = await organizationClient.get('test-org');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/organizations/test-org');
      expect(result).toEqual(mockOrganization);
    });

    it('should handle not found errors', async () => {
      mockApiClient.get.mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'Organization not found' },
        },
      });

      await expect(organizationClient.get('nonexistent')).rejects.toThrow(AxonPulsError);
    });
  });

  describe('update', () => {
    it('should update organization successfully', async () => {
      const mockUpdatedOrganization = {
        id: 'org-123',
        name: 'Updated Organization',
        description: 'Updated description',
      };

      mockApiClient.put.mockResolvedValue({ data: mockUpdatedOrganization });

      const result = await organizationClient.update('org-123', {
        name: 'Updated Organization',
        description: 'Updated description',
      });

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/v1/organizations/org-123', {
        name: 'Updated Organization',
        description: 'Updated description',
      });
      expect(result).toEqual(mockUpdatedOrganization);
    });
  });

  describe('delete', () => {
    it('should delete organization successfully', async () => {
      mockApiClient.delete.mockResolvedValue({ data: {} });

      await organizationClient.delete('org-123');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/v1/organizations/org-123');
    });
  });

  describe('getMembers', () => {
    it('should get organization members successfully', async () => {
      const mockMembers = [
        {
          id: 'member-1',
          userId: 'user-1',
          organizationId: 'org-123',
          role: 'admin',
          permissions: ['read', 'write', 'admin'],
          status: 'active',
          joinedAt: '2024-01-01T00:00:00Z',
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            name: 'Admin User',
          },
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockMembers });

      const result = await organizationClient.getMembers('org-123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/members');
      expect(result).toEqual(mockMembers);
    });
  });

  describe('inviteMember', () => {
    it('should invite member successfully', async () => {
      const mockMember = {
        id: 'member-2',
        userId: 'user-2',
        organizationId: 'org-123',
        role: 'member',
        status: 'invited',
        user: {
          id: 'user-2',
          email: 'member@example.com',
          name: 'New Member',
        },
      };

      mockApiClient.post.mockResolvedValue({ data: mockMember });

      const result = await organizationClient.inviteMember('org-123', {
        email: 'member@example.com',
        role: 'member',
        message: 'Welcome to our organization!',
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/organizations/org-123/members', {
        email: 'member@example.com',
        role: 'member',
        message: 'Welcome to our organization!',
      });
      expect(result).toEqual(mockMember);
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      mockApiClient.delete.mockResolvedValue({ data: {} });

      await organizationClient.removeMember('org-123', 'user-2');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/v1/organizations/org-123/members/user-2');
    });
  });

  describe('updateMember', () => {
    it('should update member successfully', async () => {
      const mockUpdatedMember = {
        id: 'member-2',
        userId: 'user-2',
        organizationId: 'org-123',
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
      };

      mockApiClient.put.mockResolvedValue({ data: mockUpdatedMember });

      const result = await organizationClient.updateMember('org-123', 'user-2', {
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
      });

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/v1/organizations/org-123/members/user-2', {
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
      });
      expect(result).toEqual(mockUpdatedMember);
    });
  });

  describe('getUsage', () => {
    it('should get organization usage successfully', async () => {
      const mockUsage = {
        organizationId: 'org-123',
        period: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
        usage: {
          users: 25,
          connections: 150,
          events: 5000,
          channels: 10,
          storage: 500000,
          apiCalls: 25000,
        },
        limits: {
          maxUsers: 100,
          maxConnections: 1000,
          maxEvents: 10000,
          maxChannels: 50,
          maxStorage: 1000000,
          maxApiCalls: 100000,
        },
        percentages: {
          users: 25,
          connections: 15,
          events: 50,
          channels: 20,
          storage: 50,
          apiCalls: 25,
        },
      };

      mockApiClient.get.mockResolvedValue({ data: mockUsage });

      const result = await organizationClient.getUsage('org-123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/usage', { params: {} });
      expect(result).toEqual(mockUsage);
    });

    it('should get usage with custom period', async () => {
      const mockUsage = { organizationId: 'org-123' };
      mockApiClient.get.mockResolvedValue({ data: mockUsage });

      await organizationClient.getUsage('org-123', {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-31T23:59:59Z',
      });

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/usage', {
        params: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      });
    });
  });

  describe('getSettings', () => {
    it('should get organization settings successfully', async () => {
      const mockSettings = {
        timezone: 'UTC',
        locale: 'en',
        security: {
          enforceSSO: false,
          requireMFA: false,
          sessionTimeout: 3600,
        },
        notifications: {
          email: true,
          slack: false,
        },
      };

      mockApiClient.get.mockResolvedValue({ data: mockSettings });

      const result = await organizationClient.getSettings('org-123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/settings');
      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateSettings', () => {
    it('should update organization settings successfully', async () => {
      const mockUpdatedSettings = {
        timezone: 'America/New_York',
        locale: 'en',
        security: {
          enforceSSO: true,
          requireMFA: true,
          sessionTimeout: 1800,
        },
      };

      mockApiClient.put.mockResolvedValue({ data: mockUpdatedSettings });

      const result = await organizationClient.updateSettings('org-123', {
        timezone: 'America/New_York',
        security: {
          enforceSSO: true,
          requireMFA: true,
          sessionTimeout: 1800,
        },
      });

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/v1/organizations/org-123/settings', {
        timezone: 'America/New_York',
        security: {
          enforceSSO: true,
          requireMFA: true,
          sessionTimeout: 1800,
        },
      });
      expect(result).toEqual(mockUpdatedSettings);
    });
  });
});
