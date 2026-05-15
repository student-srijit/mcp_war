'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

interface NavigationProps {
  currentView: 'home' | 'live' | 'results' | 'audit';
  onNavigate: (view: 'home' | 'live' | 'results' | 'audit') => void;
}

export function Navigation({ currentView, onNavigate }: NavigationProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1f2937] bg-[#0a0a0f]">
      <div className="flex h-16 items-center justify-between px-6 md:px-8">
        {/* Logo */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
        >
          <span className="font-bold text-xl">
            <span className="text-white">VERI</span>
            <span className="text-[#4f46e5]">TAS</span>
          </span>
        </button>

        {/* Center Nav Links */}
        <div className="flex gap-6 md:gap-8 items-center">
          <button
            onClick={() => onNavigate('home')}
            className={`text-sm font-medium transition ${
              currentView === 'home'
                ? 'text-[#4f46e5]'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => onNavigate('live')}
            disabled={currentView === 'home'}
            className={`text-sm font-medium transition ${
              currentView === 'live'
                ? 'text-[#4f46e5]'
                : currentView === 'home'
                ? 'text-[#4b5563] cursor-not-allowed'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Live Run
          </button>
          <button
            onClick={() => onNavigate('results')}
            disabled={currentView === 'home' || currentView === 'live'}
            className={`text-sm font-medium transition ${
              currentView === 'results'
                ? 'text-[#4f46e5]'
                : currentView === 'home' || currentView === 'live'
                ? 'text-[#4b5563] cursor-not-allowed'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Results
          </button>
          <button
            onClick={() => onNavigate('audit')}
            disabled={currentView === 'home' || currentView === 'live'}
            className={`text-sm font-medium transition ${
              currentView === 'audit'
                ? 'text-[#4f46e5]'
                : currentView === 'home' || currentView === 'live'
                ? 'text-[#4b5563] cursor-not-allowed'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Audit Trail
          </button>
        </div>

        {/* Health Indicator */}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
          <span className="text-xs font-mono text-[#9ca3af]">All 9 Agents Online</span>
        </div>
      </div>
    </nav>
  );
}
