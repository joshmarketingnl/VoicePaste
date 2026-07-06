#!/usr/bin/env node
/**
 * Fetches (Windows) or builds (macOS) the small CPU `whisper-server` binary for
 * the current platform into resources/engine/<platform>-<arch>/, so the app can
 * bundle it and run transcription on-device without a separate server.
 *
 * Usage: npm run fetch-engine
 */
import { execSync } from 'child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const WHISPER_CPP_VERSION = 'v1.9.1';
const WIN_X64_ZIP = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_CPP_VERSION}/whisper-bin-x64.zip`;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = path.join(repoRoot, 'resources', 'engine', `${process.platform}-${process.arch}`);

async function downloadFile(url, dest) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  const stream = createWriteStream(dest);
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    await new Promise((resolve, reject) => stream.write(Buffer.from(value), (e) => (e ? reject(e) : resolve())));
  }
  await new Promise((resolve, reject) => stream.end((e) => (e ? reject(e) : resolve())));
}

async function setupWindows() {
  const tmp = path.join(os.tmpdir(), `vp-engine-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const zip = path.join(tmp, 'whisper-bin-x64.zip');
  await downloadFile(WIN_X64_ZIP, zip);
  execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force"`, { stdio: 'inherit' });
  const src = existsSync(path.join(tmp, 'Release')) ? path.join(tmp, 'Release') : tmp;
  const wanted = readdirSync(src).filter((n) => n === 'whisper-server.exe' || n === 'whisper.dll' || /^ggml.*\.dll$/i.test(n));
  if (!wanted.includes('whisper-server.exe')) throw new Error('whisper-server.exe not found');
  mkdirSync(targetDir, { recursive: true });
  for (const n of wanted) copyFileSync(path.join(src, n), path.join(targetDir, n));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Engine ready: ${targetDir}`);
}

function setupUnixBuild() {
  const tmp = path.join(os.tmpdir(), `vp-whispercpp-${Date.now()}`);
  console.log(`Building whisper.cpp ${WHISPER_CPP_VERSION} from source…`);
  execSync(`git clone --depth 1 --branch ${WHISPER_CPP_VERSION} https://github.com/ggml-org/whisper.cpp "${tmp}"`, { stdio: 'inherit' });
  execSync('cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_EXAMPLES=ON -DGGML_METAL_EMBED_LIBRARY=ON', { cwd: tmp, stdio: 'inherit' });
  execSync('cmake --build build --config Release -j --target whisper-server', { cwd: tmp, stdio: 'inherit' });
  const built = path.join(tmp, 'build', 'bin', 'whisper-server');
  if (!existsSync(built)) throw new Error('build finished but whisper-server missing');
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(built, path.join(targetDir, 'whisper-server'));
  execSync(`chmod +x "${path.join(targetDir, 'whisper-server')}"`);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Engine ready: ${targetDir}`);
}

try {
  if (process.platform === 'win32') await setupWindows();
  else if (process.platform === 'darwin' || process.platform === 'linux') setupUnixBuild();
  else throw new Error(`Unsupported platform: ${process.platform}`);
} catch (e) {
  console.error(`fetch-engine failed: ${e.message}`);
  process.exit(1);
}
