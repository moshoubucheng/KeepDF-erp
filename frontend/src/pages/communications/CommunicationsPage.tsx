import { useState, useEffect, useCallback } from 'react';
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
      addToast('error', 'メッセージ一覧の取得に失敗しました');
    } finally {
      setMessagesLoading(false);
    }
  }, [page, limit, addToast]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await communicationsApi.listTemplates({ offset: (page - 1) * limit, limit });
      setTemplates(res.templates || []);
      setTemplatesTotal(res.total || 0);
    } catch {
      addToast('error', 'テンプレート一覧の取得に失敗しました');
    } finally {
      setTemplatesLoading(false);
    }
  }, [page, limit, addToast]);

  // Fetch triggers
  const fetchTriggers = useCallback(async () => {
    setTriggersLoading(true);
    try {
      const res = await communicationsApi.listTriggers();
      setTriggers(res.triggers || []);
    } catch {
      addToast('error', 'トリガー一覧の取得に失敗しました');
    } finally {
      setTriggersLoading(false);
    }
  }, [addToast]);

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
      addToast('error', '顧客IDとメッセージ内容は必須です');
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
      addToast('success', 'メッセージを送信しました');
      setShowSendModal(false);
      resetSendForm();
      if (activeTab === 'messages') fetchMessages();
    } catch {
      addToast('error', 'メッセージの送信に失敗しました');
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
      addToast('error', 'テンプレート名と内容は必須です');
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
        addToast('success', 'テンプレートを更新しました');
      } else {
        await communicationsApi.createTemplate(data);
        addToast('success', 'テンプレートを作成しました');
      }
      setShowTemplateModal(false);
      resetTemplateForm();
      fetchTemplates();
      fetchAllTemplates();
    } catch {
      addToast('error', 'テンプレートの保存に失敗しました');
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
    if (!window.confirm('このテンプレートを削除しますか？')) return;
    setDeletingTemplateId(id);
    try {
      await communicationsApi.deleteTemplate(id);
      addToast('success', 'テンプレートを削除しました');
      fetchTemplates();
      fetchAllTemplates();
    } catch {
      addToast('error', 'テンプレートの削除に失敗しました');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // Create/Delete trigger
  const handleCreateTrigger = async () => {
    if (!triggerEventType || !triggerTemplateId) {
      addToast('error', 'イベントタイプとテンプレートは必須です');
      return;
    }
    setSavingTrigger(true);
    try {
      await communicationsApi.createTrigger({
        event_type: triggerEventType,
        template_id: Number(triggerTemplateId),
      });
      addToast('success', 'トリガーを作成しました');
      setShowTriggerModal(false);
      setTriggerEventType('');
      setTriggerTemplateId('');
      fetchTriggers();
    } catch {
      addToast('error', 'トリガーの作成に失敗しました');
    } finally {
      setSavingTrigger(false);
    }
  };

  const handleDeleteTrigger = async (id: number) => {
    if (!window.confirm('このトリガーを削除しますか？')) return;
    setDeletingTriggerId(id);
    try {
      await communicationsApi.deleteTrigger(id);
      addToast('success', 'トリガーを削除しました');
      fetchTriggers();
    } catch {
      addToast('error', 'トリガーの削除に失敗しました');
    } finally {
      setDeletingTriggerId(null);
    }
  };

  // Columns: Messages
  const messageColumns: Column<CustomerMessage>[] = [
    {
      key: 'type',
      header: 'タイプ',
      render: (row) => <span className="text-xs font-medium text-accent-purple">{row.type}</span>,
    },
    {
      key: 'customer_id',
      header: '顧客ID',
      render: (row) => <span className="font-mono text-xs">#{row.customer_id}</span>,
    },
    {
      key: 'subject',
      header: '件名',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-secondary">{row.subject || '-'}</span>,
    },
    {
      key: 'content',
      header: '内容',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-text-secondary truncate max-w-[200px] block">
          {row.content.length > 50 ? `${row.content.slice(0, 50)}...` : row.content}
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'チャネル',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-muted">{row.channel || '-'}</span>,
    },
    {
      key: 'created_at',
      header: '送信日',
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
  ];

  // Columns: Templates
  const templateColumns: Column<MessageTemplate>[] = [
    { key: 'name', header: 'テンプレート名' },
    {
      key: 'type',
      header: 'タイプ',
      render: (row) => <span className="text-xs font-medium text-accent-purple">{row.type}</span>,
    },
    {
      key: 'subject',
      header: '件名',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-secondary">{row.subject || '-'}</span>,
    },
    {
      key: 'channel',
      header: 'チャネル',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-text-muted">{row.channel || '-'}</span>,
    },
    {
      key: 'created_at',
      header: '作成日',
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEditTemplate(row)}>
            編集
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleDeleteTemplate(row.id)}
            loading={deletingTemplateId === row.id}
            disabled={deletingTemplateId !== null}
          >
            削除
          </Button>
        </div>
      ),
    },
  ];

  // Columns: Triggers
  const triggerColumns: Column<CommTrigger>[] = [
    {
      key: 'event_type',
      header: 'イベントタイプ',
      render: (row) => <span className="text-xs font-medium text-accent-purple">{row.event_type}</span>,
    },
    {
      key: 'template_id',
      header: 'テンプレート',
      render: (row) => {
        const tpl = allTemplates.find((t) => t.id === row.template_id);
        return <span className="text-sm text-text-secondary">{tpl ? tpl.name : `#${row.template_id}`}</span>;
      },
    },
    {
      key: 'created_at',
      header: '作成日',
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
          削除
        </Button>
      ),
    },
  ];

  const messagesTotalPages = Math.ceil(messagesTotal / limit);
  const templatesTotalPages = Math.ceil(templatesTotal / limit);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'messages', label: 'メッセージ' },
    { id: 'templates', label: 'テンプレート' },
    { id: 'triggers', label: 'トリガー' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">コミュニケーション</h1>
        <p className="text-sm text-text-muted mt-1">顧客へのメッセージ、テンプレート、自動トリガーを管理します</p>
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
              <h2 className="text-lg font-semibold text-text-primary">メッセージ一覧</h2>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  resetSendForm();
                  setShowSendModal(true);
                }}
              >
                メッセージ送信
              </Button>
            </div>

            <DataTable columns={messageColumns} data={messages} loading={messagesLoading} />

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
              <h2 className="text-lg font-semibold text-text-primary">テンプレート一覧</h2>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  resetTemplateForm();
                  setShowTemplateModal(true);
                }}
              >
                新規テンプレート
              </Button>
            </div>

            <DataTable columns={templateColumns} data={templates} loading={templatesLoading} />

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
              <h2 className="text-lg font-semibold text-text-primary">トリガー一覧</h2>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setTriggerEventType('');
                  setTriggerTemplateId('');
                  setShowTriggerModal(true);
                }}
              >
                新規トリガー
              </Button>
            </div>

            <DataTable columns={triggerColumns} data={triggers} loading={triggersLoading} />
          </CardContent>
        </Card>
      )}

      {/* Send Message Modal */}
      <Modal open={showSendModal} onClose={() => setShowSendModal(false)} title="メッセージ送信">
        <div className="space-y-4">
          <Input
            label="顧客ID"
            type="number"
            value={sendCustomerId}
            onChange={(e) => setSendCustomerId(e.target.value)}
            placeholder="顧客IDを入力"
          />

          <Select label="タイプ" value={sendType} onChange={(e) => setSendType(e.target.value)}>
            {MESSAGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>

          <Input
            label="件名"
            type="text"
            value={sendSubject}
            onChange={(e) => setSendSubject(e.target.value)}
            placeholder="件名を入力（任意）"
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">内容</label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple"
              rows={4}
              value={sendContent}
              onChange={(e) => setSendContent(e.target.value)}
              placeholder="メッセージ内容を入力"
            />
          </div>

          <Select
            label="テンプレート（任意）"
            value={sendTemplateId}
            onChange={(e) => setSendTemplateId(e.target.value)}
          >
            <option value="">テンプレートなし</option>
            {allTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>

          <Select label="チャネル（任意）" value={sendChannel} onChange={(e) => setSendChannel(e.target.value)}>
            <option value="">未指定</option>
            {CHANNEL_OPTIONS.map((ch) => (
              <option key={ch} value={ch}>{ch}</option>
            ))}
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowSendModal(false)}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handleSendMessage} loading={sending}>
              送信
            </Button>
          </div>
        </div>
      </Modal>

      {/* Template Create/Edit Modal */}
      <Modal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title={editingTemplate ? 'テンプレート編集' : '新規テンプレート'}
      >
        <div className="space-y-4">
          <Input
            label="テンプレート名"
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="テンプレート名を入力"
          />

          <Select label="タイプ" value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
            {MESSAGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>

          <Input
            label="件名"
            type="text"
            value={templateSubject}
            onChange={(e) => setTemplateSubject(e.target.value)}
            placeholder="件名を入力（任意）"
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              内容 <span className="text-text-muted text-xs">{'({{variable}} 形式で変数を使用可能)'}</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple"
              rows={6}
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              placeholder="例: {{customer_name}} 様、ご注文 {{order_id}} をお送りしました。"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowTemplateModal(false)}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handleSaveTemplate} loading={savingTemplate}>
              {editingTemplate ? '更新' : '作成'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Trigger Create Modal */}
      <Modal open={showTriggerModal} onClose={() => setShowTriggerModal(false)} title="新規トリガー">
        <div className="space-y-4">
          <Select label="イベントタイプ" value={triggerEventType} onChange={(e) => setTriggerEventType(e.target.value)}>
            <option value="">選択してください</option>
            {TRIGGER_EVENTS.map((ev) => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </Select>

          <Select label="テンプレート" value={triggerTemplateId} onChange={(e) => setTriggerTemplateId(e.target.value)}>
            <option value="">選択してください</option>
            {allTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={() => setShowTriggerModal(false)}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handleCreateTrigger} loading={savingTrigger}>
              作成
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
