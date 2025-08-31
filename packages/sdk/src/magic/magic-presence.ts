/**
 * 👥 MAGIC PRESENCE SDK
 * 
 * Client-side implementation for real-time presence awareness
 * Integrates with existing API endpoints for user presence tracking
 */

import { AxonPulsClient } from '../core/client';
import type { MagicPresenceInfo, PresenceUpdateData } from './types';

export class MagicPresence {
  private client: AxonPulsClient;
  private activePresences = new Map<string, MagicPresenceInfo>();
  private updateInterval?: NodeJS.Timeout;

  constructor(client: AxonPulsClient) {
    this.client = client;
    this.setupPresenceCleanup();
  }

  /**
   * Join a room for presence tracking
   */
  async joinRoom(
    roomName: string,
    userData: {
      userName: string;
      userAvatar?: string;
      deviceInfo?: any;
    }
  ): Promise<MagicPresenceInfo> {
    // Join via API
    await this.client.request('POST', `/magic/${roomName}/join`, userData);

    // Subscribe to presence events
    await this.client.subscribe([`magic_presence_${roomName}`]);

    // Create presence info
    const presence: MagicPresenceInfo = {
      id: this.generatePresenceId(roomName),
      roomId: roomName,
      userId: this.client.getUserId() || 'unknown',
      sessionId: this.client.getUserId() || 'unknown',
      userName: userData.userName,
      userAvatar: userData.userAvatar,
      isActive: true,
      lastSeen: new Date(),
      deviceInfo: userData.deviceInfo,
      joinedAt: new Date()
    };

    this.activePresences.set(roomName, presence);

    // Start presence updates
    this.startPresenceUpdates(roomName);

    // Listen for presence events
    this.setupPresenceEventListeners(roomName);

    return presence;
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomName: string): Promise<void> {
    try {
      await this.client.request('POST', `/magic/${roomName}/leave`);
    } catch (error) {
      // Continue with cleanup even if API call fails
    }

    // Unsubscribe from presence events
    await this.client.unsubscribe([`magic_presence_${roomName}`]);

    // Stop presence updates
    this.stopPresenceUpdates(roomName);

    // Remove from active presences
    this.activePresences.delete(roomName);
  }

  /**
   * Update presence information
   */
  async updatePresence(
    roomName: string,
    updateData: PresenceUpdateData
  ): Promise<void> {
    try {
      await this.client.request('POST', `/magic/${roomName}/presence`, updateData);
    } catch (error) {
      // Continue with local update even if API call fails
    }

    // Update local presence
    const presence = this.activePresences.get(roomName);
    if (presence) {
      Object.assign(presence, updateData);
      presence.lastSeen = new Date();
    }
  }

  /**
   * Get all presences in a room
   */
  async getRoomPresences(roomName: string): Promise<MagicPresenceInfo[]> {
    try {
      const response = await this.client.request('GET', `/magic/${roomName}/presences`);
      return response.presences || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Send heartbeat to maintain presence
   */
  async sendHeartbeat(roomName: string): Promise<void> {
    try {
      await this.client.request('POST', `/magic/${roomName}/heartbeat`);

      // Update local presence
      const presence = this.activePresences.get(roomName);
      if (presence) {
        presence.lastSeen = new Date();
      }
    } catch (error) {
      // Silent fail for heartbeat
    }
  }

  /**
   * Get current user's presence in a room
   */
  getCurrentPresence(roomName: string): MagicPresenceInfo | null {
    return this.activePresences.get(roomName) || null;
  }

  /**
   * Get all active presences for current user
   */
  getActivePresences(): MagicPresenceInfo[] {
    return Array.from(this.activePresences.values());
  }

  /**
   * Check if user is present in a room
   */
  isPresentInRoom(roomName: string): boolean {
    return this.activePresences.has(roomName);
  }

  /**
   * Update cursor position
   */
  async updateCursorPosition(
    roomName: string,
    x: number,
    y: number,
    elementId?: string
  ): Promise<void> {
    await this.updatePresence(roomName, {
      cursorPosition: { x, y, elementId }
    });
  }

  /**
   * Update text selection
   */
  async updateSelection(
    roomName: string,
    start: number,
    end: number,
    elementId?: string
  ): Promise<void> {
    await this.updatePresence(roomName, {
      selection: { start, end, elementId }
    });
  }

  /**
   * Update viewport information
   */
  async updateViewport(
    roomName: string,
    scrollX: number,
    scrollY: number,
    zoom: number = 1
  ): Promise<void> {
    await this.updatePresence(roomName, {
      viewportInfo: { scrollX, scrollY, zoom }
    });
  }

  /**
   * Set active/inactive status
   */
  async setActiveStatus(roomName: string, isActive: boolean): Promise<void> {
    await this.updatePresence(roomName, { isActive });
  }

  /**
   * Start automatic presence updates
   */
  private startPresenceUpdates(roomName: string): void {
    // Send heartbeat every 30 seconds
    this.updateInterval = setInterval(() => {
      if (this.activePresences.has(roomName)) {
        this.sendHeartbeat(roomName);
      }
    }, 30000);
  }

  /**
   * Stop presence updates
   */
  private stopPresenceUpdates(roomName: string): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * Setup event listeners for presence updates
   */
  private setupPresenceEventListeners(roomName: string): void {
    // Listen for other users joining
    this.client.on('magic_presence_user_joined', (data: any) => {
      if (data.roomName === roomName) {
        this.client.emit('presence_user_joined', data);
      }
    });

    // Listen for other users leaving
    this.client.on('magic_presence_user_left', (data: any) => {
      if (data.roomName === roomName) {
        this.client.emit('presence_user_left', data);
      }
    });

    // Listen for presence updates
    this.client.on('magic_presence_updated', (data: any) => {
      if (data.roomName === roomName) {
        this.client.emit('presence_updated', data);
      }
    });
  }

  /**
   * Setup presence cleanup
   */
  private setupPresenceCleanup(): void {
    // Clean up inactive presences every 5 minutes
    setInterval(() => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      for (const [roomName, presence] of this.activePresences.entries()) {
        if (presence.lastSeen < fiveMinutesAgo) {
          this.activePresences.delete(roomName);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Generate unique presence ID
   */
  private generatePresenceId(roomName: string): string {
    return `presence_${roomName}_${this.client.getUserId()}_${Date.now()}`;
  }

  /**
   * Get presence statistics
   */
  async getPresenceStats(roomName: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    averagePresenceDuration: number;
  }> {
    const presences = await this.getRoomPresences(roomName);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const activeUsers = presences.filter(p => p.lastSeen > fiveMinutesAgo).length;
    const totalUsers = presences.length;
    const inactiveUsers = totalUsers - activeUsers;

    // Calculate average presence duration
    const totalDuration = presences.reduce((sum, presence) => {
      const duration = now.getTime() - presence.joinedAt.getTime();
      return sum + duration;
    }, 0);

    const averagePresenceDuration = totalUsers > 0 ? totalDuration / totalUsers : 0;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      averagePresenceDuration
    };
  }
}
