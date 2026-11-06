import { type AdminContactResponse, type ContactContent } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/layout/AdminLayout";
import { useToast } from "../components/ui/Toast";
import { request } from "../lib/api";

const key = ["admin", "contact"];
const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";
export function ContactPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => request<AdminContactResponse>("/api/admin/contact")
  });
  const [draft, setDraft] = useState<AdminContactResponse | null>(null);
  const save = useMutation({
    mutationFn: (body: AdminContactResponse) =>
      request<AdminContactResponse>("/api/admin/contact", {
        method: "PUT",
        json: body
      }),
    onSuccess: (response) => {
      qc.setQueryData(key, response);
      setDraft(null);
      toast("联系方式已保存");
    },
    onError: (e: Error) => toast(e.message, "error")
  });
  useEffect(() => {
    if (!draft) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);
  const value = draft ?? data;
  const change = (contact: ContactContent) =>
    value && setDraft({ contact, revision: value.revision });
  return (
    <>
      <PageHeader
        title="联系我"
        description="管理首页公开邮箱及联系方式。留空邮箱可隐藏；联系方式按列表顺序展示。"
      />
      {isPending ? (
        <p>加载中…</p>
      ) : error ? (
        <p role="alert">{error.message}</p>
      ) : (
        value && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(value);
            }}
          >
            <fieldset disabled={save.isPending} className="space-y-5 disabled:opacity-60">
              <label className="block space-y-2">
                <span>公开邮箱</span>
                <input
                  className={field}
                  type="email"
                  maxLength={254}
                  value={value.contact.email}
                  onChange={(e) => change({ ...value.contact, email: e.target.value })}
                />
              </label>
              {value.contact.links.map((link, index) => (
                <div className="space-y-2 rounded-xl border border-line p-4" key={index}>
                  <label className="block">
                    显示名称
                    <input
                      className={field}
                      required
                      maxLength={80}
                      value={link.label}
                      onChange={(e) =>
                        change({
                          ...value.contact,
                          links: value.contact.links.map((v, i) =>
                            i === index ? { ...v, label: e.target.value } : v
                          )
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    HTTPS 链接
                    <input
                      className={field}
                      required
                      type="url"
                      pattern="https://.*"
                      maxLength={2048}
                      value={link.href}
                      onChange={(e) =>
                        change({
                          ...value.contact,
                          links: value.contact.links.map((v, i) =>
                            i === index ? { ...v, href: e.target.value } : v
                          )
                        })
                      }
                    />
                  </label>
                  <div className="flex gap-4">
                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={!index}
                      onClick={() => {
                        const links = [...value.contact.links];
                        [links[index - 1], links[index]] = [links[index]!, links[index - 1]!];
                        change({ ...value.contact, links });
                      }}
                    >
                      上移
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={index === value.contact.links.length - 1}
                      onClick={() => {
                        const links = [...value.contact.links];
                        [links[index], links[index + 1]] = [links[index + 1]!, links[index]!];
                        change({ ...value.contact, links });
                      }}
                    >
                      下移
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        change({
                          ...value.contact,
                          links: value.contact.links.filter((_, i) => i !== index)
                        })
                      }
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="btn-secondary"
                type="button"
                disabled={value.contact.links.length >= 20}
                onClick={() =>
                  change({
                    ...value.contact,
                    links: [...value.contact.links, { label: "", href: "" }]
                  })
                }
              >
                添加联系方式
              </button>
              <div className="flex gap-4">
                <button className="btn-primary" type="submit" disabled={!draft}>
                  {save.isPending ? "保存中…" : "保存"}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={!draft}
                  onClick={() => setDraft(null)}
                >
                  放弃修改
                </button>
              </div>
            </fieldset>
          </form>
        )
      )}
    </>
  );
}
