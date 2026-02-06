import cyberpunkBg from "@/assets/cyberpunk-bg.jpg";

const AnimatedBackground = () => {
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

      {/* Static gradient orbs (no animation) */}
      <div
        className="absolute -top-1/4 -left-1/4 w-[60%] h-[60%] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(0 85% 50% / 0.15) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />

      <div
        className="absolute -bottom-1/4 -right-1/4 w-[50%] h-[50%] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(15 90% 50% / 0.12) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(0 85% 55% / 0.4) 1px, transparent 1px),
            linear-gradient(90deg, hsl(0 85% 55% / 0.4) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, hsl(230 20% 6% / 0.5) 70%, hsl(230 20% 6% / 0.85) 100%)",
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
