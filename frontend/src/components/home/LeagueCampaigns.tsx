import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLaunchpad, type CampaignInfo } from "@/lib/launchpadClient";

type LeagueRow = {
  chainId: number;
  campaignAddress: string;
  votes24h?: number;
  votes7d?: number;
  votesAllTime?: number;
  trendingScore?: string | number;
};

type LeagueCard = {
  row: LeagueRow;
  campaign: CampaignInfo;
  creatorProfile?: { displayName?: string | null; avatarUrl?: string | null } | null;
};

const isAddress = (s?: string) => /^0x[a-fA-F0-9]{40}$/.test(String(s ?? "").trim());
const shortAddr = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function LeagueCampaigns({ chainId = 97, limit = 5 }: { chainId?: number; limit?: number }) {
  const navigate = useNavigate();
  const { fetchCampaigns } = useLaunchpad();

  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<LeagueCard[]>([]);
  const [profilesByAddress, setProfilesByAddress] = useState<Record<string, any>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const r = await fetch(
          `/api/featured?chainId=${encodeURIComponent(String(chainId))}&sort=7d&limit=${encodeURIComponent(String(limit))}`
        );
        const j = await r.json();
        const items: LeagueRow[] = Array.isArray(j?.items) ? j.items : [];
        if (!cancelled) setRows(items);
      } catch (e) {
        console.error("[LeagueCampaigns] failed to load /api/featured", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [chainId, limit]);

  useEffect(() => {
    let cancelled = false;

    const build = async () => {
      if (!rows.length) {
        setCards([]);
        return;
      }

      try {
        const campaigns = await fetchCampaigns();
        const byCampaign = new Map<string, CampaignInfo>();
        for (const c of campaigns ?? []) {
          const addr = String((c as any).campaign ?? "").toLowerCase();
          if (isAddress(addr)) byCampaign.set(addr, c);
        }

        const out: LeagueCard[] = [];
        for (const row of rows) {
          const addr = String(row.campaignAddress ?? "").toLowerCase();
          const campaign = byCampaign.get(addr);
          if (!campaign) continue;
          out.push({ row, campaign, creatorProfile: null });
        }

        if (!cancelled) setCards(out);
      } catch (e) {
        console.error("[LeagueCampaigns] failed to build cards", e);
        if (!cancelled) setCards([]);
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
          cards
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
        console.error("[LeagueCampaigns] profile fetch failed", e);
      }
    };

    loadProfiles();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, chainId]);

  const hydrated = useMemo(() => {
    return cards.map((c) => {
      const creator = String((c.campaign as any).creator ?? "").toLowerCase();
      const profile = creator ? profilesByAddress[creator] ?? null : null;
      return { ...c, creatorProfile: profile };
    });
  }, [cards, profilesByAddress]);

  if (loading) {
    return (
      <div className="mt-4 md:mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm md:text-base font-semibold tracking-wide">UP Only League</h2>
          <span className="text-xs text-muted-foreground">Top {limit}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-28 md:h-32 rounded-[1.25rem] border border-border/40 bg-card" />
          ))}
        </div>
      </div>
    );
  }

  if (!hydrated.length) return null;

  return (
    <div className="mt-4 md:mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm md:text-base font-semibold tracking-wide">UP Only League</h2>
        <button
          type="button"
          onClick={() => navigate("/league")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {hydrated.slice(0, limit).map((card, idx) => {
          const campaignAddr = String((card.campaign as any).campaign ?? "").trim();
          const creatorAddr = String((card.campaign as any).creator ?? "").trim();
          const displayName =
            (card.creatorProfile?.displayName ? String(card.creatorProfile.displayName).trim() : "") ||
            (creatorAddr ? shortAddr(creatorAddr) : "—");
          const initial = displayName ? displayName.slice(0, 1).toUpperCase() : "C";
          const votes7d = Number(card.row.votes7d ?? 0);

          return (
            <button
              key={campaignAddr}
              type="button"
              onClick={() => navigate(`/token/${campaignAddr}`)}
              className="relative rounded-[1.25rem] border border-border/40 bg-card/70 p-3 md:p-4 text-left overflow-hidden hover:bg-card transition-colors"
            >
              <GlowingEffect
                blur={18}
                spread={40}
                glow={true}
                disabled={false}
                movementDuration={1.6}
                className="pointer-events-none"
              />

              <div className="absolute top-2 right-2 z-10 h-6 min-w-6 px-2 flex items-center justify-center rounded-full bg-card border-2" style={{ borderColor: "#affe00", color: "#affe00" }}>
                {idx + 1}
              </div>

              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={card.creatorProfile?.avatarUrl ?? undefined} />
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{card.campaign.symbol}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{displayName}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">Votes (7d)</div>
                <div className="text-sm font-semibold">{Number.isFinite(votes7d) ? votes7d : 0}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
