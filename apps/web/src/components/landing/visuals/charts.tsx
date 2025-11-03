"use client";

/**
 * Shared chart components for landing page visuals
 */

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ points, width = 200, height = 56, className = "" }: SparklineProps) {
  if (!points.length) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  
  const normalize = (v: number) => ((v - min) / range);
  const step = width / (points.length - 1);
  
  const pathData = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${height - normalize(v) * height}`)
    .join(" ");
  
  const fillPathData = `${pathData} L ${width} ${height} L 0 ${height} Z`;

  // Guard last point for TypeScript
  const lastPoint = points[points.length - 1] ?? points[0];
  const lastCy = height - normalize(lastPoint) * height;

  return (
    <svg width={width} height={height} className={`overflow-visible ${className}`}>
      <defs>
        <linearGradient id="sparkline-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Fill area */}
      <path d={fillPathData} fill="url(#sparkline-fill)" />
      
      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Last point highlight */}
      <circle
        cx={width}
        cy={lastCy}
        r="3"
        fill="hsl(var(--primary))"
        className="drop-shadow-md"
      />
    </svg>
  );
}

interface DonutChartProps {
  segments: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  size?: number;
  thickness?: number;
  className?: string;
}

export function DonutChart({ segments, size = 160, thickness = 32, className = "" }: DonutChartProps) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let currentAngle = -90; // Start from top

  return (
    <svg width={size} height={size} className={className}>
      {segments.map((segment, index) => {
        const percent = segment.value / total;
        const angle = percent * 360;
        const dashLength = (percent * circumference);
        const dashOffset = circumference - dashLength;
        
        const rotation = currentAngle;
        currentAngle += angle;

        return (
          <circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={thickness}
            strokeDasharray={`${dashLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            className="transition-all duration-500"
          />
        );
      })}
      
      {/* Center circle for donut hole */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius - thickness / 2}
        fill="hsl(var(--card))"
      />
    </svg>
  );
}

