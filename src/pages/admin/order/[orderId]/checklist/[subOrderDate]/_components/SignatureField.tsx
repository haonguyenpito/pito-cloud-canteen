import React, { useCallback, useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import classNames from 'classnames';

import { Button } from '@components/ui/button';

type SignatureFieldProps = {
  value?: string; // Base64 image data
  onChange: (signature: string | null) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export const SignatureField: React.FC<SignatureFieldProps> = ({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  className,
}) => {
  const signatureRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const isInternalUpdateRef = useRef(false);
  const handleEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Storage for signature data to survive resizes
  const lastSignatureImageRef = useRef<string | null>(null);
  const lastSignatureStrokesRef = useRef<any[] | null>(null);
  const lastKnownSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );

  // Function to capture current state
  const captureCurrentState = useCallback(() => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      lastSignatureImageRef.current =
        signatureRef.current.toDataURL('image/png');
      try {
        lastSignatureStrokesRef.current = signatureRef.current.toData();
      } catch {
        lastSignatureStrokesRef.current = null;
      }
      const canvas = signatureRef.current.getCanvas();
      lastKnownSizeRef.current = { width: canvas.width, height: canvas.height };
      setIsSigned(true);
    } else {
      setIsSigned(false);
    }
  }, []);

  // Function to restore state onto current canvas size
  const restoreState = useCallback(() => {
    if (!signatureRef.current) return;

    const canvas = signatureRef.current.getCanvas();
    const currentWidth = canvas.width;
    const currentHeight = canvas.height;

    if (!currentWidth || !currentHeight) return;

    if (
      lastSignatureStrokesRef.current &&
      lastSignatureStrokesRef.current.length > 0 &&
      lastKnownSizeRef.current
    ) {
      // Calculate scale based on width change
      const scale = currentWidth / lastKnownSizeRef.current.width;

      // Find original vertical center to preserve positioning
      let minY = Infinity;
      let maxY = -Infinity;
      lastSignatureStrokesRef.current.forEach((stroke) => {
        stroke.points.forEach((p: any) => {
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
      });
      const originalCenterY = (minY + maxY) / 2;

      const scaledStrokes = lastSignatureStrokesRef.current.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((p: any) => ({
          ...p,
          x: p.x * scale,
          y: p.y * scale, // Uniform scaling to prevent distortion
        })),
      }));

      // Adjust Y offset to keep the signature vertically centered
      const newCenterY = originalCenterY * scale;
      const targetCenterY = currentHeight / 2;
      const offsetY = targetCenterY - newCenterY;

      const finalStrokes = scaledStrokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((p: any) => ({
          ...p,
          y: p.y + offsetY,
        })),
      }));

      signatureRef.current.clear();
      signatureRef.current.fromData(finalStrokes);

      // Update last known size to new size
      lastKnownSizeRef.current = { width: currentWidth, height: currentHeight };
      lastSignatureStrokesRef.current = finalStrokes;
    } else if (lastSignatureImageRef.current) {
      // Fallback for image data (e.g. from API)
      const img = new Image();
      img.src = lastSignatureImageRef.current;
      img.onload = () => {
        if (!signatureRef.current) return;
        const sigCanvas = signatureRef.current.getCanvas();
        // Check if canvas size is still the same as when we started loading
        if (
          sigCanvas.width !== currentWidth ||
          sigCanvas.height !== currentHeight
        ) {
          return;
        }

        const ctx = sigCanvas.getContext('2d');
        if (!ctx) return;

        signatureRef.current.clear();
        const scale = Math.min(
          currentWidth / img.width,
          currentHeight / img.height,
        );
        const x = currentWidth / 2 - (img.width / 2) * scale;
        const y = currentHeight / 2 - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        // After drawing image, we can now set lastKnownSizeRef
        lastKnownSizeRef.current = {
          width: currentWidth,
          height: currentHeight,
        };
        setIsSigned(true);
      };
    }
  }, []);

  // Calculate canvas size based on container
  const updateCanvasSize = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      if (!containerWidth) return;
      const containerHeight = 200;

      setCanvasSize((prev) => {
        if (prev.width === containerWidth && prev.height === containerHeight) {
          return prev;
        }

        return { width: containerWidth, height: containerHeight };
      });
    }
  }, []);

  useEffect(() => {
    // Initial resize
    updateCanvasSize();
    const timer = setTimeout(updateCanvasSize, 100);
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [updateCanvasSize]);

  // When canvas size changes via React props, we need to restore the content
  useEffect(() => {
    if (canvasSize.width > 0) {
      const timer = setTimeout(restoreState, 50);

      return () => clearTimeout(timer);
    }
  }, [canvasSize, restoreState]);

  // Handle external value changes (initial load from API)
  useEffect(() => {
    if (!isInternalUpdateRef.current && value) {
      lastSignatureImageRef.current = value;
      lastSignatureStrokesRef.current = null;
      if (canvasSize.width > 0) {
        restoreState();
      }
    } else if (!isInternalUpdateRef.current && !value && isSigned) {
      signatureRef.current?.clear();
      lastSignatureImageRef.current = null;
      lastSignatureStrokesRef.current = null;
      lastKnownSizeRef.current = null;
      setIsSigned(false);
    }
  }, [value, restoreState, canvasSize.width, isSigned]);

  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      isInternalUpdateRef.current = true;
      onChange(null);
      setIsSigned(false);
      lastSignatureImageRef.current = null;
      lastSignatureStrokesRef.current = null;
      lastKnownSizeRef.current = null;
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 100);
    }
  };

  const handleEnd = () => {
    if (handleEndTimeoutRef.current) clearTimeout(handleEndTimeoutRef.current);

    handleEndTimeoutRef.current = setTimeout(() => {
      if (signatureRef.current && !signatureRef.current.isEmpty()) {
        const dataURL = signatureRef.current.toDataURL('image/png');
        captureCurrentState();
        isInternalUpdateRef.current = true;
        onChange(dataURL);
        setTimeout(() => {
          isInternalUpdateRef.current = false;
        }, 100);
      } else {
        setIsSigned(false);
      }
    }, 150);
  };

  return (
    <div className={classNames('flex flex-col gap-2', className)}>
      <label className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div
        ref={containerRef}
        className={classNames(
          'relative border-2 border-gray-300 rounded-lg bg-white w-full overflow-hidden',
          {
            'pointer-events-none opacity-50': disabled,
          },
        )}>
        <SignatureCanvas
          ref={signatureRef}
          canvasProps={{
            width: canvasSize.width || 500, // Default fallback
            height: canvasSize.height || 200,
            className: 'block touch-none',
          }}
          onEnd={handleEnd}
          backgroundColor="white"
          penColor="black"
          clearOnResize={false}
          velocityFilterWeight={0.7}
        />
      </div>
      <div className="flex gap-2 items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={disabled || !isSigned}>
          Xóa chữ ký
        </Button>
        <p className="text-xs text-gray-500">
          Vui lòng ký tên trong khung trên
        </p>
      </div>
    </div>
  );
};
