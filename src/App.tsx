import React, { useState, useRef, useEffect } from "react";
import { CameraIcon } from "lucide-react";
import Tesseract from "tesseract.js";

interface WordBox {
  text: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export default function AllergyScannerApp(): JSX.Element {
  const [allergies, setAllergies] = useState<string[]>([]);
  const [currentAllergy, setCurrentAllergy] = useState<string>("");
  const [detectedAllergens, setDetectedAllergens] = useState<string[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const addAllergy = (): void => {
    if (currentAllergy.trim() !== "") {
      setAllergies([...allergies, currentAllergy.toLowerCase()]);
      setCurrentAllergy("");
    }
  };

  const startCamera = async (): Promise<void> => {
    setScanning(true);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const stopCamera = (): void => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setScanning(false);
    setDetectedAllergens([]);
  };

  useEffect(() => {
    const scanInterval = setInterval(async () => {
      if (
        !scanning ||
        !videoRef.current ||
        !canvasRef.current ||
        !overlayRef.current
      )
        return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/png");

      try {
        const result = await Tesseract.recognize(dataUrl, "eng");
        const words = result.data.text.split(" ") || [];

        const found: string[] = [];

        const overlayCtx = overlay.getContext("2d");
        if (!overlayCtx) return;

        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        words.forEach((word) => {
          console.log(word);
          const lowerWord = word.toLowerCase();
          allergies.forEach((allergy) => {
            if (lowerWord.includes(allergy)) {
              found.push(allergy);
              console.log("MATCH");
              overlayCtx.strokeStyle = "red";
              overlayCtx.lineWidth = 2;
              overlayCtx.strokeRect(
                word.bbox.x0,
                word.bbox.y0,
                word.bbox.x1 - word.bbox.x0,
                word.bbox.y1 - word.bbox.y0
              );
              overlayCtx.font = "16px sans-serif";
              overlayCtx.fillStyle = "red";
              overlayCtx.fillText(word, word.bbox.x0, word.bbox.y0 - 4);
            }
          });
        });

        setDetectedAllergens([...new Set(found)]);
      } catch (err) {
        console.error("OCR error:", err);
      }
    }, 3000);

    return () => clearInterval(scanInterval);
  }, [scanning, allergies]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Allergy Scanner (AR)</h1>

      <div className="flex space-x-2">
        <input
          type="text"
          className="border px-3 py-2 rounded w-full"
          placeholder="Add allergy (e.g. peanut)"
          value={currentAllergy}
          onChange={(e) => setCurrentAllergy(e.target.value)}
        />
        <button
          onClick={addAllergy}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {allergies.map((allergy, index) => (
          <span
            key={index}
            className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm"
          >
            {allergy}
          </span>
        ))}
      </div>

      <div className="relative w-full max-w-xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-xl shadow"
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <canvas
          ref={overlayRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
      </div>

      <div>
        {scanning ? (
          <button
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded"
            onClick={stopCamera}
          >
            Stop Scanning
          </button>
        ) : (
          <button
            className="mt-2 bg-green-500 text-white px-4 py-2 rounded flex items-center space-x-2"
            onClick={startCamera}
          >
            <CameraIcon className="w-4 h-4" />
            <span>Start Scanning</span>
          </button>
        )}
      </div>

      {detectedAllergens.length > 0 && (
        <div className="mt-4 border-2 border-red-500 p-4 rounded">
          <h2 className="text-xl font-bold text-red-600">
            Warning: Allergens Found!
          </h2>
          <ul className="list-disc pl-5">
            {detectedAllergens.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
