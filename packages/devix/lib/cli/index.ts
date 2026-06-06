export type Command = 'dev' | 'build'

export function parseCommand(argv: string[]): Command {
  const cmd = argv[0]
  if (cmd === undefined) return 'dev'
  if (cmd === 'dev' || cmd === 'build') return cmd
  throw new Error(`Unknown command: ${cmd}. Usage: devix [dev|build]`)
}
