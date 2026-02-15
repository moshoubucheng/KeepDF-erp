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
    automation: { title: 'automation.title', sub: 'automation.subtitle' },
    currency: { title: 'currency.title', sub: 'currency.subtitle' },
    'sku-mappings': { title: 'skuMappings.title', sub: 'skuMappings.subtitle' },
    coupons: { title: 'coupons.title', sub: 'coupons.subtitle' },
    'shipping-fees': { title: 'shippingFees.title', sub: 'shippingFees.subtitle' },
    stocktakes: { title: 'stocktakes.title', sub: 'stocktakes.subtitle' },
    'customer-segments': { title: 'segments.title', sub: 'segments.subtitle' },
    promotions: { title: 'promotions.title', sub: 'promotions.subtitle' },
    approvals: { title: 'approvals.title', sub: 'approvals.subtitle' },
    webhooks: { title: 'webhooks.title', sub: 'webhooks.subtitle' },
    datascreen: { title: 'datascreen.title', sub: 'datascreen.subtitle' },
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

// ===== Nav Group Toggle =====
function toggleNavGroup(groupName) {
    const group = document.querySelector(`.nav-group[data-group="${groupName}"]`);
    if (!group) return;
    group.classList.toggle('collapsed');
    // Save state to localStorage
    const collapsed = JSON.parse(localStorage.getItem('navGroupState') || '{}');
    collapsed[groupName] = group.classList.contains('collapsed');
    localStorage.setItem('navGroupState', JSON.stringify(collapsed));
}

function restoreNavGroupState() {
    const collapsed = JSON.parse(localStorage.getItem('navGroupState') || '{}');
    Object.entries(collapsed).forEach(([groupName, isCollapsed]) => {
        if (isCollapsed) {
            const group = document.querySelector(`.nav-group[data-group="${groupName}"]`);
            if (group) group.classList.add('collapsed');
        }
    });
}

function updateNavGroupVisibility() {
    document.querySelectorAll('.nav-group').forEach(group => {
        const items = group.querySelectorAll('.nav-group-items .nav-item');
        const hasVisible = Array.from(items).some(item => item.style.display !== 'none');
        group.style.display = hasVisible ? '' : 'none';
    });
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
        case 'automation': return loadAutomation();
        case 'currency': return loadCurrency();
        case 'sku-mappings': return loadSkuMappings();
        case 'coupons': return loadCoupons();
        case 'shipping-fees': return loadShippingFees();
        case 'stocktakes': return loadStocktakes();
        case 'customer-segments': return loadCustomerSegments();
        case 'promotions': return loadPromotions();
        case 'approvals': return loadApprovals();
        case 'webhooks': return loadWebhooks();
        case 'datascreen': return loadDataScreen();
    }
}

// --- ECharts Instance Management ---
const chartInstances = {};

function getChart(containerId) {
    if (chartInstances[containerId]) {
        chartInstances[containerId].dispose();
    }
    const dom = document.getElementById(containerId);
    if (!dom) return null;
    const chart = echarts.init(dom, 'dark');
    chartInstances[containerId] = chart;
    return chart;
}

// Responsive resize
window.addEventListener('resize', () => {
    for (const chart of Object.values(chartInstances)) {
        if (chart && typeof chart.resize === 'function') chart.resize();
    }
});

// --- Dashboard ---
let currentChartPeriod = '7d';

async function loadDashboard() {
    loadDashboardStats();
    loadPlatformDonut();
    renderChart(currentChartPeriod);
    loadSalesHeatmap();
    const role = localStorage.getItem('erp_role');
    if (role === 'admin') {
        loadInventoryTurnover();
    }
}

async function loadDashboardStats() {
    const [statsData, ordersData] = await Promise.all([
        apiFetch('/api/v1/dashboard/stats'),
        apiFetch('/api/v1/orders?limit=5'),
    ]);

    if (statsData?.overview) {
        if (statsData.role === 'admin') {
            // Admin: global stats
            document.getElementById('stat-revenue').textContent =
                `\u00a5${(statsData.overview.totalRevenue || 0).toLocaleString()}`;
            document.getElementById('stat-orders').textContent =
                statsData.overview.totalOrders || 0;
            document.getElementById('stat-products').textContent =
                statsData.overview.totalProducts || 0;
            document.getElementById('stat-distributors').textContent =
                statsData.overview.totalDistributors || 0;
        } else {
            // Distributor: personal stats
            document.getElementById('stat-my-revenue').textContent =
                `\u00a5${(statsData.overview.totalRevenue || 0).toLocaleString()}`;
            document.getElementById('stat-my-orders').textContent =
                statsData.overview.totalOrders || 0;
            document.getElementById('stat-my-commission').textContent =
                `\u00a5${(statsData.overview.totalCommission || 0).toLocaleString()}`;
            if (statsData.wallet) {
                document.getElementById('stat-my-balance').textContent =
                    `\u00a5${(statsData.wallet.balance || 0).toLocaleString()}`;
            }
        }
    }

    if (ordersData) {
        renderRecentOrders(ordersData.orders?.slice(0, 5) || []);
    }
}

async function loadPlatformDonut() {
    const data = await apiFetch('/api/v1/dashboard/orders-by-platform?period=all');
    if (!data?.platforms) return;

    const chart = getChart('platformDonut');
    if (!chart) return;

    const platformNames = { TIKTOK: 'TikTok Shop', TEMU: 'Temu', RAKUTEN: 'Rakuten' };
    const platformColors = { TIKTOK: '#ff4d6a', TEMU: '#ff8c00', RAKUTEN: '#bf0000' };
    const totalOrders = data.total?.orders || 0;

    chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
        color: data.platforms.map(p => platformColors[p.platform] || '#8b5cf6'),
        graphic: [{
            type: 'text',
            left: 'center', top: '38%',
            style: { text: String(totalOrders), fontSize: 24, fontWeight: 'bold', fill: '#e2e8f0', textAlign: 'center' },
        }, {
            type: 'text',
            left: 'center', top: '50%',
            style: { text: t('reports.order_count'), fontSize: 11, fill: '#64748b', textAlign: 'center' },
        }],
        series: [{
            type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
            label: { show: false },
            data: data.platforms.map(p => ({
                name: platformNames[p.platform] || p.platform,
                value: p.orderCount,
            })),
        }],
    });
}

async function loadSalesHeatmap() {
    const data = await apiFetch('/api/v1/dashboard/sales-heatmap');
    if (!data?.data?.length) return;

    const chart = getChart('salesHeatmap');
    if (!chart) return;

    const items = data.data;
    const year = new Date().getFullYear();
    const heatmapData = items.map(d => [d.date, d.revenue]);
    const maxRevenue = Math.max(...items.map(d => d.revenue), 1);

    chart.setOption({
        tooltip: {
            formatter: function(p) {
                const item = items.find(d => d.date === p.value[0]);
                if (!item) return '';
                return `${p.value[0]}<br/>${t('reports.order_count')}: ${item.orderCount}<br/>${t('reports.revenue')}: ¥${item.revenue.toLocaleString()}`;
            },
        },
        visualMap: {
            min: 0, max: maxRevenue, show: false,
            inRange: { color: ['#1e1b4b', '#4c1d95', '#6d28d9', '#8b5cf6', '#a78bfa'] },
        },
        calendar: {
            range: [year + '-01-01', year + '-12-31'],
            cellSize: ['auto', 14],
            top: 30, left: 60, right: 30,
            itemStyle: { borderWidth: 2, borderColor: '#1e293b' },
            yearLabel: { show: false },
            monthLabel: { color: '#64748b', fontSize: 10 },
            dayLabel: { color: '#64748b', fontSize: 10, firstDay: 1 },
            splitLine: { show: false },
        },
        series: [{
            type: 'heatmap', coordinateSystem: 'calendar',
            data: heatmapData,
        }],
    });
}

async function loadInventoryTurnover() {
    const data = await apiFetch('/api/v1/dashboard/inventory-turnover');
    if (!data?.data?.length) return;

    const chart = getChart('turnoverChart');
    if (!chart) return;

    const items = data.data.slice().reverse(); // Reverse so highest at top

    chart.setOption({
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: function(params) {
                const p = params[0];
                const item = data.data.find(d => d.sku === p.name);
                if (!item) return '';
                return `<strong>${item.sku}</strong><br/>${item.name || ''}<br/>${t('dashboard.sold_qty')}: ${item.soldQty}<br/>${t('dashboard.current_stock')}: ${item.currentStock}<br/>${t('dashboard.turnover_rate')}: ${item.turnoverRate}`;
            },
        },
        grid: { top: 10, right: 80, bottom: 10, left: 120, containLabel: false },
        xAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
            axisLabel: { color: '#64748b', fontSize: 11 },
        },
        yAxis: {
            type: 'category',
            data: items.map(d => d.sku),
            axisLabel: { color: '#94a3b8', fontSize: 10 },
            axisLine: { lineStyle: { color: '#334155' } },
        },
        series: [{
            type: 'bar',
            data: items.map(d => d.turnoverRate),
            itemStyle: {
                borderRadius: [0, 4, 4, 0],
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: '#6d28d9' },
                    { offset: 1, color: '#8b5cf6' },
                ]),
            },
            label: { show: true, position: 'right', color: '#94a3b8', fontSize: 10,
                formatter: '{c}x' },
        }],
    });
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

    const chart = getChart('ordersChart');
    if (!chart) return;

    const trendData = await apiFetch(`/api/v1/dashboard/revenue-trend?period=${period}`);
    const items = trendData?.data || [];

    if (!items.length) {
        chart.setOption({
            graphic: [{ type: 'text', left: 'center', top: 'center',
                style: { text: t('dashboard.no_data'), fontSize: 13, fill: '#64748b' } }],
        });
        return;
    }

    chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        grid: { top: 20, right: 20, bottom: 40, left: 50 },
        xAxis: {
            type: 'category',
            data: items.map(d => d.date ? d.date.slice(5) : ''),
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#64748b', fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
            axisLabel: { color: '#64748b', fontSize: 11 },
        },
        series: [{
            type: 'line', smooth: true,
            data: items.map(d => d.orderCount),
            lineStyle: { color: '#8b5cf6', width: 2.5 },
            itemStyle: { color: '#8b5cf6' },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0)' },
            ]) },
            symbol: 'circle', symbolSize: 6,
        }],
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

    const isAdmin = window._isAdmin;
    tbody.innerHTML = data.orders.map(o => `
    <tr>
      ${isAdmin ? `<td><input type="checkbox" class="order-checkbox" value="${o.id}"></td>` : ''}
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
    const credRow = document.getElementById('distributorCredentialsRow');

    if (id) {
        document.getElementById('distributorModalTitle').textContent = t('distributors.modal_edit');
        document.getElementById('distributorFormId').value = id;
        credRow.style.display = 'none';
        apiFetch(`/api/v1/distributors/${Number(id)}`).then(data => {
            if (data?.distributor) {
                document.getElementById('distributorFormName').value = data.distributor.name || '';
                document.getElementById('distributorFormTaxReg').value = data.distributor.tax_reg_number || '';
            }
        });
    } else {
        document.getElementById('distributorModalTitle').textContent = t('distributors.modal_new');
        document.getElementById('distributorFormId').value = '';
        credRow.style.display = '';
    }
    openModal('distributorModal');
}

async function saveDistributor() {
    const id = document.getElementById('distributorFormId').value;
    const name = document.getElementById('distributorFormName').value.trim();
    const taxReg = document.getElementById('distributorFormTaxReg').value.trim();

    if (!name) { alert(t('error.required_name')); return; }

    if (id) {
        const payload = { name, tax_reg_number: taxReg || undefined };
        const result = await apiFetch(`/api/v1/distributors/${Number(id)}`, {
            method: 'PUT', body: JSON.stringify(payload),
        });
        if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
    } else {
        const username = document.getElementById('distributorFormUsername').value.trim();
        const password = document.getElementById('distributorFormPassword').value;

        if (!username) { alert(t('distributors.username_required')); return; }
        if (!password || password.length < 8) { alert(t('distributors.password_min')); return; }

        const payload = { name, username, password, tax_reg_number: taxReg || undefined };
        const result = await apiFetch('/api/v1/distributors', {
            method: 'POST', body: JSON.stringify(payload),
        });
        if (result?.error) { alert(`${t('common.error')}: ${result.error}`); return; }
        alert(t('distributors.created_success', { username }));
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
function renderPagination(containerId, offset, limit, total, onNavigate, cursorInfo) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Cursor-based pagination mode
    if (cursorInfo) {
        if (!cursorInfo.hasMore && !cursorInfo.hasPrev) { container.innerHTML = ''; return; }

        const prevDisabled = !cursorInfo.hasPrev ? 'disabled' : '';
        const nextDisabled = !cursorInfo.hasMore ? 'disabled' : '';

        container.innerHTML = `
          <button class="btn-ghost ${prevDisabled}" id="${containerId}-prev">${t('common.prev')}</button>
          <span style="color:var(--text-secondary);font-size:0.85rem">${cursorInfo.pageLabel || ''}</span>
          <button class="btn-ghost ${nextDisabled}" id="${containerId}-next">${t('common.next')}</button>`;

        if (!prevDisabled && cursorInfo.onPrev) {
            container.querySelector(`#${containerId}-prev`).addEventListener('click', cursorInfo.onPrev);
        }
        if (!nextDisabled && cursorInfo.onNext) {
            container.querySelector(`#${containerId}-next`).addEventListener('click', cursorInfo.onNext);
        }
        return;
    }

    // Offset-based pagination mode (backward compatible)
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

// ===== Company Profile =====
async function openProfileModal() {
    const data = await apiFetch('/api/v1/auth/me');
    if (!data?.distributor) return;
    const d = data.distributor;
    document.getElementById('profileName').value = d.name || '';
    document.getElementById('profileContact').value = d.contact_person || '';
    document.getElementById('profileEmail').value = d.email || '';
    document.getElementById('profilePhone').value = d.phone || '';
    document.getElementById('profileAddress').value = d.address || '';
    document.getElementById('profileTaxReg').value = d.tax_reg_number || '';
    document.getElementById('profileError').textContent = '';
    document.getElementById('profileSuccess').textContent = '';
    openModal('profileModal');
}

async function saveProfile() {
    const errEl = document.getElementById('profileError');
    const successEl = document.getElementById('profileSuccess');
    errEl.textContent = ''; successEl.textContent = '';

    const name = document.getElementById('profileName').value.trim();
    if (!name) { errEl.textContent = t('profile.name_required'); return; }

    const result = await apiFetch('/api/v1/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
            name,
            contact_person: document.getElementById('profileContact').value.trim(),
            email: document.getElementById('profileEmail').value.trim(),
            phone: document.getElementById('profilePhone').value.trim(),
            address: document.getElementById('profileAddress').value.trim(),
            tax_reg_number: document.getElementById('profileTaxReg').value.trim(),
        }),
    });

    if (result?.error) { errEl.textContent = result.error; return; }
    successEl.textContent = t('common.success');
    document.getElementById('userDisplayName').textContent = name;
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
        clearChart('profitChart');
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
        clearChart('platformChart');
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
        clearChart('trendChart');
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

function clearChart(containerId) {
    const chart = getChart(containerId);
    if (!chart) return;
    chart.setOption({
        graphic: [{ type: 'text', left: 'center', top: 'center',
            style: { text: t('reports.no_data'), fontSize: 13, fill: '#64748b' } }],
    });
}

function renderBarChart(containerId, labels, datasets) {
    const chart = getChart(containerId);
    if (!chart) return;

    if (!labels.length) { clearChart(containerId); return; }

    chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } },
        grid: { top: 20, right: 20, bottom: 40, left: 60 },
        xAxis: {
            type: 'category', data: labels,
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#64748b', fontSize: 11, rotate: labels.some(l => l.length > 6) ? 20 : 0 },
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
            axisLabel: { color: '#64748b', fontSize: 11 },
        },
        series: datasets.map(d => ({
            name: d.label, type: 'bar', data: d.values,
            itemStyle: { color: d.color, borderRadius: [2, 2, 0, 0] },
            barMaxWidth: 30,
        })),
    });
}

function renderDualLineChart(containerId, current, previous) {
    const chart = getChart(containerId);
    if (!chart) return;

    if (!current.length && !previous.length) { clearChart(containerId); return; }

    const maxLen = Math.max(current.length, previous.length);
    const xLabels = (current.length >= previous.length ? current : previous).map(d => d.date ? d.date.slice(5) : '');

    chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: {
            bottom: 0,
            textStyle: { color: '#94a3b8', fontSize: 10 },
            data: [t('reports.current_period'), t('reports.previous_period')],
        },
        grid: { top: 20, right: 20, bottom: 40, left: 60 },
        xAxis: {
            type: 'category', data: xLabels,
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#64748b', fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
            axisLabel: { color: '#64748b', fontSize: 11 },
        },
        series: [
            {
                name: t('reports.current_period'), type: 'line', smooth: true,
                data: current.map(d => d.revenue),
                lineStyle: { color: '#8b5cf6', width: 2.5 },
                itemStyle: { color: '#8b5cf6' },
                symbol: 'circle', symbolSize: 5,
            },
            {
                name: t('reports.previous_period'), type: 'line', smooth: true,
                data: previous.map(d => d.revenue),
                lineStyle: { color: '#64748b', width: 2, type: 'dashed' },
                itemStyle: { color: '#64748b' },
                symbol: 'circle', symbolSize: 4,
            },
        ],
    });
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
      <td><button class="btn-sm" onclick="loadShipmentTimeline(${Number(s.id)})">${t('shipping.timeline')}</button></td>
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
    restoreNavGroupState();

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
                document.body.classList.add('role-admin');
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
            } else {
                document.body.classList.add('role-distributor');
            }
            updateNavGroupVisibility();
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

    // Profile form
    document.getElementById('profileForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfile();
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

// ===== PDF Report Download =====
async function downloadReportPdf() {
    const type = document.getElementById('finReportType')?.value || 'pnl';
    const start = document.getElementById('finStartDate')?.value || '';
    const end = document.getElementById('finEndDate')?.value || '';

    let url = '';
    let filename = '';
    if (type === 'pnl') {
        url = `/api/v1/financial-reports/pnl/pdf?start_date=${start}&end_date=${end}`;
        filename = 'pnl-report.pdf';
    } else if (type === 'tax' || type === 'reconciliation') {
        url = `/api/v1/financial-reports/sales/pdf?period=30d`;
        filename = 'sales-report.pdf';
    } else {
        url = `/api/v1/financial-reports/inventory/pdf`;
        filename = 'inventory-report.pdf';
    }

    const blob = await apiFetchBlob(url);
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
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

// ===== Sprint 11: Automation =====
async function loadAutomation() {
    loadAutomationRules();
    loadAutomationLogs();
}

async function loadAutomationRules() {
    const data = await apiFetch('/api/v1/automation');
    const tbody = document.getElementById('automationTableBody');
    if (!data?.rules?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('automation.empty')}</td></tr>`;
        return;
    }
    const typeLabels = { AUTO_REORDER: t('automation.type_reorder'), AUTO_PRICE_ADJUST: t('automation.type_price'), STOCK_ALERT: t('automation.type_alert') };
    tbody.innerHTML = data.rules.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${escapeHtml(r.name)}</td>
      <td><span class="status-badge">${typeLabels[r.type] || r.type}</span></td>
      <td><span class="status-badge ${r.is_active ? 'status-active' : 'status-danger'}">${r.is_active ? t('common.active') : t('common.inactive')}</span></td>
      <td>${r.run_count}</td>
      <td class="col-hide-mobile">${r.last_run_at ? formatDate(r.last_run_at) : '\u2014'}</td>
      <td>
        <button class="btn-sm btn-primary" onclick="runAutomationRule(${r.id})">${t('automation.run')}</button>
        <button class="btn-sm btn-danger" onclick="deleteAutomationRule(${r.id})">${t('common.delete')}</button>
      </td>
    </tr>`).join('');
}

async function loadAutomationLogs(offset = 0) {
    const data = await apiFetch(`/api/v1/automation/logs?limit=20&offset=${offset}`);
    const tbody = document.getElementById('automationLogsBody');
    if (!data?.logs?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('automation.logs_empty')}</td></tr>`;
        document.getElementById('automationLogsPagination').innerHTML = '';
        return;
    }
    const statusClass = { SUCCESS: 'status-active', FAILED: 'status-danger', SKIPPED: 'status-warning', NO_MATCH: 'status-warning' };
    tbody.innerHTML = data.logs.map(l => `
    <tr>
      <td>${escapeHtml(l.rule_name)}</td>
      <td>${l.trigger_type}</td>
      <td><span class="status-badge ${statusClass[l.status] || ''}">${l.status}</span></td>
      <td class="col-hide-mobile">${escapeHtml(l.details || '\u2014')}</td>
      <td>${l.items_affected}</td>
      <td>${l.execution_time_ms}ms</td>
      <td>${formatDate(l.created_at)}</td>
    </tr>`).join('');
    renderPagination('automationLogsPagination', offset, 20, data.total, (o) => loadAutomationLogs(o));
}

async function runAutomationRule(id) {
    const data = await apiFetch(`/api/v1/automation/${id}/run`, { method: 'POST' });
    if (data?.log) { loadAutomation(); }
}

async function deleteAutomationRule(id) {
    if (!confirm(t('common.confirm_delete'))) return;
    const data = await apiFetch(`/api/v1/automation/${id}`, { method: 'DELETE' });
    if (data?.success) { alert(t('automation.deleted')); loadAutomation(); }
}

async function evaluateAllRules() {
    const data = await apiFetch('/api/v1/automation/evaluate-all', { method: 'POST' });
    if (data) { alert(`${t('automation.evaluated')}: evaluated=${data.evaluated}, executed=${data.executed}`); loadAutomation(); }
}

// Dynamic form fields for automation type
document.getElementById('automationTypeSelect')?.addEventListener('change', function() {
    const type = this.value;
    const condDiv = document.getElementById('automationConditionsFields');
    const actDiv = document.getElementById('automationActionsFields');
    if (type === 'AUTO_REORDER') {
        condDiv.innerHTML = `<div class="form-group"><label>Min Daily Velocity</label><input type="number" name="min_daily_velocity" step="0.1" value="0.5"></div>`;
        actDiv.innerHTML = `<div class="form-row"><div class="form-group"><label>Qty Multiplier</label><input type="number" name="qty_multiplier" step="0.1" value="1"></div><div class="form-group"><label>Supplier ID</label><input type="number" name="supplier_id"></div></div>`;
    } else if (type === 'AUTO_PRICE_ADJUST') {
        condDiv.innerHTML = `<div class="form-row"><div class="form-group"><label>Margin Type</label><select name="margin_type"><option value="min_margin_pct">Min Margin %</option><option value="min_margin_abs">Min Margin Abs</option></select></div><div class="form-group"><label>Threshold</label><input type="number" name="threshold" step="0.1" value="10"></div></div>`;
        actDiv.innerHTML = `<div class="form-row"><div class="form-group"><label>Adjust Type</label><select name="adjust_type"><option value="set_margin_pct">Set Margin %</option><option value="increase_pct">Increase %</option><option value="increase_abs">Increase Abs</option></select></div><div class="form-group"><label>Adjust Value</label><input type="number" name="adjust_value" step="0.1" value="20"></div></div><div class="form-group"><label>Max Price</label><input type="number" name="max_price"></div>`;
    } else {
        condDiv.innerHTML = `<div class="form-row"><div class="form-group"><label>Threshold Type</label><select name="threshold_type"><option value="days_of_stock">Days of Stock</option><option value="fixed_qty">Fixed Qty</option></select></div><div class="form-group"><label>Threshold Value</label><input type="number" name="threshold_value" value="7"></div></div>`;
        actDiv.innerHTML = `<div class="form-group"><label>Notification Level</label><select name="notification_level"><option value="WARNING">WARNING</option><option value="CRITICAL">CRITICAL</option><option value="INFO">INFO</option></select></div>`;
    }
});
// Initialize form fields
document.getElementById('automationTypeSelect')?.dispatchEvent(new Event('change'));

document.getElementById('addAutomationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = fd.get('type');
    let conditions = {}, actions = {};
    if (type === 'AUTO_REORDER') {
        conditions = { threshold_type: 'reorder_point', min_daily_velocity: Number(fd.get('min_daily_velocity')) || 0 };
        actions = { supplier_id: Number(fd.get('supplier_id')) || undefined, qty_multiplier: Number(fd.get('qty_multiplier')) || 1, notify: true };
    } else if (type === 'AUTO_PRICE_ADJUST') {
        conditions = { margin_type: fd.get('margin_type'), threshold: Number(fd.get('threshold')) || 10 };
        actions = { adjust_type: fd.get('adjust_type'), adjust_value: Number(fd.get('adjust_value')) || 0, max_price: Number(fd.get('max_price')) || undefined, notify: true };
    } else {
        conditions = { threshold_type: fd.get('threshold_type'), threshold_value: Number(fd.get('threshold_value')) || 7 };
        actions = { notify: true, notification_level: fd.get('notification_level') || 'WARNING' };
    }
    const data = await apiFetch('/api/v1/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name'), type, conditions, actions }),
    });
    if (data?.rule) { alert(t('automation.created')); closeModal('addAutomationModal'); e.target.reset(); loadAutomation(); }
});

// ===== Sprint 11: Batch Order Status =====
async function batchUpdateOrderStatus() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkboxes.length === 0) { alert(t('batch.select_orders')); return; }
    const status = document.getElementById('batchStatusSelect')?.value;
    if (!status) return;
    const orderIds = Array.from(checkboxes).map(cb => Number(cb.value));
    const data = await apiFetch('/api/v1/batch/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: orderIds, status }),
    });
    if (data) {
        alert(`${t('batch.status_updated')}: success=${data.success}, errors=${data.errors?.length || 0}`);
        loadOrders();
    }
}

// Select all orders checkbox
document.getElementById('selectAllOrders')?.addEventListener('change', function() {
    document.querySelectorAll('.order-checkbox').forEach(cb => { cb.checked = this.checked; });
});

// ===== Sprint 12: Currency Management =====
async function loadCurrency() {
    const data = await apiFetch('/api/v1/currency/rates');
    const tbody = document.getElementById('currencyTableBody');
    if (!data?.rates?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('currency.empty')}</td></tr>`;
        return;
    }
    tbody.innerHTML = data.rates.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.from_currency)}</strong></td>
      <td><strong>${escapeHtml(r.to_currency)}</strong></td>
      <td>${r.rate}</td>
      <td>${escapeHtml(r.source)}</td>
      <td class="col-hide-mobile">${formatDate(r.updated_at)}</td>
      <td>${window._userRole === 'admin' ? `<button class="btn-sm" onclick="updateExchangeRate('${escapeHtml(r.from_currency)}','${escapeHtml(r.to_currency)}',${r.rate})">${t('distributors.edit')}</button>` : '\u2014'}</td>
    </tr>`).join('');
}

async function updateExchangeRate(from, to, currentRate) {
    const newRate = prompt(`${t('currency.new_rate')} (${from} → ${to}):`, currentRate);
    if (!newRate || isNaN(Number(newRate))) return;
    const data = await apiFetch('/api/v1/currency/rates', {
        method: 'POST',
        body: JSON.stringify({ from, to, rate: Number(newRate) }),
    });
    if (data?.error) { alert(data.error); return; }
    loadCurrency();
}

async function convertCurrency() {
    const amount = document.getElementById('convertAmount').value;
    const from = document.getElementById('convertFrom').value;
    const to = document.getElementById('convertTo').value;
    const data = await apiFetch(`/api/v1/currency/convert?amount=${amount}&from=${from}&to=${to}`);
    if (data?.error) { document.getElementById('convertResult').textContent = data.error; return; }
    document.getElementById('convertResult').textContent = `${formatCurrency(Number(amount), from)} = ${formatCurrency(data.converted, to)} (${t('currency.rate')}: ${data.rate})`;
}

function formatCurrency(amount, currency) {
    if (!currency || currency === 'JPY') return `¥${Math.floor(amount).toLocaleString()}`;
    if (currency === 'USD') return `$${amount.toFixed(2)}`;
    if (currency === 'CNY') return `¥${amount.toFixed(2)}`;
    return `${amount} ${currency}`;
}

// ===== Sprint 12: SKU Mappings =====
async function loadSkuMappings(offset = 0) {
    const platform = document.getElementById('skuPlatformFilter')?.value || '';
    let url = `/api/v1/sku-mappings?limit=20&offset=${offset}`;
    if (platform) url += `&platform=${platform}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('skuMappingsTableBody');
    if (!data?.mappings?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${t('skuMappings.empty')}</td></tr>`;
        document.getElementById('skuMappingsPagination').innerHTML = '';
        return;
    }
    tbody.innerHTML = data.mappings.map(m => `
    <tr>
      <td>#${m.id}</td>
      <td><strong>${escapeHtml(m.local_sku)}</strong></td>
      <td>${platformBadge(m.platform)}</td>
      <td>${escapeHtml(m.platform_sku)}</td>
      <td class="col-hide-mobile">${escapeHtml(m.platform_title) || '\u2014'}</td>
      <td class="col-hide-mobile">${m.price_sync ? '\u2705' : '\u274C'}</td>
      <td class="col-hide-mobile">${m.stock_sync ? '\u2705' : '\u274C'}</td>
      <td>${window._userRole === 'admin' ? `<button class="btn-sm" onclick="openSkuMappingModal(${m.id})">${t('distributors.edit')}</button> <button class="btn-sm btn-danger" onclick="deleteSkuMapping(${m.id})">${t('common.delete')}</button>` : '\u2014'}</td>
    </tr>`).join('');

    renderPagination('skuMappingsPagination', offset, 20, data.total, (newOffset) => loadSkuMappings(newOffset));
}

function openSkuMappingModal(id) {
    const form = document.getElementById('skuMappingForm');
    form.reset();
    document.getElementById('skuMappingFormId').value = '';

    if (id) {
        document.getElementById('skuMappingModalTitle').textContent = t('skuMappings.edit');
        document.getElementById('skuMappingFormId').value = id;
        apiFetch(`/api/v1/sku-mappings/${Number(id)}`).then(data => {
            if (data?.mapping) {
                const m = data.mapping;
                document.getElementById('skuMappingLocalSku').value = m.local_sku;
                document.getElementById('skuMappingPlatform').value = m.platform;
                document.getElementById('skuMappingPlatformSku').value = m.platform_sku;
                document.getElementById('skuMappingTitle').value = m.platform_title || '';
                document.getElementById('skuMappingPriceSync').checked = !!m.price_sync;
                document.getElementById('skuMappingStockSync').checked = !!m.stock_sync;
            }
        });
    } else {
        document.getElementById('skuMappingModalTitle').textContent = t('skuMappings.add');
    }
    openModal('skuMappingModal');
}

async function saveSkuMapping(e) {
    e.preventDefault();
    const id = document.getElementById('skuMappingFormId').value;
    const payload = {
        local_sku: document.getElementById('skuMappingLocalSku').value,
        platform: document.getElementById('skuMappingPlatform').value,
        platform_sku: document.getElementById('skuMappingPlatformSku').value,
        platform_title: document.getElementById('skuMappingTitle').value || null,
        price_sync: document.getElementById('skuMappingPriceSync').checked ? 1 : 0,
        stock_sync: document.getElementById('skuMappingStockSync').checked ? 1 : 0,
    };
    const url = id ? `/api/v1/sku-mappings/${id}` : '/api/v1/sku-mappings';
    const method = id ? 'PUT' : 'POST';
    const data = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (data?.error) { alert(data.error); return; }
    closeModal('skuMappingModal');
    loadSkuMappings();
}
document.getElementById('skuMappingForm')?.addEventListener('submit', saveSkuMapping);

async function deleteSkuMapping(id) {
    if (!confirm(t('common.confirm_delete'))) return;
    await apiFetch(`/api/v1/sku-mappings/${id}`, { method: 'DELETE' });
    loadSkuMappings();
}

// ===== Sprint 12: Coupons =====
async function loadCoupons(offset = 0) {
    const data = await apiFetch(`/api/v1/coupons?limit=20&offset=${offset}`);
    const tbody = document.getElementById('couponsTableBody');
    if (!data?.coupons?.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="10">${t('coupons.empty')}</td></tr>`;
        document.getElementById('couponsPagination').innerHTML = '';
        return;
    }
    tbody.innerHTML = data.coupons.map(c => {
        const typeLabels = { PERCENTAGE: '%', FIXED_AMOUNT: '¥', FREE_SHIPPING: t('coupons.free_ship') };
        const statusBadge = c.is_active ? `<span class="badge badge-delivered">${t('coupons.active')}</span>` : `<span class="badge badge-cancelled">${t('coupons.inactive')}</span>`;
        const usageText = c.usage_limit > 0 ? `${c.usage_count}/${c.usage_limit}` : `${c.usage_count}/${t('coupons.unlimited')}`;
        return `
        <tr>
          <td>#${c.id}</td>
          <td><strong>${escapeHtml(c.code)}</strong></td>
          <td>${escapeHtml(c.name)}</td>
          <td>${typeLabels[c.type] || c.type}</td>
          <td>${c.type === 'PERCENTAGE' ? c.value + '%' : formatCurrency(c.value, c.currency)}</td>
          <td class="col-hide-mobile">${c.platform === 'ALL' ? t('coupons.all_platforms') : platformBadge(c.platform)}</td>
          <td class="col-hide-mobile">${usageText}</td>
          <td>${formatDate(c.valid_to)}</td>
          <td>${statusBadge}</td>
          <td>${window._userRole === 'admin' ? `<button class="btn-sm" onclick="openCouponModal(${c.id})">${t('distributors.edit')}</button>` : '\u2014'}</td>
        </tr>`;
    }).join('');

    renderPagination('couponsPagination', offset, 20, data.total, (newOffset) => loadCoupons(newOffset));
}

function openCouponModal(id) {
    const form = document.getElementById('couponForm');
    form.reset();
    document.getElementById('couponFormId').value = '';

    if (id) {
        document.getElementById('couponModalTitle').textContent = t('coupons.edit');
        document.getElementById('couponFormId').value = id;
        apiFetch(`/api/v1/coupons/${Number(id)}`).then(data => {
            if (data?.coupon) {
                const c = data.coupon;
                document.getElementById('couponCode').value = c.code;
                document.getElementById('couponCode').readOnly = true;
                document.getElementById('couponName').value = c.name;
                document.getElementById('couponType').value = c.type;
                document.getElementById('couponValue').value = c.value;
                document.getElementById('couponMinOrder').value = c.min_order_amount;
                document.getElementById('couponMaxDiscount').value = c.max_discount || '';
                document.getElementById('couponValidFrom').value = c.valid_from?.slice(0, 16) || '';
                document.getElementById('couponValidTo').value = c.valid_to?.slice(0, 16) || '';
                document.getElementById('couponUsageLimit').value = c.usage_limit;
                document.getElementById('couponPerUserLimit').value = c.per_user_limit;
                document.getElementById('couponPlatform').value = c.platform;
            }
        });
    } else {
        document.getElementById('couponModalTitle').textContent = t('coupons.add');
        document.getElementById('couponCode').readOnly = false;
    }
    openModal('couponModal');
}

async function saveCoupon(e) {
    e.preventDefault();
    const id = document.getElementById('couponFormId').value;
    const payload = {
        code: document.getElementById('couponCode').value || undefined,
        name: document.getElementById('couponName').value,
        type: document.getElementById('couponType').value,
        value: Number(document.getElementById('couponValue').value),
        min_order_amount: Number(document.getElementById('couponMinOrder').value) || 0,
        max_discount: Number(document.getElementById('couponMaxDiscount').value) || null,
        valid_from: document.getElementById('couponValidFrom').value ? new Date(document.getElementById('couponValidFrom').value).toISOString() : undefined,
        valid_to: document.getElementById('couponValidTo').value ? new Date(document.getElementById('couponValidTo').value).toISOString() : undefined,
        usage_limit: Number(document.getElementById('couponUsageLimit').value) || 0,
        per_user_limit: Number(document.getElementById('couponPerUserLimit').value) || 1,
        platform: document.getElementById('couponPlatform').value,
    };
    const url = id ? `/api/v1/coupons/${id}` : '/api/v1/coupons';
    const method = id ? 'PUT' : 'POST';
    const data = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (data?.error) { alert(data.error); return; }
    closeModal('couponModal');
    loadCoupons();
}
document.getElementById('couponForm')?.addEventListener('submit', saveCoupon);

// ===== Sprint 12: Shipment Timeline =====
async function loadShipmentTimeline(shipmentId) {
    openModal('shipmentTimelineModal');
    const content = document.getElementById('shipmentTimelineContent');
    content.innerHTML = `<p style="color:var(--text-muted)">${t('common.loading')}</p>`;

    const data = await apiFetch(`/api/v1/shipping/${shipmentId}/timeline`);
    if (!data?.shipment) {
        content.innerHTML = `<p style="color:var(--danger)">${t('common.error')}</p>`;
        return;
    }

    const s = data.shipment;
    let html = `<div style="margin-bottom:16px">
        <p><strong>${t('shipping.tracking')}:</strong> ${escapeHtml(s.tracking_number)}</p>
        <p><strong>${t('shipping.carrier')}:</strong> ${escapeHtml(s.carrier)}</p>
        <p><strong>${t('orders.status')}:</strong> ${shipStatusBadge(s.status)}</p>`;
    if (data.tracking_url) {
        html += `<p><a href="${escapeHtml(data.tracking_url)}" target="_blank" rel="noopener" class="btn-sm" style="display:inline-block;margin-top:8px">${t('shipping.tracking_url')}</a></p>`;
    }
    if (data.duration_hours !== null) {
        html += `<p><strong>${t('shipping.duration')}:</strong> ${data.duration_hours} ${t('shipping.hours')}</p>`;
    }
    html += `</div>`;

    if (data.events?.length) {
        html += `<div class="timeline">`;
        data.events.forEach(ev => {
            html += `<div class="timeline-item" style="display:flex;gap:12px;margin-bottom:16px;padding-left:16px;border-left:3px solid var(--primary)">
                <div style="flex:1">
                    <div style="font-weight:600">${shipStatusBadge(ev.status)}</div>
                    ${ev.location ? `<div style="color:var(--text-muted);font-size:13px">${escapeHtml(ev.location)}</div>` : ''}
                    ${ev.description ? `<div style="font-size:13px">${escapeHtml(ev.description)}</div>` : ''}
                    <div style="color:var(--text-muted);font-size:12px;margin-top:4px">${formatDate(ev.event_time)}</div>
                </div>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<p style="color:var(--text-muted)">${t('shipping.no_events')}</p>`;
    }

    content.innerHTML = html;
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

// ===== Sprint 14: Shipping Fees =====
async function loadShippingFees() {
    const data = await apiFetch('/api/v1/shipping-fees/templates');
    const tbody = document.getElementById('shippingFeeTemplatesBody');
    if (!data?.templates?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('common.no_data')}</td></tr>`; return; }
    tbody.innerHTML = data.templates.map(t => `<tr>
        <td>${t.id}</td><td>${escapeHtml(t.name)}</td><td>${t.carrier}</td><td>${t.region}</td>
        <td>¥${(t.base_fee||0).toLocaleString()}</td><td>¥${(t.per_kg_fee||0).toLocaleString()}/kg</td>
        <td>${t.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
    </tr>`).join('');
}

async function saveShippingFeeTemplate(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('sftName').value,
        carrier: document.getElementById('sftCarrier').value,
        region: document.getElementById('sftRegion').value,
        base_fee: Number(document.getElementById('sftBaseFee').value),
        per_kg_fee: Number(document.getElementById('sftPerKg').value),
    };
    const data = await apiFetch('/api/v1/shipping-fees/templates', { method: 'POST', body: JSON.stringify(payload) });
    if (data?.error) { alert(data.error); return; }
    closeModal('shippingFeeTemplateModal');
    loadShippingFees();
}

async function reconcileShippingFees() {
    const checkboxes = document.querySelectorAll('#shippingFeeRecordsBody input[type="checkbox"]:checked');
    const ids = Array.from(checkboxes).map(cb => Number(cb.value));
    if (!ids.length) { alert('Select items to reconcile'); return; }
    await apiFetch('/api/v1/shipping-fees/reconcile', { method: 'POST', body: JSON.stringify({ ids }) });
    loadShippingFees();
}

// ===== Sprint 14: Stocktakes =====
async function loadStocktakes() {
    const status = document.getElementById('stocktakeStatusFilter')?.value || '';
    const url = status ? `/api/v1/stocktakes?status=${status}` : '/api/v1/stocktakes';
    const data = await apiFetch(url);
    const tbody = document.getElementById('stocktakesBody');
    if (!data?.stocktakes?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('common.no_data')}</td></tr>`; return; }
    tbody.innerHTML = data.stocktakes.map(s => `<tr>
        <td>${s.id}</td><td>${escapeHtml(s.code)}</td>
        <td>${statusBadge(s.status)}</td>
        <td>${s.started_at ? formatDate(s.started_at) : '-'}</td>
        <td>${s.completed_at ? formatDate(s.completed_at) : '-'}</td>
        <td>
            ${s.status === 'DRAFT' ? `<button class="btn-sm" onclick="startStocktake(${s.id})">開始</button>` : ''}
            ${s.status === 'IN_PROGRESS' ? `<button class="btn-sm" onclick="completeStocktake(${s.id})">完了</button>` : ''}
            ${s.status !== 'COMPLETED' && s.status !== 'CANCELLED' ? `<button class="btn-sm btn-danger" onclick="cancelStocktake(${s.id})">取消</button>` : ''}
        </td>
    </tr>`).join('');
}

async function createStocktake() {
    const data = await apiFetch('/api/v1/stocktakes', { method: 'POST', body: JSON.stringify({}) });
    if (data?.error) { alert(data.error); return; }
    loadStocktakes();
}
async function startStocktake(id) { await apiFetch(`/api/v1/stocktakes/${id}/start`, { method: 'POST' }); loadStocktakes(); }
async function completeStocktake(id) { if (!confirm('Complete this stocktake? Inventory will be adjusted.')) return; await apiFetch(`/api/v1/stocktakes/${id}/complete`, { method: 'POST' }); loadStocktakes(); }
async function cancelStocktake(id) { await apiFetch(`/api/v1/stocktakes/${id}/cancel`, { method: 'POST' }); loadStocktakes(); }

// ===== Sprint 14: Customer Segments =====
async function loadCustomerSegments() {
    loadRFMDistribution();
    loadSegmentsList();
}

async function loadRFMDistribution() {
    const data = await apiFetch('/api/v1/customer-segments/rfm/distribution');
    if (!data?.segments) return;
    const chart = getChart('rfmDistributionChart');
    if (!chart) return;
    const s = data.segments;
    chart.setOption({
        tooltip: { trigger: 'item' },
        series: [{
            type: 'pie', radius: ['40%', '70%'],
            data: [
                { value: s.champions, name: 'Champions', itemStyle: { color: '#10b981' } },
                { value: s.loyal, name: 'Loyal', itemStyle: { color: '#3b82f6' } },
                { value: s.potential, name: 'Potential', itemStyle: { color: '#8b5cf6' } },
                { value: s.new_customers, name: 'New', itemStyle: { color: '#f59e0b' } },
                { value: s.at_risk, name: 'At Risk', itemStyle: { color: '#ef4444' } },
                { value: s.lost, name: 'Lost', itemStyle: { color: '#6b7280' } },
            ].filter(d => d.value > 0),
            label: { show: true, formatter: '{b}: {c}' },
        }],
    });
}

async function loadSegmentsList() {
    const data = await apiFetch('/api/v1/customer-segments/segments');
    const tbody = document.getElementById('segmentsBody');
    if (!data?.segments?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${t('common.no_data')}</td></tr>`; return; }
    tbody.innerHTML = data.segments.map(s => {
        const rules = JSON.parse(s.rules || '{}');
        const ruleStr = Object.entries(rules).map(([k,v]) => `${k}:${v}`).join(', ');
        return `<tr>
            <td>${s.id}</td><td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${s.color};margin-right:6px"></span>${escapeHtml(s.name)}</td>
            <td style="font-size:12px;color:var(--text-muted)">${escapeHtml(ruleStr) || '-'}</td>
            <td>${s.customer_count}</td>
            <td><button class="btn-sm btn-danger" onclick="deleteSegment(${s.id})">削除</button></td>
        </tr>`;
    }).join('');
}

async function saveSegment(e) {
    e.preventDefault();
    const id = document.getElementById('segmentFormId').value;
    const payload = {
        name: document.getElementById('segmentName').value,
        rules: {
            rfm_min: document.getElementById('segmentRfmMin').value || undefined,
            rfm_max: document.getElementById('segmentRfmMax').value || undefined,
            min_orders: Number(document.getElementById('segmentMinOrders').value) || undefined,
            min_spent: Number(document.getElementById('segmentMinSpent').value) || undefined,
        },
        color: document.getElementById('segmentColor').value,
    };
    const url = id ? `/api/v1/customer-segments/segments/${id}` : '/api/v1/customer-segments/segments';
    const method = id ? 'PATCH' : 'POST';
    const data = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (data?.error) { alert(data.error); return; }
    closeModal('segmentModal');
    loadCustomerSegments();
}

async function deleteSegment(id) {
    if (!confirm('Delete this segment?')) return;
    await apiFetch(`/api/v1/customer-segments/segments/${id}`, { method: 'DELETE' });
    loadSegmentsList();
}

// ===== Sprint 14: Promotions =====
async function loadPromotions() {
    const status = document.getElementById('promotionStatusFilter')?.value || '';
    const url = status ? `/api/v1/promotions?status=${status}` : '/api/v1/promotions';
    const data = await apiFetch(url);
    const tbody = document.getElementById('promotionsBody');
    if (!data?.promotions?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${t('common.no_data')}</td></tr>`; return; }
    tbody.innerHTML = data.promotions.map(p => {
        const now = new Date().toISOString();
        const isActive = p.is_active && p.start_date <= now && p.end_date >= now;
        return `<tr>
            <td>${p.id}</td><td>${escapeHtml(p.name)}</td><td>${p.type}</td>
            <td>${p.discount_value}${p.type === 'PERCENTAGE' || p.type === 'THRESHOLD' ? '%' : '¥'}</td>
            <td style="font-size:12px">${formatDate(p.start_date)} ~ ${formatDate(p.end_date)}</td>
            <td>${p.current_uses}${p.max_uses ? '/' + p.max_uses : ''}</td>
            <td>${isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}
                <button class="btn-sm btn-danger admin-only" style="display:none" onclick="deletePromotion(${p.id})">削除</button></td>
        </tr>`;
    }).join('');
    document.querySelectorAll('#promotionsBody .admin-only').forEach(el => { if (currentRole === 'admin') el.style.display = ''; });
}

async function savePromotion(e) {
    e.preventDefault();
    const id = document.getElementById('promotionFormId').value;
    const payload = {
        name: document.getElementById('promotionName').value,
        type: document.getElementById('promotionType').value,
        discount_value: Number(document.getElementById('promotionValue').value),
        start_date: new Date(document.getElementById('promotionStart').value).toISOString(),
        end_date: new Date(document.getElementById('promotionEnd').value).toISOString(),
        min_order_amount: Number(document.getElementById('promotionMinAmount').value) || 0,
    };
    const url = id ? `/api/v1/promotions/${id}` : '/api/v1/promotions';
    const method = id ? 'PATCH' : 'POST';
    const data = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (data?.error) { alert(data.error); return; }
    closeModal('promotionModal');
    loadPromotions();
}

async function deletePromotion(id) {
    if (!confirm('Delete this promotion?')) return;
    const data = await apiFetch(`/api/v1/promotions/${id}`, { method: 'DELETE' });
    if (data?.error) { alert(data.error); return; }
    loadPromotions();
}

// ===== Sprint 14: Approvals =====
async function loadApprovals() {
    loadApprovalRequests();
    loadApprovalWorkflows();
}

async function loadApprovalRequests() {
    const data = await apiFetch('/api/v1/approvals/requests');
    const tbody = document.getElementById('approvalRequestsBody');
    if (!data?.requests?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('common.no_data')}</td></tr>`; return; }
    tbody.innerHTML = data.requests.map(r => `<tr>
        <td>${r.id}</td><td>${r.resource_type} #${r.resource_id}</td>
        <td>${escapeHtml(r.requester_name || r.requested_by)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${formatDate(r.created_at)}</td>
        <td>${r.status === 'PENDING' ? `
            <button class="btn-sm admin-only" style="display:none" onclick="approveRequest(${r.id})">承認</button>
            <button class="btn-sm btn-danger admin-only" style="display:none" onclick="rejectRequest(${r.id})">却下</button>
        ` : (r.reason || '-')}</td>
    </tr>`).join('');
    document.querySelectorAll('#approvalRequestsBody .admin-only').forEach(el => { if (currentRole === 'admin') el.style.display = ''; });
}

async function loadApprovalWorkflows() {
    const data = await apiFetch('/api/v1/approvals/workflows');
    const tbody = document.getElementById('approvalWorkflowsBody');
    if (!data?.workflows?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${t('common.no_data')}</td></tr>`; return; }
    tbody.innerHTML = data.workflows.map(w => {
        const cond = JSON.parse(w.conditions || '{}');
        return `<tr>
            <td>${w.id}</td><td>${escapeHtml(w.name)}</td><td>${w.resource_type}</td>
            <td style="font-size:12px">${cond.min_amount ? '≥¥'+cond.min_amount.toLocaleString() : 'All'}</td>
            <td><button class="btn-sm btn-danger" onclick="deleteWorkflow(${w.id})">削除</button></td>
        </tr>`;
    }).join('');
}

async function approveRequest(id) { await apiFetch(`/api/v1/approvals/requests/${id}/approve`, { method: 'POST', body: '{}' }); loadApprovalRequests(); }
async function rejectRequest(id) {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await apiFetch(`/api/v1/approvals/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
    loadApprovalRequests();
}

async function saveWorkflow(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('wfName').value,
        resource_type: document.getElementById('wfResourceType').value,
        conditions: { min_amount: Number(document.getElementById('wfMinAmount').value) || undefined },
        approver_ids: [1], // Default to admin (id=1)
    };
    const data = await apiFetch('/api/v1/approvals/workflows', { method: 'POST', body: JSON.stringify(payload) });
    if (data?.error) { alert(data.error); return; }
    closeModal('workflowModal');
    loadApprovalWorkflows();
}

async function deleteWorkflow(id) {
    if (!confirm('Delete this workflow?')) return;
    await apiFetch(`/api/v1/approvals/workflows/${id}`, { method: 'DELETE' });
    loadApprovalWorkflows();
}

// ===== Sprint 14: Webhooks =====
async function loadWebhooks() {
    const data = await apiFetch('/api/v1/webhooks');
    const tbody = document.getElementById('webhooksBody');
    if (!data?.endpoints?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('common.no_data')}</td></tr>`; return; }
    tbody.innerHTML = data.endpoints.map(ep => {
        const events = JSON.parse(ep.events || '[]');
        return `<tr>
            <td>${ep.id}</td><td>${escapeHtml(ep.name)}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ep.url)}</td>
            <td style="font-size:11px">${events.join(', ')}</td>
            <td>${ep.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}
                ${ep.failure_count > 0 ? `<span class="badge badge-danger">${ep.failure_count} fails</span>` : ''}</td>
            <td>
                <button class="btn-sm" onclick="testWebhook(${ep.id})">Test</button>
                <button class="btn-sm btn-danger" onclick="deleteWebhook(${ep.id})">削除</button>
            </td>
        </tr>`;
    }).join('');
}

async function saveWebhook(e) {
    e.preventDefault();
    const id = document.getElementById('webhookFormId').value;
    const events = Array.from(document.querySelectorAll('#webhookEvents input:checked')).map(cb => cb.value);
    const payload = {
        name: document.getElementById('webhookName').value,
        url: document.getElementById('webhookUrl').value,
        secret: document.getElementById('webhookSecret').value || undefined,
        events,
    };
    const url = id ? `/api/v1/webhooks/${id}` : '/api/v1/webhooks';
    const method = id ? 'PATCH' : 'POST';
    const data = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (data?.error) { alert(data.error); return; }
    closeModal('webhookModal');
    loadWebhooks();
}

async function testWebhook(id) {
    const data = await apiFetch(`/api/v1/webhooks/${id}/test`, { method: 'POST' });
    alert(data?.success ? 'Webhook test sent!' : 'Webhook test failed: ' + (data?.error || 'unknown'));
}

async function deleteWebhook(id) {
    if (!confirm('Delete this webhook?')) return;
    await apiFetch(`/api/v1/webhooks/${id}`, { method: 'DELETE' });
    loadWebhooks();
}

// ===== Sprint 14: Data Screen =====
let dsRefreshInterval = null;

async function loadDataScreen() {
    stopAutoRefresh();
    const stats = await apiFetch('/api/v1/dashboard/stats');
    if (stats?.overview) {
        document.getElementById('dsTodayOrders').textContent = (stats.overview.totalOrders || 0).toLocaleString();
        document.getElementById('dsTodayRevenue').textContent = '¥' + (stats.overview.totalRevenue || 0).toLocaleString();
        document.getElementById('dsTodayShipped').textContent = (stats.overview.processingOrders || 0).toLocaleString();
        document.getElementById('dsTodayReturns').textContent = (stats.overview.pendingOrders || 0).toLocaleString();
    }

    // Revenue trend chart
    const trendData = await apiFetch('/api/v1/dashboard/revenue-trend?period=30d');
    const dsRevChart = getChart('dsRevenueChart');
    if (dsRevChart && trendData?.data) {
        dsRevChart.setOption({
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: trendData.data.map(d => d.date), axisLabel: { color: '#94a3b8' } },
            yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
            series: [{ data: trendData.data.map(d => d.revenue), type: 'line', smooth: true, areaStyle: { color: 'rgba(139,92,246,0.2)' }, lineStyle: { color: '#8b5cf6' }, itemStyle: { color: '#8b5cf6' } }],
        });
    }

    // Platform donut
    const platData = await apiFetch('/api/v1/dashboard/orders-by-platform?period=30d');
    const dsPlatChart = getChart('dsPlatformChart');
    if (dsPlatChart && platData?.platforms) {
        dsPlatChart.setOption({
            tooltip: { trigger: 'item' },
            series: [{
                type: 'pie', radius: ['40%','70%'],
                data: platData.platforms.map(p => ({ value: p.orderCount, name: p.platform })),
                label: { color: '#e2e8f0' },
            }],
        });
    }

    // Ticker - latest orders
    const ordersData = await apiFetch('/api/v1/orders?limit=10');
    const ticker = document.getElementById('dsTickerContent');
    if (ticker && ordersData?.orders) {
        ticker.innerHTML = ordersData.orders.map(o =>
            `<div class="ds-ticker-item">#${o.id} ${o.platform} ¥${(o.total_amount||0).toLocaleString()} <span class="badge badge-sm">${o.status}</span></div>`
        ).join('');
    }

    startAutoRefresh();
}

function startAutoRefresh() { dsRefreshInterval = setInterval(loadDataScreen, 30000); }
function stopAutoRefresh() { if (dsRefreshInterval) { clearInterval(dsRefreshInterval); dsRefreshInterval = null; } }

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

// ===== Sprint 14: Dashboard Customization =====
async function loadDashboardLayout() {
    const data = await apiFetch('/api/v1/dashboard/layout');
    return data?.layout || null;
}

async function saveDashboardLayout(layout) {
    await apiFetch('/api/v1/dashboard/layout', { method: 'PUT', body: JSON.stringify({ layout }) });
}

// ===== Sprint 14: Offline detection =====
window.addEventListener('online', () => { const b = document.getElementById('offlineBanner'); if (b) b.style.display = 'none'; });
window.addEventListener('offline', () => {
    let b = document.getElementById('offlineBanner');
    if (!b) { b = document.createElement('div'); b.id = 'offlineBanner'; b.className = 'offline-banner';
        b.textContent = 'Offline - cached data shown'; document.body.prepend(b); }
    b.style.display = 'block';
});
