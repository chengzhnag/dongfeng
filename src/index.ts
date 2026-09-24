import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { generateId, generateVerificationHash, hashPassword, verifyPassword } from "./lib/crypto";
import { weightedRandomPick } from "./lib/decision";
import { RateLimiter } from "./lib/rate-limit";

const SESSION_COOKIE = "dongfeng_session";

// Traditional Chinese avatar list
const AVATARS = [
  { id: "wind_1", name: "清风御剑", icon: "🍃" },
  { id: "wind_2", name: "流云听瀑", icon: "☁️" },
  { id: "wind_3", name: "墨竹摇风", icon: "🎋" },
  { id: "wind_4", name: "金铃寻声", icon: "🔔" },
  { id: "wind_5", name: "朱印断案", icon: "💮" },
  { id: "wind_6", name: "独钓寒江", icon: "🎣" },
  { id: "wind_7", name: "醉月临风", icon: "🌙" },
  { id: "wind_8", name: "松下客", icon: "🌲" }
];

export class App extends DurableObject {
  private app = new Hono();
  private initialized = false;
  private env: Record<string, unknown>;
  private rateLimiter = new RateLimiter();

  private initDatabase() {
    if (this.initialized) return;

    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        guest_id TEXT,
        guest_nickname TEXT,
        guest_avatar TEXT,
        title TEXT NOT NULL,
        winner_id TEXT NOT NULL,
        winner_text TEXT NOT NULL,
        options_json TEXT NOT NULL,
        mode TEXT DEFAULT 'roulette',
        is_public INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        tags_json TEXT,
        seed TEXT NOT NULL,
        verification_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS likes (
        decision_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (decision_id, actor_id)
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_decisions_public ON decisions(is_public, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_decisions_user ON decisions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_decisions_guest ON decisions(guest_id, created_at DESC);
    `);

    this.initialized = true;
  }

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    this.env = env;

    const isLimited = (c: any, action: string, max: number, windowMs: number) => {
      const client = c.req.header("cf-connecting-ip") || "unknown";
      return this.rateLimiter.isLimited(`${action}:${client}`, max, windowMs);
    };
    const sessionSecret = () => {
      const secret = this.env.JWT_SECRET;
      if (typeof secret !== "string" || secret.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters");
      return secret;
    };
    const getSessionUser = async (c: any) => {
      const token = getCookie(c, SESSION_COOKIE);
      if (!token) return null;
      try {
        const payload = await verify(token, sessionSecret(), "HS256");
        if (typeof payload.sub !== "string") return null;
        return this.ctx.storage.sql.exec(`SELECT id, username, email, avatar FROM users WHERE id = ?`, payload.sub).one() as any || null;
      } catch {
        return null;
      }
    };
    const requireAuth = async (c: any) => {
      const user = await getSessionUser(c);
      if (!user) return c.json({ ok: false, error: "请先登录" }, 401);
      c.set("user", user);
      return null;
    };
    const requireSameOrigin = (c: any) => {
      const origin = c.req.header("origin");
      if (origin && origin !== new URL(c.req.url).origin) {
        return c.json({ ok: false, error: "请求来源不受信任" }, 403);
      }
      return null;
    };
    const issueSession = async (c: any, userId: string) => {
      const token = await sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, sessionSecret());
      setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    };
    
    // Register Hono API endpoints
    this.app.use("*", async (c, next) => {
      const contentLength = Number(c.req.header("content-length") || 0);
      if (contentLength > 100 * 1024) return c.json({ ok: false, error: "请求体过大" }, 413);
      c.header("X-Content-Type-Options", "nosniff");
      c.header("X-Frame-Options", "DENY");
      c.header("Referrer-Policy", "strict-origin-when-cross-origin");
      c.header("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'");
      this.initDatabase();
      await next();
    });

    const getPublicOrigin = (c: any) => {
      const configuredOrigin = this.env.PUBLIC_ORIGIN;
      const origin = typeof configuredOrigin === "string" ? configuredOrigin : new URL(c.req.url).origin;
      return origin.replace(/\/+$/, "");
    };

    this.app.get("/robots.txt", (c) => {
      const sitemapUrl = `${getPublicOrigin(c)}/sitemap.xml`;
      return c.text(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /private\nSitemap: ${sitemapUrl}\n`, 200, {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "public, max-age=3600"
      });
    });

    this.app.get("/sitemap.xml", (c) => {
      const origin = getPublicOrigin(c);
      const urls = ["/", "/creator", "/public"]
        .map(path => `  <url><loc>${origin}${path}</loc></url>`)
        .join("\n");
      return c.text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 200, {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control": "public, max-age=3600"
      });
    });

    // Avatars list
    this.app.get("/api/avatars", (c) => {
      return c.json({ ok: true, avatars: AVATARS });
    });

    // Register User
    this.app.post("/api/auth/register", async (c) => {
      try {
        const originError = requireSameOrigin(c);
        if (originError) return originError;
        if (isLimited(c, "register", 5, 15 * 60 * 1000)) return c.json({ ok: false, error: "注册请求过于频繁，请稍后再试" }, 429);
        const { username, email, password, avatar } = await c.req.json<{
          username?: string;
          email?: string;
          password?: string;
          avatar?: string;
        }>();

        if (!username || !email || !password || typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
          return c.json({ ok: false, error: "请填写完整的注册信息" }, 400);
        }
        if (username.length > 32 || email.length > 254 || password.length < 10 || password.length > 128) {
          return c.json({ ok: false, error: "注册信息格式不正确" }, 400);
        }

        const existing = this.ctx.storage.sql.exec(
          `SELECT id FROM users WHERE username = ? OR email = ?`,
          username, email
        ).toArray();

        if (existing.length > 0) {
          return c.json({ ok: false, error: "用户名或邮箱已被使用" }, 400);
        }

        const userId = generateId("usr");
        const now = Date.now();
        const passwordHash = await hashPassword(password);
        const chosenAvatar = avatar || AVATARS[0].icon;

        this.ctx.storage.sql.exec(
          `INSERT INTO users (id, username, email, password_hash, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          userId, username, email, passwordHash, chosenAvatar, now
        );

        await issueSession(c, userId);

        return c.json({
          ok: true,
          user: { id: userId, username, email, avatar: chosenAvatar }
        });
      } catch (err: any) {
        return c.json({ ok: false, error: err.message || "注册失败" }, 500);
      }
    });

    // Login User
    this.app.post("/api/auth/login", async (c) => {
      try {
        const originError = requireSameOrigin(c);
        if (originError) return originError;
        if (isLimited(c, "login", 10, 15 * 60 * 1000)) return c.json({ ok: false, error: "登录尝试过于频繁，请稍后再试" }, 429);
        const { username, password } = await c.req.json<{ username?: string; password?: string }>();
        if (typeof username !== "string" || typeof password !== "string" || !username || !password || password.length > 128) {
          return c.json({ ok: false, error: "请输入用户名和密码" }, 400);
        }

        const rows = this.ctx.storage.sql.exec(
          `SELECT id, username, email, password_hash, avatar FROM users WHERE username = ? OR email = ?`,
          username, username
        ).toArray();

        if (rows.length === 0) return c.json({ ok: false, error: "用户名或密码不正确" }, 401);

        const user = rows[0] as any;
        if (!(await verifyPassword(password, user.password_hash))) return c.json({ ok: false, error: "用户名或密码不正确" }, 401);

        await issueSession(c, user.id);

        return c.json({
          ok: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar
          }
        });
      } catch (err: any) {
        return c.json({ ok: false, error: err.message || "登录失败" }, 500);
      }
    });

    this.app.post("/api/auth/logout", (c) => {
      const originError = requireSameOrigin(c);
      if (originError) return originError;
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      return c.json({ ok: true });
    });

    this.app.get("/api/auth/me", async (c) => {
      return c.json({ ok: true, user: await getSessionUser(c) });
    });

    // Create Decision and Roll (CSPRNG)
    this.app.post("/api/decisions/create", async (c) => {
      try {
        const originError = requireSameOrigin(c);
        if (originError) return originError;
        const client = c.req.header("cf-connecting-ip") || "unknown";
        if (isLimited(c, "create", 20, 60 * 60 * 1000)) {
          return c.json({ ok: false, error: "创建请求过于频繁，请稍后再试" }, 429);
        }
        const body = await c.req.json<{
          title: string;
          options: Array<{ id: string; text: string; weight: number }>;
          mode?: string;
          is_public?: boolean;
          tags?: string[];
          guest_nickname?: string;
          guest_avatar?: string;
        }>();

        if (!body || typeof body !== "object" || typeof body.title !== "string" || !Array.isArray(body.options) || body.options.length < 2 || body.options.length > 12) {
          return c.json({ ok: false, error: "决定内容格式不正确" }, 400);
        }
        if (body.is_public !== undefined && typeof body.is_public !== "boolean") {
          return c.json({ ok: false, error: "公开状态格式不正确" }, 400);
        }
        if (body.mode !== undefined && !["roulette", "tally", "bagua"].includes(body.mode)) {
          return c.json({ ok: false, error: "决定模式不正确" }, 400);
        }
        const optionIds = new Set<string>();
        for (const option of body.options) {
          if (!option || typeof option !== "object" || typeof option.text !== "string" || option.text.length > 100) {
            return c.json({ ok: false, error: "选项格式不正确" }, 400);
          }
          if (option.id !== undefined && (typeof option.id !== "string" || option.id.length > 64)) {
            return c.json({ ok: false, error: "选项标识格式不正确" }, 400);
          }
          if (option.id && optionIds.has(option.id)) {
            return c.json({ ok: false, error: "选项标识不能重复" }, 400);
          }
          if (option.id) optionIds.add(option.id);
          if (option.weight !== undefined && (typeof option.weight !== "number" || !Number.isFinite(option.weight))) {
            return c.json({ ok: false, error: "选项权重格式不正确" }, 400);
          }
        }
        if (body.title.length > 100 || (body.tags && (!Array.isArray(body.tags) || body.tags.length > 10))) {
          return c.json({ ok: false, error: "决定内容超出限制" }, 400);
        }
        if (body.tags?.some(tag => typeof tag !== "string" || tag.length > 30)) {
          return c.json({ ok: false, error: "标签格式不正确" }, 400);
        }
        if (body.guest_nickname !== undefined && (typeof body.guest_nickname !== "string" || body.guest_nickname.length > 32)) {
          return c.json({ ok: false, error: "昵称格式不正确" }, 400);
        }
        if (body.guest_avatar !== undefined && (typeof body.guest_avatar !== "string" || !AVATARS.some(avatar => avatar.icon === body.guest_avatar))) {
          return c.json({ ok: false, error: "头像格式不正确" }, 400);
        }

        if (!body.title || !body.title.trim()) {
          return c.json({ ok: false, error: "请输入决定标题" }, 400);
        }

        if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 12) {
          return c.json({ ok: false, error: "请提供 2 至 12 个有效选项" }, 400);
        }

        // Sanitize options and limits
        const sanitizedTitle = body.title.trim().slice(0, 20);
        const sanitizedOptions = body.options.map((opt, idx) => ({
          id: opt.id || `opt_${idx + 1}`,
          text: (opt.text.trim() || `选项 ${idx + 1}`).slice(0, 20),
          weight: Math.max(1, Math.min(10, Number(opt.weight) || 1))
        }));

        // CSPRNG selection
        const winner = weightedRandomPick(sanitizedOptions);
        const seed = generateId("seed");
        const optionsJson = JSON.stringify(sanitizedOptions);
        const tagsJson = JSON.stringify(body.tags || []);
        const verificationHash = await generateVerificationHash(seed, sanitizedTitle, winner.id, optionsJson);
        const decisionId = generateId("dec");
        const now = Date.now();

        const user = await getSessionUser(c);
        const actorKey = user?.id || client;
        if (this.rateLimiter.isLimited(`create-user:${actorKey}`, 50, 24 * 60 * 60 * 1000)) {
          return c.json({ ok: false, error: "今日创建数量已达上限" }, 429);
        }
        if (!user && !body.is_public) return c.json({ ok: false, error: "登录后才能创建私人决定" }, 401);

        this.ctx.storage.sql.exec(`
          INSERT INTO decisions (
            id, user_id, guest_id, guest_nickname, guest_avatar, title, winner_id, winner_text,
            options_json, mode, is_public, likes_count, views_count, tags_json, seed,
            verification_hash, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)
        `,
          decisionId,
          user?.id || null,
          user ? null : generateId("guest"),
          body.guest_nickname || "听风客",
          body.guest_avatar || "🍃",
          sanitizedTitle,
          winner.id,
          winner.text,
          optionsJson,
          body.mode || "roulette",
          body.is_public ? 1 : 0,
          tagsJson,
          seed,
          verificationHash,
          now
        );

        return c.json({
          ok: true,
          decision: {
            id: decisionId,
            title: sanitizedTitle,
            winner: winner,
            options: sanitizedOptions,
            mode: body.mode || "roulette",
            is_public: !!body.is_public,
            tags: body.tags || [],
            seed,
            verification_hash: verificationHash,
            created_at: now,
            guest_nickname: body.guest_nickname || "听风客",
            guest_avatar: body.guest_avatar || "🍃"
          }
        });
      } catch (err: any) {
        return c.json({ ok: false, error: err.message || "创建决定失败" }, 500);
      }
    });

    // Public Pool API
    this.app.get("/api/decisions/public", (c) => {
      const requestedPage = Number(c.req.query("page") || "1");
      const page = Number.isInteger(requestedPage) ? Math.min(1000, Math.max(1, requestedPage)) : 1;
      const limit = Math.min(30, Math.max(1, parseInt(c.req.query("limit") || "12")));
      const sort = c.req.query("sort") === "popular" ? "likes_count DESC, created_at DESC" : "created_at DESC";
      const tag = (c.req.query("tag") || "").slice(0, 30);

      const offset = (page - 1) * limit;

      let sql = `SELECT * FROM decisions WHERE is_public = 1`;
      let params: any[] = [];

      if (tag) {
        sql += ` AND tags_json LIKE ?`;
        params.push(`%${tag}%`);
      }

      sql += ` ORDER BY ${sort} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = this.ctx.storage.sql.exec(sql, ...params).toArray();

      let countSql = `SELECT COUNT(*) as total FROM decisions WHERE is_public = 1`;
      let countParams: any[] = [];
      if (tag) {
        countSql += ` AND tags_json LIKE ?`;
        countParams.push(`%${tag}%`);
      }
      const total = (this.ctx.storage.sql.exec(countSql, ...countParams).one()?.total as number) || 0;

      const items = rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        winner_id: r.winner_id,
        winner_text: r.winner_text,
        options: JSON.parse(r.options_json || "[]"),
        mode: r.mode,
        tags: JSON.parse(r.tags_json || "[]"),
        is_public: r.is_public === 1,
        likes_count: r.likes_count,
        views_count: r.views_count,
        created_at: r.created_at,
        guest_nickname: r.guest_nickname,
        guest_avatar: r.guest_avatar
      }));

      return c.json({
        ok: true,
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    });

    // Private Pool / My Decisions API
    this.app.get("/api/decisions/mine", async (c) => {
      const authError = await requireAuth(c);
      if (authError) return authError;
      const userId = ((c as any).get("user") as any).id;
      const requestedPage = Number(c.req.query("page") || "1");
      const page = Number.isInteger(requestedPage) ? Math.min(1000, Math.max(1, requestedPage)) : 1;
      const limit = Math.min(30, Math.max(1, parseInt(c.req.query("limit") || "12")));
      const offset = (page - 1) * limit;

      let rows: any[] = [];
      let total = 0;

      rows = this.ctx.storage.sql.exec(`SELECT * FROM decisions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, userId, limit, offset).toArray();
      total = (this.ctx.storage.sql.exec(`SELECT COUNT(*) as total FROM decisions WHERE user_id = ?`, userId).one()?.total as number) || 0;

      const items = rows.map((r: any) => ({
        ...r,
        options: JSON.parse(r.options_json || "[]"),
        tags: JSON.parse(r.tags_json || "[]"),
        is_public: r.is_public === 1
      }));

      return c.json({
        ok: true,
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    });

    // Toggle Public Status
    this.app.post("/api/decisions/:id/toggle-public", async (c) => {
      const originError = requireSameOrigin(c);
      if (originError) return originError;
      const id = c.req.param("id");
      const authError = await requireAuth(c);
      if (authError) return authError;
      const row = this.ctx.storage.sql.exec(`SELECT is_public FROM decisions WHERE id = ? AND user_id = ?`, id, ((c as any).get("user") as any).id).toArray();
      if (row.length === 0) {
        return c.json({ ok: false, error: "未找到该决定或无权操作" }, 404);
      }

      const current = row[0].is_public as number;
      const nextStatus = current === 1 ? 0 : 1;

      this.ctx.storage.sql.exec(`UPDATE decisions SET is_public = ? WHERE id = ?`, nextStatus, id);
      return c.json({ ok: true, is_public: nextStatus === 1 });
    });

    // Delete Decision
    this.app.delete("/api/decisions/:id", async (c) => {
      const originError = requireSameOrigin(c);
      if (originError) return originError;
      const id = c.req.param("id");
      const authError = await requireAuth(c);
      if (authError) return authError;
      const owned = this.ctx.storage.sql.exec(`SELECT id FROM decisions WHERE id = ? AND user_id = ?`, id, ((c as any).get("user") as any).id).toArray();
      if (owned.length === 0) return c.json({ ok: false, error: "无权删除该决定" }, 403);
      this.ctx.storage.sql.exec(`DELETE FROM decisions WHERE id = ? AND user_id = ?`, id, ((c as any).get("user") as any).id);
      this.ctx.storage.sql.exec(`DELETE FROM likes WHERE decision_id = ?`, id);
      return c.json({ ok: true });
    });

    // Like Decision
    this.app.post("/api/decisions/:id/like", async (c) => {
      const originError = requireSameOrigin(c);
      if (originError) return originError;
      if (isLimited(c, "like", 60, 60 * 1000)) return c.json({ ok: false, error: "点赞请求过于频繁，请稍后再试" }, 429);
      const id = c.req.param("id");
      const user = await getSessionUser(c);
      const actorId = user?.id || `ip:${c.req.header("cf-connecting-ip") || "unknown"}`;

      const decision = this.ctx.storage.sql.exec(`SELECT id FROM decisions WHERE id = ? AND is_public = 1`, id).one();
      if (!decision) return c.json({ ok: false, error: "未找到公开决定" }, 404);

      const existing = this.ctx.storage.sql.exec(
        `SELECT created_at FROM likes WHERE decision_id = ? AND actor_id = ?`,
        id, actorId
      ).toArray();

      if (existing.length > 0) {
        // Unlike
        this.ctx.storage.sql.exec(`DELETE FROM likes WHERE decision_id = ? AND actor_id = ?`, id, actorId);
        this.ctx.storage.sql.exec(`UPDATE decisions SET likes_count = MAX(0, likes_count - 1) WHERE id = ?`, id);
        const updated = this.ctx.storage.sql.exec(`SELECT likes_count FROM decisions WHERE id = ?`, id).one();
        return c.json({ ok: true, liked: false, likes_count: updated?.likes_count || 0 });
      } else {
        // Like
        this.ctx.storage.sql.exec(`INSERT INTO likes (decision_id, actor_id, created_at) VALUES (?, ?, ?)`, id, actorId, Date.now());
        this.ctx.storage.sql.exec(`UPDATE decisions SET likes_count = likes_count + 1 WHERE id = ?`, id);
        const updated = this.ctx.storage.sql.exec(`SELECT likes_count FROM decisions WHERE id = ?`, id).one();
        return c.json({ ok: true, liked: true, likes_count: updated?.likes_count || 0 });
      }
    });

    // Verification Endpoint
    this.app.get("/api/decisions/:id/verify", async (c) => {
      const id = c.req.param("id");
      const row = this.ctx.storage.sql.exec(`SELECT * FROM decisions WHERE id = ?`, id).toArray();
      if (row.length === 0) {
        return c.json({ ok: false, error: "未找到该决定" }, 404);
      }

      const dec = row[0] as any;
      if (dec.is_public !== 1) {
        const user = await getSessionUser(c);
        if (!user || user.id !== dec.user_id) return c.json({ ok: false, error: "无权验真该私密决定" }, 403);
      }
      const expectedHash = await generateVerificationHash(dec.seed, dec.title, dec.winner_id, dec.options_json);
      const isAuthentic = expectedHash === dec.verification_hash;

      return c.json({
        ok: true,
        is_authentic: isAuthentic,
        details: {
          id: dec.id,
          title: dec.title,
          winner_id: dec.winner_id,
          winner_text: dec.winner_text,
          seed: dec.seed,
          stored_hash: dec.verification_hash,
          computed_hash: expectedHash,
          created_at: dec.created_at
        }
      });
    });
  }

  async fetch(request: Request) {
    return this.app.fetch(request);
  }
}

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    const seoPaths = ["/robots.txt", "/sitemap.xml"];

    if (url.pathname.startsWith("/api/") || seoPaths.includes(normalizedPath)) {
      const namespace = env.APP;
      if (namespace && typeof namespace.get === "function") {
        const id = namespace.idFromName("default");
        const stub = namespace.get(id);
        if (stub && typeof stub.fetch === "function") {
          const appInstance = stub as any;
          appInstance.env = env;
          const appRequest = normalizedPath === url.pathname
            ? request
            : new Request(new URL(`${normalizedPath}${url.search}`, url), request);
          return appInstance.fetch(appRequest);
        }
      }

      return new Response(JSON.stringify({ ok: false, error: "Durable Object binding missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set("Content-Security-Policy", "default-src 'self' https://esm.sh https://unpkg.com https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://esm.sh https://unpkg.com https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'");
      if (url.protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return new Response("Not Found", { status: 404 });
  }
};
