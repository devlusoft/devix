/// <reference types="@solidjs/web" />
/// <reference types="@solidjs/vite-plugin/virtual-solid-manifest" />

declare module 'virtual:devix/app' {
  const App: () => JSX.Element
  export default App
}

declare module 'virtual:devix/document' {
  const Document: (props: { children: JSX.Element }) => JSX.Element
  export default Document
}
