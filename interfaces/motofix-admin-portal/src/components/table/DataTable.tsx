import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  onRowClick,
  pagination,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [containerHovered, setContainerHovered] = useState(false);

  const CARD: React.CSSProperties = {
    background: 'var(--adm-surface)',
    border: '2px solid var(--adm-card-border)',
    boxShadow: 'var(--adm-card-shadow)',
    borderRadius: 16,
    overflow: 'hidden',
    transition: 'border-color 0.2s ease, box-shadow 0.22s ease',
  };

  const TH: React.CSSProperties = {
    padding: '11px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--adm-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    background: 'var(--adm-surface-2)',
    borderBottom: '2px solid var(--adm-card-border)',
    whiteSpace: 'nowrap',
  };

  if (isLoading) {
    return (
      <div style={CARD}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map((_, i) => (
                  <th key={i} style={TH}>
                    <Skeleton className="h-3 w-20" style={{ background: 'var(--adm-skeleton)' }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, rowIndex) => (
                <tr key={rowIndex} style={{ borderBottom: '1px solid var(--adm-divider)' }}>
                  {columns.map((_, colIndex) => (
                    <td key={colIndex} style={{ padding: '14px 16px' }}>
                      <Skeleton className="h-4 w-24" style={{ background: 'var(--adm-skeleton)' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...CARD,
        borderColor: containerHovered ? 'var(--adm-border-hi)' : 'var(--adm-card-border)',
        boxShadow: containerHovered ? 'var(--adm-hover-shadow)' : 'var(--adm-card-shadow)',
      }}
      onMouseEnter={() => setContainerHovered(true)}
      onMouseLeave={() => setContainerHovered(false)}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={TH}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  onMouseEnter={() => setHoveredRow(row.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    borderBottom: '1px solid var(--adm-divider)',
                    background: hoveredRow === row.id
                      ? 'var(--adm-row-hover)'
                      : 'transparent',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.12s',
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        padding: '13px 16px',
                        fontSize: 13,
                        color: 'var(--adm-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--adm-muted)',
                  }}
                >
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '2px solid var(--adm-card-border)',
          background: 'var(--adm-surface-2)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--adm-muted)', fontWeight: 500 }}>
            Page {pagination.page} of {pagination.totalPages}
            <span style={{ color: 'var(--adm-text)', fontWeight: 700, marginLeft: 6 }}>
              ({pagination.total.toLocaleString()} total)
            </span>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <PageBtn
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft size={14} />
            </PageBtn>
            <PageBtn
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight size={14} />
            </PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PageBtn({ children, onClick, disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov && !disabled ? 'var(--adm-amber-dim)' : 'transparent',
        border: `1.5px solid ${hov && !disabled ? 'var(--adm-amber)' : 'var(--adm-card-border)'}`,
        color: disabled ? 'var(--adm-muted)' : hov ? 'var(--adm-amber)' : 'var(--adm-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
