import { useState, useEffect, useCallback } from 'react';
import { purchaseOrdersApi, type PurchaseOrder } from '@/api/endpoints/purchase-orders';
import { suppliersApi } from '@/api/endpoints/suppliers';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable, type Column } from '@/components/data/DataTable';
import { StatCard } from '@/components/data/StatCard';
import { StatusBadge } from '@/components/data/StatusBadge';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePagination } from '@/hooks/usePagination';
import { formatDate, formatCurrency } from '@/utils/format';
import { downloadObjectsCsv } from '@/utils/download';

interface Supplier {
  id: number;
  name: string;
}

interface POItem {
  sku: string;
  qty: number;
  unit_cost: number;
}

const STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'SHIPPED', 'RECEIVED', 'CLOSED'] as const;

const NEXT_STATUS: Record<string, string> = {
  DRAFT: 'SUBMITTED',
  SUBMITTED: 'CONFIRMED',
  CONFIRMED: 'SHIPPED',
};

export default function PurchaseOrdersPage() {
  const { addToast } = useUIStore();
  const { isAdmin } = useAuthStore();
  const { page, limit, setPage, resetPage } = usePagination();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formExpectedDelivery, setFormExpectedDelivery] = useState('');
  const [formItems, setFormItems] = useState<POItem[]>([{ sku: '', qty: 1, unit_cost: 0 }]);

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: { offset: number; limit: number; status?: string } = {
        offset: (page - 1) * limit,
        limit,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await purchaseOrdersApi.list(params);
      setOrders(res.orders || []);
      setTotalPages(Math.ceil(res.total / limit) || 1);
    } catch {
      addToast('error', '発注一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, addToast]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await suppliersApi.list({ limit: 100 });
      setSuppliers(res.suppliers || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    resetPage();
  };

  const handleCreatePO = async () => {
    if (!formSupplierId) {
      addToast('error', '仕入先を選択してください');
      return;
    }
    const validItems = formItems.filter((item) => item.sku && item.qty > 0 && item.unit_cost > 0);
    if (validItems.length === 0) {
      addToast('error', '有効な明細を1つ以上追加してください');
      return;
    }
    setCreating(true);
    try {
      await purchaseOrdersApi.create({
        supplier_id: Number(formSupplierId),
        notes: formNotes || undefined,
        expected_delivery: formExpectedDelivery || undefined,
        items: validItems,
      });
      addToast('success', '発注書を作成しました');
      setShowCreateModal(false);
      resetForm();
      fetchOrders();
    } catch {
      addToast('error', '発注書の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      if (newStatus === 'RECEIVED') {
        await purchaseOrdersApi.receive(id);
      } else {
        await purchaseOrdersApi.updateStatus(id, newStatus);
      }
      addToast('success', `ステータスを${newStatus}に更新しました`);
      fetchOrders();
    } catch {
      addToast('error', 'ステータスの更新に失敗しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params: { offset: number; limit: number; status?: string } = { offset: 0, limit: 10000 };
      if (statusFilter) params.status = statusFilter;
      const res = await purchaseOrdersApi.list(params);
      const rows = (res.orders || []).map((po) => ({
        PO番号: po.po_number,
        仕入先: po.supplier_name || '',
        ステータス: po.status,
        合計金額: po.total_amount,
        納品予定日: po.expected_delivery || '',
        作成日: po.created_at,
      }));
      downloadObjectsCsv(rows, 'purchase-orders.csv');
      addToast('success', 'CSVをエクスポートしました');
    } catch {
      addToast('error', 'CSVエクスポートに失敗しました');
    } finally {
      setExporting(false);
    }
  };

  const resetForm = () => {
    setFormSupplierId('');
    setFormNotes('');
    setFormExpectedDelivery('');
    setFormItems([{ sku: '', qty: 1, unit_cost: 0 }]);
  };

  const addItem = () => {
    setFormItems([...formItems, { sku: '', qty: 1, unit_cost: 0 }]);
  };

  const removeItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof POItem, value: string | number) => {
    setFormItems(formItems.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const columns: Column<PurchaseOrder>[] = [
    { key: 'po_number', header: 'PO番号' },
    {
      key: 'supplier_name',
      header: '仕入先',
      hideOnMobile: true,
      render: (row) => <span>{row.supplier_name || '-'}</span>,
    },
    {
      key: 'status',
      header: 'ステータス',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'total_amount',
      header: '合計金額',
      render: (row) => <span>{formatCurrency(row.total_amount)}</span>,
    },
    {
      key: 'expected_delivery',
      header: '納品予定日',
      hideOnMobile: true,
      render: (row) => <span>{row.expected_delivery ? formatDate(row.expected_delivery) : '-'}</span>,
    },
    {
      key: 'created_at',
      header: '作成日',
      hideOnMobile: true,
      render: (row) => <span>{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        if (!isAdmin) return null;
        const nextStatus = NEXT_STATUS[row.status];
        return (
          <div className="flex gap-2">
            {nextStatus && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleUpdateStatus(row.id, nextStatus)}
                loading={updatingId === row.id}
                disabled={updatingId !== null}
              >
                → {nextStatus}
              </Button>
            )}
            {row.status === 'SHIPPED' && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleUpdateStatus(row.id, 'RECEIVED')}
                loading={updatingId === row.id}
                disabled={updatingId !== null}
              >
                受領
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">発注管理</h1>
        <p className="text-sm text-text-muted mt-1">仕入先への発注書を管理します</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<span className="text-lg">📋</span>}
          title="下書き"
          value={orders.filter((o) => o.status === 'DRAFT').length}
          accent="purple"
        />
        <StatCard
          icon={<span className="text-lg">📤</span>}
          title="提出済"
          value={orders.filter((o) => o.status === 'SUBMITTED').length}
          accent="purple"
        />
        <StatCard
          icon={<span className="text-lg">✅</span>}
          title="確認済"
          value={orders.filter((o) => o.status === 'CONFIRMED').length}
          accent="purple"
        />
        <StatCard
          icon={<span className="text-lg">🚚</span>}
          title="発送済"
          value={orders.filter((o) => o.status === 'SHIPPED').length}
          accent="purple"
        />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Select label="" value={statusFilter} onChange={(e) => handleStatusFilterChange(e.target.value)}>
                <option value="">全ステータス</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleExportCsv} loading={exporting}>
                CSVエクスポート
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                >
                  新規発注
                </Button>
              )}
            </div>
          </div>

          <DataTable columns={columns} data={orders} loading={loading} />

          <div className="mt-4">
            <Pagination page={page} pages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="新規発注書">
        <div className="space-y-4">
          <Select
            label="仕入先"
            value={formSupplierId}
            onChange={(e) => setFormSupplierId(e.target.value)}
          >
            <option value="">選択してください</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>

          <Input
            label="納品予定日"
            type="date"
            value={formExpectedDelivery}
            onChange={(e) => setFormExpectedDelivery(e.target.value)}
          />

          <Input
            label="備考"
            type="text"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="備考を入力"
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">明細</span>
              <Button size="sm" variant="secondary" onClick={addItem}>
                + 行追加
              </Button>
            </div>
            <div className="space-y-3">
              {formItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      label="SKU"
                      type="text"
                      value={item.sku}
                      onChange={(e) => updateItem(index, 'sku', e.target.value)}
                      placeholder="SKU"
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      label="数量"
                      type="number"
                      value={String(item.qty)}
                      onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      label="単価"
                      type="number"
                      value={String(item.unit_cost)}
                      onChange={(e) => updateItem(index, 'unit_cost', Number(e.target.value))}
                    />
                  </div>
                  {formItems.length > 1 && (
                    <Button size="sm" variant="secondary" onClick={() => removeItem(index)}>
                      削除
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowCreateModal(false)}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handleCreatePO} loading={creating}>
              作成
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
