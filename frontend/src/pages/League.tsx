import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLaunchpad, type CampaignInfo } from "@/lib/launchpadClient";

const isAddress = (s?: string) => /^0x[a-fA-F0-9]{40}$/.test(String(s ?? "").trim());
const shortAddr = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

type SortKey = "trending" | "24h" | "7d" | "all";

type LeagueRow = {
  chainId: number;
  campaignAddress: string;
  votes24h?: number;
  votes7d?: number;
  votesAllTime?: number;
  trendingScore?: string | number;
  lastVoteAt?: string | null;
};

type LeagueItem = {
  row: LeagueRow;
  campaign: CampaignInfo;
  creatorProfile?: { displayName?: string | null; avatarUrl?: string | null } | null;
};

function pickMetric(row: LeagueRow, sort: SortKey): number {
  if (sort === "24h") return Number(row.votes24h ?? 0);
  if (sort === "7d") return Number(row.votes7d ?? 0);
  if (sort === "all") return Number(row.votesAllTime ?? 0);
  // trending
  const n = Number(row.trendingScore ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function League({ chainId = 97 }: { chainId?: number }) {
  const navigate = useNavigate();
  const { fetchCampaigns } = useLaunchpad();

  const [sort, setSort] = useState<SortKey>("7d");
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [items, setItems] = useState<LeagueItem[]>([]);
  const [profilesByAddress, setProfilesByAddress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const r = await fetch(
          `/api/featured?chainId=${encodeURIComponent(String(chainId))}&sort=${encodeURIComponent(sort)}&limit=50`
        );
        const j = await r.json();
        const next: LeagueRow[] = Array.isArray(j?.items) ? j.items : [];
        if (!cancelled) setRows(next);
      } catch (e) {
        console.error("[League] failed to load /api/featured", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [chainId, sort]);

  useEffect(() => {
    let cancelled = false;

    const build = async () => {
      if (!rows.length) {
        setItems([]);
        return;
      }

      try {
        const campaigns = await fetchCampaigns();
        const byCampaign = new Map<string, CampaignInfo>();
        for (const c of campaigns ?? []) {
          const addr = String((c as any).campaign ?? "").toLowerCase();
          if (isAddress(addr)) byCampaign.set(addr, c);
        }

        const out: LeagueItem[] = [];
        for (const row of rows) {
          const addr = String(row.campaignAddress ?? "").toLowerCase();
          const campaign = byCampaign.get(addr);
          if (!campaign) continue;
          out.push({ row, campaign, creatorProfile: null });
        }

        if (!cancelled) setItems(out);
      } catch (e) {
        console.error("[League] failed to build items", e);
        if (!cancelled) setItems([]);
      }
    };

    build();
    return () => {
      cancelled = true;
    };
  }, [rows, fetchCampaigns]);

  // Best-effort creator profile hydration
  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      const creators = Array.from(
        new Set(
          items
            .map((c) => String((c.campaign as any).creator ?? "").toLowerCase())
            .filter((a) => isAddress(a))
        )
      );

      const missing = creators.filter((a) => !profilesByAddress[a]);
      if (!missing.length) return;

      try {
        const results = await Promise.all(
          missing.map(async (addr) => {
            try {
              const r = await fetch(
                `/api/profile?chainId=${encodeURIComponent(String(chainId))}&address=${encodeURIComponent(addr)}`
              );
              const j = await r.json();
              return [addr, j?.profile ?? null] as const;
            } catch {
              return [addr, null] as const;
            }
          })
        );

        if (cancelled) return;
        setProfilesByAddress((prev) => {
          const next = { ...prev };
          for (const [addr, prof] of results) next[addr] = prof;
          return next;
        });
      } catch (e) {
        console.error("[League] profile fetch failed", e);
      }
    };

    loadProfiles();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, chainId]);

  const hydrated = useMemo(() => {
    return items
      .map((c) => {
        const creator = String((c.campaign as any).creator ?? "").toLowerCase();
        const profile = creator ? profilesByAddress[creator] ?? null : null;
        return { ...c, creatorProfile: profile };
      })
      .sort((a, b) => pickMetric(b.row, sort) - pickMetric(a.row, sort));
  }, [items, profilesByAddress, sort]);

  const sortLabel = (k: SortKey) => (k === "24h" ? "24h" : k === "7d" ? "7d" : k === "all" ? "All" : "Trending");

  return (
    <div className="h-full overflow-y-auto pr-2">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-lg md:text-2xl font-semibold">UP Only League</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Ranked by paid upvotes (aggregated off-chain). Choose a time window.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(["trending", "24h", "7d", "all"] as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              className={
                "px-3 py-2 rounded-xl border text-xs md:text-sm transition-colors " +
                (sort === k
                  ? "bg-card border-border text-foreground"
                  : "bg-transparent border-border/50 text-muted-foreground hover:text-foreground")
              }
            >
              {sortLabel(k)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-muted-foreground border-b border-border/50">
          <div className="col-span-1">#</div>
          <div className="col-span-6">Token</div>
          <div className="col-span-3 text-right">Score</div>
          <div className="col-span-2 text-right">Creator</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading league…</div>
        ) : hydrated.length ? (
          hydrated.map((it, idx) => {
            const campaignAddr = String((it.campaign as any).campaign ?? "").trim();
            const creatorAddr = String((it.campaign as any).creator ?? "").trim();
            const displayName =
              (it.creatorProfile?.displayName ? String(it.creatorProfile.displayName).trim() : "") ||
              (creatorAddr ? shortAddr(creatorAddr) : "—");
            const initial = displayName ? displayName.slice(0, 1).toUpperCase() : "C";
            const score = pickMetric(it.row, sort);

            return (
              <button
                key={campaignAddr}
                type="button"
                onClick={() => navigate(`/token/${campaignAddr}`)}
                className="grid grid-cols-12 gap-2 px-4 py-3 text-left hover:bg-card transition-colors"
              >
                <div className="col-span-1 text-sm font-semibold" style={{ color: "#affe00" }}>
                  {idx + 1}
                </div>

                <div className="col-span-6 flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={it.campaign.logoURI || undefined} />
                    <AvatarFallback>{it.campaign.symbol?.slice(0, 1)?.toUpperCase() || "T"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {it.campaign.name} <span className="text-muted-foreground">({it.campaign.symbol})</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{campaignAddr}</div>
                  </div>
                </div>

                <div className="col-span-3 text-right">
                  <div className="text-sm font-semibold">{Number.isFinite(score) ? score : 0}</div>
                  <div className="text-[11px] text-muted-foreground">{sortLabel(sort)}</div>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2 min-w-0">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={it.creatorProfile?.avatarUrl ?? undefined} />
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">{displayName}</div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No league data yet.</div>
        )}
      </div>
    </div>
  );
}
