import { NoHydration } from 'solid-js'
import { getRequestEvent, renderToStream } from '@solidjs/web'
import manifest from 'virtual:solid-manifest'
import Document from 'virtual:devix/document'
import App from 'virtual:devix/app'

export function render(request: Request, context: { clientEntry?: string }) {
  return renderToStream(
    () => (
      <NoHydration>
        <Document>
          <App/>
        </Document>
      </NoHydration>
    ),
    {manifest, nonce: getRequestEvent()?.nonce ?? undefined}
  )
}