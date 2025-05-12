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

// debug
declare global {
  interface Window {
    __originalConsoleLog?: (...args: any[]) => void;
  }
}

export default function AllergyScannerApp(): JSX.Element {
  // add predefined list of allergies
  const [allergies, setAllergies] = useState<string[]>([
    "egg",
    "fish",
    "peanut",
    "sesame",
    "potato",
    "soy",
    "milk",
    "butter",
    "wheat",
    "cashew",
    "almond",
    "arachis",
    "nuts",
    "goobers",
    "mandelonas",
    "satay sauce",
    "rojak",
    "achar",
    "rempeyek",
    "mole sauce",
    "enchilada sauce",
    "pad thai",
  ]);
  const [currentAllergy, setCurrentAllergy] = useState<string>("");
  const [detectedAllergens, setDetectedAllergens] = useState<string[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [ocrRawText, setOcrRawText] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  // debug
  const [debugText, setDebugText] = useState<string>("");

  useEffect(() => {
    if (!window.__originalConsoleLog) {
      window.__originalConsoleLog = console.log;

      console.log = (...args: any[]) => {
        setDebugText((prev) =>
          [
            ...prev.split("\n").slice(-20), // keep last 20 logs
            args.map((a) => String(a)).join(" "),
          ].join("\n")
        );

        window.__originalConsoleLog?.(...args); // call original
      };
    }
  }, []);

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

    // Try to manually set focus via track (if supported)
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.() as any;
    console.log("Capabilities:", capabilities);

    if ("focusMode" in capabilities || "focusDistance" in capabilities) {
      try {
        const constraints: any = {
          advanced: [],
        };

        // apply focusMode only if it supports auto or continuous
        if (
          "focusMode" in capabilities &&
          (capabilities.focusMode.includes("auto") ||
            capabilities.focusMode.includes("continuous"))
        ) {
          const supportedFocusMode = capabilities.focusMode.inclues("auto")
            ? "auto"
            : "continuous";
          constraints.advanced.push({ focusMode: supportedFocusMode });
          console.log("Supported focus modes:", capabilities.focusMode);
        }
        if ("focusDistance" in capabilities) {
          constraints.advanced.push({
            focusDistance: capabilities.focusDistance.min,
          });
          console.log("focusDistance exists");
        }

        await track.applyConstraints(constraints);
        console.log("Applied focus constraints:", constraints);
      } catch (err) {
        console.log("Failed to apply focus constraints:", err);
      }
    } else {
      console.log("Focus-related capabilities not supported on this device.");
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
        setOcrRawText(result.data.text || "");

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
      <h1 className="title">Audrey's Food Scanner</h1>

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

      {/* {debugText && (
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontSize: "12px",
            color: "#111",
            background: "#f4f4f4",
            padding: "0.5rem",
            border: "1px solid #ccc",
            marginTop: "1rem",
          }}
        >
          <strong>Debug log:</strong>
          <br />
          {debugText}
        </div>
      )} */}

      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline muted className="video" />
        <canvas ref={overlayRef} className="canvas-overlay" />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {detectedAllergens.length > 0 && (
        <div className="warning-box">
          <h2 className="warning-title">Warning: Allergens Found!</h2>
          <ul className="warning-list">
            {detectedAllergens.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {ocrRawText && (
        <div className="ocr-debug">
          <h3>OCR Raw Text:</h3>
          <pre>{ocrRawText}</pre>
        </div>
      )}

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
    </div>
  );
}
