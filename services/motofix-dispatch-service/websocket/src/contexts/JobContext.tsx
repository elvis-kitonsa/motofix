import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Job, JobStatus } from '@/types/mechanic';
import type { XPBreakdown } from '@/types/gamification';
import { acceptJob as apiAcceptJob, rejectJob as apiRejectJob, updateJobStatus as apiUpdateJobStatus, getMechanicProfile, getStoredMechanicId, submitQuote } from '@/services/api';
import { connectJobsWebSocket, type JobEvent } from '@/services/ws';
import { useToast } from '@/hooks/use-toast';
import { useFeedback } from '@/hooks/use-feedback';
import { addJobXP } from '@/services/gamification';

// ─── Job history (persisted to localStorage) ─────────────────────────────────

export interface CompletedJobRecord {
  id: number;
  vehicle_type: string;
  problem_description: string;
  customer_location: string;
  completedAt: string;
}

const HISTORY_KEY = 'motofix_job_history';

function saveToHistory(job: Job) {
  try {
    const record: CompletedJobRecord = {
      id: job.id,
      vehicle_type: job.vehicle_type,
      problem_description: job.problem_description,
      customer_location: job.customer_location,
      completedAt: new Date().toISOString(),
    };
    const prev: CompletedJobRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    localStorage.setItem(HISTORY_KEY, JSON.stringify([record, ...prev].slice(0, 50)));
  } catch {}
}

export function getJobHistory(): CompletedJobRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface JobContextType {
  currentJob: Job | null;
  incomingJob: Job | null;
  isProcessing: boolean;
  setIncomingJob: (job: Job | null) => void;
  acceptJob: (quotedAmount: number) => Promise<void>;
  rejectJob: () => Promise<void>;
  /** Resolves with XPBreakdown when status === 'completed', null otherwise */
  updateStatus: (status: JobStatus) => Promise<XPBreakdown | null>;
  /** Cancel an already-accepted job and return to home */
  abandonJob: () => Promise<void>;
  clearJob: () => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [incomingJob, setIncomingJob] = useState<Job | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const toast = useToast();
  const feedback = useFeedback();

  // Timestamp recorded when mechanic taps "Accept" — used for speed bonus
  const acceptedAtRef = useRef<number | null>(null);
  // IDs of jobs this mechanic explicitly rejected — suppress re-notification from the re-broadcast
  const rejectedJobIdsRef = useRef<Set<number>>(new Set());

  const rejectJob = useCallback(async () => {
    if (!incomingJob) return;
    setIsProcessing(true);
    rejectedJobIdsRef.current.add(incomingJob.id); // suppress re-broadcast notification
    try {
      await apiRejectJob(incomingJob.id);
      setIncomingJob(null);
    } finally {
      setIsProcessing(false);
    }
  }, [incomingJob]);

  const updateStatus = useCallback(async (status: JobStatus): Promise<XPBreakdown | null> => {
    if (!currentJob) return null;
    setIsProcessing(true);
    try {
      await apiUpdateJobStatus(
        currentJob.id,
        status as "en_route" | "arrived" | "service_started" | "completed" | "cancelled"
      );
      if (status === 'completed') {
        const breakdown = addJobXP(acceptedAtRef.current);
        acceptedAtRef.current = null;
        saveToHistory(currentJob);
        setCurrentJob(null);
        return breakdown;
      } else {
        setCurrentJob({ ...currentJob, status });
        feedback.onStatusUpdated();
        return null;
      }
    } catch (err: any) {
      feedback.onError();
      toast.toast({ title: 'Status update failed', description: err?.message || 'Please try again', duration: 4000 });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [currentJob, feedback, toast]);

  const abandonJob = useCallback(async () => {
    if (!currentJob) return;
    setIsProcessing(true);
    try {
      await apiUpdateJobStatus(currentJob.id, 'cancelled');
      setCurrentJob(null);
    } catch (err: any) {
      feedback.onError();
      toast.toast({ title: 'Could not abandon job', description: err?.message || 'Please try again', duration: 4000 });
    } finally {
      setIsProcessing(false);
    }
  }, [currentJob, feedback, toast]);

  const clearJob = useCallback(() => {
    setCurrentJob(null);
    setIncomingJob(null);
  }, []);

  useEffect(() => {
    const ws = connectJobsWebSocket((evt: JobEvent) => {
      if (evt.type === 'new_job') {
        const rawId = Number(evt.job?.id);
        if (!currentJob && !incomingJob && !rejectedJobIdsRef.current.has(rawId)) {
          const raw = evt.job as any;
          // Convert backend media_files → frontend Attachment[]
          // Backend: { file_url, file_type: "voice"|"photo"|"document", file_name }
          // Frontend: { id, url, type: "audio"|"image"|"document", filename }
          const mediaFiles: any[] = raw.media_files ?? raw.attachments ?? [];
          const attachments = mediaFiles.map((mf: any, idx: number) => ({
            id: mf.id != null ? String(mf.id) : String(idx),
            url: mf.url ?? mf.file_url ?? '',
            type: (mf.file_type === 'voice' ? 'audio' : mf.file_type === 'photo' || mf.file_type === 'image' ? 'image' : 'document') as 'audio' | 'image' | 'document',
            filename: mf.filename ?? mf.file_name ?? undefined,
            created_at: mf.created_at ?? mf.uploaded_at ?? undefined,
          }));
          const normalized: Job = {
            id: raw.id,
            vehicle_type: raw.vehicle_type ?? raw.service_type ?? '',
            problem_description: raw.problem_description ?? raw.description ?? '',
            customer_location: raw.customer_location ?? raw.location ?? '',
            customer_latitude: raw.customer_latitude ?? raw.latitude ?? null,
            customer_longitude: raw.customer_longitude ?? raw.longitude ?? null,
            status: raw.status ?? 'pending',
            created_at: raw.created_at ?? new Date().toISOString(),
            attachments: attachments.length > 0 ? attachments : undefined,
          };
          setIncomingJob(normalized);
          feedback.onIncomingJob();
          toast.toast({ title: 'New job!', description: 'A job request is available', duration: 5000 });
        }
      }

      if (evt.type === 'job_taken') {
        const { job_id, mechanic } = evt;
        if (incomingJob && incomingJob.id === job_id) {
          getMechanicProfile().then((mech) => {
            if (mech && mech.id === mechanic.id) {
              setCurrentJob(incomingJob);
              setIncomingJob(null);
              toast.toast({ title: 'Job accepted', description: `ETA ${evt.eta_minutes || 'TBD'} mins`, duration: 5000 });
            } else {
              setIncomingJob(null);
              toast.toast({ title: 'Job taken', description: `${mechanic.name} took this job`, duration: 4000 });
            }
          }).catch(() => {
            setIncomingJob(null);
            toast.toast({ title: 'Job taken', description: `${mechanic.name} took this job`, duration: 4000 });
          });
        }

        if (currentJob && currentJob.id === job_id) {
          setCurrentJob(null);
          toast.toast({ title: 'Job updated', description: `Job marked taken by ${mechanic.name}`, duration: 4000 });
        }
      }
    });

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJob, incomingJob]);

  const acceptJob = useCallback(async (quotedAmount: number) => {
    if (!incomingJob) return;
    setIsProcessing(true);
    acceptedAtRef.current = Date.now(); // start the speed timer
    try {
      const profile = await getMechanicProfile().catch(() => null) as any;
      const mechanicPhone = profile?.phone || '';

      // Submit quote first, then accept the job
      await submitQuote(incomingJob.id, quotedAmount, mechanicPhone, getStoredMechanicId() || 0);
      await apiAcceptJob(incomingJob.id);

      setCurrentJob({ ...incomingJob, status: 'accepted' });
      setIncomingJob(null);
      feedback.onJobAccepted();
      toast.toast({ title: 'Accepted', description: 'Job accepted — quote sent to driver!', duration: 4000 });
    } catch (err: any) {
      feedback.onError();
      acceptedAtRef.current = null;
      setIncomingJob(null);
      toast.toast({ title: 'Could not accept', description: err?.message || 'Job was taken by someone else', duration: 4000 });
    } finally {
      setIsProcessing(false);
    }
  }, [incomingJob, feedback, toast]);

  return (
    <JobContext.Provider
      value={{
        currentJob,
        incomingJob,
        isProcessing,
        setIncomingJob,
        acceptJob,
        rejectJob,
        updateStatus,
        abandonJob,
        clearJob,
      }}
    >
      {children}
    </JobContext.Provider>
  );
};

export const useJob = (): JobContextType => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJob must be used within a JobProvider');
  }
  return context;
};
