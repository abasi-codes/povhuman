interface SkeletonProps {
  variant?: "text" | "card" | "stat";
  width?: string;
  className?: string;
}

export function Skeleton({ variant = "text", width, className = "" }: SkeletonProps) {
  const base = variant === "card"
    ? "skeleton skeleton-card"
    : variant === "stat"
      ? "skeleton skeleton-stat"
      : "skeleton skeleton-text";
  return <div className={`${base} ${className}`} style={width ? { width } : undefined} />;
}

export function SkeletonCard() {
  return (
    <div className="card">
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" className="medium" />
      <Skeleton variant="text" className="short" />
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="stats-row">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton skeleton-stat" />
      ))}
    </div>
  );
}
