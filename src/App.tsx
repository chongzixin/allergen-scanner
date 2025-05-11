import React, { useState, useRef, useEffect } from "react";
import { CameraIcon } from "lucide-react";
import Tesseract from "tesseract.js";
import "./styles.css";

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
        const { createWorker } = Tesseract;
        const worker = await createWorker("eng");
        const result = await worker.recognize(dataUrl, undefined, {
          text: true,
          blocks: true,
        });
        const blocks = result.data.blocks || [];
        console.log(result);

        const found: string[] = [];

        const overlayCtx = overlay.getContext("2d");
        if (!overlayCtx) return;

        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        blocks.forEach((block) => {
          const lowerWord = block.text.toLowerCase();
          allergies.forEach((allergy) => {
            if (lowerWord.includes(allergy)) {
              found.push(allergy);
              console.log("MATCH");
              overlayCtx.strokeStyle = "red";
              overlayCtx.lineWidth = 2;
              overlayCtx.strokeRect(
                block.bbox.x0,
                block.bbox.y0,
                block.bbox.x1 - block.bbox.x0,
                block.bbox.y1 - block.bbox.y0
              );
              overlayCtx.font = "16px sans-serif";
              overlayCtx.fillStyle = "red";
              overlayCtx.fillText(block.text, block.bbox.x0, block.bbox.y0 - 4);
            }
          });
        });

        setDetectedAllergens(Array.from(new Set(found)));
      } catch (err) {
        console.error("OCR error:", err);
      }
    }, 3000);

    return () => clearInterval(scanInterval);
  }, [scanning, allergies]);

  return (
    <div className="container">
      <h1 className="title">Allergy Scanner (AR)</h1>

      <div className="input-container">
        <input
          type="text"
          className="input"
          placeholder="Add allergy (e.g. peanut)"
          value={currentAllergy}
          onChange={(e) => setCurrentAllergy(e.target.value)}
        />
        <button onClick={addAllergy} className="btn-add">
          Add
        </button>
      </div>

      <div className="allergies-list">
        {allergies.map((allergy, index) => (
          <span key={index} className="allergy-item">
            {allergy}
          </span>
        ))}
      </div>

      <div className="buttons-container">
        {scanning ? (
          <button className="btn-stop" onClick={stopCamera}>
            Stop Scanning
          </button>
        ) : (
          <button className="btn-start" onClick={startCamera}>
            <CameraIcon className="icon" />
            <span>Start Scanning</span>
          </button>
        )}
      </div>

      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline muted className="video" />
        <canvas ref={overlayRef} className="canvas-overlay" />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {detectedAllergens.length >= 0 && (
        <div className="warning-box">
          <h2 className="warning-title">Warning: Allergens Found!</h2>
          <ul className="warning-list">
            {detectedAllergens.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
