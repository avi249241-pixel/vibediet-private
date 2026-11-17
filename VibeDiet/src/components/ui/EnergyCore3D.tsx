import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface EnergyCore3DProps {
  remainingCalories?: number;
  targetCalories?: number;
  consumedCalories?: number;
  burnedCalories?: number;
  size?: number;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  speed: number;
  angle: number;
  ringIndex: number;
  orbitRadius: number;
}

export const EnergyCore3D: React.FC<EnergyCore3DProps> = ({
  remainingCalories = 2245,
  targetCalories = 2245,
  consumedCalories = 0,
  burnedCalories = 420,
  size = 280,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideo, setHasVideo] = useState(true);

  // Auto-detect if /hero-3d-loop.mp4 is available
  useEffect(() => {
    fetch('/hero-3d-loop.mp4', { method: 'HEAD' })
      .then((res) => {
        if (!res.ok) setHasVideo(false);
      })
      .catch(() => setHasVideo(false));
  }, []);

  // Built-in 60fps 3D Torus / Particle Energy Core Shader & Canvas Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const colors = [
      '#00FFA3', // Electric Emerald
      '#00E5FF', // Cyan
      '#8B5CF6', // Hyper Violet
    ];

    const particleCount = 72;
    const particles: Particle3D[] = [];

    // Initialize 3D Torus particle coordinates
    for (let i = 0; i < particleCount; i++) {
      const ringIndex = i % 3;
      const orbitRadius = 75 + (i % 5) * 12;
      const angle = (i / particleCount) * Math.PI * 2;
      particles.push({
        x: Math.cos(angle) * orbitRadius,
        y: (Math.sin(angle * 2) * orbitRadius) * 0.4,
        z: Math.sin(angle) * orbitRadius,
        radius: 1.2 + Math.random() * 2.2,
        color: colors[i % colors.length],
        speed: 0.015 + (i % 4) * 0.005,
        angle,
        ringIndex,
        orbitRadius,
      });
    }

    const render = () => {
      time += 0.018;
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Central Pulsing Singularity Glow
      const pulse = 1 + Math.sin(time * 2.5) * 0.08;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 68 * pulse);
      coreGrad.addColorStop(0, 'rgba(0, 255, 163, 0.45)');
      coreGrad.addColorStop(0.35, 'rgba(0, 229, 255, 0.25)');
      coreGrad.addColorStop(0.7, 'rgba(139, 92, 246, 0.12)');
      coreGrad.addColorStop(1, 'rgba(3, 3, 5, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 70 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Gyroscopic 3D Rotational Angles
      const rotX = time * 0.6;
      const rotY = time * 0.8;
      const rotZ = time * 0.4;

      // Project and sort particles by depth (Z-order)
      const projected = particles.map((p) => {
        p.angle += p.speed;
        let x = Math.cos(p.angle) * p.orbitRadius;
        let y = Math.sin(p.angle * 3) * 18;
        let z = Math.sin(p.angle) * p.orbitRadius;

        // Apply 3D Gyroscopic Rotation Matrix
        // Y-axis rotation
        let x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
        let z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);

        // X-axis rotation
        let y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
        let z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

        // Z-axis rotation
        let x3 = x1 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
        let y3 = x1 * Math.sin(rotZ) + y2 * Math.cos(rotZ);

        // Perspective projection
        const fov = 260;
        const scale = fov / (fov + z2);
        const projX = cx + x3 * scale;
        const projY = cy + y3 * scale;
        const alpha = Math.max(0.15, Math.min(1, (z2 + 100) / 200));

        return {
          projX,
          projY,
          size: p.radius * scale,
          color: p.color,
          alpha,
          depth: z2,
        };
      });

      // Render back-to-front
      projected.sort((a, b) => a.depth - b.depth);

      projected.forEach((pt) => {
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(pt.projX, pt.projY, Math.max(0.5, pt.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
        perspective: 1100,
      }}
    >
      {/* Auto-detect Higgsfield 3D loop if present in public/ */}
      {hasVideo && (
        <video
          ref={videoRef}
          src="/hero-3d-loop.mp4"
          autoPlay
          loop
          muted
          playsInline
          onError={() => setHasVideo(false)}
          className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-70 pointer-events-none rounded-full"
        />
      )}

      {/* Layered Hardware-Accelerated 3D Gyroscopic Rings */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Emerald Ring */}
        <motion.div
          animate={{ rotateX: [70, 75, 70], rotateY: [0, 180, 360], rotateZ: [0, 90, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[86%] h-[86%] rounded-full border border-dashed border-[#00FFA3]/40"
          style={{ transformStyle: 'preserve-3d' }}
        />

        {/* Cyan Orbital Ring */}
        <motion.div
          animate={{ rotateX: [45, 55, 45], rotateY: [360, 180, 0], rotateZ: [30, -30, 30] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[76%] h-[76%] rounded-full border border-[#00E5FF]/35 shadow-[0_0_15px_rgba(0,229,255,0.25)]"
          style={{ transformStyle: 'preserve-3d' }}
        />

        {/* Hyper Violet Inner Orbital Ring */}
        <motion.div
          animate={{ rotateX: [60, -60, 60], rotateY: [90, 270, 90], rotateZ: [0, 360, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[64%] h-[64%] rounded-full border border-dotted border-[#8B5CF6]/50"
          style={{ transformStyle: 'preserve-3d' }}
        />
      </div>

      {/* 60fps Live Canvas Swirling Energy Torus Core */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transformStyle: 'preserve-3d' }}
      />

      {/* Floating 3D Telemetry Readout Suspended in 3D Space (translateZ: 45px) */}
      <div
        className="absolute z-10 flex flex-col items-center justify-center text-center pointer-events-none"
        style={{
          transform: 'translateZ(45px)',
          transformStyle: 'preserve-3d',
        }}
      >
        <span
          className="font-mono text-3xl sm:text-4xl font-black text-white tracking-tight"
          style={{
            textShadow:
              '0 0 16px rgba(0, 255, 163, 0.75), 0 0 32px rgba(0, 229, 255, 0.45), 0 0 48px rgba(139, 92, 246, 0.25)',
          }}
        >
          {remainingCalories.toLocaleString()}
        </span>
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#00FFA3] mt-0.5"
          style={{
            textShadow: '0 0 12px rgba(0, 255, 163, 0.65)',
          }}
        >
          KCAL REMAINING
        </span>
      </div>
    </div>
  );
};
