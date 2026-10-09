import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  stringToHex,
} from "viem";
import { createSiweMessage } from "viem/siwe";
import { database } from "~~/services/beta/database";
import { HttpError, fail } from "~~/services/beta/errors";
import { verifyReceipt } from "~~/services/beta/receipts";
import { tokenFactoryAbi } from "~~/utils/launcher/abis";
import { factoryAddress, network } from "~~/utils/launcher/config";
import {
  type ReviewedProposal,
  disclosureRevision,
  proposalTermsHash,
  validateTerms,
} from "~~/utils/launcher/proposal";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const randomToken = () => randomBytes(32).toString("hex");
function origin() {
  const url = process.env.APP_ORIGIN;
  if (!url || new URL(url).origin !== url) return fail(503, "Configure APP_ORIGIN to the exact application origin");
  return url;
}
function client() {
  return createPublicClient({ chain: network, transport: http(process.env.BETA_RPC_URL) });
}
function factory(): Address {
  if (!factoryAddress || !isAddress(factoryAddress)) return fail(503, "Factory is unconfigured");
  return factoryAddress;
}
function cookie(request: Request, name: string) {
  return (
    (request.headers.get("cookie") || "")
      .split(";")
      .map(s => s.trim())
      .find(s => s.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}
function setCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${origin().startsWith("https:") ? "; Secure" : ""}`;
}
async function actor(request: Request) {
  const token = cookie(request, "beta-session");
  const result = await database().query<{ address: Address }>(
    "SELECT address FROM beta_sessions WHERE token_hash=$1 AND expires_at>now()",
    [digest(token)],
  );
  return result.rows[0]?.address || fail(401, "Sign in with your wallet first");
}
async function operator(address: Address) {
  const owner = await client().readContract({ address: factory(), abi: tokenFactoryAbi, functionName: "owner" });
  if (owner.toLowerCase() !== address.toLowerCase()) fail(403, "Only the current factory operator can do this");
}
async function admission(address: Address, role: string) {
  const r = await database().query(
    "SELECT admitted FROM beta_admission WHERE address=$1 AND role=$2 ORDER BY id DESC LIMIT 1",
    [address.toLowerCase(), role],
  );
  return r.rows[0]?.admitted === true;
}
const proposalSelect = `SELECT p.*, r.action, r.actor AS reviewer, r.created_at AS reviewed_at FROM beta_proposals p
LEFT JOIN LATERAL (SELECT * FROM beta_reviews WHERE proposal=p.id ORDER BY id DESC LIMIT 1) r ON true`;
async function proposal(id: string) {
  const r = await database().query<ReviewedProposal>(`${proposalSelect} WHERE p.id=$1`, [id]);
  return r.rows[0] || fail(404, "Proposal not found");
}
function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 2000)
    return fail(400, `${field} is required (maximum 2000 characters)`);
  return value;
}
function reviewData(p: ReviewedProposal, action: string, reason: string) {
  return encodeFunctionData({
    abi: tokenFactoryAbi,
    functionName: "reviewProposal",
    args: [
      p.id,
      p.launcher,
      p.terms.name,
      p.terms.symbol,
      p.revision,
      p.terms.launcherRecipient,
      action === "approve",
      reason,
    ],
  });
}
async function readLive(p: ReviewedProposal) {
  const rpc = client();
  const [live, platform] = await Promise.all([
    rpc.readContract({ address: factory(), abi: tokenFactoryAbi, functionName: "proposals", args: [p.id] }),
    rpc.readContract({ address: factory(), abi: tokenFactoryAbi, functionName: "platformRecipient" }),
  ]);
  return { live, platform };
}
export async function handleBeta(request: Request): Promise<Response> {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  try {
    const app = origin();
    if (request.headers.get("host") !== new URL(app).host) fail(403, "Application host mismatch");
    if (request.method !== "GET" && request.headers.get("origin") !== app) fail(403, "Application origin mismatch");
    const path = new URL(request.url).pathname.replace(/^\/api\/beta\//, "");
    if (request.method === "POST" && Number(request.headers.get("content-length") || 0) > 32768)
      fail(413, "Request too large");
    const raw = request.method === "POST" ? await request.text() : "";
    if (raw.length > 32768) fail(413, "Request too large");
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(400, "JSON object required");
    const body = parsed as Record<string, unknown>;
    let result: unknown;
    if (path === "challenge" && request.method === "POST") {
      if (typeof body.address !== "string" || !isAddress(body.address) || body.chainId !== network.id)
        fail(400, "Use an Ethereum wallet on the configured network");
      const token = randomToken();
      const address = getAddress(body.address as Address);
      const expires = new Date(Date.now() + 5 * 60_000);
      const message = createSiweMessage({
        address,
        chainId: network.id,
        domain: new URL(app).host,
        uri: app,
        version: "1",
        nonce: randomToken(),
        issuedAt: new Date(),
        expirationTime: expires,
        statement: "Sign in to the Launcher Token Controlled Beta. This grants no token permissions.",
      });
      await database().query("INSERT INTO beta_challenges(token_hash,message,address,expires_at) VALUES($1,$2,$3,$4)", [
        digest(token),
        message,
        address.toLowerCase(),
        expires,
      ]);
      headers["Set-Cookie"] = setCookie("beta-challenge", token, 300);
      result = { message };
    } else if (path === "verify" && request.method === "POST") {
      const challenge = cookie(request, "beta-challenge");
      const r = await database().query(
        "SELECT * FROM beta_challenges WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now()",
        [digest(challenge)],
      );
      const stored = r.rows[0];
      if (!stored || stored.message !== body.message || typeof body.signature !== "string")
        fail(401, "Challenge expired, consumed or mismatched. Sign in again");
      if (
        !(await client().verifySiweMessage({
          message: stored.message,
          signature: body.signature as Hex,
          domain: new URL(app).host,
        }))
      )
        fail(401, "Wallet signature invalid");
      const token = randomToken();
      const connection = await database().connect();
      try {
        await connection.query("BEGIN");
        const used = await connection.query(
          "UPDATE beta_challenges SET consumed_at=now() WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() RETURNING address",
          [digest(challenge)],
        );
        if (!used.rowCount) fail(401, "Challenge already consumed or expired");
        await connection.query(
          "INSERT INTO beta_sessions(token_hash,address,expires_at) VALUES($1,$2,now()+interval '1 hour')",
          [digest(token), stored.address],
        );
        await connection.query("COMMIT");
      } catch (e) {
        await connection.query("ROLLBACK");
        throw e;
      } finally {
        connection.release();
      }
      headers["Set-Cookie"] = setCookie("beta-session", token, 3600);
      result = { address: stored.address };
    } else if (path === "session" && request.method === "DELETE") {
      await database().query("DELETE FROM beta_sessions WHERE token_hash=$1", [
        digest(cookie(request, "beta-session")),
      ]);
      headers["Set-Cookie"] = setCookie("beta-session", "", 0);
      result = { signedOut: true };
    } else if (path === "disclosure" && request.method === "GET") {
      const token = new URL(request.url).searchParams.get("token") || "";
      if (!isAddress(token)) fail(400, "Valid token address required");
      const id = await client().readContract({
        address: factory(),
        abi: tokenFactoryAbi,
        functionName: "proposalOf",
        args: [token as Address],
      });
      if (/^0x0+$/.test(id)) fail(404, "Token is not registered by this factory");
      const p = await proposal(id);
      const { live } = await readLive(p);
      if (live[5].toLowerCase() !== token.toLowerCase() || live[2] !== proposalTermsHash(p) || live[3] !== p.revision)
        fail(409, "Disclosures do not match the registered token");
      result = { ...p, token };
    } else {
      const address = await actor(request);
      if (path === "session" && request.method === "GET") {
        const [participant, launcher, owner] = await Promise.all([
          admission(address, "participant"),
          admission(address, "launcher"),
          client().readContract({ address: factory(), abi: tokenFactoryAbi, functionName: "owner" }),
        ]);
        result = {
          address,
          participant,
          launcher,
          operator: owner.toLowerCase() === address.toLowerCase(),
          chainId: network.id,
        };
      } else if (path === "admission" && request.method === "POST") {
        await operator(address);
        if (
          typeof body.address !== "string" ||
          !isAddress(body.address) ||
          !["launcher", "participant"].includes(String(body.role)) ||
          typeof body.admitted !== "boolean" ||
          /^0x0{40}$/i.test(String(body.address))
        )
          fail(400, "Choose a valid wallet, role and admission action");
        const reason = text(body.reason, "Reason");
        const source = text(body.source, "Source");
        if (body.role === "launcher") {
          const data = encodeFunctionData({
            abi: tokenFactoryAbi,
            functionName: "setLauncherApproval",
            args: [body.address as Address, body.admitted as boolean, reason],
          });
          if (!body.transactionHash)
            return Response.json({ to: factory(), data, chainId: network.id, value: "0" }, { headers });
          if (!/^0x[0-9a-fA-F]{64}$/.test(String(body.transactionHash))) fail(400, "Invalid transaction hash");
          await verifyReceipt({
            hash: body.transactionHash as Hex,
            actor: address,
            data,
            kind: "admission",
            launcher: body.address as Address,
          });
          const approved = await client().readContract({
            address: factory(),
            abi: tokenFactoryAbi,
            functionName: "approvedLaunchers",
            args: [body.address as Address],
          });
          if (approved !== body.admitted) fail(409, "Receipt does not match current Launcher admission");
        }
        await database().query(
          "INSERT INTO beta_admission(address,role,admitted,actor,reason,source,transaction_hash) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(transaction_hash) WHERE transaction_hash IS NOT NULL DO NOTHING",
          [
            (body.address as string).toLowerCase(),
            body.role,
            body.admitted,
            address,
            reason,
            source,
            body.role === "launcher" ? body.transactionHash : null,
          ],
        );
        result = { saved: true };
      } else if (path === "admission" && request.method === "GET") {
        await operator(address);
        result = (await database().query("SELECT * FROM beta_admission ORDER BY id DESC LIMIT 200")).rows;
      } else if (path === "proposals" && request.method === "POST") {
        let terms;
        try {
          terms = validateTerms(body.terms);
        } catch (e) {
          return fail(400, e instanceof Error ? e.message : "Invalid proposal");
        }
        const platform = await client().readContract({
          address: factory(),
          abi: tokenFactoryAbi,
          functionName: "platformRecipient",
        });
        if (terms.platformRecipient !== platform.toLowerCase()) fail(400, "Platform recipient must match the factory");
        const previous = body.predecessor ? await proposal(text(body.predecessor, "Previous proposal")) : undefined;
        if (previous && previous.launcher !== address) fail(403, "Only the Launcher can revise this proposal");
        const id = keccak256(stringToHex(randomUUID()));
        await database().query(
          "INSERT INTO beta_proposals(id,family,predecessor,launcher,revision,terms,source) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            previous?.family || id,
            previous?.id || null,
            address,
            disclosureRevision(terms),
            JSON.stringify(terms),
            text(body.source, "Source"),
          ],
        );
        result = await proposal(id);
      } else if (path === "proposals" && request.method === "GET") {
        const owner = await client().readContract({ address: factory(), abi: tokenFactoryAbi, functionName: "owner" });
        result = (
          await database().query<ReviewedProposal>(
            `${proposalSelect} WHERE ($1 OR p.launcher=$2) ORDER BY p.created_at DESC LIMIT 100`,
            [owner.toLowerCase() === address, address],
          )
        ).rows;
      } else if (path === "review" && request.method === "POST") {
        await operator(address);
        const p = await proposal(text(body.proposal, "Proposal"));
        if (!["approve", "reject", "revoke"].includes(String(body.action)))
          fail(400, "Choose approve, reject or revoke");
        const reason = text(body.reason, "Reason");
        const source = text(body.source, "Source");
        const { live, platform } = await readLive(p);
        if (platform.toLowerCase() !== p.terms.platformRecipient)
          fail(409, "Proposal recipients differ from the factory");
        if (!/^0x0{40}$/i.test(live[5])) fail(409, "Created proposals cannot be reviewed again");
        const data = reviewData(p, String(body.action), reason);
        if (!body.transactionHash) {
          result = { to: factory(), data, chainId: network.id, value: "0", revision: p.revision };
        } else {
          if (!/^0x[0-9a-fA-F]{64}$/.test(String(body.transactionHash))) fail(400, "Invalid transaction hash");
          const hash = body.transactionHash as Hex;
          const receipt = await verifyReceipt({ hash, actor: address, data, kind: "review", proposal: p.id });
          if (live[2] !== proposalTermsHash(p) || live[3] !== p.revision || live[4] !== (body.action === "approve"))
            fail(409, "Review was superseded onchain; refresh before retrying");
          await database().query(
            "INSERT INTO beta_reviews(proposal,action,actor,reason,source,transaction_hash,block_number,block_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(transaction_hash) DO NOTHING",
            [p.id, body.action, address, reason, source, hash, receipt.blockNumber.toString(), receipt.blockHash],
          );
          result = await proposal(p.id);
        }
      } else if (path === "creation" && request.method === "GET") {
        if (!(await admission(address, "launcher"))) fail(403, "Launcher interface admission required");
        const p = await proposal(new URL(request.url).searchParams.get("proposal") || "");
        if (p.launcher !== address || p.action !== "approve")
          fail(403, "An approved proposal belonging to this Launcher is required");
        const { live } = await readLive(p);
        const launcherApproved = await client().readContract({
          address: factory(),
          abi: tokenFactoryAbi,
          functionName: "approvedLaunchers",
          args: [address],
        });
        if (
          !launcherApproved ||
          live[2] !== proposalTermsHash(p) ||
          live[3] !== p.revision ||
          !live[4] ||
          !/^0x0{40}$/i.test(live[5])
        )
          fail(409, "Proposal unavailable, consumed or changed onchain");
        result = p;
      } else if (path === "access" && request.method === "GET") {
        if (!(await admission(address, "participant"))) fail(403, "Participant invitation required");
        result = { admitted: true };
      } else if (path === "history" && request.method === "GET") {
        const p = await proposal(new URL(request.url).searchParams.get("proposal") || "");
        if (p.launcher !== address) await operator(address);
        result = {
          revisions: (await database().query(`${proposalSelect} WHERE p.family=$1 ORDER BY p.created_at`, [p.family]))
            .rows,
          reviews: (
            await database().query(
              "SELECT r.* FROM beta_reviews r JOIN beta_proposals p ON p.id=r.proposal WHERE p.family=$1 ORDER BY r.id",
              [p.family],
            )
          ).rows,
        };
      } else fail(404, "Beta endpoint not found");
    }
    return Response.json(result, { headers });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : e instanceof SyntaxError ? 400 : 503;
    return Response.json(
      {
        error:
          e instanceof HttpError
            ? e.message
            : status === 400
              ? "Invalid JSON request"
              : "Beta service unavailable; check database and RPC configuration, then retry",
      },
      { status, headers },
    );
  }
}
