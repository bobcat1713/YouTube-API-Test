"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type ApiResult = {
  ok: boolean;
  status: number;
  apiName: string;
  reason: string | null;
  data: any;
};

type LogEntry = {
  time: string;
  apiName: string;
  target: string;
  success: boolean;
  status: number;
  reason: string | null;
  memo: string;
};

type PlaylistProbe = {
  key: string;
  label: string;
  playlistId?: string;
  available: string;
  listResult?: ApiResult;
};

const LOG_STORAGE_KEY = "yt-api-test-logs";
const SELECTED_PLAYLIST_KEY = "yt-selected-playlist-id";

async function youtubeRequest(payload: {
  apiName: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}) {
  const res = await fetch("/api/youtube/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await res.json()) as ApiResult;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [channelResult, setChannelResult] = useState<ApiResult | null>(null);
  const [playlistsResult, setPlaylistsResult] = useState<ApiResult | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [playlistItemId, setPlaylistItemId] = useState("");
  const [testPlaylistId, setTestPlaylistId] = useState("");
  const [lastWriteResult, setLastWriteResult] = useState<ApiResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (raw) setLogs(JSON.parse(raw));
    const rememberedPlaylistId = localStorage.getItem(SELECTED_PLAYLIST_KEY);
    if (rememberedPlaylistId) setSelectedPlaylistId(rememberedPlaylistId);
  }, []);

  useEffect(() => {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
  }, [logs]);

  useEffect(() => {
    if (selectedPlaylistId) {
      localStorage.setItem(SELECTED_PLAYLIST_KEY, selectedPlaylistId);
    }
  }, [selectedPlaylistId]);

  const addLog = (entry: Omit<LogEntry, "time">) => {
    setLogs((prev) => [
      { ...entry, time: new Date().toLocaleString("ja-JP") },
      ...prev
    ]);
  };

  const loadChannelAndRelated = async () => {
    const result = await youtubeRequest({
      apiName: "channels",
      query: { part: "snippet,contentDetails", mine: true }
    });
    setChannelResult(result);
    addLog({
      apiName: "channels.list",
      target: "mine",
      success: result.ok,
      status: result.status,
      reason: result.reason,
      memo: "relatedPlaylists を取得"
    });
  };

  const loadMyPlaylists = async () => {
    const result = await youtubeRequest({
      apiName: "playlists",
      query: { part: "snippet,contentDetails", mine: true, maxResults: 50 }
    });
    setPlaylistsResult(result);
    addLog({
      apiName: "playlists.list",
      target: "mine",
      success: result.ok,
      status: result.status,
      reason: result.reason,
      memo: "通常の再生リスト一覧"
    });
  };

  const probePlaylistItems = async (
    targetLabel: string,
    playlistId: string | undefined
  ): Promise<ApiResult | null> => {
    if (!playlistId) {
      addLog({
        apiName: "playlistItems.list",
        target: targetLabel,
        success: false,
        status: 0,
        reason: "playlistIdMissing",
        memo: "playlist ID がないため未実行"
      });
      return null;
    }
    const result = await youtubeRequest({
      apiName: "playlistItems",
      query: { part: "snippet,contentDetails,status", playlistId, maxResults: 20 }
    });
    addLog({
      apiName: "playlistItems.list",
      target: targetLabel,
      success: result.ok,
      status: result.status,
      reason: result.reason,
      memo: `playlistId=${playlistId}`
    });
    return result;
  };

  const related =
    channelResult?.data?.items?.[0]?.contentDetails?.relatedPlaylists ?? {};

  const playlistSections: PlaylistProbe[] = useMemo(() => {
    return [
      {
        key: "normal",
        label: "通常の再生リスト",
        playlistId: selectedPlaylistId,
        available: selectedPlaylistId ? "取得済み" : "未選択"
      },
      {
        key: "likes",
        label: "高評価した動画",
        playlistId: related.likes,
        available: related.likes ? "取得済み" : "未取得 / 取得不可"
      },
      {
        key: "watchHistory",
        label: "視聴履歴",
        playlistId: related.watchHistory,
        available: related.watchHistory ? "取得済み" : "未取得 / 取得不可"
      },
      {
        key: "watchLater",
        label: "あとで見る",
        playlistId: related.watchLater,
        available: related.watchLater ? "取得済み" : "未取得 / 取得不可"
      }
    ];
  }, [related.likes, related.watchHistory, related.watchLater, selectedPlaylistId]);

  const [probeResults, setProbeResults] = useState<Record<string, ApiResult | null>>({});

  const runListProbe = async (section: PlaylistProbe) => {
    const result = await probePlaylistItems(section.label, section.playlistId);
    setProbeResults((prev) => ({ ...prev, [section.key]: result }));
  };

  const createTestPlaylist = async () => {
    const result = await youtubeRequest({
      apiName: "playlists",
      method: "POST",
      query: { part: "snippet,status" },
      body: {
        snippet: {
          title: `YouTube API Test Playlist ${new Date().toLocaleString("ja-JP")}`,
          description: "YouTube API behavior investigation"
        },
        status: { privacyStatus: "private" }
      }
    });
    setLastWriteResult(result);
    const createdId = result.data?.id;
    if (createdId) {
      setTestPlaylistId(createdId);
      setSelectedPlaylistId(createdId);
    }
    addLog({
      apiName: "playlists.insert",
      target: "テスト用再生リスト",
      success: result.ok,
      status: result.status,
      reason: result.reason,
      memo: createdId ? `created=${createdId}` : "作成失敗"
    });
  };

  const insertItem = async () => {
    const targetPlaylistId = testPlaylistId || selectedPlaylistId;
    const result = await youtubeRequest({
      apiName: "playlistItems",
      method: "POST",
      query: { part: "snippet" },
      body: {
        snippet: {
          playlistId: targetPlaylistId,
          resourceId: { kind: "youtube#video", videoId }
        }
      }
    });
    setLastWriteResult(result);
    if (result.data?.id) setPlaylistItemId(result.data.id);
    addLog({
      apiName: "playlistItems.insert",
      target: targetPlaylistId || "未設定",
      success: result.ok,
      status: result.status,
      reason: result.reason,
      memo: `videoId=${videoId}`
    });
  };

  const deleteItem = async () => {
    const result = await youtubeRequest({
      apiName: "playlistItems",
      method: "DELETE",
      query: { id: playlistItemId }
    });
    setLastWriteResult(result);
    addLog({
      apiName: "playlistItems.delete",
      target: playlistItemId,
      success: result.ok,
      status: result.status,
      reason: result.reason,
      memo: "playlistItemId を削除"
    });
  };

  const updateItem = async () => {
    const targetPlaylistId = testPlaylistId || selectedPlaylistId;
    const result = await youtubeRequest({
      apiName: "playlistItems",
      method: "PUT",
      query: { part: "snippet" },
      body: {
        id: playlistItemId,
        snippet: {
          playlistId: targetPlaylistId,
          resourceId: { kind: "youtube#video", videoId }
        }
      }
    });
    setLastWriteResult(result);
    addLog({
      apiName: "playlistItems.update",
      target: playlistItemId,
      success: result.ok,
      status: result.status,
      reason: result.reason,
      memo: `videoId=${videoId}`
    });
  };

  if (status === "loading") {
    return <main>Loading...</main>;
  }

  if (!session) {
    return (
      <main>
        <div className="card">
          <h1>YouTube Data API 調査ツール</h1>
          <p>
            このアプリは YouTube Data API の取得・書き込み挙動を調査するためのローカル専用ツールです。
          </p>
          <button onClick={() => signIn("google")}>Google ログイン</button>
        </div>
      </main>
    );
  }

  const channelItem = channelResult?.data?.items?.[0];

  return (
    <main>
      <h1>YouTube Data API 調査ツール</h1>

      <section className="card">
        <h2>A. 認証情報エリア</h2>
        <p>ログイン状態: ログイン済み ({session.user?.email})</p>
        <p>チャンネル名: {channelItem?.snippet?.title ?? "未取得"}</p>
        <p>チャンネル ID: {channelItem?.id ?? "未取得"}</p>
        <p className="small">使用スコープ: {session.scope ?? "未取得"}</p>
        <button onClick={() => signOut()}>ログアウト</button>
      </section>

      <section className="card">
        <h2>B. relatedPlaylists 取得エリア</h2>
        <button onClick={loadChannelAndRelated}>
          channels.list(part=snippet,contentDetails,mine=true) 実行
        </button>
        <p>likes: {related.likes ?? "未取得 / 取得不可"}</p>
        <p>watchHistory: {related.watchHistory ?? "未取得 / 取得不可"}</p>
        <p>watchLater: {related.watchLater ?? "未取得 / 取得不可"}</p>
        <h3>raw JSON</h3>
        <pre>{JSON.stringify(channelResult, null, 2)}</pre>
      </section>

      <section className="card">
        <h2>C. プレイリスト調査エリア</h2>
        <button onClick={loadMyPlaylists}>playlists.list(mine=true) 実行</button>
        <label>
          通常の再生リスト選択
          <select
            value={selectedPlaylistId}
            onChange={(e) => setSelectedPlaylistId(e.target.value)}
          >
            <option value="">--選択--</option>
            {(playlistsResult?.data?.items ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.snippet?.title} ({p.id})
              </option>
            ))}
          </select>
        </label>

        <div className="grid">
          {playlistSections.map((section) => {
            const result = probeResults[section.key];
            return (
              <div key={section.key} className="card">
                <h3>{section.label}</h3>
                <p>playlist ID: {section.playlistId ?? "未取得"}</p>
                <p>取得可否: {section.available}</p>
                <button onClick={() => runListProbe(section)}>
                  playlistItems.list 実行
                </button>
                <p>取得件数: {result?.data?.items?.length ?? 0}</p>
                <p>HTTP ステータス: {result?.status ?? "-"}</p>
                <p>error reason: {result?.reason ?? "-"}</p>
                <pre>{JSON.stringify(result, null, 2)}</pre>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>D. 書き込みテストエリア</h2>
        <button onClick={createTestPlaylist}>テスト用再生リスト作成</button>
        <p>テスト用 playlistId: {testPlaylistId || "未作成"}</p>
        <label>
          動画 ID
          <input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder="YouTube videoId"
          />
        </label>
        <label>
          playlistItemId (delete/update 用)
          <input
            value={playlistItemId}
            onChange={(e) => setPlaylistItemId(e.target.value)}
            placeholder="playlistItem id"
          />
        </label>
        <button onClick={insertItem}>insert テスト</button>
        <button onClick={deleteItem}>delete テスト</button>
        <button onClick={updateItem}>update テスト</button>
        <h3>結果ログ表示</h3>
        <pre>{JSON.stringify(lastWriteResult, null, 2)}</pre>
      </section>

      <section className="card">
        <h2>E. 実行ログエリア</h2>
        {logs.length === 0 && <p>ログなし</p>}
        {logs.map((log, index) => (
          <div key={`${log.time}-${index}`}>
            <strong>{log.time}</strong> | {log.apiName} | {log.target}
            <span className="badge">{log.success ? "成功" : "失敗"}</span>
            <div className="small">
              HTTP: {log.status} / reason: {log.reason ?? "-"} / memo: {log.memo}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
