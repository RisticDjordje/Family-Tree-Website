import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PluginOption } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, 'data');
const snapshotsDir = path.resolve(dataDir, 'snapshots');

function familyDataPlugin(): PluginOption {
  return {
    name: 'family-data',
    configureServer(server) {
      // Ensure directories exist on server start
      fs.mkdirSync(dataDir, { recursive: true });
      fs.mkdirSync(snapshotsDir, { recursive: true });

      server.middlewares.use((req, res, next) => {
        // GET /api/data — read the main data file
        if (req.url === '/api/data' && req.method === 'GET') {
          const filePath = path.join(dataDir, 'family-tree.json');
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(filePath, 'utf-8'));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'no data file' }));
          }
          return;
        }

        // POST /api/data — write the main data file
        if (req.url === '/api/data' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => (body += chunk.toString()));
          req.on('end', () => {
            fs.writeFileSync(path.join(dataDir, 'family-tree.json'), body);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          });
          return;
        }

        // POST /api/snapshot — save a timestamped snapshot
        if (req.url === '/api/snapshot' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => (body += chunk.toString()));
          req.on('end', () => {
            const d = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
            const filename = `family.snapshot.${ts}.json`;
            fs.writeFileSync(path.join(snapshotsDir, filename), body);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, filename }));
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), familyDataPlugin()],
});
