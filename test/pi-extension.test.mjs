import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as http from "node:http";
import { Text } from "@earendil-works/pi-tui";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-companion-test-"));
process.env.TMPDIR = tmp;
const connectionDir = path.join(tmp, "pi-companion");

const handlers = {};
const tools = {};
const widgets = [];
const ctx = {
  ui: {
    setWidget: (_key, content) => {
      const component = Array.isArray(content)
        ? { render: () => content.map((line) => new Text(line, 1, 0).render()[0]) }
        : content({}, { fg: (_role, text) => text });
      widgets.push(component.render(80).join("\n"));
    },
    notify: () => {},
  },
};

function contextFor(file) {
  return {
    workspaceState: {
      openFiles: [{ timestamp: 1, isActive: true, ...file }],
      isTrusted: true,
      workspacePath: "/ws",
    },
  };
}

function startServer(onStream) {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    if (req.url === "/context") {
      res.setHeader("Content-Type", "application/json");
      res.end("{}");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.flushHeaders();
    onStream(res);
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      fs.mkdirSync(connectionDir, { recursive: true });
      fs.writeFileSync(
        path.join(connectionDir, "connection-1.json"),
        JSON.stringify({ port: server.address().port, workspacePath: "/ws", authToken: "t" }),
      );
      resolve({
        stop: () => new Promise((r) => {
          for (const s of sockets) s.destroy();
          server.close(() => r());
        }),
      });
    });
  });
}

async function waitFor(predicate, timeoutMs = 8000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
}

const lastWidget = () => widgets[widgets.length - 1];

before(async () => {
  process.env.TERM_PROGRAM = "";
  const mod = await import("../extensions/index.ts");
  mod.default({
    on: (name, fn) => { handlers[name] = fn; },
    registerTool: (tool) => { tools[tool.name] = tool; },
  });
});

after(async () => {
  await handlers.session_shutdown();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("shows disconnected when the server stops", async () => {
  const server = await startServer((res) => {
    res.write(`data: ${JSON.stringify(contextFor({ path: "/ws/a.ts" }))}\n\n`);
  });
  await handlers.session_start({}, ctx);
  await waitFor(() => lastWidget() === "a.ts");

  await server.stop();
  fs.rmSync(connectionDir, { recursive: true, force: true });
  await waitFor(() => lastWidget() === "vscode: disconnected");
  await handlers.session_shutdown();
});

test("keeps retrying until the server comes back", async () => {
  let server = await startServer((res) => {
    res.write(`data: ${JSON.stringify(contextFor({ path: "/ws/a.ts" }))}\n\n`);
  });
  await handlers.session_start({}, ctx);
  await waitFor(() => lastWidget() === "a.ts");

  await server.stop();
  fs.rmSync(connectionDir, { recursive: true, force: true });
  await waitFor(() => lastWidget() === "vscode: disconnected");
  await new Promise((r) => setTimeout(r, 2500));

  server = await startServer((res) => {
    res.write(`data: ${JSON.stringify(contextFor({ path: "/ws/b.ts" }))}\n\n`);
  });
  try {
    await waitFor(() => lastWidget() === "b.ts");
  } finally {
    await handlers.session_shutdown();
    await server.stop();
  }
});

async function widgetFor(file) {
  const server = await startServer((res) => {
    res.write(`data: ${JSON.stringify(contextFor(file))}\n\n`);
  });
  try {
    await handlers.session_start({}, ctx);
    await waitFor(() => lastWidget()?.includes("a.ts"));
    return lastWidget();
  } finally {
    await handlers.session_shutdown();
    await server.stop();
  }
}

test("shows the widget without leading space", async () => {
  assert.equal(await widgetFor({ path: "/ws/a.ts" }), "a.ts");
});

test("ignores the last line when the selection ends at its first character", async () => {
  const widget = await widgetFor({
    path: "/ws/a.ts",
    selectionStart: { line: 9, character: 1 },
    selectionEnd: { line: 15, character: 1 },
  });
  assert.equal(widget, "a.ts L9:14");
});

test("shows a single line when the selection ends at the start of the next line", async () => {
  const widget = await widgetFor({
    path: "/ws/a.ts",
    selectionStart: { line: 9, character: 1 },
    selectionEnd: { line: 10, character: 1 },
  });
  assert.equal(widget, "a.ts L9");
});

test("keeps the last line when the selection ends after its first character", async () => {
  const widget = await widgetFor({
    path: "/ws/a.ts",
    selectionStart: { line: 9, character: 1 },
    selectionEnd: { line: 15, character: 3 },
  });
  assert.equal(widget, "a.ts L9:15");
});

test("keeps multi-byte characters split across chunks", async () => {
  const content = "héllo ✓";
  const server = await startServer(async (res) => {
    const bytes = Buffer.from(`data: ${JSON.stringify(contextFor({ path: "/ws/c.ts", content }))}\n\n`);
    const split = bytes.indexOf(Buffer.from("✓")) + 1;
    res.write(bytes.subarray(0, split));
    await new Promise((r) => setTimeout(r, 100));
    res.write(bytes.subarray(split));
  });
  try {
    await handlers.session_start({}, ctx);
    await waitFor(() => lastWidget() === "c.ts");
    const result = await tools.get_current_file.execute();
    assert.equal(JSON.parse(result.content[0].text).content, content);
  } finally {
    await handlers.session_shutdown();
    await server.stop();
  }
});
