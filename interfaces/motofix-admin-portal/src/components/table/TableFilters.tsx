import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface TableFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}

export function TableFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  children,
}: TableFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      {children && (
        <div className="flex flex-wrap gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
