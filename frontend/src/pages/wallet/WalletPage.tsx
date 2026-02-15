import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wallet, Snowflake, TrendingUp, Plus } from 'lucide-react'
import { walletApi } from '@/api/endpoints/wallet'
import type { WalletTransaction } from '@/api/types'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { StatCard } from '@/components/data/StatCard'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable, type Column } from '@/components/data/DataTable'
import { formatCurrency, formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

const depositSchema = z.object({
  amount: z.coerce.number().min(1, 'Amount must be at least 1'),
  note: z.string().optional(),
})

type DepositForm = z.infer<typeof depositSchema>

const TX_TYPE_STYLES: Record<string, { label: string; color: string; amountColor: string }> = {
  DEPOSIT: {
    label: 'Deposit',
    color: 'bg-emerald-500/15 text-emerald-400',
    amountColor: 'text-emerald-400',
  },
  FREEZE: {
    label: 'Freeze',
    color: 'bg-blue-500/15 text-blue-400',
    amountColor: 'text-blue-400',
  },
  DEDUCT: {
    label: 'Deduct',
    color: 'bg-red-500/15 text-red-400',
    amountColor: 'text-red-400',
  },
  REFUND: {
    label: 'Refund',
    color: 'bg-amber-500/15 text-amber-400',
    amountColor: 'text-emerald-400',
  },
}

export default function WalletPage() {
  const { t } = useTranslation()
  const { isAdmin, user } = useAuthStore()
  const addToast = useUIStore((s) => s.addToast)
  const queryClient = useQueryClient()
  const [depositOpen, setDepositOpen] = useState(false)

  const distributorId = user?.id ?? 0

  // Balance query
  const balanceQuery = useQuery({
    queryKey: ['wallet', 'balance', distributorId],
    queryFn: () => walletApi.balance(distributorId),
    enabled: distributorId > 0,
  })

  // Transactions query
  const txQuery = useQuery({
    queryKey: ['wallet', 'transactions', distributorId],
    queryFn: () => walletApi.transactions(distributorId),
    enabled: distributorId > 0,
  })

  // Deposit mutation
  const depositMutation = useMutation({
    mutationFn: (data: DepositForm) =>
      walletApi.deposit(distributorId, data.amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      addToast('success', t('wallet.depositSuccess', 'Deposit completed successfully'))
      setDepositOpen(false)
      depositForm.reset()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('wallet.depositError', 'Deposit failed'))
    },
  })

  const depositForm = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 0, note: '' },
  })

  const balance = balanceQuery.data?.balance ?? 0
  const frozen = balanceQuery.data?.frozen_balance ?? 0
  const total = balance + frozen
  const transactions = txQuery.data?.transactions ?? []

  const txColumns: Column<WalletTransaction>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (row) => (
        <span className="font-mono text-xs text-text-muted">#{row.id}</span>
      ),
    },
    {
      key: 'type',
      header: t('wallet.type', 'Type'),
      render: (row) => {
        const style = TX_TYPE_STYLES[row.type] ?? {
          label: row.type,
          color: 'bg-gray-500/15 text-gray-400',
          amountColor: 'text-text-primary',
        }
        return (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              style.color,
            )}
          >
            {style.label}
          </span>
        )
      },
    },
    {
      key: 'amount',
      header: t('wallet.amount', 'Amount'),
      render: (row) => {
        const style = TX_TYPE_STYLES[row.type]
        const prefix = row.type === 'DEPOSIT' || row.type === 'REFUND' ? '+' : '-'
        return (
          <span className={cn('font-semibold tabular-nums', style?.amountColor)}>
            {prefix}{formatCurrency(row.amount)}
          </span>
        )
      },
    },
    {
      key: 'related_order_id',
      header: t('wallet.relatedOrder', 'Related Order'),
      render: (row) =>
        row.related_order_id ? (
          <span className="font-mono text-xs">#{row.related_order_id}</span>
        ) : (
          <span className="text-text-muted">-</span>
        ),
      hideOnMobile: true,
    },
    {
      key: 'balance_snapshot',
      header: t('wallet.balanceSnapshot', 'Balance'),
      render: (row) => (
        <span className="tabular-nums text-text-secondary">
          {formatCurrency(row.balance_snapshot)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'created_at',
      header: t('wallet.date', 'Date'),
      render: (row) => (
        <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>
      ),
      hideOnMobile: true,
    },
  ]

  function handleDeposit(data: DepositForm) {
    depositMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {t('wallet.title', 'Wallet')}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t('wallet.subtitle', 'Balance overview and transaction history')}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setDepositOpen(true)}>
            <Plus size={16} />
            {t('wallet.deposit', 'Deposit')}
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Wallet size={20} />}
          title={t('wallet.availableBalance', 'Available Balance')}
          value={formatCurrency(balance)}
          accent="emerald"
        />
        <StatCard
          icon={<Snowflake size={20} />}
          title={t('wallet.frozenBalance', 'Frozen')}
          value={formatCurrency(frozen)}
          accent="blue"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          title={t('wallet.totalAssets', 'Total Assets')}
          value={formatCurrency(total)}
          accent="purple"
        />
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader title={t('wallet.transactionHistory', 'Transaction History')} />
        <CardContent className="p-0">
          <DataTable
            columns={txColumns}
            data={transactions}
            loading={txQuery.isLoading}
            emptyMessage={t('wallet.noTransactions', 'No transactions found')}
          />
        </CardContent>
      </Card>

      {/* Deposit Modal */}
      <Modal
        open={depositOpen}
        onClose={() => {
          setDepositOpen(false)
          depositForm.reset()
        }}
        title={t('wallet.depositTitle', 'Deposit Funds')}
      >
        <form onSubmit={depositForm.handleSubmit(handleDeposit)} className="space-y-4">
          <Input
            label={t('wallet.depositAmount', 'Amount (JPY)')}
            type="number"
            min={1}
            step={1}
            placeholder="10000"
            error={depositForm.formState.errors.amount?.message}
            {...depositForm.register('amount', { valueAsNumber: true })}
          />
          <Input
            label={t('wallet.depositNote', 'Note (optional)')}
            placeholder={t('wallet.depositNotePlaceholder', 'Reason for deposit...')}
            error={depositForm.formState.errors.note?.message}
            {...depositForm.register('note')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDepositOpen(false)
                depositForm.reset()
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" loading={depositMutation.isPending}>
              {t('wallet.confirmDeposit', 'Confirm Deposit')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
