import { query } from '@devlusoft/devix/data'
import { getTasks, getTask } from './store.js'

export const getTasksQuery = query(
  async () => getTasks(),
  'tasks:list',
)

export const getTaskQuery = query(
  async (id: string) => getTask(id) ?? null,
  'tasks:get',
)