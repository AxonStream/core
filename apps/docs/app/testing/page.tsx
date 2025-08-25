'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

export default function TestingPage() {
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<Array<{type: 'sent' | 'received' | 'system', content: string, timestamp: Date}>>([]);
  const [messageInput, setMessageInput] = useState('');
  const [apiResponse, setApiResponse] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/v1/auth/profile');
  const wsRef = useRef<WebSocket | null>(null);

  const addMessage = (type: 'sent' | 'received' | 'system', content: string) => {
    setMessages(prev => [...prev, { type, content, timestamp: new Date() }]);
  };

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setWsStatus('connecting');
    addMessage('system', 'Connecting to WebSocket...');
    
    try {
      wsRef.current = new WebSocket('ws://localhost:3001');
      
      wsRef.current.onopen = () => {
        setWsStatus('connected');
        addMessage('system', 'WebSocket connected successfully');
      };
      
      wsRef.current.onmessage = (event) => {
        addMessage('received', event.data);
      };
      
      wsRef.current.onclose = () => {
        setWsStatus('disconnected');
        addMessage('system', 'WebSocket disconnected');
      };
      
      wsRef.current.onerror = () => {
        setWsStatus('error');
        addMessage('system', 'WebSocket connection error');
      };
    } catch (error) {
      setWsStatus('error');
      addMessage('system', `Connection failed: ${error}`);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendMessage = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && messageInput.trim()) {
      wsRef.current.send(messageInput);
      addMessage('sent', messageInput);
      setMessageInput('');
    }
  };

  const testApiEndpoint = async () => {
    try {
      const response = await fetch(`http://localhost:3001${selectedEndpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.text();
      setApiResponse(`Status: ${response.status}\n\n${data}`);
    } catch (error) {
      setApiResponse(`Error: ${error}`);
    }
  };

  const sendPredefinedMessage = (message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
      addMessage('sent', message);
    }
  };

  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  AxonPuls Platform
                </h1>
              </Link>
              <div className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-4">
                  <Link href="/" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    Overview
                  </Link>
                  <Link href="/implementation-status" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    Implementation Status
                  </Link>
                  <Link href="/api-docs" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    API Documentation
                  </Link>
                  <Link href="/testing" className="text-white bg-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                    Testing Interface
                  </Link>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                wsStatus === 'connected' ? 'bg-green-500' : 
                wsStatus === 'connecting' ? 'bg-yellow-500' : 
                wsStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
              }`}></div>
              <span className="text-sm text-gray-300">
                {wsStatus === 'connected' ? 'Connected' : 
                 wsStatus === 'connecting' ? 'Connecting' : 
                 wsStatus === 'error' ? 'Error' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Testing Interface</h1>
          <p className="text-xl text-gray-300">
            Advanced testing UI for WebSocket connections, event streaming, and API endpoint validation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* WebSocket Testing */}
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-6">🔌 WebSocket Testing</h2>
            
            {/* Connection Controls */}
            <div className="mb-6">
              <div className="flex space-x-4 mb-4">
                <button
                  onClick={connectWebSocket}
                  disabled={wsStatus === 'connected' || wsStatus === 'connecting'}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Connect
                </button>
                <button
                  onClick={disconnectWebSocket}
                  disabled={wsStatus === 'disconnected'}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Disconnect
                </button>
              </div>
              <p className="text-sm text-gray-400">
                WebSocket URL: ws://localhost:3001
              </p>
            </div>

            {/* Predefined Messages */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => sendPredefinedMessage(JSON.stringify({
                    type: "subscribe",
                    channel: "agent_events",
                    metadata: { organizationId: "test_org" }
                  }, null, 2))}
                  disabled={wsStatus !== 'connected'}
                  className="text-left px-3 py-2 bg-blue-900/50 border border-blue-800 rounded text-sm hover:bg-blue-900/70 disabled:opacity-50"
                >
                  Subscribe to agent_events
                </button>
                <button
                  onClick={() => sendPredefinedMessage(JSON.stringify({
                    type: "publish",
                    channel: "agent_events",
                    payload: { eventType: "test_event", timestamp: new Date().toISOString() }
                  }, null, 2))}
                  disabled={wsStatus !== 'connected'}
                  className="text-left px-3 py-2 bg-purple-900/50 border border-purple-800 rounded text-sm hover:bg-purple-900/70 disabled:opacity-50"
                >
                  Publish test event
                </button>
                <button
                  onClick={() => sendPredefinedMessage(JSON.stringify({ type: "ping" }))}
                  disabled={wsStatus !== 'connected'}
                  className="text-left px-3 py-2 bg-green-900/50 border border-green-800 rounded text-sm hover:bg-green-900/70 disabled:opacity-50"
                >
                  Send ping
                </button>
              </div>
            </div>

            {/* Custom Message Input */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Custom Message</h3>
              <div className="flex space-x-2">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Enter JSON message..."
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 resize-none"
                  rows={3}
                />
                <button
                  onClick={sendMessage}
                  disabled={wsStatus !== 'connected' || !messageInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Message Log */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Message Log</h3>
              <div className="bg-gray-800 border border-gray-700 rounded p-4 h-64 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-sm">No messages yet. Connect to start testing.</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg, index) => (
                      <div key={index} className={`text-sm ${
                        msg.type === 'sent' ? 'text-blue-300' :
                        msg.type === 'received' ? 'text-green-300' :
                        'text-yellow-300'
                      }`}>
                        <span className="text-gray-400 text-xs">
                          [{msg.timestamp.toLocaleTimeString()}]
                        </span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          msg.type === 'sent' ? 'bg-blue-900/50' :
                          msg.type === 'received' ? 'bg-green-900/50' :
                          'bg-yellow-900/50'
                        }`}>
                          {msg.type.toUpperCase()}
                        </span>
                        <div className="mt-1 font-mono text-xs break-all">
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setMessages([])}
                className="mt-2 px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
              >
                Clear Log
              </button>
            </div>
          </div>

          {/* API Testing */}
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-6">🌐 API Testing</h2>
            
            {/* Endpoint Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Select Endpoint</h3>
              <select
                value={selectedEndpoint}
                onChange={(e) => setSelectedEndpoint(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              >
                <optgroup label="Authentication">
                  <option value="/api/v1/auth/profile">GET /api/v1/auth/profile</option>
                  <option value="/api/v1/auth/validate">GET /api/v1/auth/validate</option>
                </optgroup>
                <optgroup label="Monitoring">
                  <option value="/api/v1/monitoring/latency/stats">GET /api/v1/monitoring/latency/stats</option>
                  <option value="/api/v1/monitoring/latency/dashboard">GET /api/v1/monitoring/latency/dashboard</option>
                  <option value="/api/v1/monitoring/latency/health">GET /api/v1/monitoring/latency/health</option>
                </optgroup>
                <optgroup label="Audit">
                  <option value="/api/v1/audit/logs">GET /api/v1/audit/logs</option>
                  <option value="/api/v1/audit/summary">GET /api/v1/audit/summary</option>
                  <option value="/api/v1/audit/dashboard">GET /api/v1/audit/dashboard</option>
                </optgroup>
                <optgroup label="System">
                  <option value="/api/v1">GET /api/v1</option>
                  <option value="/api/v1/status">GET /api/v1/status</option>
                </optgroup>
              </select>
            </div>

            {/* Test Button */}
            <div className="mb-6">
              <button
                onClick={testApiEndpoint}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Test Endpoint
              </button>
            </div>

            {/* Response Display */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Response</h3>
              <div className="bg-gray-800 border border-gray-700 rounded p-4 h-64 overflow-y-auto">
                {apiResponse ? (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                    {apiResponse}
                  </pre>
                ) : (
                  <p className="text-gray-400 text-sm">No response yet. Test an endpoint to see results.</p>
                )}
              </div>
              <button
                onClick={() => setApiResponse('')}
                className="mt-2 px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
              >
                Clear Response
              </button>
            </div>

            {/* Quick Links */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">Quick Links</h3>
              <div className="space-y-2">
                <a
                  href="http://localhost:3001/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 bg-green-900/50 border border-green-800 rounded text-sm text-green-300 hover:bg-green-900/70"
                >
                  📚 Live Swagger Documentation
                </a>
                <a
                  href="http://localhost:3001/api/v1/status"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 bg-blue-900/50 border border-blue-800 rounded text-sm text-blue-300 hover:bg-blue-900/70"
                >
                  ⚡ API Status Check
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Info */}
        <div className="mt-8 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">🔧 Connection Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-gray-300 mb-2">Backend API</h3>
              <p className="text-gray-400">http://localhost:3001/api/v1</p>
              <p className="text-xs text-gray-500 mt-1">NestJS + Fastify backend</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-300 mb-2">WebSocket</h3>
              <p className="text-gray-400">ws://localhost:3001</p>
              <p className="text-xs text-gray-500 mt-1">Real-time event streaming</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-300 mb-2">Documentation</h3>
              <p className="text-gray-400">http://localhost:3001/api/docs</p>
              <p className="text-xs text-gray-500 mt-1">Interactive Swagger UI</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
