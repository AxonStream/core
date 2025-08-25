import { useEffect, useState, useCallback, useRef } from 'react';
import { AxonpulsConnection } from './useAxonpuls';

export interface HITLRequest {
    id: string;
    type: 'approval' | 'review' | 'decision' | 'escalation' | 'custom';
    title: string;
    description: string;
    payload: any;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    requester: {
        id: string;
        name: string;
        role?: string;
    };
    deadline?: string;
    context?: any;
    metadata: {
        timestamp: string;
        organizationId: string;
        department?: string;
        tags?: string[];
    };
}

export interface HITLResponse {
    requestId: string;
    action: 'approve' | 'reject' | 'escalate' | 'request_info' | 'custom';
    comment?: string;
    data?: any;
    reviewer: {
        id: string;
        name: string;
        role?: string;
    };
    timestamp: string;
}

export interface HITLState {
    pendingRequests: HITLRequest[];
    activeRequest: HITLRequest | null;
    requestHistory: HITLRequest[];
    isProcessing: boolean;
    submitResponse: (response: Omit<HITLResponse, 'timestamp' | 'reviewer'>) => void;
    createRequest: (request: Omit<HITLRequest, 'id' | 'metadata'>) => void;
    dismissRequest: (requestId: string) => void;
    getRequestsByType: (type: HITLRequest['type']) => HITLRequest[];
    getUrgentRequests: () => HITLRequest[];
}

/**
 * Human-in-the-Loop Hook - AXONPULS's unique differentiator!
 * Enable real-time human intervention in automated processes
 * 
 * @example
 * ```tsx
 * function ApprovalDashboard() {
 *   const hitl = useAxonpulsHITL(axonpuls, {
 *     department: 'finance',
 *     autoAcceptRoles: ['admin', 'manager']
 *   });
 * 
 *   const handleApproval = (requestId: string, approved: boolean) => {
 *     hitl.submitResponse({
 *       requestId,
 *       action: approved ? 'approve' : 'reject',
 *       comment: approved ? 'Approved by finance team' : 'Requires additional documentation'
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       <h2>Pending Approvals ({hitl.pendingRequests.length})</h2>
 *       {hitl.pendingRequests.map(request => (
 *         <div key={request.id} className={`priority-${request.priority}`}>
 *           <h3>{request.title}</h3>
 *           <p>{request.description}</p>
 *           <button onClick={() => handleApproval(request.id, true)}>
 *             ✅ Approve
 *           </button>
 *           <button onClick={() => handleApproval(request.id, false)}>
 *             ❌ Reject
 *           </button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAxonpulsHITL(
    connection: AxonpulsConnection,
    options: {
        department?: string;
        autoAcceptRoles?: string[];
        maxHistorySize?: number;
        currentUser?: {
            id: string;
            name: string;
            role: string;
        };
        debug?: boolean;
    } = {}
): HITLState {
    const {
        department,
        autoAcceptRoles = [],
        maxHistorySize = 50,
        currentUser,
        debug = false
    } = options;

    const [pendingRequests, setPendingRequests] = useState<HITLRequest[]>([]);
    const [activeRequest, setActiveRequest] = useState<HITLRequest | null>(null);
    const [requestHistory, setRequestHistory] = useState<HITLRequest[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const submitResponse = useCallback((response: Omit<HITLResponse, 'timestamp' | 'reviewer'>) => {
        if (!connection.isConnected || !currentUser) {
            if (debug) console.warn('⚠️ Cannot submit HITL response - not connected or no user');
            return;
        }

        setIsProcessing(true);

        const fullResponse: HITLResponse = {
            ...response,
            timestamp: new Date().toISOString(),
            reviewer: currentUser,
        };

        connection.publish('hitl_response', fullResponse);

        // Remove from pending requests
        setPendingRequests(prev => prev.filter(req => req.id !== response.requestId));

        // Clear active request if it's the one being responded to
        setActiveRequest(prev => prev?.id === response.requestId ? null : prev);

        setIsProcessing(false);

        if (debug) {
            console.log('🎯 HITL Response submitted:', fullResponse);
        }
    }, [connection, currentUser, debug]);

    const createRequest = useCallback((request: Omit<HITLRequest, 'id' | 'metadata'>) => {
        if (!connection.isConnected) {
            if (debug) console.warn('⚠️ Cannot create HITL request - not connected');
            return;
        }

        const fullRequest: HITLRequest = {
            ...request,
            id: `hitl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
                timestamp: new Date().toISOString(),
                organizationId: '', // Will be set by server
                department,
            },
        };

        connection.publish('hitl_request', fullRequest);

        if (debug) {
            console.log('📋 HITL Request created:', fullRequest);
        }
    }, [connection, department, debug]);

    const dismissRequest = useCallback((requestId: string) => {
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        setActiveRequest(prev => prev?.id === requestId ? null : prev);

        if (debug) {
            console.log('🗑️ HITL Request dismissed:', requestId);
        }
    }, [debug]);

    const getRequestsByType = useCallback((type: HITLRequest['type']) => {
        return pendingRequests.filter(req => req.type === type);
    }, [pendingRequests]);

    const getUrgentRequests = useCallback(() => {
        return pendingRequests.filter(req => req.priority === 'urgent');
    }, [pendingRequests]);

    // Listen for incoming HITL requests
    useEffect(() => {
        if (!connection.client || !connection.isConnected) return;

        const handleHITLRequest = (request: HITLRequest) => {
            // Auto-approve if user has the right role
            if (currentUser?.role && autoAcceptRoles.includes(currentUser.role)) {
                const autoResponse: HITLResponse = {
                    requestId: request.id,
                    action: 'approve',
                    comment: `Auto-approved by ${currentUser.role}`,
                    reviewer: currentUser,
                    timestamp: new Date().toISOString(),
                };

                connection.publish('hitl_response', autoResponse);

                if (debug) {
                    console.log('⚡ Auto-approved HITL request:', request.id);
                }
                return;
            }

            // Add to pending requests
            setPendingRequests(prev => [request, ...prev]);

            // Set as active if no current active request
            setActiveRequest(prev => prev || request);

            // Add to history
            setRequestHistory(prev => {
                const newHistory = [request, ...prev];
                return newHistory.slice(0, maxHistorySize);
            });

            if (debug) {
                console.log('📥 New HITL request received:', request);
            }
        };

        const handleHITLStatusUpdate = (data: { requestId: string; status: string }) => {
            if (debug) {
                console.log('📊 HITL Status update:', data);
            }
        };

        connection.client.on('hitl_request', handleHITLRequest);
        connection.client.on('hitl_status_update', handleHITLStatusUpdate);

        return () => {
            if (connection.client) {
                connection.client.off('hitl_request', handleHITLRequest);
                connection.client.off('hitl_status_update', handleHITLStatusUpdate);
            }
        };
    }, [connection.client, connection.isConnected, currentUser, autoAcceptRoles, maxHistorySize, debug]);

    // Subscribe to HITL channel
    useEffect(() => {
        if (connection.isConnected) {
            const hitlChannel = department ? `hitl:${department}` : 'hitl:global';
            connection.subscribe([hitlChannel]);

            if (debug) {
                console.log(`🎯 Subscribed to HITL channel: ${hitlChannel}`);
            }

            return () => {
                connection.unsubscribe([hitlChannel]);
            };
        }
    }, [connection, department, debug]);

    return {
        pendingRequests,
        activeRequest,
        requestHistory,
        isProcessing,
        submitResponse,
        createRequest,
        dismissRequest,
        getRequestsByType,
        getUrgentRequests,
    };
}
