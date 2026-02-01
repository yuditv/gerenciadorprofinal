import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import cyberpunkBg from "@/assets/cyberpunk-bg.jpg";

const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      hue: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.6 + 0.2;
        this.hue = Math.random() > 0.5 ? 0 : 15; // Red or orange hue
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0) this.x = canvas!.width;
        if (this.x > canvas!.width) this.x = 0;
        if (this.y < 0) this.y = canvas!.height;
        if (this.y > canvas!.height) this.y = 0;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 55%, ${this.opacity})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${this.hue}, 80%, 55%, 0.5)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    const init = () => {
      particles = [];
      const particleCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 12000));
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const connectParticles = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx!.beginPath();
            ctx!.strokeStyle = `hsla(0, 80%, 55%, ${0.12 * (1 - distance / 150)})`;
            ctx!.lineWidth = 0.8;
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      connectParticles();
      animationId = requestAnimationFrame(animate);
    };

    resize();
    init();
    animate();

    window.addEventListener("resize", () => {
      resize();
      init();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Static cyberpunk background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${cyberpunkBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.4,
        }}
      />

      {/* Dark overlay for better contrast */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, hsl(230 20% 6% / 0.7) 0%, hsl(230 20% 6% / 0.5) 50%, hsl(230 20% 6% / 0.7) 100%)",
        }}
      />

      {/* Animated gradient orbs */}
      <motion.div
        className="absolute -top-1/4 -left-1/4 w-[60%] h-[60%] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(0 85% 50% / 0.25) 0%, transparent 60%)",
          filter: "blur(100px)",
        }}
        animate={{
          x: [0, 150, 75, 0],
          y: [0, 75, 150, 0],
          scale: [1, 1.3, 0.9, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute -bottom-1/4 -right-1/4 w-[50%] h-[50%] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(15 90% 50% / 0.2) 0%, transparent 60%)",
          filter: "blur(100px)",
        }}
        animate={{
          x: [0, -120, -60, 0],
          y: [0, -80, -160, 0],
          scale: [1, 0.8, 1.2, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(270 60% 50% / 0.15) 0%, transparent 60%)",
          filter: "blur(120px)",
        }}
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Floating geometric shapes with glow */}
      <motion.div
        className="absolute top-1/4 right-1/4 w-40 h-40 border-2 border-primary/20 rounded-full"
        style={{
          boxShadow: "0 0 40px hsl(0 85% 55% / 0.2), inset 0 0 40px hsl(0 85% 55% / 0.1)",
        }}
        animate={{
          rotate: 360,
          scale: [1, 1.15, 1],
        }}
        transition={{
          rotate: { duration: 40, repeat: Infinity, ease: "linear" },
          scale: { duration: 10, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      <motion.div
        className="absolute bottom-1/4 left-1/5 w-28 h-28 border-2 border-accent/15 rotate-45"
        style={{
          boxShadow: "0 0 30px hsl(15 90% 55% / 0.15)",
        }}
        animate={{
          rotate: [45, 135, 225, 45],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute top-2/3 right-1/3 w-20 h-20 border border-primary/10"
        style={{
          clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
          boxShadow: "0 0 20px hsl(0 85% 55% / 0.1)",
        }}
        animate={{
          rotate: [0, 120, 240, 360],
          scale: [1, 0.8, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.7 }}
      />

      {/* Enhanced grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(0 85% 55% / 0.5) 1px, transparent 1px),
            linear-gradient(90deg, hsl(0 85% 55% / 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Scanlines effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 0% / 0.5) 2px, hsl(0 0% 0% / 0.5) 4px)",
        }}
      />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, hsl(230 20% 6% / 0.6) 70%, hsl(230 20% 6% / 0.9) 100%)",
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
