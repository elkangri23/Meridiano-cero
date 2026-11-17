import type { Dispatch, SetStateAction } from 'react';
import type { AuditFiltersState, AuditPaginationState } from './types.js';

/** Filtros y paginación de la auditoría. */
export function AuditFilters({ filters, onFiltersChange, pagination, onPaginationChange }: {
  filters: AuditFiltersState;
  onFiltersChange: Dispatch<SetStateAction<AuditFiltersState>>;
  pagination: AuditPaginationState;
  onPaginationChange: Dispatch<SetStateAction<AuditPaginationState>>;
}) {
  return (
    <div className="audit-filters" style={{
      background: '#111',
      border: '1px solid #333',
      borderRadius: '6px',
      padding: '16px',
      marginBottom: '24px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Fecha Inicio:</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value || undefined })}
            style={{
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              padding: '8px',
              borderRadius: '4px',
              fontFamily: "'Courier New', monospace",
            }}
          />
        </div>
        <div>
          <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Fecha Fin:</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value || undefined })}
            style={{
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              padding: '8px',
              borderRadius: '4px',
              fontFamily: "'Courier New', monospace",
            }}
          />
        </div>
        <div>
          <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Acción:</label>
          <select
            value={filters.action || ''}
            onChange={(e) => onFiltersChange({ ...filters, action: e.target.value || undefined })}
            style={{
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              padding: '8px',
              borderRadius: '4px',
              fontFamily: "'Courier New', monospace",
            }}
          >
            <option value="">Todas las acciones</option>
            <option value="view_user">view_user</option>
            <option value="update_user">update_user</option>
            <option value="revoke_sessions">revoke_sessions</option>
            <option value="view_run">view_run</option>
            <option value="update_run">update_run</option>
            <option value="revoke_run_sessions">revoke_run_sessions</option>
            <option value="view_audit">view_audit</option>
          </select>
        </div>
      </div>

      {/* Paginación */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
        <label style={{ color: '#aaa', fontSize: '12px' }}>Mostrar:</label>
        <select
          value={pagination.itemsPerPage.toString()}
          onChange={(e) => {
            const newLimit = Number(e.target.value);
            onPaginationChange(prev => ({ ...prev, itemsPerPage: newLimit, currentPage: 1 }));
          }}
          style={{
            background: '#333',
            color: '#fff',
            border: '1px solid #555',
            padding: '6px 12px',
            borderRadius: '4px',
            fontFamily: "'Courier New', monospace",
          }}
        >
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>

        <span style={{ color: '#fff', fontSize: '12px', margin: '0 8px' }}>/ {pagination.totalItems}</span>

        <button
          onClick={() => onPaginationChange(prev => {
            if (prev.currentPage > 1) {
              return { ...prev, currentPage: prev.currentPage - 1 };
            }
            return prev;
          })}
          style={{
            background: '#0000aa',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          anterior
        </button>

        <button
          onClick={() => onPaginationChange(prev => {
            const maxPage = Math.max(1, Math.ceil(prev.totalItems / prev.itemsPerPage));
            if (prev.currentPage < maxPage) {
              return { ...prev, currentPage: prev.currentPage + 1 };
            }
            return prev;
          })}
          style={{
            background: '#0000aa',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          siguiente
        </button>
      </div>
    </div>
  );
}
