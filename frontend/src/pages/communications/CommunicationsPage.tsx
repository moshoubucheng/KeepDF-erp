import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  communicationsApi,
  type CustomerMessage,
  type MessageTemplate,
  type CommTrigger,
} from '@/api/endpoints/communications';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable, type Column } from '@/components/data/DataTable';
import { useUIStore } from '@/stores/ui.store';
import { usePagination } from '@/hooks/usePagination';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

type TabId = 'messages' | 'templates' | 'triggers';

const MESSAGE_TYPES = ['ORDER_CONFIRMATION', 'SHIPPING_NOTIFICATION', 'RETURN_UPDATE', 'PROMOTION', 'CUSTOM'] as const;
const CHANNEL_OPTIONS = ['email', 'sms', 'line'] as const;
const TRIGGER_EVENTS = ['order_created', 'order_shipped', 'order_delivered', 'return_requested', 'return_approved', 'return_refunded'] as const;

export default function CommunicationsPage() {
  const { t } = useTranslation();
  const { addToast } = useUIStore();
  const { page, limit, setPage, resetPage } = usePagination();

  const [activeTab, setActiveTab] = useState<TabId>('messages');

  // Messages state
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendCustomerId, setSendCustomerId] = useState('');
  const [sendType, setSendType] = useState('CUSTOM');
  const [sendSubject, setSendSubject] = useState('');
  const [sendContent, setSendContent] = useState('');
  const [sendTemplateId, setSendTemplateId] = useState('');
  const [sendChannel, setSendChannel] = useState('');

  // Templates state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesTotal, setTemplatesTotal] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('CUSTOM');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);

  // Triggers state
  const [triggers, setTriggers] = useState<CommTrigger[]>([]);
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [savingTrigger, setSavingTrigger] = useState(false);
  const [triggerEventType, setTriggerEventType] = useState('');
  const [triggerTemplateId, setTriggerTemplateId] = useState('');
  const [deletingTriggerId, setDeletingTriggerId] = useState<number | null>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    setMessagesLoading(true);
    try {
      const res = await communicationsApi.listMessages({ offset: (page - 1) * limit, limit });
      setMessages(res.messages || []);
      setMessagesTotal(res.total || 0);
    } catch {
      addToast('error', t('communications.error_fetch_messages'));
    } finally {
      setMessagesLoading(false);
    }
  }, [page, limit, addToast, t]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await communicationsApi.listTemplates({ offset: (page - 1) * limit, limit });
      setTemplates(res.templates || []);
      setTemplatesTotal(res.total || 0);
    } catch {
      addToast('error', t('communications.error_fetch_templates'));
    } finally {
      setTemplatesLoading(false);
    }
  }, [page, limit, addToast, t]);

  // Fetch triggers
  const fetchTriggers = useCallback(async () => {
    setTriggersLoading(true);
    try {
      const res = await communicationsApi.listTriggers();
      setTriggers(res.triggers || []);
    } catch {
      addToast('error', t('communications.error_fetch_triggers'));
    } finally {
      setTriggersLoading(false);
    }
  }, [addToast, t]);

  // Fetch all templates for select dropdowns (send modal, trigger modal)
  const [allTemplates, setAllTemplates] = useState<MessageTemplate[]>([]);
  const fetchAllTemplates = useCallback(async () => {
    try {
      const res = await communicationsApi.listTemplates({ limit: 200 });
      setAllTemplates(res.templates || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAllTemplates();
  }, [fetchAllTemplates]);

  useEffect(() => {
    if (activeTab === 'messages') fetchMessages();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'triggers') fetchTriggers();
  }, [activeTab, fetchMessages, fetchTemplates, fetchTriggers]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    resetPage();
  };

  // Send message
  const handleSendMessage = async () => {
    if (!sendCustomerId || !sendContent) {
      addToast('error', t('communications.error_required_send'));
      return;
    }
    setSending(true);
    try {
      await communicationsApi.send({
        customer_id: Number(sendCustomerId),
        type: sendType,
        content: sendContent,
        subject: sendSubject || undefined,
        template_id: sendTemplateId ? Number(sendTemplateId) : undefined,
        channel: sendChannel || undefined,
      });
      addToast('success', t('communications.success_send'));
      setShowSendModal(false);
      resetSendForm();
      if (activeTab === 'messages') fetchMessages();
    } catch {
      addToast('error', t('communications.error_send'));
    } finally {
      setSending(false);
    }
  };

  const resetSendForm = () => {
    setSendCustomerId('');
    setSendType('CUSTOM');
    setSendSubject('');
    setSendContent('');
    setSendTemplateId('');
    setSendChannel('');
  };

  // Create/Edit template
  const handleSaveTemplate = async () => {
    if (!templateName || !templateContent) {
      addToast('error', t('communications.error_required_template'));
      return;
    }
    setSavingTemplate(true);
    try {
      const data = {
        name: templateName,
        type: templateType,
        subject: templateSubject || undefined,
        content: templateContent,
      };
      if (editingTemplate) {
        await communicationsApi.updateTemplate(editingTemplate.id, data);
        addToast('success', t('communications.success_update_template'));
      } else {
        await communicationsApi.createTemplate(data);
        addToast('success', t('communications.success_create_template'));
      }
      setShowTemplateModal(false);
      resetTemplateForm();
      fetchTemplates();
      fetchAllTemplates();
    } catch {
      addToast('error', t('communications.error_save_template'));
    } finally {
      setSavingTemplate(false);
    }
  };

  const resetTemplateForm = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateType('CUSTOM');
    setTemplateSubject('');
    setTemplateContent('');
  };

  const openEditTemplate = (tpl: MessageTemplate) => {
    setEditingTemplate(tpl);
    setTemplateName(tpl.name);
    setTemplateType(tpl.type);
    setTemplateSubject(tpl.subject || '');
    setTemplateContent(tpl.content);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm(t('communications.confirm_delete_template'))) return;
    setDeletingTemplateId(id);
    try {
      await communicationsApi.deleteTemplate(id);
      addToast('success', t('communications.success_delete_template'));
      fetchTemplates();
      fetchAllTemplates();
    } catch {
      addToast('error', t('communications.error_delete_template'));
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // Create/Delete trigger
  const handleCreateTrigger = async () => {
    if (!triggerEventType || !triggerTemplateId) {
      addToast('error', t('communications.error_required_trigger'));
      return;
    }
    setSavingTrigger(true);
    try {
      await communicationsApi.createTrigger({
        event_type: triggerEventType,
        template_id: Number(triggerTemplateId),
      });
      addToast('success', t('communications.success_create_trigger'));
      setShowTriggerModal(false);
      setTriggerEventType('');
      setTriggerTemplateId('');
      fetchTriggers();
    } catch {
      addToast('error', t('communications.error_create_trigger'));
    } finally {
      setSavingTrigger(false);
    }
  };

  const handleDeleteTrigger = async (id: number) => {
    if (!window.confirm(t('communications.confirm_delete_trigger'))) return;
    setDeletingTriggerId(id);
    try {
      await communicationsApi.deleteTrigger(id);
      addToast('success', t('communications.success_delete_trigger'));
      fetchTriggers();
    } catch {
      addToast('error', t('communications.error_delete_trigger'));
    } finally {
      setDeletingTriggerId(null);
    }
  };

  // Columns: Messages
  const messageColumns: Column<CustomerMessage>[] = [
    {
      key: 'type',
      header: t('communications.type'),
      render: (row) => <span className="text-xs font-medium text-accent-purple">{row.type}</span>,
    },
    {
      key: 'customer_id',
      header: t('communications.customer_id'),
      render: (row) => <span className="font-mono text-xs">#{row.customer_id}</span>,
    },
    {
      key: 'subject',
      header: t('communications.subject'),
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-secondary">{row.subject || '-'}</span>,
    },
    {
      key: 'content',
      header: t('communications.content'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-text-secondary truncate max-w-[200px] block">
          {row.content.length > 50 ? `${row.content.slice(0, 50)}...` : row.content}
        </span>
      ),
    },
    {
      key: 'channel',
      header: t('communications.channel'),
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-muted">{row.channel || '-'}</span>,
    },
    {
      key: 'created_at',
      header: t('communications.sent_at'),
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
  ];

  // Columns: Templates
  const templateColumns: Column<MessageTemplate>[] = [
    { key: 'name', header: t('communications.template_name') },
    {
      key: 'type',
      header: t('communications.type'),
      render: (row) => <span className="text-xs font-medium text-accent-purple">{row.type}</span>,
    },
    {
      key: 'subject',
      header: t('communications.subject'),
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-secondary">{row.subject || '-'}</span>,
    },
    {
      key: 'channel',
      header: t('communications.channel'),
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-muted">{row.channel || '-'}</span>,
    },
    {
      key: 'created_at',
      header: t('communications.created_at'),
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEditTemplate(row)}>
            {t('common.edit')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleDeleteTemplate(row.id)}
            loading={deletingTemplateId === row.id}
            disabled={deletingTemplateId !== null}
          >
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  // Columns: Triggers
  const triggerColumns: Column<CommTrigger>[] = [
    {
      key: 'event_type',
      header: t('communications.event_type'),
      render: (row) => <span className="text-xs font-medium text-accent-purple">{row.event_type}</span>,
    },
    {
      key: 'template_id',
      header: t('communications.template'),
      render: (row) => {
        const tpl = allTemplates.find((t) => t.id === row.template_id);
        return <span className="text-sm text-text-secondary">{tpl ? tpl.name : `#${row.template_id}`}</span>;
      },
    },
    {
      key: 'created_at',
      header: t('communications.created_at'),
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleDeleteTrigger(row.id)}
          loading={deletingTriggerId === row.id}
          disabled={deletingTriggerId !== null}
        >
          {t('common.delete')}
        </Button>
      ),
    },
  ];

  const messagesTotalPages = Math.ceil(messagesTotal / limit);
  const templatesTotalPages = Math.ceil(templatesTotal / limit);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'messages', label: t('communications.messages') },
    { id: 'templates', label: t('communications.templates') },
    { id: 'triggers', label: t('communications.triggers') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('communications.title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('communications.subtitle')}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-accent-purple text-accent-purple'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <Card>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-text-primary">{t('communications.messages_list')}</h2>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  resetSendForm();
                  setShowSendModal(true);
                }}
              >
                {t('communications.send_message')}
              </Button>
            </div>

            <DataTable columns={messageColumns} data={messages} loading={messagesLoading} emptyMessage={t('communications.empty_messages', 'No messages found')} />

            <div className="mt-4">
              <Pagination page={page} pages={messagesTotalPages} onPageChange={setPage} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <Card>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-text-primary">{t('communications.templates_list')}</h2>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  resetTemplateForm();
                  setShowTemplateModal(true);
                }}
              >
                {t('communications.new_template')}
              </Button>
            </div>

            <DataTable columns={templateColumns} data={templates} loading={templatesLoading} emptyMessage={t('communications.empty_templates', 'No templates found')} />

            <div className="mt-4">
              <Pagination page={page} pages={templatesTotalPages} onPageChange={setPage} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Triggers Tab */}
      {activeTab === 'triggers' && (
        <Card>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-text-primary">{t('communications.triggers_list')}</h2>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setTriggerEventType('');
                  setTriggerTemplateId('');
                  setShowTriggerModal(true);
                }}
              >
                {t('communications.new_trigger')}
              </Button>
            </div>

            <DataTable columns={triggerColumns} data={triggers} loading={triggersLoading} emptyMessage={t('communications.empty_triggers', 'No triggers configured')} />
          </CardContent>
        </Card>
      )}

      {/* Send Message Modal */}
      <Modal open={showSendModal} onClose={() => setShowSendModal(false)} title={t('communications.send_message')}>
        <div className="space-y-4">
          <Input
            label={t('communications.customer_id')}
            type="number"
            value={sendCustomerId}
            onChange={(e) => setSendCustomerId(e.target.value)}
            placeholder={t('communications.placeholder_customer_id')}
          />

          <Select label={t('communications.type')} value={sendType} onChange={(e) => setSendType(e.target.value)}>
            {MESSAGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>

          <Input
            label={t('communications.subject')}
            type="text"
            value={sendSubject}
            onChange={(e) => setSendSubject(e.target.value)}
            placeholder={t('communications.placeholder_subject')}
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('communications.content')}</label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple"
              rows={4}
              value={sendContent}
              onChange={(e) => setSendContent(e.target.value)}
              placeholder={t('communications.placeholder_content')}
            />
          </div>

          <Select
            label={t('communications.template_optional')}
            value={sendTemplateId}
            onChange={(e) => setSendTemplateId(e.target.value)}
          >
            <option value="">{t('communications.no_template')}</option>
            {allTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>

          <Select label={t('communications.channel_optional')} value={sendChannel} onChange={(e) => setSendChannel(e.target.value)}>
            <option value="">{t('communications.unspecified')}</option>
            {CHANNEL_OPTIONS.map((ch) => (
              <option key={ch} value={ch}>{ch}</option>
            ))}
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowSendModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleSendMessage} loading={sending}>
              {t('communications.send')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Template Create/Edit Modal */}
      <Modal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title={editingTemplate ? t('communications.edit_template') : t('communications.new_template')}
      >
        <div className="space-y-4">
          <Input
            label={t('communications.template_name')}
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={t('communications.placeholder_template_name')}
          />

          <Select label={t('communications.type')} value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
            {MESSAGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>

          <Input
            label={t('communications.subject')}
            type="text"
            value={templateSubject}
            onChange={(e) => setTemplateSubject(e.target.value)}
            placeholder={t('communications.placeholder_subject')}
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('communications.content')} <span className="text-text-muted text-xs">{t('communications.variable_hint')}</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple"
              rows={6}
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              placeholder={t('communications.placeholder_template_content')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowTemplateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleSaveTemplate} loading={savingTemplate}>
              {editingTemplate ? t('common.update') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Trigger Create Modal */}
      <Modal open={showTriggerModal} onClose={() => setShowTriggerModal(false)} title={t('communications.new_trigger')}>
        <div className="space-y-4">
          <Select label={t('communications.event_type')} value={triggerEventType} onChange={(e) => setTriggerEventType(e.target.value)}>
            <option value="">{t('communications.please_select')}</option>
            {TRIGGER_EVENTS.map((ev) => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </Select>

          <Select label={t('communications.template')} value={triggerTemplateId} onChange={(e) => setTriggerTemplateId(e.target.value)}>
            <option value="">{t('communications.please_select')}</option>
            {allTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowTriggerModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleCreateTrigger} loading={savingTrigger}>
              {t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
