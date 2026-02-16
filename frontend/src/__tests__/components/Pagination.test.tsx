import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '../helpers/render'
import { Pagination } from '@/components/ui/Pagination'

describe('Pagination', () => {
  it('renders page indicator with current and total pages', () => {
    render(<Pagination page={2} pages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  it('returns null when pages <= 1', () => {
    const { container } = render(<Pagination page={1} pages={1} onPageChange={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('calls onPageChange with previous page on prev click', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} pages={5} onPageChange={onPageChange} />)

    const user = userEvent.setup()
    // Prev button has ChevronLeft and "common.prev" text (cimode)
    const prevBtn = screen.getByText('common.prev')
    await user.click(prevBtn)

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange with next page on next click', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={2} pages={5} onPageChange={onPageChange} />)

    const user = userEvent.setup()
    const nextBtn = screen.getByText('common.next')
    await user.click(nextBtn)

    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('disables prev button on first page', () => {
    render(<Pagination page={1} pages={5} onPageChange={vi.fn()} />)

    const prevBtn = screen.getByText('common.prev').closest('button')!
    expect(prevBtn).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pagination page={5} pages={5} onPageChange={vi.fn()} />)

    const nextBtn = screen.getByText('common.next').closest('button')!
    expect(nextBtn).toBeDisabled()
  })
})
