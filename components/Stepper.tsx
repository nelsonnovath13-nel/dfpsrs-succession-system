"use client";

import { Check } from "lucide-react";

export function Stepper({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-label={`Hatua ${currentStep + 1} kati ya ${steps.length}`}
      className="flex items-center w-full mb-6"
    >
      {steps.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`h-8 w-8 flex items-center justify-center text-xs font-semibold border-2 shrink-0 ${
                  done
                    ? "bg-secondary text-white border-secondary"
                    : active
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-neutralDark border-gray-400"
                }`}
              >
                {done ? <Check size={16} aria-hidden="true" /> : i + 1}
              </div>
              <span className={`text-[11px] mt-1 text-center w-20 ${active ? "text-primary font-semibold" : "text-neutralDark"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-secondary" : "bg-gray-300"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
