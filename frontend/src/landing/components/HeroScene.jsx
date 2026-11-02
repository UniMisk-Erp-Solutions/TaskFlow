import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * 3D backdrop for the home page. It sits behind the whole page and scrolling flies the camera down a corridor of glowing
 * rings and drifting particles. It is decorative (aria-hidden) and loaded lazily, so it never delays the text. It pauses when it is
 * off screen or the tab is hidden, follows the pointer slightly, and renders a single still frame when the visitor
 * prefers reduced motion. If WebGL is not available it calls `onFail` and the page keeps its CSS ring.
 */

const RING_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FRAG = `
uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uBase; uniform float uFade;
varying vec2 vUv;
void main() {
  float t = vUv.x - uTime * 0.045;
  float arc1 = pow(0.5 + 0.5 * sin(6.2831 * t), 4.0);
  float arc2 = pow(0.5 + 0.5 * sin(6.2831 * (t * 2.0 + 0.3)), 8.0);
  vec3 col = mix(uA, uB, arc1);
  float i = uBase + arc1 * 1.35 + arc2 * 0.9;
  gl_FragColor = vec4(col * i * uFade, clamp(i, 0.0, 1.0) * uFade);
}
`;
const PART_VERT = `
attribute float aSize; attribute float aPhase; attribute vec3 aColor;
uniform float uTime; uniform float uPixel;
varying vec3 vColor; varying float vTw;
void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.35 + aPhase * 6.2831) * 0.18;
  p.x += cos(uTime * 0.25 + aPhase * 12.0) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixel * (14.0 / -mv.z);
  vTw = 0.55 + 0.45 * sin(uTime * 1.4 + aPhase * 40.0);
  vColor = aColor;
}
`;
const PART_FRAG = `
varying vec3 vColor; varying float vTw;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * a * vTw);
}
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(70,90,255,0.55)');
  grad.addColorStop(0.45, 'rgba(60,70,220,0.18)');
  grad.addColorStop(1, 'rgba(40,50,200,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ringMaterial(a, b, base) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uBase: { value: base }, uFade: { value: 1 } },
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export default function HeroScene({ onReady, onFail, rings: showRings = true }) {
  const mountRef = useRef(null);
  // The rings are only wanted on the home page; the scene itself stays mounted while visitors move between pages.
  const ringsWanted = useRef(showRings);
  ringsWanted.current = showRings;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      onFail?.();
      return undefined;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const root = new THREE.Group();
    scene.add(root);
    const disposables = [];
    const track = (o) => { disposables.push(o); return o; };

    // Soft bloom that travels with the camera.
    const glowTex = track(glowTexture());
    const glowMat = track(new THREE.SpriteMaterial({ map: glowTex, depthWrite: false, blending: THREE.AdditiveBlending }));
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(14, 14, 1);
    root.add(glow);

    // Hero ring (faces the viewer) with a halo, plus a thin tilted ring that crosses it.
    const mainMat = track(ringMaterial(0x5b6cff, 0xa6e3ff, 0.18));
    const mainRing = new THREE.Mesh(track(new THREE.TorusGeometry(2.7, 0.028, 24, 220)), mainMat);
    const haloMat = track(ringMaterial(0x1c2370, 0x4a35a8, 0.0));
    const mainHalo = new THREE.Mesh(track(new THREE.TorusGeometry(2.7, 0.2, 24, 220)), haloMat);
    const rings = new THREE.Group();
    root.add(rings);
    const ringMats = [mainMat, haloMat];
    const ringGroup = new THREE.Group();
    ringGroup.add(mainRing, mainHalo);
    rings.add(ringGroup);

    const tiltMat = track(ringMaterial(0x8b5cf6, 0xc4a8ff, 0.12));
    const tiltRing = new THREE.Mesh(track(new THREE.TorusGeometry(3.35, 0.014, 16, 220)), tiltMat);
    tiltRing.rotation.x = 1.25;
    tiltRing.rotation.y = 0.35;
    rings.add(tiltRing);
    ringMats.push(tiltMat);

    // Gates down the corridor: scrolling flies the camera through each one.
    const gates = [-6, -12, -18].map((z, i) => {
      const m = track(ringMaterial(i % 2 ? 0x8b5cf6 : 0x5b6cff, i % 2 ? 0xd2b8ff : 0x9ad8ff, 0.2));
      const mesh = new THREE.Mesh(track(new THREE.TorusGeometry(3.3 + i * 0.25, 0.022, 16, 200)), m);
      mesh.position.z = z;
      mesh.rotation.z = i * 1.1;
      rings.add(mesh);
      ringMats.push(m);
      return { mesh, m };
    });

    // Particles fill the whole corridor.
    const mobile = window.innerWidth < 700;
    // Fewer particles on phones and on machines that report few cores or little memory.
    const weak = mobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    const COUNT = weak ? 420 : 900;
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const palette = [new THREE.Color(0x8aa4ff), new THREE.Color(0xb48cff), new THREE.Color(0xffffff), new THREE.Color(0x6ad4ff)];
    for (let i = 0; i < COUNT; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 17;
      pos[i * 3 + 2] = 8 - Math.random() * 34;
      const c = palette[(Math.random() * palette.length) | 0];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = 0.5 + Math.random() * 1.6;
      phase[i] = Math.random();
    }
    const pGeo = track(new THREE.BufferGeometry());
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    pGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    pGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const pMat = track(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixel: { value: dpr * 3.4 } },
      vertexShader: PART_VERT,
      fragmentShader: PART_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Sizing: keep the hero ring fully visible on narrow phones too.
    let z0 = 8.2;
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const halfH = Math.tan((camera.fov * Math.PI) / 360);
      // On a portrait phone let the ring spill past the screen edges so it fills the screen instead of floating small.
      const needW = camera.aspect < 0.8 ? 4.2 : 7.2;
      z0 = Math.max(camera.aspect < 0.8 ? 5.4 : 8.2, needW / (2 * halfH * camera.aspect));
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // Pointer parallax and scroll progress (0 at the top of the page, 1 at the bottom).
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const onPointer = (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    // Draw at full speed only while the visitor is scrolling or moving the pointer; otherwise ~30 fps is plenty.
    let activeUntil = 0;
    const markActive = () => { activeUntil = performance.now() + 400; };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointermove', markActive, { passive: true });
    window.addEventListener('scroll', markActive, { passive: true });
    const scrollProgress = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return Math.min(1, Math.max(0, window.scrollY / max));
    };
    let prog = reduced ? 0 : scrollProgress();

    let raf = 0;
    let running = false;
    let visible = true;
    let last = performance.now();
    let t = 0;
    let ringVis = ringsWanted.current ? 1 : 0;
    const tint = new THREE.Color();
    const blue = new THREE.Color(0x4a5cff);
    const violet = new THREE.Color(0x8b4cf6);

    const frame = (dt) => {
      t += dt;
      // Ease toward the real scroll position so the flight stays smooth when someone scrolls in jumps.
      if (!reduced) prog += (scrollProgress() - prog) * Math.min(1, dt * 5);
      const travel = 22;
      mainMat.uniforms.uTime.value = t;
      haloMat.uniforms.uTime.value = t;
      tiltMat.uniforms.uTime.value = t * 1.3;
      gates.forEach((gt, i) => { gt.m.uniforms.uTime.value = t + i * 3; gt.mesh.rotation.z += dt * (i % 2 ? -0.08 : 0.08); });
      pMat.uniforms.uTime.value = t;
      cur.x += (target.x - cur.x) * Math.min(1, dt * 2.2);
      cur.y += (target.y - cur.y) * Math.min(1, dt * 2.2);

      // The camera flies down the corridor as the page scrolls, with a little sway, roll and pointer parallax.
      camera.position.set(Math.sin(prog * 7) * 0.7 + cur.x * 0.55, Math.cos(prog * 5) * 0.4 - cur.y * 0.35, z0 - prog * travel);
      camera.rotation.set(-cur.y * 0.05, -cur.x * 0.06, prog * 0.5 + Math.sin(t * 0.15) * 0.015);
      glow.position.set(camera.position.x, camera.position.y, camera.position.z - 11);
      glowMat.color.copy(tint.copy(blue).lerp(violet, Math.min(1, prog * 1.6)));

      tiltRing.rotation.z = t * 0.07;
      ringGroup.rotation.z = t * 0.03;
      ringVis += ((ringsWanted.current ? 1 : 0) - ringVis) * Math.min(1, dt * 3);
      rings.visible = ringVis > 0.01;
      ringMats.forEach((m) => { m.uniforms.uFade.value = ringVis; });
      renderer.render(scene, camera);
    };

    let lastDraw = 0;
    // If frames are slow, first draw half the particles at 75% resolution; if it is still slow, switch the scene off
    // and leave the plain background (the page keeps working, just without the 3D).
    let slowStreak = 0;
    let quality = 2;
    const stepDown = () => {
      if (quality === 2) {
        quality = 1;
        pGeo.setDrawRange(0, Math.floor(COUNT / 2));
        renderer.setPixelRatio(0.75);
        renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1, false);
      } else {
        stop();
        renderer.domElement.style.display = 'none';
        onFail?.();
      }
      slowStreak = 0;
    };
    const loop = (now) => {
      if (!running) return;
      if (now > activeUntil && now - lastDraw < 48) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastDraw = now;
      const rawDt = (now - last) / 1000;
      const dt = Math.min(0.05, rawDt);
      last = now;
      frame(dt);
      // Only judge frames that were drawn at full speed (while scrolling or moving the pointer).
      if (now <= activeUntil && rawDt > 0.034) { slowStreak += 1; if (slowStreak > 45) stepDown(); } else if (slowStreak > 0) slowStreak -= 1;
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduced || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    frame(0.016);
    if (reduced) frame(4);
    onReady?.();
    start();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    });
    io.observe(mount);
    const onVis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointermove', markActive);
      window.removeEventListener('scroll', markActive);
      document.removeEventListener('visibilitychange', onVis);
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onReady, onFail]);

  return <div ref={mountRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}
