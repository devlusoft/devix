interface ServerEntryOptions {
    routesPath: string
    envPath: string
}

export function generateServerEntry({ routesPath, envPath }: ServerEntryOptions): string {
    return `
import { readFileSync } from 'node:fs'
  import { serve } from '@hono/node-server'                                                                   
  import { serveStatic } from '@hono/node-server/serve-static'
  import { Hono } from 'hono'                                                                                 
  import { resolve, join, dirname } from 'node:path'                                                          
  import { fileURLToPath, pathToFileURL } from 'node:url'
  import { registerApiRoutes, registerSsrRoute } from '${routesPath}'                                         
  import { loadDotenv } from '${envPath}'
                                                                                                              
  loadDotenv('production')
                                                                                                              
  const __dir = dirname(fileURLToPath(import.meta.url))

  let renderModule, apiModule, manifest, runtimeConfig                                                        
   
  try {                                                                                                       
      runtimeConfig = JSON.parse(readFileSync(resolve(__dir, '../devix.config.json'), 'utf-8'))
      if (runtimeConfig.output !== 'static') {                                                                
          renderModule = await import(pathToFileURL(resolve(__dir, 'render.js')).href)
          apiModule = await import(pathToFileURL(resolve(__dir, 'api.js')).href)                              
      }           
      manifest = JSON.parse(readFileSync(resolve(__dir, '../client/.vite/manifest.json'), 'utf-8'))           
  } catch {                                                                                                   
      console.error('[devix] Build not found. Run "devix build" first.')
      process.exit(1)                                                                                         
  }               
                                                                                                              
  const port = Number(process.env.PORT) || runtimeConfig.port || 3000                                         
  const host = typeof runtimeConfig.host === 'string'
      ? runtimeConfig.host                                                                                    
      : runtimeConfig.host ? '0.0.0.0' : (process.env.HOST || '0.0.0.0')                                      
   
  const clientRoot = resolve(__dir, '../client')                                                              
  const app = new Hono()
                                                                                                              
  if (runtimeConfig.output === 'static') {
      app.get('/_data/*', (c) => {
          const pathname = c.req.path.replace(/^\\/_data/, '') || '/'                                         
          const filePath = pathname === '/'                                                                   
              ? join(clientRoot, '_data/index.json')                                                          
              : join(clientRoot, '_data', pathname + '.json')                                                 
          try {                                                                                               
              return c.json(JSON.parse(readFileSync(filePath, 'utf-8')))
          } catch {                                                                                           
              return c.json({ error: 'not found' }, 404)
          }                                                                                                   
      })          
  }

  app.use('/*', serveStatic({                                                                                 
      root: clientRoot,
      onFound: (_path, c) => {                                                                                
          c.header('Cache-Control', _path.includes('/assets/')                                                
              ? 'public, immutable, max-age=31536000'
              : 'no-cache')                                                                                   
      }           
  }))                                                                                                         
                  
  if (runtimeConfig.output === 'static') {
      console.log('[devix] Static mode — serving pre-generated files from dist/client')
  } else {                                                                                                    
      registerApiRoutes(app, { renderModule, apiModule, manifest })
      registerSsrRoute(app, { renderModule, apiModule, manifest, loaderTimeout: runtimeConfig.loaderTimeout })
  }                                                                                                           
   
  const server = serve({ fetch: app.fetch, port, hostname: host }, (info) =>                                  
      console.log(\`http://\${info.address}:\${info.port}\`))

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
`
}