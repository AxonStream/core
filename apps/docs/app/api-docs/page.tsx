import Link from 'next/link';
import { Navigation, MainContent } from '../../components/navigation';
import { ExternalLink, Code, Database, Globe, Zap, Shield, Users, Activity } from 'lucide-react';

export default function ApiDocsPage() {
  return (
    <>
      <Navigation />
      <MainContent>
        <div className="bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            {/* Header */}
            <div className="mb-12">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                <Code className="w-4 h-4 text-blue-400 mr-2" />
                <span className="text-sm text-blue-300 font-medium">Professional API Documentation</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                API Reference
              </h1>
              <p className="text-xl text-gray-300 max-w-4xl mb-8">
                Complete API documentation for AxonStream Core. REST endpoints, WebSocket events, authentication, and SDK integration examples.
              </p>

              {/* API Status Badges */}
              <div className="flex flex-wrap gap-4 mb-8">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  API: http://localhost:3001/api/v1
                </div>
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                  WebSocket: ws://localhost:3001
                </div>
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>
                  SDK: @axonstream/core
                </div>
              </div>

              {/* Interactive Swagger Link */}
              <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Interactive API Documentation</h3>
                    <p className="text-gray-300">Explore endpoints, test requests, and view schemas in real-time</p>
                  </div>
                  <a
                    href="http://localhost:3001/api/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
                  >
                    Open Swagger UI
                    <ExternalLink className="ml-2 w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>

            {/* API Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">

              {/* Authentication */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-blue-500/50 hover:bg-gray-900/70 transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">Authentication</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  JWT-based authentication with RS256, multi-tenant claims, and role-based access control.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                    JWT RS256 tokens
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                    Multi-tenant isolation
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                    RBAC permissions
                  </div>
                </div>
              </div>

              {/* Real-time Events */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-green-500/50 hover:bg-gray-900/70 transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">Real-time Events</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  WebSocket-based real-time messaging with event streaming, subscriptions, and delivery guarantees.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    WebSocket connections
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    Event subscriptions
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    Message queuing
                  </div>
                </div>
              </div>

              {/* SDK Integration */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-purple-500/50 hover:bg-gray-900/70 transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Code className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">SDK Integration</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Seamless integration with @axonstream/core SDK for React, Vue, Angular, and vanilla JavaScript.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                    React hooks
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                    Vue composables
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                    Angular services
                  </div>
                </div>
              </div>

              {/* Monitoring */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-yellow-500/50 hover:bg-gray-900/70 transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">Monitoring</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Comprehensive monitoring, metrics, health checks, and performance analytics.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                    Health checks
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                    Performance metrics
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                    Audit logging
                  </div>
                </div>
              </div>

              {/* Multi-tenancy */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-orange-500/50 hover:bg-gray-900/70 transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">Multi-tenancy</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Enterprise-grade multi-tenant architecture with organization isolation and data security.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                    Organization isolation
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                    Data partitioning
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                    Tenant management
                  </div>
                </div>
              </div>

              {/* WebSocket Gateway */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-indigo-500/50 hover:bg-gray-900/70 transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">WebSocket Gateway</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  High-performance WebSocket gateway with connection management and real-time event routing.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
                    Connection pooling
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
                    Event routing
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
                    Auto-reconnection
                  </div>
                </div>
              </div>

            </div>

            {/* SDK Integration Examples */}
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-white mb-8">SDK Integration Examples</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* REST API Example */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Database className="w-5 h-5 text-blue-400 mr-2" />
                    REST API Integration
                  </h3>
                  <div className="bg-gray-950 rounded-lg p-4 mb-4">
                    <code className="text-sm text-gray-300 font-mono">
                      <span className="text-purple-400">import</span> <span className="text-blue-400">{'{ AxonStream }'}</span> <span className="text-purple-400">from</span> <span className="text-green-400">'@axonstream/core'</span>;<br /><br />
                      <span className="text-purple-400">const</span> <span className="text-blue-400">axon</span> = <span className="text-purple-400">new</span> <span className="text-yellow-400">AxonStream</span>({'{'}<br />
                      &nbsp;&nbsp;apiUrl: <span className="text-green-400">'http://localhost:3001/api/v1'</span>,<br />
                      &nbsp;&nbsp;token: <span className="text-green-400">'your-jwt-token'</span><br />
                      {'}'});<br /><br />
                      <span className="text-blue-400">// Send event</span><br />
                      <span className="text-purple-400">await</span> <span className="text-blue-400">axon</span>.<span className="text-yellow-400">events</span>.<span className="text-yellow-400">publish</span>(<span className="text-green-400">'chat:message'</span>, {'{'}<br />
                      &nbsp;&nbsp;text: <span className="text-green-400">'Hello, world!'</span>,<br />
                      &nbsp;&nbsp;userId: <span className="text-green-400">'user-123'</span><br />
                      {'}'});
                    </code>
                  </div>
                </div>

                {/* WebSocket Example */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Globe className="w-5 h-5 text-green-400 mr-2" />
                    WebSocket Integration
                  </h3>
                  <div className="bg-gray-950 rounded-lg p-4 mb-4">
                    <code className="text-sm text-gray-300 font-mono">
                      <span className="text-purple-400">import</span> <span className="text-blue-400">{'{ useAxonpuls }'}</span> <span className="text-purple-400">from</span> <span className="text-green-400">'@axonstream/core/react'</span>;<br /><br />
                      <span className="text-purple-400">function</span> <span className="text-yellow-400">ChatApp</span>() {'{'}<br />
                      &nbsp;&nbsp;<span className="text-purple-400">const</span> <span className="text-blue-400">axon</span> = <span className="text-yellow-400">useAxonpuls</span>({'{'}<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;wsUrl: <span className="text-green-400">'ws://localhost:3001'</span>,<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;token: <span className="text-green-400">'your-jwt-token'</span><br />
                      &nbsp;&nbsp;{'}'});<br /><br />
                      &nbsp;&nbsp;<span className="text-blue-400">// Subscribe to events</span><br />
                      &nbsp;&nbsp;<span className="text-blue-400">axon</span>.<span className="text-yellow-400">subscribe</span>(<span className="text-green-400">'chat:message'</span>, (message) =&gt; {'{'}<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;console.<span className="text-yellow-400">log</span>(<span className="text-green-400">'New message:'</span>, message);<br />
                      &nbsp;&nbsp;{'}'});<br />
                      {'}'}
                    </code>
                  </div>
                </div>

              </div>
            </div>

            {/* API Endpoints Overview */}
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-white mb-8">API Endpoints Overview</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Authentication Endpoints */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">🔐 Authentication</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">POST</span>
                      <span className="text-blue-400">/auth/login</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">POST</span>
                      <span className="text-blue-400">/auth/refresh</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">POST</span>
                      <span className="text-blue-400">/auth/logout</span>
                    </div>
                  </div>
                </div>

                {/* Events Endpoints */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">📡 Events</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">POST</span>
                      <span className="text-green-400">/events/publish</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-green-400">/events/history</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-green-400">/events/replay</span>
                    </div>
                  </div>
                </div>

                {/* Subscriptions Endpoints */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">📋 Subscriptions</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">POST</span>
                      <span className="text-purple-400">/subscriptions/create</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">DELETE</span>
                      <span className="text-purple-400">/subscriptions/delete</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-purple-400">/subscriptions/list</span>
                    </div>
                  </div>
                </div>

                {/* Monitoring Endpoints */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">📊 Monitoring</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-yellow-400">/health</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-yellow-400">/metrics</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-yellow-400">/status</span>
                    </div>
                  </div>
                </div>

                {/* WebSocket Events */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">🔌 WebSocket</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Event</span>
                      <span className="text-indigo-400">connect</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Event</span>
                      <span className="text-indigo-400">disconnect</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Event</span>
                      <span className="text-indigo-400">message</span>
                    </div>
                  </div>
                </div>

                {/* Audit Endpoints */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">📝 Audit</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-red-400">/audit/logs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-red-400">/audit/events</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GET</span>
                      <span className="text-red-400">/audit/users</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-6">Ready to Integrate?</h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Start building with AxonStream Core today. Professional API documentation, comprehensive SDK, and enterprise-grade features.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="http://localhost:3001/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-xl hover:shadow-blue-500/25"
                >
                  Open Swagger UI
                  <ExternalLink className="ml-2 w-5 h-5" />
                </a>
                <Link
                  href="/quick-start"
                  className="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-gray-300 bg-gray-800/50 border border-gray-600 hover:bg-gray-700/50 hover:border-gray-500 hover:text-white transition-all duration-200"
                >
                  Get Started
                </Link>
              </div>
            </div>

          </div>
        </div>
      </MainContent>
    </>
  );
}
