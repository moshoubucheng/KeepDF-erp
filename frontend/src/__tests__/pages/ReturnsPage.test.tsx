import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import ReturnsPage from '@/pages/returns/ReturnsPage'

vi.mock('@/api/endpoints/returns', () => ({
  returnsApi: {
    list: vi.fn().mockResolvedValue({
      returns: [
        { id: 1, order_id: 101, shipment_id: null, distributor_id: 1, status: 'REQUESTED', reason: 'Defective item', notes: null, refund_type: 'FULL', refund_amount: 5000, created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-15T10:00:00Z' },
        { id: 2, order_id: 102, shipment_id: null, distributor_id: 1, status: 'APPROVED', reason: 'Wrong size', notes: null, refund_type: 'FULL', refund_amount: 3000, created_at: '2024-01-14T09:00:00Z', updated_at: '2024-01-14T12:00:00Z' },
        { id: 3, order_id: 103, shipment_id: null, distributor_id: 1, status: 'RECEIVED', reason: 'Changed mind', notes: null, refund_type: 'PARTIAL', refund_amount: 2000, created_at: '2024-01-13T08:00:00Z', updated_at: '2024-01-13T15:00:00Z' },
        { id: 4, order_id: 104, shipment_id: null, distributor_id: 1, status: 'REFUNDED', reason: 'Duplicate order', notes: null, refund_type: 'FULL', refund_amount: 4000, created_at: '2024-01-12T07:00:00Z', updated_at: '2024-01-12T17:00:00Z' },
      ],
      total: 4,
    }),
    approve: vi.fn().mockResolvedValue({ success: true }),
    reject: vi.fn().mockResolvedValue({ success: true }),
    receive: vi.fn().mockResolvedValue({ success: true }),
    refund: vi.fn().mockResolvedValue({ success: true }),
  },
}))

// Mock window.confirm
const mockConfirm = vi.fn(() => true)
Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true })

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockReturnValue(true)
})

describe('ReturnsPage', () => {
  it('renders returns list with status badges', async () => {
    render(<ReturnsPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
      expect(screen.getByText('#102')).toBeInTheDocument()
      expect(screen.getByText('#103')).toBeInTheDocument()
      expect(screen.getByText('#104')).toBeInTheDocument()
    })
  })

  it('shows action buttons based on status', async () => {
    render(<ReturnsPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
    })

    // REQUESTED status should have approve and reject buttons
    const approveButtons = screen.getAllByText('returns.approve')
    expect(approveButtons.length).toBeGreaterThanOrEqual(1)

    const rejectButtons = screen.getAllByText('returns.reject')
    expect(rejectButtons.length).toBeGreaterThanOrEqual(1)

    // APPROVED status should have receive button
    const receiveButtons = screen.getAllByText('returns.receive')
    expect(receiveButtons.length).toBeGreaterThanOrEqual(1)

    // RECEIVED status should have refund button
    const refundButtons = screen.getAllByText('returns.refund')
    expect(refundButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('approves return', async () => {
    const { returnsApi } = await import('@/api/endpoints/returns')
    render(<ReturnsPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const approveBtn = screen.getAllByText('returns.approve')[0]
    await user.click(approveBtn)

    expect(mockConfirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(returnsApi.approve).toHaveBeenCalledWith(1)
    })
  })

  it('opens reject modal with reason input', async () => {
    render(<ReturnsPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const rejectBtn = screen.getAllByText('returns.reject')[0]
    await user.click(rejectBtn)

    await waitFor(() => {
      expect(screen.getByText('returns.rejectReturn')).toBeInTheDocument()
      expect(screen.getByText('returns.rejectReason')).toBeInTheDocument()
    })
  })

  it('processes refund', async () => {
    const { returnsApi } = await import('@/api/endpoints/returns')
    render(<ReturnsPage />)

    await waitFor(() => {
      expect(screen.getByText('#103')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const refundBtn = screen.getAllByText('returns.refund')[0]
    await user.click(refundBtn)

    expect(mockConfirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(returnsApi.refund).toHaveBeenCalledWith(3)
    })
  })

  it('shows empty state', async () => {
    const { returnsApi } = await import('@/api/endpoints/returns')
    vi.mocked(returnsApi.list).mockResolvedValueOnce({ returns: [], total: 0 })

    render(<ReturnsPage />)

    await waitFor(() => {
      expect(screen.getByText('returns.empty')).toBeInTheDocument()
    })
  })
})
