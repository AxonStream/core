'use client';

import { useState } from 'react';
import { APIEndpoint } from '../APITester';

interface EndpointsListProps {
  endpoints: APIEndpoint[];
  selectedEndpoint: APIEndpoint | null;
  onSelectEndpoint: (endpoint: APIEndpoint) => void;
}

export function EndpointsList({ endpoints, selectedEndpoint, onSelectEndpoint }: EndpointsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Authentication', 'Monitoring', 'Channels']));

  // Filter endpoints based on search term
  const filteredEndpoints = endpoints.filter(endpoint =>
    endpoint.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
    endpoint.method.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group endpoints by tags
  const groupedEndpoints = filteredEndpoints.reduce((groups, endpoint) => {
    const tag = endpoint.tags[0] || 'General';
    if (!groups[tag]) {
      groups[tag] = [];
    }
    groups[tag].push(endpoint);
    return groups;
  }, {} as Record<string, APIEndpoint[]>);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

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

  if (endpoints.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No APIs Discovered</h3>
          <p className="text-gray-600 mb-4">
            Click "Discover APIs" to auto-detect endpoints or add them manually.
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            ➕ Add Endpoint
          </button>
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
            API Endpoints ({endpoints.length})
          </h3>
          <button className="text-blue-600 hover:text-blue-700 text-sm">
            ➕ Add
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search endpoints..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Endpoints List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedEndpoints).map(([groupName, groupEndpoints]) => (
          <div key={groupName} className="border-b border-gray-100">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(groupName)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
            >
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-900">{groupName}</span>
                <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {groupEndpoints.length}
                </span>
              </div>
              <span className="text-gray-400">
                {expandedGroups.has(groupName) ? '▼' : '▶'}
              </span>
            </button>

            {/* Group Items */}
            {expandedGroups.has(groupName) && (
              <div className="pb-2">
                {groupEndpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    onClick={() => onSelectEndpoint(endpoint)}
                    className={`w-full px-4 py-3 flex items-start space-x-3 hover:bg-gray-50 text-left border-l-4 ${
                      selectedEndpoint?.id === endpoint.id
                        ? 'bg-blue-50 border-blue-500'
                        : 'border-transparent'
                    }`}
                  >
                    {/* Method Badge */}
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getMethodColor(endpoint.method)}`}>
                      {endpoint.method}
                    </span>

                    {/* Endpoint Details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {endpoint.summary}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {endpoint.path}
                      </div>
                      {endpoint.description && (
                        <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {endpoint.description}
                        </div>
                      )}
                    </div>

                    {/* Security Indicator */}
                    {endpoint.security && endpoint.security.length > 0 && (
                      <div className="flex-shrink-0">
                        <span className="text-yellow-500" title="Requires Authentication">
                          🔒
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center">
          {filteredEndpoints.length} of {endpoints.length} endpoints
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      </div>
    </div>
  );
}
