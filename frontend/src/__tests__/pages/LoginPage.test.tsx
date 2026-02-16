import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import LoginPage from '@/pages/LoginPage'
import { useAuthStore } from '@/stores/auth.store'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: '/login', search: '', hash: '', key: 'default' }),
  }
})

beforeEach(() => {
  mockNavigate.mockClear()
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: false,
  })
  vi.restoreAllMocks()
})

describe('LoginPage', () => {
  it('renders the login form', () => {
    render(<LoginPage />)

    expect(screen.getByText('KeepDF')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('admin')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('shows validation errors for empty form submission', async () => {
    render(<LoginPage />)

    const user = userEvent.setup()
    const submitButton = screen.getByRole('button', { name: /auth\.login/i })
    await user.click(submitButton)

    await waitFor(() => {
      // Validation errors appear as red text (cimode renders i18n keys)
      const errorElements = document.querySelectorAll('.text-red-400')
      expect(errorElements.length).toBeGreaterThan(0)
    })
  })

  it('handles successful password login', async () => {
    const mockResponse = { token: 'tok_success' }
    const mockUser = { id: 1, name: 'Admin', role: 'admin' }

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ distributor: mockUser }), { status: 200 }),
      )

    render(<LoginPage />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('admin'), 'testuser')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await user.click(screen.getByRole('button', { name: /auth\.login/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('shows error message on login failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 }),
    )

    render(<LoginPage />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('admin'), 'baduser')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /auth\.login/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('shows 2FA input when required', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ requires_2fa: true, temp_token: 'temp_123' }),
        { status: 200 },
      ),
    )

    render(<LoginPage />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('admin'), 'user2fa')
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass123')
    await user.click(screen.getByRole('button', { name: /auth\.login/i }))

    await waitFor(() => {
      expect(screen.getByText('auth.2fa_title')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })
  })

  it('switches between password and token login modes', async () => {
    render(<LoginPage />)

    const user = userEvent.setup()

    // Switch to token mode
    await user.click(screen.getByText('auth.token_login'))
    expect(screen.getByPlaceholderText('tok_xxxxxxxx')).toBeInTheDocument()

    // Switch back to password mode
    await user.click(screen.getByText('auth.password_login'))
    expect(screen.getByPlaceholderText('admin')).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    render(<LoginPage />)

    const user = userEvent.setup()
    const passwordInput = screen.getByPlaceholderText('••••••••')

    // Initially password type
    expect(passwordInput).toHaveAttribute('type', 'password')

    // Click show password button
    const toggleButton = screen.getByRole('button', { name: /show password/i })
    await user.click(toggleButton)

    expect(passwordInput).toHaveAttribute('type', 'text')
  })

  it('handles token login flow', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ distributor: { id: 1, name: 'T', role: 'admin' } }), { status: 200 }),
    )

    render(<LoginPage />)

    const user = userEvent.setup()

    // Switch to token mode
    await user.click(screen.getByText('auth.token_login'))
    await user.type(screen.getByPlaceholderText('tok_xxxxxxxx'), 'tok_test123')
    await user.click(screen.getByRole('button', { name: /auth\.login/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })
})
