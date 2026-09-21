import { LogoMark } from "@/components/branding/logo";

export default function Loading() {
  return (
    <div
      className="min-h-screen bg-surface-50 flex items-center justify-center"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5">
        <LogoMark size="lg" />
        <div className="w-32 h-1 bg-surface-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 rounded-full animate-[loading_1.2s_ease-in-out_infinite]"
            style={{ animation: "loading 1.2s ease-in-out infinite" }}
          />
        </div>
      </div>
      <style>{`
        @keyframes loading {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
