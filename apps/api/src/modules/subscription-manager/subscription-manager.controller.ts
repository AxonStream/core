import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantIsolationGuard } from '../../common/guards/tenant-isolation.guard';
import { TenantIsolated, OrganizationId, UserId } from '../../common/decorators/tenant-isolation.decorator';
import { SubscriptionManagerService } from './subscription-manager.service';
import { TenantContext } from '../../common/services/tenant-aware.service';

export class CreateSubscriptionDto {
  channel: string;
  filters?: Record<string, any>;
}

export class UpdateSubscriptionDto {
  filters?: Record<string, any>;
  isActive?: boolean;
}

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantIsolationGuard)
@Controller('subscriptions')
export class SubscriptionManagerController {
  private readonly logger = new Logger(SubscriptionManagerController.name);

  constructor(
    private readonly subscriptionManagerService: SubscriptionManagerService,
  ) {}

  @Post()
  @TenantIsolated({
    resource: 'Subscription',
    permission: 'subscription:create',
    audit: { action: 'CREATE', resourceType: 'Subscription', severity: 'MEDIUM' }
  })
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createSubscription(
    @OrganizationId() organizationId: string,
    @UserId() userId: string,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    const subscription = await this.subscriptionManagerService.createSubscription(
      organizationId,
      userId,
      createSubscriptionDto.channel,
      createSubscriptionDto.filters,
    );

    return {
      success: true,
      data: subscription,
    };
  }

  @Get()
  @TenantIsolated({
    resource: 'Subscription',
    permission: 'subscription:read',
    audit: { action: 'READ', resourceType: 'Subscription', severity: 'LOW' }
  })
  @ApiOperation({ summary: 'Get user subscriptions' })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved successfully' })
  async getUserSubscriptions(
    @OrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const subscriptions = await this.subscriptionManagerService.getSubscriptionsByUser(
      organizationId,
      userId,
    );

    return {
      success: true,
      data: subscriptions,
    };
  }

  @Get('organization')
  @ApiOperation({ summary: 'Get organization subscriptions (admin only)' })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved successfully' })
  async getOrganizationSubscriptions(@Req() req: any) {
    const context: TenantContext = req.tenantContext;

    if (context.userRole !== 'admin') {
      return {
        success: false,
        error: 'Unauthorized: Admin access required',
      };
    }

    const subscriptions = await this.subscriptionManagerService.getSubscriptionsByOrganization(
      context.organizationId,
    );

    return {
      success: true,
      data: subscriptions,
    };
  }

  @Get('channel/:channel/subscribers')
  @ApiOperation({ summary: 'Get subscribers for a channel' })
  @ApiResponse({ status: 200, description: 'Subscribers retrieved successfully' })
  async getChannelSubscribers(
    @Req() req: any,
    @Param('channel') channel: string,
  ) {
    const context: TenantContext = req.tenantContext;

    const subscribers = await this.subscriptionManagerService.getSubscribersForChannel(
      context.organizationId,
      channel,
    );

    return {
      success: true,
      data: {
        channel,
        subscribers,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiResponse({ status: 200, description: 'Subscription retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscription(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const context: TenantContext = req.tenantContext;
    const subscription = await this.subscriptionManagerService.getSubscription(id);

    if (!subscription || subscription.organizationId !== context.organizationId) {
      return {
        success: false,
        error: 'Subscription not found',
      };
    }

    return {
      success: true,
      data: subscription,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async updateSubscription(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    const context: TenantContext = req.tenantContext;
    const existing = await this.subscriptionManagerService.getSubscription(id);

    if (!existing || existing.organizationId !== context.organizationId) {
      return {
        success: false,
        error: 'Subscription not found',
      };
    }

    const subscription = await this.subscriptionManagerService.updateSubscription(
      id,
      updateSubscriptionDto,
    );

    return {
      success: true,
      data: subscription,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription' })
  @ApiResponse({ status: 200, description: 'Subscription deleted successfully' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async deleteSubscription(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const context: TenantContext = req.tenantContext;
    const existing = await this.subscriptionManagerService.getSubscription(id);

    if (!existing || existing.organizationId !== context.organizationId) {
      return {
        success: false,
        error: 'Subscription not found',
      };
    }

    const success = await this.subscriptionManagerService.deleteSubscription(id);

    return {
      success,
      message: success ? 'Subscription deleted successfully' : 'Failed to delete subscription',
    };
  }

  @Get('validate/:channel')
  @ApiOperation({ summary: 'Validate subscription for a channel' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateSubscription(
    @Req() req: any,
    @Param('channel') channel: string,
  ) {
    const context: TenantContext = req.tenantContext;

    const isValid = await this.subscriptionManagerService.validateSubscription(
      context.organizationId,
      context.userId,
      channel,
    );

    return {
      success: true,
      data: {
        channel,
        isValid,
      },
    };
  }
}
