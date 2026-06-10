import React from 'react';
import { Clock, Car, MapPin, CheckCircle } from 'lucide-react';
import { getJobHistory } from '@/contexts/JobContext';

const JobHistoryScreen: React.FC = () => {
  const history = getJobHistory();

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      <header className="px-4 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Job History</h1>
          {history.length > 0 && (
            <span className="text-sm text-muted-foreground">{history.length} jobs</span>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 pb-20">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Clock className="w-14 h-14 mb-4 opacity-25" />
            <p className="font-medium">No completed jobs yet</p>
            <p className="text-sm mt-1">Completed jobs will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((job, i) => (
              <div key={`${job.id}-${i}`} className="card-industrial p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-semibold text-foreground text-sm">{job.vehicle_type}</span>
                      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(job.completedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {job.problem_description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0">
                        <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">{job.customer_location}</p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                        {formatTime(job.completedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default JobHistoryScreen;
