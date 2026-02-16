import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '../helpers/render'
import { DataTable, type Column } from '@/components/data/DataTable'

interface TestRow {
  id: number
  name: string
  price: number
  platform: string
}

const columns: Column<TestRow>[] = [
  { key: 'name', header: 'Name' },
  { key: 'price', header: 'Price', sortable: true },
  { key: 'platform', header: 'Platform', hideOnMobile: true },
]

const data: TestRow[] = [
  { id: 1, name: 'Widget A', price: 1000, platform: 'TIKTOK' },
  { id: 2, name: 'Widget B', price: 500, platform: 'TEMU' },
  { id: 3, name: 'Widget C', price: 2000, platform: 'RAKUTEN' },
]

describe('DataTable', () => {
  it('renders basic table with columns and data', () => {
    render(<DataTable columns={columns} data={data} />)

    // Headers
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Platform')).toBeInTheDocument()

    // Data rows
    expect(screen.getByText('Widget A')).toBeInTheDocument()
    expect(screen.getByText('Widget B')).toBeInTheDocument()
    expect(screen.getByText('Widget C')).toBeInTheDocument()
  })

  it('shows emptyMessage when data is empty', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="No items found" />)
    expect(screen.getByText('No items found')).toBeInTheDocument()
  })

  it('shows default empty message when no emptyMessage prop', () => {
    render(<DataTable columns={columns} data={[]} />)
    // cimode shows the key
    expect(screen.getByText('common.noData')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<DataTable columns={columns} data={[]} loading={true} />)
    // Loading spinner is rendered, no data rows
    expect(screen.queryByText('Widget A')).not.toBeInTheDocument()
  })

  it('sorts data when clicking sortable column header', async () => {
    render(<DataTable columns={columns} data={data} />)

    const priceHeader = screen.getByText('Price')
    const user = userEvent.setup()

    // Click to sort ascending
    await user.click(priceHeader)

    const cells = screen.getAllByRole('cell')
    const nameCells = cells.filter((_, i) => i % 3 === 0)
    expect(nameCells[0]).toHaveTextContent('Widget B') // 500
    expect(nameCells[1]).toHaveTextContent('Widget A') // 1000
    expect(nameCells[2]).toHaveTextContent('Widget C') // 2000
  })

  it('calls onSort for server-side sorting', async () => {
    const onSort = vi.fn()
    render(<DataTable columns={columns} data={data} onSort={onSort} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Price'))

    expect(onSort).toHaveBeenCalledWith({ key: 'price', direction: 'asc' })
  })

  it('does not sort when clicking non-sortable column', async () => {
    render(<DataTable columns={columns} data={data} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Name'))

    // Data order unchanged
    const cells = screen.getAllByRole('cell')
    const nameCells = cells.filter((_, i) => i % 3 === 0)
    expect(nameCells[0]).toHaveTextContent('Widget A')
  })

  it('triggers onRowClick when a row is clicked', async () => {
    const onRowClick = vi.fn()
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Widget B'))

    expect(onRowClick).toHaveBeenCalledWith(data[1])
  })

  it('renders column toggle when enabled', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        columnToggle={true}
        tableId="test-table"
      />,
    )

    expect(screen.getByText('table.columns')).toBeInTheDocument()
  })

  it('hides columns with hideOnMobile class', () => {
    render(<DataTable columns={columns} data={data} />)

    // Platform header should have hidden md:table-cell class
    const platformHeader = screen.getByText('Platform').closest('th')
    expect(platformHeader?.className).toContain('hidden')
    expect(platformHeader?.className).toContain('md:table-cell')
  })
})
