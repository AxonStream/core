'use client';

import { APIEndpoint, TestRequest, APIParameter } from '../../APITester';

interface ParametersTabProps {
  endpoint: APIEndpoint;
  currentRequest: Partial<TestRequest>;
  onUpdateRequest: (request: Partial<TestRequest>) => void;
}

export function ParametersTab({ endpoint, currentRequest, onUpdateRequest }: ParametersTabProps) {
  const updateParameter = (paramName: string, value: string) => {
    const updatedRequest = {
      ...currentRequest,
      parameters: {
        ...currentRequest.parameters,
        [paramName]: value
      }
    };
    onUpdateRequest(updatedRequest);
  };

  const renderParameterInput = (param: APIParameter) => {
    const value = currentRequest.parameters?.[param.name] || '';
    
    if (param.enum) {
      return (
        <select
          value={value}
          onChange={(e) => updateParameter(param.name, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select {param.name}</option>
          {param.enum.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }
    
    switch (param.type) {
      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => updateParameter(param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select value</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        );
      
      case 'integer':
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateParameter(param.name, e.target.value)}
            placeholder={`Enter ${param.name}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateParameter(param.name, e.target.value)}
            placeholder={`Enter ${param.name}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  const getParameterTypeColor = (paramIn: string) => {
    switch (paramIn) {
      case 'path': return 'bg-red-100 text-red-800';
      case 'query': return 'bg-blue-100 text-blue-800';
      case 'header': return 'bg-green-100 text-green-800';
      case 'cookie': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (endpoint.parameters.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Parameters Required</h3>
        <p className="text-gray-600">This endpoint doesn't require any parameters.</p>
      </div>
    );
  }

  // Group parameters by type
  const groupedParams = endpoint.parameters.reduce((groups, param) => {
    const paramType = param.in || 'unknown';
    if (!groups[paramType]) {
      groups[paramType] = [];
    }
    groups[paramType].push(param);
    return groups;
  }, {} as Record<string, APIParameter[]>);

  return (
    <div className="p-6">
      <div className="space-y-6">
        {Object.entries(groupedParams).map(([paramType, params]) => (
          <div key={paramType} className="space-y-4">
            {/* Parameter Type Header */}
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs font-medium rounded ${getParameterTypeColor(paramType)}`}>
                {paramType.toUpperCase()}
              </span>
              <h4 className="text-sm font-semibold text-gray-900">
                {paramType === 'path' && 'Path Parameters'}
                {paramType === 'query' && 'Query Parameters'}
                {paramType === 'header' && 'Header Parameters'}
                {paramType === 'cookie' && 'Cookie Parameters'}
              </h4>
              <span className="text-xs text-gray-500">({params.length})</span>
            </div>

            {/* Parameters */}
            <div className="space-y-4">
              {params.map((param) => (
                <div key={param.name} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <label className="text-sm font-medium text-gray-900">
                          {param.name}
                        </label>
                        {param.required && (
                          <span className="text-red-500 text-sm">*</span>
                        )}
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {param.type}
                        </span>
                      </div>
                      
                      {param.description && (
                        <p className="text-sm text-gray-600 mb-3">{param.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Input Field */}
                  <div className="mb-3">
                    {renderParameterInput(param)}
                  </div>

                  {/* Example */}
                  {param.example && (
                    <div className="text-xs text-gray-500">
                      <span className="font-medium">Example:</span> {JSON.stringify(param.example)}
                    </div>
                  )}

                  {/* Enum Values */}
                  {param.enum && (
                    <div className="text-xs text-gray-500 mt-2">
                      <span className="font-medium">Allowed values:</span> {param.enum.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Fill Actions */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h4>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              // Fill with example values
              const exampleParams: Record<string, any> = {};
              endpoint.parameters.forEach(param => {
                if (param.example) {
                  exampleParams[param.name] = param.example;
                }
              });
              onUpdateRequest({
                ...currentRequest,
                parameters: { ...currentRequest.parameters, ...exampleParams }
              });
            }}
            className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            ✨ Fill Examples
          </button>
          
          <button
            onClick={() => {
              // Clear all parameters
              onUpdateRequest({
                ...currentRequest,
                parameters: {}
              });
            }}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            🗑️ Clear All
          </button>
          
          <button
            onClick={() => {
              // Fill required only
              const requiredParams: Record<string, any> = {};
              endpoint.parameters.forEach(param => {
                if (param.required && param.example) {
                  requiredParams[param.name] = param.example;
                }
              });
              onUpdateRequest({
                ...currentRequest,
                parameters: { ...currentRequest.parameters, ...requiredParams }
              });
            }}
            className="px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
          >
            ⚡ Required Only
          </button>
        </div>
      </div>
    </div>
  );
}
