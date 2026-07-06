import { ReactNode } from 'react'

interface Props {
  Icon: React.ComponentType<{ size?: number; color?: string }>
  children: ReactNode
}

export default function TabLabel({ Icon, children }: Props) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon size={16} />
      {children}
    </span>
  )
}
