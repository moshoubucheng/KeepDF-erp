import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      addToast('error', t('supplier.error_fetch'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, addToast, t]);

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
      addToast('error', t('supplier.error_name_required'));
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
        addToast('success', t('supplier.success_updated'));
      } else {
        await suppliersApi.create(payload);
        addToast('success', t('supplier.success_created'));
      }
      setShowModal(false);
      fetchSuppliers();
    } catch {
      addToast('error', editingId ? t('supplier.error_update') : t('supplier.error_create'));
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
      addToast('success', t('supplier.success_deactivated'));
      setShowDeleteConfirm(false);
      setDeletingId(null);
      fetchSuppliers();
    } catch {
      addToast('error', t('supplier.error_deactivate'));
    } finally {
      setDeleting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const columns: Column<Supplier>[] = [
    { key: 'name', header: t('procurement.supplier_name') },
    {
      key: 'contact_person',
      header: t('supplier.contact_person'),
      hideOnMobile: true,
      render: (row) => <span>{row.contact_person || '-'}</span>,
    },
    {
      key: 'email',
      header: t('supplier.email'),
      hideOnMobile: true,
      render: (row) => <span className="text-text-secondary">{row.email || '-'}</span>,
    },
    {
      key: 'phone',
      header: t('supplier.phone'),
      hideOnMobile: true,
      render: (row) => <span>{row.phone || '-'}</span>,
    },
    {
      key: 'lead_time_days',
      header: t('procurement.lead_time'),
      hideOnMobile: true,
      render: (row) => <span>{row.lead_time_days != null ? `${row.lead_time_days}${t('procurement.days')}` : '-'}</span>,
    },
    {
      key: 'is_active',
      header: t('procurement.status'),
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
              {t('common.edit')}
            </Button>
            {row.is_active ? (
              <Button size="sm" variant="secondary" onClick={() => confirmDelete(row.id)}>
                {t('supplier.deactivate')}
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
        <h1 className="text-2xl font-bold text-text-primary">{t('supplier.page_title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('supplier.page_subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<span className="text-lg">✅</span>}
          title={t('common.active')}
          value={activeCount}
          accent="purple"
        />
        <StatCard
          icon={<span className="text-lg">⛔</span>}
          title={t('common.inactive')}
          value={inactiveCount}
        />
      </div>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-secondary">{t('supplier.list_title')}</span>
            {isAdmin && (
              <Button size="sm" variant="primary" onClick={openCreateModal}>
                {t('supplier.add_new')}
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
        title={editingId ? t('supplier.modal_edit') : t('supplier.modal_create')}
      >
        <div className="space-y-4">
          <Input
            label={t('procurement.supplier_name')}
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={t('supplier.placeholder_name')}
            autoFocus
          />
          <Input
            label={t('supplier.contact_person')}
            type="text"
            value={form.contact_person}
            onChange={(e) => updateField('contact_person', e.target.value)}
            placeholder={t('supplier.placeholder_contact')}
          />
          <Input
            label={t('supplier.email_address')}
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="email@example.com"
          />
          <Input
            label={t('supplier.phone_number')}
            type="tel"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="090-0000-0000"
          />
          <Input
            label={t('supplier.address')}
            type="text"
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder={t('supplier.placeholder_address')}
          />
          <Input
            label={t('supplier.lead_time_days')}
            type="number"
            value={form.lead_time_days}
            onChange={(e) => updateField('lead_time_days', e.target.value)}
            placeholder="7"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? t('common.update') : t('supplier.add')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title={t('supplier.modal_deactivate')}>
        <div className="space-y-4">
          <p className="text-text-secondary">{t('supplier.confirm_deactivate')}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleDelete} loading={deleting}>
              {t('supplier.deactivate_confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
