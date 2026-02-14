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
    dashboard: { title: 'ダッシュボード', sub: 'Keep Data Flow Platform' },
    orders: { title: '注文管理', sub: 'Orders Management' },
    inventory: { title: '在庫管理', sub: 'Inventory & Products' },
    wallet: { title: 'ウォレット', sub: 'Distributor Wallet' },
    commissions: { title: '佣金管理', sub: 'Commission Management' },
    invoices: { title: '請求書', sub: 'Invoice Management' },
    distributors: { title: '販売者管理', sub: 'Distributor Management' },
    audit: { title: '監査ログ', sub: 'Audit Logs' },
};

function navigateTo(pageName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${pageName}"]`)?.classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) targetPage.classList.add('active');

    // Update header
    const info = pageTitles[pageName] || pageTitles.dashboard;
    document.getElementById('pageTitle').textContent = info.title;
    document.getElementById('pageSubtitle').textContent = info.sub;

    // Load data for the page
    loadPageData(pageName);
}

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
        if (!blob) return alert('CSV出力に失敗しました');
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
            `¥${(statsData.overview.totalRevenue || 0).toLocaleString()}`;
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
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">注文データがありません</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong>#${escapeHtml(o.id)}</strong></td>
      <td>${platformBadge(o.platform)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>¥${(Number(o.total_amount) || 0).toLocaleString()}</td>
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

    // Fetch real data
    const trendData = await apiFetch(`/api/v1/dashboard/revenue-trend?period=${period}`);
    const items = trendData?.data || [];

    const labels = items.map(d => d.date);
    const data = items.map(d => d.orderCount);

    // Fallback if no data
    if (!data.length) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '13px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('データがありません', canvas.width / 2, canvas.height / 2);
        return;
    }

    const max = Math.max(...data) * 1.2 || 1;

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid lines
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

    // Data points & line
    const step = data.length > 1 ? chartW / (data.length - 1) : 0;
    const points = data.map((v, i) => ({
        x: padding.left + step * i,
        y: padding.top + chartH - (v / max) * chartH
    }));

    // Gradient area
    const gradient = ctx.createLinearGradient(0, padding.top, 0, canvas.height - padding.bottom);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, canvas.height - padding.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, canvas.height - padding.bottom);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
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

    // X labels (show subset to avoid overlap)
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
        tbody.innerHTML = '<tr class="empty-row"><td colspan="8">注文データがありません</td></tr>';
        return;
    }

    tbody.innerHTML = data.orders.map(o => `
    <tr>
      <td><strong>#${escapeHtml(o.id)}</strong></td>
      <td>${platformBadge(o.platform)}</td>
      <td>${escapeHtml(o.platform_order_id)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>¥${(Number(o.total_amount) || 0).toLocaleString()}</td>
      <td>¥${(Number(o.tax_total) || 0).toLocaleString()}</td>
      <td>${formatDate(o.created_at)}</td>
      <td>${o.status === 'PROCESSING' ? `<button class="btn-sm" onclick="shipOrder(${Number(o.id)})">発送</button>` : '—'}</td>
    </tr>
  `).join('');
}

// --- Inventory ---
async function loadInventory() {
    const data = await apiFetch('/api/v1/inventory');
    const tbody = document.getElementById('inventoryTableBody');

    if (!data?.products?.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">商品データがありません</td></tr>';
        return;
    }

    tbody.innerHTML = data.products.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.sku)}</strong></td>
      <td>${escapeHtml(p.name_jp) || '—'}</td>
      <td>${escapeHtml(p.name_cn) || '—'}</td>
      <td>¥${(Number(p.cost_price) || 0).toLocaleString()}</td>
      <td>${taxBadge(p.tax_category)}</td>
      <td><strong>${Number(p.total_stock) || 0}</strong></td>
    </tr>
  `).join('');
}

// --- Wallet ---
async function loadWallet(distributorId = 1) {
    const balanceData = await apiFetch(`/api/v1/wallet/balance/${distributorId}`);

    if (balanceData && !balanceData.error) {
        const balance = Number(balanceData.balance) || 0;
        const frozen = Number(balanceData.frozen) || 0;
        document.getElementById('walletBalance').textContent = `¥${balance.toLocaleString()}`;
        document.getElementById('walletFrozen').textContent = `¥${frozen.toLocaleString()}`;
        document.getElementById('walletTotal').textContent = `¥${(balance + frozen).toLocaleString()}`;
    }

    const txData = await apiFetch(`/api/v1/wallet/transactions/${distributorId}`);
    const tbody = document.getElementById('walletTransBody');

    if (!txData?.transactions?.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">取引履歴がありません</td></tr>';
        return;
    }

    tbody.innerHTML = txData.transactions.map(t => `
    <tr>
      <td>#${escapeHtml(t.id)}</td>
      <td>${txTypeBadge(t.type)}</td>
      <td class="${t.type === 'DEPOSIT' || t.type === 'REFUND' ? 'text-green' : 'text-red'}">
        ${t.type === 'DEPOSIT' || t.type === 'REFUND' ? '+' : '-'}¥${Math.abs(Number(t.amount) || 0).toLocaleString()}
      </td>
      <td>${escapeHtml(t.related_order_id) || '—'}</td>
      <td>¥${(Number(t.balance_snapshot) || 0).toLocaleString()}</td>
      <td>${formatDate(t.created_at)}</td>
    </tr>
  `).join('');
}

// --- Commissions ---
async function loadCommissions() {
    // Load rates table
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
        ratesBody.innerHTML = '<tr class="empty-row"><td colspan="3">手数料率データがありません</td></tr>';
    }

    // Load settlement history
    loadCommissionHistory(0);
}

async function loadCommissionHistory(offset) {
    const status = document.getElementById('commStatusFilter')?.value || '';
    let url = `/api/v1/commissions/history?limit=20&offset=${offset}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const data = await apiFetch(url);
    const tbody = document.getElementById('commHistoryBody');

    if (!data?.settlements?.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9">決済履歴がありません</td></tr>';
        document.getElementById('commPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.settlements.map(s => `
    <tr>
      <td>#${escapeHtml(s.id)}</td>
      <td>#${escapeHtml(s.order_id)}</td>
      <td>${escapeHtml(s.sku)}</td>
      <td>${platformBadge(s.platform)}</td>
      <td>${s.qty}</td>
      <td>¥${(Number(s.unit_price) || 0).toLocaleString()}</td>
      <td>¥${(Number(s.commission_amount) || 0).toLocaleString()}</td>
      <td>${commStatusBadge(s.status)}</td>
      <td>${formatDate(s.created_at)}</td>
    </tr>`).join('');

    renderPagination('commPagination', offset, 20, data.total, (newOffset) => loadCommissionHistory(newOffset));
}

// --- Invoices ---
async function loadInvoices(offset = 0) {
    const data = await apiFetch(`/api/v1/invoices?limit=20&offset=${offset}`);
    const tbody = document.getElementById('invoicesTableBody');

    if (!data?.invoices?.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">請求書がありません</td></tr>';
        document.getElementById('invoicesPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.invoices.map(inv => `
    <tr>
      <td>#${escapeHtml(inv.id)}</td>
      <td>${escapeHtml(inv.invoice_number) || '—'}</td>
      <td>#${escapeHtml(inv.order_id)}</td>
      <td>${platformBadge(inv.platform || '')}</td>
      <td>¥${(Number(inv.total_amount || inv.amount) || 0).toLocaleString()}</td>
      <td>${formatDate(inv.created_at)}</td>
      <td>
        <button class="btn-sm" onclick="viewInvoiceDetail(${Number(inv.id)})">詳細</button>
        ${inv.pdf_url ? `<a href="/api/v1/invoices/${Number(inv.id)}/pdf" target="_blank" class="btn-sm" style="margin-left:4px;text-decoration:none">PDF</a>` : ''}
      </td>
    </tr>`).join('');

    renderPagination('invoicesPagination', offset, 20, data.total, (newOffset) => loadInvoices(newOffset));
}

async function viewInvoiceDetail(id) {
    openModal('invoiceDetailModal');
    const content = document.getElementById('invoiceDetailContent');
    content.innerHTML = '<p style="color:var(--text-muted)">読み込み中...</p>';

    const data = await apiFetch(`/api/v1/invoices/${id}`);
    if (!data || data.error) {
        content.innerHTML = `<p style="color:var(--accent-red)">エラー: ${escapeHtml(data?.error || '読み込みに失敗')}</p>`;
        return;
    }

    const inv = data.invoice || data;
    const taxDetails = typeof inv.tax_details === 'string' ? JSON.parse(inv.tax_details) : inv.tax_details;

    let taxItemsHtml = '';
    if (taxDetails?.items?.length) {
        taxItemsHtml = `
        <table class="data-table" style="margin-top:12px">
          <thead><tr><th>SKU</th><th>数量</th><th>単価</th><th>税率</th><th>税額</th></tr></thead>
          <tbody>${taxDetails.items.map(it => `
            <tr>
              <td>${escapeHtml(it.sku)}</td>
              <td>${it.qty}</td>
              <td>¥${(it.unit_price || 0).toLocaleString()}</td>
              <td>${((it.tax_rate || 0) * 100).toFixed(0)}%</td>
              <td>¥${(it.tax_amount || 0).toLocaleString()}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    }

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div>
          <span style="color:var(--text-muted);font-size:0.8rem">請求書番号</span>
          <p style="font-weight:600;margin-top:4px">${escapeHtml(inv.invoice_number)}</p>
        </div>
        <div>
          <span style="color:var(--text-muted);font-size:0.8rem">発行日</span>
          <p style="font-weight:600;margin-top:4px">${formatDate(inv.created_at)}</p>
        </div>
        <div>
          <span style="color:var(--text-muted);font-size:0.8rem">販売者</span>
          <p style="font-weight:600;margin-top:4px">${escapeHtml(taxDetails?.seller?.name || '—')}</p>
          <p style="font-size:0.8rem;color:var(--text-secondary)">${escapeHtml(taxDetails?.seller?.registration_number || '')}</p>
        </div>
        <div>
          <span style="color:var(--text-muted);font-size:0.8rem">購入者</span>
          <p style="font-weight:600;margin-top:4px">${escapeHtml(taxDetails?.buyer?.name || '—')}</p>
        </div>
      </div>
      <h4 style="margin-bottom:8px">品目・税明細</h4>
      ${taxItemsHtml}
      <div style="text-align:right;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <span style="color:var(--text-muted)">合計 (税込):</span>
        <strong style="font-size:1.2rem;margin-left:8px">¥${(Number(taxDetails?.summary?.grandTotal || taxDetails?.total_with_tax) || 0).toLocaleString()}</strong>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
        ${inv.pdf_url
            ? `<a href="/api/v1/invoices/${Number(inv.id)}/pdf" target="_blank" class="btn-primary" style="text-decoration:none;padding:8px 16px;border-radius:8px;font-size:0.85rem">PDF ダウンロード</a>`
            : `<button class="btn-primary" onclick="generateInvoicePdf(${Number(inv.id)})" style="padding:8px 16px;font-size:0.85rem">PDF 生成</button>`
        }
      </div>`;
}

// --- Generate Invoice PDF ---
async function generateInvoicePdf(id) {
    const result = await apiFetch(`/api/v1/invoices/${Number(id)}/pdf`, { method: 'POST' });
    if (result?.error) {
        alert(`PDF生成エラー: ${result.error}`);
        return;
    }
    // Refresh the detail view
    viewInvoiceDetail(id);
}

// --- Distributors ---
async function loadDistributors(offset = 0) {
    const data = await apiFetch(`/api/v1/distributors?limit=20&offset=${offset}`);
    const tbody = document.getElementById('distributorsTableBody');

    if (!data?.distributors?.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="8">販売者がいません</td></tr>';
        document.getElementById('distributorsPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.distributors.map(d => `
    <tr>
      <td>#${escapeHtml(d.id)}</td>
      <td><strong>${escapeHtml(d.name)}</strong></td>
      <td>${roleBadge(d.role)}</td>
      <td>¥${(Number(d.balance) || 0).toLocaleString()}</td>
      <td>¥${(Number(d.frozen_balance) || 0).toLocaleString()}</td>
      <td>${escapeHtml(d.tax_reg_number) || '—'}</td>
      <td>${formatDate(d.created_at)}</td>
      <td>
        <button class="btn-sm" onclick="openDistributorModal(${Number(d.id)})">編集</button>
        <button class="btn-sm" onclick="resetDistributorToken(${Number(d.id)})" style="margin-left:4px">リセット</button>
      </td>
    </tr>`).join('');

    renderPagination('distributorsPagination', offset, 20, data.total, (newOffset) => loadDistributors(newOffset));
}

function openDistributorModal(id) {
    const modal = document.getElementById('distributorModal');
    const title = document.getElementById('distributorModalTitle');
    const form = document.getElementById('distributorForm');
    form.reset();

    if (id) {
        title.textContent = '販売者編集';
        document.getElementById('distributorFormId').value = id;
        // Fetch current data
        apiFetch(`/api/v1/distributors/${Number(id)}`).then(data => {
            if (data?.distributor) {
                document.getElementById('distributorFormName').value = data.distributor.name || '';
                document.getElementById('distributorFormRole').value = data.distributor.role || 'distributor';
                document.getElementById('distributorFormTaxReg').value = data.distributor.tax_reg_number || '';
            }
        });
    } else {
        title.textContent = '新規販売者';
        document.getElementById('distributorFormId').value = '';
    }
    openModal('distributorModal');
}

async function saveDistributor() {
    const id = document.getElementById('distributorFormId').value;
    const name = document.getElementById('distributorFormName').value.trim();
    const role = document.getElementById('distributorFormRole').value;
    const taxReg = document.getElementById('distributorFormTaxReg').value.trim();

    if (!name) { alert('名前は必須です'); return; }

    const payload = { name, role, tax_reg_number: taxReg || undefined };

    if (id) {
        const result = await apiFetch(`/api/v1/distributors/${Number(id)}`, {
            method: 'PUT', body: JSON.stringify(payload),
        });
        if (result?.error) { alert(`更新エラー: ${result.error}`); return; }
    } else {
        const result = await apiFetch('/api/v1/distributors', {
            method: 'POST', body: JSON.stringify(payload),
        });
        if (result?.error) { alert(`作成エラー: ${result.error}`); return; }
        if (result?.distributor?.token) {
            alert(`トークン: ${result.distributor.token}\n\nこのトークンは再表示されません。安全に保管してください。`);
        }
    }

    closeModal('distributorModal');
    loadDistributors();
}

async function resetDistributorToken(id) {
    if (!confirm('トークンをリセットしますか？旧トークンは無効になります。')) return;

    const result = await apiFetch(`/api/v1/distributors/${Number(id)}/reset-token`, { method: 'POST' });
    if (result?.error) { alert(`リセットエラー: ${result.error}`); return; }
    if (result?.token) {
        alert(`新トークン: ${result.token}\n\nこのトークンは再表示されません。安全に保管してください。`);
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
        tbody.innerHTML = '<tr class="empty-row"><td colspan="8">ログがありません</td></tr>';
        document.getElementById('auditPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.logs.map(log => `
    <tr>
      <td>#${escapeHtml(log.id)}</td>
      <td>${escapeHtml(log.distributor_name || log.distributor_id || '—')}</td>
      <td><span class="badge badge-processing">${escapeHtml(log.action)}</span></td>
      <td>${escapeHtml(log.resource_type)}</td>
      <td>${escapeHtml(log.resource_id) || '—'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(log.details || '')}">${escapeHtml(log.details) || '—'}</td>
      <td>${escapeHtml(log.ip_address) || '—'}</td>
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
      <button class="btn-ghost ${prevDisabled}" id="${containerId}-prev">前へ</button>
      <span style="color:var(--text-secondary);font-size:0.85rem">${currentPage} / ${totalPages}</span>
      <button class="btn-ghost ${nextDisabled}" id="${containerId}-next">次へ</button>`;

    if (!prevDisabled) {
        container.querySelector(`#${containerId}-prev`).addEventListener('click', () => onNavigate(offset - limit));
    }
    if (!nextDisabled) {
        container.querySelector(`#${containerId}-next`).addEventListener('click', () => onNavigate(offset + limit));
    }
}

// ===== Actions =====
async function shipOrder(orderId) {
    const tracking = prompt('トラッキング番号を入力してください:');
    if (!tracking) return;
    const result = await apiFetch(`/api/v1/orders/${Number(orderId)}/ship`, {
        method: 'PATCH', body: JSON.stringify({ tracking_number: tracking }),
    });
    if (result?.error) {
        alert(`発送エラー: ${result.error}`);
        return;
    }
    loadOrders();
}

async function addProduct(formData) {
    const payload = Object.fromEntries(formData);
    payload.cost_price = Number(payload.cost_price);
    const result = await apiFetch('/api/v1/inventory/products', {
        method: 'POST', body: JSON.stringify(payload),
    });
    if (result?.error) {
        alert(`商品追加エラー: ${result.error}`);
        return;
    }
    closeModal('addProductModal');
    loadInventory();
}

async function inboundStock(formData) {
    const payload = Object.fromEntries(formData);
    payload.quantity = Number(payload.quantity);
    const result = await apiFetch('/api/v1/inventory/inbound', {
        method: 'POST', body: JSON.stringify(payload),
    });
    if (result?.error) {
        alert(`入庫エラー: ${result.error}`);
        return;
    }
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
    if (result?.error) {
        alert(`入金エラー: ${result.error}`);
        return;
    }
    closeModal('depositModal');
    loadWallet(payload.distributor_id);
}

// ===== Dynamic Modal Creation =====
function createInboundModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'inboundModal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>入庫登録</h3>
          <button class="modal-close" data-close="inboundModal">&#10005;</button>
        </div>
        <form id="inboundForm">
          <div class="form-group">
            <label>SKU</label>
            <input type="text" name="sku" required placeholder="例: CARROT-500ML">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>数量</label>
              <input type="number" name="quantity" required min="1" placeholder="100">
            </div>
            <div class="form-group">
              <label>倉庫</label>
              <input type="text" name="warehouse" value="JP-MAIN" placeholder="JP-MAIN">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-close="inboundModal">キャンセル</button>
            <button type="submit" class="btn-primary">入庫</button>
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
          <h3>入金申請</h3>
          <button class="modal-close" data-close="depositModal">&#10005;</button>
        </div>
        <form id="depositForm">
          <input type="hidden" name="distributor_id" value="1">
          <div class="form-group">
            <label>入金額 (&#165;)</label>
            <input type="number" name="amount" required min="1" placeholder="10000">
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-close="depositModal">キャンセル</button>
            <button type="submit" class="btn-primary">入金</button>
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
    const cls = { PENDING: 'pending', PROCESSING: 'processing', SHIPPED: 'shipped', DELIVERED: 'delivered' };
    return `<span class="badge badge-${cls[status] || 'pending'}">${safe}</span>`;
}

function commStatusBadge(status) {
    const map = {
        PENDING: { cls: 'pending', label: '未決済' },
        SETTLED: { cls: 'delivered', label: '決済済' },
        FAILED: { cls: 'pending', label: '失敗' },
    };
    const info = map[status] || { cls: 'pending', label: escapeHtml(status) };
    return `<span class="badge badge-${info.cls}">${info.label}</span>`;
}

function taxBadge(category) {
    if (category === 'reduced') return '<span class="badge badge-processing">軽減 8%</span>';
    return '<span class="badge badge-pending">標準 10%</span>';
}

function txTypeBadge(type) {
    const map = {
        DEPOSIT: { cls: 'delivered', label: '入金' },
        FREEZE: { cls: 'processing', label: '凍結' },
        DEDUCT: { cls: 'pending', label: '決済' },
        REFUND: { cls: 'shipped', label: '返金' },
    };
    const info = map[type] || { cls: 'pending', label: escapeHtml(type) };
    return `<span class="badge badge-${info.cls}">${info.label}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
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
    // Create dynamic modals
    createInboundModal();
    createDepositModal();

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
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

    // Check admin role to show admin-only nav items
    apiFetch('/api/v1/auth/me').then(data => {
        if (data?.distributor?.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
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

    // Initial load
    navigateTo('dashboard');

    // Resize chart on window resize
    window.addEventListener('resize', () => {
        if (document.getElementById('page-dashboard').classList.contains('active')) renderChart();
    });
});
