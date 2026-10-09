import { tokenFactoryAbi } from "../utils/launcher/abis";
import { type ReviewedProposal } from "../utils/launcher/proposal";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type Address, type Hex, createPublicClient, createWalletClient, encodeFunctionData, http } from "viem";
import { foundry } from "viem/chains";

const origin = process.env.BETA_TEST_ORIGIN || "http://127.0.0.1:3000";
// Integration fixture is local Anvil + a dedicated test PostgreSQL database; no live credentials.
const rpc = createPublicClient({ chain: foundry, transport: http("http://127.0.0.1:8545") });
const wallet = createWalletClient({ chain: foundry, transport: http("http://127.0.0.1:8545") });
const factory = readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_TOKEN_FACTORY=(.*)$/m)?.[1] as Address;
async function request(path: string, body?: unknown, cookie = "", customOrigin = origin) {
  const response = await fetch(`${origin}/api/beta/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Origin: customOrigin, Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
}
function responseCookie(response: Response) {
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}
async function challenge(account: Address) {
  const result = await request("challenge", { address: account, chainId: 31337 });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  const signature = await wallet.signMessage({ account, message: result.data.message });
  return { cookie: responseCookie(result.response), message: result.data.message, signature };
}
async function login(account: Address) {
  const c = await challenge(account);
  const result = await request("verify", { message: c.message, signature: c.signature }, c.cookie);
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  return responseCookie(result.response);
}
async function send(account: Address, to: Address, data: Hex) {
  const hash = await wallet.sendTransaction({ account, to, data });
  assert.equal((await rpc.waitForTransactionReceipt({ hash })).status, "success");
  return hash;
}
async function admit(
  operator: Address,
  cookie: string,
  target: Address,
  role: "launcher" | "participant",
  admitted: boolean,
) {
  const body = {
    address: target,
    role,
    admitted,
    reason: "Integration fixture admission",
    source: "Local public API integration test",
  };
  const prepared = await request("admission", body, cookie);
  assert.equal(prepared.response.status, 200, JSON.stringify(prepared.data));
  if (role === "participant") return;
  const hash = await send(operator, prepared.data.to, prepared.data.data);
  const saved = await request("admission", { ...body, transactionHash: hash }, cookie);
  assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
}
async function review(operator: Address, cookie: string, p: ReviewedProposal, action: string) {
  const body = { proposal: p.id, action, reason: `Test ${action}`, source: "Local fixture review" };
  const prepared = await request("review", body, cookie);
  assert.equal(prepared.response.status, 200, JSON.stringify(prepared.data));
  const transactionHash = await send(operator, prepared.data.to, prepared.data.data);
  const saved = await request("review", { ...body, transactionHash }, cookie);
  assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
  return saved.data as ReviewedProposal;
}
test("operator admission rejects an unauthenticated wallet address", async () => {
  assert.equal(
    (
      await request("admission", {
        address: "0x0000000000000000000000000000000000000001",
        role: "participant",
        admitted: true,
        reason: "test",
        source: "test",
      })
    ).response.status,
    401,
  );
});
test("login binds origin, chain, wallet and an atomic single-use challenge", async () => {
  assert.equal((await request("challenge", null)).response.status, 400);
  const [operator, other] = await wallet.getAddresses();
  assert.equal((await request("challenge", { address: operator, chainId: 1 })).response.status, 400);
  assert.equal(
    (await request("challenge", { address: operator, chainId: 31337 }, "", "https://attacker.example")).response.status,
    403,
  );
  const c = await challenge(operator);
  const wrong = await wallet.signMessage({ account: other, message: c.message });
  assert.equal((await request("verify", { message: c.message, signature: wrong }, c.cookie)).response.status, 401);
  assert.equal(
    (await request("verify", { message: `${c.message} changed`, signature: c.signature }, c.cookie)).response.status,
    401,
  );
  assert.equal((await request("verify", { message: c.message, signature: c.signature })).response.status, 401);
  const attempts = await Promise.all([request("verify", c, c.cookie), request("verify", c, c.cookie)]);
  assert.deepEqual(attempts.map(r => r.response.status).sort(), [200, 401]);
  assert.equal((await request("verify", c, c.cookie)).response.status, 401);
});
test("invitation grants interface access and revocation removes it without logging the Participant out", async () => {
  const [operator, , participant] = await wallet.getAddresses();
  const operatorCookie = await login(operator);
  const participantCookie = await login(participant);
  await admit(operator, operatorCookie, participant, "participant", false);
  assert.equal((await request("access", undefined, participantCookie)).response.status, 403);
  assert.equal(
    (
      await request(
        "admission",
        { address: participant, role: "participant", admitted: true, reason: "spoof", source: "spoof" },
        participantCookie,
      )
    ).response.status,
    403,
  );
  await admit(operator, operatorCookie, participant, "participant", true);
  assert.equal((await request("access", undefined, participantCookie)).response.status, 200);
  await admit(operator, operatorCookie, participant, "participant", false);
  assert.equal((await request("access", undefined, participantCookie)).response.status, 403);
  assert.equal((await request("session", undefined, participantCookie)).data.participant, false);
  const logout = await fetch(`${origin}/api/beta/session`, {
    method: "DELETE",
    headers: { Origin: origin, Cookie: participantCookie },
  });
  assert.equal(logout.status, 200);
  assert.equal((await request("session", undefined, participantCookie)).response.status, 401);
});
test("receipt confirmation is idempotent and rejects superseded onchain actions", async () => {
  const [operator, launcher] = await wallet.getAddresses();
  const cookie = await login(operator);
  const body = {
    address: launcher,
    role: "launcher",
    admitted: true,
    reason: "Delayed fixture admission",
    source: "Chronology test",
  };
  const prepared = await request("admission", body, cookie);
  const oldHash = await send(operator, prepared.data.to, prepared.data.data);
  await admit(operator, cookie, launcher, "launcher", true);
  assert.equal((await request("admission", { ...body, transactionHash: oldHash }, cookie)).response.status, 409);
  const current = await request("admission", body, cookie);
  const hash = await send(operator, current.data.to, current.data.data);
  const confirmed = { ...body, transactionHash: hash };
  assert.equal((await request("admission", confirmed, cookie)).response.status, 200);
  assert.equal((await request("admission", confirmed, cookie)).response.status, 200);
  const history = await request("admission", undefined, cookie);
  assert.equal(history.data.filter((r: { transaction_hash: string }) => r.transaction_hash === hash).length, 1);
  const terms = {
    business: "Chronology fixture",
    links: [],
    description: "No live business",
    benefits: "None",
    name: "Chronology Token",
    symbol: "CT",
    launcherRecipient: launcher,
    platformRecipient: operator,
    initialPurchase: "none",
  };
  const p = (await request("proposals", { terms, source: "Local chronology fixture" }, await login(launcher))).data;
  const reviewBody = {
    proposal: p.id,
    action: "reject",
    reason: "Delayed rejection",
    source: "Local chronology fixture",
  };
  const preview = await request("review", reviewBody, cookie);
  const oldReviewHash = await send(operator, preview.data.to, preview.data.data);
  await review(operator, cookie, p, "revoke");
  assert.equal(
    (await request("review", { ...reviewBody, transactionHash: oldReviewHash }, cookie)).response.status,
    409,
  );
  const provenance = await request(`history?proposal=${p.id}`, undefined, cookie);
  assert.deepEqual(
    provenance.data.reviews.map((r: { action: string }) => r.action),
    ["revoke"],
  );
});
test("reviewed disclosures, rejection, revocation and revisions govern Launcher creation", async () => {
  const [operator, launcher, participant] = await wallet.getAddresses();
  const operatorCookie = await login(operator);
  const launcherCookie = await login(launcher);
  const participantCookie = await login(participant);
  await admit(operator, operatorCookie, launcher, "launcher", true);
  const terms = {
    business: "Fictional Test Prediction Business",
    links: ["https://example.com/community"],
    description: "Fictional beta workflow",
    benefits: "None",
    name: "Reviewed Fictional Token",
    symbol: "RFT",
    launcherRecipient: launcher,
    platformRecipient: operator,
    initialPurchase: "none",
  };
  const submitted = await request("proposals", { terms, source: "Launcher test submission" }, launcherCookie);
  assert.equal(submitted.response.status, 200, JSON.stringify(submitted.data));
  const p = submitted.data as ReviewedProposal;
  assert.equal((await request(`creation?proposal=${p.id}`, undefined, launcherCookie)).response.status, 403);
  assert.equal(
    (await request("review", { proposal: p.id, action: "approve", reason: "spoof", source: "spoof" }, launcherCookie))
      .response.status,
    403,
  );
  const rejected = await review(operator, operatorCookie, p, "reject");
  assert.equal(rejected.action, "reject");
  assert.equal((await request(`creation?proposal=${p.id}`, undefined, launcherCookie)).response.status, 403);
  await assert.rejects(
    rpc.simulateContract({
      account: launcher,
      address: factory,
      abi: tokenFactoryAbi,
      functionName: "createToken",
      args: [p.id, terms.name, terms.symbol, p.revision],
    }),
  );
  await review(operator, operatorCookie, p, "approve");
  assert.equal((await request(`creation?proposal=${p.id}`, undefined, participantCookie)).response.status, 403);
  const approved = await request(`creation?proposal=${p.id}`, undefined, launcherCookie);
  assert.equal(approved.response.status, 200, JSON.stringify(approved.data));
  assert.deepEqual(approved.data.terms.links, ["https://example.com/community"]);
  await review(operator, operatorCookie, p, "revoke");
  assert.equal((await request(`creation?proposal=${p.id}`, undefined, launcherCookie)).response.status, 403);
  await assert.rejects(
    rpc.simulateContract({
      account: launcher,
      address: factory,
      abi: tokenFactoryAbi,
      functionName: "createToken",
      args: [p.id, terms.name, terms.symbol, p.revision],
    }),
  );
  const revised = await request(
    "proposals",
    {
      predecessor: p.id,
      terms: { ...terms, description: "Updated fictional business disclosures" },
      source: "Launcher revision",
    },
    launcherCookie,
  );
  assert.equal(revised.response.status, 200, JSON.stringify(revised.data));
  assert.notEqual(revised.data.revision, p.revision);
  assert.equal(revised.data.action, null);
  const history = await request(`history?proposal=${p.id}`, undefined, operatorCookie);
  assert.equal(history.data.revisions.length, 2);
  assert.deepEqual(
    history.data.reviews.map((r: { action: string }) => r.action),
    ["reject", "approve", "revoke"],
  );
  assert.equal(history.data.revisions[0].terms.description, "Fictional beta workflow");
  assert.equal(history.data.reviews[0].actor, operator.toLowerCase());
  assert.ok(history.data.reviews[0].transaction_hash);
  const revisionProposal = await review(operator, operatorCookie, revised.data, "approve");
  await assert.rejects(
    rpc.simulateContract({
      account: launcher,
      address: factory,
      abi: tokenFactoryAbi,
      functionName: "createToken",
      args: [revisionProposal.id, terms.name, terms.symbol, p.revision],
    }),
  );
  const hash = await wallet.writeContract({
    account: launcher,
    address: factory,
    abi: tokenFactoryAbi,
    functionName: "createToken",
    args: [revisionProposal.id, terms.name, terms.symbol, revisionProposal.revision],
  });
  assert.equal((await rpc.waitForTransactionReceipt({ hash })).status, "success");
  assert.equal(
    (await request(`creation?proposal=${revisionProposal.id}`, undefined, launcherCookie)).response.status,
    409,
  );
  const live = await rpc.readContract({
    address: factory,
    abi: tokenFactoryAbi,
    functionName: "proposals",
    args: [revisionProposal.id],
  });
  assert.notEqual(live[5], "0x0000000000000000000000000000000000000000");
  const disclosure = await request(`disclosure?token=${live[5]}`);
  assert.equal(disclosure.response.status, 200);
  assert.equal(disclosure.data.revision, revisionProposal.revision);
  assert.deepEqual(disclosure.data.terms.links, ["https://example.com/community"]);
  assert.equal(disclosure.data.terms.description, "Updated fictional business disclosures");
  // Invitation remains interface-only: contract calls still succeed for non-invited wallets.
  await send(
    participant,
    live[5],
    encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "transfer",
          inputs: [
            { type: "address", name: "to" },
            { type: "uint256", name: "amount" },
          ],
          outputs: [{ type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "transfer",
      args: [operator, 0n],
    }),
  );
});
