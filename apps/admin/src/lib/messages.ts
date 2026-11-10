import { useSyncExternalStore } from "react";

import { en } from "./messages.en";
import { allowUnload, hasUnsaved, onUnsavedChange } from "./unsaved";

export const ADMIN_LOCALES = ["zh", "en"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];

export const ADMIN_LOCALE_LABELS: Record<AdminLocale, string> = { zh: "简体中文", en: "English" };

const STORAGE_KEY = "lf-admin-locale";

/** What the admin was told to use; "system" (nothing stored) follows the browser. */
export type AdminLocalePreference = AdminLocale | "system";

function readPreference(): AdminLocalePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // Blocked storage: go by the browser.
  }
  return "system";
}

const systemLocale = (): AdminLocale =>
  typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")
    ? "zh"
    : "en";

const resolve = (preference: AdminLocalePreference): AdminLocale =>
  preference === "system" ? systemLocale() : preference;

let preference = readPreference();
const preferenceListeners = new Set<() => void>();
const emitPreference = () => preferenceListeners.forEach((listener) => listener());
export const useLocalePreference = () =>
  useSyncExternalStore(
    (listener) => {
      preferenceListeners.add(listener);
      return () => preferenceListeners.delete(listener);
    },
    () => preference
  );

/**
 * The admin's language, read once when the app starts. Messages, including those in module-level
 * constants, are resolved with it, so changing the language reloads the page.
 */
export const locale: AdminLocale = resolve(preference);

/** Whether choosing this would actually change the language, and so need a reload. */
export const changesLocale = (next: AdminLocalePreference) => resolve(next) !== locale;

/** For Intl formatters and sorting. */
export const intlLocale = locale === "en" ? "en-CA" : "zh-CN";

if (typeof document !== "undefined") document.documentElement.lang = intlLocale;

/** Callers settle unsaved work first: by the time this runs, a reload is already agreed. */
export function setLocale(next: AdminLocalePreference) {
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
  preference = next;
  if (!changesLocale(next)) {
    emitPreference();
    return;
  }
  allowUnload();
  window.location.reload();
}

/** Another tab changed the language: follow it as soon as nothing here would be lost. */
if (typeof window !== "undefined") {
  let pending = false;
  const follow = () => {
    if (!pending || hasUnsaved() || document.querySelector("dialog[open]")) return;
    window.location.reload();
  };
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preference = readPreference();
    emitPreference();
    pending = changesLocale(preference);
    follow();
  });
  window.addEventListener("focus", follow);
  onUnsavedChange(follow);
}

type Arg = string | number | boolean | null | undefined;

/**
 * A message of the admin. The key is the Chinese text, which is also the zh translation; `{0}` and
 * so on are filled from `args`, in whatever order the translation puts them.
 */
export function tr(key: string, ...args: Arg[]): string {
  const text = locale === "en" ? (en[key] ?? key) : key;
  if (!args.length) return text;
  return text.replace(/\{(\d+)\}/g, (_, index: string) => String(args[Number(index)] ?? ""));
}

/** English sign-in and account errors from the API, for the Chinese interface. */
const API_ZH: Record<string, string> = {
  "This photo has reached its version limit; delete a version first":
    "这张照片的版本数已达上限，请先删除一个版本",
  "This version is the one being shown; switch to another first":
    "这是当前显示的版本，请先切换到其他版本",
  "This upload is still being processed": "这个文件还在处理中",
  "Invalid username or password": "用户名或密码错误",
  "Enter the code from your authenticator": "请输入验证器 App 中的验证码",
  "That code is not valid": "验证码不正确",
  "Too many login attempts. Try again later.": "登录尝试次数过多，请稍后再试",
  "Too many attempts. Try again later.": "尝试次数过多，请稍后再试",
  "Sign-in is temporarily unavailable": "暂时无法登录，请稍后再试",
  "Current password is incorrect": "当前密码不正确",
  "Choose a password different from the current one": "新密码不能与当前密码相同",
  "Use sign out to end this session": "当前设备请使用“退出登录”",
  "Session not found": "没有找到该登录记录",
  "Two-step sign-in is already on": "两步验证已经开启",
  "Two-step sign-in is off": "两步验证未开启",
  "Setup expired; start again": "设置已过期，请重新开始",
  "That address is used by the public site": "这个地址已被网站页面使用",
  "Choose an address separate from the current one": "请选择与当前地址不重叠的新地址",
  "No address switch is in progress": "没有正在进行的地址切换",
  "Confirm from the new address": "请在新地址上确认",
  "Enter your current password": "请输入当前密码",
  "Enter the 6-digit code": "请输入 6 位验证码",
  "Use letters, digits and . _ - @ only": "只能使用字母、数字和 . _ - @",
  "Changing the account needs a database (set DATABASE_URL)": "修改账号需要数据库"
};

/** An error message from the API in the admin's language, where a translation exists. */
export function apiMessage(message: string) {
  return locale === "zh" ? (API_ZH[message] ?? message) : tr(message);
}
