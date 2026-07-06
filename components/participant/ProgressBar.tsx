interface Props { steps: string[]; current: number }
export default function ProgressBar({ steps, current }: Props) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex-1">
          <div className={`h-1 rounded-full transition-all duration-300 ${i < current ? 'bg-brand' : i === current ? 'bg-brand/40' : 'bg-black/10'}`} />
        </div>
      ))}
      <span className="text-xs text-gray-400 whitespace-nowrap ml-1">{steps[current]}</span>
    </div>
  )
}
