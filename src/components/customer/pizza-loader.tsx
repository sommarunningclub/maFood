"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Linhas decorativas (shimmer) ao redor da pizza — giram com .whole
const SHIMMER_LINES: [number, number, number, number][] = [
  [75.5, 115.1, 74.98, 113.16], [47.03, 8.84, 46.51, 6.91],
  [70.73, 116.15, 70.38, 114.18], [51.63, 7.82, 51.28, 5.86],
  [65.88, 116.79, 65.71, 114.8], [56.3, 7.21, 56.12, 5.22],
  [61, 117, 61, 115], [61, 7, 61, 5],
  [56.12, 116.79, 56.3, 114.8], [65.71, 7.21, 65.88, 5.22],
  [51.28, 116.15, 51.63, 114.18], [70.38, 7.82, 70.73, 5.86],
  [46.51, 115.1, 47.03, 113.16], [74.98, 8.84, 75.5, 6.91],
  [41.85, 113.63, 42.53, 111.75], [79.47, 10.26, 80.16, 8.38],
  [37.34, 111.76, 38.18, 109.95], [83.82, 12.06, 84.67, 10.25],
  [33, 109.5, 34, 107.77], [88, 14.24, 89, 12.51],
  [28.88, 106.88, 30.03, 105.24], [91.98, 16.77, 93.12, 15.13],
  [25.01, 103.9, 26.29, 102.37], [95.71, 19.64, 97, 18.11],
  [21.4, 100.6, 22.82, 99.19], [99.19, 22.82, 100.6, 21.41],
  [18.1, 97, 19.64, 95.72], [102.37, 26.29, 103.9, 25.01],
  [15.13, 93.12, 16.77, 91.98], [105.24, 30.03, 106.87, 28.88],
  [12.5, 89, 14.24, 88], [107.77, 34, 109.5, 33],
  [10.25, 84.67, 12.06, 83.83], [109.94, 38.18, 111.76, 37.34],
  [8.38, 80.16, 10.26, 79.47], [111.75, 42.54, 113.62, 41.85],
  [6.91, 75.5, 8.84, 74.98], [113.16, 47.03, 115.09, 46.51],
  [5.85, 70.73, 7.82, 70.38], [114.18, 51.63, 116.15, 51.28],
  [5.22, 65.89, 7.21, 65.71], [114.8, 56.3, 116.79, 56.12],
  [5, 61, 7, 61], [115, 61, 117, 61],
  [5.22, 56.12, 7.21, 56.3], [114.8, 65.71, 116.79, 65.89],
  [5.85, 51.28, 7.82, 51.63], [114.18, 70.38, 116.15, 70.73],
  [6.91, 46.51, 8.84, 47.03], [113.16, 74.98, 115.09, 75.5],
  [8.38, 41.85, 10.26, 42.54], [111.75, 79.47, 113.62, 80.16],
  [10.25, 37.34, 12.06, 38.18], [109.94, 83.83, 111.76, 84.67],
  [12.5, 33, 14.24, 34], [107.77, 88, 109.5, 89],
  [15.13, 28.88, 16.77, 30.03], [105.24, 91.98, 106.87, 93.12],
  [18.1, 25.01, 19.64, 26.29], [102.37, 95.72, 103.9, 97],
  [21.4, 21.41, 22.82, 22.82], [99.19, 99.19, 100.6, 100.6],
  [25.01, 18.11, 26.29, 19.64], [95.71, 102.37, 97, 103.9],
  [28.88, 15.13, 30.03, 16.77], [91.98, 105.24, 93.12, 106.88],
  [33, 12.51, 34, 14.24], [88, 107.77, 89, 109.5],
  [37.34, 10.25, 38.18, 12.06], [83.82, 109.95, 84.67, 111.76],
  [41.85, 8.38, 42.53, 10.26], [79.47, 111.75, 80.16, 113.63],
];

/*
  Pizza loader animado — só aparece quando o pedido está "em preparo".
  Adaptado do snippet original (TimelineMax) pra GSAP v3.
  - .pizzaOutline e .pizzaMask giram 360° (a fatia "varre" a pizza)
  - .whole gira -45° simultaneamente
  - Render limpo via useEffect; refs evitam querySelector global no DOM
*/
export function PizzaLoader({ size = 96 }: { size?: number }) {
  const wholeRef = useRef<SVGGElement | null>(null);
  const outlineRef = useRef<SVGUseElement | null>(null);
  const maskRef = useRef<SVGUseElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to([outlineRef.current, maskRef.current], {
        rotation: 360,
        svgOrigin: "61 61",
        duration: 1.75,
        repeat: -1,
        ease: "none",
      });
      gsap.to(wholeRef.current, {
        rotation: -45,
        svgOrigin: "61 61",
        duration: 1.75,
        repeat: -1,
        ease: "none",
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <svg
      viewBox="0 0 122 122"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size }}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <g ref={wholeRef} id="pizza-whole">
          <circle cx="61" cy="61" r="61" fill="#FFB800" />
          <circle cx="61" cy="61" r="55" fill="#FFDE31" />
          <g fill="#CD2D36" stroke="#FEA202" strokeMiterlimit="10" strokeWidth="2">
            <circle cx="61" cy="29.11" r="8" />
            <circle cx="38.45" cy="38.45" r="8" />
            <circle cx="29.11" cy="61" r="8" />
            <circle cx="38.45" cy="83.55" r="8" />
            <circle cx="61" cy="92.89" r="8" />
            <circle cx="83.55" cy="83.55" r="8" />
            <circle cx="92.89" cy="61" r="8" />
            <circle cx="83.55" cy="38.45" r="8" />
          </g>
          <circle
            cx="61"
            cy="61"
            r="48.2"
            fill="none"
            stroke="#FEA202"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            strokeDasharray="16 10 8 4"
          />
          <circle
            cx="61"
            cy="60.8"
            r="8"
            fill="#CD2D36"
            stroke="#FEA202"
            strokeMiterlimit="10"
            strokeWidth="2"
          />
          <g
            fill="none"
            stroke="#FEA202"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            {SHIMMER_LINES.map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
          </g>
        </g>
        <path
          id="pizza-slice-outline"
          d="M62.94,61.63,82.68,9a2.51,2.51,0,0,0-1.41-3C72,.8,50,.8,40.63,5.9a2.46,2.46,0,0,0-1.34,3L59.06,61.63A2.07,2.07,0,0,0,62.94,61.63Z"
        />
        <mask id="pizza-slice-mask">
          <use
            ref={maskRef}
            href="#pizza-slice-outline"
            fill="#FFF"
            stroke="#FFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </mask>
      </defs>
      <g mask="url(#pizza-slice-mask)">
        <use href="#pizza-whole" />
      </g>
      <use
        ref={outlineRef}
        href="#pizza-slice-outline"
        fill="none"
        stroke="#FEA202"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
