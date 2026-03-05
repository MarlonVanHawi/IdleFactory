import { promises as fs } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

function docsSavePlugin() {
  return {
    name: 'docs-save-endpoint',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url !== '/__docs/save-gameplay-data') {
          next()
          return
        }
        try {
          const chunks = []
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk))
          }
          const bodyText = Buffer.concat(chunks).toString('utf8')
          const payload = JSON.parse(bodyText)
          const rawJson = payload?.rawJson
          if (typeof rawJson !== 'string') {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'Missing rawJson string.' }))
            return
          }

          JSON.parse(rawJson)
          const targetFile = path.resolve(process.cwd(), 'new-game', 'docs', 'gameplay-data.json')
          await fs.writeFile(targetFile, `${rawJson.trim()}\n`, 'utf8')

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [docsSavePlugin()],
})
