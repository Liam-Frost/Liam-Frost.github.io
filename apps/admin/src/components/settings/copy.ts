import {
  intlLocale,
  tr
} from "../../lib/messages"; /** Settings messages use stable keys; only the currently supported admin locale is exposed. */
export const settingsCopy = {
  navigation: tr("网站设置分类"),
  choosePage: tr("设置页面"),
  unsaved: tr("有未保存的修改"),
  clean: tr("当前无未保存修改"),
  saving: tr("保存中…"),
  save: tr("保存更改"),
  discard: tr("放弃修改"),
  retry: tr("重试"),
  saved: tr("更改已保存"),
  gallery: tr("浏览图库"),
  gallerySearch: tr("搜索公开照片"),
  galleryEmpty: tr("图库暂无可用的公开照片"),
  noMatches: tr("没有匹配结果，请调整搜索条件。"),
  defaultAsset: tr("沿用默认资源"),
  unavailableAsset: tr("原图片已隐藏或删除，请重新选择"),
  defaultPreview: tr("默认资源"),
  galleryHelp: tr("只使用公开照片。需要新图片时，先到照片管理中上传并公开。"),
  groups: {
    brand: tr("站点与品牌"),
    experience: tr("页面与体验"),
    privacy: tr("隐私与集成"),
    admin: tr("后台管理")
  }
} as const;

export const settingsDate = (value: string) =>
  new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
