import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface Spatial3DCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  dataTestId?: string;
  'data-testid'?: string;
  accentGlow?: string;
}

export const Spatial3DCard: React.FC<Spatial3DCardProps> = ({
  children,
  className = '',
  style = {},
  onClick,
  dataTestId,
  'data-testid': testIdProp,
  accentGlow,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 });

  // Normalized relative coordinate motion values: -0.5 to 0.5
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);

  // Smooth with Awwwards-grade spring dynamics (stiffness: 260, damping: 22)
  const smoothX = useSpring(rawMouseX, { stiffness: 260, damping: 22 });
  const smoothY = useSpring(rawMouseY, { stiffness: 260, damping: 22 });

  // Map to real 3D perspective rotation [-10deg, 10deg]
  const rotateX = useTransform(smoothY, [-0.5, 0.5], ['10deg', '-10deg']);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], ['-10deg', '10deg']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    rawMouseX.set(x / rect.width - 0.5);
    rawMouseY.set(y / rect.height - 0.5);
    setSpotlightPos({ x, y });
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setSpotlightPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    rawMouseX.set(0);
    rawMouseY.set(0);
  };

  const finalTestId = dataTestId || testIdProp;

  return (
    <div
      style={{
        perspective: 1100,
      }}
      className="relative"
    >
      <motion.div
        ref={cardRef}
        data-testid={finalTestId}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          ...style,
        }}
        whileHover={{ scale: 1.015 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0e131d]/90 to-[#06080d]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] ${className}`}
      >
        {/* Dynamic Specular Spotlight Glare Overlay */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 rounded-3xl"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(450px circle at ${spotlightPos.x}px ${spotlightPos.y}px, rgba(255,255,255,0.13), transparent 60%)`,
          }}
        />

        {/* Dynamic Glowing 1px Border Reflection Tracking Cursor */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.7 : 0,
            background: `radial-gradient(380px circle at ${spotlightPos.x}px ${spotlightPos.y}px, ${
              accentGlow || 'rgba(0, 255, 163, 0.35)'
            }, transparent 70%)`,
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '1px',
          }}
        />

        {/* Physical 3D Elevation Layer (translateZ: 26px) for Pop-out Effect */}
        <div
          className="relative w-full h-full"
          style={{
            transform: 'translateZ(26px)',
            transformStyle: 'preserve-3d',
          }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
};
