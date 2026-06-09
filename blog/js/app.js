// ========== 全局变量 ==========
let allPosts = [];
let allCategories = [];   // 全部分类（含自定义颜色/图标/描述）
let allTags = [];          // 全部标签（含自定义颜色）
let currentPage = 'home';

// ========== 工具函数 ==========

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
        categories[post.category] = (categories[post.category] || 0) + 1;
        post.tags.forEach(tag => {
            tags[tag] = (tags[tag] || 0) + 1;
        });
        const year = getYear(post.date);
        archives[year] = (archives[year] || 0) + 1;
    });
    
    return { categories, tags, archives };
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
                            <div class="dropdown-panel-title">C++在线帮助文档</div>
                            <div class="dropdown-section">
                                <div class="dropdown-section-title">文档</div>
                                <div class="dropdown-section-items">
                                    <a href="https://en.cppreference.com" target="_blank" class="dropdown-item">
                                        <span class="dropdown-item-icon"></span><span>英文版</span>
                                    </a>
                                    <a href="https://zh.cppreference.com" target="_blank" class="dropdown-item">
                                        <span class="dropdown-item-icon"></span><span>中文版</span>
                                    </a>
                                </div>
                            </div>
                            <div class="dropdown-section">
                                <div class="dropdown-section-title">服务</div>
                                <div class="dropdown-section-items">
                                    <a href="#/classroom" class="dropdown-item">
                                        <span class="dropdown-item-icon">🏪</span><span>大丙课堂</span>
                                    </a>
                                    <a href="#/weixin" class="dropdown-item">
                                        <span class="dropdown-item-icon">👤</span><span>微信公众号</span>
                                    </a>
                                    <a href="#/qq" class="dropdown-item">
                                        <span class="dropdown-item-icon">🐧</span><span>QQ交流群</span>
                                    </a>
                                    <a href="#/wechat" class="dropdown-item">
                                        <span class="dropdown-item-icon">💬</span><span>微信</span>
                                    </a>
                                </div>
                            </div>
                            <div class="dropdown-section">
                                <div class="dropdown-section-title">互动</div>
                                <div class="dropdown-section-items">
                                    <a href="#/guestbook" class="dropdown-item">
                                        <span class="dropdown-item-icon">📝</span><span>留言板</span>
                                    </a>
                                    <a href="#/gitee" class="dropdown-item">
                                        <span class="dropdown-item-icon">🔷</span><span>码云</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <a href="#/home" class="nav-logo" title="🏠 首页">📚 技术博客</a>
                </div>
                <div class="nav-center">
                    <ul class="nav-menu">
                        <li><a href="#/home" class="${active === 'home' ? 'active' : ''}">首页</a></li>
                        <li><a href="#/categories" class="${active === 'categories' ? 'active' : ''}">分类</a></li>
                        <li><a href="#/tags" class="${active === 'tags' ? 'active' : ''}">标签</a></li>
                        <li><a href="#/archive" class="${active === 'archive' ? 'active' : ''}">归档</a></li>
                    </ul>
                </div>
                <div class="nav-right">
                    <a href="#/search" class="nav-icon-link" title="搜索">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </a>
                    <a href="#/about" class="nav-icon-link" title="关于">
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
    const totalViews = posts.reduce((sum, p) => sum + p.views, 0);

    // 优先使用独立分类/标签数据（含自定义颜色、图标、描述），
    // 如果没加载到，则回退到从文章数据推导
    const categoryData = allCategories.length > 0
        ? allCategories.map(c => ({
              name: c.name,
              count: typeof c.postCount === 'number' ? c.postCount : (stats.categories[c.name] || 0),
              color: c.color,
              icon: c.icon,
              description: c.description
          }))
        : Object.entries(stats.categories).map(([name, count]) => ({ name, count, color: '#4a5568', icon: '📂' }));

    // 按文章数降序、再按名称升序
    categoryData.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const tagData = allTags.length > 0
        ? allTags.map(t => ({
              name: t.name,
              count: typeof t.postCount === 'number' ? t.postCount : (stats.tags[t.name] || 0),
              color: t.color
          }))
        : Object.entries(stats.tags).map(([name, count]) => ({ name, count, color: '#2563eb' }));

    tagData.sort((a, b) => b.count - a.count);
    // 显示所有标签（不做截断），但如果标签总数>15，则按文章数降序取前15个热门的
    const shownTags = tagData.length > 15 ? tagData.slice(0, 15) : tagData;

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
            <div class="widget-title">📂 文章分类 <span style="font-size:12px;color:#a0aec0;font-weight:normal">(${categoryData.length})</span></div>
            <ul class="category-list">
                ${categoryData.map(cat => `
                    <li>
                        <a href="#/category/${encodeURIComponent(cat.name)}" style="display:flex;align-items:center;gap:6px;">
                            <span style="font-size:16px">${escapeHtml(cat.icon || '📂')}</span>
                            <span>${escapeHtml(cat.name)}</span>
                            <span class="category-count">${cat.count}</span>
                        </a>
                    </li>
                `).join('')}
            </ul>
        </div>

        <div class="sidebar-widget">
            <div class="widget-title">🏷 热门标签 <span style="font-size:12px;color:#a0aec0;font-weight:normal">(${tagData.length})</span></div>
            <div class="tag-list">
                ${shownTags.map(tag => `
                    <a href="#/tag/${encodeURIComponent(tag.name)}" class="tag"
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
                        <a href="#/archive/${year}">
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
                <a href="#/post/${post.id}">${post.title}</a>
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
                ${post.tags.map(tag => `<a href="#/tag/${encodeURIComponent(tag)}" class="tag">${tag}</a>`).join('')}
                <a href="#/post/${post.id}" class="read-more">阅读全文 →</a>
            </div>
        </article>
    `;
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
    
    content.innerHTML = `
        <article class="post-detail">
            <h1 class="post-title">${post.title}</h1>
            <div class="post-meta">
                <span><span class="icon">📅</span>${formatDate(post.date)}</span>
                <span><span class="icon">📂</span><a href="#/category/${encodeURIComponent(post.category)}">${post.category}</a></span>
                <span><span class="icon">👁</span>${post.views.toLocaleString()} 阅读</span>
                <span><span class="icon">⏱</span>${post.readTime} 分钟</span>
                <span><span class="icon">📝</span>${post.wordCount.toLocaleString()} 字</span>
            </div>
            <div class="post-content">
                ${parseMarkdown(post.content)}
            </div>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <div class="post-tags">
                    <strong style="color: #4a5568;">标签：</strong>
                    ${post.tags.map(tag => `<a href="#/tag/${encodeURIComponent(tag)}" class="tag">${tag}</a>`).join('')}
                </div>
            </div>
        </article>
    `;
    
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
              description: c.description
          }))
        : Object.entries(stats.categories).map(([name, count]) => ({
              name, count, color: '#2563eb', icon: '📂', description: ''
          }));

    categoryList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

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
                 onclick="window.location.hash = '#/category/${encodeURIComponent(cat.name)}'">
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
                            <a href="#/post/${p.id}" style="color: #4a5568;">📄 ${escapeHtml(p.title.slice(0, 24))}${p.title.length > 24 ? '...' : ''}</a>
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
              description: t.description
          }))
        : Object.entries(stats.tags).map(([name, count]) => ({
              name, count, color: '#2563eb', description: ''
          }));

    tagList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    content.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">🏷 标签云</h1>
            <p class="page-subtitle">共 ${tagList.length} 个标签</p>
        </div>
        <div class="sidebar-widget">
            <div class="tag-list" style="gap: 15px; padding: 20px;">
                ${tagList.map((tag, i) => {
                    const size = 13 + Math.min(tag.count * 2, 14);
                    return `<a href="#/tag/${encodeURIComponent(tag.name)}" 
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
                <div class="skills-grid">
                    <div class="skill-item">
                        <div class="skill-icon">⚙️</div>
                        <div class="skill-name">C / C++</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">🐧</div>
                        <div class="skill-name">Linux</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">🖥</div>
                        <div class="skill-name">Qt</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">📊</div>
                        <div class="skill-name">数据结构</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">🎨</div>
                        <div class="skill-name">设计模式</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">🛠</div>
                        <div class="skill-name">CMake</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">🌐</div>
                        <div class="skill-name">网络编程</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">📚</div>
                        <div class="skill-name">算法</div>
                    </div>
                </div>
            </div>
            
            <div class="about-section">
                <h2>📈 博客统计</h2>
                <div class="skills-grid">
                    <div class="skill-item">
                        <div class="skill-icon">📝</div>
                        <div class="skill-name">文章 <span id="about-post-count">${allPosts.length}</span> 篇</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">👁</div>
                        <div class="skill-name">总阅读 <span id="about-view-count">${allPosts.reduce((s, p) => s + p.views, 0).toLocaleString()}</span></div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">📂</div>
                        <div class="skill-name">分类 <span id="about-cat-count">${Object.keys(getStats(allPosts).categories).length}</span> 个</div>
                    </div>
                    <div class="skill-item">
                        <div class="skill-icon">🏷</div>
                        <div class="skill-name">标签 <span id="about-tag-count">${Object.keys(getStats(allPosts).tags).length}</span> 个</div>
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
}

// 更新关于页统计（数据变化时调用）
function updateAboutStats() {
    if (!document.getElementById('about-post-count')) return;
    const stats = getStats(allPosts);
    const postEl = document.getElementById('about-post-count');
    const viewEl = document.getElementById('about-view-count');
    const catEl = document.getElementById('about-cat-count');
    const tagEl = document.getElementById('about-tag-count');
    if (postEl) postEl.textContent = allPosts.length;
    if (viewEl) viewEl.textContent = allPosts.reduce((s, p) => s + p.views, 0).toLocaleString();
    if (catEl) catEl.textContent = Object.keys(stats.categories).length;
    if (tagEl) tagEl.textContent = Object.keys(stats.tags).length;
}

// ========== 路由系统 ==========

function router() {
    // 全局数据兜底，确保任何情况下都不会因 .length 崩溃
    allPosts = Array.isArray(allPosts) ? allPosts : [];
    allCategories = Array.isArray(allCategories) ? allCategories : [];
    allTags = Array.isArray(allTags) ? allTags : [];

    const hash = window.location.hash.slice(1) || '/home';
    const parts = hash.split('/').filter(p => p);
    
    const page = parts[0] || 'home';
    const param1 = decodeURIComponent(parts[1] || '');
    
    renderNavbar(page);
    renderSidebar(allPosts);
    
    switch (page) {
        case 'home':
            renderPostList(allPosts);
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
        case 'about':
            renderAbout();
            updateAboutStats();
            break;
        default:
            renderPostList(allPosts);
    }
    
    renderFooter();
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
        window.addEventListener('hashchange', function () { location.reload(); });
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
                <div class="nav-brand">📚 技术博客</div>
                <ul class="nav-menu">
                    <li class="active"><a href="#/home">首页</a></li>
                    <li><a href="#/categories">分类</a></li>
                    <li><a href="#/tags">标签</a></li>
                    <li><a href="#/archive">归档</a></li>
                    <li><a href="#/about">关于</a></li>
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
    // 数据加载完成后，同步更新关于页统计
    updateAboutStats();
    // 初始路由
    if (!window.location.hash) {
        window.location.hash = '#/home';
    } else {
        router();
    }
    // 监听路由变化
    window.addEventListener('hashchange', router);
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlog);
} else {
    initBlog();
}
