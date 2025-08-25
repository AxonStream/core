import Link from 'next/link';
import { Navigation, MainContent } from '../components/navigation';
import { ArrowRight, CheckCircle, Clock, ExternalLink, Zap, Shield, Database, Cpu, Globe, Users, Package, Code, Layers, Rocket } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <Navigation />
      <MainContent>
        <div className="bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">

          {/* Hero Section */}
          <div className="relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 blur-3xl"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950"></div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
              <div className="text-center">
                {/* Status Badge */}
                <div className="mb-8">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
                    <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                    <span className="text-sm text-green-300 font-medium">@axonstream/core • Live on NPM</span>
                  </div>
                </div>

                {/* Main Heading */}
                <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
                  AxonStream Core
                  <span className="block text-3xl md:text-4xl text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text mt-4">
                    ONE PACKAGE FOR EVERYTHING
                  </span>
                </h1>

                {/* Description */}
                <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
                  Revolutionary real-time platform in a single package. Core SDK, React/Vue/Angular adapters,
                  UI components, and embed helpers - everything you need for modern real-time applications.
                </p>

                {/* Package Install */}
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 mb-8 max-w-2xl mx-auto">
                  <code className="text-green-400 font-mono text-lg">npm install @axonstream/core</code>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                  <Link
                    href="/quick-start"
                    className="group inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-xl hover:shadow-blue-500/25 transform hover:scale-105"
                  >
                    Get Started
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <a
                    href="https://www.npmjs.com/package/@axonstream/core"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-gray-300 bg-gray-800/50 border border-gray-600 hover:bg-gray-700/50 hover:border-gray-500 hover:text-white transition-all duration-200"
                  >
                    View on NPM
                    <ExternalLink className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400 mb-2">1</div>
                    <div className="text-sm text-gray-400">Package</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400 mb-2">4</div>
                    <div className="text-sm text-gray-400">Frameworks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-400 mb-2">∞</div>
                    <div className="text-sm text-gray-400">Possibilities</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-400 mb-2">0</div>
                    <div className="text-sm text-gray-400">Dependencies</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            {/* Section Header */}
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Everything You Need
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                One package provides everything for modern real-time applications across all major frameworks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

              {/* Core SDK */}
              <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-blue-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">Core SDK</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Complete real-time SDK with WebSocket connections, event handling, authentication, and multi-tenant support.
                </p>
                <code className="text-sm text-blue-400 font-mono">import {'{ AxonStream }'} from '@axonstream/core'</code>
              </div>

              {/* React Adapter */}
              <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-cyan-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Code className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">React Hooks</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  React hooks for real-time state management, subscriptions, and event handling with TypeScript support.
                </p>
                <code className="text-sm text-cyan-400 font-mono">import {'{ useAxonpuls }'} from '@axonstream/core/react'</code>
              </div>

              {/* Vue Adapter */}
              <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-green-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/10">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Layers className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">Vue Composables</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Vue 3 composables for reactive real-time data, perfect for Vue applications with Composition API.
                </p>
                <code className="text-sm text-green-400 font-mono">import {'{ useAxonpuls }'} from '@axonstream/core/vue'</code>
              </div>

              {/* Angular Adapter */}
              <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-red-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Rocket className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">Angular Services</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Angular services and injectables for real-time functionality, RxJS integration, and dependency injection.
                </p>
                <code className="text-sm text-red-400 font-mono">import {'{ AxonStreamService }'} from '@axonstream/core/angular'</code>
              </div>

              {/* UI Components */}
              <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-purple-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">UI Components</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Pre-built UI components for real-time features: chat, presence indicators, live cursors, and more.
                </p>
                <code className="text-sm text-purple-400 font-mono">import {'{ AxonStreamUI }'} from '@axonstream/core/ui'</code>
              </div>

              {/* CDN & Embed */}
              <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-orange-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/10">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white ml-4">CDN & Embed</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  CDN-ready builds and embed helpers for quick integration without build tools or frameworks.
                </p>
                <code className="text-sm text-orange-400 font-mono">import '@axonstream/core/cdn'</code>
              </div>

            </div>
          </div>

          {/* Code Examples Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Revolutionary Simplicity
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                One command, one package, infinite possibilities. See how easy it is to get started.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

              {/* React Example */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Code className="w-5 h-5 text-cyan-400 mr-2" />
                  React Example
                </h3>
                <div className="bg-gray-950 rounded-lg p-4 mb-4">
                  <code className="text-sm text-gray-300 font-mono">
                    <span className="text-purple-400">import</span> <span className="text-blue-400">{'{ useAxonpuls }'}</span> <span className="text-purple-400">from</span> <span className="text-green-400">'@axonstream/core/react'</span>;<br /><br />
                    <span className="text-purple-400">function</span> <span className="text-yellow-400">ChatComponent</span>() {'{'}<br />
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
              </div>

              {/* Vue Example */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Layers className="w-5 h-5 text-green-400 mr-2" />
                  Vue Example
                </h3>
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
              </div>

            </div>
          </div>

          {/* Call to Action */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Ready to Revolutionize Your App?
              </h2>
              <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                Join thousands of developers building the future with AxonStream Core.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/quick-start"
                  className="group inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-xl hover:shadow-blue-500/25 transform hover:scale-105"
                >
                  Start Building
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="https://github.com/AxonStream/core"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-gray-300 bg-gray-800/50 border border-gray-600 hover:bg-gray-700/50 hover:border-gray-500 hover:text-white transition-all duration-200"
                >
                  View Source
                  <ExternalLink className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>
          </div>

        </div>
      </MainContent>
    </>
  );
}
