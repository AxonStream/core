'use client';

import { useState } from 'react';
import { TestResponse } from '../APITester';

interface ResponseViewerProps {
  response: TestResponse;
}

type ResponseTab = 'body' | 'headers' | 'cookies' | 'timeline';

export function ResponseViewer({ response }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-50 border-green-200';
    if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (status >= 400 && status < 500) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (status >= 500) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatResponseBody = (data: any) => {
    if (typeof data === 'string') {
      try {
        // Try to parse and format JSON
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const downloadResponse = () => {
    const blob = new Blob([formatResponseBody(response.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${response.requestId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Response Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Status */}
            <div className={`px-3 py-1 rounded-lg border font-medium ${getStatusColor(response.status)}`}>
              {response.status} {response.statusText}
            </div>

            {/* Metrics */}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <span>⏱️</span>
                <span>{response.duration}ms</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>📦</span>
                <span>{formatBytes(response.size)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>🕒</span>
                <span>{new Date(response.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-2">
            <button
              onClick={() => copyToClipboard(formatResponseBody(response.data))}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              📋 Copy
            </button>
            <button
              onClick={downloadResponse}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              💾 Download
            </button>
          </div>
        </div>
      </div>

      {/* Response Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'body', label: 'Response Body', count: response.data ? 1 : 0 },
            { id: 'headers', label: 'Headers', count: Object.keys(response.headers).length },
            { id: 'cookies', label: 'Cookies', count: 0 },
            { id: 'timeline', label: 'Timeline', count: 1 }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ResponseTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'body' && (
          <div className="h-full p-6">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Response Body</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      try {
                        const formatted = JSON.stringify(JSON.parse(formatResponseBody(response.data)), null, 2);
                        copyToClipboard(formatted);
                      } catch {
                        copyToClipboard(formatResponseBody(response.data));
                      }
                    }}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    🎨 Format & Copy
                  </button>
                </div>
              </div>
              
              <div className="flex-1 bg-gray-50 rounded-lg p-4 overflow-auto">
                <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap">
                  {formatResponseBody(response.data)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="h-full p-6">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Response Headers</h3>
                <button
                  onClick={() => {
                    const headersText = Object.entries(response.headers)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join('\n');
                    copyToClipboard(headersText);
                  }}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  📋 Copy All
                </button>
              </div>
              
              <div className="flex-1 overflow-auto">
                <div className="space-y-2">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 font-medium text-gray-900 min-w-0">
                        {key}:
                      </div>
                      <div className="flex-1 text-gray-700 font-mono text-sm break-all">
                        {value}
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${key}: ${value}`)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                      >
                        📋
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cookies' && (
          <div className="h-full p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">🍪</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Cookies</h3>
              <p className="text-gray-600">No cookies were set in this response.</p>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="h-full p-6">
            <div className="h-full flex flex-col">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Timeline</h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Request Sent</div>
                    <div className="text-sm text-gray-600">
                      {new Date(response.timestamp - response.duration).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Response Received</div>
                    <div className="text-sm text-gray-600">
                      {new Date(response.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-700">
                    +{response.duration}ms
                  </div>
                </div>
              </div>

              {/* Performance Breakdown */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance Metrics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">Total Time</div>
                    <div className="text-lg font-semibold text-gray-900">{response.duration}ms</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">Response Size</div>
                    <div className="text-lg font-semibold text-gray-900">{formatBytes(response.size)}</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">Status Code</div>
                    <div className="text-lg font-semibold text-gray-900">{response.status}</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">Headers Count</div>
                    <div className="text-lg font-semibold text-gray-900">{Object.keys(response.headers).length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
