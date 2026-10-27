/**
 * E2E 用に、ビルド済みの SPA（dist/spa）を配る。Playwright の webServer から `bun` で起動する。
 *
 * 依存を増やさないよう標準の http で書く。ルーターは hash モードなので、ファイルが無い
 * パス（`/` を含む）には index.html を返せば足りる。
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/spa/', import.meta.url));
const port = Number(process.env.E2E_PORT ?? '4173');

/** 配るファイルの種類。ビルドに出てくるものだけ */
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** root の外を指すパスは配らない */
const resolveFile = (pathname: string): string =>
  join(root, normalize(pathname).replace(/^[./\\]+/, ''));

const read = async (path: string): Promise<Buffer | undefined> => {
  try {
    return await readFile(path);
  } catch {
    return undefined;
  }
};

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const path = resolveFile(pathname);

  void (async () => {
    const found = extname(path) === '' ? undefined : await read(path);
    const body = found ?? (await read(join(root, 'index.html')));
    const type = found == undefined ? contentTypes['.html'] : contentTypes[extname(path)];

    response.writeHead(body == undefined ? 404 : 200, {
      'content-type': type ?? 'application/octet-stream',
    });
    response.end(body);
  })();
}).listen(port);
