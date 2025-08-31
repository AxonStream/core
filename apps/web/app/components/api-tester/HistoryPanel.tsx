'use client';

import { useState } from 'react';
import { TestRequest, TestResponse } from '../APITester';

interface HistoryPanelProps {
  history: Array<{ request: TestRequest; response: TestResponse }>;
  onClearHistory: () => void;
  onSelectHistoryItem: (item: { request: TestRequest; response: TestResponse }) => void;
}

export function HistoryPanel({ history, onClearHistory, onSelectHistoryItem }: HistoryPanelProps) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  const filteredHistory = history.filter(item => {
    const matchesText = 
      item.request.endpoint.summary.toLowerCase().includes(filter.toLowerCase()) ||
      item.request.endpoint.path.toLowerCase().includes(filter.toLowerCase()) ||
      item.request.endpoint.method.toLowerCase().includes(filter.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'success' && item.response.status >= 200 && item.response.status < 400) ||
      (statusFilter === 'error' && item.response.status >= 400);
    
    return matchesText && matchesStatus;
  });

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-800';
      case 'POST': return 'bg-blue-100 text-blue-800';
      case 'PUT': return 'bg-yellow-100 text-yellow-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'PATCH': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-blue-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    if (status >= 500) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const exportHistory = () => {
    const exportData = {
      exported: new Date().toISOString(),
      requests: history.map(item => ({
        request: {
          method: item.request.endpoint.method,
          url: item.request.endpoint.path,
          headers: item.request.headers,
          body: item.request.body,
          timestamp: item.request.timestamp
        },
        response: {
          status: item.response.status,
          statusText: item.response.statusText,
          headers: item.response.headers,
          data: item.response.data,
          duration: item.response.duration,
          timestamp: item.response.timestamp
        }
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (history.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Request History</h3>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No History Yet</h3>
            <p className="text-gray-600">Send some requests to see them here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Request History ({history.length})
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={exportHistory}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              💾 Export
            </button>
            <button
              onClick={onClearHistory}
              className="text-red-600 hover:text-red-700 text-sm"
            >
              🗑️ Clear
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="🔍 Search history..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">All Responses</option>
            <option value="success">Success (2xx-3xx)</option>
            <option value="error">Error (4xx-5xx)</option>
          </select>
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-gray-500">No requests match your filter.</div>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredHistory.slice().reverse().map((item, index) => (
              <button
                key={item.request.id}
                onClick={() => onSelectHistoryItem(item)}
                className="w-full p-3 text-left hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  {/* Method Badge */}
                  <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${getMethodColor(item.request.endpoint.method)}`}>
                    {item.request.endpoint.method}
                  </span>

                  {/* Request Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {item.request.endpoint.summary}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {item.request.endpoint.path}
                    </div>
                    
                    {/* Response Info */}
                    <div className="flex items-center space-x-3 mt-1">
                      <span className={`text-xs font-medium ${getStatusColor(item.response.status)}`}>
                        {item.response.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.response.duration}ms
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(item.response.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex-shrink-0">
                    {item.response.status >= 200 && item.response.status < 400 ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Total Requests:</span>
            <span>{history.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Success Rate:</span>
            <span>
              {history.length > 0 
                ? Math.round((history.filter(h => h.response.status >= 200 && h.response.status < 400).length / history.length) * 100)
                : 0}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>Avg Response Time:</span>
            <span>
              {history.length > 0 
                ? Math.round(history.reduce((sum, h) => sum + h.response.duration, 0) / history.length)
                : 0}ms
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
