# 收藏管理、本地化与人物来源评估

## 本轮实现

- 公共分类标签使用小型确定性字典补齐五种语言。数据库已有人工翻译优先，未知标签保留原文。卡片、详情、筛选和年度回顾共用同一显示函数，不覆盖历史数据。
- 实际导入标签混有分类、创作者/角色/作品名和粉丝用语。词典覆盖通用分类、用途和已知缩写，不猜人名罗马字或改写作品名；后续可将自由标签与规范分类分开管理。没有来源核验的专名继续使用已有文本，仍可在内容编辑器补充翻译。
- 后台作品支持最近修改、添加时间正反序、标题/拼音正反序、年份和评分；空年份/评分排最后，使用稳定ID打破相同值。顺序保存在URL，切换类型继续保留；管理排序不写入精选或歌单顺序。
- 音乐专辑/艺人分组按所选标题顺序或组内条目排序位置排列；歌单的人工播放顺序保持独立。
- 首页精选增加独立导航页，支持搜索标题/艺人、按类型定位、拖动、置顶、上下移动和直接输入目标序号。筛选只改变可见列表，保存仍提交完整顺序，服务器拒绝遗漏或并发变化的精选集合。它没有改变轮换模式；固定排序需在显示设置选择固定。
- 概览在现有三个入口后依次补充宣言、设备分类、技术栈和人物；宣言/分类/人物链接真正打开新增表单，不只是跳到列表。

## 统计排查

内容浏览来自打开详情的路由，播放来自播放器事件，卡片曝光不算详情浏览。登录管理员由服务端排除；DNT/GPC和自动化浏览器由前端排除；服务端还会排除机器人、配置IP、统计关闭时的事件，以及不存在/非公开内容ID。内置示例歌曲不计入收藏内容统计。

Spotify内嵌播放器能观察本站请求载入曲目的操作，不能完整观察跨域播放器内部的播放和跳转，因此它的计数是请求载入，不是实际收听证明。不要为填满报表伪造事件或放松隐私排除。统计内容页面现在明确说明这些规则。

正式与Preview统计各自独立。Preview内容刷新会重建内容库，保留自己的统计开关，但不导入生产访问事件。真实数据排查的计数与基础设施证据仅保存在私有报告中。

## 人物与团体：设计与实现

此前人物源只有 TMDB 和手动，音乐艺人仅保存显示名。下述设计的核心部分现已在源码实现（正式部署仍须正常迁移与发布）。

不建议再给TMDB强行补音乐搜索。更合适的演进是保留“人物”兼容入口，将界面扩展为“人物与团体”，增加person/group/organization类型，把多个来源身份拆成独立身份表：personId、provider、externalId、sourceUrl，并对provider+externalId去重。名字/别名和图片都是可编辑内容，不作为唯一身份。

MusicBrainz可作为音乐身份与关系主来源：其搜索明确支持artist及person/group等类型，API支持艺人、录音、发行与作品关系。Spotify可补已有收藏的艺人ID、图片和链接，但应保留来源链接并受现有账号权限限制。[MusicBrainz搜索文档](https://musicbrainz.org/doc/MusicBrainz_API/Search)、[MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)、[Spotify艺人接口](https://developer.spotify.com/documentation/web-api/reference/get-an-artist)。

推荐分三步：

1. 先做手动人物/团体类型、别名和多来源身份，保留旧ID与现有credit关系。读取兼容老数据，新字段采用可空扩展，不批量重建人物。
2. 音乐导入保存稳定的Spotify artist ID、MusicBrainz ID和能取得的ISRC；演唱者从纯字符串扩展为多艺人credit，但保留旧credits数组作为显示兼容。不能把录音ID、专辑曲目ID和发行ID混用。
3. 关联优先使用同来源稳定ID，其次跨来源已确认映射；同名/别名、标题+时长+年份只产生待确认建议，不自动合并。提供预览、批量确认/拒绝、来源说明和幂等重试，只关联已有收藏，不自动灌入全部唱片目录。

人物成员/团体关系和人物到音乐作品的角色应分开：成员、演唱、作曲、作词、制作、参与演奏，避免把所有关系都叫出演。未知身份、同名艺人和重制/现场版本需要明确展示歧义。已有人工简介与图片不被同步覆盖；用户可按字段选择采用来源值。

### 当前实现与边界

已实现人物 / 团体 / 机构、别名、多来源唯一身份、MusicBrainz 搜索导入、Spotify Web API 艺人 ID 和可取得 ISRC 的保存，以及 iTunes artist ID 保存。现有 ID、资料图片和人工编辑不重建或覆盖。MusicBrainz 关联的 Spotify 身份初始为待确认，管理员核对后才参与自动关联。

音乐自动关联仅接受已确认的来源身份；名字/别名和同名冲突显示在待确认面板，可逐项选择后批量确认，本次忽略不会永久屏蔽未来建议。确认失败保留选择，可幂等重试。既有歌曲缺少艺人 ID 时不会凭名字伪造 ID；可先手工确认作品关联，后续重新取得来源身份再启用精确匹配。公开播放列表嵌入页未给出艺人 ID 时也保留为空，不进行猜测。

团体成员使用独立表保存人物、职责及加入/离开年份，与作品演唱、作曲、作词、制作、演奏角色独立。只允许人物作为成员，防止自引用和嵌套循环；删除人物级联移除成员关系。前台仅展示本来就符合公开展示条件的成员，不泄漏私密人物。成员不会自动继承团体全部作品的 credit。

不会自动导入外部完整唱片目录、成员履历或批量覆盖人工资料；本轮也不按标题或 ISRC 自动合并不同版本作品。进一步的录音/发行关系导入和持久化拒绝名单可独立扩展。

MusicBrainz接入需要共享请求队列、缓存和失败退避，按其官方每IP约1次/秒的规则运行，并提供可联系的User-Agent；不要为全部收藏定时并发刷新。头像不由MusicBrainz身份查询自动保证，继续保留人工图片及来源许可。[MusicBrainz限流文档](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)。

## Validation of this iteration

352 application tests cover the new settings guards, concurrent revision conflicts, public-photo visibility, genre fallbacks and stable management sorting alongside the existing suite. Browser checks at 390px and 1440px cover failed-save drafts, settings persistence, collection sorting, complete featured-order saves under filtering, sign-in backgrounds, empty-section hiding and failed-settings retry. The new appearance and featured pages also passed automated WCAG A/AA rule scans. The README admin image uses demonstration responses; no private account credentials or operational records are included.

The artist follow-up adds weighted-manifesto boundaries/session tests, provider identity and membership guards, explicit page-play requests and daily analytics rollups. Isolated 390px/1440px artist-editor checks passed, including failed-save drafts and explicit ambiguous-match confirmation; the editor passed WCAG A/AA scans. MusicBrainz lookup was also checked against its live public API, including nullable alias metadata.
