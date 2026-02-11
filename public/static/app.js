/* =============================================
   Smart ERP - Frontend Application Logic
   ============================================= */

const API_BASE = window.location.origin;
const AUTH_TOKEN = localStorage.getItem('erp_token') || 'tok_dev_abc123';

// ===== SPA Router =====
const pageTitles = {
    dashboard: { title: 'ダッシュボード', sub: 'Smart ERP Middle Platform v2.0' },
    orders: { title: '注文管理', sub: 'Orders Management' },
    inventory: { title: '在庫管理', sub: 'Inventory & Products' },
    wallet: { title: 'ウォレット', sub: 'Distributor Wallet' },
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

// ===== Page Data Loaders =====
async function loadPageData(page) {
    switch (page) {
        case 'dashboard': return loadDashboard();
        case 'orders': return loadOrders();
        case 'inventory': return loadInventory();
        case 'wallet': return loadWallet();
    }
}

// --- Dashboard ---
async function loadDashboard() {
    const [ordersData, inventoryData] = await Promise.all([
        apiFetch('/api/v1/orders'),
        apiFetch('/api/v1/inventory'),
    ]);

    if (ordersData) {
        document.getElementById('stat-orders').textContent = ordersData.count || 0;
        renderRecentOrders(ordersData.orders?.slice(0, 5) || []);
    }
    if (inventoryData) {
        document.getElementById('stat-products').textContent = inventoryData.products?.length || 0;
    }

    renderChart();
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

function renderChart() {
    const canvas = document.getElementById('ordersChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Simulated data for visual effect
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = [12, 19, 8, 25, 15, 22, 18];
    const max = Math.max(...data) * 1.2;

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
    const points = data.map((v, i) => ({
        x: padding.left + (chartW / (data.length - 1)) * i,
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

    // X labels
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    points.forEach((p, i) => {
        ctx.fillText(days[i], p.x, canvas.height - padding.bottom + 20);
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

    // Health check for status dot
    apiFetch('/health').then(data => {
        const dot = document.querySelector('.status-dot');
        if (data?.status !== 'healthy' && dot) {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 8px #ef4444';
        }
    });

    // Initial load
    navigateTo('dashboard');

    // Resize chart on window resize
    window.addEventListener('resize', () => {
        if (document.getElementById('page-dashboard').classList.contains('active')) renderChart();
    });
});
