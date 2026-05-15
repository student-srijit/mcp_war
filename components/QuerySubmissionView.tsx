'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Zap, Shield, CheckCircle, Sparkles } from 'lucide-react';

interface QuerySubmissionProps {
  onSubmit: (query: string, domain: string) => void;
  exampleQueries: Array<{
    title: string;
    domain: string;
    query: string;
  }>;
}

export function QuerySubmissionView({
  onSubmit,
  exampleQueries,
}: QuerySubmissionProps) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('Auto-Detect');
  const [selectedExample, setSelectedExample] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const domains = [
    'Auto-Detect',
    'Structural Engineering',
    'Software Development',
    'Infrastructure & Energy',
    'Healthcare Systems',
    'Financial Modeling',
    'Standards Reference',
  ];

  const handleExampleClick = (index: number) => {
    const example = exampleQueries[index];
    setQuery(example.query);
    setDomain(example.domain);
    setSelectedExample(index);
  };

  const handleSubmit = () => {
    if (query.trim()) {
      onSubmit(query, domain);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute -bottom-32 right-1/4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 -left-32 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-5xl w-full space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-8 mb-4">
            {/* Main Logo & Title */}
            <div className="space-y-6">
              <div className="inline-flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 blur-2xl opacity-20"></div>
                  <h1 className="relative text-7xl md:text-8xl font-black tracking-tighter">
                    <span className="text-white">VERI</span>
                    <span className="bg-gradient-to-r from-indigo-400 via-indigo-500 to-purple-600 bg-clip-text text-transparent">TAS</span>
                  </h1>
                </div>
              </div>

              <div className="space-y-3 max-w-2xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Multi-Agent Technical Verification
                </h2>
                <p className="text-base md:text-lg text-gray-400 leading-relaxed">
                  Enterprise-grade hallucination detection powered by 9 specialized verification agents. Real-time fact-checking, mathematical validation, and standards compliance in seconds.
                </p>
              </div>
            </div>

            {/* Stat Pills - Enhanced */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mt-8">
              {[
                { label: '9 Agents Online', icon: Zap },
                { label: '6 MCP Servers', icon: Shield },
                { label: '96.8% Verified', icon: CheckCircle },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={i}
                    className="px-4 py-2 rounded-full border border-gray-700 bg-gray-900/40 backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-mono text-gray-300 hover:border-indigo-500 hover:bg-gray-800/60 transition-all duration-300"
                  >
                    <Icon size={16} className="text-indigo-400" />
                    {stat.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Query Input Area - Premium */}
          <div className="space-y-5">
            {/* Textarea */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Enter your technical query — engineering calculation, code snippet, standards reference, or any technical claim you need verified..."
                className="relative w-full min-h-[180px] md:min-h-[200px] px-6 py-5 bg-gradient-to-br from-gray-900/80 to-gray-950 border-2 border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none font-mono text-sm transition-all duration-300 shadow-xl focus:shadow-2xl focus:shadow-indigo-500/20 resize-none"
              />
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
              <div className="relative flex-1">
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-700 rounded-xl text-white font-mono text-sm focus:border-indigo-500 focus:outline-none transition-all duration-300 hover:border-gray-600 appearance-none cursor-pointer"
                >
                  {domains.map((d) => (
                    <option key={d} value={d} className="bg-gray-900">
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!query.trim()}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-indigo-500/50 disabled:shadow-none transform hover:scale-105 disabled:scale-100"
              >
                <Zap size={20} className="animate-pulse" />
                VERIFY
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          {/* Example Queries Section */}
          <div className="space-y-6 mt-16 pt-12 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles size={20} className="text-indigo-400" />
                  Try an Example
                </h3>
                <p className="text-sm text-gray-500 mt-1">Click any query to get started instantly</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exampleQueries.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(idx)}
                  className={`group relative p-5 rounded-xl border-2 transition-all duration-300 overflow-hidden text-left ${
                    selectedExample === idx
                      ? 'border-indigo-500 bg-gradient-to-br from-indigo-950/80 to-indigo-900/40'
                      : 'border-gray-700 bg-gray-900/30 hover:border-indigo-500 hover:bg-gray-800/40'
                  }`}
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-transparent to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>

                  <div className="relative z-10 space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="inline-block px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 text-xs font-mono font-bold">
                        {example.domain.split(' ')[0]}
                      </span>
                      {selectedExample === idx && (
                        <CheckCircle size={18} className="text-indigo-400 mt-0.5" />
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">
                      {example.title}
                    </h4>
                    <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed line-clamp-2">
                      {example.query}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pt-12 border-t border-gray-800">
            {[
              {
                icon: Zap,
                title: 'Instant Results',
                desc: '5-6 second turnaround with parallel agent processing',
              },
              {
                icon: Shield,
                title: 'Enterprise Grade',
                desc: 'Bank-level security with 9-agent verification pipeline',
              },
              {
                icon: CheckCircle,
                title: 'Proven Accuracy',
                desc: '96.8% verified across 1,247+ technical domains',
              },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="text-center space-y-3 group">
                  <Icon size={32} className="mx-auto text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                  <h4 className="font-bold text-white text-base">{feature.title}</h4>
                  <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-gray-800 py-6 mt-20">
        <p className="text-center text-xs text-gray-600 font-mono">
          Powered by Groq LPU · LangGraph · 9-Agent Verification Pipeline · 100% Free
        </p>
      </div>
    </div>
  );
}
