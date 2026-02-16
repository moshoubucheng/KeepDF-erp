import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '../helpers/render'
import { Modal } from '@/components/ui/Modal'

describe('Modal', () => {
  it('renders content when open=true', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Modal content here</p>
      </Modal>,
    )
    expect(screen.getByText('Modal content here')).toBeInTheDocument()
  })

  it('does not render when open=false', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Hidden content</p>
      </Modal>,
    )
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Test Title">
        <p>Body</p>
      </Modal>,
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('calls onClose when clicking backdrop', async () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose} title="Backdrop test">
        <p>Content</p>
      </Modal>,
    )

    const user = userEvent.setup()
    // The backdrop is the fixed overlay div
    const backdrop = screen.getByText('Content').closest('.px-6')!.parentElement!.parentElement!
    await user.click(backdrop)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape key', async () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose} title="Escape test">
        <p>Content</p>
      </Modal>,
    )

    const user = userEvent.setup()
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
