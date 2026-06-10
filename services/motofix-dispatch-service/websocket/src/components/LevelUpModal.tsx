import React, { useEffect } from 'react';

interface LevelUpModalProps {
  level: number;
  title: string;
  onDismiss: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ level, title, onDismiss }) => {
  // Auto-dismiss after 5 s
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in duration-300"
      onClick={onDismiss}
    >
      <div
        className="mx-6 rounded-2xl bg-card border-2 border-primary/30 p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Trophy */}
        <div className="text-6xl mb-4">🏅</div>

        <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-1">
          Level Up!
        </p>

        <h2 className="text-3xl font-black text-foreground mb-1">Level {level}</h2>

        <p className="text-xl font-bold text-accent mb-6">{title}</p>

        <button
          type="button"
          onClick={onDismiss}
          className="btn-touch bg-primary text-primary-foreground hover:bg-primary/90 px-8"
        >
          Let's Go!
        </button>

        <p className="mt-3 text-xs text-muted-foreground">Auto-closes in 5 seconds</p>
      </div>
    </div>
  );
};
