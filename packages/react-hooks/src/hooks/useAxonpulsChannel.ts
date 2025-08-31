import { useEffect, useState, useCallback, useRef } from 'react';
import { AxonpulsConnection } from './useAxonpuls';

export interface ChannelMessage {
  id: string;
  type: string;
  payload: any;
  metadata: {
    timestamp: string;
    userId?: string;
    organizationId: string;
    channel: string;
  };
}

export interface ChannelState {
  messages: ChannelMessage[];
  isSubscribed: boolean;
  lastMessage: ChannelMessage | null;
  messageCount: number;
  sendMessage: (type: string, payload: any) => void;
  clearMessages: () => void;
  // 🎯 PRODUCTION-GRADE HTTP API INTEGRATION
  loadHistory: (options?: { count?: number; startTime?: string; endTime?: string }) => Promise<void>;
  isLoadingHistory: boolean;
  historyError: string | null;
}

/**
 * Hook for channel-based messaging - Perfect for chat, notifications, live updates
 * 
 * @example
 * ```tsx
 * function ChatRoom({ roomId }: { roomId: string }) {
 *   const channel = useAxonpulsChannel(`chat:${roomId}`, axonpuls);
 * 
 *   const sendChatMessage = () => {
 *     channel.sendMessage('chat_message', {
 *       text: 'Hello AXONPULS!',
 *       user: 'John Doe'
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       <div>Messages: {channel.messageCount}</div>
 *       {channel.messages.map(msg => (
 *         <div key={msg.id}>{msg.payload.text}</div>
 *       ))}
 *       <button onClick={sendChatMessage}>Send Message</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAxonpulsChannel(
  channelName: string,
  connection: AxonpulsConnection,
  options: {
    maxMessages?: number;
    autoSubscribe?: boolean;
    debug?: boolean;
  } = {}
): ChannelState {
  const { maxMessages = 100, autoSubscribe = true, debug = false } = options;
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastMessage, setLastMessage] = useState<ChannelMessage | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const messageHandlerRef = useRef<((data: any) => void) | null>(null);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (connection.isConnected) {
      const message = {
        channel: channelName,
        type,
        payload,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      connection.publish(channelName, message);

      if (debug) {
        console.log(`📤 Sent to ${channelName}:`, message);
      }
    } else if (debug) {
      console.warn('⚠️ Cannot send message - not connected to AXONPULS');
    }
  }, [channelName, connection, debug]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastMessage(null);
  }, []);

  // 🎯 PRODUCTION-GRADE HISTORY LOADING via HTTP API
  const loadHistory = useCallback(async (options: { count?: number; startTime?: string; endTime?: string } = {}) => {
    if (!connection.client) {
      setHistoryError('No connection available');
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      // Use the SDK's HTTP API method
      const result = await (connection.client as any).replayChannel(channelName, options);

      if (result.success && result.events) {
        // Convert backend events to ChannelMessage format
        const historyMessages: ChannelMessage[] = result.events.map((event: any) => ({
          id: event.id,
          type: event.type,
          payload: event.payload,
          metadata: {
            timestamp: new Date(event.timestamp).toISOString(),
            userId: event.metadata?.userId,
            organizationId: event.metadata?.org_id || event.metadata?.organizationId,
            channel: channelName
          }
        }));

        // Prepend history to current messages (history first, then live messages)
        setMessages(prev => {
          const combined = [...historyMessages, ...prev];
          // Remove duplicates by ID
          const unique = combined.filter((msg, index, arr) =>
            arr.findIndex(m => m.id === msg.id) === index
          );
          // Keep only maxMessages
          return unique.slice(-maxMessages);
        });

        if (debug) {
          console.log(`📜 Loaded ${historyMessages.length} historical messages for ${channelName}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load history';
      setHistoryError(errorMessage);

      if (debug) {
        console.error(`❌ Failed to load history for ${channelName}:`, error);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, [channelName, connection.client, maxMessages, debug]);

  // Set up message listener
  useEffect(() => {
    if (!connection.client || !connection.isConnected) return;

    const handleMessage = (data: ChannelMessage) => {
      if (data.metadata.channel === channelName) {
        if (debug) {
          console.log(`📥 Received on ${channelName}:`, data);
        }

        setMessages(prev => {
          const newMessages = [...prev, data];
          // Keep only the last maxMessages
          return newMessages.slice(-maxMessages);
        });

        setLastMessage(data);
      }
    };

    messageHandlerRef.current = handleMessage;
    connection.client.on('channel_message', handleMessage);

    return () => {
      if (connection.client && messageHandlerRef.current) {
        connection.client.off('channel_message', messageHandlerRef.current);
      }
    };
  }, [connection.client, connection.isConnected, channelName, maxMessages, debug]);

  // Handle subscription
  useEffect(() => {
    if (connection.isConnected && autoSubscribe && !isSubscribed) {
      connection.subscribe([channelName]);
      setIsSubscribed(true);

      if (debug) {
        console.log(`🔔 Auto-subscribed to channel: ${channelName}`);
      }
    }

    return () => {
      if (isSubscribed && connection.isConnected) {
        connection.unsubscribe([channelName]);
        setIsSubscribed(false);

        if (debug) {
          console.log(`🔕 Unsubscribed from channel: ${channelName}`);
        }
      }
    };
  }, [connection.isConnected, channelName, autoSubscribe, isSubscribed, connection, debug]);

  return {
    messages,
    isSubscribed,
    lastMessage,
    messageCount: messages.length,
    sendMessage,
    clearMessages,
    loadHistory,
    isLoadingHistory,
    historyError,
  };
}