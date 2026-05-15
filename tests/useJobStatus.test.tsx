import { renderHook } from '@testing-library/react';
import { useJobStatus } from '../hooks/useJobStatus';
import { describe, it, expect } from 'vitest';

// Basic smoke test: hook returns an object and handles missing EventSource
describe('useJobStatus hook', () => {
  it('mounts and returns default shape', () => {
    const { result } = renderHook(() => useJobStatus('JOB-TEST'));
    expect(result.current).toBeDefined();
    // Expect some known keys
    expect(result.current).toHaveProperty('job');
    expect(Array.isArray(result.current.logs)).toBe(true);
  });
});
