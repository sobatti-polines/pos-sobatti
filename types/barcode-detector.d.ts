// Minimal ambient type declaration for the BarcodeDetector Web API.
// Full spec: https://wicg.github.io/shape-detection-api/#barcode-detection-api

interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: ReadonlyArray<{ x: number; y: number }>;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(
    image: ImageBitmapSource | HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<DetectedBarcode[]>;
}
