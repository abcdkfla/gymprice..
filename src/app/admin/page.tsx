"use client";

import { useCallback, useState } from "react";

/**
 * MVP 관리자 페이지.
 * ADMIN_SECRET 헤더 인증 방식 — 운영 규모가 커지면 Supabase Auth 관리자 role로 교체 권장.
 */
export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [words, setWords] = useState<any[]>([]);
  const [newWord, setNewWord] = useState({ word: "", matchType: "contains", category: "profanity" });
  const [error, setError] = useState<string | null>(null);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
          ...(init?.headers ?? {})
        }
      });
      if (res.status === 401) throw new Error("비밀번호가 올바르지 않습니다");
      return res.json();
    },
    [secret]
  );

  const loadAll = async () => {
    setError(null);
    try {
      const [r, w] = await Promise.all([api("/api/admin/reports"), api("/api/admin/banned-words")]);
      setReports(r.reports ?? []);
      setWords(w.words ?? []);
      setAuthed(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const act = async (reportId: string, action: string) => {
    await api("/api/admin/reports", { method: "POST", body: JSON.stringify({ reportId, action }) });
    loadAll();
  };

  const addWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/admin/banned-words", {
      method: "POST",
      body: JSON.stringify(newWord)
    });
    if (data.error) return alert(data.error);
    setNewWord({ ...newWord, word: "" });
    loadAll();
  };

  const removeWord = async (id: number) => {
    await api(`/api/admin/banned-words?id=${id}`, { method: "DELETE" });
    loadAll();
  };

  if (!authed) {
    return (
      <main className="mx-auto max-w-sm px-4 pt-24">
        <h1 className="text-lg font-bold">관리자 로그인</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadAll();
          }}
          className="mt-4 space-y-3"
        >
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="관리자 비밀번호"
            className="focusable h-11 w-full rounded-xl border border-line px-3 text-sm"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button className="focusable h-11 w-full rounded-xl bg-ink text-sm font-bold text-paper">
            로그인
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <h1 className="text-xl font-extrabold">관리자</h1>

      {/* ── 신고 처리 ── */}
      <section>
        <h2 className="text-base font-bold">대기 중 신고 {reports.length}건</h2>
        <ul className="mt-3 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-line p-3 text-sm">
              <p className="text-xs text-muted">
                {r.target_type === "comment" ? "코멘트" : "가격 제보"} ·{" "}
                {new Date(r.created_at).toLocaleString("ko-KR")} · 사유: {r.reason || "없음"}
              </p>
              <div className="mt-2 rounded-lg bg-mist p-2">
                {r.target ? (
                  <>
                    <p className="text-xs font-semibold">{r.target.places?.name}</p>
                    <p className="mt-0.5 whitespace-pre-wrap">
                      {r.target_type === "comment"
                        ? r.target.content
                        : `${r.target.product_type} / ${r.target.duration} / ${Number(
                            r.target.price
                          ).toLocaleString()}원 (${r.target.anon_nickname})`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">현재 상태: {r.target.status}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted">대상 콘텐츠 없음(이미 삭제됨)</p>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => act(r.id, "hide")}
                  className="focusable rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-paper"
                >
                  숨김 처리
                </button>
                <button
                  onClick={() => act(r.id, "restore")}
                  className="focusable rounded-lg border border-line px-3 py-1.5 text-xs font-semibold"
                >
                  복구
                </button>
                <button
                  onClick={() => act(r.id, "reject")}
                  className="focusable rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted"
                >
                  신고 기각
                </button>
              </div>
            </li>
          ))}
          {reports.length === 0 && <li className="text-sm text-muted">대기 중인 신고가 없습니다.</li>}
        </ul>
      </section>

      {/* ── 금칙어 관리 ── */}
      <section>
        <h2 className="text-base font-bold">금칙어 {words.length}개</h2>
        <form onSubmit={addWord} className="mt-3 flex flex-wrap gap-2">
          <input
            value={newWord.word}
            onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
            placeholder="추가할 단어 또는 정규식"
            required
            className="focusable h-10 flex-1 rounded-lg border border-line px-3 text-sm"
          />
          <select
            value={newWord.matchType}
            onChange={(e) => setNewWord({ ...newWord, matchType: e.target.value })}
            className="focusable h-10 rounded-lg border border-line px-2 text-sm"
          >
            <option value="contains">포함 매칭</option>
            <option value="regex">정규식</option>
          </select>
          <select
            value={newWord.category}
            onChange={(e) => setNewWord({ ...newWord, category: e.target.value })}
            className="focusable h-10 rounded-lg border border-line px-2 text-sm"
          >
            <option value="profanity">욕설·비방</option>
            <option value="ad">광고</option>
            <option value="privacy">개인정보</option>
          </select>
          <button className="focusable h-10 rounded-lg bg-ink px-4 text-sm font-bold text-paper">
            추가
          </button>
        </form>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {words.map((w) => (
            <li key={w.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <code className="flex-1 break-all">{w.word}</code>
              <span className="text-[11px] text-muted">
                {w.match_type} · {w.category}
              </span>
              <button
                onClick={() => removeWord(w.id)}
                className="focusable text-xs text-danger underline"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
