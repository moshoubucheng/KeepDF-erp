import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { skuMappingsApi, type SkuMapping, type AiSkuSuggestion } from '@/api/endpoints/sku-mappings';
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
import { downloadCsv } from '@/utils/download';

const PLATFORM_OPTIONS = ['tiktok', 'temu', 'rakuten'] as const;

interface ValidationError {
  mapping_id: number;
  local_sku: string;
  platform: string;
  error: string;
}

interface ValidationResult {
  total: number;
  valid: number;
  invalid: number;
  errors: ValidationError[];
}

export default function SkuMappingsPage() {
  const { t } = useTranslation();
  const { addToast } = useUIStore();
  const { isAdmin } = useAuthStore();
  const { page, limit, setPage, resetPage } = usePagination();

  const [mappings, setMappings] = useState<SkuMapping[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [platformFilter, setPlatformFilter] = useState('');
  const [skuSearch, setSkuSearch] = useState('');

  // Create/Edit modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<SkuMapping | null>(null);
  const [saving, setSaving] = useState(false);
  const [formLocalSku, setFormLocalSku] = useState('');
  const [formPlatform, setFormPlatform] = useState('');
  const [formPlatformSku, setFormPlatformSku] = useState('');
  const [formPlatformTitle, setFormPlatformTitle] = useState('');
  const [formPriceSync, setFormPriceSync] = useState(false);
  const [formStockSync, setFormStockSync] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Validate modal
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  // AI Suggest
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSku, setAiSku] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSkuSuggestion[]>([]);
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set());
  const [aiApplying, setAiApplying] = useState(false);
  const [aiBulkMode, setAiBulkMode] = useState(false);
  const [aiBulkAnalyzed, setAiBulkAnalyzed] = useState(0);

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const params: { offset?: number; limit?: number; platform?: string; local_sku?: string } = {
        offset: (page - 1) * limit,
        limit,
      };
      if (platformFilter) params.platform = platformFilter;
      if (skuSearch) params.local_sku = skuSearch;
      const res = await skuMappingsApi.list(params);
      setMappings(res.mappings || []);
      setTotalCount(res.total || 0);
    } catch {
      addToast('error', t('skuMappings.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, platformFilter, skuSearch, addToast, t]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const handlePlatformFilterChange = (value: string) => {
    setPlatformFilter(value);
    resetPage();
  };

  const handleSkuSearchChange = (value: string) => {
    setSkuSearch(value);
    resetPage();
  };

  // Create/Edit
  const resetForm = () => {
    setEditingMapping(null);
    setFormLocalSku('');
    setFormPlatform('');
    setFormPlatformSku('');
    setFormPlatformTitle('');
    setFormPriceSync(false);
    setFormStockSync(false);
  };

  const openEditModal = (mapping: SkuMapping) => {
    setEditingMapping(mapping);
    setFormLocalSku(mapping.local_sku);
    setFormPlatform(mapping.platform);
    setFormPlatformSku(mapping.platform_sku);
    setFormPlatformTitle(mapping.platform_title || '');
    setFormPriceSync(mapping.price_sync === 1);
    setFormStockSync(mapping.stock_sync === 1);
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!formLocalSku || !formPlatform || !formPlatformSku) {
      addToast('error', t('skuMappings.requiredFieldsError'));
      return;
    }
    setSaving(true);
    try {
      if (editingMapping) {
        await skuMappingsApi.update(editingMapping.id, {
          local_sku: formLocalSku,
          platform: formPlatform,
          platform_sku: formPlatformSku,
          platform_title: formPlatformTitle || undefined,
          price_sync: formPriceSync ? 1 : 0,
          stock_sync: formStockSync ? 1 : 0,
        });
        addToast('success', t('skuMappings.updateSuccess'));
      } else {
        await skuMappingsApi.create({
          local_sku: formLocalSku,
          platform: formPlatform,
          platform_sku: formPlatformSku,
          platform_title: formPlatformTitle || undefined,
          price_sync: formPriceSync ? 1 : 0,
          stock_sync: formStockSync ? 1 : 0,
        });
        addToast('success', t('skuMappings.createSuccess'));
      }
      setShowFormModal(false);
      resetForm();
      fetchMappings();
    } catch {
      addToast('error', t('skuMappings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: number) => {
    if (!window.confirm(t('skuMappings.deleteConfirm'))) return;
    setDeletingId(id);
    try {
      await skuMappingsApi.delete(id);
      addToast('success', t('skuMappings.deleteSuccess'));
      fetchMappings();
    } catch {
      addToast('error', t('skuMappings.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  // Validate
  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    setShowValidateModal(true);
    try {
      const res = await skuMappingsApi.validate();
      setValidationResult(res);
    } catch {
      addToast('error', t('skuMappings.validateError'));
      setShowValidateModal(false);
    } finally {
      setValidating(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const csvContent = await skuMappingsApi.export();
      downloadCsv('sku-mappings.csv', csvContent);
      addToast('success', t('skuMappings.exportSuccess'));
    } catch {
      addToast('error', t('skuMappings.exportError'));
    } finally {
      setExporting(false);
    }
  };

  // AI Suggest (Plan A)
  const handleAiSuggest = async () => {
    if (!aiSku.trim()) return;
    setAiGenerating(true);
    setAiSuggestions([]);
    setAiSelected(new Set());
    setAiBulkMode(false);
    try {
      const res = await skuMappingsApi.aiSuggest(aiSku.trim());
      setAiSuggestions(res.suggestions || []);
      setAiSelected(new Set(res.suggestions?.map((_, i) => i) || []));
    } catch {
      addToast('error', t('skuMappings.aiSuggestError'));
    } finally {
      setAiGenerating(false);
    }
  };

  // AI Bulk Suggest (Plan C)
  const handleAiBulkSuggest = async () => {
    setAiGenerating(true);
    setAiSuggestions([]);
    setAiSelected(new Set());
    setAiBulkMode(true);
    setAiBulkAnalyzed(0);
    setShowAiModal(true);
    setAiSku('');
    try {
      const res = await skuMappingsApi.aiBulkSuggest();
      setAiSuggestions(res.suggestions || []);
      setAiSelected(new Set(res.suggestions?.map((_, i) => i) || []));
      setAiBulkAnalyzed(res.productsAnalyzed || 0);
    } catch {
      addToast('error', t('skuMappings.aiSuggestError'));
      setShowAiModal(false);
    } finally {
      setAiGenerating(false);
    }
  };

  // Apply AI suggestions
  const handleAiApply = async () => {
    const selected = aiSuggestions.filter((_, i) => aiSelected.has(i));
    if (selected.length === 0) return;
    setAiApplying(true);
    let successCount = 0;
    for (const s of selected) {
      try {
        await skuMappingsApi.create({
          local_sku: s.local_sku,
          platform: s.platform,
          platform_sku: s.platform_sku,
          platform_title: s.platform_title || undefined,
        });
        successCount++;
      } catch {
        // skip duplicates or errors silently
      }
    }
    setAiApplying(false);
    if (successCount > 0) {
      addToast('success', `${t('skuMappings.aiApplySuccess')} (${successCount}/${selected.length})`);
      setShowAiModal(false);
      setAiSuggestions([]);
      fetchMappings();
    } else {
      addToast('error', t('skuMappings.aiApplyError'));
    }
  };

  const toggleAiSelection = (index: number) => {
    setAiSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const confidenceColor = (c: string) => {
    switch (c) {
      case 'high': return 'text-emerald-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-red-400';
      default: return 'text-text-muted';
    }
  };

  const confidenceLabel = (c: string) => {
    switch (c) {
      case 'high': return t('skuMappings.aiConfidenceHigh');
      case 'medium': return t('skuMappings.aiConfidenceMedium');
      case 'low': return t('skuMappings.aiConfidenceLow');
      default: return c;
    }
  };

  // Columns
  const columns: Column<SkuMapping>[] = [
    {
      key: 'local_sku',
      header: t('skuMappings.local_sku'),
      render: (row) => <span className="font-mono text-xs font-medium text-accent-purple">{row.local_sku}</span>,
    },
    {
      key: 'platform',
      header: t('skuMappings.platform'),
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
          {row.platform}
        </span>
      ),
    },
    {
      key: 'platform_sku',
      header: t('skuMappings.platform_sku'),
      render: (row) => <span className="font-mono text-xs text-text-secondary">{row.platform_sku}</span>,
    },
    {
      key: 'platform_title',
      header: t('skuMappings.platformTitle'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-text-secondary truncate max-w-[150px] block">
          {row.platform_title || '-'}
        </span>
      ),
    },
    {
      key: 'price_sync',
      header: t('skuMappings.price_sync'),
      hideOnMobile: true,
      render: (row) => (
        <span className={row.price_sync ? 'text-emerald-400 text-xs font-medium' : 'text-text-muted text-xs'}>
          {row.price_sync ? t('common.on') : t('common.off')}
        </span>
      ),
    },
    {
      key: 'stock_sync',
      header: t('skuMappings.stock_sync'),
      hideOnMobile: true,
      render: (row) => (
        <span className={row.stock_sync ? 'text-emerald-400 text-xs font-medium' : 'text-text-muted text-xs'}>
          {row.stock_sync ? t('common.on') : t('common.off')}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: t('skuMappings.status'),
      render: (row) => <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'last_synced_at',
      header: t('skuMappings.lastSynced'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-text-muted">
          {row.last_synced_at ? formatDate(row.last_synced_at) : '-'}
        </span>
      ),
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
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleDelete(row.id)}
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

  // Validation error columns
  const validationErrorColumns: Column<ValidationError>[] = [
    {
      key: 'local_sku',
      header: t('skuMappings.local_sku'),
      render: (row) => <span className="font-mono text-xs text-accent-purple">{row.local_sku}</span>,
    },
    {
      key: 'platform',
      header: t('skuMappings.platform'),
      render: (row) => <span className="text-sm text-text-secondary">{row.platform}</span>,
    },
    {
      key: 'error',
      header: t('skuMappings.error'),
      render: (row) => <span className="text-sm text-red-400">{row.error}</span>,
    },
  ];

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('skuMappings.title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('skuMappings.subtitle')}</p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Select label="" value={platformFilter} onChange={(e) => handlePlatformFilterChange(e.target.value)}>
                <option value="">{t('skuMappings.allPlatforms')}</option>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <Input
                label=""
                type="text"
                value={skuSearch}
                onChange={(e) => handleSkuSearchChange(e.target.value)}
                placeholder={t('skuMappings.searchPlaceholder')}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={handleExportCsv} loading={exporting}>
                {t('skuMappings.csvExport')}
              </Button>
              {isAdmin && (
                <>
                  <Button size="sm" variant="secondary" onClick={handleValidate} loading={validating}>
                    {t('skuMappings.validate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAiBulkMode(false);
                      setAiSuggestions([]);
                      setAiSku('');
                      setShowAiModal(true);
                    }}
                  >
                    {t('skuMappings.aiSuggest')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleAiBulkSuggest} loading={aiGenerating && aiBulkMode}>
                    {t('skuMappings.aiBulkSuggest')}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      resetForm();
                      setShowFormModal(true);
                    }}
                  >
                    {t('skuMappings.add')}
                  </Button>
                </>
              )}
            </div>
          </div>

          <DataTable columns={columns} data={mappings} loading={loading} emptyMessage={t('skuMappings.empty', 'No SKU mappings found')} />

          <div className="mt-4">
            <Pagination page={page} pages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingMapping ? t('skuMappings.edit') : t('skuMappings.add')}
      >
        <div className="space-y-4">
          <Input
            label={t('skuMappings.local_sku')}
            type="text"
            value={formLocalSku}
            onChange={(e) => setFormLocalSku(e.target.value)}
            placeholder={t('skuMappings.localSkuPlaceholder')}
          />

          <Select label={t('skuMappings.platform')} value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)}>
            <option value="">{t('skuMappings.selectPlatform')}</option>
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>

          <Input
            label={t('skuMappings.platform_sku')}
            type="text"
            value={formPlatformSku}
            onChange={(e) => setFormPlatformSku(e.target.value)}
            placeholder={t('skuMappings.platformSkuPlaceholder')}
          />

          <Input
            label={t('skuMappings.platformTitleLabel')}
            type="text"
            value={formPlatformTitle}
            onChange={(e) => setFormPlatformTitle(e.target.value)}
            placeholder={t('skuMappings.platformTitlePlaceholder')}
          />

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={formPriceSync}
                onChange={(e) => setFormPriceSync(e.target.checked)}
                className="rounded border-border bg-bg-card text-accent-purple focus:ring-accent-purple"
              />
              {t('skuMappings.price_sync')}
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={formStockSync}
                onChange={(e) => setFormStockSync(e.target.checked)}
                className="rounded border-border bg-bg-card text-accent-purple focus:ring-accent-purple"
              />
              {t('skuMappings.stock_sync')}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowFormModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} loading={saving}>
              {editingMapping ? t('skuMappings.update') : t('skuMappings.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Validation Results Modal */}
      <Modal
        open={showValidateModal}
        onClose={() => setShowValidateModal(false)}
        title={t('skuMappings.validationResult')}
      >
        <div className="space-y-4">
          {validating && (
            <p className="text-sm text-text-muted">{t('skuMappings.validating')}</p>
          )}
          {validationResult && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
                  <p className="text-xs text-text-muted">{t('skuMappings.total')}</p>
                  <p className="text-lg font-bold text-text-primary">{validationResult.total}</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
                  <p className="text-xs text-text-muted">{t('skuMappings.valid')}</p>
                  <p className="text-lg font-bold text-emerald-400">{validationResult.valid}</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
                  <p className="text-xs text-text-muted">{t('skuMappings.invalid')}</p>
                  <p className="text-lg font-bold text-red-400">{validationResult.invalid}</p>
                </div>
              </div>

              {validationResult.errors.length > 0 && (
                <DataTable columns={validationErrorColumns} data={validationResult.errors} loading={false} />
              )}

              {validationResult.errors.length === 0 && validationResult.invalid === 0 && (
                <p className="text-sm text-emerald-400">{t('skuMappings.allValid')}</p>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* AI Suggest Modal */}
      <Modal
        open={showAiModal}
        onClose={() => setShowAiModal(false)}
        title={aiBulkMode ? t('skuMappings.aiBulkTitle') : t('skuMappings.aiSuggestTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            {aiBulkMode ? t('skuMappings.aiBulkDesc') : t('skuMappings.aiSuggestDesc')}
          </p>

          {/* Single product input (Plan A) */}
          {!aiBulkMode && (
            <div className="flex gap-2">
              <Input
                label=""
                type="text"
                value={aiSku}
                onChange={(e) => setAiSku(e.target.value)}
                placeholder={t('skuMappings.aiSuggestInputLabel')}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSuggest()}
              />
              <Button
                size="sm"
                variant="primary"
                onClick={handleAiSuggest}
                loading={aiGenerating}
                disabled={!aiSku.trim()}
              >
                {t('skuMappings.aiSuggest')}
              </Button>
            </div>
          )}

          {/* Loading state */}
          {aiGenerating && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
              <span className="text-sm text-text-muted">{t('skuMappings.aiGenerating')}</span>
            </div>
          )}

          {/* Bulk analyzed count */}
          {aiBulkMode && !aiGenerating && aiBulkAnalyzed > 0 && (
            <p className="text-xs text-text-muted">
              {aiBulkAnalyzed} {t('skuMappings.aiBulkAnalyzed')}
            </p>
          )}

          {/* No suggestions */}
          {!aiGenerating && aiSuggestions.length === 0 && (aiSku || aiBulkMode) && (
            <p className="text-sm text-text-muted py-2">{t('skuMappings.aiNoSuggestions')}</p>
          )}

          {/* Suggestions list */}
          {aiSuggestions.length > 0 && (
            <>
              <div className="text-sm text-text-secondary font-medium">
                {aiSuggestions.length} {t('skuMappings.aiSuggestionCount')}
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {aiSuggestions.map((s, i) => (
                  <div
                    key={`${s.local_sku}-${s.platform}-${i}`}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                      aiSelected.has(i)
                        ? 'border-accent-purple bg-accent-purple/5'
                        : 'border-border bg-bg-card hover:border-border-hover'
                    }`}
                    onClick={() => toggleAiSelection(i)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={aiSelected.has(i)}
                        onChange={() => toggleAiSelection(i)}
                        className="rounded border-border bg-bg-card text-accent-purple focus:ring-accent-purple"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-medium text-accent-purple">{s.local_sku}</span>
                          <span className="text-text-muted text-xs">→</span>
                          <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
                            {s.platform}
                          </span>
                          <span className="font-mono text-xs text-text-secondary">{s.platform_sku}</span>
                        </div>
                        {s.platform_title && (
                          <p className="text-xs text-text-muted mt-1 truncate">{s.platform_title}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs font-medium ${confidenceColor(s.confidence)}`}>
                            {t('skuMappings.aiConfidence')}: {confidenceLabel(s.confidence)}
                          </span>
                          {s.reason && (
                            <span className="text-xs text-text-muted">{s.reason}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Apply buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="secondary" onClick={() => setShowAiModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleAiApply}
                  loading={aiApplying}
                  disabled={aiSelected.size === 0}
                >
                  {t('skuMappings.aiApplySelected')} ({aiSelected.size})
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
