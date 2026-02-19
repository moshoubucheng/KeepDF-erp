import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, ChevronDown, ChevronUp, Bot, User, AlertCircle } from 'lucide-react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { aiApi, type AiChatMessage, type AiChatResponse } from '@/api/endpoints/ai'
import { cn } from '@/utils/cn'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  data?: { columns: string[]; rows: unknown[][] }
  sql?: string
  error?: boolean
}

interface AiChatPanelProps {
  open: boolean
  onClose: () => void
}

function DataTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  if (columns.length === 0 || rows.length === 0) return null

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-bg-primary">
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-text-muted">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className="whitespace-nowrap px-3 py-1.5 text-text-primary">
                  {cell == null ? '-' : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SqlBlock({ sql, t }: { sql: string; t: (k: string) => string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? t('ai.hide_sql') : t('ai.show_sql')}
      </button>
      {open && (
        <pre className="mt-1 rounded-md bg-bg-primary p-2 text-xs text-text-muted overflow-x-auto">
          {sql}
        </pre>
      )}
    </div>
  )
}

function ThinkingIndicator({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex items-start gap-2 px-4 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-bg-card-hover px-4 py-2.5">
        <span className="text-sm text-text-muted">{t('ai.thinking')}</span>
        <span className="flex gap-0.5 ml-1">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </div>
  )
}

function ChatContent({ messages, loading, error, onSend, onRetry, t }: {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  onSend: (msg: string) => void
  onRetry: () => void
  t: (k: string) => string
}) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const examples = [
    t('ai.example1'),
    t('ai.example2'),
    t('ai.example3'),
    t('ai.example4'),
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setInput('')
  }, [input, loading, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 mb-4">
              <Bot className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">{t('ai.empty_title')}</h3>
            <p className="text-sm text-text-muted mb-4">{t('ai.empty_subtitle')}</p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-[300px]">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => onSend(ex)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-card-hover transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex items-start gap-2 px-2', msg.role === 'user' ? 'flex-row-reverse' : '')}>
            {msg.role === 'assistant' ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                <Bot className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                <User className="h-4 w-4" />
              </div>
            )}
            <div className={cn(
              'max-w-[85%] rounded-2xl px-4 py-2.5',
              msg.role === 'user'
                ? 'rounded-tr-sm bg-purple-600 text-white'
                : 'rounded-tl-sm bg-bg-card-hover text-text-primary',
              msg.error && 'border border-red-300 dark:border-red-800',
            )}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.data && <DataTable columns={msg.data.columns} rows={msg.data.rows} />}
              {msg.sql && <SqlBlock sql={msg.sql} t={t} />}
            </div>
          </div>
        ))}

        {loading && <ThinkingIndicator t={t} />}

        {error && (
          <div className="flex items-center gap-2 px-4 py-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-500">{error}</span>
            <button onClick={onRetry} className="text-sm text-purple-600 hover:underline ml-1">
              {t('ai.retry')}
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('ai.placeholder')}
            className="flex-1 rounded-full border border-border bg-bg-primary px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
            disabled={loading}
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
              input.trim() && !loading
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-bg-card-hover text-text-muted cursor-not-allowed',
            )}
            aria-label={t('ai.send')}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AiChatPanel({ open, onClose }: AiChatPanelProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastMessageRef = useRef<string>('')

  const handleSend = useCallback(async (message: string) => {
    lastMessageRef.current = message
    setError(null)

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      // Build history from existing messages
      const history: AiChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res: AiChatResponse = await aiApi.chat(message, history)

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        data: res.data,
        sql: res.sql,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      const errMsg = err instanceof Error && err.message.includes('429')
        ? t('ai.rate_limit')
        : t('ai.error')
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }, [messages, t])

  const handleRetry = useCallback(() => {
    if (lastMessageRef.current) {
      // Remove last user message (it will be re-added)
      setMessages((prev) => prev.slice(0, -1))
      handleSend(lastMessageRef.current)
    }
  }, [handleSend])

  const chatContent = (
    <ChatContent
      messages={messages}
      loading={loading}
      error={error}
      onSend={handleSend}
      onRetry={handleRetry}
      t={t}
    />
  )

  // Mobile: use BottomSheet
  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title={t('ai.title')} className="!max-h-[90vh]">
        <div className="flex flex-col -mx-4 -my-3" style={{ height: 'calc(90vh - 80px)' }}>
          {chatContent}
        </div>
      </BottomSheet>
    )
  }

  // Desktop: right-side drawer
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className={cn(
        'fixed right-0 top-0 z-[91] h-full w-[400px] bg-bg-card border-l border-border shadow-xl',
        'flex flex-col',
        'animate-in slide-in-from-right duration-200',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
              <Bot className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-text-primary">{t('ai.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat content */}
        <div className="flex-1 overflow-hidden">
          {chatContent}
        </div>
      </div>
    </>
  )
}
