"use client";

import React, { useState, useEffect } from "react";

export const LoadingSpinner = ({
  size = "md",
  simple = false,
  showRing = true,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  simple?: boolean;
  showRing?: boolean;
  className?: string;
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  // If simple is not explicitly provided, make 'sm' simple by default
  const isSimple = simple || size === "sm";

  useEffect(() => {
    if (isSimple) return; // No need for sliding index if simple
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % 5);
      setHasStarted(true);
    }, 750);
    return () => clearInterval(timer);
  }, [isSimple]);

  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-12 h-12 rounded-lg",
    lg: "w-16 h-16 rounded-lg",
  };

  const iconSizeClasses = {
    sm: "text-xs",
    md: "text-2xl",
    lg: "text-4xl",
  };

  const renderContent = () => {
    if (isSimple) return null;
    switch (slideIndex) {
      case 0:
        return (
          <div
            className={`w-full h-full flex items-center justify-center bg-rose-500 text-white ${
              hasStarted ? "animate-in slide-in-from-right duration-500" : ""
            }`}
          >
            <i className={`fa-solid fa-heart ${iconSizeClasses[size]}`}></i>
          </div>
        );
      case 1:
        return (
          <div className="w-full h-full flex items-center justify-center bg-indigo-600 text-white animate-in duration-500">
            <span className={`font-black ${iconSizeClasses[size]}`}>NG</span>
          </div>
        );
      case 2:
        return (
          <div className="w-full h-full flex items-center justify-center bg-sky-500 text-white animate-in slide-in-from-right duration-500">
            <i className={`fa-solid fa-file-signature ${iconSizeClasses[size]}`}></i>
          </div>
        );
      case 3:
        return (
          <div className="w-full h-full flex items-center justify-center bg-emerald-500 text-white animate-in slide-in-from-right duration-500">
            <i className={`fa-solid fa-clipboard-check ${iconSizeClasses[size]}`}></i>
          </div>
        );
      case 4:
        return (
          <div className="w-full h-full flex items-center justify-center bg-amber-500 text-white animate-in slide-in-from-right duration-500">
            <i className={`fa-solid fa-award ${iconSizeClasses[size]}`}></i>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Spinning Rings */}
      {showRing && (
        <>
          <div
            className={`absolute ${
              size === "sm" ? "-inset-[2px]" : "-inset-4"
            } rounded-full border-2 ${
              size === "sm"
                ? "border-slate-200/30 dark:border-slate-800/30"
                : "border-4 border-slate-200 dark:border-slate-800"
            }`}
          ></div>
          <div
            className={`absolute ${
              size === "sm" ? "-inset-[2px]" : "-inset-4"
            } rounded-full border-2 border-t-transparent animate-spin transition-colors duration-500 ${
              isSimple
                ? "border-primary"
                : slideIndex === 0
                ? "border-rose-500"
                : slideIndex === 1
                ? "border-indigo-600"
                : slideIndex === 2
                ? "border-sky-500"
                : slideIndex === 3
                ? "border-emerald-500"
                : "border-amber-500"
            }`}
          ></div>
        </>
      )}

      {/* Icon Slider Window */}
      {!isSimple && (
        <div
          className={`${sizeClasses[size]} overflow-hidden shadow-2xl shadow-indigo-600/30 relative z-10 bg-white dark:bg-slate-900`}
        >
          {renderContent()}
        </div>
      )}
    </div>
  );
};

export const MiniLoader = ({
  size = "md",
  simple = false,
  showRing = true,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  simple?: boolean;
  showRing?: boolean;
  className?: string;
}) => {
  return (
    <LoadingSpinner
      size={size}
      simple={simple}
      showRing={showRing}
      className={className}
    />
  );
};

export default LoadingSpinner;
