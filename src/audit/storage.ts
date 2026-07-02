import { mkdir, readFile, writeFile, readdir } from "fs/promises";
import path from "path";
import type { Phase1AuditPayload } from "./types";

const DATA_ROOT = path.join(process.cwd(), "data", "audits");

function auditDir(clientId: string) {
  return path.join(DATA_ROOT, clientId);
}

function auditFilePath(clientId: string, auditId: string) {
  return path.join(auditDir(clientId), `${auditId}.json`);
}

export async function ensureAuditStorage(clientId: string): Promise<void> {
  await mkdir(auditDir(clientId), { recursive: true });
}

export async function saveAudit(audit: Phase1AuditPayload): Promise<string> {
  await ensureAuditStorage(audit.clientId);
  const filePath = auditFilePath(audit.clientId, audit.auditId);
  await writeFile(filePath, JSON.stringify(audit, null, 2), "utf-8");
  return filePath;
}

export async function loadAudit(
  clientId: string,
  auditId: string
): Promise<Phase1AuditPayload | null> {
  try {
    const raw = await readFile(auditFilePath(clientId, auditId), "utf-8");
    return JSON.parse(raw) as Phase1AuditPayload;
  } catch {
    return null;
  }
}

export async function listAudits(clientId: string): Promise<Phase1AuditPayload[]> {
  try {
    const dir = auditDir(clientId);
    const files = await readdir(dir);
    const audits: Phase1AuditPayload[] = [];

    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const raw = await readFile(path.join(dir, file), "utf-8");
      audits.push(JSON.parse(raw) as Phase1AuditPayload);
    }

    return audits.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function loadLatestAudit(
  clientId: string
): Promise<Phase1AuditPayload | null> {
  const audits = await listAudits(clientId);
  return audits[0] ?? null;
}

export async function loadPriorAudit(
  clientId: string,
  beforeDate: string
): Promise<Phase1AuditPayload | null> {
  const audits = await listAudits(clientId);
  const prior = audits.find(
    (a) => new Date(a.completedAt).getTime() < new Date(beforeDate).getTime()
  );
  return prior ?? null;
}
