import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Key } from 'lucide-react'

import { distributorsApi, type Distributor } from '@/api/endpoints/distributors'
import { useUIStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate, formatCurrency } from '@/utils/format'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'

const distributorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/).optional().or(z.literal('')),
  password: z.string().min(8).optional().or(z.literal('')),
  tax_reg_number: z.string().optional().default(''),
  role: z.enum(['admin', 'distributor']).default('distributor'),
})

type DistributorFormData = z.infer<typeof distributorSchema>

export default function DistributorsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const { page, limit, setPage } = usePagination(20)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Distributor | null>(null)
  const [resetTokenModal, setResetTokenModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Distributor | null>(null)
  const [newToken, setNewToken] = useState<string | null>(null)

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-muted">{t('common.accessDenied', 'Access denied')}</p>
      </div>
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ['distributors', { page, limit }],
    queryFn: () => distributorsApi.list({ offset: (page - 1) * limit, limit }),
  })

  const items = data?.distributors ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  const createMutation = useMutation({
    mutationFn: (values: DistributorFormData) =>
      distributorsApi.create({
        name: values.name,
        username: values.username || undefined,
        password: values.password || undefined,
        tax_reg_number: values.tax_reg_number || undefined,
        role: values.role,
      }),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['distributors'] })
      closeModal()
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<DistributorFormData> }) =>
      distributorsApi.update(id, {
        name: values.name,
        tax_reg_number: values.tax_reg_number || undefined,
        role: values.role,
      }),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['distributors'] })
      closeModal()
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const resetTokenMutation = useMutation({
    mutationFn: (id: number) => distributorsApi.resetToken(id),
    onSuccess: (data) => {
      setNewToken(data.token)
      addToast('success', t('distributors.tokenResetSuccess', 'Token reset successfully'))
      queryClient.invalidateQueries({ queryKey: ['distributors'] })
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const openAdd = useCallback(() => { setEditingItem(null); setModalOpen(true) }, [])
  const openEdit = useCallback((d: Distributor) => { setEditingItem(d); setModalOpen(true) }, [])
  const closeModal = useCallback(() => { setModalOpen(false); setEditingItem(null) }, [])

  const columns = useMemo<Column<Distributor>[]>(
    () => [
      { key: 'id', header: 'ID', className: 'w-16', render: (row) => <span className="font-mono text-xs text-text-muted">#{row.id}</span> },
      { key: 'name', header: t('distributors.name', 'Name'), render: (row) => <span className="font-medium text-text-primary">{row.name}</span> },
      { key: 'username', header: t('distributors.username', 'Username'), hideOnMobile: true, render: (row) => <span className="font-mono text-xs">{row.username || '-'}</span> },
      {
        key: 'role', header: t('distributors.role', 'Role'),
        render: (row) => (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.role === 'admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}`}>
            {row.role}
          </span>
        ),
      },
      { key: 'balance', header: t('distributors.balance', 'Balance'), hideOnMobile: true, render: (row) => <span className="font-mono text-sm">{formatCurrency(row.balance)}</span> },
      {
        key: 'totp_enabled', header: '2FA',
        render: (row) => row.totp_enabled ? <span className="text-emerald-400 text-xs">ON</span> : <span className="text-text-muted text-xs">OFF</span>,
      },
      { key: 'created_at', header: t('common.date', 'Date'), hideOnMobile: true, render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span> },
      {
        key: 'actions', header: t('common.actions', 'Actions'), className: 'w-24',
        render: (row) => (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="rounded-md p-1.5 text-text-muted hover:bg-bg-input hover:text-accent-purple transition-colors cursor-pointer" title={t('common.edit', 'Edit')}><Pencil size={15} /></button>
            <button onClick={(e) => { e.stopPropagation(); setSelectedItem(row); setNewToken(null); setResetTokenModal(true) }} className="rounded-md p-1.5 text-text-muted hover:bg-bg-input hover:text-accent-blue transition-colors cursor-pointer" title={t('distributors.resetToken', 'Reset Token')}><Key size={15} /></button>
          </div>
        ),
      },
    ],
    [t, openEdit],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('distributors.title', 'Distributors')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('distributors.subtitle', 'Manage distributor accounts')}</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus size={16} />{t('distributors.add', 'Add Distributor')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable columns={columns} data={items} loading={isLoading} emptyMessage={t('distributors.empty', 'No distributors found')} keyField="id" />
        </CardContent>
      </Card>

      {totalPages > 1 && <Pagination page={page} pages={totalPages} onPageChange={setPage} />}

      <DistributorModal open={modalOpen} onClose={closeModal} distributor={editingItem} saving={createMutation.isPending || updateMutation.isPending}
        onSubmit={(values) => { editingItem ? updateMutation.mutate({ id: editingItem.id, values }) : createMutation.mutate(values) }} />

      <Modal open={resetTokenModal} onClose={() => { setResetTokenModal(false); setSelectedItem(null); setNewToken(null) }} title={t('distributors.resetToken', 'Reset Token')}>
        {newToken ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{t('distributors.newTokenGenerated', 'New token generated:')}</p>
            <div className="p-3 bg-bg-input rounded-lg border border-border"><code className="text-xs font-mono break-all text-text-primary select-all">{newToken}</code></div>
            <p className="text-xs text-amber-400">{t('distributors.tokenWarning', 'Save this token now. It cannot be shown again.')}</p>
            <div className="flex justify-end"><Button size="sm" onClick={() => { setResetTokenModal(false); setSelectedItem(null); setNewToken(null) }}>{t('common.close', 'Close')}</Button></div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{t('distributors.resetTokenConfirm', 'Reset API token for')} <strong>{selectedItem?.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => { setResetTokenModal(false); setSelectedItem(null) }}>{t('common.cancel', 'Cancel')}</Button>
              <Button size="sm" loading={resetTokenMutation.isPending} onClick={() => selectedItem && resetTokenMutation.mutate(selectedItem.id)}>{t('common.confirm', 'Confirm')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DistributorModal({ open, onClose, distributor, saving, onSubmit }: { open: boolean; onClose: () => void; distributor: Distributor | null; saving: boolean; onSubmit: (v: DistributorFormData) => void }) {
  const { t } = useTranslation()
  const isEdit = distributor !== null
  const { register, handleSubmit, reset, formState: { errors } } = useForm<DistributorFormData>({
    resolver: zodResolver(distributorSchema),
    values: isEdit ? { name: distributor.name, username: distributor.username ?? '', password: '', tax_reg_number: distributor.tax_reg_number ?? '', role: distributor.role } : { name: '', username: '', password: '', tax_reg_number: '', role: 'distributor' },
  })
  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? t('distributors.edit', 'Edit Distributor') : t('distributors.add', 'Add Distributor')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label={t('distributors.name', 'Name') + ' *'} {...register('name')} error={errors.name?.message} autoFocus />
        {!isEdit && (
          <>
            <Input label={t('distributors.username', 'Username')} {...register('username')} error={errors.username?.message} />
            <Input label={t('distributors.password', 'Password')} type="password" {...register('password')} error={errors.password?.message} placeholder="Min 8 characters" />
          </>
        )}
        <Input label={t('distributors.taxRegNumber', 'Tax Reg Number')} {...register('tax_reg_number')} error={errors.tax_reg_number?.message} placeholder="T1234567890123" />
        <Select label={t('distributors.role', 'Role')} {...register('role')} error={errors.role?.message}>
          <option value="distributor">Distributor</option>
          <option value="admin">Admin</option>
        </Select>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button type="submit" size="sm" loading={saving}>{t('common.save', 'Save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
