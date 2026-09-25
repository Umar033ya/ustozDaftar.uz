export default function Logo({ className = "", size = "default" }) {
  const sizeClasses = {
    small: "h-8 w-8",
    default: "h-10 w-10",
    large: "h-12 w-12",
  };

  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Open notebook/book */}
      <path
        d="M20 20 L20 80 L80 80 L80 20 Z"
        fill="#3B82F6"
        fillOpacity="0.1"
        stroke="#3B82F6"
        strokeWidth="2"
      />
      <path
        d="M20 20 L15 15 L75 15 L80 20"
        fill="none"
        stroke="#3B82F6"
        strokeWidth="2"
      />
      {/* Checkmark */}
      <path
        d="M35 50 L45 60 L65 40"
        stroke="#10B981"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Growth chart */}
      <path
        d="M30 70 L45 55 L55 60 L70 35"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="70" r="2" fill="#3B82F6" />
      <circle cx="45" cy="55" r="2" fill="#3B82F6" />
      <circle cx="55" cy="60" r="2" fill="#3B82F6" />
      <circle cx="70" cy="35" r="2" fill="#3B82F6" />
    </svg>
  );
}
