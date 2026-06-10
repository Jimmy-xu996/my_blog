// ========== 全局变量 ==========
let allPosts = [];
let allCategories = [];   // 全部分类（含自定义颜色/图标/描述）
let allTags = [];          // 全部标签（含自定义颜色）
let currentPage = 'home';

// ========== 工具函数 ==========

// 前台 Toast 提示
let frontendToastTimer = null;
function showToast(message, type = 'info') {
    const toast = document.getElementById('frontend-toast');
    if (!toast) {
        console.warn('Toast:', message);
        return;
    }
    toast.textContent = message;
    toast.className = 'frontend-toast show ' + type;
    if (frontendToastTimer) clearTimeout(frontendToastTimer);
    frontendToastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// 简单的 Markdown 解析器
function parseMarkdown(md) {
    if (!md) return '';
    
    // 先处理代码块（需要单独处理，避免被其他规则影响）
    let html = md;
    const codeBlocks = [];
    
    // 提取代码块
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, lang, code) {
        const idx = codeBlocks.length;
        codeBlocks.push({ lang: lang || '', code: code });
        return `__CODEBLOCK${idx}__`;
    });
    
    // 提取行内代码
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, function(match, code) {
        const idx = inlineCodes.length;
        inlineCodes.push(code);
        return `__INLINECODE${idx}__`;
    });
    
    // 处理标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // 处理粗体和斜体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // 处理表格
    const lines = html.split('\n');
    let result = [];
    let inTable = false;
    let tableRows = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.match(/^\|.+\|$/) && !inTable) {
            inTable = true;
            tableRows = [line];
        } else if (inTable && line.match(/^\|.+\|$/)) {
            tableRows.push(line);
        } else if (inTable) {
            result.push(parseTable(tableRows));
            inTable = false;
            tableRows = [];
            result.push(line);
        } else {
            result.push(line);
        }
    }
    
    if (inTable) {
        result.push(parseTable(tableRows));
    }
    
    html = result.join('\n');
    
    // 处理列表
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
    
    // 处理无序列表组
    html = html.replace(/(<li>.*?<\/li>\n?)+/g, function(match) {
        return '<ul>\n' + match + '</ul>\n';
    });
    
    // 处理段落（简单处理：不在标签内的连续文本）
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(function(p) {
        p = p.trim();
        if (!p) return '';
        if (p.match(/^<(h\d|ul|ol|li|table|blockquote|pre|__CODEBLOCK)/)) {
            return p;
        }
        return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
    
    // 处理引用块
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // 合并相邻的 blockquote
    html = html.replace(/(<\/blockquote>\n<blockquote>)/g, '');
    
    // 恢复行内代码
    html = html.replace(/__INLINECODE(\d+)__/g, function(match, idx) {
        return '<code>' + escapeHtml(inlineCodes[parseInt(idx)]) + '</code>';
    });
    
    // 恢复代码块
    html = html.replace(/__CODEBLOCK(\d+)__/g, function(match, idx) {
        const block = codeBlocks[parseInt(idx)];
        return '<pre><code' + (block.lang ? ' class="lang-' + block.lang + '"' : '') + '>' + escapeHtml(block.code) + '</code></pre>';
    });
    
    return html;
}

function parseTable(rows) {
    if (rows.length < 2) return rows.join('\n');
    
    // 检查第二行是否是分隔符行
    if (!rows[1].match(/^\|[\s:-]+\|$/)) {
        return rows.join('\n');
    }
    
    let html = '<table>\n';
    
    // 表头
    const headers = rows[0].slice(1, -1).split('|').map(h => h.trim());
    html += '<thead><tr>';
    headers.forEach(h => { html += '<th>' + h + '</th>'; });
    html += '</tr></thead>\n';
    
    // 表体
    html += '<tbody>';
    for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].slice(1, -1).split('|').map(c => c.trim());
        html += '<tr>';
        cells.forEach(c => { html += '<td>' + c + '</td>'; });
        html += '</tr>\n';
    }
    html += '</tbody></table>';
    
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 获取年份
function getYear(dateStr) {
    return new Date(dateStr).getFullYear();
}

// 获取统计数据
function getStats(posts) {
    const categories = {};
    const tags = {};
    const archives = {};
    
    posts.forEach(post => {
        const catName = (post.category || '').trim();
        if (catName) {
            categories[catName] = (categories[catName] || 0) + 1;
        }
        (post.tags || []).forEach(tag => {
            const tagName = tag.trim();
            if (tagName) {
                tags[tagName] = (tags[tagName] || 0) + 1;
            }
        });
        const year = getYear(post.date);
        archives[year] = (archives[year] || 0) + 1;
    });
    
    return { categories, tags, archives };
}

// 更新分类和标签的文章计数（确保数据来源不同步时也能正确显示）
function syncCategoryAndTagCounts() {
    const stats = getStats(allPosts);
    
    // 更新分类的文章计数
    allCategories.forEach(cat => {
        const catName = (cat.name || '').trim();
        cat.postCount = stats.categories[catName] || 0;
    });
    
    // 更新标签的文章计数
    allTags.forEach(tag => {
        const tagName = (tag.name || '').trim();
        tag.postCount = stats.tags[tagName] || 0;
    });
}

// 全局统计数据（从API获取的实时数据）
let globalStats = {
    total_posts: 0,
    total_views: 0,
    total_words: 0,
    total_categories: 0,
    total_tags: 0
};

// 从API获取实时统计数据
async function loadStatsFromApi() {
    try {
        const res = await fetch('/api/stats', {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
            const result = await res.json();
            if (result && result.success && result.data) {
                globalStats = result.data;
                console.log(`✅ 已从 API 获取统计数据: ${globalStats.total_posts} 文章 / ${globalStats.total_views.toLocaleString()} 阅读`);
                // 更新页面上的统计显示
                updateStatsDisplay();
            }
        }
    } catch (e) {
        console.warn('获取统计 API 失败:', e);
    }
}

// 更新页面上的统计显示
function updateStatsDisplay() {
    // 更新侧边栏作者卡片统计
    const statValues = document.querySelectorAll('.author-stats .stat-value');
    if (statValues.length >= 4) {
        statValues[0].textContent = globalStats.total_posts;
        statValues[1].textContent = globalStats.total_categories;
        statValues[2].textContent = globalStats.total_tags;
        statValues[3].textContent = globalStats.total_views.toLocaleString();
    }
    
    // 更新关于页统计
    updateAboutStats();
}

// 定时刷新统计数据（每30秒）
let statsRefreshInterval = null;
let dataRefreshInterval = null;

function startStatsRefresh() {
    if (statsRefreshInterval) clearInterval(statsRefreshInterval);
    statsRefreshInterval = setInterval(() => {
        loadStatsFromApi();
    }, 30000);
}

function stopStatsRefresh() {
    if (statsRefreshInterval) {
        clearInterval(statsRefreshInterval);
        statsRefreshInterval = null;
    }
}

// 定时刷新分类和标签数据（每30秒，更频繁以支持前后台同步）
function startDataRefresh() {
    if (dataRefreshInterval) clearInterval(dataRefreshInterval);
    dataRefreshInterval = setInterval(() => {
        loadCategoriesAndTagsFromApi();
    }, 30000); // 改为30秒刷新一次
    
    // 页面可见性变化时立即刷新
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 监听 localStorage 变化（跨标签页同步：后台修改后立即感知）
    window.addEventListener('storage', handleStorageChange);
}

// localStorage 变化处理（跨标签页同步）
function handleStorageChange(e) {
    if (e.key === 'blog_data_changed') {
        try {
            const data = JSON.parse(e.newValue || '{}');
            if (data.type) {
                console.log(`📡 收到同步通知: ${data.type} 数据已更新，立即刷新`);
                loadCategoriesAndTagsFromApi();
                loadStatsFromApi();
            }
        } catch (err) {
            console.warn('解析同步通知失败:', err);
        }
    }
}

// 页面可见性变化处理
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        // 页面变为可见时，立即刷新数据
        console.log('👁️ 页面变为可见，刷新分类和标签数据');
        loadCategoriesAndTagsFromApi();
        loadStatsFromApi();
    }
}

function stopDataRefresh() {
    if (dataRefreshInterval) {
        clearInterval(dataRefreshInterval);
        dataRefreshInterval = null;
    }
}

// 从API刷新分类和标签数据
async function loadCategoriesAndTagsFromApi() {
    try {
        const [catsRes, tagsRes] = await Promise.all([
            fetch('/api/categories', { headers: { 'Cache-Control': 'no-cache' } }),
            fetch('/api/tags', { headers: { 'Cache-Control': 'no-cache' } })
        ]);
        
        let categoriesChanged = false;
        let tagsChanged = false;
        
        if (catsRes.ok) {
            const catData = await catsRes.json();
            if (catData.success && Array.isArray(catData.data)) {
                const oldCategories = allCategories;
                allCategories = catData.data;
                
                // 检测分类是否变化（数量或内容）
                categoriesChanged = hasDataChanged(oldCategories, allCategories, 'id');
                if (categoriesChanged) {
                    console.log(`🔄 分类数据已更新: ${oldCategories.length} -> ${allCategories.length}`);
                    syncCategoryAndTagCounts();
                    refreshSidebarIfVisible();
                    refreshAboutPageIfVisible();
                    // 同时刷新文章管理页面的分类筛选器
                    updateCategoryFilter();
                }
            }
        }
        
        if (tagsRes.ok) {
            const tagData = await tagsRes.json();
            if (tagData.success && Array.isArray(tagData.data)) {
                const oldTags = allTags;
                allTags = tagData.data;
                
                // 检测标签是否变化（数量或内容）
                tagsChanged = hasDataChanged(oldTags, allTags, 'id');
                if (tagsChanged) {
                    console.log(`🔄 标签数据已更新: ${oldTags.length} -> ${allTags.length}`);
                    syncCategoryAndTagCounts();
                    refreshSidebarIfVisible();
                    refreshAboutPageIfVisible();
                }
            }
        }
        
        // 如果有变化，更新统计数据
        if (categoriesChanged || tagsChanged) {
            updateSidebarStats();
        }
    } catch (e) {
        console.warn('刷新分类/标签数据失败:', e);
    }
}

// 检测数据是否变化（比较数组内容）
function hasDataChanged(oldArr, newArr, keyField) {
    if (!Array.isArray(oldArr) || !Array.isArray(newArr)) return true;
    if (oldArr.length !== newArr.length) return true;
    
    // 创建旧数据的Map便于比较
    const oldMap = new Map(oldArr.map(item => [item[keyField], item]));
    
    // 检查每个新数据项是否与旧数据相同
    for (const newItem of newArr) {
        const key = newItem[keyField];
        const oldItem = oldMap.get(key);
        
        if (!oldItem) return true; // 新增项
        
        // 比较关键字段（name, color, icon等）
        const fieldsToCompare = ['name', 'color', 'icon', 'description'];
        for (const field of fieldsToCompare) {
            if (newItem[field] !== oldItem[field]) {
                return true; // 字段值变化
            }
        }
    }
    
    return false;
}

// 如果侧边栏可见则刷新
function refreshSidebarIfVisible() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.innerHTML) {
        renderSidebar(allPosts);
    }
}

// 如果关于页面可见则刷新统计
function refreshAboutPageIfVisible() {
    if (currentPage === 'about') {
        updateAboutStats();
    }
}

// ========== 页面组件 ==========

// 导航栏
function renderNavbar(active) {
    const nav = document.getElementById('navbar');
    nav.innerHTML = `
        <nav class="navbar">
            <div class="nav-container">
                <div class="nav-left">
                    <div class="nav-dropdown" id="navDropdown">
                        <button class="nav-menu-btn" title="更多">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2"/>
                                <circle cx="12" cy="12" r="2"/>
                                <circle cx="12" cy="19" r="2"/>
                            </svg>
                        </button>
                        <div class="dropdown-panel">
                            <div class="dropdown-section">
                                <div class="dropdown-section-title">📚 文档</div>
                                <div class="dropdown-section-items">
                                    <div class="dropdown-section-subtitle">C++在线帮助文档</div>
                                    <a href="https://en.cppreference.com" target="_blank" class="dropdown-item">
                                        <span class="dropdown-item-icon"></span><span>英文版</span>
                                    </a>
                                    <a href="https://zh.cppreference.com" target="_blank" class="dropdown-item">
                                        <span class="dropdown-item-icon"></span><span>中文版</span>
                                    </a>
                                </div>
                            </div>
                            <div class="dropdown-section">
                                <div class="dropdown-section-title">互动</div>
                                <div class="dropdown-section-items">
                                    <a href="/guestbook" class="dropdown-item">
                                        <span class="dropdown-item-icon">�</span><span>留言板</span>
                                    </a>
                                    <a href="https://github.com/Jimmy-xu996" target="_blank" class="dropdown-item">
                                        <span class="dropdown-item-icon">🔷</span><span>GitHub</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <a href="/" class="nav-logo" title="回到首页">
                        <span class="logo-text">📚 技术博客</span>
                        <span class="logo-icon">🏠</span>
                    </a>
                </div>
                <div class="nav-center">
                    <ul class="nav-menu">
                        <li><a href="/columns" class="${active === 'home' || active === 'columns' ? 'active' : ''}">专栏</a></li>
                        <li><a href="/categories" class="${active === 'categories' ? 'active' : ''}">文章分类</a></li>
                        <li><a href="/tags" class="${active === 'tags' ? 'active' : ''}">标签</a></li>
                        <li><a href="/archive" class="${active === 'archive' ? 'active' : ''}">归档</a></li>
                    </ul>
                </div>
                <div class="nav-right">
                    <a href="/search" class="nav-icon-link" title="搜索">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </a>
                    <a href="/about" class="nav-icon-link" title="关于">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </a>
                </div>
            </div>
        </nav>
    `;
}

// 侧边栏
function renderSidebar(posts) {
    const sidebar = document.getElementById('sidebar');
    const stats = getStats(posts);
    const totalViews = globalStats.total_views || posts.reduce((sum, p) => sum + p.views, 0);

    // 优先使用独立分类/标签数据（含自定义颜色、图标、描述），
    // 如果没加载到，则回退到从文章数据推导
    const categoryData = allCategories.length > 0
        ? allCategories.map(c => ({
              name: c.name,
              count: typeof c.postCount === 'number' ? c.postCount : (stats.categories[c.name] || 0),
              color: c.color,
              icon: c.icon,
              description: c.description,
              sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : c.id
          }))
        : Object.entries(stats.categories).map(([name, count]) => ({ name, count, color: '#4a5568', icon: '📂' }));

    // 按后台 sortOrder 排列，与后台拖拽顺序一致
    categoryData.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));

    const tagData = allTags.length > 0
        ? allTags.map(t => ({
              name: t.name,
              count: typeof t.postCount === 'number' ? t.postCount : (stats.tags[t.name] || 0),
              color: t.color,
              sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : t.id
          }))
        : Object.entries(stats.tags).map(([name, count]) => ({ name, count, color: '#2563eb' }));

    // 按后台 sortOrder 排列，与后台拖拽顺序一致
    tagData.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const sortedArchives = Object.entries(stats.archives).sort((a, b) => b[0] - a[0]);

    sidebar.innerHTML = `
        <div class="sidebar-widget author-card">
            <div class="author-avatar">B</div>
            <div class="author-name">爱编程的TomMao</div>
            <div class="author-bio">一名热爱技术的开发者，专注于 C/C++、Linux 及嵌入式开发。</div>
            <div class="author-stats">
                <div class="stat-item">
                    <div class="stat-value">${posts.length}</div>
                    <div class="stat-label">文章</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${categoryData.length}</div>
                    <div class="stat-label">分类</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${tagData.length}</div>
                    <div class="stat-label">标签</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${totalViews.toLocaleString()}</div>
                    <div class="stat-label">阅读</div>
                </div>
            </div>
        </div>

        <div class="sidebar-widget">
            <div class="widget-title">🏷 热门标签 <span style="font-size:12px;color:#a0aec0;font-weight:normal">(${tagData.length})</span></div>
            <div class="tag-list">
                ${tagData.map(tag => `
                    <a href="/tag/${encodeURIComponent(tag.name)}" class="tag"
                       style="background:${escapeHtml(tag.color)};color:white;border-color:${escapeHtml(tag.color)};">
                        ${escapeHtml(tag.name)} (${tag.count})
                    </a>
                `).join('')}
            </div>
        </div>

        <div class="sidebar-widget">
            <div class="widget-title">📅 文章归档</div>
            <ul class="archive-list">
                ${sortedArchives.map(([year, count]) => `
                    <li>
                        <a href="/archive/${year}">
                            <span>${year} 年</span>
                            <span class="category-count">${count}</span>
                        </a>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

// 文章卡片
function renderPostCard(post) {
    return `
        <article class="post-card">
            <h2 class="post-title">
                <a href="/post/${post.id}">${post.title}</a>
            </h2>
            <div class="post-meta">
                <span><span class="icon">📅</span>${formatDate(post.date)}</span>
                <span><span class="icon">👁</span>${post.views.toLocaleString()} 阅读</span>
                <span><span class="icon">⏱</span>${post.readTime} 分钟</span>
                <span><span class="icon">📝</span>${post.wordCount.toLocaleString()} 字</span>
            </div>
            <div class="post-summary">${post.summary}</div>
            <div class="post-tags">
                <span class="category-badge">${post.category}</span>
                ${post.tags.map(tag => `<a href="/tag/${encodeURIComponent(tag)}" class="tag">${tag}</a>`).join('')}
                <a href="/post/${post.id}" class="read-more">阅读全文 →</a>
            </div>
        </article>
    `;
}

// 专栏页面（横幅 + 全部分类）
async function renderColumnsPage() {
    const content = document.getElementById('content');
    
    // 加载首页配置
    let homepageConfig = { title: '📚 技术博客', subtitle: '', announcement: '', banner_type: 'gradient', banner_image: '', show_categories: true, show_tags_cloud: false };
    try {
        const res = await fetch('/api/homepage');
        const result = await res.json();
        if (result.success && result.data) {
            homepageConfig = result.data;
        }
    } catch (e) {}
    
    const stats = getStats(allPosts);
    const totalViews = allPosts.reduce((s, p) => s + p.views, 0);
    
    const categoryList = allCategories.length > 0 ? allCategories : [];
    const tagList = allTags.length > 0 ? allTags : [];
    
    // 全部分类卡片
    const catCards = categoryList.map(c => {
        const count = typeof c.postCount === 'number' ? c.postCount : (stats.categories[c.name] || 0);
        return `<a href="/category/${encodeURIComponent(c.name)}" class="hero-cat-card">
            <span class="hero-cat-icon">${escapeHtml(c.icon || '📂')}</span>
            <span class="hero-cat-name">${escapeHtml(c.name)}</span>
            <span class="hero-cat-count">${count} 篇</span>
        </a>`;
    }).join('');
    
    // 背景样式
    const bannerStyle = homepageConfig.banner_type === 'image' && homepageConfig.banner_image
        ? `background: linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4)), url('${homepageConfig.banner_image}') center/cover;`
        : `background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%); background-size: 400% 400%; animation: gradientShift 8s ease infinite;`;
    
    content.innerHTML = `
        <div class="hero-banner" style="${bannerStyle}">
            <div class="hero-content">
                <h1 class="hero-title">${escapeHtml(homepageConfig.title || '📚 技术博客专栏')}</h1>
                ${homepageConfig.subtitle ? `<p class="hero-subtitle">${escapeHtml(homepageConfig.subtitle)}</p>` : ''}
                <div class="hero-search-row">
                    <div class="hero-search-box">
                        <input type="text" id="heroSearchInput" class="hero-search-input" placeholder="搜索文章...">
                        <button onclick="doHeroSearch()" title="搜索">🔍</button>
                        <button onclick="randomArticle()" title="随机一篇文章">🎲</button>
                    </div>
                </div>
                ${homepageConfig.announcement ? `<div class="hero-announcement">📢 ${escapeHtml(homepageConfig.announcement)}</div>` : ''}
            </div>
            <div class="hero-stats">
                <div class="hero-stat-item" onclick="navigateTo('/')">
                    <div class="hero-stat-num">${allPosts.length}</div>
                    <div class="hero-stat-label">文章</div>
                </div>
                <div class="hero-stat-item" onclick="navigateTo('/categories')">
                    <div class="hero-stat-num">${categoryList.length}</div>
                    <div class="hero-stat-label">分类</div>
                </div>
                <div class="hero-stat-item" onclick="navigateTo('/tags')">
                    <div class="hero-stat-num">${tagList.length}</div>
                    <div class="hero-stat-label">标签</div>
                </div>
                <div class="hero-stat-item">
                    <div class="hero-stat-num">${totalViews.toLocaleString()}</div>
                    <div class="hero-stat-label">阅读</div>
                </div>
            </div>
        </div>
        
        <div class="hero-section">
            <div class="hero-section-title">
                <h2>📂 专栏分类</h2>
                <a href="/categories">全部分类 →</a>
            </div>
            <div class="hero-cat-grid">${catCards}</div>
            
            ${homepageConfig.intro_text ? `
            <div class="hero-intro">
                ${homepageConfig.intro_title ? `<h2>💡 ${escapeHtml(homepageConfig.intro_title)}</h2>` : ''}
                <p>${escapeHtml(homepageConfig.intro_text)}</p>
            </div>
            ` : ''}
        </div>
    `;
    
    // Hero 搜索框事件
    const heroInput = document.getElementById('heroSearchInput');
    if (heroInput) {
        heroInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doHeroSearch();
        });
    }
}

// Hero 搜索
function doHeroSearch() {
    const input = document.getElementById('heroSearchInput');
    if (!input) return;
    const keyword = input.value.trim();
    if (keyword) {
        navigateTo(`/search/${encodeURIComponent(keyword)}`);
    }
}

// 随机文章
function randomArticle() {
    if (allPosts.length === 0) return;
    const idx = Math.floor(Math.random() * allPosts.length);
    navigateTo(`/post/${allPosts[idx].id}`);
}

// 文章列表
function renderPostList(posts, title, subtitle) {
    const content = document.getElementById('content');
    let headerHtml = '';
    
    if (title) {
        headerHtml = `
            <div class="page-header">
                <h1 class="page-title">${title}</h1>
                <p class="page-subtitle">${subtitle || ''}</p>
            </div>
        `;
    }
    
    if (posts.length === 0) {
        content.innerHTML = headerHtml + `
            <div class="no-results">
                <div class="no-results-icon">📭</div>
                <h2>暂无文章</h2>
                <p>这个分类下还没有文章，去看看其他分类吧！</p>
            </div>
        `;
        return;
    }
    
    // 按日期排序（最新的在前）
    const sortedPosts = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    content.innerHTML = headerHtml + `
        <div class="posts-list">
            ${sortedPosts.map(post => renderPostCard(post)).join('')}
        </div>
    `;
}

// 文章详情页
function renderPostDetail(postId) {
    const post = allPosts.find(p => p.id === parseInt(postId));
    const content = document.getElementById('content');
    
    if (!post) {
        content.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">😕</div>
                <h2>文章不存在</h2>
                <p>您要找的文章可能已被删除或链接错误。</p>
            </div>
        `;
        return;
    }
    
    recordPostView(postId);
    
    content.innerHTML = `
        <article class="post-detail">
            <h1 class="post-title">${post.title}</h1>
            <div class="post-meta">
                <span><span class="icon">📅</span>${formatDate(post.date)}</span>
                <span><span class="icon">📂</span><a href="/category/${encodeURIComponent(post.category)}">${post.category}</a></span>
                <span id="views-count"><span class="icon">👁</span>${post.views.toLocaleString()} 阅读</span>
                <span><span class="icon">⏱</span>${post.readTime} 分钟</span>
                <span><span class="icon">📝</span>${post.wordCount.toLocaleString()} 字</span>
            </div>
            <div class="post-content">
                ${parseMarkdown(post.content)}
            </div>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <div class="post-tags">
                    <strong style="color: #4a5568;">标签：</strong>
                    ${post.tags.map(tag => `<a href="/tag/${encodeURIComponent(tag)}" class="tag">${tag}</a>`).join('')}
                </div>
            </div>
            
            <div class="post-actions">
                <button class="action-btn like-btn" onclick="togglePostLike(${postId})">
                    <span class="action-icon">❤️</span>
                    <span class="action-text">点赞</span>
                    <span id="like-count-${postId}" class="action-count">${post.likes || 0}</span>
                </button>
                <button class="action-btn favorite-btn" onclick="togglePostFavorite(${postId})">
                    <span class="action-icon">⭐</span>
                    <span class="action-text">收藏</span>
                    <span id="favorite-count-${postId}" class="action-count">0</span>
                </button>
                <button class="action-btn share-btn" onclick="sharePost(${postId})">
                    <span class="action-icon">🔗</span>
                    <span class="action-text">分享</span>
                </button>
            </div>
            
            <div class="comments-section">
                <h3 class="comments-title">💬 评论区</h3>
                <div id="comments-list-${postId}" class="comments-list"></div>
                
                <div class="comment-form">
                    <div id="reply-hint-${postId}" class="reply-hint" style="display:none;">
                        <span id="reply-hint-text-${postId}"></span>
                        <button class="cancel-reply-btn" onclick="cancelReply(${postId})">✕</button>
                    </div>
                    <textarea id="comment-content-${postId}" placeholder="写下您的评论..." rows="3"></textarea>
                    <div class="comment-form-actions">
                        <button class="submit-btn" onclick="submitComment(${postId})">发表评论</button>
                    </div>
                </div>
            </div>
        </article>
    `;
    
    loadComments(postId);
    loadPostStats(postId);
    
    window.scrollTo(0, 0);
}

// 分类页面（导航栏的「分类」页面）
function renderCategories() {
    const content = document.getElementById('content');
    const stats = getStats(allPosts);

    // 使用独立分类数据（含自定义颜色/图标）
    const categoryList = allCategories.length > 0
        ? allCategories.map(c => ({
              name: c.name,
              count: typeof c.postCount === 'number' ? c.postCount : (stats.categories[c.name] || 0),
              color: c.color,
              icon: c.icon,
              description: c.description,
              sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : c.id
          }))
        : Object.entries(stats.categories).map(([name, count]) => ({
              name, count, color: '#2563eb', icon: '📂', description: ''
          }));

    // 按后台 sortOrder 排列，与后台拖拽顺序一致
    categoryList.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));

    let html = `
        <div class="page-header">
            <h1 class="page-title">📂 文章分类</h1>
            <p class="page-subtitle">共 ${categoryList.length} 个分类，${allPosts.length} 篇文章</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px;">
    `;

    categoryList.forEach(cat => {
        const catPosts = allPosts.filter(p => p.category === cat.name);
        html += `
            <div class="sidebar-widget" style="cursor: pointer; margin-bottom: 0; padding: 20px; border-left: 4px solid ${escapeHtml(cat.color)};"
                 onclick="navigateTo('/category/${encodeURIComponent(cat.name)}')">
                <div class="widget-title" style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:20px">${escapeHtml(cat.icon || '📂')}</span>
                    <span>${escapeHtml(cat.name)}</span>
                </div>
                <p style="color: #718096; font-size: 13px; margin: 8px 0 10px 0; min-height: 36px;">
                    ${escapeHtml(cat.description || '暂无描述')}
                </p>
                <div style="font-size: 13px; color: #4a5568; margin-bottom: 10px;">共 ${cat.count} 篇文章</div>
                <ul style="list-style: none; font-size: 13px;">
                    ${catPosts.slice(0, 3).map(p => `
                        <li style="padding: 6px 0; color: #4a5568; border-bottom: 1px dashed #e2e8f0;">
                            <a href="/post/${p.id}" style="color: #4a5568;">📄 ${escapeHtml(p.title.slice(0, 24))}${p.title.length > 24 ? '...' : ''}</a>
                        </li>
                    `).join('')}
                    ${catPosts.length === 0 ? '<li style="color:#a0aec0;padding:6px 0;">该分类下还没有文章</li>' : ''}
                </ul>
            </div>
        `;
    });

    html += '</div>';
    content.innerHTML = html;
}

// 标签页面
function renderTags() {
    const content = document.getElementById('content');
    const stats = getStats(allPosts);

    // 使用独立标签数据（含自定义颜色）
    const tagList = allTags.length > 0
        ? allTags.map(t => ({
              name: t.name,
              count: typeof t.postCount === 'number' ? t.postCount : (stats.tags[t.name] || 0),
              color: t.color,
              description: t.description,
              sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : t.id
          }))
        : Object.entries(stats.tags).map(([name, count]) => ({
              name, count, color: '#2563eb', description: ''
          }));

    // 按后台 sortOrder 排列，与后台拖拽顺序一致
    tagList.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));

    content.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">🏷 标签云</h1>
            <p class="page-subtitle">共 ${tagList.length} 个标签</p>
        </div>
        <div class="sidebar-widget">
            <div class="tag-list" style="gap: 15px; padding: 20px;">
                ${tagList.map((tag, i) => {
                    const size = 13 + Math.min(tag.count * 2, 14);
                    return `<a href="/tag/${encodeURIComponent(tag.name)}" 
                               style="font-size:${size}px;padding:8px 16px;background:${escapeHtml(tag.color)};color:white;border-color:${escapeHtml(tag.color)};" 
                               class="tag"
                               title="${escapeHtml(tag.description || tag.name)}">
                               ${escapeHtml(tag.name)} (${tag.count})
                            </a>`;
                }).join('')}
            </div>
        </div>
    `;
}

// 归档页面
function renderArchive(year) {
    const content = document.getElementById('content');
    let posts = [...allPosts].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (year) {
        posts = posts.filter(p => getYear(p.date) === parseInt(year));
    }
    
    // 按年份分组
    const grouped = {};
    posts.forEach(p => {
        const y = getYear(p.date);
        if (!grouped[y]) grouped[y] = [];
        grouped[y].push(p);
    });
    
    let html = `
        <div class="page-header">
            <h1 class="page-title">📅 文章归档${year ? ' - ' + year : ''}</h1>
            <p class="page-subtitle">共 ${posts.length} 篇文章</p>
        </div>
    `;
    
    Object.keys(grouped).sort((a, b) => b - a).forEach(y => {
        html += `
            <div class="archive-group">
                <div class="archive-year">${y} 年 (${grouped[y].length} 篇)</div>
                <div class="posts-list">
                    ${grouped[y].map(p => renderPostCard(p)).join('')}
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

// 技术栈文章列表页面
function renderSkillPosts(skillName) {
    const content = document.getElementById('content');
    
    if (!skillName) {
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">⚠️ 错误</h1>
                <p class="page-subtitle">未指定技术栈</p>
            </div>
            <div class="no-results">
                <div class="no-results-icon">🤔</div>
                <h2>未指定技术栈</h2>
                <p>请从关于页面点击技术栈查看相关文章</p>
                <a href="/about" class="read-more">返回关于页面</a>
            </div>
        `;
        return;
    }
    
    const decodedSkill = decodeURIComponent(skillName);
    const mapping = skillMappings[decodedSkill];
    
    if (!mapping) {
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">⚠️ 错误</h1>
                <p class="page-subtitle">未知的技术栈</p>
            </div>
            <div class="no-results">
                <div class="no-results-icon">🤔</div>
                <h2>未知的技术栈</h2>
                <p>"${escapeHtml(decodedSkill)}" 不是有效的技术栈</p>
                <a href="/about" class="read-more">返回关于页面</a>
            </div>
        `;
        return;
    }
    
    // 获取关联的文章
    const relatedPosts = allPosts.filter(post => {
        const postCategory = (post.category || '').toLowerCase();
        const postTags = (post.tags || []).map(t => t.toLowerCase());
        
        const matchedCategory = mapping.categories.some(c => c.toLowerCase() === postCategory);
        const matchedTag = mapping.tags.some(t => postTags.includes(t.toLowerCase()));
        
        return matchedCategory || matchedTag;
    });
    
    // 生成关联的分类和标签说明
    const relatedCategories = mapping.categories.length > 0 
        ? `分类：${mapping.categories.join('、')}` 
        : '';
    const relatedTags = mapping.tags.length > 0 
        ? `标签：${mapping.tags.join('、')}` 
        : '';
    const relatedInfo = [relatedCategories, relatedTags].filter(Boolean).join(' | ');
    
    content.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">${getSkillIcon(decodedSkill)} ${escapeHtml(decodedSkill)}</h1>
            <p class="page-subtitle">相关文章 ${relatedPosts.length} 篇 | ${relatedInfo}</p>
        </div>
        <div id="skillPostsResults"></div>
    `;
    
    const resultsContainer = document.getElementById('skillPostsResults');
    
    if (relatedPosts.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">📭</div>
                <h2>暂无相关文章</h2>
                <p>该分类下暂时没有相关文章，去看看其他技术栈吧！</p>
                <a href="/about" class="read-more">返回关于页面</a>
            </div>
        `;
    } else {
        resultsContainer.innerHTML = `
            <div class="posts-list">
                ${relatedPosts.map(p => renderPostCard(p)).join('')}
            </div>
        `;
    }
}

// 获取技术栈图标
function getSkillIcon(skill) {
    const icons = {
        'C/C++': '⚙️',
        'Linux': '🐧',
        'Qt': '🖥️',
        '数据结构': '📊',
        '设计模式': '🎨',
        'CMake': '🛠️',
        '网络编程': '🌐',
        '算法': '📚'
    };
    return icons[skill] || '📦';
}

// 搜索页面
function renderSearch() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">🔍 文章搜索</h1>
            <p class="page-subtitle">按标题、分类、标签搜索文章</p>
        </div>
        <div class="sidebar-widget" style="margin-bottom: 20px;">
            <input type="text" id="searchInput" class="search-box" placeholder="输入关键词搜索..." autofocus>
        </div>
        <div id="searchResults"></div>
    `;
    
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    
    function doSearch() {
        const keyword = input.value.trim().toLowerCase();
        if (!keyword) {
            results.innerHTML = '<div class="no-results"><p style="font-size: 16px;">请输入关键词开始搜索...</p></div>';
            return;
        }
        
        const matchedPosts = allPosts.filter(p => 
            p.title.toLowerCase().includes(keyword) ||
            p.summary.toLowerCase().includes(keyword) ||
            p.category.toLowerCase().includes(keyword) ||
            p.tags.some(t => t.toLowerCase().includes(keyword)) ||
            p.content.toLowerCase().includes(keyword)
        );
        
        if (matchedPosts.length === 0) {
            results.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <h2>未找到相关文章</h2>
                    <p>没有找到包含 "${keyword}" 的文章，试试其他关键词吧！</p>
                </div>
            `;
        } else {
            results.innerHTML = `
                <p style="color: #4a5568; margin-bottom: 20px;">共找到 ${matchedPosts.length} 篇相关文章</p>
                <div class="posts-list">
                    ${matchedPosts.map(p => renderPostCard(p)).join('')}
                </div>
            `;
        }
    }
    
    input.addEventListener('input', doSearch);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doSearch();
    });
    
    doSearch();
}

// 关于页面
function renderAbout() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="about-page">
            <div class="about-header">
                <div class="about-avatar">B</div>
                <h1 class="about-name">关于本站</h1>
                <p class="about-intro">一个专注于技术分享的个人博客，记录学习心得，分享技术经验。</p>
            </div>
            
            <div class="about-section">
                <h2>📖 博客简介</h2>
                <p style="color: #4a5568; line-height: 1.9; font-size: 16px;">
                    本博客主要分享 C/C++、Linux 系统编程、数据结构与算法、设计模式、开发工具等技术内容。
                    旨在通过高质量的技术文章帮助更多开发者成长，记录学习路上的点滴心得。
                </p>
            </div>
            
            <div class="about-section">
                <h2>💻 技术栈</h2>
                <p style="color: #666; font-size: 14px; margin-bottom: 15px;">点击技术栈查看相关文章</p>
                <div class="skills-grid">
                    <div class="skill-item" onclick="searchBySkill('C/C++')">
                        <div class="skill-icon">⚙️</div>
                        <div class="skill-name">C / C++</div>
                        <div class="skill-count">${getSkillPostCount('C/C++')}</div>
                    </div>
                    <div class="skill-item" onclick="searchBySkill('Linux')">
                        <div class="skill-icon">🐧</div>
                        <div class="skill-name">Linux</div>
                        <div class="skill-count">${getSkillPostCount('Linux')}</div>
                    </div>
                    <div class="skill-item" onclick="searchBySkill('Qt')">
                        <div class="skill-icon">🖥</div>
                        <div class="skill-name">Qt</div>
                        <div class="skill-count">${getSkillPostCount('Qt')}</div>
                    </div>
                    <div class="skill-item" onclick="searchBySkill('数据结构')">
                        <div class="skill-icon">📊</div>
                        <div class="skill-name">数据结构</div>
                        <div class="skill-count">${getSkillPostCount('数据结构')}</div>
                    </div>
                    <div class="skill-item" onclick="searchBySkill('设计模式')">
                        <div class="skill-icon">🎨</div>
                        <div class="skill-name">设计模式</div>
                        <div class="skill-count">${getSkillPostCount('设计模式')}</div>
                    </div>
                    <div class="skill-item" onclick="searchBySkill('CMake')">
                        <div class="skill-icon">🛠</div>
                        <div class="skill-name">CMake</div>
                        <div class="skill-count">${getSkillPostCount('CMake')}</div>
                    </div>
                    <div class="skill-item" onclick="searchBySkill('网络编程')">
                        <div class="skill-icon">🌐</div>
                        <div class="skill-name">网络编程</div>
                        <div class="skill-count">${getSkillPostCount('网络编程')}</div>
                    </div>
                    <div class="skill-item" onclick="searchBySkill('算法')">
                        <div class="skill-icon">📚</div>
                        <div class="skill-name">算法</div>
                        <div class="skill-count">${getSkillPostCount('算法')}</div>
                    </div>
                </div>
            </div>
            
            <div class="about-section">
                <h2>📈 博客统计</h2>
                <div class="skills-grid">
                    <div class="skill-item" onclick="navigateTo('/')" style="cursor:pointer;">
                        <div class="skill-icon">📝</div>
                        <div class="skill-name">文章 <span id="about-post-count">${allPosts.length}</span> 篇</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">👁</div>
                        <div class="skill-name">总阅读 <span id="about-view-count">${allPosts.reduce((s, p) => s + p.views, 0).toLocaleString()}</span></div>
                    </div>
                    <div class="skill-item" onclick="navigateTo('/categories')" style="cursor:pointer;">
                        <div class="skill-icon">📂</div>
                        <div class="skill-name">分类 <span id="about-cat-count">${allCategories.length || Object.keys(getStats(allPosts).categories).length}</span> 个</div>
                    </div>
                    <div class="skill-item" onclick="navigateTo('/tags')" style="cursor:pointer;">
                        <div class="skill-icon">🏷</div>
                        <div class="skill-name">标签 <span id="about-tag-count">${allTags.length || Object.keys(getStats(allPosts).tags).length}</span> 个</div>
                    </div>
                </div>
            </div>
            
            <div class="about-section">
                <h2>📝 留言板</h2>
                <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                    欢迎在下方留下您的想法和建议，<a href="/guestbook" style="color:#4a6cf7;">点击这里查看更多留言</a>
                </p>
                <div id="about-guestbook-messages" class="guestbook-list" style="max-height:300px; overflow-y:auto;"></div>
                <div class="comment-form" style="margin-top:15px;">
                    <div class="guestbook-row">
                        <input type="text" id="about-guestbook-nickname" class="comment-nickname" placeholder="你的昵称（选填）" maxlength="30">
                        <input type="email" id="about-guestbook-email" class="comment-nickname" placeholder="你的邮箱（选填）" maxlength="100">
                    </div>
                    <textarea id="about-guestbook-content" placeholder="写下你的留言..." rows="2" style="min-height:60px;"></textarea>
                    <div class="comment-form-actions">
                        <button class="submit-btn" onclick="submitAboutGuestbookMessage()">发表留言</button>
                        <a href="/guestbook" class="submit-btn" style="background:#6b7280; margin-left:10px; text-decoration:none; display:inline-block;">查看全部</a>
                    </div>
                </div>
            </div>
            
            <div class="about-section">
                <h2>✉️ 联系方式</h2>
                <p style="color: #4a5568; line-height: 1.9; font-size: 16px;">
                    如果您对文章内容有任何问题或建议，欢迎通过以下方式联系我：<br><br>
                    📧 Email: 1635930537@qq.com<br>
                    🐱 GitHub: <a href="https://github.com/1635930537" target="_blank">https://github.com/1635930537</a><br>
                    💬 欢迎在评论区留言讨论<br>
                    🌟 感谢您的阅读与支持！
                </p>
            </div>
        </div>
    `;
    
    // 加载关于页面的留言
    loadAboutGuestbookMessages();
}

// 留言板页面
function renderGuestbook() {
    const content = document.getElementById('content');
    
    content.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">📝 留言板</h1>
            <p class="page-subtitle">欢迎留言交流，分享你的想法和建议</p>
        </div>
        
        <div id="guestbook-messages" class="guestbook-list"></div>
        
        <div class="comment-form">
            <div class="guestbook-row">
                <input type="text" id="guestbook-nickname" class="comment-nickname" placeholder="你的昵称（选填）" maxlength="30">
                <input type="email" id="guestbook-email" class="comment-nickname" placeholder="你的邮箱（选填）" maxlength="100">
            </div>
            <textarea id="guestbook-content" placeholder="写下你的留言..." rows="3"></textarea>
            <div class="comment-form-actions">
                <button class="submit-btn" onclick="submitGuestbookMessage()">发表留言</button>
            </div>
        </div>
    `;
    
    loadGuestbookMessages();
}

// 加载留言板数据
async function loadGuestbookMessages() {
    try {
        const response = await fetch('/api/guestbook');
        const result = await response.json();
        if (result.success) {
            renderGuestbookMessages(result.data);
        }
    } catch (e) {
        console.warn('加载留言失败:', e);
    }
}

// 渲染留言列表
function renderGuestbookMessages(messages) {
    const container = document.getElementById('guestbook-messages');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#9ca3af; padding:30px;">暂无留言，快来发表第一条留言吧！</p>';
        return;
    }
    
    container.innerHTML = messages.map(msg => `
        <div class="comment-item">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(msg.author || '匿名用户')}${msg.email ? ` <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(msg.email)})</span>` : ''}</span>
                <span class="comment-time">${formatDate(msg.created_at)}</span>
            </div>
            <div class="comment-content">${escapeHtml(msg.content)}</div>
        </div>
    `).join('');
}

// ========== 关于页面留言板功能 ==========

// 加载关于页面的留言（只显示前5条）
async function loadAboutGuestbookMessages() {
    try {
        const response = await fetch('/api/guestbook');
        const result = await response.json();
        if (result.success) {
            const messages = (result.data || []).slice(0, 5); // 只显示前5条
            renderAboutGuestbookMessages(messages);
        }
    } catch (e) {
        console.warn('加载留言失败:', e);
    }
}

// 渲染关于页面的留言列表
function renderAboutGuestbookMessages(messages) {
    const container = document.getElementById('about-guestbook-messages');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#9ca3af; padding:15px;">暂无留言，快来发表第一条留言吧！</p>';
        return;
    }
    
    container.innerHTML = messages.map(msg => `
        <div class="comment-item" style="padding:10px; margin-bottom:8px; background:#f8fafc; border-radius:6px;">
            <div class="comment-header" style="margin-bottom:5px;">
                <span class="comment-author" style="font-size:13px;">${escapeHtml(msg.author || '匿名用户')}${msg.email ? ` <span style="color:#9ca3af;font-size:11px;">(${escapeHtml(msg.email)})</span>` : ''}</span>
                <span class="comment-time" style="font-size:12px;">${formatDate(msg.created_at)}</span>
            </div>
            <div class="comment-content" style="font-size:14px;">${escapeHtml(msg.content)}</div>
        </div>
    `).join('');
}

// 提交关于页面的留言
async function submitAboutGuestbookMessage() {
    const nicknameEl = document.getElementById('about-guestbook-nickname');
    const emailEl = document.getElementById('about-guestbook-email');
    const contentEl = document.getElementById('about-guestbook-content');
    const nickname = (nicknameEl?.value || '').trim();
    const email = (emailEl?.value || '').trim();
    const content = (contentEl?.value || '').trim();
    
    if (!content) {
        alert('请输入留言内容');
        return;
    }
    
    try {
        const response = await fetch('/api/guestbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, author: nickname || undefined, email: email || undefined })
        });
        
        const result = await response.json();
        if (result.success) {
            contentEl.value = '';
            if (nicknameEl) nicknameEl.value = '';
            if (emailEl) emailEl.value = '';
            loadAboutGuestbookMessages();
            showToast('留言发表成功', 'success');
        } else {
            alert(result.error || result.message || '留言失败');
        }
    } catch (e) {
        console.error('留言失败:', e);
        alert('留言失败，请重试');
    }
}

// 提交留言
async function submitGuestbookMessage() {
    const nicknameEl = document.getElementById('guestbook-nickname');
    const emailEl = document.getElementById('guestbook-email');
    const contentEl = document.getElementById('guestbook-content');
    const nickname = (nicknameEl?.value || '').trim();
    const email = (emailEl?.value || '').trim();
    const content = (contentEl?.value || '').trim();
    
    if (!content) {
        alert('请输入留言内容');
        return;
    }
    
    try {
        const response = await fetch('/api/guestbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, author: nickname || undefined, email: email || undefined })
        });
        
        const result = await response.json();
        if (result.success) {
            contentEl.value = '';
            if (nicknameEl) nicknameEl.value = '';
            if (emailEl) emailEl.value = '';
            loadGuestbookMessages();
            showToast('留言发表成功', 'success');
        } else {
            alert(result.error || result.message || '留言失败');
        }
    } catch (e) {
        console.error('留言失败:', e);
        alert('留言失败，请重试');
    }
}

// 更新关于页统计（数据变化时调用）
function updateAboutStats() {
    if (!document.getElementById('about-post-count')) return;
    const postEl = document.getElementById('about-post-count');
    const viewEl = document.getElementById('about-view-count');
    const catEl = document.getElementById('about-cat-count');
    const tagEl = document.getElementById('about-tag-count');
    if (postEl) postEl.textContent = allPosts.length;
    if (viewEl) viewEl.textContent = allPosts.reduce((s, p) => s + p.views, 0).toLocaleString();
    // 优先使用 API 数据，回退到文章统计
    if (catEl) catEl.textContent = allCategories.length || Object.keys(getStats(allPosts).categories).length;
    if (tagEl) tagEl.textContent = allTags.length || Object.keys(getStats(allPosts).tags).length;
}

// ===== 评论系统 =====

// 记录文章阅读
async function recordPostView(postId) {
    try {
        const response = await fetch('/api/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId })
        });
        const result = await response.json();
        if (result.success) {
            const viewsEl = document.getElementById('views-count');
            if (viewsEl) {
                viewsEl.innerHTML = `<span class="icon">👁</span>${result.data.views.toLocaleString()} 阅读`;
            }
        }
    } catch (e) {
        console.warn('记录阅读失败:', e);
    }
}

// 加载文章统计
async function loadPostStats(postId) {
    try {
        const [viewsRes, favoritesRes] = await Promise.all([
            fetch(`/api/views/${postId}`),
            fetch(`/api/favorites/count/${postId}`)
        ]);
        
        if (viewsRes.ok) {
            const viewsResult = await viewsRes.json();
            if (viewsResult.success) {
                const viewsEl = document.getElementById('views-count');
                if (viewsEl) {
                    viewsEl.innerHTML = `<span class="icon">👁</span>${viewsResult.data.views.toLocaleString()} 阅读`;
                }
            }
        }
        
        if (favoritesRes.ok) {
            const favoritesResult = await favoritesRes.json();
            if (favoritesResult.success) {
                const favCountEl = document.getElementById(`favorite-count-${postId}`);
                if (favCountEl) {
                    favCountEl.textContent = favoritesResult.data.count;
                }
            }
        }
    } catch (e) {
        console.warn('加载统计失败:', e);
    }
}

// 加载评论
async function loadComments(postId) {
    try {
        const response = await fetch(`/api/comments/post/${postId}`);
        const result = await response.json();
        if (result.success) {
            renderComments(postId, result.data);
        }
    } catch (e) {
        console.warn('加载评论失败:', e);
    }
}

// 渲染评论
function renderComments(postId, comments) {
    const container = document.getElementById(`comments-list-${postId}`);
    if (!container) return;
    
    if (!comments || comments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 20px;">暂无评论，快来发表第一条评论吧！</p>';
        return;
    }
    
    const nestedComments = buildCommentTree(comments);
    
    let html = '';
    nestedComments.forEach(comment => {
        html += renderCommentItem(comment);
    });
    
    container.innerHTML = html;
}

// 构建评论树
function buildCommentTree(comments) {
    const commentMap = {};
    const rootComments = [];
    
    comments.forEach(comment => {
        commentMap[comment.id] = { ...comment, children: [] };
    });
    
    comments.forEach(comment => {
        if (comment.parent_id && commentMap[comment.parent_id]) {
            commentMap[comment.parent_id].children.push(commentMap[comment.id]);
        } else {
            rootComments.push(commentMap[comment.id]);
        }
    });
    
    return rootComments;
}

// 渲染单个评论
function renderCommentItem(comment, depth = 0) {
    const indentStyle = depth > 0 ? `style="margin-left: ${depth * 30}px; padding-left: 15px; border-left: 2px solid #e2e8f0;"` : '';
    const currentUser = localStorage.getItem('username') || '';
    const isAuthor = currentUser && comment.author === currentUser;
    
    let html = `
        <div class="comment-item" ${indentStyle}>
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.author || '匿名用户')}</span>
                <span class="comment-time">${formatDate(comment.created_at)}</span>
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
            <div class="comment-actions">
                <button class="comment-action-btn" onclick="toggleCommentLike(${comment.id})">
                    <span>👍</span>
                    <span>${comment.likes || 0}</span>
                </button>
                <button class="comment-action-btn" onclick="replyToComment(${comment.id}, ${comment.post_id})">
                    <span>💬</span>
                    <span>回复</span>
                </button>
                ${isAuthor ? `<button class="comment-action-btn delete-btn" onclick="deleteComment(${comment.id}, ${comment.post_id})" title="删除">
                    <span>🗑️</span>
                </button>` : ''}
            </div>
    `;
    
    if (comment.children && comment.children.length > 0) {
        html += '<div class="comment-children">';
        comment.children.forEach(child => {
            html += renderCommentItem(child, depth + 1);
        });
        html += '</div>';
    }
    
    html += '</div>';
    
    return html;
}

// 提交评论
async function submitComment(postId) {
    const contentEl = document.getElementById(`comment-content-${postId}`);
    const content = (contentEl.value || '').trim();
    
    if (!content) {
        alert('请输入评论内容');
        return;
    }
    
    const payload = {
        post_id: postId,
        content: content,
        author: '匿名用户'
    };
    
    // 如果是回复评论，携带 parent_id
    if (replyParentMap[postId]) {
        payload.parent_id = replyParentMap[postId];
    }
    
    try {
        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.success) {
            contentEl.value = '';
            cancelReply(postId);
            loadComments(postId);
        } else {
            alert(result.error || result.message || '发表评论失败');
        }
    } catch (e) {
        console.error('提交评论失败:', e);
        alert('发表评论失败');
    }
}

// 当前回复的父评论ID（按文章ID存储）
const replyParentMap = {};

// 回复评论
function replyToComment(commentId, postId) {
    replyParentMap[postId] = commentId;
    
    const hintEl = document.getElementById(`reply-hint-${postId}`);
    const hintTextEl = document.getElementById(`reply-hint-text-${postId}`);
    const contentEl = document.getElementById(`comment-content-${postId}`);
    
    if (hintEl) hintEl.style.display = 'flex';
    if (hintTextEl) hintTextEl.textContent = `正在回复评论 #${commentId}`;
    if (contentEl) {
        contentEl.placeholder = '写下回复...';
        contentEl.focus();
    }
}

// 取消回复
function cancelReply(postId) {
    delete replyParentMap[postId];
    
    const hintEl = document.getElementById(`reply-hint-${postId}`);
    const contentEl = document.getElementById(`comment-content-${postId}`);
    
    if (hintEl) hintEl.style.display = 'none';
    if (contentEl) {
        contentEl.value = '';
        contentEl.placeholder = '写下您的评论...';
    }
}

// 点赞评论
async function toggleCommentLike(commentId) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再点赞');
        navigateTo('/login');
        return;
    }
    
    try {
        const response = await fetch('/api/comments/like', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ comment_id: commentId })
        });
        
        const result = await response.json();
        if (result.success) {
            const buttons = document.querySelectorAll(`.comment-action-btn`);
            buttons.forEach(btn => {
                const likeSpan = btn.querySelector('span:first-child');
                if (likeSpan && likeSpan.textContent === '👍') {
                    const countEl = btn.querySelector('span:last-child');
                    if (countEl) {
                        countEl.textContent = result.data.likes;
                    }
                }
            });
        }
    } catch (e) {
        console.error('点赞失败:', e);
    }
}

// 删除评论
async function deleteComment(commentId, postId) {
    if (!confirm('确定要删除这条评论吗？')) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        if (result.success) {
            loadComments(postId);
        } else {
            alert(result.error || '删除失败');
        }
    } catch (e) {
        console.error('删除评论失败:', e);
        alert('删除失败');
    }
}

// ===== 文章互动 =====

// 点赞文章
async function togglePostLike(postId) {
    try {
        const response = await fetch('/api/posts/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId })
        });
        
        const result = await response.json();
        if (result.success) {
            const likeBtn = document.querySelector('.like-btn');
            const likeCountEl = document.getElementById(`like-count-${postId}`);
            
            if (likeBtn) {
                likeBtn.classList.toggle('liked', result.data.liked);
            }
            if (likeCountEl) {
                likeCountEl.textContent = result.data.likes;
            }
        }
    } catch (e) {
        console.error('点赞失败:', e);
    }
}

// 收藏文章
async function togglePostFavorite(postId) {
    try {
        const response = await fetch('/api/favorites/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId })
        });
        
        const result = await response.json();
        if (result.success) {
            const favBtn = document.querySelector(`.favorite-btn`);
            const favCountEl = document.getElementById(`favorite-count-${postId}`);
            
            if (favBtn) {
                favBtn.classList.toggle('favorited', result.data.is_favorited);
            }
            if (favCountEl) {
                favCountEl.textContent = result.data.count;
            }
            
            alert(result.message);
        }
    } catch (e) {
        console.error('收藏失败:', e);
        alert('操作失败');
    }
}

// 分享文章
function sharePost(postId) {
    const post = allPosts.find(p => p.id === parseInt(postId));
    if (!post) return;
    
    const url = `${window.location.origin}/post/${postId}`;
    const text = `推荐阅读：${post.title}`;
    
    if (navigator.share) {
        navigator.share({
            title: post.title,
            text: text,
            url: url
        }).catch(() => {
            copyToClipboard(url);
        });
    } else {
        copyToClipboard(url);
    }
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('链接已复制到剪贴板');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('链接已复制到剪贴板');
    });
}

// ===== 技术栈搜索功能 =====

// 技术栈到分类/标签的映射
const skillMappings = {
    'C/C++': { categories: ['C++', 'C'], tags: ['C++', 'C'] },
    'Linux': { categories: ['Linux'], tags: ['Linux', '系统调用', '线程同步'] },
    'Qt': { categories: [], tags: ['Qt'] },
    '数据结构': { categories: ['数据结构'], tags: ['数据结构'] },
    '设计模式': { categories: [], tags: ['设计模式'] },
    'CMake': { categories: [], tags: ['CMake', '构建工具'] },
    '网络编程': { categories: ['HTTP', 'TCP/IP'], tags: ['网络编程', 'HTTP', 'TCP/IP'] },
    '算法': { categories: [], tags: ['算法'] }
};

// 获取技术栈相关的文章数量
function getSkillPostCount(skill) {
    const mapping = skillMappings[skill];
    if (!mapping) return 0;
    
    let count = 0;
    allPosts.forEach(post => {
        const postCategory = (post.category || '').toLowerCase();
        const postTags = (post.tags || []).map(t => t.toLowerCase());
        
        const matchedCategory = mapping.categories.some(c => c.toLowerCase() === postCategory);
        const matchedTag = mapping.tags.some(t => postTags.includes(t.toLowerCase()));
        
        if (matchedCategory || matchedTag) {
            count++;
        }
    });
    
    return count;
}

// 点击技术栈查看相关文章
function searchBySkill(skill) {
    const mapping = skillMappings[skill];
    if (!mapping) return;
    
    // 跳转到技术栈文章列表页面
    navigateTo(`/skill/${encodeURIComponent(skill)}`);
}

// ========== 路由系统 ==========

function navigateTo(path) {
    history.pushState(null, '', path);
    router();
}

function router() {
    // 全局数据兜底，确保任何情况下都不会因 .length 崩溃
    allPosts = Array.isArray(allPosts) ? allPosts : [];
    allCategories = Array.isArray(allCategories) ? allCategories : [];
    allTags = Array.isArray(allTags) ? allTags : [];

    // 同步分类和标签的文章计数（确保数据始终准确）
    syncCategoryAndTagCounts();

    const path = window.location.pathname || '/home';
    const parts = path.split('/').filter(p => p);
    
    const page = parts[0] || 'home';
    const param1 = decodeURIComponent(parts[1] || '');
    
    renderNavbar(page);
    renderSidebar(allPosts);
    
    switch (page) {
        case 'home':
        case 'columns':
            renderColumnsPage();
            break;
        case 'post':
            renderPostDetail(param1);
            break;
        case 'category':
            const catPosts = allPosts.filter(p => p.category === param1);
            renderPostList(catPosts, `📂 ${param1}`, `共 ${catPosts.length} 篇文章`);
            break;
        case 'tag':
            const tagPosts = allPosts.filter(p => p.tags.includes(param1));
            renderPostList(tagPosts, `🏷 ${param1}`, `共 ${tagPosts.length} 篇文章`);
            break;
        case 'categories':
            renderCategories();
            break;
        case 'tags':
            renderTags();
            break;
        case 'archive':
            renderArchive(param1);
            break;
        case 'search':
            renderSearch();
            break;
        case 'skill':
            renderSkillPosts(param1);
            break;
        case 'about':
            renderAbout();
            break;
        case 'guestbook':
            renderGuestbook();
            break;
        default:
            renderPostList(allPosts);
    }
    
    renderFooter();
    
    // 每次路由变化时，重新从 API 获取最新的统计数据
    loadStatsFromApi();
}

// 页脚
function renderFooter() {
    const footer = document.getElementById('footer');
    const year = new Date().getFullYear();
    footer.innerHTML = `
        <footer class="footer">
            <div class="footer-content">
                <p class="footer-text">© ${year} 技术博客 | Powered by ❤️</p>
                <p class="footer-text">一个分享技术知识的个人博客</p>
            </div>
        </footer>
    `;
}

// ========== 初始化 ==========

// 统一的数据加载函数
async function loadFromApi(path) {
    try {
        const res = await fetch(path, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data && data.success && Array.isArray(data.data)) ? data.data : null;
    } catch (e) {
        return null;
    }
}

async function loadFromJson(path) {
    try {
        const res = await fetch(path, { headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function initBlog() {
    // 检查当前页面是否是管理后台（管理后台有自己的初始化逻辑）
    if (document.getElementById('postList')) {
        return;
    }

    // 全局数据兜底：确保任何时候调用 .length 都不会崩溃
    allPosts = allPosts || [];
    allCategories = allCategories || [];
    allTags = allTags || [];

    let serverOK = false;

    // ---------- 第一步：尝试聚合 API（最快路径）----------
    try {
        const res = await fetch('/api/bootstrap', {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
            const result = await res.json();
            if (result && result.success && result.data) {
                const d = result.data;
                allPosts = Array.isArray(d.posts) ? d.posts : [];
                allCategories = Array.isArray(d.categories) ? d.categories : [];
                allTags = Array.isArray(d.tags) ? d.tags : [];
                console.log(`⚡ 聚合 API 加载成功：${allPosts.length} 篇文章 / ${allCategories.length} 分类 / ${allTags.length} 标签`);
                serverOK = true;
                _finishInitBlog();
                return;
            }
        }
    } catch (e) {
        console.warn('聚合 API 不可用（服务器可能未启动）:', e);
    }

    // ---------- 第二步：回退到并行 3 个 API 请求 ----------
    try {
        const [apiPosts, apiCats, apiTags] = await Promise.all([
            loadFromApi('/api/posts'),
            loadFromApi('/api/categories'),
            loadFromApi('/api/tags')
        ]);

        if (apiPosts) {
            allPosts = apiPosts;
            serverOK = true;
            console.log(`✅ 已从 API 加载 ${allPosts.length} 篇文章`);
        }
        if (apiCats) {
            allCategories = apiCats;
            console.log(`✅ 已从 API 加载 ${allCategories.length} 个分类`);
        }
        if (apiTags) {
            allTags = apiTags;
            console.log(`✅ 已从 API 加载 ${allTags.length} 个标签`);
        }
    } catch (e) {
        console.warn('并行 API 请求失败:', e);
    }

    // ---------- 第三步：回退到本地 JSON 文件 ----------
    if (!serverOK || allPosts.length === 0) {
        try {
            const jsonPosts = await loadFromJson('data/posts.json');
            if (Array.isArray(jsonPosts) && jsonPosts.length > 0) {
                allPosts = jsonPosts;
                console.log(`ℹ️  已从 data/posts.json 加载 ${allPosts.length} 篇文章`);
            }
        } catch (e) { /* 忽略 */ }
    }

    if (allCategories.length === 0) {
        try {
            const jsonCats = await loadFromJson('data/categories.json');
            if (Array.isArray(jsonCats)) allCategories = jsonCats;
        } catch (e) { /* 忽略 */ }
    }

    if (allTags.length === 0) {
        try {
            const jsonTags = await loadFromJson('data/tags.json');
            if (Array.isArray(jsonTags)) allTags = jsonTags;
        } catch (e) { /* 忽略 */ }
    }

    // ---------- 第四步：最终兜底：空数组 + 提示 ----------
    allPosts = Array.isArray(allPosts) ? allPosts : [];
    allCategories = Array.isArray(allCategories) ? allCategories : [];
    allTags = Array.isArray(allTags) ? allTags : [];

    // 如果连 JSON 回退都拿不到文章数据，显示"服务器未启动"提示
    if (!serverOK && allPosts.length === 0) {
        renderServerOfflinePage();
        // 仍然注册路由监听，方便服务器启动后手动刷新
        window.addEventListener('popstate', function () { location.reload(); });
        return;
    }

    _finishInitBlog();
}

// 服务器未运行时显示的提示页
function renderServerOfflinePage() {
    const navbar = document.getElementById('navbar');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    const footer = document.getElementById('footer');

    if (navbar) navbar.innerHTML = `
        <nav class="navbar">
            <div class="nav-container">
                <div class="nav-brand"><a href="/" style="color:inherit;text-decoration:none;">📚 技术博客</a></div>
                <ul class="nav-menu">
                    <li><a href="/columns">专栏</a></li>
                    <li><a href="/categories">文章分类</a></li>
                    <li><a href="/tags">标签</a></li>
                    <li><a href="/archive">归档</a></li>
                    <li><a href="/about">关于</a></li>
                </ul>
            </div>
        </nav>`;

    if (sidebar) sidebar.innerHTML = '';

    if (content) content.innerHTML = `
        <div class="server-offline">
            <div class="offline-icon">⚠️</div>
            <h2>博客服务器未启动</h2>
            <p class="offline-desc">无法从服务器获取文章数据，请按以下步骤启动后端：</p>
            <div class="offline-steps">
                <div class="step-item">
                    <span class="step-num">1</span>
                    <div>
                        <div class="step-title">打开终端</div>
                        <div class="step-cmd">进入博客目录</div>
                        <code>cd /home/xys/Linux-C-Cplus-Project/blog</code>
                    </div>
                </div>
                <div class="step-item">
                    <span class="step-num">2</span>
                    <div>
                        <div class="step-title">停止旧服务（如果有）</div>
                        <code>bash start_server.sh stop</code>
                    </div>
                </div>
                <div class="step-item">
                    <span class="step-num">3</span>
                    <div>
                        <div class="step-title">启动服务器</div>
                        <code>bash start_server.sh</code>
                    </div>
                </div>
                <div class="step-item">
                    <span class="step-num">4</span>
                    <div>
                        <div class="step-title">启动后刷新本页面</div>
                        <button class="admin-btn admin-btn-primary" onclick="location.reload()">🔄 重新加载</button>
                    </div>
                </div>
            </div>
        </div>`;

    if (footer) footer.innerHTML = '';
}

function _finishInitBlog() {
    // 数据加载完成后，同步更新分类和标签的文章计数
    syncCategoryAndTagCounts();
    // 更新关于页统计
    updateAboutStats();
    // 加载并启动统计数据实时刷新
    loadStatsFromApi();
    startStatsRefresh();
    // 启动分类和标签数据定时刷新（每60秒）
    startDataRefresh();
    // 初始路由
    if (!window.location.pathname || window.location.pathname === '/') {
        router();
    } else {
        router();
    }
    // 监听路由变化
    window.addEventListener('popstate', router);

    // 拦截内部链接点击，使用 History API 导航
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/api/')) {
            e.preventDefault();
            navigateTo(href);
        }
    });
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlog);
} else {
    initBlog();
}
