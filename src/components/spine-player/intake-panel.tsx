import { Play, Upload } from 'lucide-react';

import { Button } from '../ui/button';
import { FileInputField } from './file-input-field';
import { SectionCard } from './shared';
import { SPINE_VERSIONS, type SpineVersion } from '../../lib/spine-runtime';
import type { SelectedFiles } from './types';

export function IntakePanel({
  files,
  spineVersion,
  onSpineVersionChange,
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
  spineVersion: SpineVersion
  onSpineVersionChange: (version: SpineVersion) => void
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
        description="Load your atlas, skeleton (.skel or .json), and page textures."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <p className={error ? 'mt-2 text-sm font-medium text-foreground' : 'text-sm font-medium text-foreground'}>
              {status}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
            <p className="text-sm font-semibold text-foreground">Spine runtime version</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Pick the Spine editor version the assets were exported with. Binary and JSON exports are not
              compatible across 4.2 and 4.3.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Spine runtime version">
              {SPINE_VERSIONS.map((version) => (
                <Button
                  key={version}
                  type="button"
                  role="radio"
                  aria-checked={spineVersion === version}
                  variant={spineVersion === version ? 'default' : 'outline'}
                  className="rounded-xl"
                  disabled={loading}
                  onClick={() => onSpineVersionChange(version)}
                >
                  Spine {version}
                </Button>
              ))}
            </div>
          </div>

          <FileInputField
            id="all-spine-files"
            label="All Spine files"
            accept=".atlas,.skel,.json,.png,.webp,text/plain,application/octet-stream,application/json,image/png,image/webp"
            multiple
            filesLabel={[
              files.atlas?.name,
              files.skeleton?.name,
              ...files.images.map((file) => file.name),
            ]
              .filter(Boolean)
              .join(', ') || 'No files selected'}
            hint="Select the full export in one pass. The player auto-detects `.atlas`, `.skel`/`.json`, and `.png`/`.webp`."
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
                label="Skeleton (.skel or .json)"
                accept=".skel,.json,application/octet-stream,application/json"
                mode="compact"
                filesLabel={files.skeleton?.name ?? 'No skeleton selected'}
                onFilesSelected={onSkeletonSelected}
              />

              <FileInputField
                id="atlas-images"
                label="Atlas image pages"
                accept=".png,.webp,image/png,image/webp"
                multiple
                mode="compact"
                filesLabel={
                  files.images.length > 0
                    ? files.images.map((file) => file.name).join(', ')
                    : 'No image selected'
                }
                onFilesSelected={onImagesSelected}
              />
            </div>
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
