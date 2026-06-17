import {
  useLoaderData,
  useNavigate,
  type LoaderFunction,
  type Metadata,
} from '@devlusoft/devix'
import { getTask, updateTask, type Task, type TaskStatus } from '../../../../lib/store.js'

export const metadata: Metadata = {
  title: 'Edit task - Devix Showcase',
}

export const loader: LoaderFunction = async ({ params }) => {
  const task = getTask(String(params.id))
  if (!task) throw new Error(`Task ${params.id} not found`)
  return { task }
}

export default function EditTask() {
  const { task } = useLoaderData<{ task: Task }>()
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await updateTask(task.id, {
      title: String(fd.get('title') ?? '').trim(),
      description: String(fd.get('description') ?? '').trim(),
      status: String(fd.get('status') ?? 'todo') as TaskStatus,
    })
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
