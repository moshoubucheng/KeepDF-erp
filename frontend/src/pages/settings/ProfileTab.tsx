import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { User, Save } from 'lucide-react'
import type { User as UserType } from '@/api/types'
import { authApi } from '@/api/endpoints/auth'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  tax_reg_number: z.string().optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

interface ProfileTabProps {
  user: UserType | null
  addToast: (type: 'success' | 'error', message: string) => void
  fetchMe: () => Promise<void>
}

export function ProfileTab({ user, addToast, fetchMe }: ProfileTabProps) {
  const { t } = useTranslation()

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name ?? '',
      contact_person: (user as any)?.contact_person ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      address: (user as any)?.address ?? '',
      tax_reg_number: (user as any)?.tax_reg_number ?? '',
    },
  })

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data),
    onSuccess: async () => {
      addToast('success', t('settings.profileSaved', 'Profile updated successfully'))
      await fetchMe()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.profileError', 'Failed to update profile'))
    },
  })

  function handleProfileSave(data: ProfileForm) {
    updateProfile.mutate(data)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User size={18} className="text-accent-purple" />
          <h3 className="text-text-primary font-semibold text-base">
            {t('settings.companyProfile', 'Company Profile')}
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={profileForm.handleSubmit(handleProfileSave)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl"
        >
          <Input
            label={t('settings.companyName', 'Company Name')}
            placeholder={t('settings.companyNamePlaceholder', 'Your company name')}
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register('name')}
          />
          <Input
            label={t('settings.contactPerson', 'Contact Person')}
            placeholder={t('settings.contactPersonPlaceholder', 'Contact person name')}
            error={profileForm.formState.errors.contact_person?.message}
            {...profileForm.register('contact_person')}
          />
          <Input
            label={t('settings.email', 'Email')}
            type="email"
            placeholder="info@example.com"
            error={profileForm.formState.errors.email?.message}
            {...profileForm.register('email')}
          />
          <Input
            label={t('settings.phone', 'Phone')}
            placeholder="03-1234-5678"
            error={profileForm.formState.errors.phone?.message}
            {...profileForm.register('phone')}
          />
          <div className="md:col-span-2">
            <Input
              label={t('settings.address', 'Address')}
              placeholder={t('settings.addressPlaceholder', 'Business address')}
              error={profileForm.formState.errors.address?.message}
              {...profileForm.register('address')}
            />
          </div>
          <Input
            label={t('settings.taxRegNumber', 'Tax Registration Number')}
            placeholder="T1234567890123"
            error={profileForm.formState.errors.tax_reg_number?.message}
            {...profileForm.register('tax_reg_number')}
          />
          <div className="md:col-span-2 flex justify-end pt-2">
            <Button type="submit" loading={updateProfile.isPending}>
              <Save size={16} />
              {t('common.save', 'Save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
