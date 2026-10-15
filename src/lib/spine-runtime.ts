import { extensions } from 'pixi.js';

import type * as SpineRuntime42 from 'spine-pixi-v8-4-2';

export type SpineVersion = '4.2' | '4.3';

// 4.2 and 4.3 expose the same API surface the player uses, so 4.2 supplies the types.
export type SpineRuntime = typeof SpineRuntime42;

export const SPINE_VERSIONS: SpineVersion[] = ['4.2', '4.3'];
export const DEFAULT_SPINE_VERSION: SpineVersion = '4.2';

type RuntimeEntry = {
  runtime: SpineRuntime
  pipe: Parameters<typeof extensions.add>[0]
  batcher: Parameters<typeof extensions.add>[0]
};

const entries = new Map<SpineVersion, RuntimeEntry>();
let activeVersion: SpineVersion | null = null;

async function importRuntime(version: SpineVersion): Promise<RuntimeEntry> {
  if (version === '4.3') {
    const [runtime, batcher] = await Promise.all([
      import('spine-pixi-v8-4-3'),
      import('spine-pixi-v8-4-3/dist/darktint/DarkTintBatcher.js'),
    ]);

    return {
      runtime: runtime as unknown as SpineRuntime,
      pipe: runtime.SpinePipe,
      batcher: batcher.DarkTintBatcher,
    };
  }

  const [runtime, batcher] = await Promise.all([
    import('spine-pixi-v8-4-2'),
    import('spine-pixi-v8-4-2/dist/darktint/DarkTintBatcher.js'),
  ]);

  return {
    runtime,
    pipe: runtime.SpinePipe,
    batcher: batcher.DarkTintBatcher,
  };
}

/**
 * Loads the requested spine-pixi-v8 runtime on demand and makes its Pixi render pipe and
 * dark-tint batcher the active ones. Both runtimes register under the same names, so the
 * previous version's extensions are removed. Pixi captures them when an Application is
 * created, so call this before the Application is mounted.
 */
export async function loadSpineRuntime(version: SpineVersion): Promise<SpineRuntime> {
  let entry = entries.get(version);

  if (!entry) {
    entry = await importRuntime(version);
    entries.set(version, entry);
  }

  if (activeVersion !== version) {
    for (const other of entries.values()) {
      extensions.remove(other.pipe, other.batcher);
    }

    extensions.add(entry.pipe, entry.batcher);
    activeVersion = version;
  }

  return entry.runtime;
}
