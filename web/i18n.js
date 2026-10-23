'use strict';
/* i18n.js — الترجمة (عربي/إنجليزي) + تنسيق الأرقام والتواريخ */

const AR = {
  app_name: 'هوم فيز', tagline: 'إدارة المباني بسهولة',
  lang_name: 'العربية', switch_lang: 'English',
  // تنقّل
  nav_sec_main: 'الرئيسية', nav_sec_money: 'الحسابات', nav_sec_people: 'السكان', nav_sec_admin: 'الإدارة',
  nav_dashboard: 'لوحة المعلومات', nav_buildings: 'المباني', nav_units: 'الشقق والمساحات', nav_residents: 'سجل السكان',
  nav_rates: 'بنود الرسوم', nav_dues: 'الرسوم الشهرية', nav_payments: 'الدفعات', nav_misc: 'إيرادات أخرى',
  nav_expenses: 'المصروفات', nav_reminders: 'التذكيرات', nav_reports: 'التقارير', nav_users: 'المستخدمون', nav_settings: 'الإعدادات',
  nav_myaccount: 'كشف حسابي',
  // عام
  dashboard: 'لوحة المعلومات', buildings: 'المباني', building: 'مبنى', units: 'الوحدات', unit: 'وحدة',
  residents: 'السكان', resident: 'ساكن', reports: 'التقارير', reminders: 'التذكيرات', reminders_c: 'التذكيرات',
  users: 'المستخدمون', settings: 'الإعدادات',
  save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق', edit: 'تعديل', del: 'حذف', add: 'إضافة', add_new: 'إضافة جديد',
  name: 'الاسم', code: 'الرمز', address: 'العنوان', notes: 'ملاحظات', phone: 'الهاتف', email: 'البريد',
  actions: 'إجراءات', status: 'الحالة', active: 'نشط', inactive: 'موقوف', all: 'الكل', none: 'بدون',
  date: 'التاريخ', amount: 'المبلغ', desc: 'الوصف', year: 'سنة', month: 'شهر', period: 'الفترة', search: 'بحث…',
  total: 'الإجمالي', balance: 'الرصيد', paid: 'المسدد', unpaid: 'غير مسدد', due: 'مستحق', method: 'طريقة السداد',
  cash: 'نقدي', bank: 'تحويل بنكي', online: 'أونلاين', other: 'أخرى',
  owner: 'مالك', tenant: 'مستأجر', type: 'النوع', area: 'المساحة (م²)', shares: 'الأسهم', floor: 'الدور',
  apartment: 'شقة', shop: 'محل', office: 'مكتب', parking: 'موقف',
  yes: 'نعم', no: 'لا', none_f: '—', loading: 'جارٍ التحميل…',
  money: 'مبلغ', currency: 'العملة', org_name: 'اسم المنظمة',
  print: 'طباعة', export_csv: 'تصدير CSV', backup: 'نسخة احتياطية', restore: 'استرجاع',
  confirm_delete: 'هل أنت متأكد من الحذف؟ لا يمكن التراجع.',
  confirm_building_force: 'المبنى يحتوي وحدات وبيانات مالية. الحذف سيحذف كل شيء نهائياً. متابعة؟',
  confirm_unit_force: 'الوحدة عليها حركات مالية. الحذف سيمسح فواتيرها ودفعاتها. متابعة؟',
  // شاشة الدخول
  login_title: 'تسجيل الدخول', login_user: 'اسم المستخدم', login_pass: 'كلمة المرور',
  login_btn: 'دخول', login_failed: 'اسم المستخدم أو كلمة المرور غير صحيحة',
  login_hint: 'الحساب الافتراضي: admin / admin123 — يُنصح بتغييره بعد أول دخول',
  logout: 'تسجيل الخروج', change_pass: 'تغيير كلمة المرور', old_pass: 'كلمة المرور الحالية', new_pass: 'كلمة المرور الجديدة',
  // لوحة
  stat_buildings: 'المباني', stat_units: 'الوحدات', stat_residents: 'السكان النشطون',
  stat_fund: 'رصيد الصندوق (الصافي)', stat_income: 'الدخل المحصّل', stat_expenses: 'المصروفات', stat_net: 'الصافي',
  stat_arrears: 'متأخرات إجمالية',
  month_progress: 'تحصيل رسوم الشهر', of_collected: 'محصّل من', this_month: 'هذا الشهر',
  last_months: 'آخر 6 أشهر', income_vs_expenses: 'الدخل مقابل المصروفات',
  top_arrears: 'أعلى الأرصدة المتأتّرة', recent_moves: 'آخر الحركات', see_all: 'عرض الكل',
  empty_state_dash: 'لا توجد بيانات بعد — أضف مبنىً ورسماً ثم ولّد الرسوم',
  alert_fund_low: 'رصيد الصندوق أقل من الحد الأدنى المحدد', alert_arrears: 'وحدات عليها متأخرات بأجمالي',
  alert_reminder: 'تذكير قريب:',
  move_payment: 'دفعة', move_expense: 'مصروف', move_misc: 'إيراد',
  demo_welcome: 'بدء سريع: حمّل بيانات تجريبية لتجربة كل الميزات فوراً',
  btn_load_demo: 'تحميل بيانات تجريبية',
  // مبانٍ
  buildings_c: 'المباني', new_building: 'مبنى جديد', units_count: 'عدد الوحدات', collected: 'المحصّل',
  invoiced: 'المستحق', expenses_billed: 'مشاركة المصروفات', delete_building: 'حذف المبنى',
  no_buildings: 'لا توجد مبانٍ — أضف أول مبنى للبدء',
  // وحدات
  units_c: 'الشقق والمساحات', new_unit: 'وحدة جديدة', unit_of: 'المبنى', curr_resident: 'الساكن الحالي',
  no_units: 'لا توجد وحدات', perm: 'الأسهم (حصة من المصروفات)',
  // سكان
  residents_c: 'سجل السكان', new_resident: 'ساكن جديد', join_date: 'تاريخ الدخول', leave_date: 'تاريخ الخروج',
  active_res: 'نشط', no_residents: 'لا يوجد سكان', rel: 'الصفة', role_owner: 'مالك', role_tenant: 'مستأجر',
  // بنود الرسوم
  rates_c: 'بنود الرسوم الشهرية', new_rate: 'بند جديد', rate_amount: 'المبلغ الشهري (لكل وحدة/للمبنى)',
  rate_vacant: 'مبلغ الوحدة المتروكة (اختياري)',
  rate_vacant_hint: 'حدّد هذا المبلغ ليصبح البند بمبلغين: الوحدة المأهولة (بها ساكن) تدفع المبلغ الكامل لكل وحدة، والمتروكة/الفارغة تدفع المبلغ المخفف لكل وحدة. اتركه فارغاً للتوزيع التقليدي على المبنى كاملاً.',
  vacant_col: 'المتروكة',
  fund_status: 'وضع صندوق المبنى هذا العام', fund_collected: 'المحصّل (سدادات + إيرادات)',
  fund_spent: 'المصروف', fund_balance: 'الرصيد الحالي', recent_expenses: 'آخر مصروفات المبنى',
  no_expenses: 'لا توجد مصروفات مسجلة بعد لمبناك',
  dist: 'أساس التوزيع', dist_equal: 'بالترتُّب / لكل وحدة بالتساوي', dist_shares: 'حسب الأسهم', dist_area: 'حسب المساحة',
  no_rates: 'لا توجد بنود رسوم — أضف بنداً مثل «اشتراك الصيانة الشهرية»',
  rate_in_use: 'لا يمكن حذف بند مُستخدم في فواتير — عطّله بدلاً من الحذف',
  dist_hint: '«لكل وحدة بالتساوي» يوزّع المبلغ مقسوماً بعدد الوحدات. «الأسهم/المساحة» يوزّع متناسباً.',
  // الرسوم الشهرية
  dues_c: 'الرسوم الشهرية', generate: 'توليد الرسوم', regen_period: 'حذف فترة وإعادة التوليد',
  already_generated: 'تم توليد هذه الفترة مسبقاً', not_generated: 'لم تُولَّد بعد — اضغط «توليد الرسوم»',
  unit_code: 'رمز الوحدة', resident: 'الساكن', invoice: 'الفاتورة', inv_paid: 'مدفوعة',
  inv_part: 'جزئية', inv_open: 'مفتوحة', pay_now: 'سدد الآن', dues_total: 'إجمالي هذه الفترة',
  future_period: 'لا يمكن التوليد لشهر مستقبلي', relaunched_ok: 'تم التوليد',
  delete_period_warn: 'سيتم حذف جميع فواتير هذه الفترة (للأشهر التي لا توجد عليها دفعات). متابعة؟',
  period_has_payments: 'في هذه الفترة دفعات مرتبطة بفواتير — لا حذف مرتّب',
  // الدفعات
  payments_c: 'الدفعات', new_payment: 'دفعة جديدة', pay_unit: 'الوحدة الساكنة', link_invoice: 'اربطها بفاتورة (اختياري)',
  pay_to_invoice: 'دين يُسجَّل للفاتورة', receipt_no: 'رقم السند', add_payment: 'تسجيل الدفعة',
  no_payments: 'لا توجد دفعات في النطاق المحدد',
  // إيرادات أخرى
  misc_c: 'إيرادات أخرى', new_misc: 'إيراد جديد', misc_source: 'المصدر', misc_note: 'ملاحظة',
  no_misc: 'لا توجد إيرادات أخرى',
  // مصروفات
  expenses_c: 'المصروفات', new_expense: 'مصروف جديد', vendor: 'الجهة/المورد', category: 'التصنيف',
  allocate: 'يوزَّع كنسبة على السكان', do_allocate: 'وزّع على السكان', no_allocate: 'لا توزَّع (تشغيلي فقط)',
  new_category: 'تصنيف جديد', categories: 'التصنيفات', no_expenses: 'لا توجد مصروفات في النطاق',
  manage_categories: 'إدارة التصنيفات', expected: 'المستقد',
  cats_manage: 'بنود المصروفات', rename: 'إعادة تسمية', no_categories: 'لا بنود بعد — أضف أول بند', cat_in_use: 'هذا البند مرتبط بمصروفات مسجلة — لا يمكن حذفه',
  busy_try_again: 'قاعدة البيانات مشغولة لحظيًا — أعد المحاولة بعد ثوانٍ',
  perm_edit: 'صلاحية التعديل', perm_edit_hint: 'يسمح للساكن بتسجيل دفعة أو مصروف أو إيرادًا لنطاق وحدته هو فقط', perm_viewonly: 'مشاهدة فقط', perm_canedit: 'مشاهدة + تسجيل', perm_actions: 'تسجيل حركة جديدة',
  // تذكيرات
  reminders_c: 'التذكيرات', new_reminder: 'تذكير جديد', due_on: 'تاريخ الاستحقاق', repeat: 'التكرار',
  repeat_none: 'مرة واحدة', repeat_monthly: 'شهري', repeat_yearly: 'سُنوي', done: 'منتهي', mark_done: 'تم التنفيذ',
  mark_open: 'إعادة فتح', overdue: 'متأخر', today: 'اليوم', upcoming: 'قريب', all_buildings: 'عام (كل المباني)',
  no_reminders: 'لا توجد تذكيرات', reminder_title: 'عنوان التذكير', building_general: 'المبنى (أو عام)',
  // تقارير
  reports_c: 'التقارير', tab_summary: 'الملخص المالي', tab_categories: 'تصنيفات المصروفات', tab_arrears: 'المتأخرات',
  tab_statement: 'كشف وحدة', from: 'من', to: 'إلى', t_income: 'إجمالي الدخل', t_expenses: 'إجمالي المصروفات',
  t_net: 'الصافي', month_income: 'دخل الشهر', month_net: 'صافي الشهر', cumulative: 'التراكمي',
  pick_statement_unit: 'اختر وحدة لعرض كشوفها', statement_for: 'كشف حساب وحدة', running: 'الجاري',
  statement_leb_invoice: 'فاتورة رسوم', statement_leb_pay: 'دفعة سداد', statement_leb_share: 'حصة مصروف',
  share_note: 'تُحتسب حصة الوحدة من المصروفات الموزّعة حسب أسهمها الحالية.',
  oldest_unpaid: 'أقدم فاتورة غير مسددة', arrears_total: 'إجمالي المتأخرات', count_units: 'عدد الوحدات',
  no_reports_data: 'أضف حركات أولاً لرؤية التقارير',
  // مستخدمون
  users_c: 'إدارة المستخدمين', new_user: 'مستخدم جديد', username: 'اسم المستخدم', role: 'الصلاحية',
  role_admin: 'مدير عام', role_manager: 'مدير', role_resident: 'ساكن', linked_unit: 'الوحدة المرتبطة (للساكن)',
  password: 'كلمة المرور', reset_password: 'إعادة تعيين', cannot_delete_self: 'لا تحذف نفسك', last_admin: 'لا يوجد سوى مدير عام واحد',
  resident_needs_unit: 'حساب الساكن يلزم ربطه بوحدة',
  // إعدادات
  settings_c: 'الإعدادات', pref_general: 'عامة', pref_data: 'البيانات', pref_account: 'حسابك',
  min_fund: 'الحد الأدنى لرصيد الصندوق (تنبيه)', min_fund_hint: 'القيمة بالعملة الأساسية. 0 = معطّل',
  download_backup: 'تنزيل نسخة احتياطية (SQLite)', restore_db: 'استرجاع من ملف قاعدة بيانات',
  restore_warn: 'الاسترجاع يستبدل القاعدة الحالية بالكامل! نُحفظ نسخة أمان تلقائياً. متابعة؟',
  demo_clear: 'مسح جميع البيانات (الأبنية والمالية)', demo_clear_warn: 'سيتم حذف كل المباني والسكان والحركات نهائياً. متابعة؟',
  type_wipe: 'للتأكيد النهائي: اكتب كلمة «مسح» هنا', wipe_now: 'نعم، امسح نهائياً',
  wipe_cancelled: 'التأكيد غير مطابق — لم يُمح شيء', wipe_done_backup: 'تم المسح — وحُفظت نسخة احتياطية قبل المسح في مجلد backups بجانب القاعدة',
  page_error: 'تعذر عرض هذه الصفحة — جرّب إعادة التحميل', retry: 'إعادة المحاولة',
  occ_col: 'الإشغال', occ_occ: 'مأهولة', occ_vac: 'متروكة',
  occ_to_vac_hint: 'اضغط لتحويلها إلى متروكة (تدفع مبلغ التخفيف في الشهور القادمة)', occ_to_occ_hint: 'اضغط لإضافة ساكن فتصبح مأهولة (تدفع المبلغ الكامل)',
  occ_vacate_confirm: 'ستتوقف سكان هذه الوحدة لتصبح متروكة', occ_add_resident: 'ساكن جديد للوحدة',
  active_res: 'ساكن مفعّل (الوحدة مأهولة)',
  rate_used_title: 'بند له فواتير سابقة', rate_in_use_choice: 'هذا البند مرتبط بفواتير مُنشأة سابقًا. اختر ما يناسبك:', rate_stop_only: 'إيقاف البند فقط (الأفضل)', rate_stopped: 'تم إيقاف البند — لن يُولَّد في الشهور القادمة',
  rate_force_delete: 'حذف البند مع الفواتير غير المسددة', rate_force_confirm: 'سيُحذف البند نهائيًا مع فواتيره غير المسددة، والفواتير المسددة تبقى في السجل باسم «بند محذوف». متابعة؟', rate_force_done: 'تم الحذف — فواتير غير مسددة أُزيلت:',
  saved: 'تم الحفظ', lang_default: 'اللغة الافتراضية',
  share_note_web: 'خادم هوم فيز يعمل محلياً على المنفذ',
  web_share: 'للمشاركة عبر الإنترنت أو الشبكة، شارك عنوان هذا الجهاز مع المستخدمين (مثال: http://192.168.1.10:4751).',
  // رسائل خطأ
  err: 'خطأ', user_disabled: 'الحساب موقوف', unauthorized: 'انتهت الجلسة — دخِل من جديد',
  forbidden_admin: 'هذه الصفحة للإدارة العامة فقط', bad_building: 'المبنى غير موجود', bad_unit: 'الوحدة غير موجودة',
  bad_period: 'فترة غير صحيحة', unit_code_taken: 'رمز الوحدة مستخدم في هذا المبنى',
  rate_name_taken: 'اسم البند موجود مسبقاً', username_taken: 'اسم المستخدم موجود مسبقاً',
  building_not_empty: 'المبنى غير فارغ — استخدم «حذف مع كل البيانات» للتأكيد', force: 'حذف نهائي مع البيانات',
  unit_has_transactions: 'الوحدة عليها حركات مالية', invoice_has_payments: 'توجد دفعات مرتبطة بهذه الفواتير',
  bad_credentials: 'بيانات الدخول غير صحيحة', weak_password: 'كلمة المرور قصيرة (6 على الأقل)',
  server_error: 'خطأ في الخادم', cat_in_use: 'التصنيف مُستخدم في مصروفات',
  db_restored: 'تم استرجاع القاعدة بنجاح', no_unit_linked: 'حسابك غير مرتبط بوحدة',
  invalid_db_file: 'الملف ليس قاعدة بيانات SQLite صالحة',
  claim_month: 'شهر', claim_paid: 'محسّل', claim_remaining: 'متبقٍ',
  none_yet: 'لا بيانات', scope_all: 'كل المباني', change: 'تغيير',
  details: 'التفاصيل', unit_tenant: 'مستأجر حالياً', no_tax_note: 'المبالغ بالعملة المحلية'
};

const EN = {
  app_name: 'HomeFees', tagline: 'Building management made simple',
  lang_name: 'العربية', switch_lang: 'العربية',
  nav_sec_main: 'Main', nav_sec_money: 'Finance', nav_sec_people: 'People', nav_sec_admin: 'Admin',
  nav_dashboard: 'Dashboard', nav_buildings: 'Buildings', nav_units: 'Units & Spaces', nav_residents: 'Residents',
  nav_rates: 'Fee Items', nav_dues: 'Monthly Dues', nav_payments: 'Payments', nav_misc: 'Other Income',
  nav_expenses: 'Expenses', nav_reminders: 'Reminders', nav_reports: 'Reports', nav_users: 'Users', nav_settings: 'Settings',
  nav_myaccount: 'My Statement',
  dashboard: 'Dashboard', buildings: 'Buildings', building: 'Building', units: 'Units', unit: 'Unit',
  residents: 'Residents', resident: 'Resident', reports: 'Reports', reminders: 'Reminders', reminders_c: 'Reminders',
  users: 'Users', settings: 'Settings',
  save: 'Save', cancel: 'Cancel', close: 'Close', edit: 'Edit', del: 'Delete', add: 'Add', add_new: 'Add new',
  name: 'Name', code: 'Code', address: 'Address', notes: 'Notes', phone: 'Phone', email: 'Email',
  actions: 'Actions', status: 'Status', active: 'Active', inactive: 'Disabled', all: 'All', none: 'None',
  date: 'Date', amount: 'Amount', desc: 'Description', year: 'Year', month: 'Month', period: 'Period', search: 'Search…',
  total: 'Total', balance: 'Balance', paid: 'Paid', unpaid: 'Unpaid', due: 'Due', method: 'Payment method',
  cash: 'Cash', bank: 'Bank transfer', online: 'Online', other: 'Other',
  owner: 'Owner', tenant: 'Tenant', type: 'Type', area: 'Area (m²)', shares: 'Shares', floor: 'Floor',
  apartment: 'Apartment', shop: 'Shop', office: 'Office', parking: 'Parking',
  yes: 'Yes', no: 'No', none_f: '—', loading: 'Loading…',
  money: 'Amount', currency: 'Currency', org_name: 'Organization name',
  print: 'Print', export_csv: 'Export CSV', backup: 'Backup', restore: 'Restore',
  confirm_delete: 'Are you sure? This cannot be undone.',
  confirm_building_force: 'This building has units and financial data. Deleting will remove everything permanently. Continue?',
  confirm_unit_force: 'This unit has financial history. Deleting will erase its invoices and payments. Continue?',
  login_title: 'Sign in', login_user: 'Username', login_pass: 'Password',
  login_btn: 'Sign in', login_failed: 'Invalid username or password',
  login_hint: 'Default account: admin / admin123 — please change it after first login',
  logout: 'Sign out', change_pass: 'Change password', old_pass: 'Current password', new_pass: 'New password',
  stat_buildings: 'Buildings', stat_units: 'Units', stat_residents: 'Active residents',
  stat_fund: 'Fund balance (net)', stat_income: 'Collected income', stat_expenses: 'Expenses', stat_net: 'Net',
  stat_arrears: 'Total arrears',
  month_progress: 'This month\'s dues collection', of_collected: 'collected of', this_month: 'this month',
  last_months: 'Last 6 months', income_vs_expenses: 'Income vs expenses',
  top_arrears: 'Top outstanding balances', recent_moves: 'Recent transactions', see_all: 'View all',
  empty_state_dash: 'No data yet — add a building, fee item, then generate dues',
  alert_fund_low: 'Fund balance is below the configured minimum', alert_arrears: 'Units with arrears totalling',
  alert_reminder: 'Upcoming reminder:',
  move_payment: 'Payment', move_expense: 'Expense', move_misc: 'Income',
  demo_welcome: 'Quick start: load demo data to try every feature instantly',
  btn_load_demo: 'Load demo data',
  buildings_c: 'Buildings', new_building: 'New building', units_count: 'Units', collected: 'Collected',
  invoiced: 'Invoiced', expenses_billed: 'Expense share', delete_building: 'Delete building',
  no_buildings: 'No buildings yet — add your first one',
  units_c: 'Units & Spaces', new_unit: 'New unit', unit_of: 'Building', curr_resident: 'Current resident',
  no_units: 'No units', perm: 'Shares (share of expenses)',
  residents_c: 'Residents', new_resident: 'New resident', join_date: 'Move-in date', leave_date: 'Move-out date',
  active_res: 'Active resident (unit is occupied)', no_residents: 'No residents', rel: 'Role', role_owner: 'Owner', role_tenant: 'Tenant',
  rates_c: 'Monthly fee items', new_rate: 'New fee item', rate_amount: 'Monthly amount (per unit / per building)',
  rate_vacant: 'Vacant-units amount (optional)',
  rate_vacant_hint: 'Set this to make the item dual-priced: an occupied unit (has an active resident) pays the full amount per unit, while a vacant/empty unit pays the reduced amount per unit. Leave empty for the classic whole-building split.',
  vacant_col: 'Vacant',
  fund_status: 'Building fund this year', fund_collected: 'Collected (payments + income)',
  fund_spent: 'Spent', fund_balance: 'Current balance', recent_expenses: 'Recent building expenses',
  no_expenses: 'No expenses recorded for your building yet',
  dist: 'Distribution basis', dist_equal: 'Split equally per unit', dist_shares: 'By shares', dist_area: 'By area',
  no_rates: 'No fee items yet — add e.g. "Monthly maintenance"',
  rate_in_use: 'Cannot delete a fee item used by invoices — deactivate it instead',
  dist_hint: '"Equal" divides the amount by all units. "Shares / Area" divides proportionally.',
  dues_c: 'Monthly dues', generate: 'Generate dues', regen_period: 'Delete period & regenerate',
  already_generated: 'This period was already generated', not_generated: 'Not generated yet — click "Generate dues"',
  unit_code: 'Unit code', resident: 'Resident', invoice: 'Invoice', inv_paid: 'Paid',
  inv_part: 'Partial', inv_open: 'Open', pay_now: 'Pay', dues_total: 'Period total',
  future_period: 'Cannot generate for a future month', relaunched_ok: 'Generated',
  delete_period_warn: 'All invoices for this period will be deleted (only when no payments are linked). Continue?',
  period_has_payments: 'This period has payments linked to invoices — deletion blocked',
  payments_c: 'Payments', new_payment: 'New payment', pay_unit: 'Unit / payer', link_invoice: 'Link to invoice (optional)',
  pay_to_invoice: 'Applied to invoice', receipt_no: 'Receipt no.', add_payment: 'Record payment',
  no_payments: 'No payments in this filter',
  misc_c: 'Other income', new_misc: 'New income entry', misc_source: 'Source', misc_note: 'Note',
  no_misc: 'No other income yet',
  expenses_c: 'Expenses', new_expense: 'New expense', vendor: 'Vendor', category: 'Category',
  allocate: 'Charged to residents as shares', do_allocate: 'Charge to residents', no_allocate: 'Operational only',
  new_category: 'New category', categories: 'Categories', no_expenses: 'No expenses in this filter',
  manage_categories: 'Manage categories', expected: 'Billed',
  cats_manage: 'Expense items', rename: 'Rename', no_categories: 'No items yet — add the first one', cat_in_use: 'This item is linked to recorded expenses — cannot be deleted',
  busy_try_again: 'Database is momentarily busy — please retry shortly',
  perm_edit: 'Editing permission', perm_edit_hint: 'Lets the resident record a payment, expense or other income — limited to their own unit', perm_viewonly: 'View only', perm_canedit: 'View + record', perm_actions: 'Record new transaction',
  reminders_c: 'Reminders', new_reminder: 'New reminder', due_on: 'Due date', repeat: 'Repeat',
  repeat_none: 'Once', repeat_monthly: 'Monthly', repeat_yearly: 'Yearly', done: 'Done', mark_done: 'Mark done',
  mark_open: 'Reopen', overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', all_buildings: 'General (all buildings)',
  no_reminders: 'No reminders', reminder_title: 'Reminder title', building_general: 'Building (or general)',
  reports_c: 'Reports', tab_summary: 'Financial summary', tab_categories: 'Expense categories', tab_arrears: 'Arrears',
  tab_statement: 'Unit statement', from: 'From', to: 'To', t_income: 'Total income', t_expenses: 'Total expenses',
  t_net: 'Net', month_income: 'Month income', month_net: 'Month net', cumulative: 'Cumulative',
  pick_statement_unit: 'Pick a unit to view its statement', statement_for: 'Unit statement', running: 'Running',
  statement_leb_invoice: 'Dues invoice', statement_leb_pay: 'Payment', statement_leb_share: 'Expense share',
  share_note: 'Unit\'s expense share is computed from its current shares.',
  oldest_unpaid: 'Oldest unpaid invoice', arrears_total: 'Total arrears', count_units: 'Units',
  no_reports_data: 'Add transactions first to see reports',
  users_c: 'Users', new_user: 'New user', username: 'Username', role: 'Role',
  role_admin: 'Administrator', role_manager: 'Manager', role_resident: 'Resident', linked_unit: 'Linked unit (for residents)',
  password: 'Password', reset_password: 'Reset', cannot_delete_self: "You can't delete yourself", last_admin: 'Only one administrator exists',
  resident_needs_unit: 'Resident accounts must be linked to a unit',
  settings_c: 'Settings', pref_general: 'General', pref_data: 'Data', pref_account: 'Your account',
  min_fund: 'Minimum fund balance (alert)', min_fund_hint: 'In primary currency units. 0 = disabled',
  download_backup: 'Download backup (SQLite)', restore_db: 'Restore from database file',
  restore_warn: 'Restoring fully replaces the current database! An automatic safety copy is kept. Continue?',
  demo_clear: 'Erase all data (buildings & finance)', demo_clear_warn: 'All buildings, residents and transactions will be deleted permanently. Continue?',
  type_wipe: 'Final confirmation: type the word «delete» here', wipe_now: 'Yes, erase permanently',
  wipe_cancelled: 'Confirmation mismatch — nothing was erased', wipe_done_backup: 'Erased — a full backup was saved in the backups folder next to the database',
  page_error: 'Couldn\'t render this page — please try reloading', retry: 'Retry',
  occ_col: 'Occupancy', occ_occ: 'Occupied', occ_vac: 'Vacant',
  occ_to_vac_hint: 'Click to mark as vacant (pays the reduced amount next months)', occ_to_occ_hint: 'Click to add a resident — becomes occupied (pays full amount)',
  occ_vacate_confirm: 'Residents of this unit will be deactivated — the unit becomes vacant', occ_add_resident: 'New resident for unit',
  rate_used_title: 'Item with existing invoices', rate_in_use_choice: 'This item is linked to previously generated invoices. Choose what suits you:', rate_stop_only: 'Deactivate only (recommended)', rate_stopped: 'Item deactivated — won\'t be generated for upcoming months',
  rate_force_delete: 'Delete item + unpaid invoices', rate_force_confirm: 'The item will be permanently erased along with its unpaid invoices; paid ones stay in the ledger as "deleted item". Continue?', rate_force_done: 'Deleted — unpaid invoices removed:',
  saved: 'Saved', lang_default: 'Default language',
  share_note_web: 'HomeFees server runs locally on port',
  web_share: 'To share over the network/internet, give users this machine\'s address (e.g. http://192.168.1.10:4751).',
  err: 'Error', user_disabled: 'Account disabled', unauthorized: 'Session expired — sign in again',
  forbidden_admin: 'Administrator access only', bad_building: 'Building not found', bad_unit: 'Unit not found',
  bad_period: 'Invalid period', unit_code_taken: 'Unit code already used in this building',
  rate_name_taken: 'Fee item name exists', username_taken: 'Username already exists',
  building_not_empty: 'Building is not empty — use "hard delete with data" to confirm', force: 'Hard delete with data',
  unit_has_transactions: 'Unit has financial transactions', invoice_has_payments: 'Payments are linked to these invoices',
  bad_credentials: 'Invalid credentials', weak_password: 'Password too short (min 6)',
  server_error: 'Server error', cat_in_use: 'Category is used by expenses',
  db_restored: 'Database restored successfully', no_unit_linked: 'Your account is not linked to a unit',
  invalid_db_file: 'Not a valid SQLite database file',
  claim_month: 'Month', claim_paid: 'Collected', claim_remaining: 'Remaining',
  none_yet: 'No data', scope_all: 'All buildings', change: 'Change',
  details: 'Details', unit_tenant: 'Currently tenant', no_tax_note: 'Amounts in local currency'
};

const DICTS = { ar: AR, en: EN };

let currentLang = 'ar';

function setLang(l) {
  currentLang = DICTS[l] ? l : 'ar';
  if (app_store_hook) app_store_hook();
}
let app_store_hook = null;
function bindStore(fn) { app_store_hook = fn; }

function t(key) {
  return DICTS[currentLang][key] ?? DICTS.ar[key] ?? key;
}

/* ---------- تنسيق ---------- */
let currencyLabel = 'ج.م';
function setCurrency(c) { currencyLabel = c || 'ج.م'; }
function locale() { return currentLang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'; }

function fmtMoney(cents) {
  const v = Number(cents || 0) / 100;
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ' + currencyLabel;
}
function fmtNum(n, digits = 0) {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(Number(n) || 0);
}
function fmtDate(d) {
  if (!d) return none_f_local();
  const dt = d.length === 10 ? new Date(d + 'T00:00:00') : null;
  if (!dt) return d;
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
}
function fmtMonth(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || none_f_local();
  const dt = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1);
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(dt);
}
function fmtDayMonth(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(dt);
}
function none_f_local() { return currentLang === 'ar' ? '—' : '—'; }

export { t, setLang, currentLang, bindStore, setCurrency, currencyLabel, fmtMoney, fmtNum, fmtDate, fmtMonth, fmtDayMonth, DICTS, locale };
