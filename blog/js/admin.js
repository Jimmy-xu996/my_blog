// ========== 博客管理后台 JavaScript ==========

// 全局状态
let allAdminPosts = [];
let allCategories = [];
let allTags = [];

// 文章编辑时已选中的标签（存储标签名）
let selectedTagNames = [];

// ========== 工具函数 ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function getTodayDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function groupByYear(posts) {
    const groups = {};
    posts.forEach(p => {
        const year = new Date(p.date || '').getFullYear() || '未知';
        if (!groups[year]) groups[year] = [];
        groups[year].push(p);
    });
    return groups;
}

// ========== Toast 通知 ==========
let toastTimer = null;
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'admin-toast show ' + type;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== 认证状态 ==========
const AUTH_TOKEN_KEY = 'blog_admin_token';
const AUTH_USER_KEY = 'blog_admin_user';

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function getAuthUser() {
    return localStorage.getItem(AUTH_USER_KEY) || '';
}

function setAuthSession(token, username) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, username);
}

function clearAuthSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
}

// ========== UI 控制 ==========

/** 显示主界面（登录后调用）*/
function showMainUI(username) {
    document.getElementById('loginOverlay').style.display = 'none';
    const mainUI = document.getElementById('adminMainUI');
    mainUI.style.display = 'block';
    const el = document.getElementById('currentUsername');
    if (el) el.textContent = username;
}

/** 显示登录界面 */
function showLoginUI() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('adminMainUI').style.display = 'none';
    clearAuthSession();
    // 清空密码框
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').textContent = '';
    document.getElementById('loginUsername').value = '';
    // 清空修改密码表单
    ['oldPassword', 'newPassword', 'confirmPassword'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const errEl = document.getElementById('changePasswordError');
    if (errEl) errEl.textContent = '';
    const sucEl = document.getElementById('changePasswordSuccess');
    if (sucEl) sucEl.textContent = '';
}

// ========== API 请求封装 ==========
async function apiRequest(url, method = 'GET', data = null) {
    const token = getAuthToken();
    const options = {
        method: method,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Accept': 'application/json'
        }
    };
    if (token) {
        options.headers['Authorization'] = 'Bearer ' + token;
    }
    if (data) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);

        // 401 Unauthorized → 清除会话，显示登录界面
        if (response.status === 401) {
            const result = await response.json().catch(() => ({}));
            const msg = result.error || '登录已失效，请重新登录';
            showLoginUI();
            showToast(msg, 'error');
            return null;
        }

        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error('响应解析 JSON 失败:', jsonError, 'URL:', url, '方法:', method);
            showToast('服务器响应异常，请刷新页面后重试', 'error');
            return null;
        }
        if (!response.ok) {
            console.warn('API 请求失败:', { url, method, status: response.status, result });
        }
        return result;
    } catch (error) {
        console.error('API 请求异常:', { url, method, error });
        showToast('服务器连接失败，请确认服务器已启动（bash blog/start_server.sh）', 'error');
        return null;
    }
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async function() {
    // 显示服务器信息
    document.getElementById('serverUrl').textContent = window.location.origin;
    document.getElementById('serverPort').textContent = window.location.port || '(默认端口)';

    // 先检测服务器是否在运行
    const serverOk = await checkServerStatus();
    if (!serverOk) {
        showLoginUI();
        showToast('⚠️ 服务器未启动，请先运行 bash start_server.sh', 'error');
        return;
    }

    // 登录表单事件（必须在 DOMContentLoaded 中绑定，不能等到 initAdminApp）
    document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);

    // 检查登录状态
    const token = getAuthToken();
    if (!token) {
        showLoginUI();
        return;
    }

    // 用已有 token 验证（服务器校验）
    const res = await apiRequest('/api/auth/check');
    if (res && res.loggedIn) {
        // token 有效，显示主界面
        initAdminApp(res.username || getAuthUser());
    } else {
        // token 失效，显示登录界面
        showLoginUI();
    }
});

/** 初始化管理后台（登录成功后调用）*/
async function initAdminApp(username) {
    showMainUI(username);

    // 侧边栏切换
    document.querySelectorAll('.admin-sidebar-menu li').forEach(li => {
        li.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });

    // 搜索与筛选
    document.getElementById('searchInput').addEventListener('input', debounce(filterPosts, 300));
    document.getElementById('categoryFilter').addEventListener('change', filterPosts);
    document.getElementById('categorySearch').addEventListener('input', debounce(renderCategories, 300));
    document.getElementById('tagSearch').addEventListener('input', debounce(renderTags, 300));

    // 文章编辑表单
    document.getElementById('postForm').addEventListener('submit', handlePostSubmit);
    document.getElementById('postContent').addEventListener('input', function() {
        const length = this.value.length;
        document.getElementById('contentLength').textContent = length.toLocaleString();
        document.getElementById('estimateReadTime').textContent = Math.max(1, Math.floor(length / 300));
    });

    // 分类编辑表单
    document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);
    document.getElementById('categoryColor').addEventListener('input', function() {
        document.getElementById('colorPreview').style.background = this.value;
    });

    // 标签编辑表单
    document.getElementById('tagForm').addEventListener('submit', handleTagSubmit);

    // 修改密码表单
    document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
    document.getElementById('tagColor').addEventListener('input', function() {
        document.getElementById('tagColorPreview').style.background = this.value;
    });

    // 资源管理初始化
    initResourceManager();

    // 退出登录按钮
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 加载数据
    await Promise.all([loadAllPosts(), loadCategories(), loadTags(), loadAllResources()]);
    updateSidebarStats();
    renderTagSelector();
}

// ---------- 服务器状态检测 ----------
async function checkServerStatus() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/posts', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res.ok;
    } catch (e) {
        return false;
    }
}

// ---------- 管理后台显示服务器未启动提示 ----------
function showAdminServerOffline() {
    const container = document.querySelector('.admin-content');
    if (!container) return;
    container.innerHTML = `
        <div style="max-width: 720px; margin: 60px auto; padding: 40px; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="font-size: 48px; text-align: center; margin-bottom: 20px;">⚠️</div>
            <h2 style="text-align: center; color: #374151; margin-bottom: 16px;">管理后台服务器未启动</h2>
            <p style="text-align: center; color: #6b7280; margin-bottom: 32px;">无法连接到后端 API，请先启动服务器后再使用管理功能。</p>
            <div style="background: #f9fafb; padding: 24px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0 0 12px 0; color: #374151; font-weight: 600;">启动步骤：</p>
                <code style="display:block;background:#1e293b;color:#e2e8f0;padding:12px 16px;border-radius:6px;margin:8px 0;font-family:monospace;">cd /home/xys/Linux-C-Cplus-Project/blog && bash start_server.sh</code>
            </div>
        </div>`;
}

// ========== 登录 / 登出 / 修改密码 ==========

/** 处理登录表单提交 */
async function handleLoginSubmit(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btnEl = document.getElementById('loginBtn');

    errorEl.textContent = '';
    if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        return false;
    }

    btnEl.disabled = true;
    btnEl.textContent = '登录中...';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({ username, password })
        });

        const result = await res.json();

        if (result.success && result.token) {
            setAuthSession(result.token, result.username);
            initAdminApp(result.username);
        } else {
            errorEl.textContent = result.error || '用户名或密码错误';
            btnEl.disabled = false;
            btnEl.textContent = '登 录';
        }
    } catch (e) {
        errorEl.textContent = '服务器连接失败，请确认服务器已启动';
        btnEl.disabled = false;
        btnEl.textContent = '登 录';
    }

    return false;
}

/** 处理退出登录 */
async function handleLogout() {
    if (!confirm('确定要退出登录吗？')) return;
    // 调用 logout API（让服务器清除会话）
    try {
        await fetch('/api/auth/logout', {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + getAuthToken(),
                'Cache-Control': 'no-cache'
            }
        });
    } catch (e) {
        console.warn('退出登录 API 调用失败:', e);
    } finally {
        clearAuthSession();
        showLoginUI();
        showToast('已退出登录', 'info');
    }
}

/** 处理修改密码表单提交 */
async function handleChangePassword(event) {
    event.preventDefault();
    const oldPwd = document.getElementById('oldPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    const errEl = document.getElementById('changePasswordError');
    const sucEl = document.getElementById('changePasswordSuccess');

    errEl.textContent = '';
    sucEl.textContent = '';

    if (!oldPwd || !newPwd || !confirmPwd) {
        errEl.textContent = '请填写所有密码字段';
        return false;
    }
    if (newPwd.length < 6) {
        errEl.textContent = '新密码长度至少为 6 个字符';
        return false;
    }
    if (newPwd !== confirmPwd) {
        errEl.textContent = '两次输入的新密码不一致';
        return false;
    }

    const res = await apiRequest('/api/auth/change-password', 'PUT', {
        oldPassword: oldPwd,
        newPassword: newPwd
    });

    if (res && res.success) {
        sucEl.textContent = '✅ 密码修改成功！请记住新密码。';
        ['oldPassword', 'newPassword', 'confirmPassword'].forEach(id => {
            document.getElementById(id).value = '';
        });
        setTimeout(() => { sucEl.textContent = ''; }, 5000);
    } else {
        errEl.textContent = res?.error || '密码修改失败';
    }

    return false;
}

// ========== 标签页切换 ==========
function switchTab(tab) {
    document.querySelectorAll('.admin-sidebar-menu li').forEach(li => {
        li.classList.remove('active');
        if (li.dataset.tab === tab) li.classList.add('active');
    });

    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById('tab-' + tab).classList.add('active');

    if (tab === 'stats') renderStatsPage();
    if (tab === 'categories') renderCategories();
    if (tab === 'tags') renderTags();
}

// ========== 加载数据 ==========
async function loadAllPosts() {
    const response = await apiRequest('/api/posts');
    if (response && response.success) {
        allAdminPosts = response.data;
        renderPostList(allAdminPosts);
        updateCategoryFilter();
        updateSidebarStats();
    }
}

async function loadCategories() {
    const response = await apiRequest('/api/categories');
    if (response && response.success) {
        allCategories = response.data;
        renderCategorySelect();      // 更新文章编辑表单的分类下拉
        updateCategoryFilter();       // 更新文章列表的分类筛选器
        renderCategories();           // ⭐ 刷新分类管理页面的卡片列表（实时更新）
        updateSidebarStats();         // ⭐ 刷新侧边栏统计数
    }
}

async function loadTags() {
    const response = await apiRequest('/api/tags');
    if (response && response.success) {
        allTags = response.data;
        renderTagSelector();          // 更新文章编辑表单的标签多选
        renderTags();                 // ⭐ 刷新标签管理页面的卡片列表（实时更新）
        updateSidebarStats();         // ⭐ 刷新侧边栏统计数
    }
}

function updateSidebarStats() {
    document.getElementById('sidebar-post-count').textContent = allAdminPosts.length;
    document.getElementById('sidebar-cat-count').textContent = allCategories.length;
    document.getElementById('sidebar-tag-count').textContent = allTags.length;
    const totalViews = allAdminPosts.reduce((sum, p) => sum + (p.views || 0), 0);
    document.getElementById('sidebar-view-count').textContent = totalViews.toLocaleString();
    document.getElementById('sidebar-resource-count').textContent =
        (window.allResources ? window.allResources.length : 0);
}

// ========== 资源管理 ==========
window.allResources = [];
let currentResourceCategory = 'all';

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(category, filename) {
    const icons = {
        image: '🖼️', document: '📄', video: '🎬',
        audio: '🎵', archive: '📦', code: '💻', other: '📋'
    };
    return icons[category] || '📄';
}

function getFileCategoryColor(category) {
    const colors = {
        image: '#10b981', document: '#3b82f6', video: '#8b5cf6',
        audio: '#f59e0b', archive: '#f97316', code: '#06b6d4', other: '#6b7280'
    };
    return colors[category] || '#6b7280';
}

async function loadAllResources() {
    const res = await apiRequest('/api/resources');
    if (res && res.success) {
        window.allResources = res.data || [];
        updateResourceCategoryStats();
        if (document.getElementById('tab-resources').style.display !== 'none') {
            renderResources();
        }
    }
}

function updateResourceCategoryStats() {
    const cats = ['all', 'image', 'document', 'video', 'audio', 'archive', 'code', 'other'];
    cats.forEach(cat => {
        const el = document.getElementById('catCount-' + cat);
        if (!el) return;
        if (cat === 'all') {
            el.textContent = window.allResources.length;
        } else {
            el.textContent = window.allResources.filter(r => r.category === cat).length;
        }
    });
}

function initResourceManager() {
    // 上传区点击触发文件选择
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    uploadZone.addEventListener('click', function(e) {
        if (e.target.tagName !== 'INPUT') {
            fileInput.click();
        }
    });

    // 文件选择后上传
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            uploadFiles(Array.from(this.files));
        }
    });

    // 拖拽上传
    uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            uploadFiles(files);
        }
    });

    // 分类标签切换
    document.querySelectorAll('.admin-resource-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.admin-resource-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentResourceCategory = this.dataset.cat;
            renderResources();
        });
    });

    // 搜索
    document.getElementById('resourceSearch').addEventListener('input', debounce(renderResources, 300));
}

async function uploadFiles(files) {
    const statusEl = document.getElementById('uploadStatus');
    const progressBar = document.getElementById('uploadProgress');
    const progress = document.getElementById('uploadProgressBar');
    const zone = document.getElementById('uploadZone');

    if (files.length === 0) return;
    statusEl.textContent = '';
    statusEl.className = 'admin-upload-status';
    progressBar.style.display = 'block';
    progress.style.width = '0%';

    const total = files.length;
    let uploaded = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        statusEl.textContent = `上传中 ${i + 1}/${total}：${file.name}...`;
        statusEl.className = 'admin-upload-status';

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + getAuthToken() },
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                uploaded++;
                window.allResources.unshift(result.data);
            } else {
                failed++;
                showToast(`上传失败: ${file.name} — ${result.error}`, 'error');
            }
        } catch (err) {
            failed++;
            showToast(`上传异常: ${file.name}`, 'error');
        }

        // 更新进度条
        progress.style.width = ((i + 1) / total * 100) + '%';
    }

    progressBar.style.display = 'none';
    progress.style.width = '0%';

    if (failed === 0 && uploaded > 0) {
        statusEl.textContent = `✅ 已成功上传 ${uploaded} 个文件`;
        statusEl.className = 'admin-upload-status success';
        updateResourceCategoryStats();
        renderResources();
        updateSidebarStats();
    } else if (failed > 0) {
        statusEl.textContent = `⚠️ 成功 ${uploaded} 个，失败 ${failed} 个`;
        statusEl.className = 'admin-upload-status error';
        updateResourceCategoryStats();
        renderResources();
    }

    setTimeout(() => { statusEl.textContent = ''; }, 4000);
    // 清空文件选择
    document.getElementById('fileInput').value = '';
}

function renderResources() {
    const grid = document.getElementById('resourceGrid');
    const empty = document.getElementById('resourceEmpty');
    const search = (document.getElementById('resourceSearch') || { value: '' }).value.toLowerCase();

    let filtered = window.allResources;
    if (currentResourceCategory !== 'all') {
        filtered = filtered.filter(r => r.category === currentResourceCategory);
    }
    if (search) {
        filtered = filtered.filter(r => (r.originalName || '').toLowerCase().includes(search));
    }

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    grid.innerHTML = filtered.map(r => {
        const isImage = r.category === 'image';
        const icon = getFileIcon(r.category, r.originalName);
        const color = getFileCategoryColor(r.category);
        const url = '/uploads/' + r.savedName;
        const size = formatFileSize(r.size || 0);

        return `<div class="admin-resource-card" data-id="${r.id}">
            ${isImage
                ? `<img class="admin-resource-thumb" src="${url}" alt="${r.originalName}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                   <div class="admin-resource-thumb-placeholder" style="display:none">${icon}<span>${r.originalName.split('.').pop().toUpperCase()}</span></div>`
                : `<div class="admin-resource-thumb-placeholder">${icon}<span>${r.originalName.split('.').pop().toUpperCase()}</span></div>`
            }
            <div class="admin-resource-info">
                <div class="admin-resource-name" title="${r.originalName}">${r.originalName}</div>
                <div class="admin-resource-meta">
                    <span style="color:${color};font-size:10px;font-weight:600;text-transform:uppercase">${r.category}</span>
                    <span>${size}</span>
                </div>
            </div>
            <div class="admin-resource-actions">
                <button class="btn-insert" onclick="insertResource('${url}', '${r.originalName.replace(/'/g, "\\'")}', '${r.category}')">插入</button>
                <button class="btn-delete" onclick="confirmDeleteResource(${r.id}, '${r.originalName.replace(/'/g, "\\'")}')">删除</button>
            </div>
        </div>`;
    }).join('');
}

/** 从文章编辑器工具栏打开资源选择器（切换到资源管理 tab） */
function openResourcePicker() {
    // 切换到资源管理 tab
    document.querySelectorAll('.admin-sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelector('.admin-sidebar-menu li[data-tab="resources"]').classList.add('active');
    document.getElementById('tab-resources').style.display = 'block';

    // 确保数据已加载
    if (window.allResources.length === 0) {
        loadAllResources();
    }
}

/** 将资源以 Markdown 格式插入到文章正文 */
function insertResource(url, originalName, category) {
    const textarea = document.getElementById('postContent');
    if (!textarea) {
        showToast('请先打开文章编辑表单', 'error');
        return;
    }

    const isImage = category === 'image';
    let markdown = '';

    if (isImage) {
        // 图片直接用 Markdown
        markdown = `\n![${originalName}](${url})\n`;
    } else {
        // 其他文件用链接格式
        markdown = `\n[📎 ${originalName}](${url})\n`;
    }

    // 在光标处插入
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + markdown + after;

    // 触发 input 事件（更新字数统计）
    textarea.dispatchEvent(new Event('input'));

    // 设置光标位置
    const newPos = start + markdown.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();

    showToast('✅ 已插入到文章中', 'success');
}

/** 确认并删除资源 */
async function confirmDeleteResource(id, name) {
    if (!confirm(`确定要删除文件「${name}」吗？删除后将无法恢复。`)) return;

    const res = await apiRequest(`/api/resources/${id}`, 'DELETE');
    if (res && res.success) {
        window.allResources = window.allResources.filter(r => r.id !== id);
        updateResourceCategoryStats();
        renderResources();
        updateSidebarStats();
        showToast(`✅ ${name} 已删除`, 'success');
    }
}

// ========== 文章列表渲染 ==========
function renderPostList(posts) {
    const container = document.getElementById('postList');

    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="admin-empty">
                <div class="admin-empty-icon">📝</div>
                <h3 style="margin: 0 0 8px; color: #374151;">还没有文章</h3>
                <p style="color: #6b7280;">点击上方"新增文章"按钮开始创作吧！</p>
            </div>`;
        return;
    }

    const sortedPosts = [...posts].sort((a, b) => {
        return new Date(b.date || '').getTime() - new Date(a.date || '').getTime();
    });

    container.innerHTML = sortedPosts.map(post => `
        <div class="admin-post-card" data-post-id="${post.id}">
            <div class="admin-post-header">
                <div style="flex: 1;">
                    <h3 class="admin-post-title" onclick="viewPost(${post.id})">${escapeHtml(post.title)}</h3>
                    <div class="admin-post-meta">
                        <span>📅 ${escapeHtml(post.date || '')}</span>
                        <span>👁 ${(post.views || 0).toLocaleString()} 阅读</span>
                        <span>⏱ ${post.readTime || 0} 分钟</span>
                        <span>✍️ ${(post.wordCount || 0).toLocaleString()} 字</span>
                        <span>ID: ${post.id}</span>
                    </div>
                </div>
                <div class="admin-post-actions">
                    <button class="admin-btn admin-btn-sm" onclick="viewPost(${post.id})">👁️ 查看</button>
                    <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="editPost(${post.id})">✏️ 编辑</button>
                    <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="deletePost(${post.id})">🗑️ 删除</button>
                </div>
            </div>
            <div class="admin-post-summary">
                ${escapeHtml(post.summary || '').slice(0, 200)}${(post.summary || '').length > 200 ? '...' : ''}
            </div>
            <div class="admin-post-tags">
                <span class="admin-category-badge">📂 ${escapeHtml(post.category || '未分类')}</span>
                ${(post.tags || []).slice(0, 8).map(tag => `<span class="admin-tag">🏷 ${escapeHtml(tag)}</span>`).join('')}
                ${(post.tags || []).length > 8 ? `<span class="admin-tag">+${(post.tags.length - 8)}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ========== 分类下拉列表（筛选用）==========
function updateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;

    const categories = new Set();
    allAdminPosts.forEach(p => { if (p.category) categories.add(p.category); });

    select.innerHTML = '<option value="">全部分类</option>';
    Array.from(categories).sort().forEach(cat => {
        select.innerHTML += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
    });
}

// ========== 文章编辑表单的分类下拉（带自定义新增）==========
function renderCategorySelect() {
    const select = document.getElementById('postCategory');
    if (!select) return;

    select.innerHTML = '<option value="">请选择或输入分类...</option>';
    allCategories.forEach(cat => {
        select.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
    });

    // 允许用户直接输入新分类（使用 list 代替普通 select）
    // 这里保持为 select + 文本输入双方案：
    // 直接把 select 变成可输入的下拉
    const originalSelect = document.getElementById('postCategory');
    // 替换为支持输入的组合：使用普通 input 并附带 datalist
    if (!document.getElementById('postCategoryInput')) {
        const parent = originalSelect.parentNode;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'postCategoryInput';
        input.setAttribute('list', 'postCategoryList');
        input.placeholder = '选择已有分类或输入新分类';
        input.style.cssText = 'padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; width: 100%;';
        const datalist = document.createElement('datalist');
        datalist.id = 'postCategoryList';
        allCategories.forEach(cat => {
            datalist.innerHTML += `<option value="${escapeHtml(cat.name)}">`;
        });
        originalSelect.style.display = 'none';
        parent.insertBefore(input, originalSelect.nextSibling);
        parent.appendChild(datalist);
    } else {
        const datalist = document.getElementById('postCategoryList');
        datalist.innerHTML = '';
        allCategories.forEach(cat => {
            datalist.innerHTML += `<option value="${escapeHtml(cat.name)}">`;
        });
    }
}

// ========== 搜索和筛选 ==========
function filterPosts() {
    const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;

    let filtered = allAdminPosts;
    if (categoryFilter) filtered = filtered.filter(p => p.category === categoryFilter);
    if (keyword) {
        filtered = filtered.filter(p => {
            return (p.title || '').toLowerCase().includes(keyword) ||
                   (p.summary || '').toLowerCase().includes(keyword) ||
                   (p.category || '').toLowerCase().includes(keyword) ||
                   (p.tags || []).some(t => t.toLowerCase().includes(keyword)) ||
                   (p.content || '').toLowerCase().includes(keyword);
        });
    }
    renderPostList(filtered);
}

// ========== 标签选择器（文章编辑表单内）==========
function renderTagSelector() {
    const container = document.getElementById('tagSelector');
    if (!container) return;

    if (!allTags || allTags.length === 0) {
        container.innerHTML = '<small style="color: #6b7280;">暂无已有标签，可在下方输入新标签</small>';
        return;
    }

    container.innerHTML = allTags.map(tag => {
        const isSelected = selectedTagNames.includes(tag.name);
        const color = tag.color || '#2563eb';
        return `<span class="admin-tag ${isSelected ? 'selected' : ''}" 
                  style="background: ${color};"
                  onclick="toggleTag('${escapeHtml(tag.name)}', this)">
                  🏷 ${escapeHtml(tag.name)}
                </span>`;
    }).join('');

    renderSelectedTagsDisplay();
}

function toggleTag(tagName, el) {
    if (selectedTagNames.includes(tagName)) {
        selectedTagNames = selectedTagNames.filter(t => t !== tagName);
        if (el) el.classList.remove('selected');
    } else {
        selectedTagNames.push(tagName);
        if (el) el.classList.add('selected');
    }
    renderSelectedTagsDisplay();
}

function renderSelectedTagsDisplay() {
    const container = document.getElementById('selectedTags');
    if (!container) return;
    if (selectedTagNames.length === 0) {
        container.innerHTML = '<small style="color: #9ca3af;">（尚未选择标签）</small>';
        return;
    }
    container.innerHTML = selectedTagNames.map(name =>
        `<span class="admin-tag" onclick="removeSelectedTag('${escapeHtml(name)}')">${escapeHtml(name)}</span>`
    ).join('');
}

function removeSelectedTag(name) {
    selectedTagNames = selectedTagNames.filter(t => t !== name);
    renderTagSelector();
}

// ========== 新增/编辑文章 ==========
function showPostForm() {
    document.getElementById('postForm').reset();
    document.getElementById('postId').value = '';
    document.getElementById('postDate').value = getTodayDate();
    document.getElementById('postViews').value = '0';
    document.getElementById('postReadTime').value = '10';
    document.getElementById('postWordCount').value = '0';
    document.getElementById('postAuthor').value = '博主';
    document.getElementById('contentLength').textContent = '0';
    document.getElementById('estimateReadTime').textContent = '0';
    document.getElementById('colorPreview').style.background = '#2563eb';

    // 重置标签选择
    selectedTagNames = [];
    // 重置 postCategoryInput 的值
    const catInput = document.getElementById('postCategoryInput');
    if (catInput) catInput.value = '';

    renderTagSelector();
    document.getElementById('postModal').classList.add('show');
}

function editPost(postId) {
    const post = allAdminPosts.find(p => p.id === postId);
    if (!post) { showToast('文章不存在', 'error'); return; }

    document.getElementById('postId').value = post.id;
    document.getElementById('postTitle').value = post.title || '';
    const catInput = document.getElementById('postCategoryInput');
    if (catInput) catInput.value = post.category || '';
    document.getElementById('postDate').value = post.date || getTodayDate();
    document.getElementById('postAuthor').value = post.author || '';
    document.getElementById('postTags').value = '';
    document.getElementById('postViews').value = post.views || 0;
    document.getElementById('postReadTime').value = post.readTime || 10;
    document.getElementById('postWordCount').value = post.wordCount || 0;
    document.getElementById('postSummary').value = post.summary || '';
    document.getElementById('postContent').value = post.content || '';

    // 已选标签 = post.tags
    selectedTagNames = [...(post.tags || [])];
    renderTagSelector();

    const len = (post.content || '').length;
    document.getElementById('contentLength').textContent = len.toLocaleString();
    document.getElementById('estimateReadTime').textContent = Math.max(1, Math.floor(len / 300));

    document.getElementById('postModal').classList.add('show');
}

function closePostForm() {
    document.getElementById('postModal').classList.remove('show');
}

function handlePostSubmit(event) {
    event.preventDefault();

    const postId = document.getElementById('postId').value;
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();

    if (!title) { showToast('请填写文章标题', 'error'); return; }
    if (!content) { showToast('请填写文章内容', 'error'); return; }

    // 分类
    const catInput = document.getElementById('postCategoryInput');
    const category = (catInput ? catInput.value : document.getElementById('postCategory').value || '').trim() || '未分类';

    // 标签 = 已选标签 + 手动输入的新标签（逗号分隔）
    const manualTags = document.getElementById('postTags').value
        .split(/[,，]/).map(t => t.trim()).filter(t => t);
    const finalTags = Array.from(new Set([...selectedTagNames, ...manualTags]));

    const postData = {
        title: title,
        category: category,
        date: document.getElementById('postDate').value || getTodayDate(),
        author: document.getElementById('postAuthor').value.trim() || '博主',
        tags: finalTags,
        views: parseInt(document.getElementById('postViews').value) || 0,
        readTime: parseInt(document.getElementById('postReadTime').value) || 10,
        wordCount: parseInt(document.getElementById('postWordCount').value) || content.length,
        summary: document.getElementById('postSummary').value.trim() || content.slice(0, 200),
        content: content
    };

    if (postId) updatePost(parseInt(postId), postData);
    else createPost(postData);
}

async function createPost(data) {
    const response = await apiRequest('/api/posts', 'POST', data);
    if (response && response.success) {
        showToast('✅ 文章创建成功！', 'success');
        closePostForm();
        await Promise.all([loadAllPosts(), loadCategories(), loadTags()]);
        updateSidebarStats();
    } else {
        showToast(response?.error || '创建文章失败', 'error');
    }
}

async function updatePost(postId, data) {
    const response = await apiRequest('/api/posts/' + postId, 'PUT', data);
    if (response && response.success) {
        showToast('✅ 文章更新成功！', 'success');
        closePostForm();
        await Promise.all([loadAllPosts(), loadCategories(), loadTags()]);
        updateSidebarStats();
    } else {
        showToast(response?.error || '更新文章失败', 'error');
    }
}

async function deletePost(postId) {
    if (!confirm('确定要删除这篇文章吗？此操作不可撤销！')) return;
    const response = await apiRequest('/api/posts/' + postId, 'DELETE');
    if (response && response.success) {
        showToast('🗑️ 文章已删除', 'success');
        await loadAllPosts();
        updateSidebarStats();
    } else {
        showToast(response?.error || '删除文章失败', 'error');
    }
}

function viewPost(postId) {
    window.location.href = 'index.html#/post/' + postId;
}

// ========== 预览文章 ==========
function previewPost() {
    const title = document.getElementById('postTitle').value || '（未填写标题）';
    const content = document.getElementById('postContent').value || '（暂无内容）';
    const catInput = document.getElementById('postCategoryInput');
    const category = (catInput ? catInput.value : '') || '未分类';
    const author = document.getElementById('postAuthor').value || '博主';
    const date = document.getElementById('postDate').value || getTodayDate();
    const manualTags = document.getElementById('postTags').value
        .split(/[,，]/).map(t => t.trim()).filter(t => t);
    const tags = Array.from(new Set([...selectedTagNames, ...manualTags]));

    const previewHtml = `
        <div style="padding: 20px;">
            <h1 style="font-size: 28px; margin-bottom: 16px; color: #111827;">${escapeHtml(title)}</h1>
            <div style="color: #6b7280; font-size: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
                📅 ${escapeHtml(date)} · 📂 ${escapeHtml(category)} · ✍️ ${escapeHtml(author)}
                ${tags.length > 0 ? ' · 🏷 ' + tags.map(t => escapeHtml(t)).join(', ') : ''}
            </div>
            <div style="font-size: 15px; line-height: 1.8; color: #374151;">
                ${typeof window.parseMarkdown === 'function' ? window.parseMarkdown(content) : content.replace(/\n/g, '<br>')}
            </div>
        </div>
    `;
    document.getElementById('previewContent').innerHTML = previewHtml;
    document.getElementById('previewModal').classList.add('show');
}

// ========== 分类管理 ==========
function showCategoryForm() {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryIcon').value = '📂';
    document.getElementById('categoryColor').value = '#2563eb';
    document.getElementById('colorPreview').style.background = '#2563eb';
    document.getElementById('categoryModal').classList.add('show');
}

function editCategory(catId) {
    const cat = allCategories.find(c => c.id === catId);
    if (!cat) { showToast('分类不存在', 'error'); return; }

    document.getElementById('categoryId').value = cat.id;
    document.getElementById('categoryName').value = cat.name || '';
    document.getElementById('categoryIcon').value = cat.icon || '📂';
    document.getElementById('categoryColor').value = cat.color || '#2563eb';
    document.getElementById('categoryDescription').value = cat.description || '';
    document.getElementById('colorPreview').style.background = cat.color || '#2563eb';
    document.getElementById('categoryModal').classList.add('show');
}

function closeCategoryForm() {
    document.getElementById('categoryModal').classList.remove('show');
}

function handleCategorySubmit(event) {
    event.preventDefault();
    const catId = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value.trim();
    if (!name) { showToast('分类名称不能为空', 'error'); return; }

    const data = {
        name: name,
        icon: document.getElementById('categoryIcon').value.trim() || '📂',
        color: document.getElementById('categoryColor').value || '#2563eb',
        description: document.getElementById('categoryDescription').value.trim()
    };

    if (catId) updateCategory(parseInt(catId), data);
    else createCategory(data);
}

async function createCategory(data) {
    const response = await apiRequest('/api/categories', 'POST', data);
    if (response && response.success) {
        showToast('✅ 分类创建成功！', 'success');
        closeCategoryForm();
        await loadCategories();
        updateSidebarStats();
    } else {
        showToast(response?.error || '创建分类失败', 'error');
    }
}

async function updateCategory(catId, data) {
    const response = await apiRequest('/api/categories/' + catId, 'PUT', data);
    if (response && response.success) {
        showToast('✅ 分类更新成功！', 'success');
        closeCategoryForm();
        await loadCategories();
    } else {
        showToast(response?.error || '更新分类失败', 'error');
    }
}

async function deleteCategory(catId) {
    const cat = allCategories.find(c => c.id === catId);
    if (!cat) return;
    const count = cat.postCount || 0;
    const msg = count > 0
        ? `分类"${cat.name}"下还有 ${count} 篇文章，删除会失败，请先修改这些文章的分类。是否继续？`
        : `确定要删除分类"${cat.name}"吗？此操作不可撤销！`;
    if (!confirm(msg)) return;

    const response = await apiRequest('/api/categories/' + catId, 'DELETE');
    if (response && response.success) {
        showToast('🗑️ 分类已删除', 'success');
        await loadCategories();
        updateSidebarStats();
    } else {
        showToast(response?.error || '删除分类失败', 'error');
    }
}

function renderCategories() {
    const container = document.getElementById('categoryList');
    if (!container) return;

    const keyword = (document.getElementById('categorySearch').value || '').toLowerCase();
    const list = allCategories.filter(c =>
        !keyword || (c.name || '').toLowerCase().includes(keyword)
    );

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="admin-empty" style="grid-column: 1 / -1;">
                <div class="admin-empty-icon">📂</div>
                <h3 style="margin: 0 0 8px; color: #374151;">暂无分类</h3>
                <p style="color: #6b7280;">点击上方"新增分类"按钮创建第一个分类吧！</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map(cat => `
        <div class="admin-category-card admin-draggable-item" draggable="true" data-id="${cat.id}" data-type="category">
            <div class="admin-category-header">
                <div class="admin-category-icon" style="background: ${cat.color}22; color: ${cat.color};">
                    ${escapeHtml(cat.icon || '📂')}
                </div>
                <div class="admin-category-name">${escapeHtml(cat.name)}</div>
                <span class="admin-drag-handle" title="拖动排序">⋮⋮</span>
            </div>
            <div class="admin-category-desc">${escapeHtml(cat.description || '暂无描述')}</div>
            <div class="admin-category-stats">
                <div class="admin-category-count">
                    📝 <span>${cat.postCount || 0}</span> 篇文章
                </div>
            </div>
            <div class="admin-card-actions">
                <button class="admin-btn admin-btn-primary" onclick="editCategory(${cat.id})">✏️ 编辑</button>
                <button class="admin-btn admin-btn-danger" onclick="deleteCategory(${cat.id})">🗑️ 删除</button>
            </div>
        </div>
    `).join('');

    // 绑定拖拽事件
    attachDragAndDrop(container, 'category');
}

// ========== 标签管理 ==========
function showTagForm() {
    document.getElementById('tagForm').reset();
    document.getElementById('tagId').value = '';
    document.getElementById('tagColor').value = '#10b981';
    document.getElementById('tagColorPreview').style.background = '#10b981';
    document.getElementById('tagModal').classList.add('show');
}

function editTag(tagId) {
    const tag = allTags.find(t => t.id === tagId);
    if (!tag) { showToast('标签不存在', 'error'); return; }

    document.getElementById('tagId').value = tag.id;
    document.getElementById('tagName').value = tag.name || '';
    document.getElementById('tagColor').value = tag.color || '#10b981';
    document.getElementById('tagDescription').value = tag.description || '';
    document.getElementById('tagColorPreview').style.background = tag.color || '#10b981';
    document.getElementById('tagModal').classList.add('show');
}

function closeTagForm() {
    document.getElementById('tagModal').classList.remove('show');
}

function handleTagSubmit(event) {
    event.preventDefault();
    const tagId = document.getElementById('tagId').value;
    const name = document.getElementById('tagName').value.trim();
    if (!name) { showToast('标签名称不能为空', 'error'); return; }

    const data = {
        name: name,
        color: document.getElementById('tagColor').value || '#10b981',
        description: document.getElementById('tagDescription').value.trim()
    };

    if (tagId) updateTag(parseInt(tagId), data);
    else createTag(data);
}

async function createTag(data) {
    const response = await apiRequest('/api/tags', 'POST', data);
    if (response && response.success) {
        showToast('✅ 标签创建成功！', 'success');
        closeTagForm();
        await loadTags();
        updateSidebarStats();
    } else {
        showToast(response?.error || '创建标签失败', 'error');
    }
}

async function updateTag(tagId, data) {
    const response = await apiRequest('/api/tags/' + tagId, 'PUT', data);
    if (response && response.success) {
        showToast('✅ 标签更新成功！', 'success');
        closeTagForm();
        await loadTags();
    } else {
        showToast(response?.error || '更新标签失败', 'error');
    }
}

async function deleteTag(tagId) {
    const tag = allTags.find(t => t.id === tagId);
    if (!tag) return;
    if (!confirm(`确定要删除标签"${tag.name}"吗？它将从所有文章中移除。`)) return;

    const response = await apiRequest('/api/tags/' + tagId, 'DELETE');
    if (response && response.success) {
        showToast('🗑️ 标签已删除', 'success');
        await loadTags();
        updateSidebarStats();
    } else {
        showToast(response?.error || '删除标签失败', 'error');
    }
}

function renderTags() {
    const container = document.getElementById('tagList');
    if (!container) return;

    const keyword = (document.getElementById('tagSearch').value || '').toLowerCase();
    const list = allTags.filter(t =>
        !keyword || (t.name || '').toLowerCase().includes(keyword)
    );

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="admin-empty" style="grid-column: 1 / -1;">
                <div class="admin-empty-icon">🏷</div>
                <h3 style="margin: 0 0 8px; color: #374151;">暂无标签</h3>
                <p style="color: #6b7280;">点击上方"新增标签"按钮创建第一个标签吧！</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map(tag => `
        <div class="admin-tag-card admin-draggable-item" draggable="true" data-id="${tag.id}" data-type="tag">
            <div class="admin-tag-header">
                <div class="admin-tag" style="background: ${tag.color || '#10b981'};">
                    🏷 ${escapeHtml(tag.name)}
                </div>
                <span class="admin-drag-handle" title="拖动排序">⋮⋮</span>
            </div>
            <div class="admin-tag-desc">${escapeHtml(tag.description || '暂无描述')}</div>
            <div class="admin-tag-stats">
                <div class="admin-tag-count">📝 <span>${tag.postCount || 0}</span> 篇文章使用</div>
            </div>
            <div class="admin-card-actions">
                <button class="admin-btn admin-btn-primary" onclick="editTag(${tag.id})">✏️ 编辑</button>
                <button class="admin-btn admin-btn-danger" onclick="deleteTag(${tag.id})">🗑️ 删除</button>
            </div>
        </div>
    `).join('');

    // 绑定拖拽事件
    attachDragAndDrop(container, 'tag');
}

// ========== 统计页面渲染 ==========
function renderStatsPage() {
    const totalPosts = allAdminPosts.length;
    const totalViews = allAdminPosts.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalWords = allAdminPosts.reduce((sum, p) => sum + (p.wordCount || 0), 0);

    const catCount = {};
    const tagCount = {};
    allAdminPosts.forEach(p => {
        const cat = p.category || '未分类';
        catCount[cat] = (catCount[cat] || 0) + 1;
        (p.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
    });

    const cards = [
        { icon: '📝', value: totalPosts, label: '文章总数' },
        { icon: '👁', value: totalViews.toLocaleString(), label: '总阅读量' },
        { icon: '📊', value: totalWords.toLocaleString(), label: '总字数' },
        { icon: '📂', value: allCategories.length, label: '分类数' },
        { icon: '🏷', value: allTags.length, label: '标签数' },
        { icon: '📅', value: Object.keys(groupByYear(allAdminPosts)).length, label: '发布年份' }
    ];

    document.getElementById('statsGrid').innerHTML = cards.map(c => `
        <div class="admin-stat-card">
            <div class="admin-stat-card-icon">${c.icon}</div>
            <div class="admin-stat-card-value">${c.value}</div>
            <div class="admin-stat-card-label">${c.label}</div>
        </div>
    `).join('');

    const sortedCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
    document.getElementById('categoryStats').innerHTML = sortedCats.length > 0 ? sortedCats.map(([name, count]) => `
        <div class="admin-stat-row">
            <span class="admin-stat-row-name">${escapeHtml(name)}</span>
            <span class="admin-stat-row-count">${count}</span>
        </div>
    `).join('') : '<p style="color: #6b7280;">暂无数据</p>';

    const sortedTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
    document.getElementById('tagStats').innerHTML = sortedTags.length > 0 ? sortedTags.map(([name, count]) => `
        <span class="admin-tag admin-tag-lg" style="font-size: ${12 + Math.min(count * 2, 10)}px;">
            ${escapeHtml(name)} (${count})
        </span>
    `).join('') : '<p style="color: #6b7280;">暂无数据</p>';
}

// ========== 刷新 ==========
function refreshPosts() {
    showToast('🔄 正在刷新...', 'info');
    Promise.all([loadAllPosts(), loadCategories(), loadTags()]).then(() => {
        updateSidebarStats();
        showToast('✅ 刷新完成', 'success');
    });
}

// ========== Markdown 工具栏 ==========
function insertMd(prefix, suffix = '', placeholder = '') {
    const textarea = document.getElementById('postContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end) || placeholder;
    const insertText = prefix + selectedText + suffix;
    textarea.value = textarea.value.substring(0, start) + insertText + textarea.value.substring(end);
    const newCursorPos = start + prefix.length + selectedText.length;
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.dispatchEvent(new Event('input'));
}

// ========== 弹窗背景点击关闭 ==========
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('admin-modal')) {
        e.target.classList.remove('show');
    }
});

// ========== ESC 关闭弹窗 ==========
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.admin-modal.show').forEach(m => m.classList.remove('show'));
    }
});

// ========== 分类/标签 拖拽排序 ==========
let _dragState = null; // { sourceId, sourceType, container }

function attachDragAndDrop(container, type) {
    if (!container) return;
    const items = container.querySelectorAll('.admin-draggable-item');

    items.forEach(item => {
        // 开始拖拽：记录源元素
        item.addEventListener('dragstart', function(e) {
            const id = item.getAttribute('data-id');
            _dragState = { sourceId: id, sourceType: type, container: container };
            item.classList.add('admin-dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Firefox 必须设置 data 才能触发 drag 事件
            try { e.dataTransfer.setData('text/plain', id); } catch (err) {}
        });

        // 拖拽结束：清理样式
        item.addEventListener('dragend', function() {
            item.classList.remove('admin-dragging');
            document.querySelectorAll('.admin-drag-over').forEach(el => el.classList.remove('admin-drag-over'));
            _dragState = null;
        });

        // 经过其他元素：高亮目标
        item.addEventListener('dragover', function(e) {
            if (!_dragState || _dragState.sourceType !== type) return;
            if (_dragState.container !== container) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            items.forEach(i => i.classList.remove('admin-drag-over'));
            item.classList.add('admin-drag-over');
        });

        // 离开：移除高亮
        item.addEventListener('dragleave', function() {
            item.classList.remove('admin-drag-over');
        });

        // 放置：更新顺序并提交到后端
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            if (!_dragState || _dragState.sourceType !== type) return;
            if (_dragState.container !== container) return;

            const sourceId = _dragState.sourceId;
            const targetId = item.getAttribute('data-id');
            if (sourceId === targetId) return;

            // 计算新顺序：把源 item 移到目标 item 之前或之后
            const allDomItems = Array.from(container.querySelectorAll('.admin-draggable-item'));
            const sourceIndex = allDomItems.findIndex(i => i.getAttribute('data-id') === sourceId);
            const targetIndex = allDomItems.findIndex(i => i.getAttribute('data-id') === targetId);
            if (sourceIndex === -1 || targetIndex === -1) return;

            // 按当前 DOM 顺序生成新的 ID 数组
            const newOrder = allDomItems.map(i => parseInt(i.getAttribute('data-id')));
            // 移除源，插入到目标位置
            const fromPos = newOrder.indexOf(parseInt(sourceId));
            const toPos = newOrder.indexOf(parseInt(targetId));
            if (fromPos === -1 || toPos === -1) return;
            const [moved] = newOrder.splice(fromPos, 1);
            newOrder.splice(toPos, 0, moved);

            // 提交到后端
            submitReorder(type, newOrder);
        });
    });
}

async function submitReorder(type, newOrder) {
    const apiPath = type === 'category' ? '/api/categories/reorder' : '/api/tags/reorder';
    const name = type === 'category' ? '分类' : '标签';
    showToast(`⏳ 正在保存${name}排序...`, 'info');

    const response = await apiRequest(apiPath, 'PUT', { idOrder: newOrder });
    if (response && response.success) {
        showToast(`✅ ${name}排序已更新`, 'success');
        // 重新加载数据（后端会按新的 sortOrder 排序返回）
        if (type === 'category') await loadCategories();
        else await loadTags();
    } else {
        showToast(response?.error || `${name}排序更新失败`, 'error');
    }
}
