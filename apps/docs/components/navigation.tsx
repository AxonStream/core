'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Search, Menu, X, ExternalLink, Github, Zap,
  ChevronLeft, ChevronRight, Home, FileText, TestTube, Rocket, Database,
  Code, Activity
} from 'lucide-react';

const navigation = [
  {
    name: 'Overview',
    href: '/',
    icon: Home,
    description: 'Platform overview and introduction'
  },
  {
    name: 'Quick Start',
    href: '/quick-start',
    icon: Zap,
    description: 'Get started in minutes'
  },
  {
    name: 'API Reference',
    href: '/api-docs',
    icon: Code,
    description: 'Complete API documentation'
  },
  {
    name: 'Implementation Status',
    href: '/implementation-status',
    icon: Activity,
    description: 'Current development progress'
  },
  {
    name: 'Testing Interface',
    href: '/testing',
    icon: TestTube,
    description: 'Interactive API testing'
  },
  {
    name: 'Roadmap',
    href: '/next-steps',
    icon: Rocket,
    description: 'Future development plans'
  },
];

const externalLinks = [
  {
    name: 'Live API',
    href: 'http://localhost:3001/api/v1',
    icon: Database,
    description: 'Backend API endpoint'
  },
  {
    name: 'Swagger Docs',
    href: 'http://localhost:3001/api/docs',
    icon: FileText,
    description: 'Interactive API documentation'
  },
  {
    name: 'GitHub',
    href: '#',
    icon: Github,
    description: 'Source code repository'
  },
];

export function Navigation() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'
        } transition-all duration-300 ease-in-out bg-gray-900/50 backdrop-blur-xl border-r border-gray-800 flex flex-col`}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <Link href="/" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            {!sidebarCollapsed && (
              <span className="ml-3 text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AxonPuls Platform
              </span>
            )}
          </Link>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <button
            onClick={() => setSearchOpen(true)}
            className={`w-full flex items-center px-3 py-2 text-sm text-gray-400 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 hover:text-gray-300 transition-colors ${sidebarCollapsed ? 'justify-center' : ''
              }`}
          >
            <Search className="w-4 h-4" />
            {!sidebarCollapsed && (
              <>
                <span className="ml-2 flex-1 text-left">Search docs...</span>
                <kbd className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">⌘K</kbd>
              </>
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          <div className={`${sidebarCollapsed ? 'text-center' : ''} mb-4`}>
            {!sidebarCollapsed && (
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Documentation
              </h3>
            )}
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 mb-1 ${active
                    ? 'text-white bg-blue-600 shadow-lg shadow-blue-500/25'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                    } ${sidebarCollapsed ? 'justify-center' : ''}`}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'} ${!sidebarCollapsed ? 'mr-3' : ''}`} />
                  {!sidebarCollapsed && (
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500 group-hover:text-gray-400">
                        {item.description}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* External Links */}
          <div className={`${sidebarCollapsed ? 'text-center' : ''} border-t border-gray-800 pt-4`}>
            {!sidebarCollapsed && (
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                External Links
              </h3>
            )}
            {externalLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all duration-200 mb-1 ${sidebarCollapsed ? 'justify-center' : ''
                    }`}
                  title={sidebarCollapsed ? link.name : ''}
                >
                  <Icon className={`w-5 h-5 text-gray-400 group-hover:text-white ${!sidebarCollapsed ? 'mr-3' : ''}`} />
                  {!sidebarCollapsed && (
                    <div className="flex-1">
                      <div className="font-medium">{link.name}</div>
                      <div className="text-xs text-gray-500 group-hover:text-gray-400">
                        {link.description}
                      </div>
                    </div>
                  )}
                  {!sidebarCollapsed && (
                    <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-400" />
                  )}
                </a>
              );
            })}
          </div>
        </div>

        {/* Status Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className={`space-y-2 ${sidebarCollapsed ? 'text-center' : ''}`}>
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              {!sidebarCollapsed && (
                <span className="ml-2 text-xs text-gray-400">API Online</span>
              )}
            </div>
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              {!sidebarCollapsed && (
                <span className="ml-2 text-xs text-gray-400">Docs Live</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 bg-gray-900/80 backdrop-blur-sm border border-gray-700"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-gray-900 border-r border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <Link href="/" className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="ml-3 text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  AxonPuls Platform
                </span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <button
                onClick={() => setSearchOpen(true)}
                className="w-full flex items-center px-3 py-2 text-sm text-gray-400 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 hover:text-gray-300 transition-colors"
              >
                <Search className="w-4 h-4 mr-2" />
                Search docs...
              </button>
            </div>

            <div className="px-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active
                      ? 'text-white bg-blue-600'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                      }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="px-4 mt-6 pt-4 border-t border-gray-800">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                External Links
              </h3>
              {externalLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <div className="flex-1">
                      <div className="font-medium">{link.name}</div>
                      <div className="text-xs text-gray-500">{link.description}</div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-gray-500" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl mx-auto p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
              <div className="p-4">
                <div className="flex items-center">
                  <Search className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    type="text"
                    placeholder="Search documentation..."
                    className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none"
                    autoFocus
                  />
                  <kbd className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">ESC</kbd>
                </div>
              </div>
              <div className="border-t border-gray-700 p-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Quick Links
                  </div>
                  {navigation.slice(0, 4).map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                      >
                        <Icon className="w-4 h-4 mr-3 text-gray-400" />
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.description}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main content wrapper component
export function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
