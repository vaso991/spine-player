import { Application as PixiApplication, useApplication, useExtend } from '@pixi/react';
import { type Application, Container } from 'pixi.js';
import { useEffect, useRef, type RefObject } from 'react';

import type { LoadedScene } from './types';

function StageContents({
  scene,
}: {
  scene: LoadedScene | null
}) {
  const { app } = useApplication();
  const containerRef = useRef<Container | null>(null);

  useExtend({ Container });

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.removeChildren();

    if (!scene || scene.app !== app) {
      return;
    }

    container.addChild(scene.spine);
    container.addChild(scene.debugBounds);
    container.addChild(scene.debugAnchor);

    return () => {
      if (scene.spine.parent === container) {
        container.removeChild(scene.spine);
      }

      if (scene.debugBounds.parent === container) {
        container.removeChild(scene.debugBounds);
      }

      if (scene.debugAnchor.parent === container) {
        container.removeChild(scene.debugAnchor);
      }
    };
  }, [app, scene]);

  return <pixiContainer ref={containerRef} />;
}

export function PixiStage({
  viewportRef,
  scene,
  onAppInit,
}: {
  viewportRef: RefObject<HTMLDivElement | null>
  scene: LoadedScene | null
  onAppInit: (app: Application) => void
}) {
  return (
    <PixiApplication
      className="h-full w-full"
      resizeTo={viewportRef}
      antialias
      backgroundAlpha={0}
      onInit={onAppInit}
    >
      <StageContents scene={scene} />
    </PixiApplication>
  );
}
