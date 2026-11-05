// Maps Supabase-style /rest/v1/* paths onto a bare PostgREST server, so the
// real supabase-js client (and rls-check.ts) can talk to a local container.
import http from 'node:http'
const target = new URL(process.argv[2] ?? 'http://localhost:3300')
const port = Number(process.argv[3] ?? 54399)
http
  .createServer((req, res) => {
    const path = req.url.replace(/^\/rest\/v1/, '') || '/'
    const p = http.request(
      {
        host: target.hostname,
        port: target.port,
        path,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      },
    )
    p.on('error', () => res.writeHead(502).end())
    req.pipe(p)
  })
  .listen(port, () => console.log(`proxy :${port} -> ${target}`))
