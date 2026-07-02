"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PRODUCT_TYPES,
  DURATIONS,
  CATEGORIES,
  labelOf,
  formatPrice,
  type PriceReport,
  type PlaceComment
} from "@/lib/constants";

interface Seed {
  kakaoPlaceId: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  category: string;
}

export default function PlaceDetail({ seed }: { seed: Seed }) {
  const [placeName, setPlaceName] = useState(seed.name);
  const [prices, setPrices] = useState<PriceReport[]>([]);
  const [comments, setComments] = useState<PlaceComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"price" | "comment">("price");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/places/${seed.kakaoPlaceId}`);
      const data = await res.json();
      if (data.place?.name) setPlaceName(data.place.name);
      setPrices(data.prices ?? []);
      setComments(data.comments ?? []);
    } finally {
      setLoading(false);
    }
  }, [seed.kakaoPlaceId]);

  useEffect(() => {
    load();
  }, [load]);

  // 상품(종류+기간)별 그룹: 최신 제보 = 대표값, 나머지 = 이력
  const grouped = useMemo(() => {
    const map = new Map<string, PriceReport[]>();
    for (const p of prices) {
      const key = `${p.product_type}|${p.duration}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()].map(([key, list]) => ({ key, latest: list[0], history: list.slice(1) }));
  }, [prices]);

  const report = async (targetType: "price_report" | "comment", targetId: string) => {
    const reason = window.prompt("신고 사유를 입력해주세요 (허위 정보 / 광고 / 욕설 등)");
    if (reason == null) return;
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason })
    });
    alert(res.ok ? "신고가 접수되었습니다. 검토 후 처리됩니다." : "신고 접수에 실패했습니다.");
  };

  return (
    <div>
      {/* 헤더 */}
      <header className="rounded-2xl border border-line p-4">
        <p className="text-xs font-medium text-muted">{labelOf(CATEGORIES, seed.category)}</p>
        <h1 className="mt-0.5 text-xl font-extrabold">{placeName || "업체 정보"}</h1>
        <p className="mt-1 text-sm text-muted">{seed.roadAddress || seed.address}</p>
        <div className="mt-3">
          {prices.length > 0 ? (
            <span className="price-sticker">가격 제보 {prices.length}건</span>
          ) : (
            !loading && (
              <span className="text-sm text-muted">
                아직 가격 정보가 없어요. 첫 제보를 남겨주세요!
              </span>
            )
          )}
        </div>
      </header>

      {/* 탭 */}
      <div className="mt-4 grid grid-cols-2 rounded-xl border border-line p-1 text-sm font-semibold">
        {(
          [
            ["price", `가격 정보 ${prices.length}`],
            ["comment", `코멘트 ${comments.length}`]
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`focusable rounded-lg py-2 ${tab === t ? "bg-ink text-paper" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center text-sm text-muted">불러오는 중…</p>}

      {/* ── 가격 탭 ── */}
      {!loading && tab === "price" && (
        <section className="mt-4 space-y-3">
          {grouped.map(({ key, latest, history }) => (
            <PriceCard key={key} latest={latest} history={history} onReport={report} />
          ))}
          {grouped.length === 0 && (
            <p className="rounded-xl bg-mist py-8 text-center text-sm text-muted">
              등록된 가격이 없습니다 — 아래에서 첫 제보를 남겨주세요.
            </p>
          )}
          <PriceForm seed={seed} onDone={load} />
        </section>
      )}

      {/* ── 코멘트 탭 ── */}
      {!loading && tab === "comment" && (
        <section className="mt-4 space-y-3">
          {comments.map((c) => (
            <article key={c.id} className="rounded-xl border border-line p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{c.anon_nickname}</span>
                <span className="text-[11px] text-muted">
                  {new Date(c.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
              <button
                onClick={() => report("comment", c.id)}
                className="focusable mt-2 text-[11px] text-muted underline"
              >
                신고
              </button>
            </article>
          ))}
          {comments.length === 0 && (
            <p className="rounded-xl bg-mist py-8 text-center text-sm text-muted">
              첫 코멘트를 남겨주세요 — 시설, 혼잡도, 환불 경험 무엇이든 좋아요.
            </p>
          )}
          <CommentForm seed={seed} onDone={load} />
        </section>
      )}
    </div>
  );
}

/* ───────────────────── 가격 카드 ───────────────────── */
function PriceCard({
  latest,
  history,
  onReport
}: {
  latest: PriceReport;
  history: PriceReport[];
  onReport: (t: "price_report" | "comment", id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {labelOf(PRODUCT_TYPES, latest.product_type)} · {labelOf(DURATIONS, latest.duration)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {latest.anon_nickname} ·{" "}
            {latest.visited_at
              ? `${latest.visited_at.slice(0, 7).replace("-", "년 ")}월 등록가`
              : new Date(latest.created_at).toLocaleDateString("ko-KR") + " 제보"}
            {latest.is_event_price && " · 이벤트가"}
          </p>
        </div>
        <span className="price-sticker text-base">{formatPrice(latest.price)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {history.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="focusable text-[11px] font-medium text-muted underline"
          >
            과거 제보 {history.length}건 {open ? "접기" : "보기"}
          </button>
        )}
        <button
          onClick={() => onReport("price_report", latest.id)}
          className="focusable ml-auto text-[11px] text-muted underline"
        >
          신고
        </button>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between text-xs text-muted">
              <span>
                {new Date(h.created_at).toLocaleDateString("ko-KR")} · {h.anon_nickname}
                {h.is_event_price && " · 이벤트가"}
              </span>
              <span className="font-semibold text-ink">{formatPrice(h.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* ───────────────────── 가격 제보 폼 ───────────────────── */
function PriceForm({ seed, onDone }: { seed: Seed; onDone: () => void }) {
  const [form, setForm] = useState({
    nickname: "",
    productType: "membership",
    duration: "3m",
    price: "",
    isEventPrice: false,
    visitedAt: "",
    website: "" // honeypot
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/places/${seed.kakaoPlaceId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          visitedAt: form.visitedAt || null,
          place: seed
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록에 실패했습니다");
      setMsg({ ok: true, text: "가격이 등록되었습니다. 제보 감사합니다!" });
      setForm((f) => ({ ...f, price: "" }));
      onDone();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="rounded-2xl border-2 border-ink p-4">
      <p className="text-sm font-bold">가격 제보하기</p>
      <p className="mt-0.5 text-[11px] text-muted">
        실제 등록했거나 상담받은 가격을 알려주세요. 익명으로 등록됩니다.
      </p>

      {/* honeypot — 사람에게는 보이지 않음 */}
      <input
        type="text"
        value={form.website}
        onChange={(e) => set("website", e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs font-medium">
          상품 종류
          <select
            value={form.productType}
            onChange={(e) => set("productType", e.target.value)}
            className="focusable mt-1 h-10 w-full rounded-lg border border-line px-2 text-sm"
          >
            {PRODUCT_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          기간·횟수
          <select
            value={form.duration}
            onChange={(e) => set("duration", e.target.value)}
            className="focusable mt-1 h-10 w-full rounded-lg border border-line px-2 text-sm"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          가격 (원)
          <input
            type="number"
            inputMode="numeric"
            min={1000}
            step={1000}
            required
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="예: 330000"
            className="focusable mt-1 h-10 w-full rounded-lg border border-line px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium">
          등록·상담 시기 (선택)
          <input
            type="month"
            value={form.visitedAt ? form.visitedAt.slice(0, 7) : ""}
            onChange={(e) => set("visitedAt", e.target.value ? e.target.value + "-01" : "")}
            className="focusable mt-1 h-10 w-full rounded-lg border border-line px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium">
          닉네임 (선택)
          <input
            type="text"
            maxLength={20}
            value={form.nickname}
            onChange={(e) => set("nickname", e.target.value)}
            placeholder="익명"
            className="focusable mt-1 h-10 w-full rounded-lg border border-line px-2 text-sm"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={form.isEventPrice}
            onChange={(e) => set("isEventPrice", e.target.checked)}
            className="focusable h-4 w-4"
          />
          이벤트·프로모션 가격이었어요
        </label>
      </div>

      {msg && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
            msg.ok ? "bg-priced/10 text-priced" : "bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="focusable mt-3 h-11 w-full rounded-xl bg-tag text-sm font-bold text-tagInk shadow-chip disabled:opacity-60"
      >
        {busy ? "등록 중…" : "이 가격으로 제보하기"}
      </button>
    </form>
  );
}

/* ───────────────────── 코멘트 폼 ───────────────────── */
function CommentForm({ seed, onDone }: { seed: Seed; onDone: () => void }) {
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/places/${seed.kakaoPlaceId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, content, website, place: seed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록에 실패했습니다");
      setMsg({ ok: true, text: "코멘트가 등록되었습니다." });
      setContent("");
      onDone();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border-2 border-ink p-4">
      <p className="text-sm font-bold">코멘트 남기기</p>
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <input
        type="text"
        maxLength={20}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="닉네임 (선택, 기본 익명)"
        className="focusable mt-3 h-10 w-full rounded-lg border border-line px-3 text-sm"
      />
      <textarea
        required
        maxLength={500}
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="시설·혼잡도·환불 경험 등 자유롭게 (최대 500자)"
        className="focusable mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
      />
      <div className="mt-1 text-right text-[11px] text-muted">{content.length}/500</div>
      {msg && (
        <p
          role="status"
          className={`mt-1 rounded-lg px-3 py-2 text-xs font-medium ${
            msg.ok ? "bg-priced/10 text-priced" : "bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="focusable mt-2 h-11 w-full rounded-xl bg-ink text-sm font-bold text-paper disabled:opacity-60"
      >
        {busy ? "등록 중…" : "코멘트 등록"}
      </button>
    </form>
  );
}
