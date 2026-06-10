# 📚 技术博客系统

一个专注于 C/C++、Linux、数据结构与技术分享的个人博客系统。

## 🚀 快速启动

### 启动服务器
```bash
cd /home/xys/my_blog
bash start_server.sh          # 自动选择可用端口
bash start_server.sh 8080     # 指定端口
```

### 停止服务器
```bash
bash start_server.sh stop      # 停止 + 清除缓存
bash start_server.sh clean     # 仅清除缓存
```

### 访问地址
| 页面 | 地址 |
|------|------|
| 博客首页 | `http://localhost:{PORT}/` |
| 管理后台 | `http://localhost:{PORT}/admin.html` |
| API 接口 | `http://localhost:{PORT}/api/posts` |

### 调试模式
编辑 `server.py`，设置 `DEBUG_MODE = True` 跳过登录验证：
- 后台直接进入管理界面，无需输入账号密码
- 所有 API 无需 token 即可调用
- 生产环境请务必设为 `False`

## 📂 项目结构
```
my_blog/
├── index.html          # 前台首页
├── admin.html          # 后台管理
├── server.py           # 后端服务器（Python）
├── start_server.sh     # 启动脚本
├── README.md           # 使用指南
├── css/
│   ├── style.css       # 前台样式
│   └── admin.css       # 后台样式
├── js/
│   ├── app.js          # 前台逻辑
│   └── admin.js        # 后台逻辑
├── data/               # 数据文件
│   ├── posts.json      # 文章数据
│   ├── categories.json # 分类数据
│   ├── tags.json       # 标签数据
│   ├── comments.json   # 评论数据
│   ├── guestbook.json  # 留言板数据
│   ├── favorites.json  # 收藏数据
│   ├── users.json      # 用户数据
│   └── views.json      # 阅读统计
└── uploads/            # 上传文件目录
```

## 📖 后台使用指南

### 🏠 首页管理

进入管理后台 → 侧边栏点击「🏠 首页管理」，可自定义以下内容：

| 配置项 | 说明 |
|--------|------|
| 站点标题 | 首页横幅大标题，默认「📚 技术博客专栏」 |
| 副标题/描述 | 标题下方的描述文字 |
| 公告 | 首页公告内容（支持纯文本），显示为毛玻璃胶囊样式 |
| 横幅类型 | `渐变背景`（紫粉蓝流动渐变）或 `自定义图片`（填写图片 URL） |
| 自定义图片 URL | 填入网络图片地址，作为横幅背景 |
| 显示文章分类 | 是否在首页展示分类卡片（建议开启） |
| 显示标签云 | 是否在首页展示标签云（默认关闭，侧边栏已有） |

**操作步骤**：
1. 修改任意配置项
2. 点击「💾 保存首页配置」
3. 点击「👁 预览首页」在新标签页查看效果
4. 或直接访问博客首页查看

### 📎 资源管理

进入管理后台 → 侧边栏点击「📎 资源管理」，可上传和管理文件：

**上传文件**：
- **拖拽上传**：将文件直接拖入上传区（虚线框内）
- **点击上传**：点击上传区任意位置，弹出文件选择对话框
- 支持图片、PDF、Word、Excel、视频、音频、代码等多种格式
- 单个文件最大 50MB

**管理文件**：
- 按分类筛选：全部/图片/文档/视频/音频/压缩包/代码/其他
- 搜索文件：顶部搜索框按文件名搜索
- 复制链接：点击文件卡片可复制文件 URL，直接粘贴到文章正文
- 删除文件：点击删除按钮，确认后移除

**在文章中使用资源**：
1. 上传图片或文件
2. 复制资源链接
3. 在文章编辑器中粘贴链接（图片会自动显示）

## 🔌 API 接口

### 文章
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/posts` | 获取所有文章 |
| GET | `/api/posts/{id}` | 获取单篇文章 |
| POST | `/api/posts` | 创建文章（需登录） |
| PUT | `/api/posts/{id}` | 更新文章（需登录） |
| DELETE | `/api/posts/{id}` | 删除文章（需登录） |

### 分类
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取所有分类 |
| POST | `/api/categories` | 创建分类（需登录） |
| PUT | `/api/categories/{id}` | 更新分类（需登录） |
| DELETE | `/api/categories/{id}` | 删除分类（需登录） |

### 标签
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tags` | 获取所有标签 |
| POST | `/api/tags` | 创建标签（需登录） |
| PUT | `/api/tags/{id}` | 更新标签（需登录） |
| DELETE | `/api/tags/{id}` | 删除标签（需登录） |

### 留言板
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/guestbook` | 获取所有留言 |
| POST | `/api/guestbook` | 发表留言（公开） |
| DELETE | `/api/guestbook/{id}` | 删除留言（需登录） |

### 评论
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/comments/post/{id}` | 获取文章评论 |
| POST | `/api/comments` | 发表评论（需登录） |
| DELETE | `/api/comments/{id}` | 删除评论（需登录） |

### 点赞
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/posts/like` | 点赞/取消点赞（需登录） |

### 收藏
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/favorites/toggle` | 切换收藏（需登录） |

### 统计
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 获取博客统计 |
| GET | `/api/bootstrap` | 聚合加载数据 |

### 资源管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/resources` | 获取资源列表 |
| POST | `/api/upload` | 上传文件（需登录） |
| DELETE | `/api/resources/{id}` | 删除资源（需登录） |

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/check` | 检查登录状态 |
| DELETE | `/api/auth/logout` | 退出登录 |
| POST | `/api/auth/change-password` | 修改密码（需登录） |

## 🛠 维护命令

```bash
# 查看日志
tail -f /tmp/blog_server.log

# 检查端口占用
ss -tlnp | grep {PORT}

# 手动杀进程
pkill -f server.py

# 测试 API
curl -s http://localhost:{PORT}/api/posts | python3 -m json.tool
```

## ⚠️ 常见问题

### 浏览器看到旧内容
- 无痕模式打开（避免缓存）
- Ctrl+Shift+R 强制刷新
- 重启服务器：`bash start_server.sh stop && bash start_server.sh`

### 端口被占用
- `bash start_server.sh stop` 停止旧进程
- 或使用其他端口：`bash start_server.sh 8085`

### 服务器启动失败
- 检查日志：`cat /tmp/blog_server.log`
- 检查 Python 版本：`python3 --version`（需要 3.8+）
- 确保数据目录可写

### 前后台数据不同步
- 前后台通过 localStorage 跨标签页通信
- 30 秒定时轮询 API
- 切换标签页时自动刷新
