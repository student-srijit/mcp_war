'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { VerificationState } from '@/hooks/useMockVerification';

// Dynamically import ForceGraph3D to avoid SSR issues with canvas/window
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-[#6b7280] font-mono text-xs">
      Initializing 3D Matrix...
    </div>
  ),
});

export function KnowledgeGraph3D({ state }: { state: VerificationState }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setDimensions({ width, height });

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.getBoundingClientRect().width,
          height: containerRef.current.getBoundingClientRect().height,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];

    // 1. Central Query Node
    nodes.push({ id: 'query', name: 'User Query', group: 0, val: 30, color: '#4f46e5' });

    // 2. Claim Nodes
    state.claims.forEach((claim) => {
      nodes.push({ id: claim.id, name: `Claim: ${claim.type}`, group: 1, val: 15, color: '#3b82f6' });
      links.push({ source: 'query', target: claim.id, color: '#1f2937' });
    });

    // 3. Agent Nodes
    const activeAgents = state.agents.filter(a => a.status === 'passed' || a.status === 'failed');
    activeAgents.forEach((agent) => {
      nodes.push({ id: agent.id, name: agent.name, group: 2, val: 20, color: '#8b5cf6' });
      // Connect agents to claims they might have verified (simplified: connect to all claims)
      state.claims.forEach((claim) => {
        links.push({ source: claim.id, target: agent.id, color: '#374151' });
      });
    });

    // 4. Evidence Nodes
    state.evidenceChain.forEach((ev, idx) => {
      const evId = `ev-${idx}`;
      const color = ev.supports ? '#10b981' : '#ef4444'; // Green if supports, Red if contradicts
      nodes.push({ id: evId, name: ev.source, group: 3, val: 10, color });

      // Find the claim this evidence supports (matching by claim text or just connect to related claim)
      // Since evidenceChain in UI maps `claim` to the title/excerpt, we try to match it back, 
      // but for visualization we can link it to the center or random claim if match fails.
      let targetClaimId = 'query'; 
      // Simplified: link evidence to the first claim if no direct mapping
      if (state.claims.length > 0) {
          targetClaimId = state.claims[Math.floor(idx % state.claims.length)].id;
      }
      
      links.push({ source: targetClaimId, target: evId, color });
    });

    return { nodes, links };
  }, [state]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] bg-[#05050a] rounded-xl overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h3 className="text-sm font-mono uppercase tracking-wider text-[#9ca3af] mb-1">
          Knowledge Graph
        </h3>
        <p className="text-xs text-[#6b7280]">Interactive 3D Evidence Network</p>
      </div>
      
      <ForceGraph3D
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeColor={(node: any) => node.color}
        nodeRelSize={1}
        linkColor={(link: any) => link.color}
        linkWidth={1.5}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        backgroundColor="#05050a"
      />
    </div>
  );
}
