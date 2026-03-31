import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'

import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'

function matchesAcceptRule(file: File, acceptRule: string) {
  const normalizedRule = acceptRule.trim().toLowerCase()

  if (!normalizedRule) {
    return true
  }

  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()

  if (normalizedRule.startsWith('.')) {
    return fileName.endsWith(normalizedRule)
  }

  if (normalizedRule.endsWith('/*')) {
    const baseType = normalizedRule.slice(0, -1)
    return fileType.startsWith(baseType)
  }

  return fileType === normalizedRule
}

function filterAcceptedFiles(fileList: FileList | File[], accept: string) {
  const files = Array.from(fileList)
  const acceptRules = accept
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean)

  if (acceptRules.length === 0) {
    return { acceptedFiles: files, rejectedFiles: [] as File[] }
  }

  const acceptedFiles: File[] = []
  const rejectedFiles: File[] = []

  for (const file of files) {
    if (acceptRules.some((rule) => matchesAcceptRule(file, rule))) {
      acceptedFiles.push(file)
      continue
    }

    rejectedFiles.push(file)
  }

  return { acceptedFiles, rejectedFiles }
}

export function FileInputField({
  id,
  label,
  hint,
  accept,
  multiple = false,
  filesLabel,
  mode = 'dropzone',
  onFilesSelected,
}: {
  id: string
  label: string
  hint?: string
  accept: string
  multiple?: boolean
  filesLabel: string
  mode?: 'dropzone' | 'compact'
  onFilesSelected: (files: FileList | File[]) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const acceptedLabel = accept.split(',').join(' ')

  function applySelection(fileList: FileList | File[]) {
    const { acceptedFiles, rejectedFiles } = filterAcceptedFiles(fileList, accept)

    if (rejectedFiles.length > 0) {
      setValidationMessage(
        `Ignored unsupported file${rejectedFiles.length > 1 ? 's' : ''}: ${rejectedFiles
          .map((file) => file.name)
          .join(', ')}.`,
      )
    } else {
      setValidationMessage('')
    }

    if (acceptedFiles.length > 0) {
      onFilesSelected(acceptedFiles)
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    if (event.dataTransfer.files.length > 0) {
      applySelection(event.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {mode === 'compact' ? (
        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{acceptedLabel}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-4" />
              Choose {multiple ? 'files' : 'file'}
            </Button>
          </div>
          <div className="mt-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Selected
            </p>
            <p className="mt-1 break-words text-xs leading-5 text-foreground/90">{filesLabel}</p>
          </div>
          {hint ? <p className="mt-3 text-xs leading-5 text-muted-foreground/80">{hint}</p> : null}
          <input
            ref={inputRef}
            id={id}
            className="sr-only"
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(event) => {
              if (event.target.files) {
                applySelection(event.target.files)
              }
            }}
          />
          {validationMessage ? (
            <p className="mt-3 text-xs leading-5 text-amber-300">{validationMessage}</p>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            'rounded-2xl border border-dashed bg-background/60 p-4 transition-all',
            isDragging
              ? 'border-primary/70 bg-primary/10 shadow-lg shadow-primary/10 ring-2 ring-primary/30'
              : 'border-border/60 hover:border-primary/40 hover:bg-background/80',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <button
            type="button"
            className="flex w-full flex-col items-center justify-center rounded-[20px] border border-border/50 bg-card/40 px-5 py-8 text-center transition hover:bg-card/60"
            onClick={() => inputRef.current?.click()}
          >
            <div
              className={cn(
                'mb-4 flex size-12 items-center justify-center rounded-full border transition-colors',
                isDragging
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border/60 bg-background/80 text-muted-foreground',
              )}
            >
              <FileUp className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Drag and drop file{multiple ? 's' : ''} here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or click to browse {multiple ? 'your files' : 'a file'}
            </p>
            <p className="mt-3 text-[0.7rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Accepted: {acceptedLabel}
            </p>
          </button>
          <input
            ref={inputRef}
            id={id}
            className="sr-only"
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(event) => {
              if (event.target.files) {
                applySelection(event.target.files)
              }
            }}
          />
          <div className="mt-4 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Selected
            </p>
            <p className="mt-1 break-words text-xs leading-5 text-foreground/90">{filesLabel}</p>
          </div>
          {validationMessage ? (
            <p className="mt-3 text-xs leading-5 text-amber-300">{validationMessage}</p>
          ) : null}
          {hint ? <p className="mt-3 text-xs leading-5 text-muted-foreground/80">{hint}</p> : null}
        </div>
      )}
    </div>
  )
}
