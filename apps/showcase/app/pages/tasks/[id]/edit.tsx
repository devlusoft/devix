import { Suspense } from 'react'
import {
  useQuery,
  useNavigate,
  invalidateQueries,
  type Metadata,
  type PageProps,
} from '@devlusoft/devix'
import { updateTask, type Task, type TaskStatus } from '../../../../lib/store.js'
import { getTaskQuery } from '../../../../lib/queries.js'
import { TaskDetailSkeleton } from '../../../components/TaskListSkeleton.js'

export const metadata: Metadata = {
  title: 'Edit task - Devix Showcase',
}

function TaskEditor({ id }: { id: string }) {
  const task = useQuery(getTaskQuery(id))
  const navigate = useNavigate()

  if (!task) {
    return (
      <main className="container">
        <h1>Task not found</h1>
      </main>
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await updateTask(task!.id, {
      title: String(fd.get('title') ?? '').trim(),
      description: String(fd.get('description') ?? '').trim(),
      status: String(fd.get('status') ?? 'todo') as TaskStatus,
    })
    invalidateQueries()
    navigate('/')
  }

  return (
    <main className="container">
      <h1>Edit task</h1>
      <form onSubmit={onSubmit}>
        <input name="title" defaultValue={task.title} required />
        <textarea name="description" defaultValue={task.description} required />
        <select name="status" defaultValue={task.status}>
          <option value="todo">Todo</option>
          <option value="in-progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <button type="submit">Save</button>
      </form>
    </main>
  )
}

export default function EditTask({ params }: PageProps<{ id: string }>) {
  return (
    <Suspense fallback={<TaskDetailSkeleton />}>
      <TaskEditor id={params.id} />
    </Suspense>
  )
}