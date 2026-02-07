const AnimatedBackground = () => {
  return (
    <div
      className="fixed inset-0 -z-10"
      style={{
        background: "linear-gradient(135deg, hsl(270 60% 8%) 0%, hsl(350 50% 10%) 50%, hsl(220 60% 10%) 100%)",
      }}
    />
  );
};

export default AnimatedBackground;
