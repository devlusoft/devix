---
"@devlusoft/devix": major
---

## Breaking changes

- **Remove loader API**: the `loader` function and `loader()` route export have been removed.
  Use `query()` from `@devlusoft/devix/data` instead.
- **Remove `$server` backend proxy**: the `$server` directive has been removed.
  Use server functions via `action()` or external API routes.
- **Refactor query/cache architecture and routing guards**: internal pipeline rewrite for
  queries, cache, and route guards. Public APIs (`query`, `action`, `useQuery`,
  `invalidateQueries`, `useRevalidate`) are unchanged. If you depend on internals from
  `@devlusoft/devix/data/internal`, migrate before upgrading.

## Other changes

- Build pipeline migrated from `tsup` to `tsdown`.
- HTML streaming: optional tail injection and query hydration.
- `create-devix` templates and sources moved into `packages/create-devix/`.
- Router internals consolidated under `lib/router/` (manifest, codegen, middleware, plugin).
- Updated peer dependency: `vite@>=8.0.16`.
- Updated internal deps: `esbuild@0.28.1`, `hono@4.12.26` (security advisories).
