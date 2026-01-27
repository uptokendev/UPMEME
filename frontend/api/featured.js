import { pool } from "./_db.js";
import { badMethod, getQuery, json } from "./_http.js";

const SORT_MAP = {
  trending: "trending_score",
  "24h": "votes_24h",
  "7d": "votes_7d",
  all: "votes_all_time",
};

export default async function handler(req, res) {
  if (req.method !== "GET") return badMethod(res);

  try {
    const q = getQuery(req);
    const chainId = Number(q.chainId ?? 97);
    const sortKeyRaw = String(q.sort ?? "trending").toLowerCase();
    const sortCol = SORT_MAP[sortKeyRaw] ?? SORT_MAP.trending;
    const limit = Math.max(1, Math.min(50, Number(q.limit ?? 10)));

    if (!Number.isFinite(chainId)) return json(res, 400, { error: "Invalid chainId" });

    const { rows } = await pool.query(
      `SELECT
         chain_id AS "chainId",
         campaign_address AS "campaignAddress",
         votes_1h AS "votes1h",
         votes_24h AS "votes24h",
         votes_7d AS "votes7d",
         votes_all_time AS "votesAllTime",
         trending_score AS "trendingScore",
         last_vote_at AS "lastVoteAt"
       FROM vote_aggregates
       WHERE chain_id = $1
       ORDER BY ${sortCol} DESC NULLS LAST
       LIMIT $2`,
      [chainId, limit]
    );

    return json(res, 200, { items: rows });
  } catch (e) {
    console.error("[api/featured]", e);
    return json(res, 500, { error: "Server error" });
  }
}
