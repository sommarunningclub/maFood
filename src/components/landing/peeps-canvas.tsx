"use client";

/*
  Canvas "Open Peeps" — multidão de personagens caminhando como background.
  Adaptado do snippet GSAP do CodePen para React/Next.
  Sprite: https://s3-us-west-2.amazonaws.com/s.cdpn.io/175711/open-peeps-sheet.png
*/
import { useEffect, useRef } from "react";
import gsap from "gsap";

const CONFIG = {
  src: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/175711/open-peeps-sheet.png",
  rows: 15,
  cols: 7,
};

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
const randomIndex = <T,>(arr: T[]) => (randomRange(0, arr.length) | 0) as number;
const removeFromArray = <T,>(arr: T[], i: number) => arr.splice(i, 1)[0];
const removeItemFromArray = <T,>(arr: T[], item: T) =>
  removeFromArray(arr, arr.indexOf(item));
const removeRandomFromArray = <T,>(arr: T[]) => removeFromArray(arr, randomIndex(arr));

interface Stage {
  width: number;
  height: number;
}

class Peep {
  image: HTMLImageElement;
  rect: [number, number, number, number];
  width: number;
  height: number;
  drawArgs: [HTMLImageElement, number, number, number, number, number, number, number, number];
  x = 0;
  y = 0;
  anchorY = 0;
  scaleX = 1;
  walk: gsap.core.Timeline | null = null;

  constructor(image: HTMLImageElement, rect: [number, number, number, number]) {
    this.image = image;
    this.rect = rect;
    this.width = rect[2];
    this.height = rect[3];
    this.drawArgs = [image, ...rect, 0, 0, this.width, this.height];
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scaleX, 1);
    ctx.drawImage(...this.drawArgs);
    ctx.restore();
  }
}

interface ResetProps {
  startX: number;
  startY: number;
  endX: number;
}

function resetPeep(stage: Stage, peep: Peep): ResetProps {
  const direction = Math.random() > 0.5 ? 1 : -1;
  // Skew aleatório pra baixo: esconde que peeps não têm pernas
  const offsetY = 100 - 250 * gsap.parseEase("power2.in")(Math.random());
  const startY = stage.height - peep.height + offsetY;
  let startX: number;
  let endX: number;
  if (direction === 1) {
    startX = -peep.width;
    endX = stage.width;
    peep.scaleX = 1;
  } else {
    startX = stage.width + peep.width;
    endX = 0;
    peep.scaleX = -1;
  }
  peep.x = startX;
  peep.y = startY;
  peep.anchorY = startY;
  return { startX, startY, endX };
}

function normalWalk(peep: Peep, props: ResetProps) {
  const { startY, endX } = props;
  const xDuration = 10;
  const yDuration = 0.25;
  const tl = gsap.timeline();
  tl.timeScale(randomRange(0.5, 1.5));
  tl.to(peep, { duration: xDuration, x: endX, ease: "none" }, 0);
  tl.to(
    peep,
    {
      duration: yDuration,
      repeat: xDuration / yDuration,
      yoyo: true,
      y: startY - 10,
    },
    0
  );
  return tl;
}

export function PeepsCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stage: Stage = { width: 0, height: 0 };
    const allPeeps: Peep[] = [];
    const availablePeeps: Peep[] = [];
    const crowd: Peep[] = [];

    const img = document.createElement("img");
    img.crossOrigin = "anonymous";

    function createPeeps() {
      const { rows, cols } = CONFIG;
      const { naturalWidth: width, naturalHeight: height } = img;
      const total = rows * cols;
      const rectWidth = width / rows;
      const rectHeight = height / cols;
      for (let i = 0; i < total; i++) {
        allPeeps.push(
          new Peep(img, [
            (i % rows) * rectWidth,
            ((i / rows) | 0) * rectHeight,
            rectWidth,
            rectHeight,
          ])
        );
      }
    }

    function addPeepToCrowd() {
      const peep = removeRandomFromArray(availablePeeps);
      if (!peep) return null;
      const walk = normalWalk(peep, resetPeep(stage, peep)).eventCallback(
        "onComplete",
        () => {
          removePeepFromCrowd(peep);
          addPeepToCrowd();
        }
      );
      peep.walk = walk;
      crowd.push(peep);
      crowd.sort((a, b) => a.anchorY - b.anchorY);
      return peep;
    }

    function removePeepFromCrowd(peep: Peep) {
      removeItemFromArray(crowd, peep);
      availablePeeps.push(peep);
    }

    function initCrowd() {
      while (availablePeeps.length) {
        const p = addPeepToCrowd();
        p?.walk?.progress(Math.random());
      }
    }

    function resize() {
      stage.width = canvas!.clientWidth;
      stage.height = canvas!.clientHeight;
      canvas!.width = stage.width * devicePixelRatio;
      canvas!.height = stage.height * devicePixelRatio;
      crowd.forEach((peep) => peep.walk?.kill());
      crowd.length = 0;
      availablePeeps.length = 0;
      availablePeeps.push(...allPeeps);
      initCrowd();
    }

    function render() {
      canvas!.width = canvas!.width; // limpa
      ctx!.save();
      ctx!.scale(devicePixelRatio, devicePixelRatio);
      crowd.forEach((peep) => peep.render(ctx!));
      ctx!.restore();
    }

    function init() {
      createPeeps();
      resize();
      gsap.ticker.add(render);
      window.addEventListener("resize", resize);
    }

    img.onload = init;
    img.onerror = () => {
      // Falha de rede no asset externo — degradação silenciosa
      // (form continua usável; só fica sem o background animado)
      console.warn("[peeps] falhou ao carregar sprite externo");
    };
    img.src = CONFIG.src;

    return () => {
      window.removeEventListener("resize", resize);
      gsap.ticker.remove(render);
      crowd.forEach((p) => p.walk?.kill());
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
