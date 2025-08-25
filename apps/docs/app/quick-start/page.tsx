import { Navigation, MainContent } from '../../components/navigation';
import { CheckCircle, Copy, ExternalLink, Play, Terminal, Zap, Package, Code, Layers, Rocket } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Quick Start Guide - @axonstream/core',
  description: 'Get started with @axonstream/core in minutes. One package for everything you need.',
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
                <span className="text-sm text-green-300 font-medium">@axonstream/core • Quick Start</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Get Started with AxonStream Core
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Install one package and get everything you need for real-time applications. React, Vue, Angular, UI components, and more - all in one revolutionary package.
              </p>
            </div>

            {/* One Command Installation */}
            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Package className="w-6 h-6 text-blue-400 mr-3" />
                One Command Installation
              </h2>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 mb-4">
                <code className="text-green-400 font-mono text-lg">npm install @axonstream/core</code>
              </div>
              <p className="text-gray-300">
                That's it! One command installs the core SDK, React hooks, Vue composables, Angular services, UI components, and CDN helpers.
              </p>
            </div>

            {/* Framework Examples */}
            <div className="space-y-8">

              {/* React Example */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <Code className="w-6 h-6 text-cyan-400 mr-3" />
                  React Integration
                </h2>
                <div className="bg-gray-950 rounded-lg p-4 mb-4">
                  <code className="text-sm text-gray-300 font-mono">
                    <span className="text-purple-400">import</span> <span className="text-blue-400">{'{ useAxonpuls }'}</span> <span className="text-purple-400">from</span> <span className="text-green-400">'@axonstream/core/react'</span>;<br /><br />
                    <span className="text-purple-400">function</span> <span className="text-yellow-400">ChatApp</span>() {'{'}<br />
                    &nbsp;&nbsp;<span className="text-purple-400">const</span> <span className="text-blue-400">axon</span> = <span className="text-yellow-400">useAxonpuls</span>({'{'}<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;org: <span className="text-green-400">'your-org'</span>,<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;token: <span className="text-green-400">'your-jwt-token'</span><br />
                    &nbsp;&nbsp;{'}'});<br /><br />
                    &nbsp;&nbsp;<span className="text-purple-400">return</span> (<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-gray-500">{'<div>'}</span>Real-time chat ready!<span className="text-gray-500">{'</div>'}</span><br />
                    &nbsp;&nbsp;);<br />
                    {'}'}
                  </code>
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  TypeScript support • Auto-reconnection • Event handling
                </div>
              </div>

              {/* Vue Example */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <Layers className="w-6 h-6 text-green-400 mr-3" />
                  Vue 3 Integration
                </h2>
                <div className="bg-gray-950 rounded-lg p-4 mb-4">
                  <code className="text-sm text-gray-300 font-mono">
                    <span className="text-purple-400">import</span> <span className="text-blue-400">{'{ useAxonpuls }'}</span> <span className="text-purple-400">from</span> <span className="text-green-400">'@axonstream/core/vue'</span>;<br /><br />
                    <span className="text-purple-400">export default</span> <span className="text-purple-400">{'{'}</span><br />
                    &nbsp;&nbsp;setup() {'{'}<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-400">const</span> <span className="text-blue-400">axon</span> = <span className="text-yellow-400">useAxonpuls</span>({'{'}<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;org: <span className="text-green-400">'your-org'</span>,<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;token: <span className="text-green-400">'your-jwt-token'</span><br />
                    &nbsp;&nbsp;&nbsp;&nbsp;{'}'});<br /><br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-400">return</span> {'{ axon }'};<br />
                    &nbsp;&nbsp;{'}'}<br />
                    {'}'}
                  </code>
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Composition API • Reactive data • Vue 3 support
                </div>
              </div>

              {/* Angular Example */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <Rocket className="w-6 h-6 text-red-400 mr-3" />
                  Angular Integration
                </h2>
                <div className="bg-gray-950 rounded-lg p-4 mb-4">
                  <code className="text-sm text-gray-300 font-mono">
                    <span className="text-purple-400">import</span> <span className="text-blue-400">{'{ AxonStreamService }'}</span> <span className="text-purple-400">from</span> <span className="text-green-400">'@axonstream/core/angular'</span>;<br /><br />
                    <span className="text-purple-400">@Injectable</span>({'{'}<br />
                    &nbsp;&nbsp;providedIn: <span className="text-green-400">'root'</span><br />
                    {'}'})<br />
                    <span className="text-purple-400">export class</span> <span className="text-yellow-400">ChatService</span> {'{'}<br />
                    &nbsp;&nbsp;<span className="text-purple-400">constructor</span>(<span className="text-purple-400">private</span> <span className="text-blue-400">axon</span>: <span className="text-yellow-400">AxonStreamService</span>) {'{'}<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-400">this</span>.<span className="text-blue-400">axon</span>.<span className="text-yellow-400">connect</span>({'{'}<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;org: <span className="text-green-400">'your-org'</span>,<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;token: <span className="text-green-400">'your-jwt-token'</span><br />
                    &nbsp;&nbsp;&nbsp;&nbsp;{'}'});<br />
                    &nbsp;&nbsp;{'}'}<br />
                    {'}'}
                  </code>
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Dependency injection • RxJS integration • Angular services
                </div>
              </div>

              {/* CDN Example */}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <Package className="w-6 h-6 text-orange-400 mr-3" />
                  CDN Integration (No Build Required)
                </h2>
                <div className="bg-gray-950 rounded-lg p-4 mb-4">
                  <code className="text-sm text-gray-300 font-mono">
                    <span className="text-gray-500">{'<!-- Add to your HTML -->'}</span><br />
                    <span className="text-purple-400">{'<script'}</span> <span className="text-blue-400">src</span>=<span className="text-green-400">"https://cdn.axonstream.ai/axonui.min.js"</span><span className="text-purple-400">{'></script>'}</span><br /><br />
                    <span className="text-gray-500">{'<!-- Use in your JavaScript -->'}</span><br />
                    <span className="text-purple-400">const</span> <span className="text-blue-400">axon</span> = <span className="text-purple-400">new</span> <span className="text-yellow-400">window</span>.<span className="text-yellow-400">AxonSDK</span>({'{'}<br />
                    &nbsp;&nbsp;url: <span className="text-green-400">'wss://your-org.axonstream.ai'</span>,<br />
                    &nbsp;&nbsp;token: <span className="text-green-400">'your-jwt-token'</span><br />
                    {'}'});<br /><br />
                    <span className="text-blue-400">await</span> <span className="text-blue-400">axon</span>.<span className="text-yellow-400">connect</span>();
                  </code>
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  No build tools • Global availability • Instant integration
                </div>
              </div>

            </div>

            {/* Next Steps */}
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 mt-12">
              <h2 className="text-2xl font-bold text-white mb-6">What's Next?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Explore Features</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                      Real-time messaging
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                      Presence indicators
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                      Live cursors
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                      Event subscriptions
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Resources</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li>
                      <a href="https://www.npmjs.com/package/@axonstream/core" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                        NPM Package →
                      </a>
                    </li>
                    <li>
                      <a href="https://github.com/AxonStream/core" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                        GitHub Repository →
                      </a>
                    </li>
                    <li>
                      <Link href="/api-docs" className="text-blue-400 hover:text-blue-300 transition-colors">
                        API Documentation →
                      </Link>
                    </li>
                    <li>
                      <Link href="/testing" className="text-blue-400 hover:text-blue-300 transition-colors">
                        Testing Interface →
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center mt-12">
              <h2 className="text-3xl font-bold text-white mb-6">Ready to Build?</h2>
              <p className="text-xl text-gray-300 mb-8">
                Start building real-time applications with the most revolutionary package in the ecosystem.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://www.npmjs.com/package/@axonstream/core"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-xl hover:shadow-blue-500/25"
                >
                  Install Now
                  <ExternalLink className="ml-2 w-5 h-5" />
                </a>
                <Link
                  href="/api-docs"
                  className="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-gray-300 bg-gray-800/50 border border-gray-600 hover:bg-gray-700/50 hover:border-gray-500 hover:text-white transition-all duration-200"
                >
                  View API Docs
                  <Play className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </MainContent>
    </>
  );
}
