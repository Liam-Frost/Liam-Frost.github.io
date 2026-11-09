import type { FooterPage } from "@liam-frost/shared";
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
  groups: {
    brand: tr("站点与品牌"),
    experience: tr("页面与体验"),
    privacy: tr("隐私与集成"),
    admin: tr("后台管理")
  }
} as const;

export const copyrightPageLabels: Record<FooterPage, string> = {
  home: tr("主页"),
  projects: tr("项目"),
  collection: tr("收藏"),
  portfolio: tr("照片")
};

export const settingsDate = (value: string) =>
  new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
