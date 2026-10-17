import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createApp } from "../server/app.mjs";
import { maintenance, migrateCommunity } from "../server/db.mjs";
import { createVault } from "../server/security.mjs";
import { createTestDatabase } from "./mysql-fixture.mjs";

test("Post views persist and count explicit openings atomically", async (t) => {
  process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const fixture = await createTestDatabase();
  const db = fixture.db,
    origin = "http://post-views.test";
  const runtime = await createApp({
    db,
    vault: createVault(),
    origin,
    testing: true,
  });
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await runtime.close();
    await fixture.cleanup();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  const request = async (path, method = "GET", body, headers = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { origin, "content-type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json(), response };
  };
  const registration = await request("/auth/register", "POST", {
    name: "浏览测试作者",
    email: "views@example.com",
    password: "PostViewsTest123!",
    consent: true,
  });
  assert.equal(registration.status, 201);
  const author = {
    cookie: registration.response.headers.getSetCookie()[0].split(";")[0],
    "x-csrf-token": registration.data.csrf,
  };
  const post = await request(
    "/posts",
    "POST",
    {
      title: "浏览次数测试",
      body: "用于验证社区帖子的真实浏览次数。",
      category: "交流问答",
    },
    author,
  );
  assert.equal(post.status, 201);
  const postId = post.data.id,
    path = "/posts/" + postId;
  const count = async () => (await request(path)).data.view_count;
  const view = (eventId = randomUUID(), headers = {}) =>
    request(path + "/views", "POST", { eventId }, headers);

  await t.test(
    "Feeds, details, comments and likes do not increment views",
    async () => {
      for (let i = 0; i < 3; i++) {
        assert.equal(
          (await request("/posts")).data.posts.find(
            (post) => post.id === postId,
          ).view_count,
          0,
        );
        assert.equal((await request(path + "?page=2")).data.view_count, 0);
      }
      assert.equal(
        (await request(path + "/like", "POST", {}, author)).status,
        200,
      );
      assert.equal(
        (
          await request(
            path + "/comments",
            "POST",
            { body: "一条测试回复" },
            author,
          )
        ).status,
        201,
      );
      assert.equal(await count(), 0);
    },
  );

  const firstEvent = randomUUID();
  await t.test(
    "Guests and signed-in readers count; one opening ID is idempotent",
    async () => {
      assert.deepEqual((await view(firstEvent)).data, {
        view_count: 1,
        counted: true,
      });
      assert.deepEqual((await view(firstEvent)).data, {
        view_count: 1,
        counted: false,
      });
      assert.deepEqual((await view(randomUUID(), author)).data, {
        view_count: 2,
        counted: true,
      });
      assert.deepEqual((await view()).data, { view_count: 3, counted: true });
      assert.equal(await count(), 3);
      assert.equal(
        (await request("/posts")).data.posts.find((post) => post.id === postId)
          .view_count,
        3,
      );
    },
  );

  await t.test(
    "Concurrent retries count once and concurrent openings lose no increments",
    async () => {
      const eventId = randomUUID();
      const retries = await Promise.all(
        Array.from({ length: 8 }, () => view(eventId)),
      );
      assert.ok(retries.every((result) => result.status === 200));
      assert.equal(retries.filter((result) => result.data.counted).length, 1);
      const openings = await Promise.all(
        Array.from({ length: 12 }, () => view()),
      );
      assert.ok(
        openings.every(
          (result) => result.status === 200 && result.data.counted,
        ),
      );
      assert.equal(await count(), 16);
    },
  );

  await t.test(
    "Malformed, cross-origin, invalid CSRF and hidden/missing requests do not count",
    async () => {
      for (const body of [{}, { eventId: "invalid" }])
        assert.equal(
          (await request(path + "/views", "POST", body)).status,
          400,
        );
      assert.equal(
        (
          await request(path + "/views", "POST", {
            eventId: firstEvent,
            view_count: 9000,
          })
        ).data.view_count,
        16,
      );
      assert.equal(
        (await view(randomUUID(), { origin: "http://other.test" })).status,
        403,
      );
      assert.equal(
        (await view(randomUUID(), { ...author, "x-csrf-token": "wrong" }))
          .status,
        403,
      );
      await db.prepare("UPDATE posts SET hidden=1 WHERE id=?").run(postId);
      assert.equal((await view()).status, 404);
      assert.equal((await request(path)).status, 404);
      assert.ok(
        !(await request("/posts")).data.posts.some(
          (post) => post.id === postId,
        ),
      );
      await db.prepare("UPDATE posts SET hidden=0 WHERE id=?").run(postId);
      assert.equal(await count(), 16);
      assert.equal(
        (
          await request("/posts/" + randomUUID() + "/views", "POST", {
            eventId: randomUUID(),
          })
        ).status,
        404,
      );
    },
  );

  await t.test(
    "A failed counter update rolls back its deduplication ID",
    async () => {
      const eventId = randomUUID();
      const failingDb = {
        ...db,
        close: async () => {},
        prepare(sql) {
          if (sql.startsWith("UPDATE posts SET view_count="))
            return {
              run: async () => {
                throw new Error("Simulated view failure");
              },
            };
          return db.prepare(sql);
        },
      };
      const failing = await createApp({
        db: failingDb,
        vault: createVault(),
        origin,
        testing: true,
      });
      const failServer = failing.app.listen(0, "127.0.0.1");
      await new Promise((resolve) => failServer.once("listening", resolve));
      try {
        const response = await fetch(
          "http://127.0.0.1:" +
            failServer.address().port +
            "/api" +
            path +
            "/views",
          {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: JSON.stringify({ eventId }),
          },
        );
        assert.equal(response.status, 500);
        assert.equal(await count(), 16);
        assert.equal(
          await db
            .prepare(
              "SELECT 1 FROM post_view_events WHERE post_id=? AND event_id=?",
            )
            .get(postId, eventId),
          undefined,
        );
        assert.deepEqual((await view(eventId)).data, {
          view_count: 17,
          counted: true,
        });
      } finally {
        failServer.closeAllConnections();
        await new Promise((resolve) => failServer.close(resolve));
        await failing.close();
      }
    },
  );

  await t.test(
    "Upgrades preserve existing totals and initialize legacy posts to zero",
    async () => {
      const retained = (await request(path)).data;
      await migrateCommunity(db);
      await migrateCommunity(db);
      assert.deepEqual((await request(path)).data, retained);
      // Simulate the old installed schema in the isolated test database only.
      await db.exec("ALTER TABLE posts DROP COLUMN view_count");
      await Promise.all([migrateCommunity(db), migrateCommunity(db)]);
      assert.equal(await count(), 0);
      assert.equal((await request(path)).data.title, retained.title);
      await db.prepare("UPDATE posts SET view_count=17 WHERE id=?").run(postId);
    },
  );

  await t.test(
    "Retention and post deletion clean deduplication records without reducing totals",
    async () => {
      await db
        .prepare(
          "UPDATE post_view_events SET created_at=? WHERE post_id=? AND event_id=?",
        )
        .run(Date.now() - 2 * 86400000, postId, firstEvent);
      await maintenance(db);
      assert.equal(
        await db
          .prepare(
            "SELECT 1 FROM post_view_events WHERE post_id=? AND event_id=?",
          )
          .get(postId, firstEvent),
        undefined,
      );
      assert.equal(await count(), 17);
      assert.equal(
        (
          await db
            .prepare(
              "SELECT COUNT(*) AS n FROM post_view_events WHERE post_id=?",
            )
            .get(postId)
        ).n,
        16,
      );
      assert.equal((await request(path, "DELETE", {}, author)).status, 200);
      assert.equal((await view()).status, 404);
      assert.equal(
        (
          await db
            .prepare(
              "SELECT COUNT(*) AS n FROM post_view_events WHERE post_id=?",
            )
            .get(postId)
        ).n,
        0,
      );
    },
  );
});
