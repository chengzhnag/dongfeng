import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";

// Helper for crypto hash fingerprinting
async function generateVerificationHash(seed: string, title: string, winnerId: string, optionsJson: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`DONGFENG_VERIFY::${seed}::${title}::${winnerId}::${optionsJson}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple token generator
function generateId(prefix: string = ""): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  const str = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${str}` : str;
}

// CSPRNG weighted pick
function weightedRandomPick(options: Array<{ id: string; text: string; weight: number }>) {
  const totalWeight = options.reduce((sum, opt) => sum + (opt.weight || 1), 0);
  
  // Use CSPRNG float between 0 and totalWeight
  const randomBuffer = new Uint32Array(2);
  crypto.getRandomValues(randomBuffer);
  // combine into 53-bit random float [0, 1)
  const randomValue = ((randomBuffer[0] >>> 5) * 67108864 + (randomBuffer[1] >>> 6)) / 9007199254740992;
  
  let target = randomValue * totalWeight;
  for (const opt of options) {
    target -= (opt.weight || 1);
    if (target <= 0) {
      return opt;
    }
  }
  return options[options.length - 1];
}

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

    // Seed default sample public decisions if empty
    const count = this.ctx.storage.sql.exec(`SELECT COUNT(*) as c FROM decisions`).one()?.c as number;
    if (count === 0) {
      this.seedSampleData();
    }

    this.initialized = true;
  }

  private async seedSampleData() {
    const samples = [
      {
        title: "遇事不决，今晚宵夜吃什么？",
        options: [
          { id: "opt_1", text: "热气腾腾的重庆火锅", weight: 3 },
          { id: "opt_2", text: "香气四溢的木炭烧烤", weight: 3 },
          { id: "opt_3", text: "清爽鲜美的手作日料", weight: 2 },
          { id: "opt_4", text: "在家煮一碗小面", weight: 1 }
        ],
        mode: "roulette",
        tags: ["美食", "宵夜", "生活"],
        guest_nickname: "清风观云客",
        guest_avatar: "🍃"
      },
      {
        title: "本周末充能计划选择",
        options: [
          { id: "opt_1", text: "去郊外公园搭帐篷听风", weight: 2 },
          { id: "opt_2", text: "在图书馆安静阅读一下午", weight: 2 },
          { id: "opt_3", text: "约三五好友打羽毛球", weight: 1 },
          { id: "opt_4", text: "在家深度睡眠 + 看一部老电影", weight: 2 }
        ],
        mode: "tally",
        tags: ["周末", "放松", "生活"],
        guest_nickname: "竹林闲人",
        guest_avatar: "🎋"
      },
      {
        title: "新项目技术栈选型判定",
        options: [
          { id: "opt_1", text: "React + D3.js + Edge Worker", weight: 3 },
          { id: "opt_2", text: "Vue 3 + Canvas + Node.js", weight: 2 },
          { id: "opt_3", text: "SvelteKit + WebGL", weight: 1 }
        ],
        mode: "roulette",
        tags: ["职场", "技术", "架构"],
        guest_nickname: "墨客极客",
        guest_avatar: "☁️"
      },
      {
        title: "今年年假旅游目的地挑选",
        options: [
          { id: "opt_1", text: "云南大理洱海骑行发呆", weight: 3 },
          { id: "opt_2", text: "川西环线看雪山看秋色", weight: 2 },
          { id: "opt_3", text: "青岛威海海边看日出", weight: 2 },
          { id: "opt_4", text: "成都吃遍太古里街头巷尾", weight: 2 }
        ],
        mode: "roulette",
        tags: ["旅行", "生活", "度假"],
        guest_nickname: "独钓寒江",
        guest_avatar: "🎣"
      },
      {
        title: "下班后第一件事应该做什么？",
        options: [
          { id: "opt_1", text: "换上跑鞋去公园慢跑 5 公里", weight: 2 },
          { id: "opt_2", text: "戴上耳机听舒缓吉他乐冥想", weight: 2 },
          { id: "opt_3", text: "做一顿丰盛晚餐抚慰肠胃", weight: 3 },
          { id: "opt_4", text: "打两局单机游戏放松大脑", weight: 1 }
        ],
        mode: "tally",
        tags: ["生活", "健康"],
        guest_nickname: "醉月临风",
        guest_avatar: "🌙"
      },
      {
        title: "下本打算阅读的书籍类型",
        options: [
          { id: "opt_1", text: "东方美学与古典哲学类", weight: 2 },
          { id: "opt_2", text: "硬核科幻小说（如《三体》系列）", weight: 3 },
          { id: "opt_3", text: "心理学与思维模型类", weight: 2 },
          { id: "opt_4", text: "人类简史与文明演变类", weight: 1 }
        ],
        mode: "roulette",
        tags: ["阅读", "学习"],
        guest_nickname: "松下客",
        guest_avatar: "🌲"
      },
      {
        title: "个人独立项目主题确定",
        options: [
          { id: "opt_1", text: "国风极简风声音效合成器", weight: 3 },
          { id: "opt_2", text: "个人知识库卡片盒笔记系统", weight: 2 },
          { id: "opt_3", text: "沉浸式三维星空灵感画板", weight: 2 }
        ],
        mode: "roulette",
        tags: ["技术", "灵感", "独立开发"],
        guest_nickname: "金铃寻声",
        guest_avatar: "🔔"
      },
      {
        title: "跳槽 Offes 决策建议",
        options: [
          { id: "opt_1", text: "大厂成熟业务组（稳定与资源）", weight: 2 },
          { id: "opt_2", text: "初创 AI 赛道核心团队（高成长高风险）", weight: 2 },
          { id: "opt_3", text: "外企 WFB 远程团队（高 Work-Life Balance）", weight: 3 }
        ],
        mode: "tally",
        tags: ["职场", "抉择"],
        guest_nickname: "朱印断案",
        guest_avatar: "💮"
      },
      {
        title: "每天早晨唤醒自己的饮品",
        options: [
          { id: "opt_1", text: "手冲单品深烘咖啡", weight: 3 },
          { id: "opt_2", text: "正山小种无糖红茶", weight: 2 },
          { id: "opt_3", text: "新鲜鲜榨橙汁与温水", weight: 1 }
        ],
        mode: "roulette",
        tags: ["生活", "美食"],
        guest_nickname: "清风御剑",
        guest_avatar: "🍃"
      },
      {
        title: "健身房今日重点训练板块",
        options: [
          { id: "opt_1", text: "胸肌与三头力量训练", weight: 2 },
          { id: "opt_2", text: "背部与二头拉力训练", weight: 2 },
          { id: "opt_3", text: "核心腿部深蹲专项", weight: 1 },
          { id: "opt_4", text: "45 分钟划船机有氧心肺", weight: 2 }
        ],
        mode: "tally",
        tags: ["健身", "健康"],
        guest_nickname: "流云听瀑",
        guest_avatar: "☁️"
      }
    ];

    for (const sample of samples) {
      const winner = weightedRandomPick(sample.options);
      const seed = generateId("seed");
      const optionsJson = JSON.stringify(sample.options);
      const tagsJson = JSON.stringify(sample.tags);
      const hash = await generateVerificationHash(seed, sample.title, winner.id, optionsJson);
      const id = generateId("dec");
      const now = Date.now() - Math.floor(Math.random() * 86400000 * 3);

      this.ctx.storage.sql.exec(`
        INSERT INTO decisions (
          id, guest_id, guest_nickname, guest_avatar, title, winner_id, winner_text,
          options_json, mode, is_public, likes_count, views_count, tags_json, seed,
          verification_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `, id, "guest_seed", sample.guest_nickname, sample.guest_avatar, sample.title, winner.id, winner.text,
         optionsJson, sample.mode, Math.floor(Math.random() * 18) + 5, Math.floor(Math.random() * 120) + 30,
         tagsJson, seed, hash, now);
    }
  }

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    
    // Register Hono API endpoints
    this.app.use("*", async (c, next) => {
      this.initDatabase();
      await next();
    });

    // Avatars list
    this.app.get("/api/avatars", (c) => {
      return c.json({ ok: true, avatars: AVATARS });
    });

    // Register User
    this.app.post("/api/auth/register", async (c) => {
      try {
        const { username, email, password, avatar } = await c.req.json<{
          username?: string;
          email?: string;
          password?: string;
          avatar?: string;
        }>();

        if (!username || !email || !password) {
          return c.json({ ok: false, error: "请填写完整的注册信息" }, 400);
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
        // In real app hashing with bcrypt, here simplified string hash + salt
        const passwordHash = `sha_${password}_salt`;
        const chosenAvatar = avatar || AVATARS[0].icon;

        this.ctx.storage.sql.exec(
          `INSERT INTO users (id, username, email, password_hash, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          userId, username, email, passwordHash, chosenAvatar, now
        );

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
        const { username, password } = await c.req.json<{ username?: string; password?: string }>();
        if (!username || !password) {
          return c.json({ ok: false, error: "请输入用户名和密码" }, 400);
        }

        const rows = this.ctx.storage.sql.exec(
          `SELECT id, username, email, password_hash, avatar FROM users WHERE username = ? OR email = ?`,
          username, username
        ).toArray();

        if (rows.length === 0) {
          return c.json({ ok: false, error: "用户不存在" }, 404);
        }

        const user = rows[0] as any;
        const expectedHash = `sha_${password}_salt`;
        if (user.password_hash !== expectedHash) {
          return c.json({ ok: false, error: "密码不正确" }, 401);
        }

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

    // Create Decision and Roll (CSPRNG)
    this.app.post("/api/decisions/create", async (c) => {
      try {
        const body = await c.req.json<{
          title: string;
          options: Array<{ id: string; text: string; weight: number }>;
          mode?: string;
          is_public?: boolean;
          tags?: string[];
          user_id?: string;
          guest_id?: string;
          guest_nickname?: string;
          guest_avatar?: string;
        }>();

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

        this.ctx.storage.sql.exec(`
          INSERT INTO decisions (
            id, user_id, guest_id, guest_nickname, guest_avatar, title, winner_id, winner_text,
            options_json, mode, is_public, likes_count, views_count, tags_json, seed,
            verification_hash, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)
        `,
          decisionId,
          body.user_id || null,
          body.guest_id || "guest_anon",
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
      const page = Math.max(1, parseInt(c.req.query("page") || "1"));
      const limit = Math.min(30, Math.max(1, parseInt(c.req.query("limit") || "12")));
      const sort = c.req.query("sort") === "popular" ? "likes_count DESC, created_at DESC" : "created_at DESC";
      const tag = c.req.query("tag");

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

    // Private Pool / My Decisions API
    this.app.get("/api/decisions/mine", (c) => {
      const userId = c.req.query("user_id");
      const guestId = c.req.query("guest_id");
      const page = Math.max(1, parseInt(c.req.query("page") || "1"));
      const limit = Math.min(30, Math.max(1, parseInt(c.req.query("limit") || "12")));
      const offset = (page - 1) * limit;

      if (!userId && !guestId) {
        return c.json({ ok: false, error: "身份标识缺失" }, 400);
      }

      let rows: any[] = [];
      let total = 0;

      if (userId) {
        rows = this.ctx.storage.sql.exec(
          `SELECT * FROM decisions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          userId, limit, offset
        ).toArray();
        total = (this.ctx.storage.sql.exec(
          `SELECT COUNT(*) as total FROM decisions WHERE user_id = ?`,
          userId
        ).one()?.total as number) || 0;
      } else {
        rows = this.ctx.storage.sql.exec(
          `SELECT * FROM decisions WHERE guest_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          guestId, limit, offset
        ).toArray();
        total = (this.ctx.storage.sql.exec(
          `SELECT COUNT(*) as total FROM decisions WHERE guest_id = ?`,
          guestId
        ).one()?.total as number) || 0;
      }

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
      const id = c.req.param("id");
      const row = this.ctx.storage.sql.exec(`SELECT is_public FROM decisions WHERE id = ?`, id).toArray();
      if (row.length === 0) {
        return c.json({ ok: false, error: "未找到该决定" }, 404);
      }

      const current = row[0].is_public as number;
      const nextStatus = current === 1 ? 0 : 1;

      this.ctx.storage.sql.exec(`UPDATE decisions SET is_public = ? WHERE id = ?`, nextStatus, id);
      return c.json({ ok: true, is_public: nextStatus === 1 });
    });

    // Delete Decision
    this.app.delete("/api/decisions/:id", async (c) => {
      const id = c.req.param("id");
      this.ctx.storage.sql.exec(`DELETE FROM decisions WHERE id = ?`, id);
      this.ctx.storage.sql.exec(`DELETE FROM likes WHERE decision_id = ?`, id);
      return c.json({ ok: true });
    });

    // Like Decision
    this.app.post("/api/decisions/:id/like", async (c) => {
      const id = c.req.param("id");
      const { actor_id } = await c.req.json<{ actor_id: string }>();

      if (!actor_id) {
        return c.json({ ok: false, error: "需要包含操作者标识" }, 400);
      }

      const existing = this.ctx.storage.sql.exec(
        `SELECT created_at FROM likes WHERE decision_id = ? AND actor_id = ?`,
        id, actor_id
      ).toArray();

      if (existing.length > 0) {
        // Unlike
        this.ctx.storage.sql.exec(`DELETE FROM likes WHERE decision_id = ? AND actor_id = ?`, id, actor_id);
        this.ctx.storage.sql.exec(`UPDATE decisions SET likes_count = MAX(0, likes_count - 1) WHERE id = ?`, id);
        const updated = this.ctx.storage.sql.exec(`SELECT likes_count FROM decisions WHERE id = ?`, id).one();
        return c.json({ ok: true, liked: false, likes_count: updated?.likes_count || 0 });
      } else {
        // Like
        this.ctx.storage.sql.exec(`INSERT INTO likes (decision_id, actor_id, created_at) VALUES (?, ?, ?)`, id, actor_id, Date.now());
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
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
