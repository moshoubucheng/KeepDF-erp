import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'
import { ErrorBoundary, InlineErrorBoundary } from '@/components/ui/ErrorBoundary'

// Suppress React error boundary console errors in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function ThrowingChild({ message = 'Test error' }: { message?: string }): ReactNode {
  throw new Error(message)
}

function GoodChild() {
  return <div>Healthy child</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Healthy child')).toBeInTheDocument()
  })

  it('catches error and shows default fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="Boom!" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Boom!')).toBeInTheDocument()
    expect(screen.getByText('Reload')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild message="callback test" />
      </ErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe('callback test')
  })
})

describe('InlineErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <InlineErrorBoundary>
        <GoodChild />
      </InlineErrorBoundary>,
    )
    expect(screen.getByText('Healthy child')).toBeInTheDocument()
  })

  it('shows inline error with Try Again button', () => {
    render(
      <InlineErrorBoundary>
        <ThrowingChild message="Inline error" />
      </InlineErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Inline error')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })
})
