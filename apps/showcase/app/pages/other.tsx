import { Title } from '@devlusoft/devix/head'

throw new Error('intentional top-level error in other.tsx')

export default function OtherPage() {
  return (
    <div>
      <Title>Other - Devix Showcase</Title>
      <h1 class="text-2xl font-semibold">Other page</h1>
    </div>
  )
}
