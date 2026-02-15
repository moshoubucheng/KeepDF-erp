import { useState, useEffect, useCallback } from 'react';
import { currencyApi } from '@/api/endpoints/currency';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable, type Column } from '@/components/data/DataTable';
import { StatCard } from '@/components/data/StatCard';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePagination } from '@/hooks/usePagination';
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
  const { addToast } = useUIStore();
  const { isAdmin } = useAuthStore();
  const { page, limit, setPage } = usePagination();

  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [totalPages, setTotalPages] = useState(1);
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
      setTotalPages(1);
    } catch {
      addToast('error', '為替レートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

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
      addToast('error', 'レートを入力してください');
      return;
    }
    const rateValue = Number(newRate);
    if (isNaN(rateValue) || rateValue <= 0) {
      addToast('error', '有効なレートを入力してください');
      return;
    }
    setSaving(true);
    try {
      await currencyApi.setRate(editingRate.from_currency, editingRate.to_currency, rateValue);
      addToast('success', '為替レートを更新しました');
      setShowUpdateModal(false);
      setEditingRate(null);
      fetchRates();
    } catch {
      addToast('error', '為替レートの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!convertAmount || Number(convertAmount) <= 0) {
      addToast('error', '有効な金額を入力してください');
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
      addToast('error', '通貨換算に失敗しました');
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
      header: '変換元',
      render: (row) => (
        <span className="font-medium text-text-primary">{row.from_currency}</span>
      ),
    },
    {
      key: 'to_currency',
      header: '変換先',
      render: (row) => (
        <span className="font-medium text-text-primary">{row.to_currency}</span>
      ),
    },
    {
      key: 'rate',
      header: 'レート',
      render: (row) => (
        <span className="text-accent-purple font-mono">{row.rate.toFixed(4)}</span>
      ),
    },
    {
      key: 'updated_at',
      header: '最終更新',
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
            編集
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">通貨管理</h1>
        <p className="text-sm text-text-muted mt-1">為替レートの管理と通貨換算を行います</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<span className="text-lg">💱</span>}
          title="登録レート数"
          value={rateCount}
          accent="purple"
        />
        <StatCard
          icon={<span className="text-lg">🕐</span>}
          title="最終更新"
          value={latestUpdate ? formatDate(latestUpdate) : '-'}
        />
      </div>

      <Card>
        <CardContent>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary mb-1">通貨換算</h2>
            <p className="text-sm text-text-muted">金額を入力して通貨を変換します</p>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="w-full sm:w-40">
              <Input
                label="金額"
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
                label="変換元"
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
                label="変換先"
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
              換算
            </Button>
          </div>

          {convertResult !== null && (
            <div className="mt-4 p-4 bg-bg-card border border-border rounded-lg">
              <p className="text-sm text-text-secondary">換算結果</p>
              <p className="text-2xl font-bold text-accent-purple">
                {convertResult.toLocaleString(undefined, { maximumFractionDigits: 2 })} {convertTo}
              </p>
              <p className="text-sm text-text-muted mt-1">
                {Number(convertAmount).toLocaleString()} {convertFrom} =&gt;{' '}
                {convertResult.toLocaleString(undefined, { maximumFractionDigits: 2 })} {convertTo}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary">為替レート一覧</h2>
          </div>

          <DataTable columns={columns} data={rates} loading={loading} />

          <div className="mt-4">
            <Pagination page={page} pages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        title="為替レートを更新"
      >
        <div className="space-y-4">
          {editingRate && (
            <>
              <div className="p-3 bg-bg-card border border-border rounded-lg">
                <p className="text-sm text-text-secondary">
                  {editingRate.from_currency} → {editingRate.to_currency}
                </p>
                <p className="text-lg font-mono text-text-primary">
                  現在のレート: {editingRate.rate.toFixed(4)}
                </p>
              </div>
              <Input
                label="新しいレート"
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
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handleUpdateRate} loading={saving}>
              更新
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
