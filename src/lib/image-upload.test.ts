import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  detectImageFormat,
  MAX_IMAGE_BYTES,
  prepareImageUpload,
} from "./image-upload";

describe("detectImageFormat", () => {
  it("identifica JPEG, PNG e WebP pelos bytes", () => {
    expect(detectImageFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("jpeg");
    expect(
      detectImageFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe("png");
    expect(
      detectImageFormat(
        Uint8Array.from([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        ])
      )
    ).toBe("webp");
  });

  it("não confia em conteúdo HTML ou SVG", () => {
    expect(detectImageFormat(new TextEncoder().encode("<svg><script /></svg>"))).toBeNull();
    expect(detectImageFormat(new TextEncoder().encode("<html></html>"))).toBeNull();
  });
});

describe("prepareImageUpload", () => {
  it("decodifica, redimensiona e reencoda como WebP", async () => {
    const png = await sharp({
      create: {
        width: 3000,
        height: 1200,
        channels: 3,
        background: "#f26522",
      },
    })
      .png()
      .toBuffer();

    const output = await prepareImageUpload(
      new File([png], "produto.png", { type: "image/png" })
    );
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(2400);
    expect(metadata.height).toBe(960);
  });

  it("rejeita MIME incompatível com os bytes", async () => {
    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: "#000000",
      },
    })
      .png()
      .toBuffer();

    await expect(
      prepareImageUpload(new File([png], "falso.jpg", { type: "image/jpeg" }))
      ).rejects.toMatchObject({ status: 415 });
  });

  it("rejeita SVG e arquivos acima do limite", async () => {
    await expect(
      prepareImageUpload(
        new File(["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"], "x.svg", {
          type: "image/svg+xml",
        })
      )
      ).rejects.toMatchObject({ status: 415 });

    await expect(
      prepareImageUpload(
        new File([Buffer.alloc(MAX_IMAGE_BYTES + 1)], "grande.png", {
          type: "image/png",
        })
      )
      ).rejects.toMatchObject({ status: 413 });
  });
});
