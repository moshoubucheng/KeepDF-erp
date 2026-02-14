/* =============================================
   KeepDF - Internationalization (i18n)
   Languages: ja (Japanese), en (English), zh (Chinese)
   ============================================= */

const translations = {
    ja: {
        // Navigation
        'nav.dashboard': 'ダッシュボード',
        'nav.orders': '注文管理',
        'nav.inventory': '在庫管理',
        'nav.wallet': 'ウォレット',
        'nav.commissions': '佣金管理',
        'nav.invoices': '請求書',
        'nav.distributors': '販売者管理',
        'nav.audit': '監査ログ',
        'nav.logout': 'ログアウト',
        'nav.system_online': 'System Online',

        // Dashboard
        'dashboard.title': 'ダッシュボード',
        'dashboard.subtitle': 'Keep Data Flow Platform',
        'dashboard.revenue': '今月売上',
        'dashboard.active_orders': 'アクティブ注文',
        'dashboard.products': '商品数',
        'dashboard.distributors_count': 'ディストリビューター',
        'dashboard.order_trend': '注文トレンド',
        'dashboard.by_platform': 'プラットフォーム別',
        'dashboard.recent_orders': '最近の注文',
        'dashboard.view_all': 'すべて表示 →',
        'dashboard.no_data': 'データがありません',
        'dashboard.7d': '7日',
        'dashboard.30d': '30日',
        'dashboard.90d': '90日',

        // Orders
        'orders.title': '注文管理',
        'orders.subtitle': 'Orders Management',
        'orders.all_platforms': '全プラットフォーム',
        'orders.all_statuses': '全ステータス',
        'orders.export_csv': 'CSV出力',
        'orders.sync': '同期',
        'orders.id': '注文ID',
        'orders.platform': 'プラットフォーム',
        'orders.order_number': '注文番号',
        'orders.status': 'ステータス',
        'orders.amount': '金額',
        'orders.tax': '税額',
        'orders.date': '日時',
        'orders.actions': '操作',
        'orders.empty': '注文データがありません',
        'orders.ship': '発送',
        'orders.deliver': '配達完了',
        'orders.cancel': 'キャンセル',

        // Inventory
        'inventory.title': '在庫管理',
        'inventory.subtitle': 'Inventory & Products',
        'inventory.add_product': '商品追加',
        'inventory.inbound': '入庫登録',
        'inventory.sku': 'SKU',
        'inventory.name_jp': '商品名 (JP)',
        'inventory.name_cn': '商品名 (CN)',
        'inventory.cost_price': '原価',
        'inventory.tax_category': '税区分',
        'inventory.stock': '在庫数',
        'inventory.empty': '商品データがありません',
        'inventory.loading': '商品データを読み込み中...',
        'inventory.edit': '編集',
        'inventory.delete': '削除',
        'inventory.tax_standard': '標準税率 (10%)',
        'inventory.tax_reduced': '軽減税率 (8%)',

        // Wallet
        'wallet.title': 'ウォレット',
        'wallet.subtitle': 'Distributor Wallet',
        'wallet.available': '利用可能残高',
        'wallet.available_sub': 'Available Balance',
        'wallet.frozen': '凍結中',
        'wallet.frozen_sub': 'Frozen for Orders',
        'wallet.total': '合計資産',
        'wallet.total_sub': 'Total Assets',
        'wallet.deposit': '入金申請',
        'wallet.history': '取引履歴',
        'wallet.tx_id': 'ID',
        'wallet.tx_type': 'タイプ',
        'wallet.tx_amount': '金額',
        'wallet.tx_order': '関連注文',
        'wallet.tx_snapshot': '残高スナップショット',
        'wallet.tx_date': '日時',
        'wallet.empty': '取引履歴がありません',

        // Commissions
        'commissions.title': '佣金管理',
        'commissions.subtitle': 'Commission Management',
        'commissions.rates': '手数料率一覧',
        'commissions.rate_sku': 'SKU',
        'commissions.rate_platform': 'プラットフォーム',
        'commissions.rate_value': '手数料率',
        'commissions.rates_empty': '手数料率データがありません',
        'commissions.history': '決済履歴',
        'commissions.hist_id': 'ID',
        'commissions.hist_order': '注文ID',
        'commissions.hist_sku': 'SKU',
        'commissions.hist_platform': 'プラットフォーム',
        'commissions.hist_qty': '数量',
        'commissions.hist_price': '単価',
        'commissions.hist_amount': '手数料',
        'commissions.hist_status': 'ステータス',
        'commissions.hist_date': '日時',
        'commissions.empty': '決済履歴がありません',
        'commissions.status_pending': '未決済',
        'commissions.status_settled': '決済済',
        'commissions.status_failed': '失敗',

        // Invoices
        'invoices.title': '請求書',
        'invoices.subtitle': 'Invoice Management',
        'invoices.list': '請求書一覧',
        'invoices.id': 'ID',
        'invoices.number': '請求書番号',
        'invoices.order_id': '注文ID',
        'invoices.platform': 'プラットフォーム',
        'invoices.amount': '金額',
        'invoices.date': '発行日',
        'invoices.actions': '操作',
        'invoices.detail': '詳細',
        'invoices.empty': '請求書がありません',
        'invoices.detail_title': '請求書詳細',
        'invoices.loading': '読み込み中...',

        // Distributors
        'distributors.title': '販売者管理',
        'distributors.subtitle': 'Distributor Management',
        'distributors.add': '新規作成',
        'distributors.list': '販売者一覧',
        'distributors.id': 'ID',
        'distributors.name': '名前',
        'distributors.role': 'ロール',
        'distributors.balance': '残高',
        'distributors.frozen': '凍結',
        'distributors.tax_reg': '登録番号',
        'distributors.created': '作成日',
        'distributors.actions': '操作',
        'distributors.edit': '編集',
        'distributors.reset_token': 'リセット',
        'distributors.empty': '販売者がいません',
        'distributors.modal_new': '新規販売者',
        'distributors.modal_edit': '販売者編集',

        // Audit
        'audit.title': '監査ログ',
        'audit.subtitle': 'Audit Logs',
        'audit.all_actions': '全アクション',
        'audit.start_date': '開始日',
        'audit.end_date': '終了日',
        'audit.search': '検索',
        'audit.list': '監査ログ',
        'audit.id': 'ID',
        'audit.actor': '実行者',
        'audit.action': 'アクション',
        'audit.resource': 'リソース',
        'audit.resource_id': 'リソースID',
        'audit.details': '詳細',
        'audit.ip': 'IP',
        'audit.date': '日時',
        'audit.empty': 'ログがありません',

        // Auth
        'auth.login': 'ログイン',
        'auth.logging_in': 'ログイン中...',
        'auth.username': 'ユーザー名',
        'auth.password': 'パスワード',
        'auth.token': 'API Token',
        'auth.token_login': 'トークンでログイン',
        'auth.password_login': 'パスワードでログイン',
        'auth.2fa_title': '2段階認証',
        'auth.2fa_code': '認証コード (6桁)',
        'auth.2fa_verify': '認証',
        'auth.2fa_verifying': '認証中...',
        'auth.change_password': 'パスワード変更',
        'auth.current_password': '現在のパスワード',
        'auth.new_password': '新しいパスワード',
        'auth.2fa_settings': '2FA 設定',
        'auth.2fa_enable': '2FAを有効にする',
        'auth.2fa_disable': '2FAを無効にする',
        'auth.2fa_scan_qr': 'Authenticatorアプリでスキャン:',
        'auth.2fa_enter_code': 'アプリに表示されたコードを入力:',

        // Common
        'common.save': '保存',
        'common.cancel': 'キャンセル',
        'common.delete': '削除',
        'common.search': '検索...',
        'common.loading': '読み込み中...',
        'common.prev': '前へ',
        'common.next': '次へ',
        'common.confirm': '確認',
        'common.admin': '管理者',
        'common.error': 'エラー',
        'common.success': '成功',

        // Error messages
        'error.connection': 'サーバーに接続できません',
        'error.invalid_token': 'トークンを入力してください',
        'error.login_failed': 'ログインに失敗しました',
        'error.csv_failed': 'CSV出力に失敗しました',
        'error.required_name': '名前は必須です',

        // Confirmations
        'confirm.deliver': 'この注文を配達完了にしますか？',
        'confirm.cancel_order': 'この注文をキャンセルしますか？',
        'confirm.delete_product': '商品 {sku} を削除しますか？この操作は取り消せません。',
        'confirm.reset_token': 'トークンをリセットしますか？旧トークンは無効になります。',

        // Prompts
        'prompt.tracking': 'トラッキング番号を入力してください:',

        // Reports
        'nav.reports': 'レポート',
        'reports.title': 'レポート',
        'reports.subtitle': 'Reports & Analytics',
        'reports.profit_analysis': '利益分析',
        'reports.platform_comparison': 'プラットフォーム比較',
        'reports.trend_comparison': 'トレンド比較',
        'reports.custom_report': 'カスタムレポート',
        'reports.revenue': '売上',
        'reports.cost': '原価',
        'reports.profit': '利益',
        'reports.margin': '利益率',
        'reports.commission': '手数料',
        'reports.avg_order': '平均注文額',
        'reports.order_count': '注文数',
        'reports.top_product': 'トップ商品',
        'reports.growth': '成長率',
        'reports.current_period': '今期',
        'reports.previous_period': '前期',
        'reports.no_data': 'データがありません',
        'reports.dimensions': 'ディメンション',
        'reports.metrics': '指標',
        'reports.start_date': '開始日',
        'reports.end_date': '終了日',
        'reports.generate': '生成',
        'reports.export_csv': 'CSV出力',
        'reports.by_product': '商品別',
        'reports.by_platform': 'プラットフォーム別',
        'reports.delivered_count': '配達完了',
        'reports.cancelled_count': 'キャンセル',
        'reports.cancel_rate': 'キャンセル率',
    },

    en: {
        // Navigation
        'nav.dashboard': 'Dashboard',
        'nav.orders': 'Orders',
        'nav.inventory': 'Inventory',
        'nav.wallet': 'Wallet',
        'nav.commissions': 'Commissions',
        'nav.invoices': 'Invoices',
        'nav.distributors': 'Distributors',
        'nav.audit': 'Audit Logs',
        'nav.logout': 'Logout',
        'nav.system_online': 'System Online',

        // Dashboard
        'dashboard.title': 'Dashboard',
        'dashboard.subtitle': 'Keep Data Flow Platform',
        'dashboard.revenue': 'Monthly Revenue',
        'dashboard.active_orders': 'Active Orders',
        'dashboard.products': 'Products',
        'dashboard.distributors_count': 'Distributors',
        'dashboard.order_trend': 'Order Trend',
        'dashboard.by_platform': 'By Platform',
        'dashboard.recent_orders': 'Recent Orders',
        'dashboard.view_all': 'View All →',
        'dashboard.no_data': 'No data available',
        'dashboard.7d': '7D',
        'dashboard.30d': '30D',
        'dashboard.90d': '90D',

        // Orders
        'orders.title': 'Orders',
        'orders.subtitle': 'Orders Management',
        'orders.all_platforms': 'All Platforms',
        'orders.all_statuses': 'All Statuses',
        'orders.export_csv': 'Export CSV',
        'orders.sync': 'Sync',
        'orders.id': 'Order ID',
        'orders.platform': 'Platform',
        'orders.order_number': 'Order #',
        'orders.status': 'Status',
        'orders.amount': 'Amount',
        'orders.tax': 'Tax',
        'orders.date': 'Date',
        'orders.actions': 'Actions',
        'orders.empty': 'No orders found',
        'orders.ship': 'Ship',
        'orders.deliver': 'Deliver',
        'orders.cancel': 'Cancel',

        // Inventory
        'inventory.title': 'Inventory',
        'inventory.subtitle': 'Inventory & Products',
        'inventory.add_product': 'Add Product',
        'inventory.inbound': 'Inbound',
        'inventory.sku': 'SKU',
        'inventory.name_jp': 'Name (JP)',
        'inventory.name_cn': 'Name (CN)',
        'inventory.cost_price': 'Cost',
        'inventory.tax_category': 'Tax',
        'inventory.stock': 'Stock',
        'inventory.empty': 'No products found',
        'inventory.loading': 'Loading products...',
        'inventory.edit': 'Edit',
        'inventory.delete': 'Delete',
        'inventory.tax_standard': 'Standard (10%)',
        'inventory.tax_reduced': 'Reduced (8%)',

        // Wallet
        'wallet.title': 'Wallet',
        'wallet.subtitle': 'Distributor Wallet',
        'wallet.available': 'Available Balance',
        'wallet.available_sub': 'Available Balance',
        'wallet.frozen': 'Frozen',
        'wallet.frozen_sub': 'Frozen for Orders',
        'wallet.total': 'Total Assets',
        'wallet.total_sub': 'Total Assets',
        'wallet.deposit': 'Deposit',
        'wallet.history': 'Transaction History',
        'wallet.tx_id': 'ID',
        'wallet.tx_type': 'Type',
        'wallet.tx_amount': 'Amount',
        'wallet.tx_order': 'Related Order',
        'wallet.tx_snapshot': 'Balance Snapshot',
        'wallet.tx_date': 'Date',
        'wallet.empty': 'No transactions found',

        // Commissions
        'commissions.title': 'Commissions',
        'commissions.subtitle': 'Commission Management',
        'commissions.rates': 'Commission Rates',
        'commissions.rate_sku': 'SKU',
        'commissions.rate_platform': 'Platform',
        'commissions.rate_value': 'Rate',
        'commissions.rates_empty': 'No commission rates',
        'commissions.history': 'Settlement History',
        'commissions.hist_id': 'ID',
        'commissions.hist_order': 'Order ID',
        'commissions.hist_sku': 'SKU',
        'commissions.hist_platform': 'Platform',
        'commissions.hist_qty': 'Qty',
        'commissions.hist_price': 'Price',
        'commissions.hist_amount': 'Commission',
        'commissions.hist_status': 'Status',
        'commissions.hist_date': 'Date',
        'commissions.empty': 'No settlements found',
        'commissions.status_pending': 'Pending',
        'commissions.status_settled': 'Settled',
        'commissions.status_failed': 'Failed',

        // Invoices
        'invoices.title': 'Invoices',
        'invoices.subtitle': 'Invoice Management',
        'invoices.list': 'Invoice List',
        'invoices.id': 'ID',
        'invoices.number': 'Invoice #',
        'invoices.order_id': 'Order ID',
        'invoices.platform': 'Platform',
        'invoices.amount': 'Amount',
        'invoices.date': 'Issue Date',
        'invoices.actions': 'Actions',
        'invoices.detail': 'Detail',
        'invoices.empty': 'No invoices found',
        'invoices.detail_title': 'Invoice Detail',
        'invoices.loading': 'Loading...',

        // Distributors
        'distributors.title': 'Distributors',
        'distributors.subtitle': 'Distributor Management',
        'distributors.add': 'New',
        'distributors.list': 'Distributor List',
        'distributors.id': 'ID',
        'distributors.name': 'Name',
        'distributors.role': 'Role',
        'distributors.balance': 'Balance',
        'distributors.frozen': 'Frozen',
        'distributors.tax_reg': 'Tax Reg #',
        'distributors.created': 'Created',
        'distributors.actions': 'Actions',
        'distributors.edit': 'Edit',
        'distributors.reset_token': 'Reset',
        'distributors.empty': 'No distributors found',
        'distributors.modal_new': 'New Distributor',
        'distributors.modal_edit': 'Edit Distributor',

        // Audit
        'audit.title': 'Audit Logs',
        'audit.subtitle': 'Audit Logs',
        'audit.all_actions': 'All Actions',
        'audit.start_date': 'Start Date',
        'audit.end_date': 'End Date',
        'audit.search': 'Search',
        'audit.list': 'Audit Logs',
        'audit.id': 'ID',
        'audit.actor': 'Actor',
        'audit.action': 'Action',
        'audit.resource': 'Resource',
        'audit.resource_id': 'Resource ID',
        'audit.details': 'Details',
        'audit.ip': 'IP',
        'audit.date': 'Date',
        'audit.empty': 'No logs found',

        // Auth
        'auth.login': 'Login',
        'auth.logging_in': 'Logging in...',
        'auth.username': 'Username',
        'auth.password': 'Password',
        'auth.token': 'API Token',
        'auth.token_login': 'Login with Token',
        'auth.password_login': 'Login with Password',
        'auth.2fa_title': 'Two-Factor Authentication',
        'auth.2fa_code': 'Auth Code (6 digits)',
        'auth.2fa_verify': 'Verify',
        'auth.2fa_verifying': 'Verifying...',
        'auth.change_password': 'Change Password',
        'auth.current_password': 'Current Password',
        'auth.new_password': 'New Password',
        'auth.2fa_settings': '2FA Settings',
        'auth.2fa_enable': 'Enable 2FA',
        'auth.2fa_disable': 'Disable 2FA',
        'auth.2fa_scan_qr': 'Scan with Authenticator app:',
        'auth.2fa_enter_code': 'Enter the code from your app:',

        // Common
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.search': 'Search...',
        'common.loading': 'Loading...',
        'common.prev': 'Prev',
        'common.next': 'Next',
        'common.confirm': 'Confirm',
        'common.admin': 'Admin',
        'common.error': 'Error',
        'common.success': 'Success',

        // Error messages
        'error.connection': 'Cannot connect to server',
        'error.invalid_token': 'Please enter a token',
        'error.login_failed': 'Login failed',
        'error.csv_failed': 'CSV export failed',
        'error.required_name': 'Name is required',

        // Confirmations
        'confirm.deliver': 'Mark this order as delivered?',
        'confirm.cancel_order': 'Cancel this order?',
        'confirm.delete_product': 'Delete product {sku}? This cannot be undone.',
        'confirm.reset_token': 'Reset token? The old token will be invalidated.',

        // Prompts
        'prompt.tracking': 'Enter tracking number:',

        // Reports
        'nav.reports': 'Reports',
        'reports.title': 'Reports',
        'reports.subtitle': 'Reports & Analytics',
        'reports.profit_analysis': 'Profit Analysis',
        'reports.platform_comparison': 'Platform Comparison',
        'reports.trend_comparison': 'Trend Comparison',
        'reports.custom_report': 'Custom Report',
        'reports.revenue': 'Revenue',
        'reports.cost': 'Cost',
        'reports.profit': 'Profit',
        'reports.margin': 'Margin',
        'reports.commission': 'Commission',
        'reports.avg_order': 'Avg Order Value',
        'reports.order_count': 'Order Count',
        'reports.top_product': 'Top Product',
        'reports.growth': 'Growth',
        'reports.current_period': 'Current Period',
        'reports.previous_period': 'Previous Period',
        'reports.no_data': 'No data available',
        'reports.dimensions': 'Dimensions',
        'reports.metrics': 'Metrics',
        'reports.start_date': 'Start Date',
        'reports.end_date': 'End Date',
        'reports.generate': 'Generate',
        'reports.export_csv': 'Export CSV',
        'reports.by_product': 'By Product',
        'reports.by_platform': 'By Platform',
        'reports.delivered_count': 'Delivered',
        'reports.cancelled_count': 'Cancelled',
        'reports.cancel_rate': 'Cancel Rate',
    },

    zh: {
        // Navigation
        'nav.dashboard': '仪表板',
        'nav.orders': '订单管理',
        'nav.inventory': '库存管理',
        'nav.wallet': '钱包',
        'nav.commissions': '佣金管理',
        'nav.invoices': '发票',
        'nav.distributors': '分销商管理',
        'nav.audit': '审计日志',
        'nav.logout': '退出登录',
        'nav.system_online': '系统在线',

        // Dashboard
        'dashboard.title': '仪表板',
        'dashboard.subtitle': 'Keep Data Flow 平台',
        'dashboard.revenue': '本月销售额',
        'dashboard.active_orders': '活跃订单',
        'dashboard.products': '商品数',
        'dashboard.distributors_count': '分销商',
        'dashboard.order_trend': '订单趋势',
        'dashboard.by_platform': '按平台',
        'dashboard.recent_orders': '最近订单',
        'dashboard.view_all': '查看全部 →',
        'dashboard.no_data': '暂无数据',
        'dashboard.7d': '7天',
        'dashboard.30d': '30天',
        'dashboard.90d': '90天',

        // Orders
        'orders.title': '订单管理',
        'orders.subtitle': '订单管理',
        'orders.all_platforms': '全部平台',
        'orders.all_statuses': '全部状态',
        'orders.export_csv': '导出CSV',
        'orders.sync': '同步',
        'orders.id': '订单ID',
        'orders.platform': '平台',
        'orders.order_number': '订单号',
        'orders.status': '状态',
        'orders.amount': '金额',
        'orders.tax': '税额',
        'orders.date': '日期',
        'orders.actions': '操作',
        'orders.empty': '暂无订单数据',
        'orders.ship': '发货',
        'orders.deliver': '确认收货',
        'orders.cancel': '取消',

        // Inventory
        'inventory.title': '库存管理',
        'inventory.subtitle': '库存与商品',
        'inventory.add_product': '添加商品',
        'inventory.inbound': '入库登记',
        'inventory.sku': 'SKU',
        'inventory.name_jp': '商品名 (日)',
        'inventory.name_cn': '商品名 (中)',
        'inventory.cost_price': '成本价',
        'inventory.tax_category': '税类',
        'inventory.stock': '库存',
        'inventory.empty': '暂无商品数据',
        'inventory.loading': '加载商品数据中...',
        'inventory.edit': '编辑',
        'inventory.delete': '删除',
        'inventory.tax_standard': '标准税率 (10%)',
        'inventory.tax_reduced': '减免税率 (8%)',

        // Wallet
        'wallet.title': '钱包',
        'wallet.subtitle': '分销商钱包',
        'wallet.available': '可用余额',
        'wallet.available_sub': '可用余额',
        'wallet.frozen': '冻结中',
        'wallet.frozen_sub': '订单冻结',
        'wallet.total': '总资产',
        'wallet.total_sub': '总资产',
        'wallet.deposit': '充值',
        'wallet.history': '交易记录',
        'wallet.tx_id': 'ID',
        'wallet.tx_type': '类型',
        'wallet.tx_amount': '金额',
        'wallet.tx_order': '关联订单',
        'wallet.tx_snapshot': '余额快照',
        'wallet.tx_date': '日期',
        'wallet.empty': '暂无交易记录',

        // Commissions
        'commissions.title': '佣金管理',
        'commissions.subtitle': '佣金管理',
        'commissions.rates': '佣金费率',
        'commissions.rate_sku': 'SKU',
        'commissions.rate_platform': '平台',
        'commissions.rate_value': '费率',
        'commissions.rates_empty': '暂无费率数据',
        'commissions.history': '结算记录',
        'commissions.hist_id': 'ID',
        'commissions.hist_order': '订单ID',
        'commissions.hist_sku': 'SKU',
        'commissions.hist_platform': '平台',
        'commissions.hist_qty': '数量',
        'commissions.hist_price': '单价',
        'commissions.hist_amount': '佣金',
        'commissions.hist_status': '状态',
        'commissions.hist_date': '日期',
        'commissions.empty': '暂无结算记录',
        'commissions.status_pending': '待结算',
        'commissions.status_settled': '已结算',
        'commissions.status_failed': '失败',

        // Invoices
        'invoices.title': '发票',
        'invoices.subtitle': '发票管理',
        'invoices.list': '发票列表',
        'invoices.id': 'ID',
        'invoices.number': '发票号',
        'invoices.order_id': '订单ID',
        'invoices.platform': '平台',
        'invoices.amount': '金额',
        'invoices.date': '开票日期',
        'invoices.actions': '操作',
        'invoices.detail': '详情',
        'invoices.empty': '暂无发票',
        'invoices.detail_title': '发票详情',
        'invoices.loading': '加载中...',

        // Distributors
        'distributors.title': '分销商管理',
        'distributors.subtitle': '分销商管理',
        'distributors.add': '新建',
        'distributors.list': '分销商列表',
        'distributors.id': 'ID',
        'distributors.name': '名称',
        'distributors.role': '角色',
        'distributors.balance': '余额',
        'distributors.frozen': '冻结',
        'distributors.tax_reg': '税号',
        'distributors.created': '创建日期',
        'distributors.actions': '操作',
        'distributors.edit': '编辑',
        'distributors.reset_token': '重置',
        'distributors.empty': '暂无分销商',
        'distributors.modal_new': '新建分销商',
        'distributors.modal_edit': '编辑分销商',

        // Audit
        'audit.title': '审计日志',
        'audit.subtitle': '审计日志',
        'audit.all_actions': '全部操作',
        'audit.start_date': '开始日期',
        'audit.end_date': '结束日期',
        'audit.search': '搜索',
        'audit.list': '审计日志',
        'audit.id': 'ID',
        'audit.actor': '执行者',
        'audit.action': '操作',
        'audit.resource': '资源',
        'audit.resource_id': '资源ID',
        'audit.details': '详情',
        'audit.ip': 'IP',
        'audit.date': '日期',
        'audit.empty': '暂无日志',

        // Auth
        'auth.login': '登录',
        'auth.logging_in': '登录中...',
        'auth.username': '用户名',
        'auth.password': '密码',
        'auth.token': 'API Token',
        'auth.token_login': 'Token 登录',
        'auth.password_login': '密码登录',
        'auth.2fa_title': '两步验证',
        'auth.2fa_code': '验证码 (6位)',
        'auth.2fa_verify': '验证',
        'auth.2fa_verifying': '验证中...',
        'auth.change_password': '修改密码',
        'auth.current_password': '当前密码',
        'auth.new_password': '新密码',
        'auth.2fa_settings': '2FA 设置',
        'auth.2fa_enable': '启用 2FA',
        'auth.2fa_disable': '停用 2FA',
        'auth.2fa_scan_qr': '使用 Authenticator 应用扫描:',
        'auth.2fa_enter_code': '输入应用中显示的验证码:',

        // Common
        'common.save': '保存',
        'common.cancel': '取消',
        'common.delete': '删除',
        'common.search': '搜索...',
        'common.loading': '加载中...',
        'common.prev': '上一页',
        'common.next': '下一页',
        'common.confirm': '确认',
        'common.admin': '管理员',
        'common.error': '错误',
        'common.success': '成功',

        // Error messages
        'error.connection': '无法连接服务器',
        'error.invalid_token': '请输入Token',
        'error.login_failed': '登录失败',
        'error.csv_failed': 'CSV导出失败',
        'error.required_name': '名称为必填项',

        // Confirmations
        'confirm.deliver': '确认此订单已送达？',
        'confirm.cancel_order': '确认取消此订单？',
        'confirm.delete_product': '删除商品 {sku}？此操作不可撤销。',
        'confirm.reset_token': '确认重置Token？旧Token将失效。',

        // Prompts
        'prompt.tracking': '请输入物流单号:',

        // Reports
        'nav.reports': '报表',
        'reports.title': '报表',
        'reports.subtitle': '报表与分析',
        'reports.profit_analysis': '利润分析',
        'reports.platform_comparison': '平台对比',
        'reports.trend_comparison': '趋势对比',
        'reports.custom_report': '自定义报表',
        'reports.revenue': '销售额',
        'reports.cost': '成本',
        'reports.profit': '利润',
        'reports.margin': '利润率',
        'reports.commission': '佣金',
        'reports.avg_order': '平均订单金额',
        'reports.order_count': '订单数',
        'reports.top_product': '热销商品',
        'reports.growth': '增长率',
        'reports.current_period': '本期',
        'reports.previous_period': '上期',
        'reports.no_data': '暂无数据',
        'reports.dimensions': '维度',
        'reports.metrics': '指标',
        'reports.start_date': '开始日期',
        'reports.end_date': '结束日期',
        'reports.generate': '生成',
        'reports.export_csv': '导出CSV',
        'reports.by_product': '按商品',
        'reports.by_platform': '按平台',
        'reports.delivered_count': '已送达',
        'reports.cancelled_count': '已取消',
        'reports.cancel_rate': '取消率',
    },
}

let currentLang = localStorage.getItem('erp_lang') || 'ja'

/**
 * Get translation for key, with optional parameter substitution
 * @param {string} key - Translation key (e.g. 'nav.dashboard')
 * @param {object} params - Optional parameters for substitution (e.g. {sku: 'ABC'})
 * @returns {string} Translated string, or key as fallback
 */
function t(key, params) {
    let text = (translations[currentLang] && translations[currentLang][key])
        || translations.ja[key]
        || key
    if (params) {
        Object.keys(params).forEach(k => {
            text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k])
        })
    }
    return text
}

/**
 * Set the active language and apply translations
 */
function setLanguage(lang) {
    if (!translations[lang]) return
    currentLang = lang
    localStorage.setItem('erp_lang', lang)
    applyTranslations()
    // Save to server (silent)
    const token = localStorage.getItem('erp_token')
    if (token) {
        fetch('/api/v1/auth/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ language: lang }),
        }).catch(() => {})
    }
    // Update active state on language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang)
    })
}

/**
 * Apply translations to all elements with data-i18n attributes
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n)
    })
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder)
    })
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle)
    })
}

/**
 * Initialize language from server or localStorage
 */
function initLanguage(serverLang) {
    if (serverLang && translations[serverLang]) {
        currentLang = serverLang
        localStorage.setItem('erp_lang', serverLang)
    }
    applyTranslations()
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang)
    })
}
