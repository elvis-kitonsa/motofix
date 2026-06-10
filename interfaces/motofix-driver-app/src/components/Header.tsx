interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = 'Motofix', subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="px-4 py-4 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <img 
              src="/motofix-logo.png" 
              alt="Motofix" 
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
