import { Navigation, MainContent } from '../../components/navigation';
import { CheckCircle, Copy, ExternalLink, Play, Terminal, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Quick Start Guide',
  description: 'Get started with the AxonPuls Platform in minutes. Complete setup guide for developers.',
};

export default function QuickStartPage() {
  return (
    <>
      <Navigation />
      <MainContent>
        <div className="bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24"></div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header */}
            <div className="mb-12">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
                <Zap className="w-4 h-4 text-green-400 mr-2" />
                <span className="text-sm text-green-300 font-medium">Quick Start Guide</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Get Started with AxonPuls Platform
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Get up and running with the AxonPuls Real-Time Platform in minutes. This guide covers everything you need to start building with our enterprise-grade APIs.
              </p>
            </div>

            {/* Prerequisites */}
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <CheckCircle className="w-6 h-6 text-green-400 mr-3" />
                Prerequisites
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Required</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                      Node.js 18+ installed
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                      PostgreSQL database
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                      Redis server
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                      Basic TypeScript knowledge
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Recommended</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                      Docker & Docker Compose
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                      REST API experience
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                      WebSocket familiarity
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                      Git version control
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 1: Installation */}
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">1</div>
                Installation & Setup
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Clone the Repository</h3>
                  <div className="bg-gray-800 rounded-lg p-4 relative group">
                    <code className="text-green-400 font-mono text-sm">
                      git clone https://github.com/your-org/AxonPuls-platform.git<br />
                      cd AxonPuls-platform
                    </code>
                    <button className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Install Dependencies</h3>
                  <div className="bg-gray-800 rounded-lg p-4 relative group">
                    <code className="text-green-400 font-mono text-sm">
                      npm install<br />
                      # or<br />
                      yarn install
                    </code>
                    <button className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Environment Configuration</h3>
                  <div className="bg-gray-800 rounded-lg p-4 relative group">
                    <code className="text-green-400 font-mono text-sm">
                      cp apps/api/.env.example apps/api/.env<br />
                      # Edit the .env file with your database credentials
                    </code>
                    <button className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Database Setup */}
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">2</div>
                Database Setup
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Run Database Migrations</h3>
                  <div className="bg-gray-800 rounded-lg p-4 relative group">
                    <code className="text-green-400 font-mono text-sm">
                      cd apps/api<br />
                      npx prisma migrate dev<br />
                      npx prisma generate
                    </code>
                    <button className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Seed Database (Optional)</h3>
                  <div className="bg-gray-800 rounded-lg p-4 relative group">
                    <code className="text-green-400 font-mono text-sm">
                      npx prisma db seed
                    </code>
                    <button className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Start the Platform */}
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">3</div>
                Start the Platform
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Development Mode</h3>
                  <div className="bg-gray-800 rounded-lg p-4 relative group">
                    <code className="text-green-400 font-mono text-sm">
                      # Start the API server<br />
                      npm run dev --workspace=api<br /><br />
                      # Start the documentation (in another terminal)<br />
                      npm run dev --workspace=docs
                    </code>
                    <button className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                  <h4 className="text-blue-300 font-semibold mb-2">🚀 Platform URLs</h4>
                  <ul className="space-y-1 text-sm text-gray-300">
                    <li>• API Server: <code className="text-blue-400">http://localhost:3001</code></li>
                    <li>• Swagger Docs: <code className="text-blue-400">http://localhost:3001/api/docs</code></li>
                    <li>• Documentation: <code className="text-blue-400">http://localhost:3002</code></li>
                    <li>• WebSocket: <code className="text-blue-400">ws://localhost:3001</code></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 4: First API Call */}
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">4</div>
                Make Your First API Call
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Test the API Status</h3>
                  <div className="bg-gray-800 rounded-lg p-4 relative group">
                    <code className="text-green-400 font-mono text-sm">
                      curl http://localhost:3001/api/v1/status
                    </code>
                    <button className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Expected Response</h3>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <code className="text-blue-400 font-mono text-sm">
                      {`{
  "status": "ok",
  "timestamp": "2025-08-06T01:30:00Z",
  "version": "1.0.0",
  "environment": "development"
}`}
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-gray-700 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">🎉 You&apos;re All Set!</h2>
              <p className="text-gray-300 mb-6">
                Congratulations! You now have the AxonPuls Platform running locally. Here&apos;s what you can do next:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link href="/api-docs" className="group flex items-center p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-blue-500 transition-colors">
                  <Terminal className="w-8 h-8 text-blue-400 mr-4" />
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-blue-400 transition-colors">Explore API Documentation</h3>
                    <p className="text-gray-400 text-sm">Complete API reference and examples</p>
                  </div>
                </Link>

                <Link href="/testing" className="group flex items-center p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-purple-500 transition-colors">
                  <Play className="w-8 h-8 text-purple-400 mr-4" />
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-purple-400 transition-colors">Try the Testing Interface</h3>
                    <p className="text-gray-400 text-sm">Interactive WebSocket and API testing</p>
                  </div>
                </Link>

                <a href="http://localhost:3001/api/docs" target="_blank" rel="noopener noreferrer" className="group flex items-center p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-green-500 transition-colors">
                  <ExternalLink className="w-8 h-8 text-green-400 mr-4" />
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-green-400 transition-colors">Open Swagger UI</h3>
                    <p className="text-gray-400 text-sm">Interactive API documentation</p>
                  </div>
                </a>

                <Link href="/implementation-status" className="group flex items-center p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-orange-500 transition-colors">
                  <CheckCircle className="w-8 h-8 text-orange-400 mr-4" />
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-orange-400 transition-colors">Check Implementation Status</h3>
                    <p className="text-gray-400 text-sm">See what&apos;s built and what&apos;s coming</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MainContent>
    </>
  );
}
