import { useState, useEffect, useCallback, useRef } from 'react';
import { VerificationJob, FeedLogEntry } from '@/lib/schemas';

interface UseJobStatusResult {
  job: VerificationJob | null;
  logs: FeedLogEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useJobStatus(jobId: string | null): UseJobStatusResult {
  const [job, setJob] = useState<VerificationJob | null>(null);
  const [logs, setLogs] = useState<FeedLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isCompletedRef = useRef(false);

  const fetchJob = useCallback(async () => {
    if (!jobId || isCompletedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) throw new Error('Failed to fetch job');

      const jobData = await response.json();
      setJob(jobData);

      // Fetch logs
      const logsResponse = await fetch(`/api/jobs/${jobId}/logs`);
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData.logs || []);
      }

      // Stop polling when job is done
      if (jobData.status === 'completed' || jobData.status === 'failed') {
        isCompletedRef.current = true;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLogs([]);
      setError(null);
      isCompletedRef.current = false;
      return;
    }

    // Reset completed flag for new job
    isCompletedRef.current = false;

    // Initial fetch
    fetchJob();

    // Poll for updates every 800ms
    pollIntervalRef.current = setInterval(fetchJob, 800);

    // Also try SSE stream for faster updates
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        const stream = new EventSource(`/api/jobs/${jobId}/stream`);
        eventSourceRef.current = stream;

        stream.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as {
              type: string;
              job?: VerificationJob;
              logs?: FeedLogEntry[];
            };

            if (payload.type === 'done') {
              stream.close();
              eventSourceRef.current = null;
              return;
            }

            if (payload.job) {
              setJob(payload.job);
            }

            if (payload.logs) {
              setLogs(payload.logs);
            }
          } catch {
            // Ignore parse errors from SSE
          }
        };

        stream.onerror = () => {
          // SSE failed — polling will handle it
          stream.close();
          eventSourceRef.current = null;
        };
      } catch {
        // SSE not supported — polling handles it
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [jobId, fetchJob]);

  return { job, logs, isLoading, error, refetch: fetchJob };
}
