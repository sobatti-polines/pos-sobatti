"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden xl:block w-24 text-right">
      <p className="text-xl font-light tracking-tight tabular-nums text-foreground">
        {currentTime.toLocaleTimeString("id-ID", { 
          hour: "2-digit", 
          minute: "2-digit",
          timeZone: "Asia/Jakarta"
        })}
      </p>
    </div>
  );
}
