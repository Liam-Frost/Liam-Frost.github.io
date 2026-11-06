import { type AdminContactResponse, type ContactContent } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/layout/AdminLayout";
import { TechIcon } from "../components/stack/TechIcon";
import { Dialog } from "../components/ui/Dialog";
import { Field } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";
import { Menu } from "../components/ui/Menu";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { useToast } from "../components/ui/Toast";
import { request } from "../lib/api";

const key = ["admin", "contact"];
type ContactLink = ContactContent["links"][number];
const icon = "size-4";
function platformIcon(href: string) {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    const slug = (
      {
        "github.com": "github",
        "instagram.com": "instagram",
        "linkedin.com": "linkedin",
        "youtube.com": "youtube",
        "t.me": "telegram",
        "bsky.app": "bluesky"
      } as Record<string, string>
    )[host];
    return slug ? `/uploads/icons/simpleicons/${slug}.svg` : null;
  } catch {
    return null;
  }
}

export function ContactPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => request<AdminContactResponse>("/api/admin/contact")
  });
  const [draft, setDraft] = useState<AdminContactResponse | null>(null);
  const [editing, setEditing] = useState<{ index: number; link: ContactLink } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const value = draft ?? data;
  const dirty = !!draft && JSON.stringify(draft.contact) !== JSON.stringify(data?.contact);
  const save = useMutation({
    mutationFn: (body: AdminContactResponse) =>
      request<AdminContactResponse>("/api/admin/contact", { method: "PUT", json: body }),
    onSuccess: (response) => {
      qc.setQueryData(key, response);
      setDraft(null);
      toast("联系方式已保存，网站上马上生效");
    },
    onError: (e: Error) => toast(e.message, "error")
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (contact: ContactContent) =>
    value && setDraft({ contact, revision: value.revision });
  const move = (from: number, to: number) => {
    if (!value || save.isPending || to < 0 || to >= value.contact.links.length || from === to)
      return;
    const links = [...value.contact.links];
    const [link] = links.splice(from, 1);
    links.splice(to, 0, link!);
    change({ ...value.contact, links });
  };
  const add = () => setEditing({ index: -1, link: { label: "", href: "" } });
  return (
    <>
      <PageHeader
        className="max-sm:flex-col max-sm:items-stretch"
        title="联系我"
        description="管理主页公开邮箱与联系方式，支持排序及显示控制。"
        actions={
          <>
            <a className="btn-secondary" href="/#/#contact" target="_blank" rel="noreferrer">
              <ExternalLink className={icon} aria-hidden="true" />
              预览网站
            </a>
            <button
              className="btn-primary"
              type="button"
              disabled={!value || save.isPending || value.contact.links.length >= 20}
              onClick={add}
            >
              <Plus className={icon} aria-hidden="true" />
              添加联系方式
            </button>
          </>
        }
      />
      {isPending ? (
        <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>
      ) : error ? (
        <DatabaseNotice error={error} subject="联系方式管理" />
      ) : (
        value && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (dirty && !save.isPending) save.mutate(value);
            }}
          >
            <fieldset disabled={save.isPending} className="min-w-0 space-y-5 disabled:opacity-60">
              <div className="border-b border-line pb-5">
                <Field
                  label="公开邮箱"
                  htmlFor="contact-email"
                  hint="留空即可隐藏邮箱；不会影响下面的联系方式。"
                  className="max-w-md"
                >
                  <input
                    id="contact-email"
                    className="field"
                    type="email"
                    maxLength={254}
                    value={value.contact.email}
                    onChange={(e) => change({ ...value.contact, email: e.target.value })}
                  />
                </Field>
              </div>
              <section className="card min-w-0" aria-label="联系方式">
                <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
                  <h2 className="text-[14px] font-semibold text-brand-dark">
                    联系方式{" "}
                    <span className="ml-1 text-[12px] font-normal text-faint">
                      {value.contact.links.length} / 20
                    </span>
                  </h2>
                  <span className="text-[11.5px] text-faint">拖动或用菜单排序</span>
                </div>
                <ul className="divide-y divide-line-soft">
                  {value.contact.links.map((link, index) => (
                    <li
                      key={index}
                      onDragOver={(event) => {
                        if (drag !== null && drag !== index) {
                          event.preventDefault();
                          setOver(index);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (drag !== null) move(drag, index);
                        setDrag(null);
                        setOver(null);
                      }}
                      className={`flex min-w-0 items-center gap-2 px-3 py-3 transition-colors hover:bg-brand-secondary/5 sm:gap-3 sm:px-4 ${over === index ? "bg-brand-secondary/10 ring-1 ring-inset ring-brand-secondary" : ""}`}
                    >
                      <span
                        draggable={!save.isPending}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", String(index));
                          setDrag(index);
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setOver(null);
                        }}
                        aria-hidden="true"
                        className="cursor-grab touch-none p-1 text-faint active:cursor-grabbing"
                      >
                        <GripVertical className={icon} />
                      </span>
                      <TechIcon name={link.label} url={platformIcon(link.href)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-brand-dark">
                          {link.label}
                        </p>
                        <a
                          className="block truncate text-[12px] text-muted hover:text-brand hover:underline"
                          href={link.href}
                          title={link.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {link.href}
                        </a>
                      </div>
                      <IconButton
                        label={`编辑 ${link.label}`}
                        onClick={() => setEditing({ index, link })}
                      >
                        <Pencil className={icon} />
                      </IconButton>
                      <Menu
                        label={`${link.label}：更多操作`}
                        items={[
                          {
                            label: "上移",
                            icon: <ArrowUp className={icon} />,
                            disabled: index === 0,
                            onSelect: () => move(index, index - 1)
                          },
                          {
                            label: "下移",
                            icon: <ArrowDown className={icon} />,
                            disabled: index === value.contact.links.length - 1,
                            onSelect: () => move(index, index + 1)
                          },
                          {
                            label: "删除",
                            icon: <Trash2 className={icon} />,
                            danger: true,
                            onSelect: () =>
                              change({
                                ...value.contact,
                                links: value.contact.links.filter((_, i) => i !== index)
                              })
                          }
                        ]}
                      />
                    </li>
                  ))}
                </ul>
                {!value.contact.links.length && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[13px] text-muted">还没有联系方式，网站将隐藏这部分链接。</p>
                    <button className="btn-secondary mt-3" type="button" onClick={add}>
                      <Plus className={icon} />
                      添加联系方式
                    </button>
                  </div>
                )}
              </section>
            </fieldset>
            {save.error && (
              <p role="alert" className="text-[13px] text-status-error">
                保存失败，草稿已保留。{save.error.message}
              </p>
            )}
            <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-card">
              <p role="status" className="text-[12.5px] text-muted">
                {dirty ? "有未保存的更改" : "没有未保存的更改"}
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={!dirty || save.isPending}
                  onClick={() => {
                    setDraft(null);
                    save.reset();
                  }}
                >
                  取消修改
                </button>
                <button className="btn-primary" type="submit" disabled={!dirty || save.isPending}>
                  {save.isPending ? "保存中…" : "保存更改"}
                </button>
              </div>
            </div>
          </form>
        )
      )}
      {editing && value && (
        <ContactLinkEditor
          initial={editing.link}
          adding={editing.index === -1}
          onClose={() => setEditing(null)}
          onApply={(link) => {
            const links = [...value.contact.links];
            if (editing.index === -1) links.push(link);
            else links[editing.index] = link;
            change({ ...value.contact, links });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ContactLinkEditor({
  initial,
  adding,
  onClose,
  onApply
}: {
  initial: ContactLink;
  adding: boolean;
  onClose: () => void;
  onApply: (link: ContactLink) => void;
}) {
  const [link, setLink] = useState(initial);
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title={adding ? "添加联系方式" : "编辑联系方式"}
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" type="submit" form="contact-link-editor">
            {adding ? "添加到草稿" : "应用到草稿"}
          </button>
        </>
      }
    >
      <form
        id="contact-link-editor"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const url = new URL(link.href.trim());
            if (url.protocol !== "https:" || url.username || url.password) throw new Error();
          } catch {
            setError("请填写不含登录凭据的有效 HTTPS 链接。");
            return;
          }
          if (!link.label.trim()) {
            setError("请填写显示名称。");
            return;
          }
          onApply({ label: link.label.trim(), href: link.href.trim() });
        }}
      >
        <Field label="显示名称" htmlFor="contact-link-label">
          <input
            data-autofocus
            id="contact-link-label"
            className="field"
            required
            maxLength={80}
            value={link.label}
            onChange={(e) => setLink({ ...link, label: e.target.value })}
          />
        </Field>
        <Field
          label="HTTPS URL"
          htmlFor="contact-link-url"
          hint="应用到草稿后，点击页面“保存更改”才会发布。"
        >
          <input
            id="contact-link-url"
            className="field"
            type="url"
            required
            maxLength={2048}
            value={link.href}
            onChange={(e) => setLink({ ...link, href: e.target.value })}
          />
        </Field>
        {error && (
          <p role="alert" className="text-[12.5px] text-status-error">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
