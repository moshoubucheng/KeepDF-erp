import { useState, useEffect, useCallback } from 'react';
import { suppliersApi, type Supplier } from '@/api/endpoints/suppliers';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable, type Column } from '@/components/data/DataTable';
import { StatCard } from '@/components/data/StatCard';
import { StatusBadge } from '@/components/data/StatusBadge';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePagination } from '@/hooks/usePagination';

const EMPTY_FORM = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  lead_time_days: '',
};

export default function SuppliersPage() {
  const { addToast } = useUIStore();
  const { isAdmin } = useAuthStore();
  const { page, limit, setPage } = usePagination();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await suppliersApi.list({ offset: (page - 1) * limit, limit });
      const data: Supplier[] = res.suppliers || [];
      setSuppliers(data);
      setTotalPages(Math.ceil(res.total / limit) || 1);
      setActiveCount(data.filter((s) => s.is_active).length);
      setInactiveCount(data.filter((s) => !s.is_active).length);
    } catch {
      addToast('error', '仕入先一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [page, limit, addToast]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      lead_time_days: supplier.lead_time_days != null ? String(supplier.lead_time_days) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      addToast('error', '仕入先名を入力してください');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : undefined,
      };
      if (editingId) {
        await suppliersApi.update(editingId, payload);
        addToast('success', '仕入先を更新しました');
      } else {
        await suppliersApi.create(payload);
        addToast('success', '仕入先を追加しました');
      }
      setShowModal(false);
      fetchSuppliers();
    } catch {
      addToast('error', editingId ? '仕入先の更新に失敗しました' : '仕入先の追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: number) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await suppliersApi.delete(deletingId);
      addToast('success', '仕入先を無効化しました');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      fetchSuppliers();
    } catch {
      addToast('error', '仕入先の無効化に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const columns: Column<Supplier>[] = [
    { key: 'name', header: '仕入先名' },
    {
      key: 'contact_person',
      header: '担当者',
      hideOnMobile: true,
      render: (row) => <span>{row.contact_person || '-'}</span>,
    },
    {
      key: 'email',
      header: 'メール',
      hideOnMobile: true,
      render: (row) => <span className="text-text-secondary">{row.email || '-'}</span>,
    },
    {
      key: 'phone',
      header: '電話',
      hideOnMobile: true,
      render: (row) => <span>{row.phone || '-'}</span>,
    },
    {
      key: 'lead_time_days',
      header: 'リードタイム',
      hideOnMobile: true,
      render: (row) => <span>{row.lead_time_days != null ? `${row.lead_time_days}日` : '-'}</span>,
    },
    {
      key: 'is_active',
      header: 'ステータス',
      render: (row) => <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        if (!isAdmin) return null;
        return (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => openEditModal(row)}>
              編集
            </Button>
            {row.is_active ? (
              <Button size="sm" variant="secondary" onClick={() => confirmDelete(row.id)}>
                無効化
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">仕入先管理</h1>
        <p className="text-sm text-text-muted mt-1">仕入先の登録・管理を行います</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<span className="text-lg">✅</span>}
          title="有効"
          value={activeCount}
          accent="purple"
        />
        <StatCard
          icon={<span className="text-lg">⛔</span>}
          title="無効"
          value={inactiveCount}
        />
      </div>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-secondary">仕入先一覧</span>
            {isAdmin && (
              <Button size="sm" variant="primary" onClick={openCreateModal}>
                新規追加
              </Button>
            )}
          </div>

          <DataTable columns={columns} data={suppliers} loading={loading} />

          <div className="mt-4">
            <Pagination page={page} pages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? '仕入先を編集' : '新規仕入先'}
      >
        <div className="space-y-4">
          <Input
            label="仕入先名"
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="仕入先名を入力"
            autoFocus
          />
          <Input
            label="担当者"
            type="text"
            value={form.contact_person}
            onChange={(e) => updateField('contact_person', e.target.value)}
            placeholder="担当者名を入力"
          />
          <Input
            label="メールアドレス"
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="email@example.com"
          />
          <Input
            label="電話番号"
            type="tel"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="090-0000-0000"
          />
          <Input
            label="住所"
            type="text"
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="住所を入力"
          />
          <Input
            label="リードタイム（日）"
            type="number"
            value={form.lead_time_days}
            onChange={(e) => updateField('lead_time_days', e.target.value)}
            placeholder="7"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowModal(false)}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? '更新' : '追加'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="仕入先の無効化">
        <div className="space-y-4">
          <p className="text-text-secondary">この仕入先を無効化しますか？無効化後も履歴は保持されます。</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handleDelete} loading={deleting}>
              無効化する
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
