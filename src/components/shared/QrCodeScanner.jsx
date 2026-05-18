import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_SCAN_CONFIG = {
  fps: 10,
  qrbox: { width: 220, height: 220 },
  aspectRatio: 1,
};

export default function QrCodeScanner({ onDecoded }) {
  const scannerRef = useRef(null);
  const containerId = useMemo(
    () => `qr-reader-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [lastDecoded, setLastDecoded] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      setIsScanning(false);
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Ignora erro de stop para não bloquear o fluxo.
    }

    try {
      scanner.clear();
    } catch {
      // Ignora erro de clear para evitar quebrar no cleanup.
    }

    scannerRef.current = null;
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (!scanner) return;

      if (scanner.isScanning) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // Ignora erro de clear no unmount.
            }
          });
      } else {
        try {
          scanner.clear();
        } catch {
          // Ignora erro de clear no unmount.
        }
      }

      scannerRef.current = null;
    };
  }, []);

  const emitDecoded = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized || normalized === lastDecoded) return;
    setLastDecoded(normalized);
    onDecoded?.(normalized);
  };

  const startScanner = async () => {
    if (isScanning || isStarting) return;

    if (!window?.isSecureContext) {
      setErrorMessage("Para usar a câmera, abra em HTTPS ou localhost.");
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorMessage("Seu navegador não oferece suporte à câmera.");
      return;
    }

    setErrorMessage("");
    setIsStarting(true);

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const cameras = await Html5Qrcode.getCameras();

      if (!cameras?.length) {
        throw new Error("Nenhuma câmera foi encontrada no dispositivo.");
      }

      const cameraPreferida =
        cameras.find(c => /(back|rear|traseira|environment)/i.test(c.label || "")) || cameras[0];

      const scanner = new Html5Qrcode(containerId, false);
      scannerRef.current = scanner;

      await scanner.start(
        cameraPreferida.id,
        {
          ...DEFAULT_SCAN_CONFIG,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        },
        (decodedText) => {
          emitDecoded(decodedText);
          stopScanner();
        },
        () => {}
      );

      setIsScanning(true);
    } catch (error) {
      setErrorMessage(error?.message || "Não foi possível iniciar o leitor de QR Code.");
      await stopScanner();
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {!isScanning ? (
          <Button onClick={startScanner} disabled={isStarting}>
            <Camera className="w-4 h-4 mr-2" />
            {isStarting ? "Iniciando câmera..." : "Escanear QR com câmera"}
          </Button>
        ) : (
          <Button variant="outline" onClick={stopScanner}>
            <CameraOff className="w-4 h-4 mr-2" />
            Parar câmera
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-muted/20 p-2">
        <div id={containerId} className="min-h-40 overflow-hidden rounded-lg" />
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

    </div>
  );
}
