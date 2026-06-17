import { action } from '@devlusoft/devix/data'

export type TaskStatus = 'todo' | 'in-progress' | 'done'

export type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
}

const tasks: Task[] = [
  {
    id: '1',
    title: 'Set up devix',
    description: 'Install deps and run dev server',
    status: 'done',
  },
  {
    id: '2',
    title: 'Wire the new action() primitive',
    description: 'Declare, transform, RPC, run on server',
    status: 'in-progress',
  },
  {
    id: '3',
    title: 'Build a form that calls action()',
    description: 'Use createTask from the client, see it land in the store',
    status: 'todo',
  },
]

let nextId = 4

export function getTasks(): Task[] {
  return [...tasks]
}

export function getTask(id: string): Task | undefined {
  return tasks.find((t) => t.id === id)
}

export const createTask = action(
  async (input: { title: string; description: string }): Promise<Task> => {
    const task: Task = {
      id: String(nextId++),
      title: input.title,
      description: input.description,
      status: 'todo',
    }
    tasks.push(task)
    return task
  },
)

export const updateTask = action(
  async (id: string, input: Partial<Omit<Task, 'id'>>): Promise<Task> => {
    const task = tasks.find((t) => t.id === id)
    if (!task) throw new Error(`Task ${id} not found`)
    Object.assign(task, input)
    return task
  },
)

export const deleteTask = action(
  async (id: string): Promise<{ ok: true }> => {
    const index = tasks.findIndex((t) => t.id === id)
    if (index === -1) throw new Error(`Task ${id} not found`)
    tasks.splice(index, 1)
    return { ok: true }
  },
)
