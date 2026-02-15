import { useState, useEffect, useCallback } from 'react';
import {
  customerSegmentsApi,
  type Segment,
  type RfmCustomer,
} from '@/api/endpoints/customer-segments';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/data/DataTable';
import { useUIStore } from '@/stores/ui.store';
import { usePagination } from '@/hooks/usePagination';
import { formatDate, formatCurrency } from '@/utils/format';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/utils/cn';

type TabId = 'segments' | 'rfm';

interface SegmentCustomer {
  id: number;
  name: string;
  email?: string;
  total_orders?: number;
  total_spent?: number;
  [key: string]: unknown;
}

export default function CustomerSegmentsPage() {
  const { addToast } = useUIStore();
  const { page, limit, setPage, resetPage } = usePagination();

  const [activeTab, setActiveTab] = useState<TabId>('segments');

  // Segments state
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [savingSegment, setSavingSegment] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [segmentCriteria, setSegmentCriteria] = useState('{}');
  const [criteriaError, setCriteriaError] = useState('');
  const [deletingSegmentId, setDeletingSegmentId] = useState<number | null>(null);

  // Segment customers modal
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [viewingSegment, setViewingSegment] = useState<Segment | null>(null);
  const [segmentCustomers, setSegmentCustomers] = useState<SegmentCustomer[]>([]);
  const [segmentCustomersTotal, setSegmentCustomersTotal] = useState(0);
  const [segmentCustomersLoading, setSegmentCustomersLoading] = useState(false);
  const [customersPage, setCustomersPage] = useState(1);
  const customersLimit = 20;

  // RFM state
  const [rfmCustomers, setRfmCustomers] = useState<RfmCustomer[]>([]);
  const [rfmLoading, setRfmLoading] = useState(false);

  // Fetch segments
  const fetchSegments = useCallback(async () => {
    setSegmentsLoading(true);
    try {
      const res = await customerSegmentsApi.listSegments();
      setSegments(res.segments || []);
    } catch {
      addToast('error', 'セグメント一覧の取得に失敗しました');
    } finally {
      setSegmentsLoading(false);
    }
  }, [addToast]);

  // Fetch RFM
  const fetchRfm = useCallback(async () => {
    setRfmLoading(true);
    try {
      const res = await customerSegmentsApi.rfm();
      setRfmCustomers(res.customers || []);
    } catch {
      addToast('error', 'RFM分析データの取得に失敗しました');
    } finally {
      setRfmLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (activeTab === 'segments') fetchSegments();
    if (activeTab === 'rfm') fetchRfm();
  }, [activeTab, fetchSegments, fetchRfm]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    resetPage();
  };

  // Create/Edit segment
  const handleSaveSegment = async () => {
    if (!segmentName) {
      addToast('error', 'セグメント名は必須です');
      return;
    }
    let parsedCriteria: Record<string, unknown>;
    try {
      parsedCriteria = JSON.parse(segmentCriteria);
      setCriteriaError('');
    } catch {
      setCriteriaError('有効なJSONを入力してください');
      return;
    }
    setSavingSegment(true);
    try {
      if (editingSegment) {
        await customerSegmentsApi.updateSegment(editingSegment.id, {
          name: segmentName,
          criteria: parsedCriteria,
        });
        addToast('success', 'セグメントを更新しました');
      } else {
        await customerSegmentsApi.createSegment({
          name: segmentName,
          criteria: parsedCriteria,
        });
        addToast('success', 'セグメントを作成しました');
      }
      setShowSegmentModal(false);
      resetSegmentForm();
      fetchSegments();
    } catch {
      addToast('error', 'セグメントの保存に失敗しました');
    } finally {
      setSavingSegment(false);
    }
  };

  const resetSegmentForm = () => {
    setEditingSegment(null);
    setSegmentName('');
    setSegmentCriteria('{}');
    setCriteriaError('');
  };

  const openEditSegment = (seg: Segment) => {
    setEditingSegment(seg);
    setSegmentName(seg.name);
    setSegmentCriteria(JSON.stringify(seg.criteria, null, 2));
    setCriteriaError('');
    setShowSegmentModal(true);
  };

  const handleDeleteSegment = async (id: number) => {
    if (!window.confirm('このセグメントを削除しますか？')) return;
    setDeletingSegmentId(id);
    try {
      await customerSegmentsApi.deleteSegment(id);
      addToast('success', 'セグメントを削除しました');
      fetchSegments();
    } catch {
      addToast('error', 'セグメントの削除に失敗しました');
    } finally {
      setDeletingSegmentId(null);
    }
  };

  // View segment customers
  const fetchSegmentCustomers = useCallback(async (segId: number, pg: number) => {
    setSegmentCustomersLoading(true);
    try {
      const res = await customerSegmentsApi.segmentCustomers(segId, (pg - 1) * customersLimit, customersLimit);
      setSegmentCustomers((res.customers || []) as SegmentCustomer[]);
      setSegmentCustomersTotal(res.total || 0);
    } catch {
      addToast('error', 'セグメント顧客の取得に失敗しました');
    } finally {
      setSegmentCustomersLoading(false);
    }
  }, [addToast]);

  const openCustomersModal = (seg: Segment) => {
    setViewingSegment(seg);
    setCustomersPage(1);
    setShowCustomersModal(true);
    fetchSegmentCustomers(seg.id, 1);
  };

  const handleCustomersPageChange = (pg: number) => {
    setCustomersPage(pg);
    if (viewingSegment) {
      fetchSegmentCustomers(viewingSegment.id, pg);
    }
  };

  // RFM pagination (client-side)
  const rfmTotalPages = Math.ceil(rfmCustomers.length / limit);
  const rfmPageData = rfmCustomers.slice((page - 1) * limit, page * limit);

  // Columns: Segments
  const segmentColumns: Column<Segment>[] = [
    { key: 'name', header: 'セグメント名' },
    {
      key: 'customer_count',
      header: '顧客数',
      render: (row) => <span className="font-medium text-text-primary">{row.customer_count}</span>,
    },
    {
      key: 'criteria',
      header: '条件',
      hideOnMobile: true,
      render: (row) => {
        const text = JSON.stringify(row.criteria);
        return (
          <span className="text-xs text-text-muted truncate max-w-[200px] block">
            {text.length > 60 ? `${text.slice(0, 60)}...` : text}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      header: '作成日',
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openCustomersModal(row)}>
            顧客表示
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openEditSegment(row)}>
            編集
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleDeleteSegment(row.id)}
            loading={deletingSegmentId === row.id}
            disabled={deletingSegmentId !== null}
          >
            削除
          </Button>
        </div>
      ),
    },
  ];

  // Columns: RFM
  const rfmColumns: Column<RfmCustomer>[] = [
    {
      key: 'name',
      header: '顧客名',
      render: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
    },
    {
      key: 'recency',
      header: 'Recency',
      render: (row) => <span className="text-sm text-text-secondary">{row.recency}</span>,
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: (row) => <span className="text-sm text-text-secondary">{row.frequency}</span>,
    },
    {
      key: 'monetary',
      header: 'Monetary',
      render: (row) => <span className="text-sm text-text-secondary">{formatCurrency(row.monetary)}</span>,
    },
    {
      key: 'rfm_score',
      header: 'RFMスコア',
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-accent-purple">
          {row.rfm_score}
        </span>
      ),
    },
  ];

  // Columns: Segment customers
  const customerColumns: Column<SegmentCustomer>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (row) => <span className="font-mono text-xs text-text-muted">#{row.id}</span>,
    },
    {
      key: 'name',
      header: '顧客名',
      render: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
    },
    {
      key: 'email',
      header: 'メール',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-secondary">{row.email || '-'}</span>,
    },
    {
      key: 'total_orders',
      header: '注文数',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-secondary">{row.total_orders ?? '-'}</span>,
    },
    {
      key: 'total_spent',
      header: '合計金額',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-text-secondary">
          {row.total_spent != null ? formatCurrency(row.total_spent) : '-'}
        </span>
      ),
    },
  ];

  const customersTotalPages = Math.ceil(segmentCustomersTotal / customersLimit);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'segments', label: 'セグメント' },
    { id: 'rfm', label: 'RFM分析' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">顧客セグメント</h1>
        <p className="text-sm text-text-muted mt-1">顧客セグメントとRFM分析を管理します</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-accent-purple text-accent-purple'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Segments Tab */}
      {activeTab === 'segments' && (
        <Card>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-text-primary">セグメント一覧</h2>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  resetSegmentForm();
                  setShowSegmentModal(true);
                }}
              >
                新規セグメント
              </Button>
            </div>

            <DataTable columns={segmentColumns} data={segments} loading={segmentsLoading} />
          </CardContent>
        </Card>
      )}

      {/* RFM Tab */}
      {activeTab === 'rfm' && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-text-primary mb-4">RFM分析</h2>

            <DataTable columns={rfmColumns} data={rfmPageData} loading={rfmLoading} />

            {rfmTotalPages > 1 && (
              <div className="mt-4">
                <Pagination page={page} pages={rfmTotalPages} onPageChange={setPage} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Segment Create/Edit Modal */}
      <Modal
        open={showSegmentModal}
        onClose={() => setShowSegmentModal(false)}
        title={editingSegment ? 'セグメント編集' : '新規セグメント'}
      >
        <div className="space-y-4">
          <Input
            label="セグメント名"
            type="text"
            value={segmentName}
            onChange={(e) => setSegmentName(e.target.value)}
            placeholder="セグメント名を入力"
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              条件 (JSON)
            </label>
            <textarea
              className={cn(
                'w-full rounded-lg border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple font-mono',
                criteriaError ? 'border-red-500' : 'border-border',
              )}
              rows={6}
              value={segmentCriteria}
              onChange={(e) => {
                setSegmentCriteria(e.target.value);
                setCriteriaError('');
              }}
              placeholder='{"min_orders": 5, "min_spent": 10000}'
            />
            {criteriaError && (
              <p className="mt-1 text-xs text-red-500">{criteriaError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowSegmentModal(false)}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handleSaveSegment} loading={savingSegment}>
              {editingSegment ? '更新' : '作成'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Segment Customers Modal */}
      <Modal
        open={showCustomersModal}
        onClose={() => setShowCustomersModal(false)}
        title={viewingSegment ? `${viewingSegment.name} - 顧客一覧` : '顧客一覧'}
      >
        <div className="space-y-4">
          <DataTable columns={customerColumns} data={segmentCustomers} loading={segmentCustomersLoading} />

          {customersTotalPages > 1 && (
            <Pagination page={customersPage} pages={customersTotalPages} onPageChange={handleCustomersPageChange} />
          )}
        </div>
      </Modal>
    </div>
  );
}
