/** Settings messages use stable keys; only the currently supported admin locale is exposed. */
export const settingsCopy = {
  navigation: "网站设置分类",
  choosePage: "设置页面",
  unsaved: "有未保存的修改",
  clean: "当前无未保存修改",
  saving: "保存中…",
  save: "保存更改",
  discard: "放弃修改",
  retry: "重试",
  saved: "更改已保存",
  gallery: "浏览图库",
  gallerySearch: "搜索公开照片",
  galleryEmpty: "图库暂无可用的公开照片",
  noMatches: "没有匹配结果，请调整搜索条件。",
  defaultAsset: "沿用默认资源",
  unavailableAsset: "原图片已隐藏或删除，请重新选择",
  defaultPreview: "默认资源",
  galleryHelp: "只使用公开照片。需要新图片时，先到照片管理中上传并公开。",
  groups: {
    brand: "站点与品牌",
    experience: "页面与体验",
    privacy: "隐私与集成",
    admin: "后台管理"
  }
} as const;

export const settingsDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
