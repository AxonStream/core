import Link from 'next/link';
import { Navigation, MainContent } from '../components/navigation';
import { ArrowRight, CheckCircle, Clock, ExternalLink, Zap, Shield, Database, Cpu, Globe, Users } from 'lucide-react';

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
                <span className="text-sm text-green-300 font-medium">Production Backend • Live Documentation</span>
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
              AxonPuls Platform
              <span className="block text-3xl md:text-4xl text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text mt-4">
                Enterprise Documentation
              </span>
            </h1>

            {/* Description */}
            <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Production-grade real-time platform with WebSocket infrastructure, multi-tenant architecture,
              and enterprise APIs. Complete documentation for developers and enterprises.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                href="/quick-start"
                className="group inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-xl hover:shadow-blue-500/25 transform hover:scale-105"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/api-docs"
                className="group inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-gray-300 bg-gray-800/50 border border-gray-600 hover:bg-gray-700/50 hover:border-gray-500 hover:text-white transition-all duration-200"
              >
                API Reference
                <ExternalLink className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">85%</div>
                <div className="text-sm text-gray-400">Backend Complete</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-2">25+</div>
                <div className="text-sm text-gray-400">API Endpoints</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">3</div>
                <div className="text-sm text-gray-400">Core Models</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400 mb-2">9/17</div>
                <div className="text-sm text-gray-400">Modules Ready</div>
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
            Platform Overview
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Explore the comprehensive documentation, implementation status, and testing tools for the AxonPuls platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

          {/* Implementation Status */}
          <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-green-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/10">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="ml-4 text-xl font-bold text-white group-hover:text-green-400 transition-colors">Implementation Status</h3>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Real-time analysis of completed features, production-ready components, and remaining development tasks.
            </p>
            <Link href="/implementation-status" className="inline-flex items-center text-green-400 hover:text-green-300 font-semibold group-hover:translate-x-1 transition-all duration-200">
              View Status Report
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>

          {/* API Documentation */}
          <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-blue-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <h3 className="ml-4 text-xl font-bold text-white group-hover:text-blue-400 transition-colors">API Documentation</h3>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Complete API reference with WebSocket events, REST endpoints, authentication, and integration examples.
            </p>
            <Link href="/api-docs" className="inline-flex items-center text-blue-400 hover:text-blue-300 font-semibold group-hover:translate-x-1 transition-all duration-200">
              Explore APIs
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>

          {/* Testing Interface */}
          <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-purple-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="ml-4 text-xl font-bold text-white group-hover:text-purple-400 transition-colors">Testing Interface</h3>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Advanced testing UI for WebSocket connections, event streaming, and API endpoint validation.
            </p>
            <Link href="/testing" className="inline-flex items-center text-purple-400 hover:text-purple-300 font-semibold group-hover:translate-x-1 transition-all duration-200">
              Open Testing UI
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>

          {/* Architecture */}
          <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-orange-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/10">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <h3 className="ml-4 text-xl font-bold text-white group-hover:text-orange-400 transition-colors">Architecture</h3>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Deep dive into the multi-tenant architecture, WebSocket infrastructure, and production deployment strategy.
            </p>
            <a href="http://localhost:3001/api/docs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-orange-400 hover:text-orange-300 font-semibold group-hover:translate-x-1 transition-all duration-200">
              View Live Docs
              <ExternalLink className="ml-2 w-4 h-4" />
            </a>
          </div>

          {/* Security */}
          <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-red-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="ml-4 text-xl font-bold text-white group-hover:text-red-400 transition-colors">Security & Auth</h3>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              JWT-based authentication, multi-tenant isolation, and enterprise-grade security features.
            </p>
            <Link href="/security" className="inline-flex items-center text-red-400 hover:text-red-300 font-semibold group-hover:translate-x-1 transition-all duration-200">
              Security Guide
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>

          {/* Next Steps */}
          <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 hover:border-yellow-500/50 hover:bg-gray-900/70 transition-all duration-300 hover:shadow-2xl hover:shadow-yellow-500/10">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="ml-4 text-xl font-bold text-white group-hover:text-yellow-400 transition-colors">Roadmap</h3>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Detailed roadmap for completing the platform, including missing components and production requirements.
            </p>
            <Link href="/next-steps" className="inline-flex items-center text-yellow-400 hover:text-yellow-300 font-semibold group-hover:translate-x-1 transition-all duration-200">
              View Roadmap
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>

          {/* API Documentation */}
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-white">API Documentation</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Complete API reference with WebSocket events, REST endpoints, authentication, and integration examples.
            </p>
            <Link href="/api-docs" className="text-blue-400 hover:text-blue-300 font-medium">
              Explore APIs →
            </Link>
          </div>

          {/* Testing Interface */}
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-white">Testing Interface</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Advanced testing UI for WebSocket connections, event streaming, and API endpoint validation.
            </p>
            <Link href="/testing" className="text-blue-400 hover:text-blue-300 font-medium">
              Open Testing UI →
            </Link>
          </div>

          {/* Architecture Overview */}
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-white">Architecture Overview</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Deep dive into the multi-tenant architecture, WebSocket infrastructure, and production deployment strategy.
            </p>
            <a href="http://localhost:3001/api/docs" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium">
              View Live API Docs →
            </a>
          </div>

          {/* Next Steps */}
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-white">Next Steps</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Detailed roadmap for completing the platform, including missing components and production requirements.
            </p>
            <Link href="/next-steps" className="text-blue-400 hover:text-blue-300 font-medium">
              View Roadmap →
            </Link>
          </div>

          {/* Code Analysis */}
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-white">Backend Status</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Real-time backend running on localhost:3001 with comprehensive API endpoints and WebSocket support.
            </p>
            <a href="http://localhost:3001/api/v1/status" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium">
              Check API Status →
            </a>
          </div>

        </div>

        {/* Technology Stack */}
        <div className="mt-24 pt-16 border-t border-gray-800">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-white mb-4">Built with Enterprise Technologies</h3>
            <p className="text-gray-400">Production-grade stack for scalability and reliability</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            <div className="flex flex-col items-center p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Database className="w-8 h-8 text-blue-400 mb-2" />
              <span className="text-sm text-gray-300 font-medium">PostgreSQL</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Cpu className="w-8 h-8 text-red-400 mb-2" />
              <span className="text-sm text-gray-300 font-medium">Redis</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Globe className="w-8 h-8 text-green-400 mb-2" />
              <span className="text-sm text-gray-300 font-medium">NestJS</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Zap className="w-8 h-8 text-yellow-400 mb-2" />
              <span className="text-sm text-gray-300 font-medium">Fastify</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Shield className="w-8 h-8 text-purple-400 mb-2" />
              <span className="text-sm text-gray-300 font-medium">JWT Auth</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Users className="w-8 h-8 text-orange-400 mb-2" />
              <span className="text-sm text-gray-300 font-medium">Multi-Tenant</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h3>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Explore the comprehensive documentation and start building with the AxonPuls platform today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/quick-start"
                className="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-xl hover:shadow-blue-500/25"
              >
                Quick Start Guide
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <a
                href="http://localhost:3001/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl text-gray-300 bg-gray-800/50 border border-gray-600 hover:bg-gray-700/50 hover:border-gray-500 hover:text-white transition-all duration-200"
              >
                Live API Docs
                <ExternalLink className="ml-2 w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  AxonPuls Platform
                </span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                Enterprise-grade real-time platform with WebSocket infrastructure, multi-tenant architecture, and production-ready APIs.
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-sm text-gray-400">Backend Online</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-400">Documentation Live</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Documentation</h4>
              <ul className="space-y-2">
                <li><Link href="/quick-start" className="text-gray-400 hover:text-white transition-colors">Quick Start</Link></li>
                <li><Link href="/api-docs" className="text-gray-400 hover:text-white transition-colors">API Reference</Link></li>
                <li><Link href="/implementation-status" className="text-gray-400 hover:text-white transition-colors">Implementation Status</Link></li>
                <li><Link href="/testing" className="text-gray-400 hover:text-white transition-colors">Testing Interface</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="http://localhost:3001/api/v1" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Live API</a></li>
                <li><a href="http://localhost:3001/api/docs" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Swagger Docs</a></li>
                <li><Link href="/next-steps" className="text-gray-400 hover:text-white transition-colors">Roadmap</Link></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-400 text-sm">
              © 2025 AxonPuls Platform. Built for enterprise-grade real-time applications.
            </p>
          </div>
        </div>
      </footer>
        </div>
      </MainContent>
    </>
  );
}
