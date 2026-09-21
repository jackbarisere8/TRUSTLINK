import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Accessible icon rendered inside the left edge of the input */
  leftIcon?: React.ReactNode;
  /** Accessible icon or element rendered inside the right edge */
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leftIcon, rightElement, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId  = hint  ? `${inputId}-hint`  : undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-navy-900 select-none"
          >
            {label}
            {props.required && (
              <span className="text-danger ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span
              className="absolute left-3 flex items-center text-surface-400 pointer-events-none"
              aria-hidden="true"
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
            aria-invalid={!!error}
            className={cn(
              "w-full h-11 rounded border bg-white text-sm text-navy-900 placeholder:text-surface-500",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-0 focus:border-teal-500",
              error
                ? "border-danger focus:ring-danger"
                : "border-surface-200 hover:border-surface-300",
              leftIcon     ? "pl-9  pr-3" : "px-3",
              rightElement ? "pr-10 pl-3" : leftIcon ? "" : "px-3",
              className
            )}
            {...props}
          />

          {rightElement && (
            <span className="absolute right-3 flex items-center">
              {rightElement}
            </span>
          )}
        </div>

        {hint && !error && (
          <p id={hintId} className="text-xs text-surface-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-danger font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
