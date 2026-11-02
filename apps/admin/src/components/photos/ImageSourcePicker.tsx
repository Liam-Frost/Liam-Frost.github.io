import type { AdminPhotoImport, PhotoImportMode, PhotoSourceType } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, HardDrive, Image, Link2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { api, serverPreviewUrl } from "../../lib/api";
import { InfoTip } from "../ui/Tooltip";

type Tab = "upload" | "server" | "flickr" | "url";

const TABS: { value: Tab; label: string; icon: typeof Upload }[] = [
  { value: "upload", label: "本机上传", icon: Upload },
  { value: "server", label: "服务器文件夹", icon: HardDrive },
  { value: "flickr", label: "Flickr", icon: Image },
  { value: "url", label: "图片链接", icon: Link2 }
];

/** How the admin names where a photo's image came from. */
export const SOURCE_LABELS: Record<PhotoSourceType, string> = {
  upload: "本机上传",
  server: "服务器文件",
  flickr: "Flickr",
  url: "图片链接"
};

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/tiff";

const formatSize = (bytes: number | null) =>
  bytes === null
    ? ""
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Where a photo's image comes from: the device, a server import folder, a Flickr photo or an image link.
 * Used to add photos (several at once) and to replace one photo's image.
 */
export function ImageSourcePicker({
  multiple,
  busy = false,
  action,
  onFiles,
  onImports
}: {
  multiple: boolean;
  busy?: boolean;
  /** Button text, e.g. 添加 or 替换. */
  action: string;
  onFiles: (files: File[]) => void;
  onImports: (items: AdminPhotoImport[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("upload");
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="图片来源" className="flex flex-wrap gap-1.5">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${
              tab === value
                ? "bg-brand text-white"
                : "bg-brand-secondary/10 text-brand hover:bg-brand-secondary/18"
            }`}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      {tab === "upload" ? (
        <UploadPane multiple={multiple} busy={busy} onFiles={onFiles} />
      ) : tab === "server" ? (
        <ServerPane multiple={multiple} busy={busy} action={action} onImports={onImports} />
      ) : (
        <LinkPane
          key={tab}
          type={tab}
          multiple={multiple}
          busy={busy}
          action={action}
          onImports={onImports}
        />
      )}
    </div>
  );
}

function UploadPane({
  multiple,
  busy,
  onFiles
}: {
  multiple: boolean;
  busy: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length) onFiles(multiple ? images : images.slice(0, 1));
  };
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        take([...e.dataTransfer.files]);
      }}
      className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center text-[13px] text-muted transition-colors ${
        over ? "border-brand-secondary bg-brand-secondary/8" : "border-line"
      }`}
    >
      <Upload aria-hidden="true" className="size-6 text-faint" />
      <p>
        把图片拖到这里，或
        <button
          type="button"
          className="mx-1 font-semibold text-brand hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          选择{multiple ? "图片" : "一张图片"}
        </button>
      </p>
      <p className="text-[12px] text-faint">
        JPEG、PNG、WebP、AVIF、TIFF；生成多个尺寸并去掉 EXIF（含 GPS），原图私有保存。
      </p>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          take(files);
        }}
      />
    </div>
  );
}

function ModeChoice({
  mode,
  onChange,
  name
}: {
  mode: PhotoImportMode;
  onChange: (mode: PhotoImportMode) => void;
  name: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="存放方式"
      className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]"
    >
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name={name}
          checked={mode === "import"}
          onChange={() => onChange("import")}
        />
        导入为本站托管（推荐）
        <InfoTip text="下载后生成多个尺寸、去掉 EXIF，由本站提供；原链接以后失效也不影响。" />
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name={name}
          checked={mode === "reference"}
          onChange={() => onChange("reference")}
        />
        只引用原链接
        <InfoTip text="不复制，访客直接从原地址加载。省空间，但链接失效时照片会坏，也没有多尺寸图。之后可以在编辑页“转为本站托管”。" />
      </label>
    </div>
  );
}

function LinkPane({
  type,
  multiple,
  busy,
  action,
  onImports
}: {
  type: "flickr" | "url";
  multiple: boolean;
  busy: boolean;
  action: string;
  onImports: (items: AdminPhotoImport[]) => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<PhotoImportMode>("import");
  const [error, setError] = useState("");
  const links = text
    .split(/\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const submit = () => {
    const bad = links.find((link) => !link.startsWith("https://"));
    if (bad) {
      setError(`只支持 https 链接：${bad}`);
      return;
    }
    if (!multiple && links.length > 1) {
      setError("替换图片时只能填一个链接");
      return;
    }
    setError("");
    onImports(links.map((url) => ({ from: { type, url }, mode })));
    setText("");
  };
  return (
    <div className="space-y-3">
      <label className="block space-y-1.5 text-[13px]">
        <span className="text-muted">
          {type === "flickr"
            ? "Flickr 照片页链接（flickr.com/photos/… 或 flic.kr/p/…），也可以是 live.staticflickr.com 图片链接"
            : "图片链接（https）：图床、R2 / S3 对象存储的公开链接等"}
          {multiple ? "，每行一个" : ""}
        </span>
        <textarea
          className="field min-h-[96px] font-mono !text-[12.5px]"
          value={text}
          placeholder={
            type === "flickr"
              ? "https://www.flickr.com/photos/…/55042276542/"
              : "https://example.com/photos/IMG_0042.jpg"
          }
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <ModeChoice mode={mode} onChange={setMode} name={`photo-mode-${type}`} />
      {error ? (
        <p role="alert" className="text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn-primary"
        disabled={busy || !links.length}
        onClick={submit}
      >
        {action}
        {multiple && links.length > 1 ? ` ${links.length} 张` : ""}
      </button>
    </div>
  );
}

function ServerPane({
  multiple,
  busy,
  action,
  onImports
}: {
  multiple: boolean;
  busy: boolean;
  action: string;
  onImports: (items: AdminPhotoImport[]) => void;
}) {
  const [root, setRoot] = useState(0);
  const [path, setPath] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const { data, error, isPending } = useQuery({
    queryKey: ["admin", "photo-server", root, path],
    queryFn: () => api.serverFolder(root, path),
    retry: false
  });
  const open = (next: string) => {
    setPath(next);
    setPicked([]);
  };

  if (isPending) return <p className="text-[13px] text-subtle">读取中…</p>;
  if (error) return <p className="text-[13px] text-status-error">{error.message}</p>;
  if (!data.roots.length) {
    return (
      <p className="rounded-xl border border-line-soft p-4 text-[13px] leading-relaxed text-muted">
        还没有配置服务器导入目录。在 <code className="chip">apps/api/.env</code> 中设置{" "}
        <code className="chip">PHOTO_IMPORT_DIRS</code>（逗号分隔的绝对路径，例如{" "}
        <code className="chip">/srv/photos/inbox</code>）后重启 API。可以先用 rsync 或 SFTP
        把原图传到那里，再在这里挑选导入。
      </p>
    );
  }

  const images = data.entries.filter((entry) => entry.type === "image");
  const crumbs = data.path ? data.path.split("/") : [];
  const toggle = (file: string) =>
    setPicked((list) =>
      multiple ? (list.includes(file) ? list.filter((p) => p !== file) : [...list, file]) : [file]
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 text-[13px]">
        {data.roots.length > 1 ? (
          <select
            className="field !w-auto !py-1"
            aria-label="导入目录"
            value={root}
            onChange={(e) => {
              setRoot(Number(e.target.value));
              open("");
            }}
          >
            {data.roots.map((r) => (
              <option key={r.index} value={r.index}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <button type="button" className="text-brand hover:underline" onClick={() => open("")}>
            {data.roots[0]!.name}
          </button>
        )}
        {crumbs.map((part, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <ChevronRight aria-hidden="true" className="size-3.5 text-faint" />
            <button
              type="button"
              className="text-brand hover:underline"
              onClick={() => open(crumbs.slice(0, i + 1).join("/"))}
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {data.entries.length ? (
        <ul className="grid max-h-[340px] grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 overflow-x-hidden overflow-y-auto p-0.5 pr-1">
          {data.entries.map((entry) =>
            entry.type === "dir" ? (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => open(entry.path)}
                  className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-line p-3 text-[12.5px] text-brand hover:bg-brand-secondary/8"
                >
                  <Folder aria-hidden="true" className="size-6" />
                  <span className="w-full truncate">{entry.name}</span>
                </button>
              </li>
            ) : (
              <li key={entry.path}>
                <label
                  className={`block cursor-pointer overflow-hidden rounded-xl border text-[12px] ${
                    picked.includes(entry.path)
                      ? "border-brand ring-2 ring-brand/30"
                      : "border-line"
                  }`}
                >
                  <img
                    src={serverPreviewUrl(data.root, entry.path)}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full bg-line-soft object-cover"
                  />
                  <span className="flex items-center gap-1.5 p-1.5">
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name="server-photo"
                      checked={picked.includes(entry.path)}
                      onChange={() => toggle(entry.path)}
                    />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  </span>
                  <span className="block px-1.5 pb-1.5 text-[11px] text-faint">
                    {formatSize(entry.size)}
                  </span>
                </label>
              </li>
            )
          )}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">这个文件夹里没有图片或子文件夹。</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {multiple && images.length ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setPicked(picked.length === images.length ? [] : images.map((i) => i.path))
            }
          >
            {picked.length === images.length ? "取消全选" : `全选本文件夹（${images.length}）`}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !picked.length}
          onClick={() => {
            onImports(
              picked.map((file) => ({
                from: { type: "server", root: data.root, path: file },
                mode: "import"
              }))
            );
            setPicked([]);
          }}
        >
          {action}
          {multiple && picked.length ? ` ${picked.length} 张` : ""}
        </button>
        <span className="text-[12px] text-faint">
          服务器上的文件会复制并处理为本站托管，原文件保留。
        </span>
      </div>
    </div>
  );
}
