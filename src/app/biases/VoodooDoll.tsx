'use client'

import React, { useEffect, useRef, useState } from 'react'

export type Needle = { id: string; x: number; y: number; angle: number; color: string }

// Rectangular "stab zones" inside the doll's silhouette (in 240x360 viewBox units).
// A needle dropped on a checked bias lands at a random point inside a random zone.
const ZONES = [
  { x: 86, y: 46, w: 68, h: 60, weight: 3 }, // head
  { x: 88, y: 150, w: 64, h: 96, weight: 5 }, // torso
  { x: 44, y: 158, w: 42, h: 52, weight: 2 }, // left arm
  { x: 154, y: 158, w: 42, h: 52, weight: 2 }, // right arm
  { x: 92, y: 250, w: 26, h: 78, weight: 2 }, // left leg
  { x: 124, y: 250, w: 26, h: 78, weight: 2 }, // right leg
]

const PIN_COLORS = ['#e23c4e', '#ff5fa2', '#f4a020', '#2bb6a8', '#7b5cd6', '#f2d231']

export function makeNeedle(id: string): Needle {
  const total = ZONES.reduce((n, z) => n + z.weight, 0)
  let r = Math.random() * total
  const zone = ZONES.find((z) => (r -= z.weight) <= 0) ?? ZONES[1]
  return {
    id,
    x: zone.x + Math.random() * zone.w,
    y: zone.y + Math.random() * zone.h,
    angle: -55 + Math.random() * 110,
    color: PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)],
  }
}

export default function VoodooDoll({ needles }: { needles: Needle[] }) {
  const [shake, setShake] = useState(false)
  const prev = useRef(needles.length)

  useEffect(() => {
    if (needles.length > prev.current) {
      setShake(true)
      const t = setTimeout(() => setShake(false), 420)
      prev.current = needles.length
      return () => clearTimeout(t)
    }
    prev.current = needles.length
  }, [needles.length])

  return (
    <svg
      viewBox="0 0 240 360"
      className={`voodoo-doll${shake ? ' voodoo-shake' : ''}`}
      role="img"
      aria-label="A burlap voodoo doll with button eyes"
    >
      <defs>
        {/* Woven burlap / sackcloth fill */}
        <pattern id="burlap" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#c8a86c" />
          <path d="M0 1.5H6M0 4.5H6" stroke="#b1894f" strokeWidth="1.2" />
          <path d="M1.5 0V6M4.5 0V6" stroke="#d8bd85" strokeWidth="0.8" opacity="0.6" />
        </pattern>
        <pattern id="burlapPatch" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#9fb0a0" />
          <path d="M0 1.5H6M0 4.5H6" stroke="#849685" strokeWidth="1.2" />
          <path d="M1.5 0V6M4.5 0V6" stroke="#b7c6b8" strokeWidth="0.8" opacity="0.6" />
        </pattern>
        <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d98b7a" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#d98b7a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="120" cy="342" rx="62" ry="10" fill="#000" opacity="0.18" />

      <g className="voodoo-body">
        {/* yarn hair behind head */}
        <g stroke="#3f5d7a" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M86 78C70 60 70 40 84 30" />
          <path d="M96 64C84 48 86 32 100 24" />
          <path d="M120 58C118 40 122 26 132 22" />
          <path d="M146 64C158 48 156 32 142 24" />
          <path d="M154 78C170 60 170 40 156 30" />
        </g>

        {/* limbs */}
        <g
          fill="url(#burlap)"
          stroke="#7d5d34"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {/* arms */}
          <path d="M96 156C72 158 52 168 46 196C44 206 56 210 60 200C66 182 84 178 100 180Z" />
          <path d="M144 156C168 158 188 168 194 196C196 206 184 210 180 200C174 182 156 178 140 180Z" />
          {/* legs */}
          <path d="M104 240C96 270 94 300 98 330C99 338 113 338 114 330C116 302 116 272 120 248Z" />
          <path d="M136 240C144 270 146 300 142 330C141 338 127 338 126 330C124 302 124 272 120 248Z" />
          {/* torso */}
          <path d="M120 120C150 120 156 150 154 186C153 216 150 250 120 250C90 250 87 216 86 186C84 150 90 120 120 120Z" />
          {/* head */}
          <circle cx="120" cy="84" r="40" />
        </g>

        {/* seam stitches down the middle */}
        <g stroke="#7d5d34" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 5" fill="none">
          <path d="M120 126V246" />
          <path d="M120 250V330" opacity="0.6" />
          <path d="M120 48V120" />
        </g>

        {/* a patch on the belly */}
        <g>
          <rect
            x="103"
            y="176"
            width="34"
            height="30"
            rx="4"
            fill="url(#burlapPatch)"
            stroke="#5f7060"
            strokeWidth="2"
            strokeDasharray="3 4"
            transform="rotate(-6 120 191)"
          />
        </g>

        {/* heart on the chest */}
        <path
          d="M120 148c-6-10-22-6-22 6 0 9 14 16 22 22 8-6 22-13 22-22 0-12-16-16-22-6Z"
          fill="#b9433f"
          stroke="#7d2b28"
          strokeWidth="1.5"
        />

        {/* face */}
        <g>
          <ellipse cx="100" cy="98" rx="11" ry="8" fill="url(#cheek)" />
          <ellipse cx="140" cy="98" rx="11" ry="8" fill="url(#cheek)" />

          {/* button eyes (Coraline's other-mother buttons) */}
          {[103, 137].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="84" r="9.5" fill="#1c1c1c" />
              <circle cx={cx} cy="84" r="9.5" fill="none" stroke="#000" strokeWidth="1" />
              <circle cx={cx - 3} cy="81" r="1.4" fill="#5a5a5a" />
              <circle cx={cx + 3} cy="81" r="1.4" fill="#5a5a5a" />
              <circle cx={cx - 3} cy="87" r="1.4" fill="#5a5a5a" />
              <circle cx={cx + 3} cy="87" r="1.4" fill="#5a5a5a" />
              {/* cross thread */}
              <path
                d={`M${cx - 3} 81 ${cx + 3} 87 M${cx + 3} 81 ${cx - 3} 87`}
                stroke="#d9c89a"
                strokeWidth="1.1"
              />
            </g>
          ))}

          {/* stitched mouth */}
          <path d="M104 108Q120 120 136 108" fill="none" stroke="#6b3b34" strokeWidth="2.5" />
          <g stroke="#6b3b34" strokeWidth="1.8" strokeLinecap="round">
            <path d="M109 109V104" />
            <path d="M116 113V108" />
            <path d="M124 113V108" />
            <path d="M131 109V104" />
          </g>
        </g>

        {/* hand and foot stitching accents */}
        <g stroke="#7d5d34" strokeWidth="1.6" strokeDasharray="2 4" fill="none" opacity="0.7">
          <path d="M52 196q8-4 14 0" />
          <path d="M174 196q8-4 14 0" />
        </g>
      </g>

      {/* needles */}
      <g>
        {needles.map((n) => (
          <g key={n.id} transform={`translate(${n.x} ${n.y}) rotate(${n.angle})`}>
            <g className="needle-stab">
              {/* shaft */}
              <line x1="0" y1="0" x2="0" y2="-34" stroke="#7c8794" strokeWidth="1.6" />
              <line x1="0" y1="0" x2="0" y2="-34" stroke="#cdd6df" strokeWidth="0.6" />
              {/* entry pucker */}
              <circle cx="0" cy="0" r="2.4" fill="#000" opacity="0.18" />
              {/* bead head */}
              <circle cx="0" cy="-37" r="5" fill={n.color} />
              <circle cx="-1.5" cy="-38.5" r="1.6" fill="#fff" opacity="0.7" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  )
}
