import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiBody,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantIsolationGuard } from '../../../common/guards/tenant-isolation.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../../common/services/tenant-aware.service';
import { DeliveryGuaranteeService } from '../../../common/services/delivery-guarantee.service';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhooks.dto';

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard, TenantIsolationGuard)
@ApiBearerAuth()
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);

    constructor(
        private readonly deliveryGuaranteeService: DeliveryGuaranteeService,
    ) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a webhook endpoint',
        description: 'Register a new webhook endpoint for receiving event notifications.',
    })
    @ApiBody({ type: CreateWebhookDto })
    @ApiResponse({
        status: 201,
        description: 'Webhook created successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                webhookId: { type: 'string', example: 'ep_1234567890_abc123' },
                url: { type: 'string', example: 'https://api.example.com/webhooks' },
                active: { type: 'boolean', example: true },
                timestamp: { type: 'string', format: 'date-time' },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid webhook configuration',
    })
    @ApiResponse({
        status: 403,
        description: 'Insufficient permissions',
    })
    async createWebhook(
        @CurrentTenant() context: TenantContext,
        @Body() webhookDto: CreateWebhookDto,
    ) {
        try {
            this.logger.debug(`Creating webhook for org: ${context.organizationId}`);

            // Validate URL
            try {
                new URL(webhookDto.url);
            } catch {
                throw new BadRequestException('Invalid webhook URL format');
            }

            // Prepare webhook endpoint configuration
            const endpointConfig = {
                name: webhookDto.name,
                url: webhookDto.url,
                method: webhookDto.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'AXONPULS-Webhook/1.0',
                    ...(webhookDto.secret && { 'X-Webhook-Secret': webhookDto.secret }),
                    ...webhookDto.headers,
                },
                timeout: webhookDto.timeout || 10000,
                retryPolicy: {
                    maxRetries: webhookDto.maxRetries || 3,
                    backoffStrategy: webhookDto.backoffStrategy || 'exponential',
                    baseDelay: webhookDto.baseDelay || 1000,
                    maxDelay: webhookDto.maxDelay || 30000,
                    jitter: webhookDto.jitter !== false,
                },
                semantics: webhookDto.semantics || 'at-least-once',
                active: webhookDto.active !== false,
            };

            // Register webhook using existing DeliveryGuaranteeService
            const webhookId = await this.deliveryGuaranteeService.registerDeliveryEndpoint(
                context,
                endpointConfig,
            );

            this.logger.log(`Webhook created successfully: ${webhookId}`);

            return {
                success: true,
                webhookId,
                url: webhookDto.url,
                active: endpointConfig.active,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to create webhook: ${error.message}`);
            throw error;
        }
    }

    @Get()
    @ApiOperation({
        summary: 'List webhook endpoints',
        description: 'Get all webhook endpoints for the organization.',
    })
    @ApiResponse({
        status: 200,
        description: 'Webhooks retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                webhooks: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            url: { type: 'string' },
                            method: { type: 'string' },
                            active: { type: 'boolean' },
                            semantics: { type: 'string' },
                        },
                    },
                },
                count: { type: 'number' },
                timestamp: { type: 'string', format: 'date-time' },
            },
        },
    })
    async listWebhooks(@CurrentTenant() context: TenantContext) {
        try {
            this.logger.debug(`Listing webhooks for org: ${context.organizationId}`);

            const webhooks = await this.deliveryGuaranteeService.getDeliveryEndpoints(context);

            return {
                success: true,
                webhooks: webhooks.map(webhook => ({
                    id: webhook.id,
                    name: webhook.name,
                    url: webhook.url,
                    method: webhook.method,
                    active: webhook.active,
                    semantics: webhook.semantics,
                    timeout: webhook.timeout,
                    retryPolicy: webhook.retryPolicy,
                })),
                count: webhooks.length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to list webhooks: ${error.message}`);
            throw error;
        }
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Update a webhook endpoint',
        description: 'Update configuration of an existing webhook endpoint.',
    })
    @ApiParam({
        name: 'id',
        description: 'Webhook endpoint ID',
        example: 'ep_1234567890_abc123',
    })
    @ApiBody({ type: UpdateWebhookDto })
    @ApiResponse({
        status: 200,
        description: 'Webhook updated successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'Webhook not found',
    })
    async updateWebhook(
        @CurrentTenant() context: TenantContext,
        @Param('id') webhookId: string,
        @Body() updateDto: UpdateWebhookDto,
    ) {
        try {
            this.logger.debug(`Updating webhook: ${webhookId}`);

            // Validate URL if provided
            if (updateDto.url) {
                try {
                    new URL(updateDto.url);
                } catch {
                    throw new BadRequestException('Invalid webhook URL format');
                }
            }

            // Prepare update data
            const updateData: any = {};

            if (updateDto.name !== undefined) updateData.name = updateDto.name;
            if (updateDto.url !== undefined) updateData.url = updateDto.url;
            if (updateDto.method !== undefined) updateData.method = updateDto.method;
            if (updateDto.active !== undefined) updateData.active = updateDto.active;
            if (updateDto.timeout !== undefined) updateData.timeout = updateDto.timeout;

            if (updateDto.headers || updateDto.secret) {
                updateData.headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'AXONPULS-Webhook/1.0',
                    ...(updateDto.secret && { 'X-Webhook-Secret': updateDto.secret }),
                    ...updateDto.headers,
                };
            }

            if (updateDto.maxRetries !== undefined || updateDto.backoffStrategy !== undefined) {
                updateData.retryPolicy = {
                    maxRetries: updateDto.maxRetries || 3,
                    backoffStrategy: updateDto.backoffStrategy || 'exponential',
                    baseDelay: updateDto.baseDelay || 1000,
                    maxDelay: updateDto.maxDelay || 30000,
                    jitter: updateDto.jitter !== false,
                };
            }

            await this.deliveryGuaranteeService.updateDeliveryEndpoint(
                context,
                webhookId,
                updateData,
            );

            this.logger.log(`Webhook updated successfully: ${webhookId}`);

            return {
                success: true,
                webhookId,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to update webhook: ${error.message}`);
            if (error.message.includes('not found')) {
                throw new NotFoundException(`Webhook ${webhookId} not found`);
            }
            throw error;
        }
    }

    @Delete(':id')
    @ApiOperation({
        summary: 'Delete a webhook endpoint',
        description: 'Remove a webhook endpoint from the organization.',
    })
    @ApiParam({
        name: 'id',
        description: 'Webhook endpoint ID',
        example: 'ep_1234567890_abc123',
    })
    @ApiResponse({
        status: 200,
        description: 'Webhook deleted successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'Webhook not found',
    })
    async deleteWebhook(
        @CurrentTenant() context: TenantContext,
        @Param('id') webhookId: string,
    ) {
        try {
            this.logger.debug(`Deleting webhook: ${webhookId}`);

            // Deactivate the webhook (soft delete)
            await this.deliveryGuaranteeService.updateDeliveryEndpoint(
                context,
                webhookId,
                { active: false },
            );

            this.logger.log(`Webhook deleted successfully: ${webhookId}`);

            return {
                success: true,
                webhookId,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to delete webhook: ${error.message}`);
            if (error.message.includes('not found')) {
                throw new NotFoundException(`Webhook ${webhookId} not found`);
            }
            throw error;
        }
    }

    @Get(':id/deliveries')
    @ApiOperation({
        summary: 'Get webhook delivery history',
        description: 'Retrieve delivery history and statistics for a webhook endpoint.',
    })
    @ApiParam({
        name: 'id',
        description: 'Webhook endpoint ID',
        example: 'ep_1234567890_abc123',
    })
    @ApiQuery({
        name: 'limit',
        description: 'Maximum number of deliveries to return',
        required: false,
        example: 50,
        type: 'number',
    })
    @ApiResponse({
        status: 200,
        description: 'Delivery history retrieved successfully',
    })
    async getWebhookDeliveries(
        @CurrentTenant() context: TenantContext,
        @Param('id') webhookId: string,
        @Query('limit') limit?: number,
    ) {
        try {
            this.logger.debug(`Getting delivery history for webhook: ${webhookId}`);

            const deliveries = await this.deliveryGuaranteeService.getDeliveryReceipts(
                context,
                {
                    endpointId: webhookId,
                    limit: limit ? Math.min(Number(limit), 500) : 50,
                },
            );

            return {
                success: true,
                webhookId,
                deliveries: deliveries.map(delivery => ({
                    id: delivery.id,
                    eventId: delivery.eventId,
                    status: delivery.status,
                    attempts: delivery.attempts,
                    firstAttempt: delivery.firstAttempt,
                    lastAttempt: delivery.lastAttempt,
                    responseCode: delivery.responseCode,
                    responseTime: delivery.responseTime,
                    error: delivery.error,
                })),
                count: deliveries.length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to get webhook deliveries: ${error.message}`);
            throw error;
        }
    }
}
