export async function build(): Promise<void> {
  throw new Error(
    'devix build: production SSR build is not yet implemented. ' +
      'Use `devix dev` for local SSR development.',
  )
}
