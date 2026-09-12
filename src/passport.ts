// A Porchlight passport: one small file that carries who a companion is.
// Pack it on one porch, let them walk onto another. It carries identity, not
// scores: money and relationship numbers belong to a life, not a document.
import { JOBS, type Job } from './world';

export const PASSPORT_FORMAT = 'porchlight-passport';
export const PASSPORT_VERSION = 1;

export type PassportMemory = { text: string; tags: string[]; importance: number };

export type PassportCompanion = {
  name: string;
  personality: string;
  likes: string[];
  dislikes: string[];
  values: string[];
  boundaries: string[];
  hobbies: string[];
  job: Job;
  home: string;
  level: number;
  memories: PassportMemory[];
  goalTitles: string[];
};

export type Passport = {
  format: typeof PASSPORT_FORMAT;
  version: number;
  packed_at: string;
  companion: PassportCompanion;
};

const MAX = { name: 40, line: 200, item: 40, list: 12, memories: 20, memory: 240, goal: 80 };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function list(v: unknown, maxItems = MAX.list, maxItem = MAX.item): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const raw of v) {
    const s = str(raw, maxItem);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

const cleanJob = (v: unknown): Job => (typeof v === 'string' && v in JOBS ? (v as Job) : 'explorer');
const cleanLevel = (v: unknown) => Math.max(1, Math.min(99, Math.floor(Number(v) || 1)));

function cleanMemories(v: unknown): PassportMemory[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(-MAX.memories)
    .map((m: any) => ({
      text: str(m?.text, MAX.memory),
      tags: list(m?.tags, 6, 24),
      importance: Math.max(0, Math.min(100, Math.floor(Number(m?.importance) || 50))),
    }))
    .filter((m) => m.text);
}

function cleanGoalTitles(c: any): string[] {
  const src = Array.isArray(c?.goalTitles) ? c.goalTitles : Array.isArray(c?.goals) ? c.goals : [];
  const out: string[] = [];
  for (const g of src) {
    if (g && typeof g === 'object' && g.active === false) continue;
    const t = str(typeof g === 'string' ? g : g?.title, MAX.goal);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 6) break;
  }
  return out;
}

export function packPassport(c: any): string {
  const p: Passport = {
    format: PASSPORT_FORMAT,
    version: PASSPORT_VERSION,
    packed_at: new Date().toISOString(),
    companion: {
      name: str(c?.name, MAX.name) || 'A traveler',
      personality: str(c?.personality, MAX.line),
      likes: list(c?.likes),
      dislikes: list(c?.dislikes),
      values: list(c?.values, 8),
      boundaries: list(c?.boundaries, 8),
      hobbies: list(c?.hobbies),
      job: cleanJob(c?.job),
      home: str(c?.home, 60) || 'Starter Cottage',
      level: cleanLevel(c?.level),
      memories: cleanMemories(c?.memories),
      goalTitles: cleanGoalTitles(c),
    },
  };
  return JSON.stringify(p, null, 2);
}

export type ReadPassportResult = { ok: true; data: PassportCompanion } | { ok: false; error: string };

/** Forgiving by design: accepts a packed passport, a `{companion:{...}}` wrapper, or a bare companion object. */
export function readPassport(text: string): ReadPassportResult {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That does not read as a passport file.' };
  }
  const c = raw?.companion && typeof raw.companion === 'object' ? raw.companion : raw;
  const name = str(c?.name, MAX.name);
  if (!name) return { ok: false, error: 'This passport has no name on it.' };
  return {
    ok: true,
    data: {
      name,
      personality: str(c?.personality, MAX.line),
      likes: list(c?.likes),
      dislikes: list(c?.dislikes),
      values: list(c?.values, 8),
      boundaries: list(c?.boundaries, 8),
      hobbies: list(c?.hobbies),
      job: cleanJob(c?.job),
      home: str(c?.home, 60) || 'Starter Cottage',
      level: cleanLevel(c?.level),
      memories: cleanMemories(c?.memories),
      goalTitles: cleanGoalTitles(c),
    },
  };
}
