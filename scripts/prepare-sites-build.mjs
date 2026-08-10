import { mkdir, readdir, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const buildDirectory = resolve('dist')
const clientDirectory = resolve(buildDirectory, 'client')
const serverDirectory = resolve('dist/server')
const workerEntry = `const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404 || request.method !== 'GET') {
      return response
    }

    const url = new URL(request.url)
    if (url.pathname.includes('.')) {
      return response
    }

    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request))
  },
}

export default worker
`

await mkdir(clientDirectory, { recursive: true })
const buildEntries = await readdir(buildDirectory)
for (const entry of buildEntries) {
  if (['.openai', 'client', 'server'].includes(entry)) {
    continue
  }

  await rename(
    resolve(buildDirectory, entry),
    resolve(clientDirectory, entry),
  )
}

await mkdir(serverDirectory, { recursive: true })
await writeFile(resolve(serverDirectory, 'index.js'), workerEntry)
