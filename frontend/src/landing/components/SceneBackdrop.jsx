import { lazy, Suspense, useCallback, useContext } from 'react';
import { SceneContext } from '../lib/sceneContext';

// Three.js is loaded on demand so it never delays the page text.
const HeroScene = lazy(() => import('./HeroScene.jsx'));

/**
 * The 3D scroll scene behind every marketing page. It is sticky inside its wrapper, so it stays on screen while the
 * page scrolls past and ends where the footer starts. `rings` is true only on the home page.
 */
export default function SceneBackdrop({ rings }) {
  const { setReady } = useContext(SceneContext);
  const onReady = useCallback(() => setReady(true), [setReady]);
  const onFail = useCallback(() => setReady(false), [setReady]);
  return (
    <div aria-hidden="true" style={{ position: 'sticky', top: 0, height: '100vh', zIndex: 0, pointerEvents: 'none' }}>
      <Suspense fallback={null}>
        <HeroScene rings={rings} onReady={onReady} onFail={onFail} />
      </Suspense>
    </div>
  );
}
