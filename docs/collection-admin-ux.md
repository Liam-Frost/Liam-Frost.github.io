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

## 人物与乐队：建议下一阶段扩展

当前人物源只有TMDB和手动，作品的音乐部分只保存艺人显示名字符串；人物到作品的credit关系已经存在。现有手动创建艺人/乐队后，可利用同名演唱者建议或手动关联作品，无需先在TMDB找到该人。

不建议再给TMDB强行补音乐搜索。更合适的演进是保留“人物”兼容入口，将界面扩展为“人物与团体”，增加person/group/organization类型，把多个来源身份拆成独立身份表：personId、provider、externalId、sourceUrl，并对provider+externalId去重。名字/别名和图片都是可编辑内容，不作为唯一身份。

MusicBrainz可作为音乐身份与关系主来源：其搜索明确支持artist及person/group等类型，API支持艺人、录音、发行与作品关系。Spotify可补已有收藏的艺人ID、图片和链接，但应保留来源链接并受现有账号权限限制。[MusicBrainz搜索文档](https://musicbrainz.org/doc/MusicBrainz_API/Search)、[MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)、[Spotify艺人接口](https://developer.spotify.com/documentation/web-api/reference/get-an-artist)。

推荐分三步：

1. 先做手动人物/团体类型、别名和多来源身份，保留旧ID与现有credit关系。读取兼容老数据，新字段采用可空扩展，不批量重建人物。
2. 音乐导入保存稳定的Spotify artist ID、MusicBrainz ID和能取得的ISRC；演唱者从纯字符串扩展为多艺人credit，但保留旧credits数组作为显示兼容。不能把录音ID、专辑曲目ID和发行ID混用。
3. 关联优先使用同来源稳定ID，其次跨来源已确认映射；同名/别名、标题+时长+年份只产生待确认建议，不自动合并。提供预览、批量确认/拒绝、来源说明和幂等重试，只关联已有收藏，不自动灌入全部唱片目录。

人物成员/团体关系和人物到音乐作品的角色应分开：成员、演唱、作曲、作词、制作、参与演奏，避免把所有关系都叫出演。未知身份、同名艺人和重制/现场版本需要明确展示歧义。已有人工简介与图片不被同步覆盖；用户可按字段选择采用来源值。

这部分是数据模型和交互方案，本轮没有上线新的音乐人物API集成或执行相关迁移。

MusicBrainz接入需要共享请求队列、缓存和失败退避，按其官方每IP约1次/秒的规则运行，并提供可联系的User-Agent；不要为全部收藏定时并发刷新。头像不由MusicBrainz身份查询自动保证，继续保留人工图片及来源许可。[MusicBrainz限流文档](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)。

## Validation of this iteration

344 application tests cover the new settings guards, concurrent revision conflicts, public-photo visibility, genre fallbacks and stable management sorting alongside the existing suite. Browser checks at 390px and 1440px cover failed-save drafts, settings persistence, collection sorting, complete featured-order saves under filtering, sign-in backgrounds, empty-section hiding and failed-settings retry. The new appearance and featured pages also passed automated WCAG A/AA rule scans. The README admin image uses demonstration responses; no private account credentials or operational records are included.
