import { action, query } from '@devlusoft/devix/data'

export type Project = {
  id: string
  name: string
  description: string
}

export type TaskStatus = 'todo' | 'in-progress' | 'done'

export type Task = {
  id: string
  projectId: string
  title: string
  description: string
  status: TaskStatus
  assignee: string
}

let nextProjectId = 3
let nextTaskId = 6

const projects: Project[] = [
  { id: '1', name: 'Website Redesign', description: 'New marketing site for devix.' },
  { id: '2', name: 'Mobile App', description: 'React Native prototype for clients.' },
]

const tasks: Task[] = [
  {
    id: '1',
    projectId: '1',
    title: 'Design landing page',
    description: 'Create Figma mockups.',
    status: 'done',
    assignee: 'Alice',
  },
  {
    id: '2',
    projectId: '1',
    title: 'Implement router',
    description: 'File-based routing with nested layouts.',
    status: 'in-progress',
    assignee: 'Bob',
  },
  {
    id: '3',
    projectId: '2',
    title: 'Setup navigation',
    description: 'Bottom tabs and stack navigation.',
    status: 'todo',
    assignee: 'Carol',
  },
  {
    id: '4',
    projectId: '2',
    title: 'Login screen',
    description: 'Email and password form.',
    status: 'in-progress',
    assignee: 'Alice',
  },
  {
    id: '5',
    projectId: '2',
    title: 'Push notifications',
    description: 'Request permission and handle token.',
    status: 'todo',
    assignee: 'Bob',
  },
]

export const getProjects = query(() => [...projects], 'get-projects')
export const getProject = query((id: string) => projects.find((p) => p.id === id), 'get-project')

export const getTasks = query((projectId?: string) => {
  if (!projectId) return [...tasks]
  return tasks.filter((t) => t.projectId === projectId)
}, 'get-tasks')

export const getTask = query((id: string) => tasks.find((t) => t.id === id), 'get-task')

export const createProject = action(async (input: Omit<Project, 'id'>) => {
  const project: Project = { id: String(nextProjectId++), ...input }
  projects.push(project)
  return project
})

export const updateProject = action(async (id: string, input: Partial<Omit<Project, 'id'>>) => {
  const project = projects.find((p) => p.id === id)
  if (!project) throw new Error(`Project ${id} not found`)
  Object.assign(project, input)
  return project
})

export const deleteProject = action(async (id: string) => {
  const index = projects.findIndex((p) => p.id === id)
  if (index === -1) throw new Error(`Project ${id} not found`)
  projects.splice(index, 1)
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].projectId === id) tasks.splice(i, 1)
  }
  return { success: true }
})

export const createTask = action(async (input: Omit<Task, 'id'>) => {
  const task: Task = { id: String(nextTaskId++), ...input }
  tasks.push(task)
  return task
})

export const updateTask = action(async (id: string, input: Partial<Omit<Task, 'id'>>) => {
  const task = tasks.find((t) => t.id === id)
  if (!task) throw new Error(`Task ${id} not found`)
  Object.assign(task, input)
  return task
})

export const deleteTask = action(async (id: string) => {
  const index = tasks.findIndex((t) => t.id === id)
  if (index === -1) throw new Error(`Task ${id} not found`)
  tasks.splice(index, 1)
  return { success: true }
})
