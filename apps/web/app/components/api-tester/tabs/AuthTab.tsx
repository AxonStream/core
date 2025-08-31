'use client';

import { useState } from 'react';
import { APIEndpoint, TestRequest } from '../../APITester';

interface AuthTabProps {
  endpoint: APIEndpoint;
  currentRequest: Partial<TestRequest>;
  onUpdateRequest: (request: Partial<TestRequest>) => void;
}

type AuthType = 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2';

export function AuthTab({ endpoint, currentRequest, onUpdateRequest }: AuthTabProps) {
  const [authType, setAuthType] = useState<AuthType>('none');
  const [authData, setAuthData] = useState({
    bearerToken: '',
    basicUsername: '',
    basicPassword: '',
    apiKey: '',
    apiKeyHeader: 'X-API-Key',
    oauth2Token: ''
  });

  const updateAuth = (type: AuthType, data: any) => {
    setAuthType(type);
    setAuthData({ ...authData, ...data });
    
    const updatedHeaders = { ...currentRequest.headers };
    
    // Remove existing auth headers
    delete updatedHeaders['Authorization'];
    delete updatedHeaders['X-API-Key'];
    delete updatedHeaders[authData.apiKeyHeader];
    
    // Add new auth header based on type
    switch (type) {
      case 'bearer':
        if (data.bearerToken || authData.bearerToken) {
          updatedHeaders['Authorization'] = `Bearer ${data.bearerToken || authData.bearerToken}`;
        }
        break;
      
      case 'basic':
        if ((data.basicUsername || authData.basicUsername) && (data.basicPassword || authData.basicPassword)) {
          const credentials = btoa(`${data.basicUsername || authData.basicUsername}:${data.basicPassword || authData.basicPassword}`);
          updatedHeaders['Authorization'] = `Basic ${credentials}`;
        }
        break;
      
      case 'api-key':
        if (data.apiKey || authData.apiKey) {
          const headerName = data.apiKeyHeader || authData.apiKeyHeader;
          updatedHeaders[headerName] = data.apiKey || authData.apiKey;
        }
        break;
      
      case 'oauth2':
        if (data.oauth2Token || authData.oauth2Token) {
          updatedHeaders['Authorization'] = `Bearer ${data.oauth2Token || authData.oauth2Token}`;
        }
        break;
    }
    
    onUpdateRequest({
      ...currentRequest,
      headers: updatedHeaders
    });
  };

  const renderAuthForm = () => {
    switch (authType) {
      case 'bearer':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Bearer Token
              </label>
              <input
                type="password"
                value={authData.bearerToken}
                onChange={(e) => updateAuth('bearer', { bearerToken: e.target.value })}
                placeholder="Enter your bearer token"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be sent as: Authorization: Bearer &lt;token&gt;
              </p>
            </div>
          </div>
        );
      
      case 'basic':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Username
              </label>
              <input
                type="text"
                value={authData.basicUsername}
                onChange={(e) => updateAuth('basic', { basicUsername: e.target.value })}
                placeholder="Enter username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Password
              </label>
              <input
                type="password"
                value={authData.basicPassword}
                onChange={(e) => updateAuth('basic', { basicPassword: e.target.value })}
                placeholder="Enter password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be sent as: Authorization: Basic &lt;base64(username:password)&gt;
              </p>
            </div>
          </div>
        );
      
      case 'api-key':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Header Name
              </label>
              <input
                type="text"
                value={authData.apiKeyHeader}
                onChange={(e) => updateAuth('api-key', { apiKeyHeader: e.target.value })}
                placeholder="X-API-Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={authData.apiKey}
                onChange={(e) => updateAuth('api-key', { apiKey: e.target.value })}
                placeholder="Enter your API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be sent as: {authData.apiKeyHeader}: &lt;api-key&gt;
              </p>
            </div>
          </div>
        );
      
      case 'oauth2':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                OAuth 2.0 Access Token
              </label>
              <input
                type="password"
                value={authData.oauth2Token}
                onChange={(e) => updateAuth('oauth2', { oauth2Token: e.target.value })}
                placeholder="Enter your OAuth 2.0 access token"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be sent as: Authorization: Bearer &lt;token&gt;
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">OAuth 2.0 Flow</h4>
              <p className="text-sm text-blue-700 mb-3">
                Need to get an access token? Use the OAuth 2.0 flow:
              </p>
              <button className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                🔗 Start OAuth Flow
              </button>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔓</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Authentication</h3>
            <p className="text-gray-600">This request will be sent without authentication.</p>
          </div>
        );
    }
  };

  const hasSecurityRequirements = endpoint.security && endpoint.security.length > 0;

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Security Requirements */}
        {hasSecurityRequirements && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-900 mb-2">🔒 Security Requirements</h4>
            <p className="text-sm text-yellow-700 mb-2">
              This endpoint requires authentication:
            </p>
            <div className="flex flex-wrap gap-2">
              {endpoint.security?.map((security, index) => (
                <span key={index} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                  {security}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Auth Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Authentication Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'none', label: 'No Auth', icon: '🔓' },
              { value: 'bearer', label: 'Bearer Token', icon: '🎫' },
              { value: 'basic', label: 'Basic Auth', icon: '👤' },
              { value: 'api-key', label: 'API Key', icon: '🔑' },
              { value: 'oauth2', label: 'OAuth 2.0', icon: '🔐' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setAuthType(option.value as AuthType)}
                className={`p-3 text-left border rounded-lg transition-colors ${
                  authType === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{option.icon}</span>
                  <span className="font-medium">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Auth Form */}
        <div className="border-t border-gray-200 pt-6">
          {renderAuthForm()}
        </div>

        {/* Quick Actions */}
        {authType !== 'none' && (
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h4>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // Save auth to localStorage for reuse
                  localStorage.setItem('api-tester-auth', JSON.stringify({ authType, authData }));
                  alert('Authentication saved for future requests!');
                }}
                className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
              >
                💾 Save Auth
              </button>
              
              <button
                onClick={() => {
                  // Load auth from localStorage
                  const saved = localStorage.getItem('api-tester-auth');
                  if (saved) {
                    const { authType: savedType, authData: savedData } = JSON.parse(saved);
                    setAuthType(savedType);
                    setAuthData(savedData);
                    updateAuth(savedType, savedData);
                    alert('Authentication loaded!');
                  } else {
                    alert('No saved authentication found.');
                  }
                }}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                📁 Load Auth
              </button>
              
              <button
                onClick={() => {
                  setAuthType('none');
                  setAuthData({
                    bearerToken: '',
                    basicUsername: '',
                    basicPassword: '',
                    apiKey: '',
                    apiKeyHeader: 'X-API-Key',
                    oauth2Token: ''
                  });
                  updateAuth('none', {});
                }}
                className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                🗑️ Clear Auth
              </button>
            </div>
          </div>
        )}

        {/* Current Auth Preview */}
        {authType !== 'none' && (
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Authentication Preview</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700 font-mono">
                {Object.entries(currentRequest.headers || {})
                  .filter(([key]) => key.toLowerCase().includes('authorization') || key.toLowerCase().includes('api'))
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('\n') || 'No authentication headers set'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
