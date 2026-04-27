'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SceneProps {
  imageUrl: string;
  primaryColor: string;
  accentColor: string;
}

/**
 * Real 3D billboard of the product cutout, with two helical airflow particle
 * streams emerging from the lateral vents. Drag to rotate, idle drift, soft
 * accent-coloured rim glow that hints at the LED screen. Used by the
 * ProductShowcase primitive — never embed directly in a page; go through the
 * primitive so the dark gradient frame stays consistent across stores.
 */
export function Product3DScene({ imageUrl, primaryColor, accentColor }: SceneProps) {
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, vx: 0, vy: 0 });
  const rotation = useRef({ x: 0, y: 0 });

  // Pointer tracking lives on the host div so the canvas itself can stay
  // GPU-pure. The values flow into Product/Airflow via refs.
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current.active = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    dragRef.current.vx = dx * 0.005;
    dragRef.current.vy = dy * 0.003;
  };
  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5.6], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <SceneBody
          imageUrl={imageUrl}
          primaryColor={primaryColor}
          accentColor={accentColor}
          dragRef={dragRef}
          rotation={rotation}
        />
      </Canvas>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface BodyProps extends SceneProps {
  dragRef: React.MutableRefObject<{ active: boolean; lastX: number; lastY: number; vx: number; vy: number }>;
  rotation: React.MutableRefObject<{ x: number; y: number }>;
}

function SceneBody({ imageUrl, primaryColor, accentColor, dragRef, rotation }: BodyProps) {
  // Pull the renderer once so we can configure colour management properly.
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 2, 4]} intensity={1.1} color={accentColor} />
      <pointLight position={[-3, -1, 4]} intensity={0.55} color={primaryColor} />
      <Suspense fallback={null}>
        <Product url={imageUrl} dragRef={dragRef} rotation={rotation} accentColor={accentColor} />
      </Suspense>
      <Airflow side="right" color={accentColor} />
      <Airflow side="left" color={accentColor} />
    </>
  );
}

/* ------------------------------------------------------------------ */

interface ProductProps {
  url: string;
  dragRef: BodyProps['dragRef'];
  rotation: BodyProps['rotation'];
  accentColor: string;
}

function Product({ url, dragRef, rotation, accentColor }: ProductProps) {
  const tex = useLoader(THREE.TextureLoader, url);
  // Texture is a transparent PNG in sRGB.
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);

  // Cutout is 790x790 → square plane. Size 3.6 fills our 32deg fov nicely.
  const SIZE = 3.6;

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;

    // Accumulate momentum from drag, decay smoothly.
    rotation.current.y += dragRef.current.vx;
    rotation.current.x += dragRef.current.vy;
    dragRef.current.vx *= 0.92;
    dragRef.current.vy *= 0.92;

    // Idle: slow oscillation around current rotation when no drag active.
    const idleY = Math.sin(t * 0.45) * 0.18;
    const idleX = Math.sin(t * 0.3) * 0.06;
    const targetY = dragRef.current.active ? rotation.current.y : rotation.current.y + idleY;
    const targetX = dragRef.current.active ? rotation.current.x : rotation.current.x + idleX;

    group.current.rotation.y += (targetY - group.current.rotation.y) * Math.min(1, delta * 4);
    group.current.rotation.x += (targetX - group.current.rotation.x) * Math.min(1, delta * 4);
    // Float
    group.current.position.y = Math.sin(t * 0.7) * 0.08;

    // Halo pulse to hint at the LED screen.
    if (halo.current) {
      const s = 1 + Math.sin(t * 1.6) * 0.06;
      halo.current.scale.set(s, s, 1);
      const mat = halo.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.32 + Math.sin(t * 1.6) * 0.08;
    }
  });

  return (
    <group ref={group}>
      {/* Soft accent halo behind product — sits on a slightly larger plane so
          it leaks outside the cutout and reads as a glow even on dark bg. */}
      <mesh ref={halo} position={[0, 0, -0.4]} renderOrder={-1}>
        <planeGeometry args={[SIZE * 1.6, SIZE * 1.6]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          map={getRadialGradientTexture()}
        />
      </mesh>

      {/* The product itself */}
      <mesh>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */

interface AirflowProps {
  side: 'left' | 'right';
  color: string;
}

/**
 * Helical particle stream that wraps outward from a vent. Particles are
 * positioned each frame from a deterministic phase value so total cost is
 * O(N) per frame with N≈480 — comfortable on integrated GPUs.
 */
function Airflow({ side, color }: AirflowProps) {
  const N = 480;
  const dir = side === 'left' ? -1 : 1;

  const phases = useMemo(() => Float32Array.from({ length: N }, () => Math.random()), []);
  // Independent helical offset per particle so the streams don't all
  // overlap on the same helix line.
  const helixOffset = useMemo(() => Float32Array.from({ length: N }, () => Math.random() * Math.PI * 2), []);
  const positions = useMemo(() => new Float32Array(N * 3), []);

  const ref = useRef<THREE.Points>(null);
  const sprite = getRadialPointTexture();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const arr = (ref.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;

    for (let i = 0; i < N; i++) {
      // u in [0,1]: 0 = at vent, 1 = far out
      const u = (phases[i] + t * 0.13) % 1;
      // Vent is roughly at x=±0.95 (relative to product half-width)
      const x = dir * (0.95 + u * 2.6);
      const angle = helixOffset[i] + u * Math.PI * 7 * dir;
      const radius = 0.18 + u * 0.55;
      arr[i * 3] = x;
      arr[i * 3 + 1] = Math.sin(angle) * radius * 0.95;
      arr[i * 3 + 2] = Math.cos(angle) * radius * 0.6;
    }
    (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  // Set positions buffer once initially so the geometry has valid data.
  useEffect(() => {
    for (let i = 0; i < N; i++) {
      positions[i * 3] = dir * (0.95 + phases[i] * 2.6);
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
  }, [positions, phases, dir]);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.16}
        color={color}
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        map={sprite}
        alphaTest={0.01}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Procedural textures — generated once at module scope to avoid GC churn.  */

let _radialPointTex: THREE.Texture | null = null;
function getRadialPointTexture(): THREE.Texture {
  if (_radialPointTex) return _radialPointTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _radialPointTex = tex;
  return tex;
}

let _radialGlowTex: THREE.Texture | null = null;
function getRadialGradientTexture(): THREE.Texture {
  if (_radialGlowTex) return _radialGlowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _radialGlowTex = tex;
  return tex;
}
