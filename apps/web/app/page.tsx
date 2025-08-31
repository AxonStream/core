import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            🚀 AxonStream Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Modern real-time communication platform with powerful API testing tools
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* API Tester */}
          <Link href="/api-tester" className="group">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-200 group-hover:border-blue-300">
              <div className="text-4xl mb-4">🧪</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">API Tester</h3>
              <p className="text-gray-600 mb-4">
                Modern API testing tool with auto-discovery, smart forms, and real-time testing. Better than Postman!
              </p>
              <div className="flex items-center text-blue-600 font-medium">
                Launch API Tester
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

          {/* Real-time Dashboard */}
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-200">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Monitoring Dashboard</h3>
            <p className="text-gray-600 mb-4">
              Real-time monitoring and analytics for your APIs and WebSocket connections.
            </p>
            <div className="flex items-center text-gray-400 font-medium">
              Coming Soon
            </div>
          </div>

          {/* WebSocket Playground */}
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-200">
            <div className="text-4xl mb-4">🔌</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">WebSocket Playground</h3>
            <p className="text-gray-600 mb-4">
              Test and debug WebSocket connections with real-time message inspection.
            </p>
            <div className="flex items-center text-gray-400 font-medium">
              Coming Soon
            </div>
          </div>

          {/* Documentation */}
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-200">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">API Documentation</h3>
            <p className="text-gray-600 mb-4">
              Interactive API documentation with live examples and code snippets.
            </p>
            <div className="flex items-center text-gray-400 font-medium">
              Coming Soon
            </div>
          </div>

          {/* SDK Playground */}
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-200">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">SDK Playground</h3>
            <p className="text-gray-600 mb-4">
              Test and experiment with AxonStream SDKs for React, Vue, and Angular.
            </p>
            <div className="flex items-center text-gray-400 font-medium">
              Coming Soon
            </div>
          </div>

          {/* Performance Analytics */}
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-200">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Performance Analytics</h3>
            <p className="text-gray-600 mb-4">
              Deep insights into API performance, latency, and usage patterns.
            </p>
            <div className="flex items-center text-gray-400 font-medium">
              Coming Soon
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Why Choose AxonStream?</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl mb-4">🔄</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Auto-Discovery</h4>
              <p className="text-gray-600">Automatically detects and loads API endpoints from your backend</p>
            </div>

            <div className="text-center">
              <div className="text-3xl mb-4">🎨</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Smart Forms</h4>
              <p className="text-gray-600">Generates intelligent forms based on API schemas and validation</p>
            </div>

            <div className="text-center">
              <div className="text-3xl mb-4">⚡</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Real-time Testing</h4>
              <p className="text-gray-600">Instant API testing with beautiful response visualization</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
