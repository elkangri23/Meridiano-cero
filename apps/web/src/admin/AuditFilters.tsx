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
    <div className="audit-filters">
      <div className="audit-filters-grid">
        <div>
          <label className="audit-field-label">Fecha Inicio:</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="audit-field-label">Fecha Fin:</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="audit-field-label">Acción:</label>
          <select
            value={filters.action || ''}
            onChange={(e) => onFiltersChange({ ...filters, action: e.target.value || undefined })}
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
      <div className="audit-pagination">
        <label className="audit-page-label">Mostrar:</label>
        <select
          value={pagination.itemsPerPage.toString()}
          onChange={(e) => {
            const newLimit = Number(e.target.value);
            onPaginationChange(prev => ({ ...prev, itemsPerPage: newLimit, currentPage: 1 }));
          }}
        >
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>

        <span className="audit-page-total">/ {pagination.totalItems}</span>

        <button
          onClick={() => onPaginationChange(prev => {
            if (prev.currentPage > 1) {
              return { ...prev, currentPage: prev.currentPage - 1 };
            }
            return prev;
          })}
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
        >
          siguiente
        </button>
      </div>
    </div>
  );
}
