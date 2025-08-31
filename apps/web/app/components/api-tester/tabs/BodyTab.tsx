'use client';

import { useState } from 'react';
import { APIEndpoint, TestRequest } from '../../APITester';

interface BodyTabProps {
  endpoint: APIEndpoint;
  currentRequest: Partial<TestRequest>;
  onUpdateRequest: (request: Partial<TestRequest>) => void;
}

type ContentType = 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain' | 'application/xml';

export function BodyTab({ endpoint, currentRequest, onUpdateRequest }: BodyTabProps) {
  const [contentType, setContentType] = useState<ContentType>('application/json');
  const [bodyText, setBodyText] = useState(() => {
    if (currentRequest.body) {
      return typeof currentRequest.body === 'string' 
        ? currentRequest.body 
        : JSON.stringify(currentRequest.body, null, 2);
    }
    return endpoint.requestBody?.example 
      ? JSON.stringify(endpoint.requestBody.example, null, 2)
      : '';
  });

  const updateBody = (value: string) => {
    setBodyText(value);
    
    let parsedBody: any = value;
    
    // Try to parse JSON if content type is JSON
    if (contentType === 'application/json' && value.trim()) {
      try {
        parsedBody = JSON.parse(value);
      } catch (error) {
        // Keep as string if JSON parsing fails
        parsedBody = value;
      }
    }
    
    onUpdateRequest({
      ...currentRequest,
      body: parsedBody
    });
  };

  const formatJSON = () => {
    try {
      const parsed = JSON.parse(bodyText);
      const formatted = JSON.stringify(parsed, null, 2);
      setBodyText(formatted);
      updateBody(formatted);
    } catch (error) {
      alert('Invalid JSON format');
    }
  };

  const generateExample = () => {
    if (endpoint.requestBody?.example) {
      const exampleText = JSON.stringify(endpoint.requestBody.example, null, 2);
      setBodyText(exampleText);
      updateBody(exampleText);
    }
  };

  const generateFromSchema = () => {
    if (endpoint.requestBody?.schema) {
      const example = generateExampleFromSchema(endpoint.requestBody.schema);
      const exampleText = JSON.stringify(example, null, 2);
      setBodyText(exampleText);
      updateBody(exampleText);
    }
  };

  const generateExampleFromSchema = (schema: any): any => {
    if (!schema) return {};
    
    switch (schema.type) {
      case 'object':
        const obj: any = {};
        if (schema.properties) {
          for (const [key, prop] of Object.entries(schema.properties as any)) {
            obj[key] = generateExampleFromSchema(prop);
          }
        }
        return obj;
      
      case 'array':
        return schema.items ? [generateExampleFromSchema(schema.items)] : [];
      
      case 'string':
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'date') return '2025-08-31';
        if (schema.format === 'date-time') return '2025-08-31T07:00:00Z';
        if (schema.enum) return schema.enum[0];
        return schema.example || 'string';
      
      case 'number':
      case 'integer':
        return schema.example || 42;
      
      case 'boolean':
        return schema.example !== undefined ? schema.example : true;
      
      default:
        return schema.example || null;
    }
  };

  if (!endpoint.requestBody) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">📄</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Request Body</h3>
        <p className="text-gray-600">This endpoint doesn't require a request body.</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="space-y-6 flex-1">
        {/* Content Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Content-Type
          </label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ContentType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="application/json">application/json</option>
            <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
            <option value="multipart/form-data">multipart/form-data</option>
            <option value="text/plain">text/plain</option>
            <option value="application/xml">application/xml</option>
          </select>
        </div>

        {/* Body Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-900">
              Request Body
              {endpoint.requestBody.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            
            <div className="flex space-x-2">
              {contentType === 'application/json' && (
                <button
                  onClick={formatJSON}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  🎨 Format JSON
                </button>
              )}
              
              {endpoint.requestBody.example && (
                <button
                  onClick={generateExample}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  ✨ Use Example
                </button>
              )}
              
              {endpoint.requestBody.schema && (
                <button
                  onClick={generateFromSchema}
                  className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                >
                  🔧 Generate from Schema
                </button>
              )}
              
              <button
                onClick={() => {
                  setBodyText('');
                  updateBody('');
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                🗑️ Clear
              </button>
            </div>
          </div>

          <textarea
            value={bodyText}
            onChange={(e) => updateBody(e.target.value)}
            placeholder={`Enter ${contentType} body...`}
            className="flex-1 min-h-[300px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
          />
        </div>

        {/* Schema Information */}
        {endpoint.requestBody.schema && (
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Schema Information</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-xs text-gray-700 overflow-x-auto">
                {JSON.stringify(endpoint.requestBody.schema, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Body Size and Validation */}
        <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-200 pt-4">
          <div className="flex items-center space-x-4">
            <span>Size: {new Blob([bodyText]).size} bytes</span>
            <span>Lines: {bodyText.split('\n').length}</span>
            {contentType === 'application/json' && (
              <span className={`${isValidJSON(bodyText) ? 'text-green-600' : 'text-red-600'}`}>
                {isValidJSON(bodyText) ? '✓ Valid JSON' : '✗ Invalid JSON'}
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(bodyText);
                alert('Body copied to clipboard!');
              }}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              📋 Copy
            </button>
            
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.txt,.xml';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const content = e.target?.result as string;
                      setBodyText(content);
                      updateBody(content);
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              📁 Import File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function isValidJSON(str: string): boolean {
  if (!str.trim()) return true;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
