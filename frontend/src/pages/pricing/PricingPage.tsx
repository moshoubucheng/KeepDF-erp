import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { pricingApi, type PriceRule, type PriceHistory, type MarginAnalysis } from '@/api/endpoints/pricing';
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
import { formatDate, formatCurrency } from '@/utils/format';
import { downloadObjectsCsv } from '@/utils/download';

type TabType = 'rules' | 'history' | 'margins';

const EMPTY_RULE_FORM = {
  sku: '',
  platform: '',
  base_price: '',
  sale_price: '',
  valid_from: '',
  valid_to: '',
};

export default function PricingPage() {
  const { t } = useTranslation();
  const { addToast } = useUIStore();
  const { isAdmin } = useAuthStore();
  const { page, limit, setPage, resetPage } = usePagination();

  const TABS: { key: TabType; label: string }[] = [
    { key: 'rules', label: t('pricing.tab_rules') },
    { key: 'history', label: t('pricing.tab_history') },
    { key: 'margins', label: t('pricing.margin') },
  ];

  const [activeTab, setActiveTab] = useState<TabType>('rules');
  const [platformFilter, setPlatformFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  const [rules, setRules] = useState<PriceRule[]>([]);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [margins, setMargins] = useState<MarginAnalysis[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback(() => {
    const params: { offset: number; limit: number; platform?: string; sku?: string } = {
      offset: (page - 1) * limit,
      limit,
    };
    if (platformFilter) params.platform = platformFilter;
    if (skuFilter) params.sku = skuFilter;
    return params;
  }, [page, limit, platformFilter, skuFilter]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pricingApi.list(buildParams());
      setRules(res.rules || []);
      setTotalPages(Math.ceil(res.total / limit) || 1);
    } catch {
      addToast('error', t('pricing.error_fetch_rules'));
    } finally {
      setLoading(false);
    }
  }, [buildParams, limit, addToast, t]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pricingApi.history(buildParams());
      setHistory(res.history || []);
      setTotalPages(Math.ceil(res.total / limit) || 1);
    } catch {
      addToast('error', t('pricing.error_fetch_history'));
    } finally {
      setLoading(false);
    }
  }, [buildParams, limit, addToast, t]);

  const fetchMargins = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res = await pricingApi.margins({ sku: params.sku, platform: params.platform });
      setMargins(res.margins || []);
      setTotalPages(1);
    } catch {
      addToast('error', t('pricing.error_fetch_margins'));
    } finally {
      setLoading(false);
    }
  }, [buildParams, addToast, t]);

  useEffect(() => {
    if (activeTab === 'rules') fetchRules();
    else if (activeTab === 'history') fetchHistory();
    else if (activeTab === 'margins') fetchMargins();
  }, [activeTab, fetchRules, fetchHistory, fetchMargins]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    resetPage();
  };

  const handleFilterChange = (field: 'platform' | 'sku', value: string) => {
    if (field === 'platform') setPlatformFilter(value);
    else setSkuFilter(value);
    resetPage();
  };

  const openCreateRuleModal = () => {
    setEditingRuleId(null);
    setRuleForm(EMPTY_RULE_FORM);
    setShowRuleModal(true);
  };

  const openEditRuleModal = (rule: PriceRule) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      sku: rule.sku,
      platform: rule.platform || '',
      base_price: String(rule.base_price),
      sale_price: rule.sale_price != null ? String(rule.sale_price) : '',
      valid_from: rule.valid_from || '',
      valid_to: rule.valid_to || '',
    });
    setShowRuleModal(true);
  };

  const handleSaveRule = async () => {
    if (!ruleForm.sku.trim() || !ruleForm.base_price) {
      addToast('error', t('pricing.error_required_fields'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        sku: ruleForm.sku.trim(),
        platform: ruleForm.platform || undefined,
        base_price: Number(ruleForm.base_price),
        sale_price: ruleForm.sale_price ? Number(ruleForm.sale_price) : undefined,
        valid_from: ruleForm.valid_from || undefined,
        valid_to: ruleForm.valid_to || undefined,
      };
      if (editingRuleId) {
        await pricingApi.update(editingRuleId, payload);
        addToast('success', t('pricing.success_updated'));
      } else {
        await pricingApi.create(payload);
        addToast('success', t('pricing.success_created'));
      }
      setShowRuleModal(false);
      fetchRules();
    } catch {
      addToast('error', editingRuleId ? t('pricing.error_update') : t('pricing.error_create'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    setDeletingId(id);
    try {
      await pricingApi.delete(id);
      addToast('success', t('pricing.success_deleted'));
      fetchRules();
    } catch {
      addToast('error', t('pricing.error_delete'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      if (activeTab === 'rules') {
        const res = await pricingApi.list({ ...buildParams(), offset: 0, limit: 10000 });
        const rows = (res.rules || []).map((r) => ({
          SKU: r.sku,
          プラットフォーム: r.platform || '',
          基本価格: r.base_price,
          セール価格: r.sale_price ?? '',
          有効開始: r.valid_from || '',
          ステータス: r.is_active ? 'ACTIVE' : 'INACTIVE',
        }));
        downloadObjectsCsv(rows, 'pricing-rules.csv');
      } else if (activeTab === 'history') {
        const res = await pricingApi.history({ ...buildParams(), offset: 0, limit: 10000 });
        const rows = (res.history || []).map((h) => ({
          SKU: h.sku,
          プラットフォーム: h.platform || '',
          旧価格: h.old_price,
          新価格: h.new_price,
          変更日: h.created_at,
        }));
        downloadObjectsCsv(rows, 'pricing-history.csv');
      } else {
        const params = buildParams();
        const res = await pricingApi.margins({ sku: params.sku, platform: params.platform });
        const rows = (res.margins || []).map((m) => ({
          SKU: m.sku,
          プラットフォーム: m.platform || '',
          原価: m.cost_price,
          基本価格: m.base_price,
          利益: m.margin,
          利益率: `${m.margin_percent.toFixed(1)}%`,
        }));
        downloadObjectsCsv(rows, 'pricing-margins.csv');
      }
      addToast('success', t('pricing.success_csv_export'));
    } catch {
      addToast('error', t('pricing.error_csv_export'));
    } finally {
      setExporting(false);
    }
  };

  const updateRuleField = (field: string, value: string) => {
    setRuleForm((prev) => ({ ...prev, [field]: value }));
  };

  const rulesColumns: Column<PriceRule>[] = [
    { key: 'sku', header: 'SKU' },
    {
      key: 'platform',
      header: t('pricing.platform'),
      hideOnMobile: true,
      render: (row) => <span>{row.platform || t('pricing.all_platforms')}</span>,
    },
    {
      key: 'base_price',
      header: t('pricing.base_price'),
      render: (row) => <span>{formatCurrency(row.base_price)}</span>,
    },
    {
      key: 'sale_price',
      header: t('pricing.sale_price'),
      hideOnMobile: true,
      render: (row) => <span>{row.sale_price != null ? formatCurrency(row.sale_price) : '-'}</span>,
    },
    {
      key: 'valid_from',
      header: t('pricing.valid_from'),
      hideOnMobile: true,
      render: (row) => <span>{row.valid_from ? formatDate(row.valid_from) : '-'}</span>,
    },
    {
      key: 'is_active',
      header: t('pricing.status'),
      render: (row) => <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        if (!isAdmin) return null;
        return (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => openEditRuleModal(row)}>
              {t('common.edit')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleDeleteRule(row.id)}
              loading={deletingId === row.id}
              disabled={deletingId !== null}
            >
              {t('common.delete')}
            </Button>
          </div>
        );
      },
    },
  ];

  const historyColumns: Column<PriceHistory>[] = [
    { key: 'sku', header: 'SKU' },
    {
      key: 'platform',
      header: t('pricing.platform'),
      hideOnMobile: true,
      render: (row) => <span>{row.platform || '-'}</span>,
    },
    {
      key: 'old_price',
      header: t('pricing.old_price'),
      render: (row) => <span>{formatCurrency(row.old_price)}</span>,
    },
    {
      key: 'new_price',
      header: t('pricing.new_price'),
      render: (row) => <span>{formatCurrency(row.new_price)}</span>,
    },
    {
      key: 'created_at',
      header: t('pricing.change_date'),
      render: (row) => <span>{formatDate(row.created_at)}</span>,
    },
  ];

  const marginsColumns: Column<MarginAnalysis>[] = [
    { key: 'sku', header: 'SKU' },
    {
      key: 'platform',
      header: t('pricing.platform'),
      hideOnMobile: true,
      render: (row) => <span>{row.platform || '-'}</span>,
    },
    {
      key: 'cost_price',
      header: t('pricing.cost_price'),
      render: (row) => <span>{formatCurrency(row.cost_price)}</span>,
    },
    {
      key: 'base_price',
      header: t('pricing.base_price'),
      render: (row) => <span>{formatCurrency(row.base_price)}</span>,
    },
    {
      key: 'margin',
      header: t('pricing.profit'),
      render: (row) => (
        <span className={row.margin >= 0 ? 'text-green-500' : 'text-red-500'}>
          {formatCurrency(row.margin)}
        </span>
      ),
    },
    {
      key: 'margin_percent',
      header: t('pricing.margin'),
      render: (row) => (
        <span className={row.margin_percent >= 0 ? 'text-green-500' : 'text-red-500'}>
          {row.margin_percent.toFixed(1)}%
        </span>
      ),
    },
  ];

  const renderTable = () => {
    if (activeTab === 'rules') return <DataTable columns={rulesColumns} data={rules} loading={loading} />;
    if (activeTab === 'history') return <DataTable columns={historyColumns} data={history} loading={loading} />;
    return <DataTable columns={marginsColumns} data={margins} loading={loading} />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('pricing.page_title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('pricing.page_subtitle')}</p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex gap-1 bg-bg-card rounded-lg p-1 border border-border">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    activeTab === tab.key
                      ? 'bg-accent-purple text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleExportCsv} loading={exporting}>
                {t('pricing.csv_export')}
              </Button>
              {isAdmin && activeTab === 'rules' && (
                <Button size="sm" variant="primary" onClick={openCreateRuleModal}>
                  {t('pricing.new_rule')}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Select
              label=""
              value={platformFilter}
              onChange={(e) => handleFilterChange('platform', e.target.value)}
            >
              <option value="">{t('pricing.all_platforms')}</option>
              <option value="tiktok">TikTok</option>
              <option value="temu">Temu</option>
              <option value="rakuten">Rakuten</option>
            </Select>
            <Input
              label=""
              type="text"
              value={skuFilter}
              onChange={(e) => handleFilterChange('sku', e.target.value)}
              placeholder={t('pricing.search_sku')}
            />
          </div>

          {renderTable()}

          <div className="mt-4">
            <Pagination page={page} pages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title={editingRuleId ? t('pricing.modal_edit') : t('pricing.modal_create')}
      >
        <div className="space-y-4">
          <Input
            label="SKU"
            type="text"
            value={ruleForm.sku}
            onChange={(e) => updateRuleField('sku', e.target.value)}
            placeholder={t('pricing.placeholder_sku')}
            autoFocus
          />
          <Select
            label={t('pricing.platform')}
            value={ruleForm.platform}
            onChange={(e) => updateRuleField('platform', e.target.value)}
          >
            <option value="">{t('pricing.all_platforms')}</option>
            <option value="tiktok">TikTok</option>
            <option value="temu">Temu</option>
            <option value="rakuten">Rakuten</option>
          </Select>
          <Input
            label={t('pricing.base_price')}
            type="number"
            value={ruleForm.base_price}
            onChange={(e) => updateRuleField('base_price', e.target.value)}
            placeholder="0"
          />
          <Input
            label={t('pricing.sale_price')}
            type="number"
            value={ruleForm.sale_price}
            onChange={(e) => updateRuleField('sale_price', e.target.value)}
            placeholder={t('pricing.placeholder_optional')}
          />
          <Input
            label={t('pricing.valid_from')}
            type="date"
            value={ruleForm.valid_from}
            onChange={(e) => updateRuleField('valid_from', e.target.value)}
          />
          <Input
            label={t('pricing.valid_to')}
            type="date"
            value={ruleForm.valid_to}
            onChange={(e) => updateRuleField('valid_to', e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowRuleModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleSaveRule} loading={saving}>
              {editingRuleId ? t('common.update') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
