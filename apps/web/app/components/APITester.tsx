'use client';

import { useState, useEffect } from 'react';
import { EndpointsList } from './api-tester/EndpointsList';
import { RequestBuilder } from './api-tester/RequestBuilder';
import { ResponseViewer } from './api-tester/ResponseViewer';
import { HistoryPanel } from './api-tester/HistoryPanel';

export interface APIEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponse[];
  security?: string[];
}

export interface APIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  type: string;
  description?: string;
  example?: any;
  enum?: string[];
}

export interface APIRequestBody {
  contentType: string;
  schema: any;
  example?: any;
  required: boolean;
}

export interface APIResponse {
  statusCode: number;
  description: string;
  schema?: any;
  example?: any;
}

export interface TestRequest {
  id: string;
  endpoint: APIEndpoint;
  parameters: Record<string, any>;
  headers: Record<string, string>;
  body?: any;
  timestamp: number;
}

export interface TestResponse {
  requestId: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  duration: number;
  size: number;
  timestamp: number;
}

export function APITesterComponent() {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [testHistory, setTestHistory] = useState<Array<{ request: TestRequest; response: TestResponse }>>([]);
  const [currentRequest, setCurrentRequest] = useState<Partial<TestRequest>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<TestResponse | null>(null);

  // Auto-discover APIs on component mount
  useEffect(() => {
    // Load mock endpoints immediately for demo
    setEndpoints(getMockEndpoints());
    // Then try to discover real APIs
    discoverAPIs();
  }, []);

  const discoverAPIs = async () => {
    try {
      setIsLoading(true);

      // Try to fetch from OpenAPI/Swagger endpoint
      const response = await fetch('/api/docs-json');
      if (response.ok) {
        const openApiSpec = await response.json();
        const discoveredEndpoints = parseOpenAPISpec(openApiSpec);
        setEndpoints(discoveredEndpoints);
      }
      // If no real APIs found, keep the mock endpoints that are already loaded
    } catch (error) {
      console.warn('API discovery failed, keeping mock data:', error);
      // Keep existing mock endpoints
    } finally {
      setIsLoading(false);
    }
  };

  const parseOpenAPISpec = (spec: any): APIEndpoint[] => {
    const endpoints: APIEndpoint[] = [];

    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const typedOperation = operation as any;
          const endpoint: APIEndpoint = {
            id: `${method.toUpperCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
            method: method.toUpperCase() as any,
            path,
            summary: typedOperation.summary || `${method.toUpperCase()} ${path}`,
            description: typedOperation.description,
            tags: typedOperation.tags || [],
            parameters: parseParameters(typedOperation.parameters || []),
            requestBody: parseRequestBody(typedOperation.requestBody),
            responses: parseResponses(typedOperation.responses || {}),
            security: typedOperation.security?.map((s: any) => Object.keys(s)[0])
          };
          endpoints.push(endpoint);
        }
      }
    }

    return endpoints;
  };

  const parseParameters = (params: any[]): APIParameter[] => {
    return params.map(param => ({
      name: param.name,
      in: param.in,
      required: param.required || false,
      type: param.schema?.type || 'string',
      description: param.description,
      example: param.example || param.schema?.example,
      enum: param.schema?.enum
    }));
  };

  const parseRequestBody = (requestBody: any): APIRequestBody | undefined => {
    if (!requestBody) return undefined;

    const contentKeys = Object.keys(requestBody.content || {});
    const contentType = contentKeys[0] || 'application/json';
    const schema = requestBody.content?.[contentType]?.schema;

    return {
      contentType,
      schema,
      example: requestBody.content?.[contentType]?.example,
      required: requestBody.required || false
    };
  };

  const parseResponses = (responses: any): APIResponse[] => {
    return Object.entries(responses).map(([code, response]: [string, any]) => ({
      statusCode: parseInt(code),
      description: response.description,
      schema: response.content?.['application/json']?.schema,
      example: response.content?.['application/json']?.example
    }));
  };

  const getMockEndpoints = (): APIEndpoint[] => {
    return [
      {
        id: 'POST_auth_register',
        method: 'POST',
        path: '/api/auth/register',
        summary: 'Register new user',
        description: 'Create a new user account with email and password',
        tags: ['Authentication'],
        parameters: [],
        requestBody: {
          contentType: 'application/json',
          schema: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 8 },
              organizationSlug: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' }
            },
            required: ['email', 'password', 'organizationSlug']
          },
          example: {
            email: 'user@example.com',
            password: 'securePassword123',
            organizationSlug: 'my-org',
            firstName: 'John',
            lastName: 'Doe'
          },
          required: true
        },
        responses: [
          {
            statusCode: 201,
            description: 'User created successfully',
            example: {
              user: { id: '1', email: 'user@example.com' },
              accessToken: 'jwt-token-here'
            }
          }
        ],
        security: []
      },
      {
        id: 'POST_auth_login',
        method: 'POST',
        path: '/api/auth/login',
        summary: 'User login',
        description: 'Authenticate user with email and password',
        tags: ['Authentication'],
        parameters: [],
        requestBody: {
          contentType: 'application/json',
          schema: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string' },
              organizationSlug: { type: 'string' }
            },
            required: ['email', 'password', 'organizationSlug']
          },
          example: {
            email: 'user@example.com',
            password: 'securePassword123',
            organizationSlug: 'my-org'
          },
          required: true
        },
        responses: [
          {
            statusCode: 200,
            description: 'Login successful',
            example: {
              user: { id: '1', email: 'user@example.com' },
              accessToken: 'jwt-token-here',
              refreshToken: 'refresh-token-here'
            }
          }
        ],
        security: []
      },
      {
        id: 'GET_monitoring_dashboard',
        method: 'GET',
        path: '/api/monitoring/dashboard',
        summary: 'Get monitoring dashboard data',
        description: 'Retrieve real-time monitoring metrics and analytics',
        tags: ['Monitoring'],
        parameters: [
          {
            name: 'timeRange',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Time range for metrics',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            example: '24h'
          },
          {
            name: 'organizationId',
            in: 'header',
            required: true,
            type: 'string',
            description: 'Organization ID for tenant isolation'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Dashboard data retrieved successfully',
            example: {
              overview: {
                totalConnections: 1250,
                activeChannels: 45,
                messagesPerSecond: 125.5,
                uptime: '99.9%'
              },
              realTimeMetrics: {
                connections: 1250,
                channels: 45,
                messages: 125.5,
                errors: 2
              }
            }
          }
        ],
        security: ['Bearer']
      },
      {
        id: 'POST_channels_create',
        method: 'POST',
        path: '/api/channels',
        summary: 'Create new channel',
        description: 'Create a new real-time communication channel',
        tags: ['Channels'],
        parameters: [],
        requestBody: {
          contentType: 'application/json',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              isPrivate: { type: 'boolean' },
              maxMembers: { type: 'number' }
            },
            required: ['name']
          },
          example: {
            name: 'general-chat',
            description: 'General discussion channel',
            isPrivate: false,
            maxMembers: 100
          },
          required: true
        },
        responses: [
          {
            statusCode: 201,
            description: 'Channel created successfully',
            example: {
              id: 'ch_123',
              name: 'general-chat',
              description: 'General discussion channel',
              isPrivate: false,
              maxMembers: 100,
              createdAt: '2025-08-31T07:00:00Z'
            }
          }
        ],
        security: ['Bearer']
      }
    ];
  };

  const selectEndpoint = (endpoint: APIEndpoint) => {
    setSelectedEndpoint(endpoint);
    setCurrentRequest({
      id: Date.now().toString(),
      endpoint,
      parameters: {},
      headers: {},
      timestamp: Date.now()
    });
  };

  const sendRequest = async () => {
    if (!selectedEndpoint || !currentRequest) return;

    setIsLoading(true);

    try {
      const startTime = performance.now();

      // Build request URL
      let url = selectedEndpoint.path;

      // Replace path parameters
      if (currentRequest.parameters) {
        for (const [key, value] of Object.entries(currentRequest.parameters)) {
          url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
        }
      }

      // Add query parameters
      const queryParams = new URLSearchParams();
      if (currentRequest.parameters) {
        for (const [key, value] of Object.entries(currentRequest.parameters)) {
          const param = selectedEndpoint.parameters.find(p => p.name === key && p.in === 'query');
          if (param && value) {
            queryParams.append(key, String(value));
          }
        }
      }

      if (queryParams.toString()) {
        url += '?' + queryParams.toString();
      }

      // Build request options
      const requestOptions: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'Content-Type': 'application/json',
          ...currentRequest.headers
        }
      };

      // Add body for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && currentRequest.body) {
        requestOptions.body = JSON.stringify(currentRequest.body);
      }

      // Send request
      const response = await fetch(url, requestOptions);
      const responseData = await response.json().catch(() => response.text());
      const endTime = performance.now();

      // Create response object
      const testResponse: TestResponse = {
        requestId: currentRequest.id!,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        duration: Math.round(endTime - startTime),
        size: JSON.stringify(responseData).length,
        timestamp: Date.now()
      };

      // Save to history
      const newHistoryItem = {
        request: currentRequest as TestRequest,
        response: testResponse
      };

      setTestHistory(prev => [...prev, newHistoryItem]);
      setLastResponse(testResponse);

    } catch (error) {
      console.error('Request failed:', error);
      // Create error response
      const errorResponse: TestResponse = {
        requestId: currentRequest.id!,
        status: 0,
        statusText: 'Network Error',
        headers: {},
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        duration: 0,
        size: 0,
        timestamp: Date.now()
      };

      setLastResponse(errorResponse);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🚀 AxonStream API Tester</h1>
            <p className="text-gray-600">Modern API testing tool - Better than Postman</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={discoverAPIs}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '⏳ Discovering...' : '🔄 Discover APIs'}
            </button>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              📁 Import Collection
            </button>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              💾 Export Collection
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Endpoints List */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <EndpointsList
            endpoints={endpoints}
            selectedEndpoint={selectedEndpoint}
            onSelectEndpoint={selectEndpoint}
          />
        </div>

        {/* Main Content - Request Builder */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <RequestBuilder
            endpoint={selectedEndpoint}
            currentRequest={currentRequest}
            onUpdateRequest={setCurrentRequest}
            onSendRequest={sendRequest}
            isLoading={isLoading}
          />

          {/* Response Viewer */}
          {lastResponse && (
            <div className="flex-1 border-t border-gray-200">
              <ResponseViewer response={lastResponse} />
            </div>
          )}
        </div>

        {/* Right Sidebar - History */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <HistoryPanel
            history={testHistory}
            onClearHistory={() => setTestHistory([])}
            onSelectHistoryItem={(item) => {
              setSelectedEndpoint(item.request.endpoint);
              setCurrentRequest(item.request);
              setLastResponse(item.response);
            }}
          />
        </div>
      </div>
    </div>
  );
}
