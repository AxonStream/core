import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantAwareService, TenantContext } from './tenant-aware.service';

/**
 * Tenant-aware database service with automatic isolation
 */
@Injectable()
export class TenantDatabaseService {
  private readonly logger = new Logger(TenantDatabaseService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  /**
   * Create a record with automatic tenant isolation
   */
  async create<T>(
    context: TenantContext,
    model: string,
    data: any,
    options?: {
      audit?: boolean;
      encrypt?: string[];
      validate?: boolean;
    }
  ): Promise<T> {
    await this.validateTenantAccess(context, 'create', model);

    try {
      // Inject organizationId
      const tenantData = {
        ...data,
        organizationId: context.organizationId,
      };

      // Encrypt sensitive fields if specified
      if (options?.encrypt && options.encrypt.length > 0) {
        for (const field of options.encrypt) {
          if (tenantData[field]) {
            tenantData[field] = await this.tenantAwareService.encryptData(
              context.organizationId,
              tenantData[field]
            );
          }
        }
      }

      // Check resource limits
      if (options?.validate !== false) {
        await this.tenantAwareService.checkResourceLimits(context, model);
      }

      // Create the record
      const result = await this.prismaService[model].create({
        data: tenantData,
      });

      // Update usage tracking
      await this.tenantAwareService.incrementUsage(context.organizationId, model);

      // Audit logging
      if (options?.audit !== false) {
        await this.tenantAwareService.logAuditEvent(
          context,
          'CREATE',
          model,
          result.id,
          null,
          result
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to create ${model}: ${error.message}`);
      
      // Log audit failure
      await this.tenantAwareService.logAuditFailure(
        context,
        'CREATE',
        model,
        error.message
      );
      
      throw error;
    }
  }

  /**
   * Find records with automatic tenant filtering
   */
  async findMany<T>(
    context: TenantContext,
    model: string,
    query: any = {},
    options?: {
      decrypt?: string[];
      audit?: boolean;
    }
  ): Promise<T[]> {
    await this.validateTenantAccess(context, 'read', model);

    try {
      // Inject tenant filter
      const tenantQuery = {
        ...query,
        where: {
          ...query.where,
          organizationId: context.organizationId,
        },
      };

      const results = await this.prismaService[model].findMany(tenantQuery);

      // Decrypt sensitive fields if specified
      if (options?.decrypt && options.decrypt.length > 0) {
        for (const result of results) {
          for (const field of options.decrypt) {
            if (result[field]) {
              result[field] = await this.tenantAwareService.decryptData(
                context.organizationId,
                result[field]
              );
            }
          }
        }
      }

      // Audit logging for sensitive operations
      if (options?.audit) {
        await this.tenantAwareService.logAuditEvent(
          context,
          'READ',
          model,
          null,
          null,
          { count: results.length, query: tenantQuery }
        );
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to find ${model}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find a single record with tenant validation
   */
  async findUnique<T>(
    context: TenantContext,
    model: string,
    query: any,
    options?: {
      decrypt?: string[];
      audit?: boolean;
    }
  ): Promise<T | null> {
    await this.validateTenantAccess(context, 'read', model);

    try {
      // Inject tenant filter
      const tenantQuery = {
        ...query,
        where: {
          ...query.where,
          organizationId: context.organizationId,
        },
      };

      const result = await this.prismaService[model].findFirst(tenantQuery);

      if (!result) {
        return null;
      }

      // Decrypt sensitive fields if specified
      if (options?.decrypt && options.decrypt.length > 0) {
        for (const field of options.decrypt) {
          if (result[field]) {
            result[field] = await this.tenantAwareService.decryptData(
              context.organizationId,
              result[field]
            );
          }
        }
      }

      // Audit logging for sensitive operations
      if (options?.audit) {
        await this.tenantAwareService.logAuditEvent(
          context,
          'READ',
          model,
          result.id,
          null,
          { query: tenantQuery }
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to find unique ${model}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a record with tenant validation
   */
  async update<T>(
    context: TenantContext,
    model: string,
    id: string,
    data: any,
    options?: {
      encrypt?: string[];
      audit?: boolean;
    }
  ): Promise<T> {
    await this.validateTenantAccess(context, 'update', model);

    try {
      // First, get the existing record to validate ownership
      const existing = await this.prismaService[model].findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existing) {
        throw new ForbiddenException(`${model} not found or access denied`);
      }

      // Encrypt sensitive fields if specified
      const updateData = { ...data };
      if (options?.encrypt && options.encrypt.length > 0) {
        for (const field of options.encrypt) {
          if (updateData[field]) {
            updateData[field] = await this.tenantAwareService.encryptData(
              context.organizationId,
              updateData[field]
            );
          }
        }
      }

      // Update the record
      const result = await this.prismaService[model].update({
        where: { id },
        data: updateData,
      });

      // Audit logging
      if (options?.audit !== false) {
        await this.tenantAwareService.logAuditEvent(
          context,
          'UPDATE',
          model,
          id,
          existing,
          result
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to update ${model}: ${error.message}`);
      
      // Log audit failure
      await this.tenantAwareService.logAuditFailure(
        context,
        'UPDATE',
        model,
        error.message,
        id
      );
      
      throw error;
    }
  }

  /**
   * Delete a record with tenant validation
   */
  async delete<T>(
    context: TenantContext,
    model: string,
    id: string,
    options?: {
      audit?: boolean;
      softDelete?: boolean;
    }
  ): Promise<T> {
    await this.validateTenantAccess(context, 'delete', model);

    try {
      // First, get the existing record to validate ownership
      const existing = await this.prismaService[model].findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existing) {
        throw new ForbiddenException(`${model} not found or access denied`);
      }

      let result: T;

      if (options?.softDelete) {
        // Soft delete by updating a deleted flag
        result = await this.prismaService[model].update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      } else {
        // Hard delete
        result = await this.prismaService[model].delete({
          where: { id },
        });
      }

      // Update usage tracking
      await this.tenantAwareService.decrementUsage(context.organizationId, model);

      // Audit logging
      if (options?.audit !== false) {
        await this.tenantAwareService.logAuditEvent(
          context,
          options?.softDelete ? 'SOFT_DELETE' : 'DELETE',
          model,
          id,
          existing,
          null
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to delete ${model}: ${error.message}`);
      
      // Log audit failure
      await this.tenantAwareService.logAuditFailure(
        context,
        'DELETE',
        model,
        error.message,
        id
      );
      
      throw error;
    }
  }

  /**
   * Execute a transaction with tenant isolation
   */
  async transaction<T>(
    context: TenantContext,
    operations: Array<{
      model: string;
      operation: 'create' | 'update' | 'delete';
      data?: any;
      where?: any;
    }>,
    options?: {
      audit?: boolean;
    }
  ): Promise<T[]> {
    try {
      const results = await this.prismaService.$transaction(async (prisma) => {
        const transactionResults = [];

        for (const op of operations) {
          await this.validateTenantAccess(context, op.operation, op.model);

          let result;
          switch (op.operation) {
            case 'create':
              result = await prisma[op.model].create({
                data: {
                  ...op.data,
                  organizationId: context.organizationId,
                },
              });
              break;

            case 'update':
              result = await prisma[op.model].update({
                where: {
                  ...op.where,
                  organizationId: context.organizationId,
                },
                data: op.data,
              });
              break;

            case 'delete':
              result = await prisma[op.model].delete({
                where: {
                  ...op.where,
                  organizationId: context.organizationId,
                },
              });
              break;
          }

          transactionResults.push(result);
        }

        return transactionResults;
      });

      // Audit logging for transaction
      if (options?.audit !== false) {
        await this.tenantAwareService.logAuditEvent(
          context,
          'TRANSACTION',
          'Multiple',
          null,
          null,
          { operations: operations.length, results: results.length }
        );
      }

      return results;
    } catch (error) {
      this.logger.error(`Transaction failed: ${error.message}`);
      
      // Log audit failure
      await this.tenantAwareService.logAuditFailure(
        context,
        'TRANSACTION',
        'Multiple',
        error.message
      );
      
      throw error;
    }
  }

  private async validateTenantAccess(
    context: TenantContext,
    action: 'create' | 'read' | 'update' | 'delete',
    resourceType: string
  ): Promise<void> {
    await this.tenantAwareService.validateTenantAccess(context, action, resourceType);
  }
}
