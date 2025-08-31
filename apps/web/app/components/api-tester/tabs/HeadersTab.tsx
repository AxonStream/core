'use client';

import { useState } from 'react';
import { TestRequest } from '../../APITester';

interface HeadersTabProps {
  currentRequest: Partial<TestRequest>;
  onUpdateRequest: (request: Partial<TestRequest>) => void;
}

interface HeaderItem {
  key: string;
  value: string;
  enabled: boolean;
}

export function HeadersTab({ currentRequest, onUpdateRequest }: HeadersTabProps) {
  const [headers, setHeaders] = useState<HeaderItem[]>(() => {
    const requestHeaders = currentRequest.headers || {};
    const headerItems = Object.entries(requestHeaders).map(([key, value]) => ({
      key,
      value,
      enabled: true
    }));
    
    // Always have at least one empty row
    if (headerItems.length === 0) {
      headerItems.push({ key: '', value: '', enabled: true });
    }
    
    return headerItems;
  });

  const updateHeaders = (newHeaders: HeaderItem[]) => {
    setHeaders(newHeaders);
    
    // Convert to request headers format
    const requestHeaders: Record<string, string> = {};
    newHeaders.forEach(header => {
      if (header.key && header.value && header.enabled) {
        requestHeaders[header.key] = header.value;
      }
    });
    
    onUpdateRequest({
      ...currentRequest,
      headers: requestHeaders
    });
  };

  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newHeaders = [...headers];
    const currentHeader = newHeaders[index];
    if (currentHeader) {
      newHeaders[index] = { ...currentHeader, [field]: value };
      
      // Add new empty row if this is the last row and it has content
      if (index === headers.length - 1 && newHeaders[index]?.key && newHeaders[index]?.value) {
        newHeaders.push({ key: '', value: '', enabled: true });
      }
    }
    
    updateHeaders(newHeaders);
  };

  const removeHeader = (index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    
    // Ensure at least one empty row
    if (newHeaders.length === 0) {
      newHeaders.push({ key: '', value: '', enabled: true });
    }
    
    updateHeaders(newHeaders);
  };

  const addPresetHeader = (key: string, value: string) => {
    const newHeaders = [...headers];
    const emptyIndex = newHeaders.findIndex(h => !h.key && !h.value);
    
    if (emptyIndex >= 0) {
      newHeaders[emptyIndex] = { key, value, enabled: true };
    } else {
      newHeaders.push({ key, value, enabled: true });
    }
    
    // Add new empty row
    newHeaders.push({ key: '', value: '', enabled: true });
    
    updateHeaders(newHeaders);
  };

  const presetHeaders = [
    { key: 'Content-Type', value: 'application/json', label: 'JSON Content' },
    { key: 'Accept', value: 'application/json', label: 'Accept JSON' },
    { key: 'User-Agent', value: 'AxonStream API Tester/1.0', label: 'User Agent' },
    { key: 'Authorization', value: 'Bearer ', label: 'Bearer Token' },
    { key: 'X-API-Key', value: '', label: 'API Key' },
    { key: 'Cache-Control', value: 'no-cache', label: 'No Cache' }
  ];

  const clearAllHeaders = () => {
    updateHeaders([{ key: '', value: '', enabled: true }]);
  };

  const enabledHeadersCount = headers.filter(h => h.key && h.value && h.enabled).length;

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Headers List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Request Headers</h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                {enabledHeadersCount} header{enabledHeadersCount !== 1 ? 's' : ''} enabled
              </span>
              <button
                onClick={clearAllHeaders}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {headers.map((header, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                {/* Enable/Disable Checkbox */}
                <input
                  type="checkbox"
                  checked={header.enabled}
                  onChange={(e) => updateHeader(index, 'enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />

                {/* Header Key */}
                <input
                  type="text"
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* Header Value */}
                <input
                  type="text"
                  placeholder="Header value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* Remove Button */}
                <button
                  onClick={() => removeHeader(index)}
                  disabled={headers.length === 1}
                  className="p-2 text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Preset Headers */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Common Headers</h4>
          <div className="grid grid-cols-2 gap-2">
            {presetHeaders.map((preset) => (
              <button
                key={preset.key}
                onClick={() => addPresetHeader(preset.key, preset.value)}
                className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">{preset.label}</div>
                <div className="text-xs text-gray-500 font-mono">
                  {preset.key}: {preset.value || '<value>'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Bulk Actions</h4>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                // Import from cURL
                const curlInput = prompt('Paste cURL command:');
                if (curlInput) {
                  // Simple cURL header parsing (basic implementation)
                  const headerMatches = curlInput.match(/-H\s+['"]([^:]+):\s*([^'"]+)['"]/g);
                  if (headerMatches) {
                    const newHeaders = headerMatches.map(match => {
                      const [, key, value] = match.match(/-H\s+['"]([^:]+):\s*([^'"]+)['"]/) || [];
                      return { key: key || '', value: value || '', enabled: true };
                    });
                    newHeaders.push({ key: '', value: '', enabled: true });
                    updateHeaders(newHeaders);
                  }
                }
              }}
              className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              📋 Import from cURL
            </button>
            
            <button
              onClick={() => {
                // Export headers as JSON
                const exportHeaders = headers
                  .filter(h => h.key && h.value && h.enabled)
                  .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
                
                navigator.clipboard.writeText(JSON.stringify(exportHeaders, null, 2));
                alert('Headers copied to clipboard!');
              }}
              className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              📤 Export JSON
            </button>
            
            <button
              onClick={() => {
                // Toggle all headers
                const allEnabled = headers.every(h => h.enabled || (!h.key && !h.value));
                const newHeaders = headers.map(h => ({ ...h, enabled: !allEnabled }));
                updateHeaders(newHeaders);
              }}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              🔄 Toggle All
            </button>
          </div>
        </div>

        {/* Headers Preview */}
        {enabledHeadersCount > 0 && (
          <div className="pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Headers Preview</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700 font-mono">
                {headers
                  .filter(h => h.key && h.value && h.enabled)
                  .map(h => `${h.key}: ${h.value}`)
                  .join('\n')}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
