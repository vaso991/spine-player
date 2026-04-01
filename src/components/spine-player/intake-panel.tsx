import { Play, Upload } from 'lucide-react';

import { Button } from '../ui/button';
import { FileInputField } from './file-input-field';
import { SectionCard } from './shared';
import type { SelectedFiles } from './types';

export function IntakePanel({
  files,
  status,
  error,
  canLoad,
  loading,
  onApplyCombinedFiles,
  onAtlasSelected,
  onSkeletonSelected,
  onImagesSelected,
  onLoad,
}: {
  files: SelectedFiles
  status: string
  error: string
  canLoad: boolean
  loading: boolean
  onApplyCombinedFiles: (files: FileList | File[]) => void
  onAtlasSelected: (files: FileList | File[]) => void
  onSkeletonSelected: (files: FileList | File[]) => void
  onImagesSelected: (files: FileList | File[]) => void
  onLoad: () => void
}) {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <SectionCard
        icon={Upload}
        title="Asset Intake"
        description="Load your atlas, skeleton binary, and page textures."
      >
        <div className="space-y-4">
          <FileInputField
            id="all-spine-files"
            label="All Spine files"
            accept=".atlas,.skel,.png,text/plain,application/octet-stream,image/png"
            multiple
            filesLabel={[
              files.atlas?.name,
              files.skeleton?.name,
              ...files.images.map((file) => file.name),
            ]
              .filter(Boolean)
              .join(', ') || 'No files selected'}
            hint="Select the full export in one pass. The player auto-detects `.atlas`, `.skel`, and `.png`."
            onFilesSelected={onApplyCombinedFiles}
          />

          <div className="rounded-[24px] border border-border/60 bg-background/50 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Manual file assignment</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Use these only if you want to replace one part of the export instead of dropping everything at once.
                </p>
              </div>
              <div className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Optional
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <FileInputField
                id="atlas-file"
                label="Atlas file"
                accept=".atlas,text/plain"
                mode="compact"
                filesLabel={files.atlas?.name ?? 'No atlas selected'}
                onFilesSelected={onAtlasSelected}
              />

              <FileInputField
                id="skeleton-file"
                label="Skeleton binary"
                accept=".skel,application/octet-stream"
                mode="compact"
                filesLabel={files.skeleton?.name ?? 'No .skel selected'}
                onFilesSelected={onSkeletonSelected}
              />

              <FileInputField
                id="atlas-images"
                label="Atlas PNG pages"
                accept=".png,image/png"
                multiple
                mode="compact"
                filesLabel={
                  files.images.length > 0
                    ? files.images.map((file) => file.name).join(', ')
                    : 'No PNG selected'
                }
                onFilesSelected={onImagesSelected}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
            <p className="text-sm font-medium text-foreground">{status}</p>
            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          </div>

          <Button
            className="h-11 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            disabled={!canLoad}
            onClick={onLoad}
          >
            <Play className="size-4" />
            {loading ? 'Loading…' : 'Load demo'}
          </Button>
        </div>
      </SectionCard>
    </section>
  );
}
