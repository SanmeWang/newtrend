/* ============================================================
   新流 — 产品逻辑（v2.0 极简禅意 + 层级穿透）
   保留全部 Supabase CRUD，重构为事件驱动架构
   ============================================================ */

// ---- Supabase 初始化 ----
var SUPABASE_URL = 'https://wsqhynhuqkhbjvtojsed.supabase.co';
var SUPABASE_KEY = 'sb_publishable_D-MZ0m1J6x4-g8AX-LNvxg_cb_oxq1L';
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- 全局状态 ----
var state = {
  goals: [],
  dailies: {},
  contents: [],
  pendingPool: [],
  categories: [],
  profile: {},
  monitoringItems: []
};
var currentPage = sessionStorage.getItem('xinliu_page') || 'goals';
var currentDay = '';
var editingGoalId = null;
var editingContentId = null;
var showArchived = false;
var saveDailyTimer = null;

// ---- 时辰定义 ----
var SHICHEN_LIST = [
  {key:'zi',emoji:'🌙',name:'子时',time:'23-1'},
  {key:'chou',emoji:'🐂',name:'丑时',time:'1-3'},
  {key:'yin',emoji:'🐅',name:'寅时',time:'3-5'},
  {key:'mao',emoji:'🐇',name:'卯时',time:'5-7'},
  {key:'chen',emoji:'🐉',name:'辰时',time:'7-9'},
  {key:'si',emoji:'🐍',name:'巳时',time:'9-11'},
  {key:'wu',emoji:'☀️',name:'午时',time:'11-13'},
  {key:'wei',emoji:'🐑',name:'未时',time:'13-15'},
  {key:'shen',emoji:'🐒',name:'申时',time:'15-17'},
  {key:'you',emoji:'🐔',name:'酉时',time:'17-19'},
  {key:'xu',emoji:'🐕',name:'戌时',time:'19-21'},
  {key:'hai',emoji:'🐖',name:'亥时',time:'21-23'}
];

var ENERGY_EMOJI = ['😫','😐','🙂','😊','🔥'];

// ---- 工具函数 ----
function genId() { return Math.random().toString(36).substr(2, 12); }
function todayStr() {
  var d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function getUserId() {
  var ses = await sb.auth.getSession();
  var u = ses && ses.data && ses.data.session ? ses.data.session.user : null;
  return u ? u.id : null;
}

// ---- 分类工具 ----
function getCatById(id) {
  for (var i = 0; i < state.categories.length; i++) {
    if (state.categories[i].id === id) return state.categories[i];
  }
  return null;
}
function getCatPath(catId) {
  var parts = []; var id = catId;
  while (id) { var c = getCatById(id); if (!c) break; parts.unshift(c.name); id = c.parent_id; }
  return parts.join(' > ');
}
function getChildren(parentId) {
  return state.categories.filter(function(c) { return c.parent_id === parentId; });
}

// ---- 认证系统 ----
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('[data-auth-tab="'+tab+'"]').classList.add('active');
  ['form-password','form-signup','form-otp'].forEach(function(id) { document.getElementById(id).classList.add('hidden'); });
  if (tab === 'password') document.getElementById('form-password').classList.remove('hidden');
  else if (tab === 'signup') document.getElementById('form-signup').classList.remove('hidden');
  else document.getElementById('form-otp').classList.remove('hidden');
  document.getElementById('auth-message').style.display = 'none';
}
function showAuthMessage(type, text) {
  var el = document.getElementById('auth-message');
  el.className = 'auth-msg '+type; el.textContent = text; el.style.display = 'block';
}

async function doPasswordLogin() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if (!email || !password) { showAuthMessage('error','请填写邮箱和密码'); return; }
  var r = await sb.auth.signInWithPassword({email:email,password:password});
  if (r.error) showAuthMessage('error',r.error.message);
}

async function doSignup() {
  var email = document.getElementById('signup-email').value.trim();
  var p1 = document.getElementById('signup-password').value;
  var p2 = document.getElementById('signup-password2').value;
  if (!email || !p1) { showAuthMessage('error','请填写邮箱和密码'); return; }
  if (p1 !== p2) { showAuthMessage('error','两次密码不一致'); return; }
  var r = await sb.auth.signUp({email:email,password:p1});
  if (r.error) showAuthMessage('error',r.error.message);
  else showAuthMessage('success','注册成功！请检查邮箱确认链接（可能在垃圾箱）。');
}

async function doMagicLink() {
  var email = document.getElementById('otp-email').value.trim();
  if (!email) { showAuthMessage('error','请输入邮箱'); return; }
  var r = await sb.auth.signInWithOtp({email:email});
  if (r.error) showAuthMessage('error',r.error.message);
  else showAuthMessage('info','验证链接已发送，请检查邮箱。');
}

async function doLogout() { await sb.auth.signOut(); }

function toggleUserMenu() {
  var dd = document.getElementById('user-dropdown');
  dd.classList.toggle('hidden');
}

function updateUserUI(user) {
  var email = user.email || '';
  document.getElementById('user-name').textContent = email.split('@')[0];
  renderAvatar('user-avatar-wrap', state.profile.avatar_url, (email[0]||'?').toUpperCase());
}

// ---- 头像渲染 ----
var CARTOON_AVATARS = [
  { bg:'#fde68a', face:'#fbbf24', eyes:'#1e293b', mouth:'#1e293b', cheeks:'#fca5a5' },
  { bg:'#d1fae5', face:'#6ee7b7', eyes:'#1e293b', mouth:'#1e293b', cheeks:'#fca5a5' },
  { bg:'#dbeafe', face:'#93c5fd', eyes:'#1e293b', mouth:'#1e293b', cheeks:'#fca5a5' },
  { bg:'#fce7f3', face:'#f9a8d4', eyes:'#1e293b', mouth:'#1e293b', cheeks:'#fca5a5' },
  { bg:'#ede9fe', face:'#c4b5fd', eyes:'#1e293b', mouth:'#1e293b', cheeks:'#fca5a5' },
  { bg:'#ffedd5', face:'#fdba74', eyes:'#1e293b', mouth:'#1e293b', cheeks:'#fca5a5' },
  { bg:'#e0f2fe', face:'#67e8f9', eyes:'#1e293b', mouth:'#1e293b', cheeks:'#fca5a5' },
  { bg:'#fef3c7', face:'#fcd34d', eyes:'#1e293b', mouth:'#1e293b', cheeks:'#fca5a5' }
];

function cartoonSvg(i) {
  var c = CARTOON_AVATARS[i];
  return '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">'
    + '<circle cx="40" cy="40" r="40" fill="'+c.bg+'"/>'
    + '<circle cx="40" cy="42" r="24" fill="'+c.face+'"/>'
    + '<circle cx="32" cy="36" r="2.5" fill="'+c.eyes+'"/><circle cx="48" cy="36" r="2.5" fill="'+c.eyes+'"/>'
    + '<ellipse cx="40" cy="46" rx="6" ry="4" fill="'+c.mouth+'"/>'
    + '<circle cx="28" cy="42" r="3" fill="'+c.cheeks+'" opacity="0.4"/>'
    + '<circle cx="52" cy="42" r="3" fill="'+c.cheeks+'" opacity="0.4"/>'
    + '</svg>';
}

function renderAvatar(containerId, avatarUrl, fallbackChar) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (avatarUrl && avatarUrl.startsWith('cartoon:')) {
    var idx = parseInt(avatarUrl.split(':')[1])||0;
    el.innerHTML = cartoonSvg(idx);
  } else if (avatarUrl && (avatarUrl.startsWith('data:')||avatarUrl.startsWith('http'))) {
    el.innerHTML = '<img src="'+avatarUrl+'" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
  } else {
    el.innerHTML = '<span style="font-size:14px;font-weight:500;">'+fallbackChar+'</span>';
  }
}

function renderCartoonGrid() {
  var grid = document.getElementById('cartoon-avatar-grid');
  if (!grid) return;
  var html = '';
  for (var i=0;i<8;i++) {
    var cls = 'cartoon-avatar-item';
    var cur = state.profile.avatar_url||'';
    if (cur === 'cartoon:'+i) cls += ' selected';
    html += '<div class="'+cls+'" data-action="selectCartoon" data-idx="'+i+'">'+cartoonSvg(i)+'</div>';
  }
  grid.innerHTML = html;
}

async function selectCartoon(idx) {
  state.profile.avatar_url = 'cartoon:'+idx;
  var uid = await getUserId(); if (!uid) return;
  await sb.from('profiles').upsert({id:uid, avatar_url:'cartoon:'+idx}, {onConflict:'id'});
  renderAvatar('avatar-preview','cartoon:'+idx,'?');
  renderAvatar('user-avatar-wrap','cartoon:'+idx,'?');
  renderCartoonGrid();
}

async function uploadAvatar() {
  var file = document.getElementById('avatar-upload').files[0];
  if (!file) return;
  if (file.size > 500*1024) { alert('图片不能超过500KB'); return; }
  var reader = new FileReader();
  reader.onload = async function(e) {
    var dataUrl = e.target.result;
    state.profile.avatar_url = dataUrl;
    var uid = await getUserId(); if (!uid) return;
    await sb.from('profiles').upsert({id:uid, avatar_url:dataUrl}, {onConflict:'id'});
    renderAvatar('avatar-preview',dataUrl,'?');
    renderAvatar('user-avatar-wrap',dataUrl,'?');
    renderCartoonGrid();
    document.getElementById('avatar-file-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

// ---- 数据加载 ----
async function loadAllData() {
  var uid = await getUserId(); if (!uid) return;
  var results = await Promise.all([
    sb.from('goals').select('*').eq('user_id',uid).order('created_at',{ascending:false}),
    sb.from('dailies').select('*').eq('user_id',uid),
    sb.from('contents').select('*').eq('user_id',uid).order('created_at',{ascending:false}),
    sb.from('pending_pool').select('*').eq('user_id',uid).order('created_at',{ascending:false}),
    sb.from('categories').select('*').eq('user_id',uid).order('level',{ascending:true}).order('sort_order',{ascending:true}),
    sb.from('profiles').select('*').eq('id',uid).maybeSingle()
  ]);

  state.goals = results[0].data || [];
  var dailiesArr = results[1].data || [];
  state.dailies = {};
  for (var i = 0; i < dailiesArr.length; i++) {
    state.dailies[dailiesArr[i].day_str] = dailiesArr[i];
  }
  state.contents = results[2].data || [];
  state.pendingPool = results[3].data || [];
  state.categories = results[4].data || [];
  state.profile = results[5].data || {};
  if (state.profile.monitoring_items && Array.isArray(state.profile.monitoring_items) && state.profile.monitoring_items.length > 0) {
    state.monitoringItems = state.profile.monitoring_items;
  } else {
    state.monitoringItems = [
      {key:'overplanning',label:'今天我是不是又在改生活成长/加新想法？',desc:'多疑缺乏自信的表现：用规划逃避执行'},
      {key:'escapism',label:'今天我是不是在用"新东西"覆盖焦虑？',desc:'用新鲜感代替脚踏实地'},
      {key:'action',label:'今天我真的做了什么？还是只想不做？',desc:'己土日主：越不动越不想动'},
      {key:'compare',label:'今天我是不是在和别人比较？',desc:'你的节奏是自己的，不是别人的'},
      {key:'trust',label:'今天我能信任"脚踏实地"本身吗？',desc:'无为而治：专注的时候确实没有心思想别的'}
    ];
  }
  if (!state.profile.id) state.profile.id = uid;
  currentDay = todayStr();
}

// ---- 页面切换 ----
function showPage(page) {
  currentPage = page;
  sessionStorage.setItem('xinliu_page', page);
  document.querySelectorAll('.main').forEach(function(m) { m.classList.add('hidden'); });
  var target = document.getElementById('page-'+page);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  var navTab = document.querySelector('.nav-tab[data-page="'+page+'"]');
  if (navTab) navTab.classList.add('active');

  if (page === 'goals') renderGoals();
  else if (page === 'daily') renderDaily();
  else if (page === 'content') { populateFilterCats(); renderContent(); }
  else if (page === 'pending') renderPendingPool();
  else if (page === 'progress') renderProgress();
  else if (page === 'log') renderLog();
  else if (page === 'profile') renderProfile();
}

// ---- 目标管理 ----
function renderGoals() {
  var shortGoals = state.goals.filter(function(g) { return g.level === 'short' && !g.archived; });
  var midGoals = state.goals.filter(function(g) { return g.level === 'mid' && !g.archived; });
  var longGoals = state.goals.filter(function(g) { return g.level === 'long' && !g.archived; });
  var archived = state.goals.filter(function(g) { return g.archived; });

  renderGoalList('goals-short', shortGoals);
  renderGoalList('goals-mid', midGoals);
  renderGoalList('goals-long', longGoals);
  renderArchivedGoals(archived);
}

function renderGoalList(containerId, goals) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var html = '';
  for (var i = 0; i < goals.length; i++) {
    var g = goals[i];
    var pct = g.progress || 0;
    var priorityClass = g.priority || 'mid';
    var expandedId = 'goal-expand-'+g.id;
    html += '<div class="goal-card" data-goal-id="'+escapeHtml(g.id)+'">';
    html += '<div class="goal-card-main">';
    html += '<span class="goal-card-priority '+priorityClass+'"></span>';
    html += '<div class="goal-card-content">';
    html += '<div class="goal-card-text">'+escapeHtml(g.content)+'</div>';
    html += '<div class="goal-card-meta">';
    if (g.why) html += '<span>'+escapeHtml(g.why)+'</span>';
    html += '</div></div>';
    html += '<div class="goal-card-progress">';
    html += '<div class="goal-progress-bar"><div class="goal-progress-fill" style="width:'+pct+'%"></div></div>';
    html += '<span class="goal-progress-num">'+pct+'%</span>';
    html += '</div>';
    html += '<div class="goal-card-actions">';
    html += '<button class="btn btn-ghost btn-sm" data-action="expandGoal" data-goal-id="'+escapeHtml(g.id)+'">展开</button>';
    html += '<button class="btn btn-ghost btn-sm" data-action="editGoal" data-goal-id="'+escapeHtml(g.id)+'">编辑</button>';
    html += '</div></div>';
    // 展开区
    html += '<div class="goal-expand hidden" id="'+expandedId+'"></div>';
    html += '</div>';
  }
  if (goals.length === 0) html = '<p style="font-size:13px;color:var(--text-hint);padding:12px 0;">暂无目标</p>';
  container.innerHTML = html;
}

function renderArchivedGoals(archived) {
  var section = document.getElementById('goals-archived');
  var toggle = document.getElementById('btn-toggle-archived');
  if (!section || !toggle) return;
  toggle.querySelector('span').textContent = (showArchived ? '▾' : '▸') + ' 已完成 / 归档（'+archived.length+'）';

  if (!showArchived) { section.innerHTML = ''; section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  var html = '';
  for (var i = 0; i < archived.length; i++) {
    var g = archived[i];
    html += '<div class="goal-card archived" style="margin-top:6px;">';
    html += '<div class="goal-card-main">';
    html += '<span class="goal-card-priority '+(g.priority||'mid')+'"></span>';
    html += '<div class="goal-card-content"><div class="goal-card-text">'+escapeHtml(g.content)+'</div></div>';
    html += '<div class="goal-card-progress">';
    html += '<div class="goal-progress-bar"><div class="goal-progress-fill" style="width:'+(g.progress||0)+'%"></div></div>';
    html += '<span class="goal-progress-num">'+(g.progress||0)+'%</span></div>';
    html += '<button class="btn btn-ghost btn-sm" data-action="unarchiveGoal" data-goal-id="'+escapeHtml(g.id)+'">恢复</button>';
    html += '</div></div>';
  }
  if (archived.length === 0) html = '<p style="font-size:13px;color:var(--text-hint);padding:12px 0;">暂无归档目标</p>';
  section.innerHTML = html;
}

var expandedGoalId = null;

async function toggleExpandGoal(goalId) {
  var expandEl = document.getElementById('goal-expand-'+goalId);
  if (!expandEl) return;

  if (expandedGoalId === goalId) {
    expandEl.classList.add('hidden');
    expandedGoalId = null;
    return;
  }

  // 收起之前的
  if (expandedGoalId) {
    var prev = document.getElementById('goal-expand-'+expandedGoalId);
    if (prev) prev.classList.add('hidden');
  }
  expandedGoalId = goalId;

  // 查找关联的日排任务
  var relatedTasks = [];
  var dayKeys = Object.keys(state.dailies);
  for (var i = 0; i < dayKeys.length; i++) {
    var entry = state.dailies[dayKeys[i]];
    var tasks = entry.tasks || [];
    for (var j = 0; j < tasks.length; j++) {
      if (tasks[j].goalId === goalId && !tasks[j].done) {
        relatedTasks.push({day:dayKeys[i],text:tasks[j].text,done:tasks[j].done});
      }
    }
  }

  // 查找关联的内容
  var relatedContents = state.contents.filter(function(c) { return c.goal_id === goalId; });

  var html = '<div class="goal-expand-section">';
  html += '<div class="goal-expand-label">关联日排任务（'+relatedTasks.length+'）</div>';
  if (relatedTasks.length === 0) {
    html += '<div class="goal-expand-empty">暂无关联任务</div>';
  } else {
    for (var k = 0; k < relatedTasks.length; k++) {
      html += '<div class="goal-expand-task">'+escapeHtml(relatedTasks[k].day)+' '+escapeHtml(relatedTasks[k].text)+'</div>';
    }
  }
  html += '</div>';

  html += '<div class="goal-expand-section">';
  html += '<div class="goal-expand-label">关联内容产出（'+relatedContents.length+'）</div>';
  if (relatedContents.length === 0) {
    html += '<div class="goal-expand-empty">暂无关联内容</div>';
  } else {
    for (var m = 0; m < relatedContents.length; m++) {
      var c = relatedContents[m];
      html += '<div class="goal-expand-content-item">'+escapeHtml(c.title)+' <span style="font-size:11px;color:var(--text-hint);">('+(c.status||'想法')+')</span></div>';
    }
  }
  html += '</div>';
  expandEl.innerHTML = html;
  expandEl.classList.remove('hidden');
}

function updateGoalParentSelect() {
  var sel = document.getElementById('goal-parent');
  if (!sel) return;
  sel.innerHTML = '<option value="">无</option>';
  var nonArchived = state.goals.filter(function(g) { return !g.archived; });
  for (var i = 0; i < nonArchived.length; i++) {
    var g = nonArchived[i];
    if (g.id !== editingGoalId) {
      sel.innerHTML += '<option value="'+escapeHtml(g.id)+'">'+escapeHtml(g.content).substring(0,40)+'</option>';
    }
  }
}

function addGoal(level) {
  editingGoalId = null;
  document.getElementById('modal-goal-title').textContent = '添加目标';
  document.getElementById('edit-id').value = '';
  document.getElementById('goal-content').value = '';
  document.getElementById('goal-priority').value = 'mid';
  document.getElementById('goal-progress').value = 0;
  document.getElementById('progress-val').textContent = '0%';
  updateGoalParentSelect();
  document.getElementById('goal-parent').value = '';
  document.getElementById('btn-delete-goal').classList.add('hidden');
  document.getElementById('modal-goal').classList.remove('hidden');
  document.getElementById('modal-goal').dataset.level = level;
}

function editGoal(id) {
  var g = null;
  for (var i = 0; i < state.goals.length; i++) { if (state.goals[i].id === id) { g = state.goals[i]; break; } }
  if (!g) return;
  editingGoalId = id;
  document.getElementById('modal-goal-title').textContent = '编辑目标';
  document.getElementById('edit-id').value = id;
  document.getElementById('goal-content').value = g.content || '';
  document.getElementById('goal-priority').value = g.priority || 'mid';
  var p = g.progress || 0;
  document.getElementById('goal-progress').value = p;
  document.getElementById('progress-val').textContent = p+'%';
  updateGoalParentSelect();
  document.getElementById('goal-parent').value = g.parent_id || '';
  document.getElementById('btn-delete-goal').classList.remove('hidden');
  document.getElementById('modal-goal').classList.remove('hidden');
  document.getElementById('modal-goal').dataset.level = g.level || 'short';
}

async function saveGoal() {
  var uid = await getUserId(); if (!uid) return;
  var id = document.getElementById('edit-id').value || genId();
  var content = document.getElementById('goal-content').value.trim();
  if (!content) { alert('请输入目标内容'); return; }
  var level = document.getElementById('modal-goal').dataset.level || 'short';
  var priority = document.getElementById('goal-priority').value;
  var progress = parseInt(document.getElementById('goal-progress').value) || 0;
  var parentId = document.getElementById('goal-parent').value || null;
  var existing = null;
  for (var i = 0; i < state.goals.length; i++) { if (state.goals[i].id === id) { existing = state.goals[i]; break; } }

  if (existing) {
    var r = await sb.from('goals').update({
      content:content,level:level,priority:priority,progress:progress,
      parent_id:parentId,updated_at:new Date().toISOString()
    }).eq('id',id);
    if (r.error) { alert('保存失败: '+r.error.message); return; }
    existing.content = content; existing.level = level; existing.priority = priority;
    existing.progress = progress; existing.parent_id = parentId;
  } else {
    var r = await sb.from('goals').insert({
      id:id,user_id:uid,content:content,level:level,priority:priority,
      progress:progress,parent_id:parentId,archived:false
    });
    if (r.error) { alert('保存失败: '+r.error.message); return; }
    state.goals.unshift({id:id,user_id:uid,content:content,level:level,priority:priority,progress:progress,parent_id:parentId,archived:false,created_at:new Date().toISOString()});
  }
  document.getElementById('modal-goal').classList.add('hidden');
  renderGoals();
}

async function deleteGoal() {
  if (!confirm('确定删除这个目标吗？')) return;
  var id = document.getElementById('edit-id').value;
  var r = await sb.from('goals').delete().eq('id',id);
  if (r.error) { alert('删除失败'); return; }
  state.goals = state.goals.filter(function(g) { return g.id !== id; });
  document.getElementById('modal-goal').classList.add('hidden');
  renderGoals();
}

async function toggleGoalArchive(id, archived) {
  var r = await sb.from('goals').update({archived:archived}).eq('id',id);
  if (r.error) { alert('操作失败'); return; }
  for (var i = 0; i < state.goals.length; i++) {
    if (state.goals[i].id === id) { state.goals[i].archived = archived; break; }
  }
  renderGoals();
}

function toggleArchived() {
  showArchived = !showArchived;
  renderGoals();
}

// ---- 日排表管理 ----
function getDayEntry(day) {
  return state.dailies[day || currentDay] || {tasks:[],active_shichen:[],reflection:'',notes:'',energy:0,monitoring:{}};
}

async function persistDaily(day) {
  var uid = await getUserId(); if (!uid) return;
  var entry = state.dailies[day || currentDay];
  if (!entry) return;
  var r = await sb.from('dailies').upsert({
    user_id:uid,
    day_str:day||currentDay,
    tasks:entry.tasks||[],
    active_shichen:entry.active_shichen||[],
    reflection:entry.reflection||'',
    notes:entry.notes||'',
    energy:entry.energy||0,
    monitoring:entry.monitoring||{}
  },{onConflict:'user_id,day_str'});
  if (r.error) console.error('persistDaily error:', r.error);
}

function renderDaily() {
  var entry = getDayEntry();
  document.getElementById('daily-date').textContent = currentDay;
  updateStatusPanel(entry);
  renderEnergyBar(entry);
  renderShichenGrid(entry);
  renderTasks(entry);
  renderMonitoringChecklist(entry);
  document.getElementById('daily-reflection').value = entry.reflection || '';
  document.getElementById('daily-notes').value = entry.notes || '';
}

function renderEnergyBar(entry) {
  var container = document.getElementById('energy-bar');
  var labelEl = document.getElementById('energy-label');
  if (!container || !labelEl) return;
  var level = entry.energy || 0;
  var html = '';
  for (var i = 0; i < 5; i++) {
    html += '<button class="energy-btn'+(i<=level?' active':'')+'" data-action="setEnergy" data-level="'+i+'">'+ENERGY_EMOJI[i]+'</button>';
  }
  container.innerHTML = html;
  labelEl.textContent = level > 0 ? '精力等级: '+level+'/4' : '点击设置今日精力';
}

function setEnergy(level) {
  var entry = getDayEntry();
  entry.energy = level;
  saveDailyDebounced();
  renderEnergyBar(entry);
}

function renderShichenGrid(entry) {
  var container = document.getElementById('shichen-grid');
  if (!container) return;
  var active = entry.active_shichen || [];
  var html = '';
  for (var i = 0; i < SHICHEN_LIST.length; i++) {
    var s = SHICHEN_LIST[i];
    var isActive = active.indexOf(s.key) !== -1;
    html += '<div class="shichen-cell'+(isActive?' active':'')+'" data-action="toggleShichen" data-shichen="'+s.key+'">';
    html += '<span class="shichen-emoji">'+s.emoji+'</span>';
    html += '<span class="shichen-name">'+s.name+'</span>';
    html += '<span class="shichen-time">'+s.time+'</span>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function toggleShichen(key) {
  var entry = getDayEntry();
  var arr = entry.active_shichen || [];
  var idx = arr.indexOf(key);
  if (idx === -1) arr.push(key); else arr.splice(idx,1);
  entry.active_shichen = arr;
  saveDailyDebounced();
  renderShichenGrid(entry);
}

function renderTasks(entry) {
  var container = document.getElementById('task-list');
  if (!container) return;
  var tasks = entry.tasks || [];
  var html = '';
  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    var doneClass = t.done ? ' task-done' : '';
    html += '<div class="task-item'+doneClass+'" data-task-idx="'+i+'">';
    html += '<input type="checkbox" class="task-check"'+(t.done?' checked':'')+' data-action="toggleTask" data-idx="'+i+'">';
    html += '<input class="task-text" value="'+escapeHtml(t.text||'')+'" data-action="updateTask" data-idx="'+i+'" placeholder="输入任务…">';
    if (t.goalId) {
      var goalName = '';
      for (var j=0;j<state.goals.length;j++) { if(state.goals[j].id===t.goalId){ goalName=state.goals[j].content.substring(0,12); break; } }
      if (goalName) html += '<span class="task-goal">'+escapeHtml(goalName)+'</span>';
    }
    if (t.estimatedMinutes) html += '<span class="task-time">'+t.estimatedMinutes+'min</span>';
    html += '<button class="task-delete" data-action="deleteTask" data-idx="'+i+'">×</button>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function addTask() {
  var entry = getDayEntry();
  if (!entry.tasks) entry.tasks = [];
  entry.tasks.push({text:'',done:false,goalId:null,catId:null,estimatedMinutes:0});
  state.dailies[currentDay] = entry;
  saveDailyDebounced();
  renderTasks(entry);
}

function toggleTask(idx) {
  var entry = getDayEntry();
  if (!entry.tasks || !entry.tasks[idx]) return;
  entry.tasks[idx].done = !entry.tasks[idx].done;
  saveDailyDebounced();
  renderTasks(entry);
}

function updateTask(idx, text) {
  var entry = getDayEntry();
  if (!entry.tasks || !entry.tasks[idx]) return;
  entry.tasks[idx].text = text;
  saveDailyDebounced();
}

function deleteTask(idx) {
  var entry = getDayEntry();
  if (!entry.tasks) return;
  entry.tasks.splice(idx,1);
  saveDailyDebounced();
  renderTasks(entry);
}

function saveDailyDebounced() {
  if (saveDailyTimer) clearTimeout(saveDailyTimer);
  saveDailyTimer = setTimeout(function() { persistDaily(currentDay); }, 800);
}

function changeDay(delta) {
  var d = new Date(currentDay);
  d.setDate(d.getDate()+delta);
  currentDay = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if (!state.dailies[currentDay]) state.dailies[currentDay] = {tasks:[],active_shichen:[],reflection:'',notes:'',energy:0,monitoring:{}};
  renderDaily();
}

function updateStatusPanel(entry) {
  var tasks = entry.tasks || [];
  var done = tasks.filter(function(t){return t.done;}).length;
  var total = tasks.length;
  var streak = document.getElementById('status-streak');
  var msg = document.getElementById('status-msg');
  var why = document.getElementById('status-why');
  var energy = document.getElementById('status-energy');

  // 计算连续打卡天数
  var streakCount = 0;
  var checkDay = new Date(currentDay);
  while (true) {
    var ds = checkDay.getFullYear()+'-'+String(checkDay.getMonth()+1).padStart(2,'0')+'-'+String(checkDay.getDate()).padStart(2,'0');
    var e = state.dailies[ds];
    var ts = e ? (e.tasks||[]) : [];
    var d = ts.filter(function(t){return t.done;}).length;
    if (d > 0 && ts.length > 0 && d >= ts.length) { streakCount++; checkDay.setDate(checkDay.getDate()-1); }
    else break;
  }
  streak.textContent = streakCount;
  if (streakCount >= 7) { streak.style.color = '#c0392b'; }
  else if (streakCount >= 3) { streak.style.color = 'var(--accent)'; }
  else { streak.style.color = 'var(--text-hint)'; }

  if (total === 0) {
    msg.textContent = '今天还没有任务';
    why.classList.add('hidden'); energy.classList.add('hidden');
  } else if (done === total && total > 0) {
    msg.textContent = '今日全部完成';
    why.classList.add('hidden'); energy.classList.add('hidden');
  } else {
    msg.textContent = '已完成 '+done+'/'+total;
    if (done === 0) { msg.textContent += '，开始第一个任务吧'; }
  }
  if (entry.energy && entry.energy > 0) {
    energy.classList.remove('hidden');
    energy.textContent = '今日精力: '+ENERGY_EMOJI[entry.energy];
  }
}

// ---- 监控检查 ----
function renderMonitoringChecklist(entry) {
  var container = document.getElementById('monitoring-checklist');
  if (!container) return;
  var monitoring = entry.monitoring || {};
  var items = state.monitoringItems;
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var checked = monitoring[item.key] ? 'checked' : '';
    html += '<div class="checklist-item">';
    html += '<input type="checkbox" ' + checked + ' data-action="toggleMonitoring" data-key="'+item.key+'">';
    html += '<div><label class="checklist-label">'+escapeHtml(item.label)+'</label>';
    html += '<div class="checklist-desc">'+escapeHtml(item.desc)+'</div></div>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function toggleMonitoring(key) {
  var entry = getDayEntry();
  if (!entry.monitoring) entry.monitoring = {};
  entry.monitoring[key] = !entry.monitoring[key];
  saveDailyDebounced();
  renderMonitoringChecklist(entry);
}

function renderMonitoringEditor() {
  var container = document.getElementById('monitoring-edit-list');
  if (!container) return;
  var html = '';
  for (var i = 0; i < state.monitoringItems.length; i++) {
    var item = state.monitoringItems[i];
    html += '<div class="monitoring-edit-item">';
    html += '<button class="monitoring-edit-delete" data-action="deleteMonitoringItem" data-idx="'+i+'">×</button>';
    html += '<label style="font-size:12px;color:var(--text-hint);">问题</label>';
    html += '<input type="text" value="'+escapeHtml(item.label)+'" data-moni-field="label" data-idx="'+i+'">';
    html += '<label style="font-size:12px;color:var(--text-hint);">说明</label>';
    html += '<input type="text" value="'+escapeHtml(item.desc)+'" data-moni-field="desc" data-idx="'+i+'">';
    html += '</div>';
  }
  container.innerHTML = html;
  document.getElementById('modal-monitoring').classList.remove('hidden');
}

function addMonitoringItem() {
  state.monitoringItems.push({key:'custom_'+genId(), label:'', desc:''});
  renderMonitoringEditor();
}

function deleteMonitoringItem(idx) {
  state.monitoringItems.splice(idx, 1);
  renderMonitoringEditor();
}

async function saveMonitoringItems() {
  // 从编辑表单读取最新值
  var fields = document.querySelectorAll('[data-moni-field]');
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var idx = parseInt(f.dataset.idx);
    var field = f.dataset.moniField;
    if (state.monitoringItems[idx]) state.monitoringItems[idx][field] = f.value;
  }
  var uid = await getUserId(); if (!uid) return;
  await sb.from('profiles').update({monitoring_items:state.monitoringItems}).eq('id',uid);
  state.profile.monitoring_items = state.monitoringItems;
  document.getElementById('modal-monitoring').classList.add('hidden');
  renderMonitoringChecklist(getDayEntry());
}

// ---- 分类管理 ----
function openCategoryManager() {
  renderCategoryTree();
  populateCatParentSelect();
  document.getElementById('modal-categories').classList.remove('hidden');
}

function renderCategoryTree() {
  var container = document.getElementById('cat-tree');
  if (!container) return;
  function renderLevel(parentId, indent) {
    var children = getChildren(parentId);
    if (children.length === 0) return '';
    var h = '';
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      h += '<div class="cat-tree-node" style="padding-left:'+(indent*16+8)+'px">';
      h += '<span class="cat-tree-name">'+escapeHtml(c.name)+'</span>';
      h += '<span class="cat-tree-delete" data-action="deleteCategory" data-cat-id="'+c.id+'">×</span>';
      h += '</div>';
      h += renderLevel(c.id, indent+1);
    }
    return h;
  }
  container.innerHTML = renderLevel(null, 1) || '<p style="font-size:13px;color:var(--text-hint);">暂无分类，在下方添加。</p>';
}

function populateCatParentSelect() {
  var sel = document.getElementById('cat-add-parent');
  if (!sel) return;
  sel.innerHTML = '<option value="">一级分类</option>';
  function addOptions(parentId, indent) {
    var children = getChildren(parentId);
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      sel.innerHTML += '<option value="'+c.id+'">'+Array(indent+1).join('—')+c.name+'</option>';
      addOptions(c.id, indent+1);
    }
  }
  addOptions(null, 1);
}

async function doAddCategory() {
  var name = document.getElementById('cat-add-name').value.trim();
  if (!name) { alert('请输入分类名称'); return; }
  var parentId = document.getElementById('cat-add-parent').value || null;
  var level = 1;
  if (parentId) { var p = getCatById(parentId); level = (p ? p.level+1 : 1); if (level > 3) { alert('最多三级分类'); return; } }
  var uid = await getUserId(); if (!uid) return;
  var r = await sb.from('categories').insert({user_id:uid,name:name,level:level,parent_id:parentId}).select();
  if (r.error) { alert('添加失败: '+r.error.message); return; }
  if (r.data && r.data[0]) state.categories.push(r.data[0]);
  document.getElementById('cat-add-name').value = '';
  renderCategoryTree();
  populateCatParentSelect();
}

async function deleteCategory(id) {
  if (!confirm('确定删除此分类？子分类也会一并删除。')) return;
  var toDelete = [id];
  function findChildren(pid) {
    for (var i=0;i<state.categories.length;i++) { if (state.categories[i].parent_id===pid) { toDelete.push(state.categories[i].id); findChildren(state.categories[i].id); } }
  }
  findChildren(id);
  for (var i=0;i<toDelete.length;i++) { await sb.from('categories').delete().eq('id',toDelete[i]); }
  state.categories = state.categories.filter(function(c) { return toDelete.indexOf(c.id)===-1; });
  renderCategoryTree();
  populateCatParentSelect();
}

// ---- 内容管理 ----
function populateFilterCats() {
  ['content-filter-l1','content-filter-l2','content-filter-l3'].forEach(function(id) {
    var sel = document.getElementById(id); if (!sel) return;
    var val = sel.value; sel.innerHTML = '<option value="">'+(id.indexOf('l1')!==-1?'全部类型':id.indexOf('l2')!==-1?'全部方向':'全部子类')+'</option>';
    var level = id.indexOf('l1')!==-1?1:id.indexOf('l2')!==-1?2:3;
    var parentId = null;
    if (level === 2) { var l1 = document.getElementById('content-filter-l1'); parentId = l1 ? l1.value || null : null; }
    if (level === 3) { var l2 = document.getElementById('content-filter-l2'); parentId = l2 ? l2.value || null : null; }
    var cats = state.categories.filter(function(c) { return c.level===level && c.parent_id===parentId; });
    for (var i=0;i<cats.length;i++) { sel.innerHTML += '<option value="'+cats[i].id+'">'+escapeHtml(cats[i].name)+'</option>'; }
    sel.value = val;
  });
}

function onCategoryFilterChange(sourceLevel) {
  if (sourceLevel <= 1) { document.getElementById('content-filter-l2').value=''; populateFilterCats(); }
  if (sourceLevel <= 2) { document.getElementById('content-filter-l3').value=''; populateFilterCats(); }
  if (sourceLevel <= 3) renderContent();
}

function renderContent() {
  var container = document.getElementById('content-list');
  if (!container) return;
  var l1=document.getElementById('content-filter-l1').value;
  var l2=document.getElementById('content-filter-l2').value;
  var l3=document.getElementById('content-filter-l3').value;
  var status=document.getElementById('content-filter-status').value;

  var filtered = state.contents.filter(function(c) {
    if (l1 && c.category_path) { var parts = c.category_path.split(' > '); if (!c.category_id && parts[0] !== l1) return false; }
    if (l2 && c.category_path) { var parts = c.category_path.split(' > '); if (parts.length<2 || parts[1] !== l2) return false; }
    if (l3 && c.category_path) { var parts = c.category_path.split(' > '); if (parts.length<3 || parts[2] !== l3) return false; }
    if (status && c.status !== status) return false;
    return true;
  });

  var html = '';
  for (var i=0;i<filtered.length;i++) {
    var c = filtered[i];
    var statusClass = '';
    if (c.status==='想法') statusClass='planning';
    else if (c.status==='草稿') statusClass='drafting';
    else if (c.status==='制作中') statusClass='producing';
    else if (c.status==='已发布') statusClass='published';
    html += '<div class="content-card" data-action="editContent" data-content-id="'+c.id+'">';
    html += '<div class="content-card-header">';
    html += '<span class="content-card-title">'+escapeHtml(c.title)+'</span>';
    html += '<span class="content-card-status '+statusClass+'">'+(c.status||'想法')+'</span>';
    html += '</div>';
    html += '<div class="content-card-meta">';
    if (c.date) html += '<span>'+c.date+'</span>';
    if (c.platform) html += '<span>'+escapeHtml(c.platform)+'</span>';
    if (c.category_path) html += '<span>'+escapeHtml(c.category_path)+'</span>';
    html += '</div>';
    if (c.goal_id) {
      var gn = ''; for (var j=0;j<state.goals.length;j++) { if(state.goals[j].id===c.goal_id){ gn=state.goals[j].content.substring(0,20); break; } }
      if (gn) html += '<div class="content-card-goal">来自目标: '+escapeHtml(gn)+'</div>';
    }
    html += '</div>';
  }
  if (filtered.length===0) html = '<p style="font-size:13px;color:var(--text-hint);padding:20px 0;">暂无内容，点击"+ 新内容"开始</p>';
  container.innerHTML = html;
}

function addContent() {
  editingContentId = null;
  document.getElementById('modal-content-title').textContent = '添加内容';
  document.getElementById('content-edit-id').value = '';
  document.getElementById('content-title').value = '';
  document.getElementById('content-status').value = '想法';
  document.getElementById('content-platform').value = '';
  document.getElementById('content-date').value = '';
  document.getElementById('content-note').value = '';
  document.getElementById('btn-delete-content').classList.add('hidden');
  populateContentCatSelects();
  populateContentGoalSelect();
  document.getElementById('modal-content').classList.remove('hidden');
}

function editContent(id) {
  var c = null;
  for (var i=0;i<state.contents.length;i++) { if(state.contents[i].id===id){ c=state.contents[i]; break; } }
  if (!c) return;
  editingContentId = id;
  document.getElementById('modal-content-title').textContent = '编辑内容';
  document.getElementById('content-edit-id').value = id;
  document.getElementById('content-title').value = c.title || '';
  document.getElementById('content-status').value = c.status || '想法';
  document.getElementById('content-platform').value = c.platform || '';
  document.getElementById('content-date').value = c.date || '';
  document.getElementById('content-note').value = c.note || '';
  document.getElementById('btn-delete-content').classList.remove('hidden');
  populateContentCatSelects(c.category_id);
  populateContentGoalSelect(c.goal_id);
  document.getElementById('modal-content').classList.remove('hidden');
}

function populateContentCatSelects(preselectedId) {
  var preselectPath = preselectedId ? getCatPath(preselectedId).split(' > ') : [];
  ['content-cat-l1','content-cat-l2','content-cat-l3'].forEach(function(id) {
    var sel = document.getElementById(id); if (!sel) return;
    var level = id.indexOf('l1')!==-1?1:id.indexOf('l2')!==-1?2:3;
    sel.innerHTML = '<option value="">选择'+(level===1?'一级':level===2?'二级':'三级')+'分类</option>';
    var parentId = null;
    if (level===2) parentId = document.getElementById('content-cat-l1').value || null;
    if (level===3) parentId = document.getElementById('content-cat-l2').value || null;
    var cats = state.categories.filter(function(c) { return c.level===level && c.parent_id===parentId; });
    for (var i=0;i<cats.length;i++) sel.innerHTML += '<option value="'+cats[i].id+'">'+escapeHtml(cats[i].name)+'</option>';
    if (level===2 && preselectPath[1]) sel.value = preselectedId ? (function() { for(var k=0;k<cats.length;k++) if(cats[k].name===preselectPath[1]) return cats[k].id; return ''; })() : '';
    if (level===3 && preselectPath[2]) sel.value = preselectedId ? (function() { for(var k=0;k<cats.length;k++) if(cats[k].name===preselectPath[2]) return cats[k].id; return ''; })() : '';
    if (level>=2) sel.classList.remove('hidden');
  });
  // 自动选择 l1
  if (preselectPath[0]) {
    var l1cats = state.categories.filter(function(c){return c.level===1;});
    for (var k=0;k<l1cats.length;k++) { if(l1cats[k].name===preselectPath[0]) { document.getElementById('content-cat-l1').value=l1cats[k].id; onContentCatL1Change(); break; } }
  }
}

function onContentCatL1Change() { populateContentCatSelects(); }
function onContentCatL2Change() { populateContentCatSelects(); }

function populateContentGoalSelect(preselectedId) {
  var sel = document.getElementById('content-goal'); if (!sel) return;
  sel.innerHTML = '<option value="">不关联</option>';
  for (var i=0;i<state.goals.length;i++) {
    var g = state.goals[i];
    if (!g.archived) sel.innerHTML += '<option value="'+g.id+'"'+(g.id===preselectedId?' selected':'')+'>'+escapeHtml(g.content).substring(0,40)+'</option>';
  }
}

async function saveContent() {
  var uid = await getUserId(); if (!uid) return;
  var id = document.getElementById('content-edit-id').value || genId();
  var title = document.getElementById('content-title').value.trim();
  if (!title) { alert('请输入标题'); return; }
  var l1 = document.getElementById('content-cat-l1').value;
  var l2 = document.getElementById('content-cat-l2').value;
  var l3 = document.getElementById('content-cat-l3').value;
  var catId = l3 || l2 || l1 || null;
  var catPath = catId ? getCatPath(catId) : '';
  var status = document.getElementById('content-status').value;
  var platform = document.getElementById('content-platform').value.trim();
  var date = document.getElementById('content-date').value;
  var note = document.getElementById('content-note').value.trim();
  var goalId = document.getElementById('content-goal').value || null;

  var existing = null;
  for (var i=0;i<state.contents.length;i++) { if(state.contents[i].id===id){ existing=state.contents[i]; break; } }
  var payload = {title:title,category_id:catId,category_path:catPath,status:status,platform:platform,date:date,note:note,goal_id:goalId,updated_at:new Date().toISOString()};

  if (existing) {
    var r = await sb.from('contents').update(payload).eq('id',id);
    if (r.error) { alert('保存失败: '+r.error.message); return; }
    Object.assign(existing, payload);
  } else {
    var r = await sb.from('contents').insert(Object.assign({id:id,user_id:uid,created_at:new Date().toISOString()},payload));
    if (r.error) { alert('保存失败: '+r.error.message); return; }
    state.contents.unshift(Object.assign({id:id,user_id:uid},payload,{created_at:new Date().toISOString()}));
  }
  document.getElementById('modal-content').classList.add('hidden');
  renderContent();
}

async function deleteContent() {
  if (!confirm('确定删除这个内容吗？')) return;
  var id = document.getElementById('content-edit-id').value;
  var r = await sb.from('contents').delete().eq('id',id);
  if (r.error) { alert('删除失败'); return; }
  state.contents = state.contents.filter(function(c){return c.id!==id;});
  document.getElementById('modal-content').classList.add('hidden');
  renderContent();
}

// ---- 待定池管理 ----
function renderPendingPool() {
  var pool = state.pendingPool.filter(function(p){return !p.activated;});
  var activated = state.pendingPool.filter(function(p){return p.activated;});
  var stats = document.getElementById('pending-stats');
  if (stats) stats.textContent = '待定: '+pool.length+' 个 | 已激活: '+activated.length+' 个';

  var container = document.getElementById('pending-list');
  if (!container) return;
  var html = '';
  for (var i=0;i<pool.length;i++) {
    var p = pool[i];
    html += '<div class="pending-card">';
    html += '<span class="pending-content">'+escapeHtml(p.content)+'</span>';
    html += '<span class="pending-priority '+(p.priority==='高'?'high':p.priority==='低'?'low':'mid')+'">'+(p.priority||'中')+'</span>';
    html += '<button class="btn btn-sm" data-action="activatePending" data-pending-id="'+p.id+'">激活</button>';
    html += '<button class="btn btn-sm btn-ghost" data-action="deletePending" data-pending-id="'+p.id+'">删除</button>';
    html += '</div>';
  }
  if (pool.length===0) html = '<p style="font-size:13px;color:var(--text-hint);padding:20px 0;">待定池空空如也。</p>';
  container.innerHTML = html;
}

function addPending() {
  document.getElementById('pending-content').value = '';
  document.getElementById('modal-pending').classList.remove('hidden');
}

async function savePending() {
  var uid = await getUserId(); if (!uid) return;
  var content = document.getElementById('pending-content').value.trim();
  if (!content) { alert('请输入想法内容'); return; }
  var id = genId();
  var r = await sb.from('pending_pool').insert({id:id,user_id:uid,content:content,priority:'中',activated:false});
  if (r.error) { alert('保存失败'); return; }
  state.pendingPool.unshift({id:id,user_id:uid,content:content,priority:'中',activated:false,created_at:new Date().toISOString()});
  document.getElementById('modal-pending').classList.add('hidden');
  renderPendingPool();
}

async function activatePending(id) {
  var uid = await getUserId(); if (!uid) return;
  var pending = null;
  for (var i=0;i<state.pendingPool.length;i++) { if(state.pendingPool[i].id===id){ pending=state.pendingPool[i]; break; } }
  if (!pending) return;
  // 创建短期目标
  var goalId = genId();
  await sb.from('goals').insert({id:goalId,user_id:uid,content:pending.content,level:'short',priority:'mid',progress:0,archived:false});
  state.goals.unshift({id:goalId,user_id:uid,content:pending.content,level:'short',priority:'mid',progress:0,archived:false,created_at:new Date().toISOString()});
  // 标记为已激活
  await sb.from('pending_pool').update({activated:true}).eq('id',id);
  pending.activated = true;
  renderPendingPool();
  alert('已激活为短期目标！');
}

async function deletePending(id) {
  if (!confirm('确定删除这个想法吗？')) return;
  await sb.from('pending_pool').delete().eq('id',id);
  state.pendingPool = state.pendingPool.filter(function(p){return p.id!==id;});
  renderPendingPool();
}

// ---- 进度页 ----
function renderProgress() {
  renderGoalProgress();
  renderShichenChart();
  renderLabelStats();
  renderEnergyChart();
}

function renderGoalProgress() {
  var container = document.getElementById('progress-overview');
  if (!container) return;
  var active = state.goals.filter(function(g){return !g.archived;});
  if (active.length===0) { container.innerHTML='<p style="font-size:13px;color:var(--text-hint);">暂无目标</p>'; return; }
  var html = '<div class="goal-progress-list">';
  for (var i=0;i<active.length;i++) {
    var g = active[i];
    var pct = g.progress||0;
    html += '<div class="goal-progress-item">';
    html += '<span class="goal-progress-name" title="'+escapeHtml(g.content)+'">'+escapeHtml(g.content).substring(0,15)+'</span>';
    html += '<div class="goal-progress-bar-wrap"><div class="goal-progress-bar-fill" style="width:'+pct+'%"></div></div>';
    html += '<span class="goal-progress-pct">'+pct+'%</span>';
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderShichenChart() {
  var container = document.getElementById('shichen-chart');
  if (!container) return;
  var counts = {};
  SHICHEN_LIST.forEach(function(s){ counts[s.key]=0; });
  var days = Object.keys(state.dailies);
  for (var i=0;i<days.length;i++) {
    var entry = state.dailies[days[i]];
    var shichen = entry.active_shichen||[];
    for (var j=0;j<shichen.length;j++) { counts[shichen[j]] = (counts[shichen[j]]||0)+1; }
  }
  var max = Math.max.apply(null, Object.values(counts));
  var html = '<div class="shichen-chart">';
  SHICHEN_LIST.forEach(function(s){
    var w = max>0 ? Math.max(2,(counts[s.key]/max)*100) : 0;
    html += '<div class="shichen-chart-row">';
    html += '<span class="shichen-chart-label">'+s.name+'</span>';
    html += '<div class="shichen-chart-bar-wrap"><div class="shichen-chart-bar" style="width:'+w+'%"></div></div>';
    html += '<span class="shichen-chart-num">'+counts[s.key]+'</span>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderLabelStats() {
  var container = document.getElementById('label-stats-container');
  if (!container) return;
  var catCounts = {};
  var days = Object.keys(state.dailies);
  for (var i=0;i<days.length;i++) {
    var tasks = state.dailies[days[i]].tasks||[];
    for (var j=0;j<tasks.length;j++) {
      var cid = tasks[j].catId;
      if (cid) { var cat = getCatById(cid); var name = cat ? cat.name : cid; catCounts[name] = (catCounts[name]||0)+1; }
    }
  }
  var names = Object.keys(catCounts);
  if (names.length===0) { container.innerHTML = '<p style="font-size:13px;color:var(--text-hint);">暂无分类数据</p>'; return; }
  var html = '<div class="label-stats">';
  for (var k=0;k<names.length;k++) {
    html += '<div class="label-stat-card"><div class="label-stat-num">'+catCounts[names[k]]+'</div><div class="label-stat-name">'+escapeHtml(names[k])+'</div></div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderEnergyChart() {
  var container = document.getElementById('energy-chart');
  if (!container) return;
  var days = [];
  var d = new Date();
  d.setDate(d.getDate()-13);
  for (var i=0;i<14;i++) {
    days.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
    d.setDate(d.getDate()+1);
  }
  var max = 4;
  var html = '<div class="energy-chart">';
  for (var i=0;i<days.length;i++) {
    var entry = state.dailies[days[i]];
    var level = entry ? entry.energy||0 : 0;
    var h = level/max*100;
    html += '<div class="energy-chart-bar" style="height:'+Math.max(2,h)+'%" title="'+days[i]+': '+level+'/4"></div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

// ---- 记录页 ----
function renderLog() {
  var container = document.getElementById('log-timeline');
  if (!container) return;
  var days = Object.keys(state.dailies).sort().reverse();
  if (days.length===0) { container.innerHTML = '<p style="font-size:13px;color:var(--text-hint);padding:20px 0;">暂无记录。</p>'; return; }
  var html = '';
  for (var i=0;i<days.length;i++) {
    var entry = state.dailies[days[i]];
    var tasks = entry.tasks||[];
    var done = tasks.filter(function(t){return t.done;}).length;
    html += '<div class="log-entry">';
    html += '<span class="log-date">'+days[i]+'</span>';
    html += '<span class="log-summary">';
    html += '任务 '+done+'/'+tasks.length;
    if (entry.energy) html += ' | 精力 '+entry.energy+'/4';
    if (entry.reflection) html += ' | '+escapeHtml(entry.reflection).substring(0,40);
    html += '</span>';
    html += '</div>';
  }
  container.innerHTML = html;
}

// ---- 清空数据 ----
function showClearDialog() {
  document.getElementById('clear-check-all').checked = false;
  var checks = document.querySelectorAll('.clear-check');
  for (var i=0;i<checks.length;i++) checks[i].checked = false;
  document.getElementById('modal-clear').classList.remove('hidden');
}

function toggleClearAll(checked) {
  var checks = document.querySelectorAll('.clear-check');
  for (var i=0;i<checks.length;i++) checks[i].checked = checked;
}

async function confirmClearTables() {
  var checks = document.querySelectorAll('#clear-table-list .clear-check:checked');
  var tables = [];
  for (var i=0;i<checks.length;i++) tables.push(checks[i].value);
  if (tables.length===0) { alert('请至少勾选一项。'); return; }
  if (!confirm('确定要清空已勾选的 '+tables.length+' 个表吗？此操作不可撤销！')) return;

  document.getElementById('modal-clear').classList.add('hidden');
  var uid = await getUserId(); if (!uid) return;
  var errors = [];
  for (var i=0;i<tables.length;i++) {
    var r = await sb.from(tables[i]).delete().eq('user_id',uid);
    if (r.error) errors.push(tables[i]+': '+r.error.message);
  }
  if (errors.length>0) { alert('部分清空失败:\n'+errors.join('\n')); return; }

  if (tables.indexOf('goals')!==-1) state.goals = [];
  if (tables.indexOf('dailies')!==-1) state.dailies = {};
  if (tables.indexOf('contents')!==-1) state.contents = [];
  if (tables.indexOf('pending_pool')!==-1) state.pendingPool = [];
  if (tables.indexOf('categories')!==-1) state.categories = [];

  if (tables.indexOf('goals')!==-1) renderGoals();
  if (tables.indexOf('dailies')!==-1) renderLog();
  if (tables.indexOf('contents')!==-1) renderContent();
  if (tables.indexOf('pending_pool')!==-1) renderPendingPool();
  if (tables.indexOf('categories')!==-1) { populateFilterCats(); renderContent(); }
  if (tables.indexOf('goals')!==-1||tables.indexOf('dailies')!==-1) renderProgress();
  alert('已清空 '+tables.length+' 个表。');
}

// ---- 导入/导出 ----
function exportData() {
  var blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'xinliu-backup-'+todayStr()+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData() { document.getElementById('import-file').click(); }

async function handleImport(e) {
  var uid = await getUserId(); if (!uid) return;
  var file = e.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = async function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      if (data.goals && data.goals.length>0) {
        for (var i=0;i<data.goals.length;i++) {
          var g = data.goals[i];
          await sb.from('goals').upsert({id:g.id,user_id:uid,content:g.content,level:g.level||'short',priority:g.priority||'mid',progress:g.progress||0,parent_id:g.parentId||null,archived:g.archived||false,created_at:g.createdAt||new Date().toISOString(),updated_at:g.updatedAt||new Date().toISOString()});
        }
      }
      if (data.dailies) {
        var dKeys = Object.keys(data.dailies);
        for (var i=0;i<dKeys.length;i++) {
          var e = data.dailies[dKeys[i]];
          await sb.from('dailies').upsert({user_id:uid,day_str:dKeys[i],tasks:e.tasks||[],active_shichen:e.activeShichen||e.active_shichen||[],reflection:e.reflection||'',notes:e.notes||'',energy:e.energy||0,monitoring:e.monitoring||{}},{onConflict:'user_id,day_str'});
        }
      }
      if (data.contents && data.contents.length>0) {
        for (var i=0;i<data.contents.length;i++) {
          var c = data.contents[i];
          await sb.from('contents').upsert({id:c.id,user_id:uid,title:c.title,status:c.status||'想法',platform:c.platform||'',date:c.date||'',note:c.note||'',category_id:c.category_id||null,category_path:c.categoryPath||c.category_path||'',goal_id:c.goalId||c.goal_id||null,created_at:c.createdAt||c.created_at||new Date().toISOString(),updated_at:c.updatedAt||c.updated_at||new Date().toISOString()});
        }
      }
      if (data.pendingPool && data.pendingPool.length>0) {
        for (var i=0;i<data.pendingPool.length;i++) {
          var p = data.pendingPool[i];
          await sb.from('pending_pool').upsert({id:p.id,user_id:uid,content:p.content,priority:p.priority||'中',activated:p.activated||false,created_at:p.createdAt||p.created_at||new Date().toISOString()});
        }
      }
      await loadAllData();
      showPage(currentPage);
      alert('导入完成！');
    } catch(ex) { alert('文件格式错误'); }
  };
  reader.readAsText(file);
}

// ---- 个人中心 ----
function renderProfile() {
  document.getElementById('profile-nickname').value = state.profile.username || '';
  document.getElementById('profile-email').value = '';
  document.getElementById('profile-new-password').value = '';
  document.getElementById('feedback-content').value = '';
  renderAvatar('avatar-preview', state.profile.avatar_url, '?');
  renderCartoonGrid();
  document.getElementById('avatar-file-name').textContent = '';
  document.getElementById('avatar-upload').value = '';
}

async function doUpdateNickname() {
  var name = document.getElementById('profile-nickname').value.trim();
  var uid = await getUserId(); if (!uid) return;
  await sb.from('profiles').upsert({id:uid,username:name},{onConflict:'id'});
  state.profile.username = name;
  document.getElementById('user-name').textContent = name || (state.profile.email||'').split('@')[0];
  alert('昵称已更新');
}

async function doUpdateEmail() {
  var email = document.getElementById('profile-email').value.trim();
  if (!email) { alert('请输入新邮箱'); return; }
  var r = await sb.auth.updateUser({email:email});
  if (r.error) alert('修改失败: '+r.error.message);
  else alert('验证邮件已发送到新邮箱，请确认。');
}

async function doUpdatePassword() {
  var pw = document.getElementById('profile-new-password').value;
  if (!pw || pw.length<6) { alert('密码至少6位'); return; }
  var r = await sb.auth.updateUser({password:pw});
  if (r.error) alert('修改失败: '+r.error.message);
  else alert('密码已更新');
}

async function doSendFeedback() {
  var content = document.getElementById('feedback-content').value.trim();
  if (!content) { alert('请输入反馈内容'); return; }
  var uid = await getUserId();
  var userEmail = (await sb.auth.getUser()).data.user.email;
  await sb.from('feedback').insert({user_id:uid||null,user_email:userEmail,content:content,type:'suggestion'});
  document.getElementById('feedback-content').value = '';
  alert('感谢你的反馈！');
}

// ---- 账号注销 ----
function showDeleteAccount() { document.getElementById('modal-delete-account').classList.remove('hidden'); }

function startDeleteAccount() {
  document.getElementById('modal-delete-account').classList.add('hidden');
  document.getElementById('modal-delete-feedback').classList.remove('hidden');
}

async function sendFeedbackThenDelete() {
  var content = document.getElementById('delete-feedback-content').value.trim();
  if (content) {
    var uid = await getUserId();
    var userEmail = (await sb.auth.getUser()).data.user.email;
    await sb.from('feedback').insert({user_id:uid||null,user_email:userEmail,content:content,type:'delete_feedback'});
  }
  document.getElementById('modal-delete-feedback').classList.add('hidden');
  await executeDeleteAccount();
}

async function executeDeleteAccount() {
  var uid = await getUserId(); if (!uid) return;
  var tables = ['goals','dailies','contents','pending_pool','energy_logs','logs','categories','feedback'];
  for (var i=0;i<tables.length;i++) { await sb.from(tables[i]).delete().eq('user_id',uid); }
  await sb.from('profiles').delete().eq('id',uid);
  await sb.rpc('delete_user');
  alert('账号已注销。');
  await doLogout();
}

// ---- 弹窗关闭 ----
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// ---- 事件委托（核心事件驱动） ----
document.addEventListener('DOMContentLoaded', function() {
  // 认证页事件
  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.addEventListener('click', function() { switchAuthTab(this.dataset.authTab); });
  });
  document.getElementById('btn-login').addEventListener('click', doPasswordLogin);
  document.getElementById('btn-signup').addEventListener('click', doSignup);
  document.getElementById('btn-otp').addEventListener('click', doMagicLink);

  // 导航栏事件委托
  document.querySelector('#app').addEventListener('click', function(e) {
    var target = e.target;
    var page = target.dataset.page;
    if (page) {
      showPage(page);
      document.getElementById('user-dropdown').classList.add('hidden');
      return;
    }
    var action = target.dataset.action;
    if (!action) {
      var parent = target.closest('[data-action]');
      if (parent) action = parent.dataset.action;
    }
    if (!action) return;

    switch(action) {
      case 'addGoal': addGoal(target.dataset.level||target.closest('[data-action]').dataset.level); break;
      case 'editGoal': editGoal(target.dataset.goalId||target.closest('[data-action]').dataset.goalId); break;
      case 'expandGoal': toggleExpandGoal(target.dataset.goalId||target.closest('[data-action]').dataset.goalId); break;
      case 'unarchiveGoal': toggleGoalArchive(target.dataset.goalId||target.closest('[data-action]').dataset.goalId, false); break;
      case 'addContent': addContent(); break;
      case 'editContent': editContent(target.dataset.contentId||target.closest('[data-action]').dataset.contentId); break;
      case 'addPending': addPending(); break;
      case 'activatePending': activatePending(target.dataset.pendingId||target.closest('[data-action]').dataset.pendingId); break;
      case 'deletePending': deletePending(target.dataset.pendingId||target.closest('[data-action]').dataset.pendingId); break;
      case 'exportData': exportData(); break;
      case 'importData': importData(); break;
      case 'showClearDialog': showClearDialog(); break;
      case 'closeModal': closeModal(target.dataset.modal||target.closest('[data-action]').dataset.modal); break;
      case 'setEnergy': setEnergy(parseInt(target.dataset.level||target.closest('[data-action]').dataset.level)); break;
      case 'toggleShichen': toggleShichen(target.dataset.shichen||target.closest('[data-action]').dataset.shichen); break;
      case 'toggleTask': toggleTask(parseInt(target.dataset.idx||target.closest('[data-action]').dataset.idx)); break;
      case 'updateTask': updateTask(parseInt(target.dataset.idx||target.closest('[data-action]').dataset.idx), target.value); break;
      case 'deleteTask': deleteTask(parseInt(target.dataset.idx||target.closest('[data-action]').dataset.idx)); break;
      case 'toggleMonitoring': toggleMonitoring(target.dataset.key||target.closest('[data-action]').dataset.key); break;
      case 'deleteMonitoringItem': deleteMonitoringItem(parseInt(target.dataset.idx||target.closest('[data-action]').dataset.idx)); break;
      case 'deleteCategory': deleteCategory(target.dataset.catId||target.closest('[data-action]').dataset.catId); break;
      case 'selectCartoon': selectCartoon(parseInt(target.dataset.idx||target.closest('[data-action]').dataset.idx)); break;
    }
  });

  // 输入事件委托 (日排表文本域、任务文本等)
  document.querySelector('#app').addEventListener('input', function(e) {
    var target = e.target;
    if (target.id === 'daily-reflection') {
      var entry = getDayEntry(); entry.reflection = target.value; saveDailyDebounced();
    }
    if (target.id === 'daily-notes') {
      var entry = getDayEntry(); entry.notes = target.value; saveDailyDebounced();
    }
    if (target.dataset.action === 'updateTask') {
      updateTask(parseInt(target.dataset.idx), target.value);
    }
  });

  // 目标进度滑块
  var goalProgress = document.getElementById('goal-progress');
  if (goalProgress) goalProgress.addEventListener('input', function() {
    document.getElementById('progress-val').textContent = this.value+'%';
  });

  // 弹窗按钮
  document.getElementById('btn-save-goal').addEventListener('click', saveGoal);
  document.getElementById('btn-delete-goal').addEventListener('click', deleteGoal);
  document.getElementById('btn-toggle-archived').addEventListener('click', toggleArchived);
  document.getElementById('btn-save-content').addEventListener('click', saveContent);
  document.getElementById('btn-delete-content').addEventListener('click', deleteContent);
  document.getElementById('btn-save-pending').addEventListener('click', savePending);
  document.getElementById('btn-cat-add').addEventListener('click', doAddCategory);
  document.getElementById('btn-add-task').addEventListener('click', addTask);
  document.getElementById('btn-edit-monitoring').addEventListener('click', renderMonitoringEditor);
  document.getElementById('btn-add-monitoring-item').addEventListener('click', addMonitoringItem);
  document.getElementById('btn-save-monitoring').addEventListener('click', saveMonitoringItems);
  document.getElementById('btn-clear-confirm').addEventListener('click', confirmClearTables);
  document.getElementById('clear-check-all').addEventListener('change', function() {
    toggleClearAll(this.checked);
  });
  var checks = document.querySelectorAll('.clear-check');
  for (var i=0;i<checks.length;i++) {
    checks[i].addEventListener('change', function() {
      var all = document.querySelectorAll('.clear-check');
      var allChecked = true;
      for (var j=0;j<all.length;j++) { if (!all[j].checked) { allChecked = false; break; } }
      document.getElementById('clear-check-all').checked = allChecked;
    });
  }
  document.getElementById('btn-update-nickname').addEventListener('click', doUpdateNickname);
  document.getElementById('btn-update-email').addEventListener('click', doUpdateEmail);
  document.getElementById('btn-update-password').addEventListener('click', doUpdatePassword);
  document.getElementById('btn-send-feedback').addEventListener('click', doSendFeedback);
  document.getElementById('btn-delete-account').addEventListener('click', showDeleteAccount);
  document.getElementById('btn-confirm-delete').addEventListener('click', startDeleteAccount);
  document.getElementById('btn-skip-and-delete').addEventListener('click', function(){document.getElementById('modal-delete-feedback').classList.add('hidden');executeDeleteAccount();});
  document.getElementById('btn-send-and-delete').addEventListener('click', sendFeedbackThenDelete);
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-avatar-upload').addEventListener('click', function(){ document.getElementById('avatar-upload').click(); });
  document.getElementById('avatar-upload').addEventListener('change', uploadAvatar);

  // 分类筛选
  ['content-filter-l1','content-filter-l2','content-filter-l3'].forEach(function(id) {
    var sel = document.getElementById(id); if (!sel) return;
    sel.addEventListener('change', function() {
      var level = id.indexOf('l1')!==-1?1:id.indexOf('l2')!==-1?2:3;
      onCategoryFilterChange(level);
    });
  });
  document.getElementById('content-filter-status').addEventListener('change', renderContent);
  document.getElementById('content-cat-l1').addEventListener('change', onContentCatL1Change);
  document.getElementById('content-cat-l2').addEventListener('change', onContentCatL2Change);

  // 日期导航
  document.getElementById('daily-date').addEventListener('click', function() {
    var d = prompt('跳转到日期 (YYYY-MM-DD):', currentDay);
    if (d) { currentDay = d; if (!state.dailies[d]) state.dailies[d] = {tasks:[],active_shichen:[],reflection:'',notes:'',energy:0,monitoring:{}}; renderDaily(); }
  });

  // 导航用户下拉
  document.getElementById('nav-user').addEventListener('click', function(e) {
    var dropdownItem = e.target.closest('.user-dropdown-item');
    if (dropdownItem) {
      var page = dropdownItem.dataset.page;
      if (page) { showPage(page); }
      document.getElementById('user-dropdown').classList.add('hidden');
    } else {
      toggleUserMenu();
    }
    e.stopPropagation();
  });

  // 导入文件
  document.getElementById('import-file').addEventListener('change', handleImport);

  // 点击空白处关闭下拉、关闭模态窗 (esc)
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#nav-user')) document.getElementById('user-dropdown').classList.add('hidden');
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach(function(m) {
        if (m.id.indexOf('modal-')===0) m.classList.add('hidden');
      });
    }
  });

  // 分类管理入口 (从内容页)
  var catManageLink = document.getElementById('cat-manage-link');
  if (!catManageLink) {
    // 在内容页筛选区加分类管理按钮
    var filters = document.querySelector('#page-content .content-filters');
    if (filters) {
      var btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-secondary'; btn.textContent = '管理分类'; btn.id = 'cat-manage-link';
      btn.addEventListener('click', openCategoryManager);
      filters.appendChild(btn);
    }
  } else {
    catManageLink.addEventListener('click', openCategoryManager);
  }
});

// ---- 日排表导航（prev/next day） ----
document.addEventListener('DOMContentLoaded', function() {
  var prevBtn = document.querySelector('[data-action="prevDay"]');
  var nextBtn = document.querySelector('[data-action="nextDay"]');
  if (prevBtn) {
    prevBtn.dataset.action = '';
    prevBtn.addEventListener('click', function(){ changeDay(-1); });
  }
  if (nextBtn) {
    nextBtn.dataset.action = '';
    nextBtn.addEventListener('click', function(){ changeDay(1); });
  }
});

// ---- 认证状态监听 ----
var _wasSignedIn = false;
sb.auth.onAuthStateChange(function(event, session) {
  if (session && session.user) {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      loadAllData().then(function() {
        updateUserUI(session.user);
        showPage(currentPage);
        _wasSignedIn = true;
      });
    } else {
      updateUserUI(session.user);
      _wasSignedIn = true;
    }
  } else if (_wasSignedIn || event === 'SIGNED_OUT') {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-message').style.display = 'none';
    _wasSignedIn = false;
  }
});
