import { useEffect, useState } from 'react';
import { adminApi } from './client.js';
import type { AdminAuditLogEntry, AuditFiltersState, AuditPaginationState } from './types.js';
import { AuditFilters } from './AuditFilters.js';
import { AuditTable } from './AuditTable.js';

/** Sección de auditoría del dashboard: filtros, paginación y tabla. */
export function AuditSection() {
  // Filtros de auditoría
  const [auditFilters, setAuditFilters] = useState<AuditFiltersState>({ startDate: undefined, endDate: undefined, action: undefined });

  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AdminAuditLogEntry[]>([]);
  const [auditPagination, setAuditPagination] = useState<AuditPaginationState>({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    itemsPerPage: 50,
  });

  // Cargar auditoría cuando cambian los filtros
  useEffect(() => {
    let cancelled = false;
    const loadAudit = async () => {
      setAuditLoading(true);
      try {
        const response = await adminApi.getAuditLog(auditFilters);
        if (!cancelled) {
          setAuditData(response.logs);
          setAuditPagination({
            totalItems: response.total,
            totalPages: Math.ceil(response.total / 50),
            currentPage: 1,
            itemsPerPage: 50,
          });
          setAuditLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setAuditError(e instanceof Error ? e.message : 'Error desconocido');
          setAuditLoading(false);
        }
      }
    };
    loadAudit();
    return () => { cancelled = true; };
  }, [JSON.stringify(auditFilters)]);

  return (
    <section className="audit-section" style={{ marginTop: '32px' }}>
      <h3>📋 Auditoría de Acciones Administrativas</h3>

      <AuditFilters
        filters={auditFilters}
        onFiltersChange={setAuditFilters}
        pagination={auditPagination}
        onPaginationChange={setAuditPagination}
      />

      <AuditTable loading={auditLoading} error={auditError} data={auditData} />
    </section>
  );
}
