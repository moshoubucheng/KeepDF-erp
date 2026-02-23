import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { currencyApi } from '@/api/endpoints/currency';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/data/DataTable';
import { StatCard } from '@/components/data/StatCard';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/utils/format';

interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

const CURRENCIES = ['JPY', 'USD', 'CNY'] as const;

export default function CurrencyPage() {
  const { t } = useTranslation();
  const { addToast } = useUIStore();
  const { isAdmin } = useAuthStore();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(false);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState(false);

  const [convertAmount, setConvertAmount] = useState('');
  const [convertFrom, setConvertFrom] = useState('USD');
  const [convertTo, setConvertTo] = useState('JPY');
  const [convertResult, setConvertResult] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await currencyApi.getRates();
      setRates(res.rates || []);
    } catch {
      addToast('error', t('currency.error_fetch'));
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const openUpdateModal = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setNewRate(String(rate.rate));
    setShowUpdateModal(true);
  };

  const handleUpdateRate = async () => {
    if (!editingRate || !newRate) {
      addToast('error', t('currency.error_required_rate'));
      return;
    }
    const rateValue = Number(newRate);
    if (isNaN(rateValue) || rateValue <= 0) {
      addToast('error', t('currency.error_invalid_rate'));
      return;
    }
    setSaving(true);
    try {
      await currencyApi.setRate(editingRate.from_currency, editingRate.to_currency, rateValue);
      addToast('success', t('currency.success_update'));
      setShowUpdateModal(false);
      setEditingRate(null);
      fetchRates();
    } catch {
      addToast('error', t('currency.error_update'));
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!convertAmount || Number(convertAmount) <= 0) {
      addToast('error', t('currency.error_invalid_amount'));
      return;
    }
    if (convertFrom === convertTo) {
      setConvertResult(Number(convertAmount));
      return;
    }
    setConverting(true);
    try {
      const res = await currencyApi.convert(Number(convertAmount), convertFrom, convertTo);
      setConvertResult(res.converted);
    } catch {
      addToast('error', t('currency.error_convert'));
    } finally {
      setConverting(false);
    }
  };

  const rateCount = rates.length;
  const latestUpdate = rates.length > 0
    ? rates.reduce((latest, r) => (r.updated_at > latest ? r.updated_at : latest), rates[0].updated_at)
    : null;

  const columns: Column<ExchangeRate>[] = [
    {
      key: 'from_currency',
      header: t('currency.from'),
      render: (row) => (
        <span className="font-medium text-text-primary">{row.from_currency}</span>
      ),
    },
    {
      key: 'to_currency',
      header: t('currency.to'),
      render: (row) => (
        <span className="font-medium text-text-primary">{row.to_currency}</span>
      ),
    },
    {
      key: 'rate',
      header: t('currency.rate'),
      render: (row) => (
        <span className="text-accent-purple font-mono">{row.rate.toFixed(4)}</span>
      ),
    },
    {
      key: 'updated_at',
      header: t('currency.updated'),
      hideOnMobile: true,
      render: (row) => <span className="text-text-secondary">{formatDate(row.updated_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        if (!isAdmin) return null;
        return (
          <Button size="sm" variant="secondary" onClick={() => openUpdateModal(row)}>
            {t('common.edit')}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('currency.title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('currency.page_subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<span className="text-lg">💱</span>}
          title={t('currency.rate_count')}
          value={rateCount}
          accent="purple"
        />
        <StatCard
          icon={<span className="text-lg">🕐</span>}
          title={t('currency.last_updated')}
          value={latestUpdate ? formatDate(latestUpdate) : '-'}
        />
      </div>

      <Card>
        <CardContent>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary mb-1">{t('currency.converter')}</h2>
            <p className="text-sm text-text-muted">{t('currency.converter_description')}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="w-full sm:w-40">
              <Input
                label={t('currency.amount')}
                type="number"
                value={convertAmount}
                onChange={(e) => {
                  setConvertAmount(e.target.value);
                  setConvertResult(null);
                }}
                placeholder="1000"
              />
            </div>
            <div className="w-full sm:w-32">
              <Select
                label={t('currency.from')}
                value={convertFrom}
                onChange={(e) => {
                  setConvertFrom(e.target.value);
                  setConvertResult(null);
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <span className="text-text-muted text-lg hidden sm:block pb-2">→</span>
            <div className="w-full sm:w-32">
              <Select
                label={t('currency.to')}
                value={convertTo}
                onChange={(e) => {
                  setConvertTo(e.target.value);
                  setConvertResult(null);
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <Button size="sm" variant="primary" onClick={handleConvert} loading={converting}>
              {t('currency.convert')}
            </Button>
          </div>

          {convertResult !== null && (
            <div className="mt-4 p-4 bg-bg-card border border-border rounded-lg">
              <p className="text-sm text-text-secondary">{t('currency.result')}</p>
              <p className="text-2xl font-bold text-accent-purple">
                {convertResult.toLocaleString(undefined, { maximumFractionDigits: convertTo === 'JPY' ? 0 : 2 })} {convertTo}
              </p>
              <p className="text-sm text-text-muted mt-1">
                {Number(convertAmount).toLocaleString()} {convertFrom} =&gt;{' '}
                {convertResult.toLocaleString(undefined, { maximumFractionDigits: convertTo === 'JPY' ? 0 : 2 })} {convertTo}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary">{t('currency.rates_title')}</h2>
          </div>

          <DataTable columns={columns} data={rates} loading={loading} emptyMessage={t('currency.empty', 'No exchange rates')} />
        </CardContent>
      </Card>

      <Modal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        title={t('currency.update_rate_modal')}
      >
        <div className="space-y-4">
          {editingRate && (
            <>
              <div className="p-3 bg-bg-card border border-border rounded-lg">
                <p className="text-sm text-text-secondary">
                  {editingRate.from_currency} → {editingRate.to_currency}
                </p>
                <p className="text-lg font-mono text-text-primary">
                  {t('currency.current_rate')}: {editingRate.rate.toFixed(4)}
                </p>
              </div>
              <Input
                label={t('currency.new_rate')}
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="0.0000"
                autoFocus
              />
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowUpdateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleUpdateRate} loading={saving}>
              {t('common.update')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
