import { query } from '@devlusoft/devix/data'

const users = new Map<string, { id: string; name: string }>([
  ['1', { id: '1', name: 'Alice' }],
  ['2', { id: '2', name: 'Bob' }],
  ['3', { id: '3', name: 'Carol' }],
])

export const listUsers = query(async () => Array.from(users.values()), 'list-users')

export const getUser = query(async (id: string) => {
  const u = users.get(id)
  if (!u) throw new Error(`User ${id} not found`)
  return u
}, 'get-user')
