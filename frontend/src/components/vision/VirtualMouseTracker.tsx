import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { VirtualMouseStatus } from "../../api/client";
import { wsClient } from "../../api/ws";

interface VirtualMouseTrackerProps {
  enabled: boolean;
  config: VirtualMouseStatus | null;
  showPreview: boolean;
  onGestureChange?: (gesture: string) => void;
  onError?: (err: string) => void;
}

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const dist2d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const fingerExtended = (
  wrist: { x: number; y: number },
  pip: { x: number; y: number },
  tip: { x: number; y: number }
) => dist2d(wrist, tip) > dist2d(wrist, pip) * 1.12;

export const VirtualMouseTracker: React.FC<VirtualMouseTrackerProps> = ({
  enabled,
  config,
  showPreview,
  onGestureChange,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cfgRef = useRef<VirtualMouseStatus | null>(config);
  const [statusText, setStatusText] = useState("Initializing camera...");

  useEffect(() => {
    cfgRef.current = config;
  }, [config]);

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    // Tracking state across frames
    let prevNx = 0.5;
    let prevNy = 0.5;
    let leftPinching = false;
    let leftPinchStartedAt = 0;
    let isDragging = false;
    let rightPinching = false;
    let ringPinching = false;
    let lastRightClick = 0;
    let lastDoubleClick = 0;
    let prevScrollX: number | null = null;
    let prevScrollY: number | null = null;
    let lastVideoTime = -1;
    let lastGestureSent = "";

    const emitMouse = (payload: Record<string, any>) => {
      wsClient.send("VIRTUAL_MOUSE_EVENT", payload);
    };

    const startTracker = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API (getUserMedia) not available in this WebView.");
        }

        setStatusText("Loading MediaPipe HandLandmarker...");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        if (cancelled) return;

        let landmarker: HandLandmarker;
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "/models/hand_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          });
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "/models/hand_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          });
        }
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        setStatusText("Opening webcam...");
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        const camIdx = cfgRef.current?.camera_index ?? 0;

        // Build ordered candidate list so "Device in use" automatically tries fallback cameras
        const orderedDevices = [
          ...(videoDevices[camIdx] ? [videoDevices[camIdx]] : []),
          ...videoDevices.filter((_, i) => i !== camIdx),
        ];

        let stream: MediaStream | null = null;
        let lastCamErr: any = null;

        for (const dev of orderedDevices) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: dev.deviceId
                ? { deviceId: { exact: dev.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
                : { width: { ideal: 640 }, height: { ideal: 480 } },
              audio: false,
            });
            break;
          } catch (e: any) {
            lastCamErr = e;
            await new Promise((r) => setTimeout(r, 150));
          }
        }

        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (e: any) {
            lastCamErr = e;
          }
        }

        if (!stream) {
          const errName = lastCamErr?.name || "";
          const errMsg = lastCamErr?.message || "Camera unavailable";
          if (errName === "NotReadableError" || errMsg.toLowerCase().includes("in use")) {
            throw new Error(
              "Camera is currently in use by another app (Zoom, Teams, Camera app, or browser tab). Close the other app or pick another camera in Virtual Mouse Options."
            );
          }
          throw new Error(errMsg);
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatusText("searching");

        const loop = () => {
          if (cancelled) return;
          const vid = videoRef.current;
          const canvas = canvasRef.current;
          const lmModel = landmarkerRef.current;

          if (vid && canvas && lmModel && vid.readyState >= 2) {
            const w = vid.videoWidth || 640;
            const h = vid.videoHeight || 480;
            if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w;
              canvas.height = h;
            }

            const ctx = canvas.getContext("2d");
            const cfg = cfgRef.current;
            const mirror = cfg?.mirror ?? true;
            const sensitivity = cfg?.sensitivity ?? 1.25;
            const smoothing = cfg?.smoothing ?? 0.35;
            const deadzonePx = cfg?.deadzone ?? 4.0;
            const scrollSpeed = cfg?.scroll_speed ?? 1.0;
            const dragEnabled = cfg?.drag_enabled ?? true;
            const frameMargin = 0.16;

            if (ctx) {
              ctx.save();
              if (mirror) {
                ctx.translate(w, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(vid, 0, 0, w, h);
              ctx.restore();

              // Active tracking box
              ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
              ctx.lineWidth = 1.5;
              ctx.strokeRect(
                frameMargin * w,
                frameMargin * h,
                (1 - 2 * frameMargin) * w,
                (1 - 2 * frameMargin) * h
              );
            }

            if (vid.currentTime !== lastVideoTime) {
              lastVideoTime = vid.currentTime;
              const nowMs = performance.now();
              const res = lmModel.detectForVideo(vid, nowMs);
              let gesture = "searching";

              if (res.landmarks && res.landmarks.length > 0) {
                const rawLm = res.landmarks[0];
                const lm = mirror ? rawLm.map((p) => ({ ...p, x: 1 - p.x })) : rawLm;

                // Draw skeleton + points on canvas
                if (ctx) {
                  ctx.strokeStyle = "rgba(0, 240, 255, 0.7)";
                  ctx.lineWidth = 2;
                  for (const [a, b] of HAND_CONNECTIONS) {
                    ctx.beginPath();
                    ctx.moveTo(lm[a].x * w, lm[a].y * h);
                    ctx.lineTo(lm[b].x * w, lm[b].y * h);
                    ctx.stroke();
                  }
                  ctx.fillStyle = "#34d399";
                  for (const pt of lm) {
                    ctx.beginPath();
                    ctx.arc(pt.x * w, pt.y * h, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }

                const wrist = lm[0];
                const thumbTip = lm[4];
                const indexPip = lm[6];
                const indexTip = lm[8];
                const middleMcp = lm[9];
                const middlePip = lm[10];
                const middleTip = lm[12];
                const ringPip = lm[14];
                const ringTip = lm[16];
                const pinkyPip = lm[18];
                const pinkyTip = lm[20];

                const handScale = Math.max(0.05, dist2d(wrist, middleMcp));
                const leftRatio = dist2d(thumbTip, indexTip) / handScale;
                const rightRatio = dist2d(thumbTip, middleTip) / handScale;
                const ringRatio = dist2d(thumbTip, ringTip) / handScale;

                const indexUp = fingerExtended(wrist, indexPip, indexTip);
                const middleUp = fingerExtended(wrist, middlePip, middleTip);
                const ringUp = fingerExtended(wrist, ringPip, ringTip);
                const pinkyUp = fingerExtended(wrist, pinkyPip, pinkyTip);
                const nowSec = nowMs / 1000;

                // 1. Pause: Fist or Open Palm (all 4 fingers)
                if (
                  (!indexUp && !middleUp && !ringUp && !pinkyUp) ||
                  (indexUp && middleUp && ringUp && pinkyUp)
                ) {
                  gesture = "paused";
                  prevScrollX = null;
                  prevScrollY = null;
                  if (isDragging) {
                    emitMouse({ action: "drag_end", gesture });
                    isDragging = false;
                  }
                  leftPinching = false;
                  rightPinching = false;
                  ringPinching = false;
                }
                // 2. Two-finger Scroll
                else if (
                  indexUp &&
                  middleUp &&
                  !ringUp &&
                  !pinkyUp &&
                  leftRatio > 0.42 &&
                  rightRatio > 0.42
                ) {
                  gesture = "scroll";
                  if (isDragging) {
                    emitMouse({ action: "drag_end", gesture });
                    isDragging = false;
                  }
                  leftPinching = false;

                  const midX = (indexTip.x + middleTip.x) * 0.5;
                  const midY = (indexTip.y + middleTip.y) * 0.5;
                  if (prevScrollY !== null && prevScrollX !== null) {
                    const dy = prevScrollY - midY;
                    const dx = midX - prevScrollX;
                    const wheelY = Math.abs(dy) > 0.008 ? Math.round(dy * 2400 * scrollSpeed) : 0;
                    const wheelX = Math.abs(dx) > 0.015 ? Math.round(dx * 1800 * scrollSpeed) : 0;
                    if (wheelY || wheelX) {
                      emitMouse({ action: "scroll", dy: wheelY, dx: wheelX, gesture });
                    }
                  }
                  prevScrollX = midX;
                  prevScrollY = midY;
                }
                // 3. Cursor Move + Pinch Clicks / Drag
                else {
                  prevScrollX = null;
                  prevScrollY = null;
                  const anchor = leftPinching && !isDragging ? lm[5] : indexTip;

                  if (indexUp || isDragging || leftPinching) {
                    const effMargin = Math.max(0.05, Math.min(0.32, frameMargin + (sensitivity - 1.0) * 0.06));
                    const rawNx = Math.max(0, Math.min(1, (anchor.x - effMargin) / (1 - 2 * effMargin)));
                    const rawNy = Math.max(0, Math.min(1, (anchor.y - effMargin) / (1 - 2 * effMargin)));

                    const distScreen = Math.hypot((rawNx - prevNx) * 1920, (rawNy - prevNy) * 1080);
                    if (distScreen > deadzonePx) {
                      const speedBoost = Math.min(0.45, distScreen / 350);
                      const alpha = Math.max(0.12, Math.min(0.92, smoothing + speedBoost));
                      prevNx = prevNx + (rawNx - prevNx) * alpha;
                      prevNy = prevNy + (rawNy - prevNy) * alpha;
                      if (!(leftPinching && !isDragging && nowSec - leftPinchStartedAt < 0.22)) {
                        emitMouse({
                          action: "move",
                          nx: prevNx,
                          ny: prevNy,
                          gesture: isDragging ? "dragging" : "move",
                        });
                      }
                    }
                    gesture = isDragging ? "dragging" : "move";
                  }

                  if (!leftPinching && leftRatio < 0.34) {
                    leftPinching = true;
                    leftPinchStartedAt = nowSec;
                    gesture = "pinch_hold";
                  } else if (leftPinching) {
                    if (leftRatio > 0.44) {
                      if (isDragging) {
                        emitMouse({ action: "drag_end", gesture: "drop" });
                        isDragging = false;
                        gesture = "drop";
                      } else {
                        emitMouse({ action: "left_click", gesture: "left_click" });
                        gesture = "left_click";
                      }
                      leftPinching = false;
                    } else {
                      if (dragEnabled && !isDragging && nowSec - leftPinchStartedAt >= 0.35) {
                        emitMouse({ action: "drag_start", gesture: "dragging" });
                        isDragging = true;
                      }
                      gesture = isDragging ? "dragging" : "pinch_hold";
                    }
                  }

                  if (!rightPinching && rightRatio < 0.34 && !isDragging) {
                    rightPinching = true;
                    if (nowSec - lastRightClick > 0.5) {
                      emitMouse({ action: "right_click", gesture: "right_click" });
                      lastRightClick = nowSec;
                    }
                    gesture = "right_click";
                  } else if (rightPinching && rightRatio > 0.44) {
                    rightPinching = false;
                  }

                  if (!ringPinching && ringRatio < 0.34 && !isDragging) {
                    ringPinching = true;
                    if (nowSec - lastDoubleClick > 0.6) {
                      emitMouse({ action: "double_click", gesture: "double_click" });
                      lastDoubleClick = nowSec;
                    }
                    gesture = "double_click";
                  } else if (ringPinching && ringRatio > 0.44) {
                    ringPinching = false;
                  }
                }
              } else {
                prevScrollX = null;
                prevScrollY = null;
                if (isDragging) {
                  emitMouse({ action: "drag_end", gesture: "searching" });
                  isDragging = false;
                }
                leftPinching = false;
                rightPinching = false;
                ringPinching = false;
              }

              if (gesture !== lastGestureSent) {
                lastGestureSent = gesture;
                setStatusText(gesture);
                onGestureChange?.(gesture);
              }
            }
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (err: any) {
        const msg = err?.message || "Camera access denied or unavailable";
        setStatusText(msg);
        onError?.(msg);
      }
    };

    startTracker();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [enabled, config?.camera_index]);

  if (!enabled) return null;

  return (
    <div className={showPreview ? "w-full relative bg-black" : "sr-only"}>
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="w-full h-32 md:h-36 object-cover bg-black block" />
      <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-hudCyan">
        {statusText}
      </div>
    </div>
  );
};
