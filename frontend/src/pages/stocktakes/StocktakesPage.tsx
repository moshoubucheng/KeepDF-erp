import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { stocktakesApi, type Stocktake, type StocktakeItem } from '@/api/endpoints/stocktakes';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable, type Column } from '@/components/data/DataTable';
import { StatusBadge } from '@/components/data/StatusBadge';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePagination } from '@/hooks/usePagination';
import { formatDate } from '@/utils/format';

const STATUS_OPTIONS = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export default function StocktakesPage() {
  const { t } = useTranslation();
  const { addToast } = useUIStore();
  const { isAdmin } = useAuthStore();
  const { page, limit, setPage, resetPage } = usePagination();

  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Create stocktake
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createNotes, setCreateNotes] = useState('');

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailStocktake, setDetailStocktake] = useState<Stocktake | null>(null);
  const [detailItems, setDetailItems] = useState<StocktakeItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Count item modal
  const [showCountModal, setShowCountModal] = useState(false);
  const [countStocktakeId, setCountStocktakeId] = useState<number | null>(null);
  const [countSku, setCountSku] = useState('');
  const [countLocationCode, setCountLocationCode] = useState('');
  const [countActualQty, setCountActualQty] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [counting, setCounting] = useState(false);

  // Action loading
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchStocktakes = useCallback(async () => {
    setLoading(true);
    try {
      const params: { offset?: number; limit?: number; status?: string } = {
        offset: (page - 1) * limit,
        limit,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await stocktakesApi.list(params);
      setStocktakes(res.stocktakes || []);
      setTotalCount(res.total || 0);
    } catch {
      addToast('error', t('stocktakes.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, addToast, t]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStocktakes();
  }, [isAdmin, fetchStocktakes]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    resetPage();
  };

  // Create stocktake
  const handleCreate = async () => {
    setCreating(true);
    try {
      await stocktakesApi.create(createNotes || undefined);
      addToast('success', t('stocktakes.createSuccess'));
      setShowCreateModal(false);
      setCreateNotes('');
      fetchStocktakes();
    } catch {
      addToast('error', t('stocktakes.createError'));
    } finally {
      setCreating(false);
    }
  };

  // Start stocktake
  const handleStart = async (id: number) => {
    setActionLoadingId(id);
    try {
      await stocktakesApi.start(id);
      addToast('success', t('stocktakes.startSuccess'));
      fetchStocktakes();
    } catch {
      addToast('error', t('stocktakes.startError'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Complete stocktake
  const handleComplete = async (id: number) => {
    if (!window.confirm(t('stocktakes.completeConfirm'))) return;
    setActionLoadingId(id);
    try {
      await stocktakesApi.complete(id);
      addToast('success', t('stocktakes.completeSuccess'));
      fetchStocktakes();
    } catch {
      addToast('error', t('stocktakes.completeError'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancel stocktake
  const handleCancel = async (id: number) => {
    if (!window.confirm(t('stocktakes.cancelConfirm'))) return;
    setActionLoadingId(id);
    try {
      await stocktakesApi.cancel(id);
      addToast('success', t('stocktakes.cancelSuccess'));
      fetchStocktakes();
    } catch {
      addToast('error', t('stocktakes.cancelError'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // View detail
  const handleViewDetail = async (stocktake: Stocktake) => {
    setDetailStocktake(stocktake);
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const res = await stocktakesApi.get(stocktake.id);
      setDetailStocktake(res);
      setDetailItems(res.items || []);
    } catch {
      addToast('error', t('stocktakes.detailFetchError'));
    } finally {
      setDetailLoading(false);
    }
  };

  // Count item
  const openCountModal = (stocktakeId: number) => {
    setCountStocktakeId(stocktakeId);
    setCountSku('');
    setCountLocationCode('');
    setCountActualQty('');
    setCountNotes('');
    setShowCountModal(true);
  };

  const handleCountItem = async () => {
    if (!countStocktakeId || !countSku || !countLocationCode || countActualQty === '') {
      addToast('error', t('stocktakes.countRequiredError'));
      return;
    }
    setCounting(true);
    try {
      await stocktakesApi.countItem(countStocktakeId, {
        sku: countSku,
        location_code: countLocationCode,
        actual_qty: Number(countActualQty),
        notes: countNotes || undefined,
      });
      addToast('success', t('stocktakes.countSuccess'));
      setShowCountModal(false);
      // Refresh detail if viewing
      if (detailStocktake && detailStocktake.id === countStocktakeId) {
        handleViewDetail(detailStocktake);
      }
      fetchStocktakes();
    } catch {
      addToast('error', t('stocktakes.countError'));
    } finally {
      setCounting(false);
    }
  };

  // Columns: Stocktakes
  const stocktakeColumns: Column<Stocktake>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (row) => <span className="font-mono text-xs text-text-muted">#{row.id}</span>,
    },
    {
      key: 'status',
      header: t('stocktakes.status'),
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'total_items',
      header: t('stocktakes.itemCount'),
      render: (row) => <span className="text-sm text-text-primary">{row.total_items}</span>,
    },
    {
      key: 'discrepancy_count',
      header: t('stocktakes.discrepancyCount'),
      render: (row) => (
        <span className={row.discrepancy_count > 0 ? 'text-sm font-semibold text-amber-400' : 'text-sm text-text-primary'}>
          {row.discrepancy_count}
        </span>
      ),
    },
    {
      key: 'notes',
      header: t('stocktakes.notes'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-text-muted truncate max-w-[150px] block">
          {row.notes ? (row.notes.length > 40 ? `${row.notes.slice(0, 40)}...` : row.notes) : '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: t('stocktakes.createdAt'),
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => handleViewDetail(row)}>
            {t('stocktakes.detail')}
          </Button>
          {row.status === 'DRAFT' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleStart(row.id)}
              loading={actionLoadingId === row.id}
              disabled={actionLoadingId !== null}
            >
              {t('stocktakes.start')}
            </Button>
          )}
          {row.status === 'IN_PROGRESS' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openCountModal(row.id)}
                disabled={actionLoadingId !== null}
              >
                {t('stocktakes.count')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleComplete(row.id)}
                loading={actionLoadingId === row.id}
                disabled={actionLoadingId !== null}
              >
                {t('stocktakes.complete')}
              </Button>
            </>
          )}
          {(row.status === 'DRAFT' || row.status === 'IN_PROGRESS') && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleCancel(row.id)}
              loading={actionLoadingId === row.id}
              disabled={actionLoadingId !== null}
            >
              {t('stocktakes.abort')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Columns: Detail items
  const itemColumns: Column<StocktakeItem>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (row) => <span className="font-mono text-xs font-medium text-accent-purple">{row.sku}</span>,
    },
    {
      key: 'location_code',
      header: t('stocktakes.location'),
      render: (row) => <span className="text-sm text-text-secondary">{row.location_code}</span>,
    },
    {
      key: 'expected_qty',
      header: t('stocktakes.expectedQty'),
      render: (row) => <span className="text-sm text-text-primary">{row.expected_qty}</span>,
    },
    {
      key: 'actual_qty',
      header: t('stocktakes.actualQty'),
      render: (row) => (
        <span className="text-sm text-text-primary">{row.actual_qty != null ? row.actual_qty : '-'}</span>
      ),
    },
    {
      key: 'discrepancy',
      header: t('stocktakes.discrepancy'),
      render: (row) => (
        <span className={row.discrepancy && row.discrepancy !== 0 ? 'text-sm font-semibold text-amber-400' : 'text-sm text-text-primary'}>
          {row.discrepancy != null ? row.discrepancy : '-'}
        </span>
      ),
    },
    {
      key: 'notes',
      header: t('stocktakes.notes'),
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-muted">{row.notes || '-'}</span>,
    },
  ];

  const totalPages = Math.ceil(totalCount / limit);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">{t('stocktakes.title')}</h1>
        <Card>
          <CardContent>
            <p className="text-sm text-text-muted">{t('stocktakes.adminOnly')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('stocktakes.title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('stocktakes.subtitle')}</p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Select label="" value={statusFilter} onChange={(e) => handleStatusFilterChange(e.target.value)}>
                <option value="">{t('stocktakes.allStatuses')}</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setCreateNotes('');
                setShowCreateModal(true);
              }}
            >
              {t('stocktakes.create')}
            </Button>
          </div>

          <DataTable columns={stocktakeColumns} data={stocktakes} loading={loading} emptyMessage={t('stocktakes.empty', 'No stocktakes found')} />

          <div className="mt-4">
            <Pagination page={page} pages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      {/* Create Stocktake Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('stocktakes.create')}>
        <div className="space-y-4">
          <Input
            label={t('stocktakes.notesOptional')}
            type="text"
            value={createNotes}
            onChange={(e) => setCreateNotes(e.target.value)}
            placeholder={t('stocktakes.notesPlaceholder')}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleCreate} loading={creating}>
              {t('stocktakes.createBtn')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={detailStocktake ? t('stocktakes.detailTitle', { id: detailStocktake.id }) : t('stocktakes.detailTitleGeneric')}
      >
        <div className="space-y-4">
          {detailStocktake && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">{t('stocktakes.statusLabel')}</span>
                <span className="ml-2"><StatusBadge status={detailStocktake.status} /></span>
              </div>
              <div>
                <span className="text-text-muted">{t('stocktakes.itemCountLabel')}</span>
                <span className="ml-2 text-text-primary">{detailStocktake.total_items}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('stocktakes.discrepancyCountLabel')}</span>
                <span className="ml-2 text-text-primary">{detailStocktake.discrepancy_count}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('stocktakes.createdAtLabel')}</span>
                <span className="ml-2 text-text-primary">{formatDate(detailStocktake.created_at)}</span>
              </div>
              {detailStocktake.notes && (
                <div className="col-span-2">
                  <span className="text-text-muted">{t('stocktakes.notesLabel')}</span>
                  <span className="ml-2 text-text-primary">{detailStocktake.notes}</span>
                </div>
              )}
            </div>
          )}

          <DataTable columns={itemColumns} data={detailItems} loading={detailLoading} emptyMessage={t('stocktakes.emptyItems', 'No items counted yet')} />
        </div>
      </Modal>

      {/* Count Item Modal */}
      <Modal open={showCountModal} onClose={() => setShowCountModal(false)} title={t('stocktakes.itemCountModal')}>
        <div className="space-y-4">
          <Input
            label="SKU"
            type="text"
            value={countSku}
            onChange={(e) => setCountSku(e.target.value)}
            placeholder={t('stocktakes.skuPlaceholder')}
          />

          <Input
            label={t('stocktakes.locationCode')}
            type="text"
            value={countLocationCode}
            onChange={(e) => setCountLocationCode(e.target.value)}
            placeholder={t('stocktakes.locationPlaceholder')}
          />

          <Input
            label={t('stocktakes.actualQty')}
            type="number"
            value={countActualQty}
            onChange={(e) => setCountActualQty(e.target.value)}
            placeholder={t('stocktakes.actualQtyPlaceholder')}
          />

          <Input
            label={t('stocktakes.notesOptional')}
            type="text"
            value={countNotes}
            onChange={(e) => setCountNotes(e.target.value)}
            placeholder={t('stocktakes.notesInputPlaceholder')}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowCountModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleCountItem} loading={counting}>
              {t('stocktakes.record')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
