import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as http from "node:http";
import { createRequire } from "node:module";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-companion-test-"));
process.env.TMPDIR = tmp;
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const require = createRequire(import.meta.url);
const vscode = require("vscode");
const { IDEServer } = require("../dist/ide-server.js");

function fakeContext() {
  const env = {};
  return {
    env,
    subscriptions: [],
    environmentVariableCollection: {
      replace: (key, value) => { env[key] = value; },
      clear: () => {},
    },
  };
}

async function startServer() {
  const context = fakeContext();
  const server = new IDEServer(() => {}, {});
  await server.start(context);
  return { server, context, port: server.getPort() };
}

function openStream(port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path: "/context/stream" }, (res) => {
      res.once("data", () => resolve(req));
    });
    req.on("error", () => {});
    setTimeout(() => reject(new Error("no stream")), 2000);
  });
}

test("stop resolves while a context stream is open", async () => {
  const { server, port } = await startServer();
  await openStream(port);
  const stopped = server.stop().then(() => "stopped");
  const timeout = new Promise((r) => setTimeout(() => r("timeout"), 2000));
  assert.equal(await Promise.race([stopped, timeout]), "stopped");
  assert.equal(server.isRunning(), false);
});

async function initialize(port, token) {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } },
    }),
  });
  await res.text();
  return res.status;
}

test("accepts more than one mcp session", async () => {
  const { server, context, port } = await startServer();
  try {
    const token = context.env.PI_COMPANION_AUTH_TOKEN;
    assert.equal(await initialize(port, token), 200);
    assert.equal(await initialize(port, token), 200);
  } finally {
    await server.stop();
  }
});
