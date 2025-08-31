'use client';

import { useState } from 'react';
import { APIEndpoint, TestRequest } from '../APITester';
import { ParametersTab } from './tabs/ParametersTab';
import { HeadersTab } from './tabs/HeadersTab';
import { BodyTab } from './tabs/BodyTab';
import { AuthTab } from './tabs/AuthTab';

interface RequestBuilderProps {
  endpoint: APIEndpoint | null;
  currentRequest: Partial<TestRequest>;
  onUpdateRequest: (request: Partial<TestRequest>) => void;
  onSendRequest: () => void;
  isLoading: boolean;
}

type TabType = 'params' | 'headers' | 'body' | 'auth';

export function RequestBuilder({
  endpoint,
  currentRequest,
  onUpdateRequest,
  onSendRequest,
  isLoading
}: RequestBuilderProps) {
  const [activeTab, setActiveTab] = useState<TabType>('params');

  if (!endpoint) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎯</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Modern API Testing</h2>
          <p className="text-gray-600 mb-8">
            Select an endpoint from the sidebar to start testing, or discover APIs automatically.
          </p>
          
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl mb-2">🔄</div>
              <h4 className="font-semibold text-gray-900 mb-1">Auto Discovery</h4>
              <p className="text-sm text-gray-600">
                Automatically detects and loads API endpoints from your backend
              </p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl mb-2">🎨</div>
              <h4 className="font-semibold text-gray-900 mb-1">Smart Forms</h4>
              <p className="text-sm text-gray-600">
                Generates intelligent forms based on API schemas and validation
              </p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-semibold text-gray-900 mb-1">Real-time Testing</h4>
              <p className="text-sm text-gray-600">
                Instant API testing with beautiful response visualization
              </p>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-semibold text-gray-900 mb-1">Performance Insights</h4>
              <p className="text-sm text-gray-600">
                Detailed metrics, timing, and performance analysis
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-800 border-green-200';
      case 'POST': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PUT': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      case 'PATCH': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const tabs = [
    { id: 'params', label: 'Parameters', count: endpoint.parameters.length },
    { id: 'headers', label: 'Headers', count: Object.keys(currentRequest.headers || {}).length },
    { id: 'body', label: 'Body', disabled: !['POST', 'PUT', 'PATCH'].includes(endpoint.method) },
    { id: 'auth', label: 'Auth', count: endpoint.security?.length || 0 }
  ];

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Request Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Method Badge */}
            <span className={`px-3 py-1 text-sm font-medium rounded border ${getMethodColor(endpoint.method)}`}>
              {endpoint.method}
            </span>

            {/* Endpoint Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{endpoint.summary}</h3>
              <div className="text-sm text-gray-600 font-mono">{endpoint.path}</div>
              {endpoint.description && (
                <p className="text-sm text-gray-500 mt-1">{endpoint.description}</p>
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={onSendRequest}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Send Request</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              disabled={tab.disabled}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : tab.disabled
                  ? 'border-transparent text-gray-400 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'params' && (
          <ParametersTab
            endpoint={endpoint}
            currentRequest={currentRequest}
            onUpdateRequest={onUpdateRequest}
          />
        )}
        
        {activeTab === 'headers' && (
          <HeadersTab
            currentRequest={currentRequest}
            onUpdateRequest={onUpdateRequest}
          />
        )}
        
        {activeTab === 'body' && (
          <BodyTab
            endpoint={endpoint}
            currentRequest={currentRequest}
            onUpdateRequest={onUpdateRequest}
          />
        )}
        
        {activeTab === 'auth' && (
          <AuthTab
            endpoint={endpoint}
            currentRequest={currentRequest}
            onUpdateRequest={onUpdateRequest}
          />
        )}
      </div>
    </div>
  );
}
