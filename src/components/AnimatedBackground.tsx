const AnimatedBackground = () => {
  return (
    <div
      className="fixed inset-0 -z-10"
      style={{
        background: "linear-gradient(135deg, hsl(230 60% 8%) 0%, hsl(270 50% 10%) 40%, hsl(340 45% 10%) 70%, hsl(220 60% 10%) 100%)",
      }}
    />
  );
};

export default AnimatedBackground;
