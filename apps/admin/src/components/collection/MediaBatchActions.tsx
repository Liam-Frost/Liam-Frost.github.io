import type { AdminBatchRequest, AdminMediaBatchPatch, MediaStatus } from "@liam-frost/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { mediaItemKey, mediaKey } from "../../hooks/useMedia";
import { usePlaylists, useSetPlaylist } from "../../hooks/usePlaylists";
import type { Selection } from "../../hooks/useSelection";
import { api } from "../../lib/api";
import { pickText, statusLabels } from "../../lib/i18n";
import { describeBatch } from "../ui/BatchBar";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { tr } from "../../lib/messages";

/** Bulk actions for collection entries of one kind; songs also go in and out of the player. */
export function MediaBatchActions({ kind, selection }: { kind: string; selection: Selection }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ids = selection.selected;
  const isMusic = kind === "track";
  const { data: playlists } = usePlaylists();
  const setPlaylist = useSetPlaylist();

  const addToPlaylist = async (playlistId: string) => {
    setBusy(true);
    try {
      const before = playlists?.find((p) => p.id === playlistId)?.trackIds.length ?? 0;
      const { playlist } = await api.playlistTracks(playlistId, { action: "add", ids });
      setPlaylist(playlist);
      const added = playlist.trackIds.length - before;
      toast(
        tr(
          "已加入“{0}” {1} 首{2}",
          pickText(playlist.name),
          added,
          added < ids.length ? tr("（{0} 首已在歌单里）", ids.length - added) : ""
        )
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : tr("操作失败"), "error");
    } finally {
      setBusy(false);
    }
  };

  const run = async (request: AdminBatchRequest<AdminMediaBatchPatch>, verb: string) => {
    setBusy(true);
    try {
      const result = await api.batchMedia(request);
      const { text, ok } = describeBatch(result, verb);
      toast(text, ok ? "success" : "error");
      if (request.action === "delete") {
        for (const id of result.done) qc.removeQueries({ queryKey: mediaItemKey(id) });
        selection.clear();
      }
      await qc.invalidateQueries({ queryKey: mediaKey });
    } catch (e) {
      toast(e instanceof Error ? e.message : tr("操作失败"), "error");
    } finally {
      setBusy(false);
    }
  };
  const update = (patch: AdminMediaBatchPatch, verb: string) =>
    void run({ action: "update", ids, patch }, verb);
  const disabled = busy || ids.length === 0;

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => update({ visibility: "public" }, tr("公开"))}
      >
        {tr("公开")}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => update({ visibility: "private" }, tr("隐藏"))}
      >
        {tr("隐藏")}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => update({ featured: true }, tr("设为精选"))}
      >
        {tr("精选")}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => update({ featured: false }, tr("取消精选"))}
      >
        {tr("取消精选")}
      </button>
      {isMusic ? (
        <>
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled}
            onClick={() => update({ inPlayer: true }, tr("加入播放器"))}
          >
            {tr("加入播放器")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled}
            onClick={() => update({ inPlayer: false }, tr("移出播放器"))}
          >
            {tr("移出播放器")}
          </button>
          {playlists?.length ? (
            <select
              className="field w-auto"
              aria-label={tr("加入歌单")}
              value=""
              disabled={disabled}
              onChange={(e) => {
                if (e.target.value) void addToPlaylist(e.target.value);
              }}
            >
              <option value="">{tr("加入歌单…")}</option>
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {pickText(playlist.name, tr("未命名歌单"))}
                </option>
              ))}
            </select>
          ) : null}
        </>
      ) : (
        <select
          className="field w-auto"
          aria-label={tr("改状态")}
          value=""
          disabled={disabled}
          onChange={(e) => {
            const status = e.target.value as MediaStatus;
            if (status) update({ status }, tr("改为“{0}”", statusLabels(kind)[status]));
          }}
        >
          <option value="">{tr("改状态…")}</option>
          {(Object.entries(statusLabels(kind)) as [MediaStatus, string][]).map(
            ([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            )
          )}
        </select>
      )}
      <button
        type="button"
        className="btn-danger"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" className="size-4" /> {tr("删除")}
      </button>

      <Dialog
        open={confirming}
        size="sm"
        title={tr("批量删除")}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              {tr("取消")}
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                void run({ action: "delete", ids }, tr("删除"));
              }}
            >
              {tr("删除 {0} 项", ids.length)}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          {tr(
            "确定删除选中的 {0} 项吗？{1}、你的记录、短评和关联都会删除，此操作无法撤销。",
            ids.length,
            isMusic ? tr("封面") : tr("海报或封面")
          )}
        </p>
      </Dialog>
    </>
  );
}
