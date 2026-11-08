# 网站设置界面与实施阶段

## 功能阶段，不等于一次发布全部完成

| 阶段 | 范围                                                           | 当前状态                                                                       |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | 公开资料、头像、品牌、首页开关、版权、默认偏好和隐私           | 已完成开发并在 preview 验证；本轮继续重构这些功能的界面                        |
| 2    | 标签词典、后台消息目录及完整国际化、日期/数字格式              | 标签词典已提供；本轮建立设置公共消息和格式入口。完整后台翻译及语言切换尚未完成 |
| 3    | 当前密码重新验证、改密、会话撤销、TOTP、恢复码及安全参数管理   | 尚未实施；当前仅展示实际只读状态，不假装提供可编辑控件                         |
| 4    | 后台地址预检、候选发布、新入口验证、受保护旧地址过渡及失败恢复 | 尚未实施，最后单独做发布级变更                                                 |

本文件仅记录网站设置的功能阶段。运维计划与线上执行记录另行私有维护。

## 当前信息架构

只保留全局侧栏和设置页内一层导航；分组标题不可点击。统计设置和审计日志从设置模块移除，继续通过原有全局入口访问。

| 分组       | 页面            | 相对设置路由           | 宽度           |
| ---------- | --------------- | ---------------------- | -------------- |
| 站点与品牌 | 基本资料        | site/identity          | Standard 880px |
| 站点与品牌 | Logo 与网站图标 | site/branding          | Standard 880px |
| 站点与品牌 | 页脚与版权      | site/footer            | Compact 640px  |
| 页面与体验 | 首页模块        | experience/home        | Wide 1100px    |
| 页面与体验 | 默认显示与语言  | experience/preferences | Compact 640px  |
| 页面与体验 | 标签词典        | experience/dictionary  | Wide 1100px    |
| 隐私与集成 | 隐私说明        | privacy/content        | Standard 880px |
| 隐私与集成 | 集成与 API      | privacy/integrations   | Standard 880px |
| 后台管理   | 登录外观        | admin/login            | Wide 1100px    |
| 后台管理   | 账号与安全      | admin/security         | Compact 640px  |

宽度是上限，窄屏随容器收缩。1280px 以下用原生分组页面选择器，避免双侧栏挤压；大屏设置导航独立滚动。普通页面沿用原后台宽度，只有设置模块开放更宽外层布局。页面切换管理焦点及滚动，前进/后退复用浏览记录位置。

旧 appearance、integrations 及 frontend/_、backend/_ 设置路径仍跳转到对应配置，保留 query/hash。旧 backend/statistics、backend/audit 跳回独立统计设置/审计页面。不存在配置删除、数据库改表或新 API 协议。

## 组件与页面

- SettingsPage / SettingsSection：统一页面和区域标题、间距及白色表面；不使用压边 legend。
- SettingsActions：无修改时只显示低权重状态；有草稿才出现紧凑保存/放弃区，显示保存中与原始失败原因。粘性保存区在正常文档流中保留空间，照顾安全区，小高度视口改为非粘性。品牌页的 Logo/图标各自保存，均使用非悬浮操作区，避免互相覆盖。
- SettingsAssetPicker / AssetPreview / SettingsPreview：可搜索的公开图库对话框、原生选择器及资源/效果预览。沿用原图库上传入口，不添加私有照片或绕过本地图标来源限制。
- SettingsLanguages / SettingsState / SettingsConflict：统一五语编辑切换、可恢复的加载/错误/空状态及并发版本比较。
- 列表模式沿用技术栈管理的分隔行密度：首页七个模块显示候选数、可见性、开关和编辑入口；词典默认折叠、只展开当前条目，区分词典为空与筛选无匹配。
- Logo 与图标合并；预览文字/图片回退及浏览器标签页，PNG/ICO 生成能力保持。登录背景提供已选顺序列表、上移/下移、移除、搜索图库及实际轮换/减少动态预览，不添加无效拖拽柄。
- 身份字段和版权年份限制合理宽度；默认显示合并只读后台语言状态；隐私历史支持加载、错误重试及恢复为待保存草稿；集成继续按服务独立编辑、保存与连通性操作。

## 草稿与协议

公开设置及 presentation 接口、revision、校验和持久化不变。新增会话内存草稿容器，切页和前进/后退保留草稿；刷新/关闭仍有离开提示，退出或会话失效清空。不会将凭据或设置草稿写入 localStorage。把字段改回已保存值会清除 dirty 状态。语言切换不清空其他语言草稿；保存中按设置组/服务共享提交状态，切走再返回仍禁用同组编辑与重复提交；成功仅清除与本次提交一致的草稿，避免旧回执覆盖新编辑。

同组冲突仍要求比较与再次确认。presentation 共用一个后端 revision，但首页模块、Logo、背景页面分别编辑；冲突后“保留草稿”仅将当前页面负责的字段合入最新文档，避免覆盖另一个页面已保存的字段。图标与 Logo 分别提交，不伪称跨 API 原子保存。

## 修改文件

- apps/admin/src/App.tsx：新路由、完整旧路径跳转及会话失效清草稿。
- apps/admin/src/components/layout/AdminLayout.tsx：仅设置模块扩宽、全局会话草稿离开提示。
- apps/admin/src/components/settings/SettingsLayout.tsx：任务分组、响应式导航、宽度约束、滚动与焦点。
- apps/admin/src/components/settings/SettingsUI.tsx：共享区域、动作、资源选择、预览、状态与冲突组件。
- apps/admin/src/components/settings/copy.ts：设置公共消息及日期格式。
- apps/admin/src/components/settings/drafts.ts：会话内存草稿。
- apps/admin/src/pages/AppearancePage.tsx：品牌、首页模块和登录外观的独立编辑视图。
- apps/admin/src/pages/SiteSettingsPage.tsx：普通设置、词典、图标及只读安全视图。
- apps/admin/src/pages/IntegrationsPage.tsx：统一布局、错误恢复，保持服务级保存能力。
- apps/admin/src/components/integrations/IntegrationItem.tsx、drafts.ts：跨切页的保存状态与会话内存草稿，成功后同步清理。
- apps/admin/src/hooks/useSession.ts：登录、退出时清除旧会话草稿。
- apps/admin/src/components/ui/Toast.tsx：设置页通知定位钩子，通知移到顶部以免遮挡保存；其他页面位置不变。
- apps/admin/src/styles.css：设置专用布局、表面与安全保存区。
- docs/admin.md、docs/website-settings-proposal.zh-CN.md、本文件：更新信息架构、阶段及边界。

## 验收记录

验证使用隔离的公开图库/设置夹具模拟保存失败与并发冲突，不修改真实内容；实际页面仍使用现有 API。视口覆盖390×844、768×1024、1024×768、1280×800、1440×900、1920×1080；逐页检查布局和 WCAG A/AA，并覆盖五语草稿、图库选择、独立品牌保存、背景顺序、词典引用限制、隐私恢复、路由兼容及重试。最终 CI 和 preview 结果以本轮提交对应发布记录为准，生产仍需原流程审批。

## 首页加载修正

网站设置和页面展示配置并行读取，复用已完成结果，不因子组件挂载再闪现空加载状态。App 与 Home 的整页等待均使用同一旋转加载反馈，首屏与加载页之前不显示内容骨架屏。实际照片/项目等列表仍可在对应内容区域使用骨架占位。保留失败重试、访客偏好、公开字段白名单及章节恢复行为。

相关文件：apps/web/src/components/PageLoading.tsx、apps/web/src/app/App.tsx、apps/web/src/pages/Home.tsx、apps/web/src/data/useSiteSettings.ts、apps/web/src/data/usePresentation.ts、apps/web/src/styles/globals.css、apps/web/src/lib/i18n.tsx。

限速验收覆盖首次打开和已有章节位置刷新：启动期间及首屏没有扫光骨架，圆圈动画有效；配置请求并行，读取失败可重试，手机和桌面章节偏移恢复一致。
