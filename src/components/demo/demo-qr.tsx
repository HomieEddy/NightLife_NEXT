"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function DemoQr({ path, className }: { path: string; className?: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}${path}`;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg);
  }, [path]);

  return (
    <div
      className={className}
      // qrcode emits trusted, locally-generated SVG only
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
