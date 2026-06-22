import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

const apiRoute = '/api/framewright/chat/completions'

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8')
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}') as Record<string, unknown>)
      } catch {
        reject(new Error('Invalid JSON request body.'))
      }
    })
    request.on('error', reject)
  })
}

function writeJson(response: ServerResponse, status: number, payload: Record<string, unknown>) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function proxyChatCompletion(request: IncomingMessage, response: ServerResponse) {
  if (request.method === 'OPTIONS') {
    response.statusCode = 204
    response.end()
    return
  }

  if (request.method !== 'POST') {
    writeJson(response, 405, { error: 'Method not allowed.' })
    return
  }

  try {
    const payload = await readJsonBody(request)
    const baseUrl = typeof payload.baseUrl === 'string' ? payload.baseUrl.replace(/\/$/, '') : ''
    const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey : ''
    const model = typeof payload.model === 'string' ? payload.model : ''
    const messages = Array.isArray(payload.messages) ? payload.messages : []

    if (!baseUrl || !apiKey || !model || messages.length === 0) {
      writeJson(response, 400, { error: 'Missing baseUrl, apiKey, model, or messages.' })
      return
    }

    const providerResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: payload.stream !== false,
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.7,
      }),
    })

    response.statusCode = providerResponse.status
    response.setHeader(
      'Content-Type',
      providerResponse.headers.get('content-type') || 'text/event-stream; charset=utf-8',
    )
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')

    if (!providerResponse.body) {
      response.end(await providerResponse.text())
      return
    }

    const reader = providerResponse.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      response.write(Buffer.from(value))
    }
    response.end()
  } catch (error) {
    writeJson(response, 502, {
      error: error instanceof Error ? error.message : 'Local API proxy failed.',
    })
  }
}

function framewrightApiProxy() {
  return {
    name: 'framewright-api-proxy',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(apiRoute, (request, response) => {
        void proxyChatCompletion(request, response)
      })
    },
    configurePreviewServer(server: import('vite').PreviewServer) {
      server.middlewares.use(apiRoute, (request, response) => {
        void proxyChatCompletion(request, response)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), framewrightApiProxy()],
})
