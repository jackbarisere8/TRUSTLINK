"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";

interface Hero3DCardProps {
  job: {
    provider: string;
    initials: string;
    title: string;
    location: string;
    service: string;
    price: string;
    deadline: string;
    revisions: string;
    status: "PAYMENT_RECORDED";
    completedJobs: number;
    rating: string;
  };
}

export function Hero3DCard({ job }: Hero3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 4, y: -6 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation (-12deg to +12deg)
    const rotateY = ((x - centerX) / centerX) * 12;
    const rotateX = -((y - centerY) / centerY) * 12;

    // Glare position percentage
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setRotation({ x: rotateX, y: rotateY });
    setGlare({ x: glareX, y: glareY, opacity: 0.25 });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    // Smooth reset to gentle aesthetic default
    setRotation({ x: 3, y: -5 });
    setGlare({ x: 50, y: 50, opacity: 0 });
  }, []);

  return (
    <div
      className="relative perspective-1000 select-none py-6"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dynamic ambient backdrop aura */}
      <div
        className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 via-blue-500/15 to-transparent rounded-3xl blur-2xl transition-opacity duration-700 pointer-events-none"
        style={{
          opacity: isHovered ? 0.85 : 0.45,
          transform: `scale(${isHovered ? 1.05 : 0.95})`,
        }}
      />

      {/* 3D Physical Card Stage */}
      <div
        ref={cardRef}
        className="relative preserve-3d w-[370px] sm:w-[410px] rounded-2xl p-7 transition-all duration-200 ease-out"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          boxShadow: isHovered
            ? "0 30px 70px -15px rgba(0, 0, 0, 0.4), 0 0 35px rgba(13, 148, 136, 0.25)"
            : "0 20px 50px -10px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Card Background Layer (Layer 0) with Paper & Security Watermark */}
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xl rounded-2xl border border-white/60 overflow-hidden">
          {/* Subtle Guilloche Micro-Mesh Watermark */}
          <div className="absolute inset-0 guilloche-pattern opacity-60 pointer-events-none" />

          {/* Microprint security border line */}
          <div className="absolute top-2 left-4 right-4 text-[7px] font-mono tracking-widest text-slate-300 uppercase overflow-hidden whitespace-nowrap opacity-60 select-none">
            TRUSTLINK ENCRYPTED RECORD • NON-CUSTODIAL REPUTATION • REF: TL-REC-2026-LAGOS • SECURE MILESTONE PASSBOOK
          </div>

          {/* Dynamic Specular Glare Reflection */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-2xl"
            style={{
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 65%)`,
              opacity: glare.opacity,
            }}
          />
        </div>

        {/* ── Layer 1 (+15px 3D depth): Header & Status ── */}
        <div className="relative preserve-3d translate-z-10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-surface-200/80">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-wider text-navy-900 uppercase">
                RECORD #TL-8942
              </span>
            </div>
            <StatusPill status={job.status} />
          </div>

          {/* Provider Identity Row */}
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-navy-900 text-white flex items-center justify-center text-sm font-bold shadow-md">
                {job.initials}
              </div>
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-teal-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white font-black"
                title="Verified Nigerian Provider"
              >
                ✓
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-navy-900">{job.provider}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                  Verified
                </span>
              </div>
              <p className="text-xs text-surface-500">
                Web designer · {job.location}, Nigeria
              </p>
            </div>
          </div>
        </div>

        {/* ── Layer 2 (+25px 3D depth): Job Scope & Value ── */}
        <div className="relative preserve-3d translate-z-20 mt-4 space-y-3">
          <h2 className="font-serif text-xl font-normal text-navy-950 leading-snug">
            {job.title}
          </h2>
          <p className="text-xs text-surface-600 leading-relaxed line-clamp-2">
            {job.service}
          </p>

          {/* Financial Terms Grid (Physical Voucher Texture) */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-surface-50 border border-surface-200/70">
            <div>
              <p className="text-[9px] font-bold text-surface-400 uppercase tracking-wider mb-0.5">
                Agreed Fee
              </p>
              <p className="text-sm font-bold text-teal-700 font-mono tracking-tight">
                {job.price}
              </p>
            </div>
            <div className="border-x border-surface-200 px-2">
              <p className="text-[9px] font-bold text-surface-400 uppercase tracking-wider mb-0.5">
                Deadline
              </p>
              <p className="text-xs font-semibold text-navy-900 mt-0.5">
                {job.deadline}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-surface-400 uppercase tracking-wider mb-0.5">
                Revisions
              </p>
              <p className="text-xs font-semibold text-navy-900 mt-0.5">
                {job.revisions}
              </p>
            </div>
          </div>
        </div>

        {/* ── Layer 3 (+35px 3D depth): Live Verification Beacon & Link ── */}
        <div className="relative preserve-3d translate-z-30 mt-5 pt-3.5 border-t border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-success-DEFAULT">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-DEFAULT opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-DEFAULT" />
            </span>
            <span className="text-xs font-semibold tracking-tight text-navy-900">
              Payment Confirmed
            </span>
          </div>

          <Link
            href="/j/sample-website-project"
            className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors group"
          >
            <span>View Record</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* ── Layer 4 (+45px Floating Badges) ── */}
        <div
          className="absolute -top-3.5 -right-4 translate-z-40 bg-navy-950 border border-teal-500/40 text-teal-300 px-3 py-1 rounded-full text-[11px] font-mono font-medium shadow-card-lg flex items-center gap-1.5"
          style={{ transform: "translateZ(40px) rotate(2deg)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          <span>Scope Locked ✓</span>
        </div>

        <div
          className="absolute -bottom-3 -left-4 translate-z-30 bg-white border border-surface-300 text-navy-900 px-3 py-1 rounded-full text-[11px] font-semibold shadow-card-md flex items-center gap-1.5"
          style={{ transform: "translateZ(35px) rotate(-1deg)" }}
        >
          <span className="text-teal-600">🛡</span>
          <span>WhatsApp linkable</span>
        </div>
      </div>
    </div>
  );
}

