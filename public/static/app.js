/* =============================================
   KeepDF - Frontend Application Logic
   ============================================= */

const API_BASE = window.location.origin;
const AUTH_TOKEN = localStorage.getItem('erp_token');

if (!AUTH_TOKEN) {
    window.location.href = '/login.html';
}

// ===== SPA Router =====
const pageTitles = {
    dashboard: { title: 'dashboard.title', sub: 'dashboard.subtitle' },
    orders: { title: 'orders.title', sub: 'orders.subtitle' },
    inventory: { title: 'inventory.title', sub: 'inventory.subtitle' },
    wallet: { title: 'wallet.title', sub: 'wallet.subtitle' },
    commissions: { title: 'commissions.title', sub: 'commissions.subtitle' },
    invoices: { title: 'invoices.title', sub: 'invoices.subtitle' },
    distributors: { title: 'distributors.title', sub: 'distributors.subtitle' },
    audit: { title: 'audit.title', sub: 'audit.subtitle' },
    reports: { title: 'reports.title', sub: 'reports.subtitle' },
    shipping: { title: 'shipping.title', sub: 'shipping.subtitle' },
    customers: { title: 'customers.title', sub: 'customers.subtitle' },
    settings: { title: 'settings.title', sub: 'settings.subtitle' },
};

function navigateTo(pageName) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${pageName}"]`)?.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) targetPage.classList.add('active');

    const info = pageTitles[pageName] || pageTitles.dashboard;
    document.getElementById('pageTitle').textContent = t(info.title);
    document.getElementById('pageSubtitle').textContent = t(info.sub);

    // Close sidebar on mobile after navigation
    closeSidebar();

    loadPageData(pageName);
}

// ===== Sidebar Toggle =====
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

// Auto-expand sidebar on desktop resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        closeSidebar();
    }
    if (document.getElementById('page-dashboard').classList.contains('active')) {
        renderChart();
    }
});

// ===== User Menu =====
function toggleUserMenu() {
    document.getElementById('userMenuDropdown').classList.toggle('active');
}

function closeUserMenu() {
    document.getElementById('userMenuDropdown').classList.remove('active');
}

// Close user menu on outside click
document.addEventListener('click', (e) => {
    const menu = document.querySelector('.user-menu');
    if (menu && !menu.contains(e.target)) {
        closeUserMenu();
    }
});

// ===== Security Helpers =====
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ===== API Helpers =====
async function apiFetch(path, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                ...options.headers,
            },
        });
        return await res.json();
    } catch (e) {
        console.error(`API Error (${path}):`, e);
        return null;
    }
}

async function apiFetchRaw(path, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                ...options.headers,
            },
        });
        return res;
    } catch (e) {
        console.error(`API Raw Error (${path}):`, e);
        return null;
    }
}

async function apiFetchBlob(path) {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
    } catch (e) {
        console.error(`API Blob Error (${path}):`, e);
        return null;
    }
}

function downloadCSV(url) {
    apiFetchBlob(url).then(blob => {
        if (!blob) return alert(t('error.csv_failed'));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const match = url.match(/\/([^/]+)\/export/);
        a.download = (match ? match[1] : 'export') + '.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    });
}

// ===== Page Data Loaders =====
async function loadPageData(page) {
    switch (page) {
        case 'dashboard': return loadDashboard();
        case 'orders': return loadOrders();
        case 'inventory': return loadInventory();
        case 'wallet': return loadWallet();
        case 'commissions': return loadCommissions();
        case 'invoices': return loadInvoices();
        case 'distributors': return loadDistributors();
        case 'audit': return loadAuditLogs();
        case 'reports': return loadReports();
        case 'shipping': return loadShipping();
        case 'customers': return loadCustomers();
        case 'settings': return loadSettings();
        case 'returns': return loadReturns();
        case 'procurement': return loadProcurement();
        case 'pricing': return loadPricing();
        case 'communications': return loadCommunications();
        case 'financial-reports': return loadFinancialReport();
        case 'forecasting': return loadForecasting();
    }
}

// --- Dashboard ---
let currentChartPeriod = '7d';

async function loadDashboard() {
    loadDashboardStats();
    loadPlatformStats();
    renderChart(currentChartPeriod);
}

async function loadDashboardStats() {
    const [statsData, ordersData] = await Promise.all([
        apiFetch('/api/v1/dashboard/stats'),
        apiFetch('/api/v1/orders?limit=5'),
    ]);

    if (statsData?.overview) {
        document.getElementById('stat-revenue').textContent =
            `\u00a5${(statsData.overview.totalRevenue || 0).toLocaleString()}`;
        document.getElementById('stat-orders').textContent =
            statsData.overview.totalOrders || 0;
        document.getElementById('stat-products').textContent =
            statsData.overview.totalProducts || 0;
    }

    if (ordersData) {
        renderRecentOrders(ordersData.orders?.slice(0, 5) || []);
    }
}

async function loadPlatformStats() {
    const data = await apiFetch('/api/v1/dashboard/orders-by-platform?period=all');
    if (!data?.platforms) return;

    const container = document.querySelector('.platform-list');
    if (!container) return;

    const platformMeta = {
        TIKTOK: { cls: 'tiktok', abbr: 'TK', name: 'TikTok Shop' },
        TEMU: { cls: 'temu', abbr: 'TM', name: 'Temu' },
        RAKUTEN: { cls: 'rakuten', abbr: 'RK', name: 'Rakuten' },
    };

    container.innerHTML = data.platforms.map(p => {
        const meta = platformMeta[p.platform] || { cls: '', abbr: '??', name: p.platform };
        return `
        <div class="platform-item">
          <div class="platform-icon ${meta.cls}">${meta.abbr}</div>
          <div class="platform-info">
            <span class="platform-name">${escapeHtml(meta.name)}</span>
            <div class="platform-bar"><div class="bar-fill" style="width:${p.percentage}%"></div></div>
          </div>
          <span class="platform-pct">${p.percentage}%</span>
        </div>`;
    }).join('');
}

function renderRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (!orders.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${t('orders.empty')}</td></tr>`;
        return;
    }
    tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong>#${escapeHtml(o.id)}</strong></td>
      <td>${platformBadge(o.platform)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>\u00a5${(Number(o.total_amount) || 0).toLocaleString()}</td>
      <td>${formatDate(o.created_at)}</td>
    </tr>
  `).join('');
}

async function renderChart(period) {
    if (!period) period = currentChartPeriod;
    currentChartPeriod = period;

    const canvas = document.getElementById('ordersChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const trendData = await apiFetch(`/api/v1/dashboard/revenue-trend?period=${period}`);
    const items = trendData?.data || [];

    const labels = items.map(d => d.date);
    const data = items.map(d => d.orderCount);

    if (!data.length) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '13px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(t('dashboard.no_data'), canvas.width / 2, canvas.height / 2);
        return;
    }

    const max = Math.max(...data) * 1.2 || 1;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(canvas.width - padding.right, y); ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(max - (max / 4) * i), padding.left - 10, y + 4);
    }

    const step = data.length > 1 ? chartW / (data.length - 1) : 0;
    const points = data.map((v, i) => ({
        x: padding.left + step * i,
        y: padding.top + chartH - (v / max) * chartH
    }));

    const gradient = ctx.createLinearGradient(0, padding.top, 0, canvas.height - padding.bottom);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, canvas.height - padding.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, canvas.height - padding.bottom);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#8b5cf6';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    });

    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(labels.length / 7));
    points.forEach((p, i) => {
        if (i % labelStep === 0 || i === points.length - 1) {
            const label = labels[i] ? labels[i].slice(5) : '';
            ctx.fillText(label, p.x, canvas.height - padding.bottom + 20);
        }
    });
}

// --- Orders ---
async function loadOrders() {
    const platform = document.getElementById('orderPlatformFilter')?.value || '';
    const status = document.getElementById('orderStatusFilter')?.value || '';
    let url = '/api/v1/orders?limit=50';
    if (platform) url += `&platform=${encodeURIComponent(platform)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('ordersTableBody');

    if (!data?.orders?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${t('orders.empty')}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.orders.map(o => `
    <tr>
      <td><strong>#${escapeHtml(o.id)}</strong></td>
      <td>${platformBadge(o.platform)}</td>
      <td>${escapeHtml(o.platform_order_id)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>\u00a5${(Number(o.total_amount) || 0).toLocaleString()}</td>
      <td>\u00a5${(Number(o.tax_total) || 0).toLocaleString()}</td>
      <td class="col-hide-mobile">${formatDate(o.created_at)}</td>
      <td>${orderActions(o)}</td>
    </tr>
  `).join('');
}

// --- Inventory ---
async function loadInventory() {
    const data = await apiFetch('/api/v1/inventory');
    const tbody = document.getElementById('inventoryTableBody');

    if (!data?.products?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('inventory.empty')}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.products.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.sku)}</strong></td>
      <td>${escapeHtml(p.name_jp) || '\u2014'}</td>
      <td class="col-hide-mobile">${escapeHtml(p.name_cn) || '\u2014'}</td>
      <td>\u00a5${(Number(p.cost_price) || 0).toLocaleString()}</td>
      <td>${taxBadge(p.tax_category)}</td>
      <td><strong>${Number(p.total_stock) || 0}</strong></td>
      <td class="admin-only" style="display:none">
        <button class="btn-sm" onclick="openEditProductModal(${Number(p.id)}, '${escapeHtml(p.name_jp || '')}', '${escapeHtml(p.name_cn || '')}', ${Number(p.cost_price)}, '${escapeHtml(p.tax_category)}')">${t('inventory.edit')}</button>
        <button class="btn-danger" onclick="deleteProduct(${Number(p.id)}, '${escapeHtml(p.sku)}')" style="margin-left:4px">${t('inventory.delete')}</button>
      </td>
    </tr>
  `).join('');
    if (window._isAdmin) {
        document.querySelectorAll('#page-inventory .admin-only').forEach(el => el.style.display = '');
    }
}

// --- Wallet ---
async function loadWallet(distributorId = 1) {
    const balanceData = await apiFetch(`/api/v1/wallet/balance/${distributorId}`);

    if (balanceData && !balanceData.error) {
        const balance = Number(balanceData.balance) || 0;
        const frozen = Number(balanceData.frozen) || 0;
        document.getElementById('walletBalance').textContent = `\u00a5${balance.toLocaleString()}`;
        document.getElementById('walletFrozen').textContent = `\u00a5${frozen.toLocaleString()}`;
        document.getElementById('walletTotal').textContent = `\u00a5${(balance + frozen).toLocaleString()}`;
    }

    const txData = await apiFetch(`/api/v1/wallet/transactions/${distributorId}`);
    const tbody = document.getElementById('walletTransBody');

    if (!txData?.transactions?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('wallet.empty')}</td></tr>`;
        return;
    }

    tbody.innerHTML = txData.transactions.map(tx => `
    <tr>
      <td>#${escapeHtml(tx.id)}</td>
      <td>${txTypeBadge(tx.type)}</td>
      <td class="${tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? 'text-green' : 'text-red'}">
        ${tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? '+' : '-'}\u00a5${Math.abs(Number(tx.amount) || 0).toLocaleString()}
      </td>
      <td class="col-hide-mobile">${escapeHtml(tx.related_order_id) || '\u2014'}</td>
      <td class="col-hide-mobile">\u00a5${(Number(tx.balance_snapshot) || 0).toLocaleString()}</td>
      <td>${formatDate(tx.created_at)}</td>
    </tr>
  `).join('');
}

// --- Commissions ---
async function loadCommissions() {
    const ratesData = await apiFetch('/api/v1/commissions/rates');
    const ratesBody = document.getElementById('commRatesBody');

    if (ratesData?.rates?.length) {
        ratesBody.innerHTML = ratesData.rates.map(r => `
        <tr>
          <td><strong>${escapeHtml(r.sku)}</strong></td>
          <td>${platformBadge(r.platform)}</td>
          <td>${(r.rate * 100).toFixed(1)}%</td>
        </tr>`).join('');
    } else {
        ratesBody.innerHTML = `<tr class="empty-row"><td colspan="3">${t('commissions.rates_empty')}</td></tr>`;
    }

    loadCommissionHistory(0);
}

async function loadCommissionHistory(offset) {
    const status = document.getElementById('commStatusFilter')?.value || '';
    let url = `/api/v1/commissions/history?limit=20&offset=${offset}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('commHistoryBody');

    if (!data?.settlements?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="9">${t('commissions.empty')}</td></tr>`;
        document.getElementById('commPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.settlements.map(s => `
    <tr>
      <td>#${escapeHtml(s.id)}</td>
      <td>#${escapeHtml(s.order_id)}</td>
      <td>${escapeHtml(s.sku)}</td>
      <td class="col-hide-mobile">${platformBadge(s.platform)}</td>
      <td>${s.qty}</td>
      <td>\u00a5${(Number(s.unit_price) || 0).toLocaleString()}</td>
      <td>\u00a5${(Number(s.commission_amount) || 0).toLocaleString()}</td>
      <td>${commStatusBadge(s.status)}</td>
      <td class="col-hide-mobile">${formatDate(s.created_at)}</td>
    </tr>`).join('');

    renderPagination('commPagination', offset, 20, data.total, (newOffset) => loadCommissionHistory(newOffset));
}

// --- Invoices ---
async function loadInvoices(offset = 0) {
    const data = await apiFetch(`/api/v1/invoices?limit=20&offset=${offset}`);
    const tbody = document.getElementById('invoicesTableBody');

    if (!data?.invoices?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('invoices.empty')}</td></tr>`;
        document.getElementById('invoicesPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.invoices.map(inv => `
    <tr>
      <td>#${escapeHtml(inv.id)}</td>
      <td>${escapeHtml(inv.invoice_number) || '\u2014'}</td>
      <td>#${escapeHtml(inv.order_id)}</td>
      <td class="col-hide-mobile">${platformBadge(inv.platform || '')}</td>
      <td>\u00a5${(Number(inv.total_amount || inv.amount) || 0).toLocaleString()}</td>
      <td>${formatDate(inv.created_at)}</td>
      <td>
        <button class="btn-sm" onclick="viewInvoiceDetail(${Number(inv.id)})">${t('invoices.detail')}</button>
        ${inv.pdf_url ? `<a href="/api/v1/invoices/${Number(inv.id)}/pdf" target="_blank" class="btn-sm" style="margin-left:4px;text-decoration:none">PDF</a>` : ''}
      </td>
    </tr>`).join('');

    renderPagination('invoicesPagination', offset, 20, data.total, (newOffset) => loadInvoices(newOffset));
}

async function viewInvoiceDetail(id) {
    openModal('invoiceDetailModal');
    const content = document.getElementById('invoiceDetailContent');
    content.innerHTML = `<p style="color:var(--text-muted)">${t('invoices.loading')}</p>`;

    const data = await apiFetch(`/api/v1/invoices/${id}`);
    if (!data || data.error) {
        content.innerHTML = `<p style="color:var(--accent-red)">${t('common.error')}: ${escapeHtml(data?.error || '')}</p>`;
        return;
    }

    const inv = data.invoice || data;
    const taxDetails = typeof inv.tax_details === 'string' ? JSON.parse(inv.tax_details) : inv.tax_details;

    let taxItemsHtml = '';
    if (taxDetails?.items?.length) {
        taxItemsHtml = `
        <table class="data-table" style="margin-top:12px">
          <thead><tr><th>SKU</th><th>${t('commissions.hist_qty')}</th><th>${t('commissions.hist_price')}</th><th>${t('orders.tax')}</th><th>${t('orders.amount')}</th></tr></thead>
          <tbody>${taxDetails.items.map(it => `
            <tr>
              <td>${escapeHtml(it.sku)}</td>
              <td>${it.qty}</td>
              <td>\u00a5${(it.unit_price || 0).toLocaleString()}</td>
              <td>${((it.tax_rate || 0) * 100).toFixed(0)}%</td>
              <td>\u00a5${(it.tax_amount || 0).toLocaleString()}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    }

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div>
          <span style="color:var(--text-muted);font-size:0.8rem">${t('invoices.number')}</span>
          <p style="font-weight:600;margin-top:4px">${escapeHtml(inv.invoice_number)}</p>
        </div>
        <div>
          <span style="color:var(--text-muted);font-size:0.8rem">${t('invoices.date')}</span>
          <p style="font-weight:600;margin-top:4px">${formatDate(inv.created_at)}</p>
        </div>
        <div>
          <span style="color:var(--text-muted);font-size:0.8rem">${t('distributors.name')}</span>
          <p style="font-weight:600;margin-top:4px">${escapeHtml(taxDetails?.seller?.name || '\u2014')}</p>
          <p style="font-size:0.8rem;color:var(--text-secondary)">${escapeHtml(taxDetails?.seller?.registration_number || '')}</p>
        </div>
      </div>
      ${taxItemsHtml}
      <div style="text-align:right;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <strong style="font-size:1.2rem">\u00a5${(Number(taxDetails?.summary?.grandTotal || taxDetails?.total_with_tax) || 0).toLocaleString()}</strong>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
        ${inv.pdf_url
            ? `<a href="/api/v1/invoices/${Number(inv.id)}/pdf" target="_blank" class="btn-primary" style="text-decoration:none;padding:8px 16px;border-radius:8px;font-size:0.85rem">PDF</a>`
            : `<button class="btn-primary" onclick="generateInvoicePdf(${Number(inv.id)})" style="padding:8px 16px;font-size:0.85rem">PDF</button>`
        }
      </div>`;
}

async function generateInvoicePdf(id) {
    const result = await apiFetch(`/api/v1/invoices/${Number(id)}/pdf`, { method: 'POST' });
    if (result?.error) {
        alert(`${t('common.error')}: ${result.error}`);
        return;
    }
    viewInvoiceDetail(id);
}

// --- Distributors ---
async function loadDistributors(offset = 0) {
    const data = await apiFetch(`/api/v1/distributors?limit=20&offset=${offset}`);
    const tbody = document.getElementById('distributorsTableBody');

    if (!data?.distributors?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${t('distributors.empty')}</td></tr>`;
        document.getElementById('distributorsPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.distributors.map(d => `
    <tr>
      <td>#${escapeHtml(d.id)}</td>
      <td><strong>${escapeHtml(d.name)}</strong></td>
      <td>${roleBadge(d.role)}</td>
      <td>\u00a5${(Number(d.balance) || 0).toLocaleString()}</td>
      <td class="col-hide-mobile">\u00a5${(Number(d.frozen_balance) || 0).toLocaleString()}</td>
      <td class="col-hide-mobile">${escapeHtml(d.tax_reg_number) || '\u2014'}</td>
      <td class="col-hide-mobile">${formatDate(d.created_at)}</td>
      <td>
        <button class="btn-sm" onclick="openDistributorModal(${Number(d.id)})">${t('distributors.edit')}</button>
        <button class="btn-sm" onclick="resetDistributorToken(${Number(d.id)})" style="margin-left:4px">${t('distributors.reset_token')}</button>
      </td>
    </tr>`).join('');

    renderPagination('distributorsPagination', offset, 20, data.total, (newOffset) => loadDistributors(newOffset));
}

function openDistributorModal(id) {
    const form = document.getElementById('distributorForm');
    form.reset();

    if (id) {
        document.getElementById('distributorModalTitle').textContent = t('distributors.modal_edit');
        document.getElementById('distributorFormId').value = id;
        apiFetch(`/api/v1/distributors/${Number(id)}`).then(data => {
            if (data?.distributor) {
                document.getElementById('distributorFormName').value = data.distributor.name || '';
                document.getElementById('distributorFormRole').value = data.distributor.role || 'distributor';
                document.getElementById('distributorFormTaxReg').value = data.distributor.tax_reg_number || '';
            }
        });
    } else {
        document.getElementById('distributorModalTitle').textContent = t('distributors.modal_new');
        document.getElementById('distributorFormId').value = '';
    }
    openModal('distributorModal');
}

async function saveDistributor() {
    const id = document.getElementById('distributorFormId').value;
    const name = document.getElementById('distributorFormName').value.trim();
    const role = document.getElementById('distributorFormRole').value;
    const taxReg = document.getElementById('distributorFormTaxReg').value.trim();

    if (!name) { alert(t('error.required_name')); return; }

    const payload = { name, role, tax_reg_number: taxReg || undefined };

    if (id) {
        const result = await apiFetch(`/api/v1/distributors/${Number(id)}`, {
            method: 'PUT', body: JSON.stringify(payload),
        });
        if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    } else {
        const result = await apiFetch('/api/v1/distributors', {
            method: 'POST', body: JSON.stringify(payload),
        });
        if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
        if (result?.distributor?.token) {
            alert(`Token: ${result.distributor.token}`);
        }
    }

    closeModal('distributorModal');
    loadDistributors();
}

async function resetDistributorToken(id) {
    if (!confirm(t('confirm.reset_token'))) return;

    const result = await apiFetch(`/api/v1/distributors/${Number(id)}/reset-token`, { method: 'POST' });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    if (result?.token) {
        alert(`Token: ${result.token}`);
    }
}

function roleBadge(role) {
    if (role === 'admin') return '<span class="badge badge-shipped">Admin</span>';
    return '<span class="badge badge-pending">Distributor</span>';
}

// --- Audit Logs ---
async function loadAuditLogs(offset = 0) {
    const action = document.getElementById('auditActionFilter')?.value || '';
    const startDate = document.getElementById('auditStartDate')?.value || '';
    const endDate = document.getElementById('auditEndDate')?.value || '';

    let url = `/api/v1/audit-logs?limit=20&offset=${offset}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&end_date=${encodeURIComponent(endDate + 'T23:59:59')}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('auditTableBody');

    if (!data?.logs?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${t('audit.empty')}</td></tr>`;
        document.getElementById('auditPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.logs.map(log => `
    <tr>
      <td>#${escapeHtml(log.id)}</td>
      <td>${escapeHtml(log.distributor_name || log.distributor_id || '\u2014')}</td>
      <td><span class="badge badge-processing">${escapeHtml(log.action)}</span></td>
      <td>${escapeHtml(log.resource_type)}</td>
      <td class="col-hide-mobile">${escapeHtml(log.resource_id) || '\u2014'}</td>
      <td class="col-hide-mobile" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(log.details || '')}">${escapeHtml(log.details) || '\u2014'}</td>
      <td class="col-hide-mobile">${escapeHtml(log.ip_address) || '\u2014'}</td>
      <td>${formatDate(log.created_at)}</td>
    </tr>`).join('');

    renderPagination('auditPagination', offset, 20, data.total, (newOffset) => loadAuditLogs(newOffset));
}

// ===== Pagination =====
function renderPagination(containerId, offset, limit, total, onNavigate) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (total <= limit) { container.innerHTML = ''; return; }

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    const prevDisabled = currentPage <= 1 ? 'disabled' : '';
    const nextDisabled = currentPage >= totalPages ? 'disabled' : '';

    container.innerHTML = `
      <button class="btn-ghost ${prevDisabled}" id="${containerId}-prev">${t('common.prev')}</button>
      <span style="color:var(--text-secondary);font-size:0.85rem">${currentPage} / ${totalPages}</span>
      <button class="btn-ghost ${nextDisabled}" id="${containerId}-next">${t('common.next')}</button>`;

    if (!prevDisabled) {
        container.querySelector(`#${containerId}-prev`).addEventListener('click', () => onNavigate(offset - limit));
    }
    if (!nextDisabled) {
        container.querySelector(`#${containerId}-next`).addEventListener('click', () => onNavigate(offset + limit));
    }
}

// ===== Actions =====
async function shipOrder(orderId) {
    const tracking = prompt(t('prompt.tracking'));
    if (!tracking) return;
    const result = await apiFetch(`/api/v1/orders/${Number(orderId)}/ship`, {
        method: 'PATCH', body: JSON.stringify({ tracking_number: tracking }),
    });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    loadOrders();
}

async function addProduct(formData) {
    const payload = Object.fromEntries(formData);
    payload.cost_price = Number(payload.cost_price);
    const result = await apiFetch('/api/v1/inventory/products', {
        method: 'POST', body: JSON.stringify(payload),
    });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    closeModal('addProductModal');
    loadInventory();
}

async function inboundStock(formData) {
    const payload = Object.fromEntries(formData);
    payload.quantity = Number(payload.quantity);
    const result = await apiFetch('/api/v1/inventory/inbound', {
        method: 'POST', body: JSON.stringify(payload),
    });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    closeModal('inboundModal');
    loadInventory();
}

async function deposit(formData) {
    const payload = Object.fromEntries(formData);
    payload.distributor_id = Number(payload.distributor_id);
    payload.amount = Number(payload.amount);
    const result = await apiFetch('/api/v1/wallet/deposit', {
        method: 'POST', body: JSON.stringify(payload),
    });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    closeModal('depositModal');
    loadWallet(payload.distributor_id);
}

// ===== Order Actions =====
function orderActions(o) {
    const btns = [];
    if (o.status === 'PROCESSING') {
        btns.push(`<button class="btn-sm" onclick="shipOrder(${Number(o.id)})">${t('orders.ship')}</button>`);
    }
    if (o.status === 'SHIPPED' && window._isAdmin) {
        btns.push(`<button class="btn-sm" onclick="deliverOrder(${Number(o.id)})">${t('orders.deliver')}</button>`);
    }
    if ((o.status === 'PENDING' || o.status === 'PROCESSING')) {
        btns.push(`<button class="btn-danger" onclick="cancelOrder(${Number(o.id)})" style="margin-left:4px">${t('orders.cancel')}</button>`);
    }
    return btns.length ? btns.join('') : '\u2014';
}

async function deliverOrder(orderId) {
    if (!confirm(t('confirm.deliver'))) return;
    const result = await apiFetch(`/api/v1/orders/${Number(orderId)}/deliver`, { method: 'PATCH' });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    loadOrders();
}

async function cancelOrder(orderId) {
    if (!confirm(t('confirm.cancel_order'))) return;
    const result = await apiFetch(`/api/v1/orders/${Number(orderId)}/cancel`, { method: 'PATCH' });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    loadOrders();
}

// ===== Product Management =====
function openEditProductModal(id, nameJp, nameCn, costPrice, taxCategory) {
    document.getElementById('editProductId').value = id;
    document.getElementById('editProductNameJp').value = nameJp;
    document.getElementById('editProductNameCn').value = nameCn;
    document.getElementById('editProductPrice').value = costPrice;
    document.getElementById('editProductTax').value = taxCategory;
    document.getElementById('editProductImage').value = '';
    openModal('editProductModal');
}

async function saveProduct() {
    const id = document.getElementById('editProductId').value;
    const payload = {
        name_jp: document.getElementById('editProductNameJp').value.trim() || undefined,
        name_cn: document.getElementById('editProductNameCn').value.trim() || undefined,
        cost_price: Number(document.getElementById('editProductPrice').value),
        tax_category: document.getElementById('editProductTax').value,
    };

    if (!payload.cost_price || payload.cost_price <= 0) {
        alert(`${t('common.error')}`);
        return;
    }

    const result = await apiFetch(`/api/v1/inventory/products/${Number(id)}`, {
        method: 'PUT', body: JSON.stringify(payload),
    });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }

    const fileInput = document.getElementById('editProductImage');
    if (fileInput.files.length > 0) {
        await uploadProductImage(Number(id), fileInput.files[0]);
    }

    closeModal('editProductModal');
    loadInventory();
}

async function deleteProduct(id, sku) {
    if (!confirm(t('confirm.delete_product', { sku }))) return;
    const result = await apiFetch(`/api/v1/inventory/products/${Number(id)}`, { method: 'DELETE' });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    loadInventory();
}

async function uploadProductImage(id, file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await apiFetchRaw(`/api/v1/inventory/products/${Number(id)}/image`, {
        method: 'POST',
        body: formData,
    });
    if (!res || !res.ok) {
        const errData = res ? await res.json().catch(() => null) : null;
        alert(`${t('common.error')}: ${errData?.error || 'Unknown error'}`);
    }
}

// ===== Password Change =====
async function changePassword() {
    const currentPw = document.getElementById('currentPasswordInput').value;
    const newPw = document.getElementById('newPasswordInput').value;
    const errEl = document.getElementById('changePasswordError');
    errEl.textContent = '';

    if (!currentPw || !newPw) return;
    if (newPw.length < 8) { errEl.textContent = 'Min 8 characters'; return; }

    const result = await apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    });

    if (result?.error) { errEl.textContent = result.error; return; }
    closeModal('changePasswordModal');
    document.getElementById('changePasswordForm').reset();
    alert(t('common.success'));
}

// ===== 2FA Management =====
async function load2FAStatus() {
    const content = document.getElementById('twoFAContent');
    content.innerHTML = `<p style="color:var(--text-muted)">${t('common.loading')}</p>`;

    const data = await apiFetch('/api/v1/auth/me');
    if (!data?.distributor) {
        content.innerHTML = `<p style="color:var(--accent-red)">${t('common.error')}</p>`;
        return;
    }

    if (data.distributor.totp_enabled) {
        content.innerHTML = `
          <p style="color:var(--accent-emerald);margin-bottom:16px">2FA is enabled</p>
          <div class="form-group">
            <label data-i18n="auth.2fa_code">${t('auth.2fa_code')}</label>
            <input type="text" id="disable2faCode" placeholder="000000" maxlength="6" inputmode="numeric">
          </div>
          <button class="btn-danger" onclick="disable2FA()" style="width:100%">${t('auth.2fa_disable')}</button>
          <div id="twoFAError" style="color:var(--accent-red);font-size:0.85rem;margin-top:8px"></div>`;
    } else {
        content.innerHTML = `
          <p style="color:var(--text-muted);margin-bottom:16px">2FA is not enabled</p>
          <button class="btn-primary" onclick="setup2FA()" style="width:100%">${t('auth.2fa_enable')}</button>
          <div id="twoFASetupArea"></div>
          <div id="twoFAError" style="color:var(--accent-red);font-size:0.85rem;margin-top:8px"></div>`;
    }
}

async function setup2FA() {
    const result = await apiFetch('/api/v1/auth/totp/setup', { method: 'POST' });
    if (result?.error) {
        document.getElementById('twoFAError').textContent = result.error;
        return;
    }

    const area = document.getElementById('twoFASetupArea');
    area.innerHTML = `
      <div style="margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:8px">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">${t('auth.2fa_scan_qr')}</p>
        <div id="qrContainer" style="text-align:center;margin:12px 0;background:#fff;border-radius:8px;padding:16px;display:inline-block"></div>
        <p style="font-size:0.75rem;color:var(--text-muted);word-break:break-all;margin-top:8px">Secret: ${escapeHtml(result.secret)}</p>
      </div>
      <div class="form-group" style="margin-top:16px">
        <label>${t('auth.2fa_enter_code')}</label>
        <input type="text" id="setup2faCode" placeholder="000000" maxlength="6" inputmode="numeric">
      </div>
      <button class="btn-primary" onclick="verifySetup2FA()" style="width:100%">${t('common.confirm')}</button>`;

    // Generate QR code if library is available
    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrContainer'), {
            text: result.otpauth_uri,
            width: 200,
            height: 200,
        });
    } else {
        // Fallback: show URI
        document.getElementById('qrContainer').innerHTML =
            `<p style="font-size:0.75rem;color:#333;word-break:break-all">${escapeHtml(result.otpauth_uri)}</p>`;
    }
}

async function verifySetup2FA() {
    const code = document.getElementById('setup2faCode')?.value?.trim();
    if (!code || code.length !== 6) return;

    const result = await apiFetch('/api/v1/auth/totp/verify-setup', {
        method: 'POST', body: JSON.stringify({ code }),
    });

    if (result?.error) {
        document.getElementById('twoFAError').textContent = result.error;
        return;
    }

    alert(t('common.success'));
    load2FAStatus();
}

async function disable2FA() {
    const code = document.getElementById('disable2faCode')?.value?.trim();
    if (!code || code.length !== 6) return;

    const result = await apiFetch('/api/v1/auth/totp/disable', {
        method: 'POST', body: JSON.stringify({ code }),
    });

    if (result?.error) {
        document.getElementById('twoFAError').textContent = result.error;
        return;
    }

    alert(t('common.success'));
    load2FAStatus();
}

// ===== Reports =====
let currentReportPeriod = '7d';

async function loadReports() {
    loadReportSummary(currentReportPeriod);
    loadProfitAnalysis(currentReportPeriod);
    loadPlatformComparison(currentReportPeriod);
    loadTrendComparison(currentReportPeriod);
}

async function loadReportSummary(period) {
    const data = await apiFetch(`/api/v1/reports/summary?period=${period}`);
    if (!data || data.error) return;
    document.getElementById('report-revenue').textContent = `\u00a5${(data.revenue || 0).toLocaleString()}`;
    document.getElementById('report-profit').textContent = `\u00a5${(data.profit || 0).toLocaleString()}`;
    document.getElementById('report-commission').textContent = `\u00a5${(data.commission || 0).toLocaleString()}`;
    document.getElementById('report-avg').textContent = `\u00a5${(data.avgValue || 0).toLocaleString()}`;
}

let currentProfitGroupBy = 'product';

async function loadProfitAnalysis(period) {
    const data = await apiFetch(`/api/v1/reports/profit-analysis?period=${period}&group_by=${currentProfitGroupBy}`);
    const tbody = document.getElementById('profitTableBody');
    if (!data?.data?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${t('reports.no_data')}</td></tr>`;
        clearCanvas('profitChart');
        return;
    }
    const keyField = currentProfitGroupBy === 'platform' ? 'platform' : 'sku';
    tbody.innerHTML = data.data.map(r => `
    <tr>
      <td><strong>${escapeHtml(r[keyField])}</strong></td>
      <td>\u00a5${(r.revenue || 0).toLocaleString()}</td>
      <td>\u00a5${(r.cost || 0).toLocaleString()}</td>
      <td>\u00a5${(r.profit || 0).toLocaleString()}</td>
      <td>${r.margin}%</td>
    </tr>`).join('');

    renderBarChart('profitChart', data.data.map(r => r[keyField]), [
        { label: t('reports.revenue'), values: data.data.map(r => r.revenue), color: '#8b5cf6' },
        { label: t('reports.cost'), values: data.data.map(r => r.cost), color: '#3b82f6' },
        { label: t('reports.profit'), values: data.data.map(r => r.profit), color: '#10b981' },
    ]);
}

async function loadPlatformComparison(period) {
    const data = await apiFetch(`/api/v1/reports/platform-comparison?period=${period}`);
    const tbody = document.getElementById('platformTableBody');
    if (!data?.platforms?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${t('reports.no_data')}</td></tr>`;
        clearCanvas('platformChart');
        return;
    }
    tbody.innerHTML = data.platforms.map(p => `
    <tr>
      <td>${platformBadge(p.platform)}</td>
      <td>${p.orderCount}</td>
      <td>${p.deliveredCount}</td>
      <td>${p.cancelRate}%</td>
      <td>\u00a5${(p.revenue || 0).toLocaleString()}</td>
    </tr>`).join('');

    renderBarChart('platformChart', data.platforms.map(p => p.platform), [
        { label: t('reports.order_count'), values: data.platforms.map(p => p.orderCount), color: '#8b5cf6' },
        { label: t('reports.delivered_count'), values: data.platforms.map(p => p.deliveredCount), color: '#10b981' },
        { label: t('reports.cancelled_count'), values: data.platforms.map(p => p.cancelledCount), color: '#ef4444' },
    ]);
}

async function loadTrendComparison(period) {
    if (period === 'all') {
        clearCanvas('trendChart');
        document.getElementById('trendSummary').innerHTML = '';
        return;
    }
    const data = await apiFetch(`/api/v1/reports/trend-comparison?period=${period}`);
    if (!data) return;

    const summary = data.summary || {};
    const growthText = summary.revenueGrowth != null ? `${summary.revenueGrowth > 0 ? '+' : ''}${summary.revenueGrowth}%` : 'N/A';
    document.getElementById('trendSummary').innerHTML = `
        <span>${t('reports.current_period')}: \u00a5${(summary.currentRevenue || 0).toLocaleString()}</span>
        <span>${t('reports.previous_period')}: \u00a5${(summary.previousRevenue || 0).toLocaleString()}</span>
        <span>${t('reports.growth')}: ${growthText}</span>`;

    renderDualLineChart('trendChart', data.current || [], data.previous || []);
}

function clearCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(t('reports.no_data'), canvas.width / 2, canvas.height / 2);
}

function renderBarChart(canvasId, labels, datasets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!labels.length) { clearCanvas(canvasId); return; }

    const padding = { top: 20, right: 20, bottom: 50, left: 60 };
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;

    const allValues = datasets.flatMap(d => d.values);
    const max = Math.max(...allValues, 1) * 1.2;
    const groupCount = labels.length;
    const barCount = datasets.length;
    const groupWidth = chartW / groupCount;
    const barWidth = Math.min(groupWidth / (barCount + 1), 30);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(canvas.width - padding.right, y); ctx.stroke();
        ctx.fillStyle = '#64748b'; ctx.font = '11px Inter'; ctx.textAlign = 'right';
        ctx.fillText(formatChartValue(max - (max / 4) * i), padding.left - 8, y + 4);
    }

    // Bars
    for (let g = 0; g < groupCount; g++) {
        for (let b = 0; b < barCount; b++) {
            const val = datasets[b].values[g] || 0;
            const barH = (val / max) * chartH;
            const x = padding.left + g * groupWidth + (groupWidth - barCount * barWidth) / 2 + b * barWidth;
            const y = padding.top + chartH - barH;

            ctx.fillStyle = datasets[b].color;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(x, y, barWidth - 2, barH);
            ctx.globalAlpha = 1;
        }
        // Label
        ctx.fillStyle = '#64748b'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
        const labelX = padding.left + g * groupWidth + groupWidth / 2;
        const label = labels[g].length > 10 ? labels[g].slice(0, 10) + '..' : labels[g];
        ctx.fillText(label, labelX, canvas.height - padding.bottom + 16);
    }

    // Legend
    let legendX = padding.left;
    ctx.font = '10px Inter';
    datasets.forEach(d => {
        ctx.fillStyle = d.color;
        ctx.fillRect(legendX, canvas.height - 12, 10, 10);
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText(d.label, legendX + 14, canvas.height - 3);
        legendX += ctx.measureText(d.label).width + 28;
    });
}

function renderDualLineChart(canvasId, current, previous) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!current.length && !previous.length) { clearCanvas(canvasId); return; }

    const padding = { top: 20, right: 20, bottom: 50, left: 60 };
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;

    const allRev = [...current.map(d => d.revenue), ...previous.map(d => d.revenue)];
    const max = Math.max(...allRev, 1) * 1.2;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(canvas.width - padding.right, y); ctx.stroke();
        ctx.fillStyle = '#64748b'; ctx.font = '11px Inter'; ctx.textAlign = 'right';
        ctx.fillText(formatChartValue(max - (max / 4) * i), padding.left - 8, y + 4);
    }

    function drawLine(data, color, dashed) {
        if (!data.length) return;
        const step = data.length > 1 ? chartW / (data.length - 1) : 0;
        const points = data.map((d, i) => ({
            x: padding.left + step * i,
            y: padding.top + chartH - (d.revenue / max) * chartH,
        }));

        ctx.beginPath();
        ctx.setLineDash(dashed ? [6, 4] : []);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.setLineDash([]);

        points.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();
        });
    }

    drawLine(current, '#8b5cf6', false);
    drawLine(previous, '#64748b', true);

    // X-axis labels for current period
    if (current.length) {
        ctx.fillStyle = '#64748b'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
        const step = current.length > 1 ? chartW / (current.length - 1) : 0;
        const labelStep = Math.max(1, Math.floor(current.length / 7));
        current.forEach((d, i) => {
            if (i % labelStep === 0 || i === current.length - 1) {
                const x = padding.left + step * i;
                ctx.fillText(d.date ? d.date.slice(5) : '', x, canvas.height - padding.bottom + 16);
            }
        });
    }

    // Legend
    ctx.fillStyle = '#8b5cf6'; ctx.fillRect(padding.left, canvas.height - 12, 16, 3);
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px Inter'; ctx.textAlign = 'left';
    ctx.fillText(t('reports.current_period'), padding.left + 20, canvas.height - 3);
    ctx.fillStyle = '#64748b'; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(padding.left + 120, canvas.height - 10); ctx.lineTo(padding.left + 136, canvas.height - 10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(t('reports.previous_period'), padding.left + 140, canvas.height - 3);
}

function formatChartValue(val) {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'K';
    return Math.round(val).toString();
}

async function buildCustomReport() {
    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;
    if (!startDate || !endDate) { alert('Select date range'); return; }

    const dims = Array.from(document.querySelectorAll('input[name="dim"]:checked')).map(cb => cb.value);
    const metrics = Array.from(document.querySelectorAll('input[name="metric"]:checked')).map(cb => cb.value);
    if (!dims.length || !metrics.length) { alert('Select dimensions and metrics'); return; }

    const params = `start_date=${startDate}&end_date=${endDate}&dimensions=${dims.join(',')}&metrics=${metrics.join(',')}`;
    const data = await apiFetch(`/api/v1/reports/custom?${params}`);
    if (!data || data.error) {
        alert(data?.error || t('common.error'));
        return;
    }

    const allCols = [...dims, ...metrics];
    const thead = document.getElementById('customReportHead');
    thead.innerHTML = `<tr>${allCols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;

    const tbody = document.getElementById('customReportBody');
    if (!data.data?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="${allCols.length}">${t('reports.no_data')}</td></tr>`;
        return;
    }
    tbody.innerHTML = data.data.map(row =>
        `<tr>${allCols.map(c => {
            const val = row[c];
            const isNum = typeof val === 'number' && !dims.includes(c);
            return `<td>${isNum ? '\u00a5' + val.toLocaleString() : escapeHtml(val)}</td>`;
        }).join('')}</tr>`
    ).join('');
}

function exportCustomReport() {
    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;
    if (!startDate || !endDate) { alert('Select date range'); return; }

    const dims = Array.from(document.querySelectorAll('input[name="dim"]:checked')).map(cb => cb.value);
    const metrics = Array.from(document.querySelectorAll('input[name="metric"]:checked')).map(cb => cb.value);
    if (!dims.length || !metrics.length) { alert('Select dimensions and metrics'); return; }

    const params = `start_date=${startDate}&end_date=${endDate}&dimensions=${dims.join(',')}&metrics=${metrics.join(',')}`;
    downloadCSV(`/api/v1/reports/custom/export?${params}`);
}

// --- Shipping ---
async function loadShipping(offset = 0) {
    const status = document.getElementById('shipStatusFilter')?.value || '';
    const carrier = document.getElementById('shipCarrierFilter')?.value || '';
    let url = `/api/v1/shipping?limit=20&offset=${offset}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (carrier) url += `&carrier=${encodeURIComponent(carrier)}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('shippingTableBody');

    if (!data?.shipments?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('shipping.empty')}</td></tr>`;
        document.getElementById('shippingPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.shipments.map(s => `
    <tr>
      <td>#${escapeHtml(s.id)}</td>
      <td><strong>#${escapeHtml(s.order_id)}</strong></td>
      <td>${escapeHtml(s.tracking_number)}</td>
      <td><span class="carrier-badge">${escapeHtml(s.carrier)}</span></td>
      <td>${shipStatusBadge(s.status)}</td>
      <td class="col-hide-mobile">${s.platform ? platformBadge(s.platform) : '\u2014'}</td>
      <td class="col-hide-mobile">${formatDate(s.shipped_at)}</td>
    </tr>`).join('');

    renderPagination('shippingPagination', offset, 20, data.total, (newOffset) => loadShipping(newOffset));
}

function shipStatusBadge(status) {
    const map = { SHIPPED: 'shipped', IN_TRANSIT: 'processing', DELIVERED: 'delivered', RETURNED: 'cancelled' };
    return `<span class="badge badge-${map[status] || 'pending'}">${escapeHtml(status)}</span>`;
}

async function createShipment() {
    const orderId = prompt(t('shipping.enter_order_id'));
    if (!orderId) return;
    const tracking = prompt(t('prompt.tracking'));
    if (!tracking) return;

    const carriers = ['YAMATO', 'SAGAWA', 'JAPAN_POST', 'FEDEX', 'DHL', 'OTHER'];
    const carrier = prompt(`Carrier (${carriers.join('/')}):`, 'YAMATO');
    if (!carrier || !carriers.includes(carrier.toUpperCase())) { alert('Invalid carrier'); return; }

    const result = await apiFetch('/api/v1/shipping', {
        method: 'POST',
        body: JSON.stringify({ order_id: Number(orderId), tracking_number: tracking, carrier: carrier.toUpperCase() }),
    });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    loadShipping();
}

// --- Customers ---
async function loadCustomers(offset = 0) {
    const search = document.getElementById('customerSearchInput')?.value || '';
    let url = `/api/v1/customers?limit=20&offset=${offset}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('customersTableBody');

    if (!data?.customers?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('customers.empty')}</td></tr>`;
        document.getElementById('customersPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.customers.map(c => {
        let tags = [];
        try { tags = JSON.parse(c.tags || '[]'); } catch(e) {}
        const tagHtml = tags.map(tag => `<span class="customer-tag">${escapeHtml(tag)}</span>`).join('');
        return `
        <tr>
          <td>#${escapeHtml(c.id)}</td>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${escapeHtml(c.email) || '\u2014'}</td>
          <td class="col-hide-mobile">${escapeHtml(c.phone) || '\u2014'}</td>
          <td class="col-hide-mobile">${escapeHtml(c.prefecture) || '\u2014'}</td>
          <td>${tagHtml || '\u2014'}</td>
          <td>
            <button class="btn-sm" onclick="openCustomerModal(${Number(c.id)})">${t('distributors.edit')}</button>
          </td>
        </tr>`;
    }).join('');

    renderPagination('customersPagination', offset, 20, data.total, (newOffset) => loadCustomers(newOffset));
}

function openCustomerModal(id) {
    const form = document.getElementById('customerForm');
    form.reset();
    document.getElementById('customerFormId').value = '';

    if (id) {
        document.getElementById('customerModalTitle').textContent = t('customers.edit');
        document.getElementById('customerFormId').value = id;
        apiFetch(`/api/v1/customers/${Number(id)}`).then(data => {
            if (data?.customer) {
                const c = data.customer;
                document.getElementById('customerFormName').value = c.name || '';
                document.getElementById('customerFormEmail').value = c.email || '';
                document.getElementById('customerFormPhone').value = c.phone || '';
                document.getElementById('customerFormAddr1').value = c.address_line1 || '';
                document.getElementById('customerFormCity').value = c.city || '';
                document.getElementById('customerFormPrefecture').value = c.prefecture || '';
                document.getElementById('customerFormPostal').value = c.postal_code || '';
                document.getElementById('customerFormNotes').value = c.notes || '';
            }
        });
    } else {
        document.getElementById('customerModalTitle').textContent = t('customers.add');
    }
    openModal('customerModal');
}

async function saveCustomer() {
    const id = document.getElementById('customerFormId').value;
    const payload = {
        name: document.getElementById('customerFormName').value.trim(),
        email: document.getElementById('customerFormEmail').value.trim() || undefined,
        phone: document.getElementById('customerFormPhone').value.trim() || undefined,
        address_line1: document.getElementById('customerFormAddr1').value.trim() || undefined,
        city: document.getElementById('customerFormCity').value.trim() || undefined,
        prefecture: document.getElementById('customerFormPrefecture').value.trim() || undefined,
        postal_code: document.getElementById('customerFormPostal').value.trim() || undefined,
        notes: document.getElementById('customerFormNotes').value.trim() || undefined,
    };

    if (!payload.name) { alert(t('error.required_name')); return; }

    if (id) {
        const result = await apiFetch(`/api/v1/customers/${Number(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    } else {
        const result = await apiFetch('/api/v1/customers', { method: 'POST', body: JSON.stringify(payload) });
        if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    }

    closeModal('customerModal');
    loadCustomers();
}

// --- Settings ---
async function loadSettings() {
    loadSystemInfo();
    loadBusinessConfig();
    loadSettingsUsers();
}

async function loadSystemInfo() {
    const data = await apiFetch('/api/v1/settings/system-info');
    const tbody = document.getElementById('systemInfoBody');
    if (!data?.counts) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="2">${t('common.error')}</td></tr>`;
        return;
    }

    tbody.innerHTML = Object.entries(data.counts).map(([key, val]) =>
        `<tr><td><strong>${escapeHtml(key)}</strong></td><td>${val}</td></tr>`
    ).join('');

    if (data.lastSync) {
        tbody.innerHTML += `<tr><td><strong>Last Sync</strong></td><td>${escapeHtml(data.lastSync.platform)} - ${formatDate(data.lastSync.started_at)}</td></tr>`;
    }
    if (data.lastBackup) {
        tbody.innerHTML += `<tr><td><strong>Last Backup</strong></td><td>${formatDate(data.lastBackup.created_at)}</td></tr>`;
    }
}

async function loadBusinessConfig() {
    const data = await apiFetch('/api/v1/settings/config');
    if (data?.config) {
        document.getElementById('configLowStock').value = data.config.low_stock_threshold || 10;
        document.getElementById('configDefaultCarrier').value = data.config.default_carrier || 'YAMATO';
    }
}

async function saveBusinessConfig() {
    const payload = {
        low_stock_threshold: Number(document.getElementById('configLowStock').value) || 10,
        default_carrier: document.getElementById('configDefaultCarrier').value || 'YAMATO',
    };

    const result = await apiFetch('/api/v1/settings/config', { method: 'PUT', body: JSON.stringify(payload) });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    alert(t('common.success'));
}

async function loadSettingsUsers() {
    const data = await apiFetch('/api/v1/distributors');
    const tbody = document.getElementById('settingsUsersBody');
    if (!data?.distributors?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${t('distributors.empty')}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.distributors.map(d => `
    <tr>
      <td>#${escapeHtml(d.id)}</td>
      <td><strong>${escapeHtml(d.name)}</strong></td>
      <td>${roleBadge(d.role)}</td>
      <td>${d.totp_enabled ? '<span class="badge badge-delivered">ON</span>' : '<span class="badge badge-pending">OFF</span>'}</td>
      <td>
        <button class="btn-sm" onclick="resetUserPassword(${Number(d.id)})">${t('settings.reset_pw')}</button>
        ${d.totp_enabled ? `<button class="btn-danger" onclick="disableUser2FA(${Number(d.id)})" style="margin-left:4px">${t('settings.disable_2fa')}</button>` : ''}
      </td>
    </tr>`).join('');
}

async function resetUserPassword(id) {
    const pw = prompt(t('settings.enter_new_password'));
    if (!pw || pw.length < 8) { alert('Min 8 characters'); return; }

    const result = await apiFetch(`/api/v1/settings/users/${Number(id)}/reset-password`, {
        method: 'POST', body: JSON.stringify({ new_password: pw }),
    });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    alert(t('common.success'));
}

async function disableUser2FA(id) {
    if (!confirm(t('settings.confirm_disable_2fa'))) return;

    const result = await apiFetch(`/api/v1/settings/users/${Number(id)}/disable-2fa`, { method: 'POST' });
    if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    alert(t('common.success'));
    loadSettingsUsers();
}

// --- Notifications ---
async function loadNotifBell() {
    const data = await apiFetch('/api/v1/notifications/unread-count');
    if (!data) return;
    const badge = document.getElementById('notifBadge');
    if (data.unreadCount > 0) {
        badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

async function loadNotifDropdown() {
    const data = await apiFetch('/api/v1/notifications?limit=10');
    const list = document.getElementById('notifList');
    if (!data?.notifications?.length) {
        list.innerHTML = `<div class="notif-empty">${t('notifications.empty')}</div>`;
        return;
    }

    list.innerHTML = data.notifications.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead(${Number(n.id)})">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-msg">${escapeHtml(n.message)}</div>
        <div class="notif-item-time">${formatDate(n.created_at)}</div>
      </div>`).join('');
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    const isActive = dropdown.classList.toggle('active');
    if (isActive) loadNotifDropdown();
}

async function markNotifRead(id) {
    await apiFetch(`/api/v1/notifications/${Number(id)}/read`, { method: 'PATCH' });
    loadNotifBell();
    loadNotifDropdown();
}

async function markAllNotifRead() {
    await apiFetch('/api/v1/notifications/mark-all-read', { method: 'POST' });
    loadNotifBell();
    loadNotifDropdown();
}

// Close notification dropdown on outside click
document.addEventListener('click', (e) => {
    const bell = document.getElementById('notifBell');
    if (bell && !bell.contains(e.target)) {
        document.getElementById('notifDropdown')?.classList.remove('active');
    }
});

// ===== Dynamic Modal Creation =====
function createInboundModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'inboundModal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${t('inventory.inbound')}</h3>
          <button class="modal-close" data-close="inboundModal">&#10005;</button>
        </div>
        <form id="inboundForm">
          <div class="form-group">
            <label>SKU</label>
            <input type="text" name="sku" required placeholder="例: CARROT-500ML">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>${t('commissions.hist_qty')}</label>
              <input type="number" name="quantity" required min="1" placeholder="100">
            </div>
            <div class="form-group">
              <label>Warehouse</label>
              <input type="text" name="warehouse" value="JP-MAIN" placeholder="JP-MAIN">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-close="inboundModal">${t('common.cancel')}</button>
            <button type="submit" class="btn-primary">${t('inventory.inbound')}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('[data-close="inboundModal"]').addEventListener('click', () => closeModal('inboundModal'));
    overlay.querySelector('.btn-secondary').addEventListener('click', () => closeModal('inboundModal'));
    overlay.querySelector('#inboundForm').addEventListener('submit', (e) => {
        e.preventDefault();
        inboundStock(new FormData(e.target));
        e.target.reset();
    });
}

function createDepositModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'depositModal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${t('wallet.deposit')}</h3>
          <button class="modal-close" data-close="depositModal">&#10005;</button>
        </div>
        <form id="depositForm">
          <input type="hidden" name="distributor_id" value="1">
          <div class="form-group">
            <label>${t('wallet.tx_amount')} (\u00a5)</label>
            <input type="number" name="amount" required min="1" placeholder="10000">
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-close="depositModal">${t('common.cancel')}</button>
            <button type="submit" class="btn-primary">${t('wallet.deposit')}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('[data-close="depositModal"]').addEventListener('click', () => closeModal('depositModal'));
    overlay.querySelector('.btn-secondary').addEventListener('click', () => closeModal('depositModal'));
    overlay.querySelector('#depositForm').addEventListener('submit', (e) => {
        e.preventDefault();
        deposit(new FormData(e.target));
        e.target.reset();
    });
}

// ===== UI Helpers =====
function platformBadge(platform) {
    const safe = escapeHtml(platform);
    const colors = { TIKTOK: '#25f4ee', TEMU: '#fb6f20', RAKUTEN: '#bf0000' };
    return `<span style="color:${colors[platform] || '#94a3b8'};font-weight:600">${safe}</span>`;
}

function statusBadge(status) {
    const safe = escapeHtml(status);
    const cls = { PENDING: 'pending', PROCESSING: 'processing', SHIPPED: 'shipped', DELIVERED: 'delivered', CANCELLED: 'cancelled' };
    return `<span class="badge badge-${cls[status] || 'pending'}">${safe}</span>`;
}

function commStatusBadge(status) {
    const map = {
        PENDING: { cls: 'pending', key: 'commissions.status_pending' },
        SETTLED: { cls: 'delivered', key: 'commissions.status_settled' },
        FAILED: { cls: 'pending', key: 'commissions.status_failed' },
    };
    const info = map[status] || { cls: 'pending', key: null };
    const label = info.key ? t(info.key) : escapeHtml(status);
    return `<span class="badge badge-${info.cls}">${label}</span>`;
}

function taxBadge(category) {
    if (category === 'reduced') return `<span class="badge badge-processing">${t('inventory.tax_reduced')}</span>`;
    return `<span class="badge badge-pending">${t('inventory.tax_standard')}</span>`;
}

function txTypeBadge(type) {
    const map = {
        DEPOSIT: { cls: 'delivered', label: '\u5165\u91d1' },
        FREEZE: { cls: 'processing', label: '\u51cd\u7d50' },
        DEDUCT: { cls: 'pending', label: '\u6c7a\u6e08' },
        REFUND: { cls: 'shipped', label: '\u8fd4\u91d1' },
    };
    const info = map[type] || { cls: 'pending', label: escapeHtml(type) };
    return `<span class="badge badge-${info.cls}">${info.label}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '\u2014';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function logout() {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    localStorage.removeItem('erp_token');
    window.location.href = '/login.html';
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    createInboundModal();
    createDepositModal();

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if (item.dataset.page) navigateTo(item.dataset.page);
        });
    });

    // "View all" links
    document.querySelectorAll('.btn-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(link.dataset.page); });
    });

    // Filters
    document.getElementById('orderPlatformFilter')?.addEventListener('change', loadOrders);
    document.getElementById('orderStatusFilter')?.addEventListener('change', loadOrders);
    document.getElementById('commStatusFilter')?.addEventListener('change', () => loadCommissionHistory(0));

    // Add Product Modal
    document.getElementById('addProductBtn')?.addEventListener('click', () => openModal('addProductModal'));
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.getElementById('addProductForm')?.addEventListener('submit', (e) => {
        e.preventDefault(); addProduct(new FormData(e.target)); e.target.reset();
    });

    // Inbound button
    document.getElementById('inboundBtn')?.addEventListener('click', () => openModal('inboundModal'));

    // Deposit button
    document.getElementById('depositBtn')?.addEventListener('click', () => openModal('depositModal'));

    // Sync button
    document.getElementById('syncOrdersBtn')?.addEventListener('click', loadOrders);

    // CSV export buttons
    document.getElementById('exportOrdersBtn')?.addEventListener('click', () => downloadCSV('/api/v1/orders/export'));
    document.getElementById('exportCommissionsBtn')?.addEventListener('click', () => downloadCSV('/api/v1/commissions/export'));
    document.getElementById('exportInvoicesBtn')?.addEventListener('click', () => downloadCSV('/api/v1/invoices/export'));

    // Chart period buttons
    document.querySelectorAll('[data-range]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderChart(btn.dataset.range);
        });
    });

    // Health check for status dot
    apiFetch('/health').then(data => {
        const dot = document.querySelector('.status-dot');
        if (data?.status !== 'healthy' && dot) {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 8px #ef4444';
        }
    });

    // Check admin role and init language from server
    window._isAdmin = false;
    apiFetch('/api/v1/auth/me').then(data => {
        if (data?.distributor) {
            if (data.distributor.role === 'admin') {
                window._isAdmin = true;
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
            }
            document.getElementById('userDisplayName').textContent = data.distributor.name || t('common.admin');
            // Initialize language from server preference
            if (typeof initLanguage === 'function') {
                initLanguage(data.distributor.language);
            }
        }
    });

    // Distributors management
    document.getElementById('addDistributorBtn')?.addEventListener('click', () => openDistributorModal());
    document.getElementById('exportDistributorsBtn')?.addEventListener('click', () => downloadCSV('/api/v1/distributors/export'));
    document.getElementById('distributorForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveDistributor();
    });
    document.querySelectorAll('[data-close="distributorModal"]').forEach(btn => {
        btn.addEventListener('click', () => closeModal('distributorModal'));
    });

    // Edit Product Modal
    document.getElementById('editProductForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProduct();
    });
    document.querySelectorAll('[data-close="editProductModal"]').forEach(btn => {
        btn.addEventListener('click', () => closeModal('editProductModal'));
    });

    // Audit logs
    document.getElementById('auditSearchBtn')?.addEventListener('click', () => loadAuditLogs(0));
    document.getElementById('exportAuditBtn')?.addEventListener('click', () => {
        const action = document.getElementById('auditActionFilter')?.value || '';
        const startDate = document.getElementById('auditStartDate')?.value || '';
        const endDate = document.getElementById('auditEndDate')?.value || '';
        let url = '/api/v1/audit-logs/export?';
        if (action) url += `action=${encodeURIComponent(action)}&`;
        if (startDate) url += `start_date=${encodeURIComponent(startDate)}&`;
        if (endDate) url += `end_date=${encodeURIComponent(endDate + 'T23:59:59')}&`;
        downloadCSV(url);
    });

    // Change Password form
    document.getElementById('changePasswordForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        changePassword();
    });

    // Report period buttons
    document.querySelectorAll('[data-report-period]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-report-period]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentReportPeriod = btn.dataset.reportPeriod;
            loadReports();
        });
    });

    // Profit analysis group toggle
    document.getElementById('profitByProduct')?.addEventListener('click', () => {
        currentProfitGroupBy = 'product';
        document.getElementById('profitByProduct').classList.add('active');
        document.getElementById('profitByPlatform').classList.remove('active');
        loadProfitAnalysis(currentReportPeriod);
    });
    document.getElementById('profitByPlatform')?.addEventListener('click', () => {
        currentProfitGroupBy = 'platform';
        document.getElementById('profitByPlatform').classList.add('active');
        document.getElementById('profitByProduct').classList.remove('active');
        loadProfitAnalysis(currentReportPeriod);
    });

    // Custom report buttons
    document.getElementById('generateReportBtn')?.addEventListener('click', buildCustomReport);
    document.getElementById('exportReportBtn')?.addEventListener('click', exportCustomReport);

    // Set default date range for custom report
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const dateStr = d => d.toISOString().slice(0, 10);
    if (document.getElementById('customEndDate')) {
        document.getElementById('customEndDate').value = dateStr(today);
        document.getElementById('customStartDate').value = dateStr(thirtyDaysAgo);
    }

    // Shipping
    document.getElementById('shipStatusFilter')?.addEventListener('change', () => loadShipping(0));
    document.getElementById('shipCarrierFilter')?.addEventListener('change', () => loadShipping(0));
    document.getElementById('createShipmentBtn')?.addEventListener('click', createShipment);
    document.getElementById('exportShippingBtn')?.addEventListener('click', () => downloadCSV('/api/v1/shipping/export'));

    // Customers
    document.getElementById('addCustomerBtn')?.addEventListener('click', () => openCustomerModal());
    document.getElementById('exportCustomersBtn')?.addEventListener('click', () => downloadCSV('/api/v1/customers/export'));
    document.getElementById('customerForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveCustomer(); });
    document.querySelectorAll('[data-close="customerModal"]').forEach(btn => {
        btn.addEventListener('click', () => closeModal('customerModal'));
    });
    let customerSearchTimer;
    document.getElementById('customerSearchInput')?.addEventListener('input', () => {
        clearTimeout(customerSearchTimer);
        customerSearchTimer = setTimeout(() => loadCustomers(0), 300);
    });

    // Settings
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`settings-${tab.dataset.settingsTab}`)?.classList.add('active');
        });
    });
    document.getElementById('businessConfigForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveBusinessConfig(); });

    // Notification bell - initial load + polling every 60s
    loadNotifBell();
    setInterval(loadNotifBell, 60000);

    // Initial load
    navigateTo('dashboard');

    // Apply initial translations
    if (typeof applyTranslations === 'function') applyTranslations();
});

// ===== Sprint 9: Returns =====
async function loadReturns(offset = 0) {
    const status = document.getElementById('returnStatusFilter')?.value || '';
    let url = `/api/v1/returns?limit=20&offset=${offset}`;
    if (status) url += `&status=${status}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('returnsTableBody');
    if (!data?.returns?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('returns.empty')}</td></tr>`;
        document.getElementById('returnsPagination').innerHTML = '';
        return;
    }
    tbody.innerHTML = data.returns.map(r => `
        <tr>
          <td>#${r.id}</td>
          <td>#${r.order_id}</td>
          <td><span class="status-badge status-${(r.status||'').toLowerCase()}">${r.status}</span></td>
          <td class="col-hide-mobile">${escapeHtml(r.reason) || '\u2014'}</td>
          <td>\u00A5${(r.refund_amount||0).toLocaleString()}</td>
          <td class="col-hide-mobile">${formatDate(r.created_at)}</td>
          <td>
            ${r.status === 'REQUESTED' && currentRole === 'admin' ? `<button class="btn-sm btn-success" onclick="approveReturn(${r.id})">${t('returns.approve')}</button> <button class="btn-sm btn-danger" onclick="rejectReturn(${r.id})">${t('returns.reject')}</button>` : ''}
            ${r.status === 'APPROVED' && currentRole === 'admin' ? `<button class="btn-sm" onclick="receiveReturn(${r.id})">${t('returns.receive')}</button>` : ''}
            ${r.status === 'RECEIVED' && currentRole === 'admin' ? `<button class="btn-sm btn-success" onclick="refundReturn(${r.id})">${t('returns.refund')}</button>` : ''}
          </td>
        </tr>`).join('');
    renderPagination('returnsPagination', offset, 20, data.total, (o) => loadReturns(o));
}
async function approveReturn(id) { await apiFetch(`/api/v1/returns/${id}/approve`, { method: 'PATCH' }); loadReturns(); }
async function rejectReturn(id) { const reason = prompt(t('returns.reject_reason')); await apiFetch(`/api/v1/returns/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }); loadReturns(); }
async function receiveReturn(id) { await apiFetch(`/api/v1/returns/${id}/receive`, { method: 'PATCH' }); loadReturns(); }
async function refundReturn(id) { if (!confirm(t('returns.confirm_refund'))) return; await apiFetch(`/api/v1/returns/${id}/refund`, { method: 'PATCH' }); loadReturns(); }

// ===== Sprint 9: Procurement =====
function switchPOTab(tab) {
    document.getElementById('suppliersSection').style.display = tab === 'suppliers' ? '' : 'none';
    document.getElementById('poSection').style.display = tab === 'orders' ? '' : 'none';
    document.getElementById('addSupplierBtn').style.display = tab === 'suppliers' ? '' : 'none';
    if (tab === 'suppliers') loadSuppliers(); else loadPurchaseOrders();
}
async function loadProcurement() { loadSuppliers(); }
async function loadSuppliers() {
    const data = await apiFetch('/api/v1/suppliers?limit=50');
    const tbody = document.getElementById('suppliersTableBody');
    if (!data?.suppliers?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('procurement.empty_suppliers')}</td></tr>`;
        return;
    }
    tbody.innerHTML = data.suppliers.map(s => `
        <tr>
          <td>#${s.id}</td>
          <td><strong>${escapeHtml(s.name)}</strong></td>
          <td class="col-hide-mobile">${escapeHtml(s.contact_email || s.contact_phone || '\u2014')}</td>
          <td>${s.lead_time_days}${t('procurement.days')}</td>
          <td><span class="status-badge ${s.is_active ? 'status-active' : 'status-inactive'}">${s.is_active ? t('common.active') : t('common.inactive')}</span></td>
          <td><button class="btn-sm" onclick="editSupplier(${s.id})">${t('distributors.edit')}</button></td>
        </tr>`).join('');
}
async function loadPurchaseOrders() {
    const data = await apiFetch('/api/v1/purchase-orders?limit=50');
    const tbody = document.getElementById('poTableBody');
    if (!data?.orders?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('procurement.empty_orders')}</td></tr>`;
        return;
    }
    tbody.innerHTML = data.orders.map(po => `
        <tr>
          <td>${escapeHtml(po.po_number)}</td>
          <td>${escapeHtml(po.supplier_name || '\u2014')}</td>
          <td><span class="status-badge status-${(po.status||'').toLowerCase()}">${po.status}</span></td>
          <td>\u00A5${(po.total_amount||0).toLocaleString()}</td>
          <td class="col-hide-mobile">${po.expected_delivery ? formatDate(po.expected_delivery) : '\u2014'}</td>
          <td><button class="btn-sm" onclick="viewPO(${po.id})">${t('common.view')}</button></td>
        </tr>`).join('');
}
function openSupplierModal() { alert('Supplier modal - TODO'); }
function editSupplier(id) { alert('Edit supplier ' + id + ' - TODO'); }
function viewPO(id) { alert('View PO ' + id + ' - TODO'); }

// ===== Sprint 9: Pricing =====
async function loadPricing(offset = 0) {
    const platform = document.getElementById('pricingPlatformFilter')?.value || '';
    let url = `/api/v1/pricing?limit=20&offset=${offset}`;
    if (platform) url += `&platform=${platform}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('pricingTableBody');
    if (!data?.rules?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('pricing.empty')}</td></tr>`;
        document.getElementById('pricingPagination').innerHTML = '';
        return;
    }
    // Also fetch margins for display
    let margins = {};
    try {
        const mData = await apiFetch('/api/v1/pricing/margins');
        if (mData?.margins) mData.margins.forEach(m => { margins[m.sku + '/' + m.platform] = m; });
    } catch(e) {}

    tbody.innerHTML = data.rules.map(r => {
        const m = margins[r.sku + '/' + r.platform];
        const marginPct = m ? m.margin_pct + '%' : '\u2014';
        return `
        <tr>
          <td>${escapeHtml(r.sku)}</td>
          <td>${r.platform}</td>
          <td>\u00A5${(r.base_price||0).toLocaleString()}</td>
          <td>${r.sale_price ? '\u00A5' + r.sale_price.toLocaleString() : '\u2014'}</td>
          <td>${marginPct}</td>
          <td><span class="status-badge ${r.is_active ? 'status-active' : 'status-inactive'}">${r.is_active ? t('common.active') : t('common.inactive')}</span></td>
          <td>
            ${currentRole === 'admin' ? `<button class="btn-sm" onclick="editPriceRule(${r.id})">${t('distributors.edit')}</button>` : ''}
          </td>
        </tr>`;
    }).join('');
    renderPagination('pricingPagination', offset, 20, data.total, (o) => loadPricing(o));
}
function openPricingModal() { alert('Pricing modal - TODO'); }
function editPriceRule(id) { alert('Edit price rule ' + id + ' - TODO'); }

// ===== Sprint 9: Communications =====
function switchCommTab(tab) {
    document.getElementById('templatesSection').style.display = tab === 'templates' ? '' : 'none';
    document.getElementById('messagesSection').style.display = tab === 'messages' ? '' : 'none';
    document.getElementById('triggersSection').style.display = tab === 'triggers' ? '' : 'none';
    document.getElementById('addTemplateBtn').style.display = tab === 'templates' ? '' : 'none';
    if (tab === 'templates') loadTemplates();
    else if (tab === 'messages') loadMessages();
    else loadTriggers();
}
async function loadCommunications() { loadTemplates(); }
async function loadTemplates() {
    const data = await apiFetch('/api/v1/communications/templates?limit=50');
    const tbody = document.getElementById('templatesTableBody');
    if (!data?.templates?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('communications.empty_templates')}</td></tr>`;
        return;
    }
    tbody.innerHTML = data.templates.map(tp => `
        <tr>
          <td>#${tp.id}</td>
          <td>${escapeHtml(tp.name)}</td>
          <td>${tp.type}</td>
          <td>${tp.channel}</td>
          <td><span class="status-badge ${tp.is_active ? 'status-active' : 'status-inactive'}">${tp.is_active ? t('common.active') : t('common.inactive')}</span></td>
          <td><button class="btn-sm" onclick="editTemplate(${tp.id})">${t('distributors.edit')}</button></td>
        </tr>`).join('');
}
async function loadMessages(offset = 0) {
    const data = await apiFetch(`/api/v1/communications/messages?limit=20&offset=${offset}`);
    const tbody = document.getElementById('messagesTableBody');
    if (!data?.messages?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('communications.empty_messages')}</td></tr>`;
        document.getElementById('messagesPagination').innerHTML = '';
        return;
    }
    tbody.innerHTML = data.messages.map(m => `
        <tr>
          <td>#${m.id}</td>
          <td>#${m.customer_id}</td>
          <td>${m.type}</td>
          <td>${m.channel}</td>
          <td><span class="status-badge status-${(m.status||'').toLowerCase()}">${m.status}</span></td>
          <td>${formatDate(m.sent_at)}</td>
        </tr>`).join('');
    renderPagination('messagesPagination', offset, 20, data.total, (o) => loadMessages(o));
}
async function loadTriggers() {
    const data = await apiFetch('/api/v1/communications/triggers');
    const tbody = document.getElementById('triggersTableBody');
    if (!data?.triggers?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${t('communications.empty_triggers')}</td></tr>`;
        return;
    }
    tbody.innerHTML = data.triggers.map(tr => `
        <tr>
          <td>#${tr.id}</td>
          <td>${tr.event_type}</td>
          <td>${escapeHtml(tr.template_name || '#' + tr.template_id)}</td>
          <td><span class="status-badge ${tr.is_active ? 'status-active' : 'status-inactive'}">${tr.is_active ? t('common.active') : t('common.inactive')}</span></td>
          <td><button class="btn-sm btn-danger" onclick="deleteTrigger(${tr.id})">${t('common.delete')}</button></td>
        </tr>`).join('');
}
function openTemplateModal() { alert('Template modal - TODO'); }
function editTemplate(id) { alert('Edit template ' + id + ' - TODO'); }
async function deleteTrigger(id) { if (!confirm(t('common.confirm_delete'))) return; await apiFetch(`/api/v1/communications/triggers/${id}`, { method: 'DELETE' }); loadTriggers(); }

// ===== Sprint 9: Financial Reports =====
async function loadFinancialReport() {
    const type = document.getElementById('finReportType')?.value || 'pnl';
    const start = document.getElementById('finStartDate')?.value || '';
    const end = document.getElementById('finEndDate')?.value || '';
    const content = document.getElementById('financialReportContent');

    let params = '';
    if (start) params += `&start_date=${start}`;
    if (end) params += `&end_date=${end}`;

    if (type === 'pnl') {
        const data = await apiFetch(`/api/v1/financial-reports/pnl?${params}`);
        if (!data) return;
        content.innerHTML = `
          <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
            <div class="stat-card"><div class="stat-label">${t('financial.revenue')}</div><div class="stat-value">\u00A5${(data.revenue?.total||0).toLocaleString()}</div></div>
            <div class="stat-card"><div class="stat-label">${t('financial.cogs')}</div><div class="stat-value">\u00A5${(data.cogs||0).toLocaleString()}</div></div>
            <div class="stat-card"><div class="stat-label">${t('financial.gross_profit')}</div><div class="stat-value">\u00A5${(data.gross_profit||0).toLocaleString()} (${data.gross_margin||0}%)</div></div>
            <div class="stat-card"><div class="stat-label">${t('financial.net_profit')}</div><div class="stat-value" style="color:${data.net_profit >= 0 ? 'var(--success)' : 'var(--danger)'};">\u00A5${(data.net_profit||0).toLocaleString()} (${data.net_margin||0}%)</div></div>
          </div>
          <table class="data-table"><thead><tr><th>${t('financial.item')}</th><th>${t('financial.amount')}</th></tr></thead><tbody>
            <tr><td>${t('financial.revenue')}</td><td>\u00A5${(data.revenue?.total||0).toLocaleString()}</td></tr>
            <tr><td>${t('financial.cogs')}</td><td>-\u00A5${(data.cogs||0).toLocaleString()}</td></tr>
            <tr><td><strong>${t('financial.gross_profit')}</strong></td><td><strong>\u00A5${(data.gross_profit||0).toLocaleString()}</strong></td></tr>
            <tr><td>${t('financial.commission')}</td><td>-\u00A5${(data.expenses?.commission||0).toLocaleString()}</td></tr>
            <tr><td>${t('financial.refunds')}</td><td>-\u00A5${(data.expenses?.refunds||0).toLocaleString()}</td></tr>
            <tr style="font-weight:bold;background:var(--bg-card)"><td>${t('financial.net_profit')}</td><td style="color:${data.net_profit >= 0 ? 'var(--success)' : 'var(--danger)'};">\u00A5${(data.net_profit||0).toLocaleString()}</td></tr>
          </tbody></table>`;
    } else if (type === 'tax') {
        const data = await apiFetch(`/api/v1/financial-reports/tax-summary?${params}`);
        if (!data) return;
        content.innerHTML = `
          <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
            <div class="stat-card"><div class="stat-label">${t('financial.total_taxable')}</div><div class="stat-value">\u00A5${(data.total_taxable||0).toLocaleString()}</div></div>
            <div class="stat-card"><div class="stat-label">${t('financial.total_tax')}</div><div class="stat-value">\u00A5${(data.total_tax||0).toLocaleString()}</div></div>
          </div>
          <table class="data-table"><thead><tr><th>${t('financial.tax_rate')}</th><th>${t('financial.orders')}</th><th>${t('financial.taxable')}</th><th>${t('financial.tax')}</th></tr></thead><tbody>
            ${(data.breakdown||[]).map(b => `<tr><td>${b.rate_label}</td><td>${b.order_count}</td><td>\u00A5${(b.taxable_amount||0).toLocaleString()}</td><td>\u00A5${(b.tax_amount||0).toLocaleString()}</td></tr>`).join('')}
          </tbody></table>`;
    } else if (type === 'reconciliation') {
        const data = await apiFetch(`/api/v1/financial-reports/reconciliation?${params}`);
        if (!data) return;
        content.innerHTML = `
          <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
            <div class="stat-card"><div class="stat-label">${t('financial.current_balance')}</div><div class="stat-value">\u00A5${(data.current_balance||0).toLocaleString()}</div></div>
            <div class="stat-card"><div class="stat-label">${t('financial.frozen')}</div><div class="stat-value">\u00A5${(data.current_frozen||0).toLocaleString()}</div></div>
          </div>
          <table class="data-table"><thead><tr><th>${t('financial.tx_type')}</th><th>${t('financial.count')}</th><th>${t('financial.total')}</th></tr></thead><tbody>
            ${(data.transactions||[]).map(tx => `<tr><td>${tx.type}</td><td>${tx.count}</td><td>\u00A5${(tx.total||0).toLocaleString()}</td></tr>`).join('')}
          </tbody></table>`;
    } else if (type === 'balance') {
        const data = await apiFetch('/api/v1/financial-reports/balance-sheet');
        if (!data) return;
        content.innerHTML = `
          <p style="color:var(--text-muted);margin-bottom:16px">${t('financial.as_of')}: ${data.as_of}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
            <div class="card" style="padding:16px">
              <h4>${t('financial.assets')}</h4>
              <table class="data-table"><tbody>
                <tr><td>${t('financial.cash')}</td><td>\u00A5${(data.assets?.cash||0).toLocaleString()}</td></tr>
                <tr><td>${t('financial.frozen')}</td><td>\u00A5${(data.assets?.frozen||0).toLocaleString()}</td></tr>
                <tr><td>${t('financial.inventory')}</td><td>\u00A5${(data.assets?.inventory||0).toLocaleString()}</td></tr>
                <tr style="font-weight:bold"><td>${t('financial.total')}</td><td>\u00A5${(data.assets?.total||0).toLocaleString()}</td></tr>
              </tbody></table>
            </div>
            <div class="card" style="padding:16px">
              <h4>${t('financial.liabilities')}</h4>
              <table class="data-table"><tbody>
                <tr><td>${t('financial.pending_refunds')}</td><td>\u00A5${(data.liabilities?.pending_refunds||0).toLocaleString()}</td></tr>
                <tr><td>${t('financial.pending_commissions')}</td><td>\u00A5${(data.liabilities?.pending_commissions||0).toLocaleString()}</td></tr>
                <tr style="font-weight:bold"><td>${t('financial.total')}</td><td>\u00A5${(data.liabilities?.total||0).toLocaleString()}</td></tr>
              </tbody></table>
              <div style="margin-top:16px;padding-top:16px;border-top:2px solid var(--border)">
                <strong>${t('financial.equity')}: \u00A5${(data.equity||0).toLocaleString()}</strong>
              </div>
            </div>
          </div>`;
    }
}

// ===== Sprint 9: Forecasting =====
async function loadForecasting(offset = 0) {
    const data = await apiFetch(`/api/v1/forecasting?limit=20&offset=${offset}`);
    const tbody = document.getElementById('forecastingTableBody');
    if (!data?.forecasts?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('forecasting.empty')}</td></tr>`;
        document.getElementById('forecastingPagination').innerHTML = '';
        return;
    }
    tbody.innerHTML = data.forecasts.map(f => {
        const stock = f.current_stock || 0;
        const rp = f.reorder_point || 0;
        let statusClass = 'status-active';
        let statusText = t('forecasting.ok');
        if (stock <= rp) { statusClass = 'status-danger'; statusText = t('forecasting.reorder'); }
        else if (f.days_of_stock < 14) { statusClass = 'status-warning'; statusText = t('forecasting.low'); }
        return `
        <tr>
          <td>${escapeHtml(f.sku)}</td>
          <td class="col-hide-mobile">${escapeHtml(f.product_name || '\u2014')}</td>
          <td>${stock}</td>
          <td>${f.daily_velocity}</td>
          <td>${f.days_of_stock}</td>
          <td>${rp}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        </tr>`;
    }).join('');
    renderPagination('forecastingPagination', offset, 20, data.total, (o) => loadForecasting(o));
}
async function recalculateForecasts() {
    const data = await apiFetch('/api/v1/forecasting/calculate', { method: 'POST' });
    if (data?.success) { alert(t('forecasting.recalculated', { count: data.calculated })); loadForecasting(); }
}

// ===== Utility: CSV export helper =====
async function exportCSV(url, filename) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    } catch(e) {
        alert(t('common.error') + ': ' + e.message);
    }
}
