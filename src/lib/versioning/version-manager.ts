import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const VERSIONS_DIR = path.join(DATA_DIR, "versions");
const MANIFEST_PATH = path.join(VERSIONS_DIR, "manifest.json");
const ROOT = process.cwd();

export interface VersionEntry {
  id: string;
  label: string;
  timestamp: string;
  trigger: string; // "push" | "manual" | "deploy"
  files: number;
  sizeBytes: number;
  active: boolean;
}

interface Manifest {
  activeVersion: string | null;
  versions: VersionEntry[];
}

function ensureDir() {
  fs.mkdirSync(VERSIONS_DIR, { recursive: true });
}

function readManifest(): Manifest {
  ensureDir();
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { activeVersion: null, versions: [] };
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
}

function writeManifest(m: Manifest) {
  ensureDir();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

/**
 * Collect all source files into a flat map of relativePath -> content.
 * We snapshot: src/, server.ts, package.json, prisma/, tsconfig.json, next.config.ts,
 * postcss.config.mjs, eslint.config.mjs, tailwind if present.
 */
function collectFiles(): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const include = [
    "src",
    "prisma",
  ];
  const includeFiles = [
    "server.ts",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "docker-compose.yml",
    "Dockerfile",
  ];

  // Individual root files
  for (const f of includeFiles) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) {
      files.set(f, fs.readFileSync(full));
    }
  }

  // Directories
  for (const dir of include) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    walkDir(base, dir, files);
  }

  return files;
}

function walkDir(absDir: string, relDir: string, out: Map<string, Buffer>) {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const rel = path.join(relDir, entry.name);
    const abs = path.join(absDir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "generated") continue;
    if (entry.isDirectory()) {
      walkDir(abs, rel, out);
    } else {
      out.set(rel, fs.readFileSync(abs));
    }
  }
}

/**
 * Save a snapshot. Creates a directory under data/versions/<id>/ with all files.
 */
export function createSnapshot(
  label: string,
  trigger: "push" | "manual" | "deploy" = "manual"
): VersionEntry {
  const id = `v-${Date.now()}`;
  const snapDir = path.join(VERSIONS_DIR, id);
  fs.mkdirSync(snapDir, { recursive: true });

  const files = collectFiles();
  let totalSize = 0;

  for (const [rel, buf] of files) {
    const dest = path.join(snapDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    totalSize += buf.length;
  }

  const entry: VersionEntry = {
    id,
    label,
    timestamp: new Date().toISOString(),
    trigger,
    files: files.size,
    sizeBytes: totalSize,
    active: false,
  };

  const manifest = readManifest();
  manifest.versions.unshift(entry);

  // Keep max 20 versions
  if (manifest.versions.length > 20) {
    const removed = manifest.versions.splice(20);
    for (const old of removed) {
      const oldDir = path.join(VERSIONS_DIR, old.id);
      if (fs.existsSync(oldDir)) {
        fs.rmSync(oldDir, { recursive: true, force: true });
      }
    }
  }

  writeManifest(manifest);
  return entry;
}

/**
 * Restore a snapshot by overwriting source files from the saved version.
 */
export function restoreSnapshot(versionId: string): void {
  const manifest = readManifest();
  const entry = manifest.versions.find((v) => v.id === versionId);
  if (!entry) throw new Error(`Version ${versionId} not found`);

  const snapDir = path.join(VERSIONS_DIR, versionId);
  if (!fs.existsSync(snapDir)) throw new Error(`Snapshot directory missing for ${versionId}`);

  // Restore files from snapshot
  const files = new Map<string, Buffer>();
  walkDir(snapDir, "", files);

  for (const [rel, buf] of files) {
    const dest = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }

  // Mark as active
  for (const v of manifest.versions) {
    v.active = v.id === versionId;
  }
  manifest.activeVersion = versionId;
  writeManifest(manifest);
}

/**
 * List all saved versions.
 */
export function listVersions(): VersionEntry[] {
  return readManifest().versions;
}

/**
 * Get the currently active version ID.
 */
export function getActiveVersion(): string | null {
  return readManifest().activeVersion;
}

/**
 * Delete a specific version snapshot.
 */
export function deleteVersion(versionId: string): void {
  const manifest = readManifest();
  const idx = manifest.versions.findIndex((v) => v.id === versionId);
  if (idx === -1) throw new Error(`Version ${versionId} not found`);
  if (manifest.versions[idx].active) throw new Error("Cannot delete the active version");

  const snapDir = path.join(VERSIONS_DIR, versionId);
  if (fs.existsSync(snapDir)) {
    fs.rmSync(snapDir, { recursive: true, force: true });
  }

  manifest.versions.splice(idx, 1);
  writeManifest(manifest);
}
