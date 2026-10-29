# 争渡

站点定位：梦女字卡网站。

当前是网页版，后续套壳成安卓 APK。

## 视觉：直接使用文档 CSS

主题样式**逐字来自** `主题风格/echoes│淡海蓝章by淅沥沥.docx`，
落地在 `src/theme/echoes.css`（只把文档里的不换行空格规范成普通空格，CSS 语义不变）。

- `src/style.css` 只负责排版、网格、响应式，不覆盖主题的配色 / 圆角 / 边框 / 阴影
- 组件全部使用文档里的 `echoes-*` 类名，例如：
  - `.echoes-app-shell` / `.echoes-app` / `.echoes-page`
  - `.echoes-page-header` / `.echoes-chat-header`（含 `(･∞･ﾐэ )Э` 颜文字）
  - `.echoes-character-card` / `.echoes-photo-card` / `.echoes-playlist-panel` / `.echoes-photo-dialog`
  - `.echoes-msg-user` / `.echoes-msg-other` / `.echoes-bubble-user` / `.echoes-bubble-other`
  - `.echoes-avatar-user` / `.echoes-avatar-other`
  - `.echoes-input-area` / `.echoes-chat-input`
  - `.echoes-timestamp` / `.echoes-floating-home-body`

## 明确移除的手机元素

- ❌ 手机外框 `.phone`
- ❌ 状态栏（时间 / 信号 / WiFi / 电量）
- ❌ 灵动岛
- ❌ 舞台居中框

现在是响应式页面：已取消顶部导航，主内容从页面顶部开始，通过首页 App 入口进入各页面，非首页保留右下悬浮回首页。

## 查看模式

- 默认 **手机比例**：容器固定 9 : 19.5，宽度按可用高度反推，圆角 34px，内容在容器内滚动。
- **「网站视图 / 手机比例」** 切换按钮保留在设置页。
- 手机比例下：首页图标 3 列、相册 2 列、音乐单栏，短信自动变为「列表 / 对话」二选一（带返回键）。
- 侧边预览面板无论多宽，都保持手机比例，不会被拉成横向页面。

## 页面与软件

| 页面 / 软件 | 说明 |
| --- | --- |
| 首页 | 4 列等间距 Bento 网格：纪念日 4×3、时差/链接状态 3×2，其余六个 App 为 1×1 圆角方块（相册 / 历程 / 音乐 / 聊天 / 朋友圈 / 更多）。纪念日默认标题「我们在一起已经」，含并列双头像、可自定义日期、正数/倒数模式和背景图；倒数按目标月日的下一次到来计算；App 名称位于圆角方块下方；链接爱心按 8～24 小时慢周期评估；底部主页 / 设置 / 我的 Dock |
| 短信 | 初始默认只有一个联系人 TA；聊天显示名使用联系人备注。用户发消息后，完全随机地从当前联系人的字卡库抽卡回复，允许重复；默认抽 1 张，可设置每次最多随机抽 1～3 张。可开启主动发消息：自定义间隔默认 5～60 分钟，范围 1～1440 分钟；随机间隔开启后从 1 分钟～24 小时等概率抽取，自定义范围失效。提供未读角标、站内通知、页面标题未读数和浏览器系统通知。输入框右侧「+」展开 8 个工具格；当前联系人可单独配置头像、头像框、聊天背景、朋友圈封面、回复频率和提示音；`localStorage` 持久化 |
| 相册 | 默认空相册；点击「上传照片」可一次选择多张本地图片，每张先进入图片裁剪框，裁剪后存入浏览器 IndexedDB；支持大图预览、左右切换和删除 |
| 音乐 | 3 首程序合成的无版权音频，站内 `<audio>` 播放，进度条 / 上下首 / 播放列表 |
| 历程 | 从本地短信数据汇总最近消息，按时间倒序展示 |
| 朋友圈 | 3 条内置动态，配淡海示例图 |
| 更多 | 弹出小卡片，2 列布局：消息统计 / 塔罗牌 / 决策币 / 信箱 |
| 消息统计 | 消息总数、按类型与会话统计 |
| 塔罗牌 | 8 张大阿卡纳随机抽牌 |
| 决策币 | 本地余额，每日签到 +10 |
| 信箱 | 3 封内置信件，点击展开阅读 |
| 设置 | 全部为点击展开的折叠分类：纪念日、主页背景、朋友圈页面背景、自动聊天、通知、查看模式、数据、主题；联系人与 TA 相关设置已移到「我的」 |
| 我的 | 「我」编辑个人资料，头像与纪念日头像二完全同步；「TA」管理联系人列表，默认唯一联系人 TA。TA 的相关中仅字卡库打开独立弹窗，其余项目在原条目下方直接展开；联系人列表支持建群，聊天支持置顶/免打扰。 |

## 开发

```bash
npm install
npm run dev      # http://127.0.0.1:5178
npm run build    # 输出 dist-web/
```

## 结构

```
争渡/
├─ index.html
├─ vite.config.js          # base: './'，build.emptyOutDir: false
├─ src/
│  ├─ App.vue              # 网站骨架：导航 + 页面切换 + 悬浮回首页
│  ├─ main.js              # 先引入主题 CSS，再引入布局 CSS
│  ├─ theme/echoes.css     # 文档原始主题 CSS
│  ├─ style.css            # 排版 / 网格 / 响应式
│  ├─ settings.js          # 自定义聊天 / 纪念日 / 背景 / 字卡库设置，localStorage 持久化
│  ├─ chat.js              # 全局聊天、抽卡回复、主动消息调度与通知
│  ├─ link-status.js       # 爱心链接稳定度慢周期状态
│  ├─ image-crop.js        # 全局图片裁剪队列与 Promise API
│  ├─ background-style.js  # 背景层 URL / 不透明度变量
│  ├─ album-store.js       # 用户相册 IndexedDB 存储
│  ├─ store.js             # 轻状态
│  ├─ components/
│  │  ├─ ImageCropDialog.vue # 全局图片裁剪弹窗（拖动/四角缩放/比例预设）
│  │  ├─ ContactEditorDialog.vue # 联系人核心资料弹窗
│  │  ├─ CardLibraryDialog.vue # 分组字卡库 / 搜索 / 导入 / 保存
│  │  ├─ StickerManager.vue # 我的 / TA 表情包分组与批量上传
│  │  ├─ StickerPickerDialog.vue # 聊天表情选择器
│  │  ├─ LineGlyph.vue     # 首页细线软件图标
│  │  └─ SoftGlyph.vue     # 旧图标（当前未使用）
│  ├─ views/
│  │  ├─ HomeView.vue       # 4 列 Bento：纪念日 4×3 / 状态 3×2 / App 方块 / Dock
│  │  ├─ SmsView.vue
│  │  ├─ AlbumView.vue
│  │  ├─ MusicView.vue
│  │  ├─ JourneyView.vue    # 历程
│  │  ├─ MomentsView.vue    # 朋友圈
│  │  ├─ SettingsView.vue   # 设置
│  │  ├─ ProfileView.vue    # 我的
│  │  ├─ StatsView.vue      # 消息统计
│  │  ├─ TarotView.vue      # 塔罗牌
│  │  ├─ CoinView.vue       # 决策币
│  │  └─ MailboxView.vue    # 信箱
│  ├─ data/                # 内置示例数据与 556 张默认回复字卡
│  └─ assets/
│     ├─ photos/           # 示例图（SVG）
│     └─ songs/            # 合成音频（WAV）
└─ tools/
   ├─ gen_audio.py
   └─ gen_photos.py
```

- 底部导航仅在主页 / 设置 / 我的显示；相册、聊天等 App 隐藏底部导航并在顶部显示 App 名称和纯箭头返回键。聊天联系人页的返回与「发起群聊 +」固定在顶部栏；联系人列表不显示置顶/免打扰，只有进入聊天详情后才在右上角显示聊天设置。聊天详情保留最左侧返回键并全屏显示，无顶栏与底部导航。设置和我的不显示返回键。

## 响应式

- 1120px 内容宽，桌面端三栏软件卡 / 短信双栏 / 音乐双栏
- ≤980px：短信、音乐改为单栏；短信进入对话后隐藏列表并出现返回键
- ≤760px：导航换行、软件卡单列
- ≤560px：相册两列

## 注意

- 单击聊天消息后，在该消息上方原位展开操作建议条，不弹全屏遮罩；操作为图标 + 小字：复制、翻译、引用、转发、多选、解读、撤回、删除。多选后逐条转发，只有一个会话时禁止转发；撤回仅本人消息。

- 表情包分为「我的表情包」和「TA 的表情包」，支持自定义分组、PNG/JPG/GIF 批量上传、按 TA 分配多个联系人；聊天表情选择器与「我的」表情包管理共用 IndexedDB 数据。

- 群聊支持多联系人建群、群名/群背景修改；所有会话可置顶或免打扰，置顶上限 10 个。聊天输入框含表情包按钮与「让对方主动发消息」按钮。

- 字卡库支持分组（全部 / 未分组 / 基础 / 报备 / 天气 / 自定义）、搜索、批量多行添加、JSON 导入、自动跳过重复、显式保存；删除分组需两次确认后选择删除字卡或移入未分组。

- 所有本地图片上传统一调用 `src/image-crop.js` 的 `cropImage(file, options)`；头像使用 `shape: "circle"` 圆形裁剪框，其他图片可选择自由、1:1、4:3、3:2、16:9 比例。

- `字卡库/` 下的四个 json 保持只读。按用户要求，已把其中的 `customReplies` 去重整理为 `src/data/reply-cards.json`（556 张）供默认抽卡使用；运行时不读取、也不修改原字卡库。
- 短信输入框为了放下右侧「+」，隐藏了文档原有的 `.echoes-input-area::before` 右侧装饰图；输入区的白底、蓝色虚线、`#f0f9ff` 输入框样式原样保留。
- 文档 CSS 里引用的海豹 / 装饰图来自 `s1.imagehub.cc`，需要联网才会显示。
- 音频全部由 `tools/gen_audio.py` 用正弦波合成，无版权问题。
