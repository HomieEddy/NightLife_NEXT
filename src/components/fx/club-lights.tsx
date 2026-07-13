"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

/**
 * Three.js ambient "club lights" — a drifting field of glowing particles in
 * the brand palette, with gentle pointer parallax. Purely decorative:
 * pointer-events are disabled and it renders behind content.
 * Respects prefers-reduced-motion (renders a single static frame).
 */
export function ClubLights({
  className,
  density = 400,
  speed = 1,
}: {
  className?: string;
  density?: number;
  speed?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      Math.max(el.clientWidth, 1) / Math.max(el.clientHeight, 1),
      0.1,
      100,
    );
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    // Ember palette: warm amber/orange dominant, with sparse cool
    // "club laser" accents (violet, cyan) for depth against the warm ground.
    const palette = [
      new THREE.Color("#f59e0b"),
      new THREE.Color("#fb923c"),
      new THREE.Color("#f97316"),
      new THREE.Color("#fbbf24"),
      new THREE.Color("#fb923c"),
      new THREE.Color("#a855f7"),
      new THREE.Color("#22d3ee"),
    ];

    const count = density;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 32;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    const basePositions = positions.slice();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Soft round sprite drawn on a canvas (no asset needed).
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = spriteCanvas.height = 64;
    const ctx = spriteCanvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(spriteCanvas);

    const material = new THREE.PointsMaterial({
      size: 0.42,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX / window.innerWidth - 0.5;
      pointerY = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const startTime = performance.now();
    let raf = 0;
    const tick = () => {
      const t = ((performance.now() - startTime) / 1000) * speed;
      const attr = geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] = basePositions[i * 3] + Math.cos(t * 0.35 + seeds[i]) * 0.5;
        arr[i * 3 + 1] = basePositions[i * 3 + 1] + Math.sin(t * 0.55 + seeds[i]) * 0.7;
      }
      attr.needsUpdate = true;
      points.rotation.y = t * 0.018;
      camera.position.x += (pointerX * 2.2 - camera.position.x) * 0.03;
      camera.position.y += (-pointerY * 1.4 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    if (reduced) {
      renderer.render(scene, camera);
    } else {
      tick();
    }

    const resizeObserver = new ResizeObserver(() => {
      const w = Math.max(el.clientWidth, 1);
      const h = Math.max(el.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, [density, speed]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn(
        // Additive particles disappear on white; multiply keeps them visible in light mode.
        "pointer-events-none absolute inset-0 overflow-hidden mix-blend-multiply dark:mix-blend-normal",
        className,
      )}
    />
  );
}
