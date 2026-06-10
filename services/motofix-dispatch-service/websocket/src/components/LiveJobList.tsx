import React, { useEffect, useState, useRef } from 'react';
import type { Job } from '@/types/mechanic';
import { connectJobsWebSocket } from '@/services/ws';
import { acceptJob } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface LiveJob extends Job {
  expires_at?: string; // ISO
}

export const LiveJobList: React.FC = () => {
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [accepting, setAccepting] = useState<number | null>(null);
  const toast = useToast();
  const { mechanic } = useAuth();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const ws = connectJobsWebSocket((evt) => {
      if (evt.type === 'new_job') {
        const job = evt.job as LiveJob;
        job.expires_at = evt.expires_at || job.created_at || (new Date(Date.now() + 5 * 60 * 1000)).toISOString();
        setJobs((s) => [job, ...s]);

        try { window.navigator.vibrate?.(200); } catch (e) {}
        try { new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(()=>{}); } catch (e) {}

        toast.toast({ title: 'Hot job!', description: 'A new job just dropped. First click wins!', duration: 4000 });
      }

      if (evt.type === 'job_taken') {
        setJobs((s) => s.filter((j) => j.id !== evt.job_id));
        toast.toast({ title: 'Job taken', description: `Mechanic ${evt.mechanic.name} claimed a job`, duration: 3000 });
      }
    });

    return () => { mounted.current = false; ws.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Remove expired jobs periodically
    const id = setInterval(() => {
      setJobs((s) => s.filter((j) => { if (!j.expires_at) return true; return new Date(j.expires_at).getTime() > Date.now(); }));
    }, 1000 * 10);
    return () => clearInterval(id);
  }, []);

  const handleAccept = async (jobId: number) => {
    if (!mechanic) return;
    setAccepting(jobId);
    try {
      await acceptJob(jobId, mechanic.id, mechanic.name);

      // Play winner animation + sound
      try { new Audio('https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg').play().catch(()=>{}); } catch (e) {}
      try { window.navigator.vibrate?.([100,50,100]); } catch (e) {}

      toast.toast({ title: 'You won!', description: 'You successfully accepted the job. Confirm ETA and proceed.', duration: 5000 });
      // Remove job from list (server will also broadcast job_taken)
      setJobs((s) => s.filter((j) => j.id !== jobId));
    } catch (err: any) {
      // Show error (e.g., already taken)
      toast.toast({ title: 'Could not accept', description: err?.message || 'Job taken by another mechanic', duration: 4000 });
      setJobs((s) => s.filter((j) => j.id !== jobId));
    } finally {
      setAccepting(null);
    }
  };

  const remaining = (expires_at?: string) => {
    if (!expires_at) return '';
    const ms = new Date(expires_at).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const mins = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    return `${mins}:${sec}`;
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Live Jobs</h3>
      <div className="space-y-3">
        {jobs.length === 0 && <div className="text-sm text-muted-foreground">No live jobs right now — stay online to get hot jobs!</div>}
        {jobs.map((job) => (
          <div key={job.id} className="p-3 rounded-lg shadow-sm bg-white flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{job.vehicle_type}</span>
                <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded">Hot job!</span>
                <span className="ml-2 text-xs text-neutral-500">{remaining(job.expires_at)}</span>
              </div>
              <div className="text-sm text-neutral-600 mt-1">{job.problem_description}</div>
              <div className="text-xs text-neutral-500 mt-2">Location: {job.customer_location}</div>
            </div>

            <div className="ml-4 flex flex-col items-end">
              <button
                className={`px-3 py-2 rounded bg-green-600 text-white font-semibold ${accepting === job.id ? 'opacity-60' : ''}`}
                onClick={() => handleAccept(job.id)}
                disabled={accepting === job.id}
              >
                {accepting === job.id ? 'Accepting...' : 'Accept'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        /* small celebratory animation for wins (could be triggered via class, simplified here) */
        .win-anim { animation: pop 800ms ease; }
        @keyframes pop { 0% { transform: scale(0.95); opacity: 0.7; } 50% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default LiveJobList;
