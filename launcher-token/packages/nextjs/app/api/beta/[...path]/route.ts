import { handleBeta } from "~~/services/beta/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleBeta;
export const POST = handleBeta;
export const DELETE = handleBeta;
