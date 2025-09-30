import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Maximize, 
  Minimize, 
  Move,
  X,
  Download,
  Info,
  Trash2
} from 'lucide-react';

interface Photo {
  id?: string | number;
  _id?: string;
  filename?: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  uploaded_at: string;
  downloadUrl?: string;
}

interface PhotoZoomViewerProps {
  photo: Photo;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (photoId: string, filename: string) => void;
  onDelete?: (photoId: string, filename: string) => void;
  showDownloadButton?: boolean;
  showDeleteButton?: boolean;
}

interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
  rotate: number;
}

export default function PhotoZoomViewer({ 
  photo, 
  isOpen, 
  onClose, 
  onDownload,
  onDelete,
  showDownloadButton = false,
  showDeleteButton = false 
}: PhotoZoomViewerProps) {
  console.log('PhotoZoomViewer rendered with:', { photo, isOpen });
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    rotate: 0
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset transform when photo changes or modal opens
  useEffect(() => {
    if (isOpen) {
      resetTransform();
    }
  }, [isOpen, photo]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          resetTransform();
          break;
        case 'r':
        case 'R':
          rotateClockwise();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'i':
        case 'I':
          setShowInfo(!showInfo);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showInfo]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const resetTransform = useCallback(() => {
    setTransform({
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotate: 0
    });
  }, []);

  const zoomIn = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.25, 5)
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(prev.scale / 1.25, 0.1)
    }));
  }, []);

  const rotateClockwise = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      rotate: prev.rotate + 90
    }));
  }, []);

  const rotateCounterClockwise = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      rotate: prev.rotate - 90
    }));
  }, []);

  const fitToScreen = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;
    
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 40; // padding
    const containerHeight = container.clientHeight - 100; // controls space
    
    const imageWidth = photo.width || imageRef.current.naturalWidth;
    const imageHeight = photo.height || imageRef.current.naturalHeight;
    
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    setTransform({
      scale,
      translateX: 0,
      translateY: 0,
      rotate: 0
    });
  }, [photo.width, photo.height]);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const scaleFactor = 1.1;
    
    setTransform(prev => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale * (delta > 0 ? scaleFactor : 1/scaleFactor), 0.1), 5)
    }));
  }, []);

  // Mouse drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - transform.translateX,
      y: e.clientY - transform.translateY
    });
  }, [transform.translateX, transform.translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setTransform(prev => ({
      ...prev,
      translateX: e.clientX - dragStart.x,
      translateY: e.clientY - dragStart.y
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch gesture handling for mobile
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1) {
      // Single touch for dragging
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - transform.translateX,
        y: touch.clientY - transform.translateY
      });
    }
  }, [transform.translateX, transform.translateY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      // Pinch zoom
      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const scaleFactor = distance / lastTouchDistance;
        setTransform(prev => ({
          ...prev,
          scale: Math.min(Math.max(prev.scale * scaleFactor, 0.1), 5)
        }));
      }
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging) {
      // Single touch drag
      const touch = e.touches[0];
      setTransform(prev => ({
        ...prev,
        translateX: touch.clientX - dragStart.x,
        translateY: touch.clientY - dragStart.y
      }));
    }
  }, [isDragging, dragStart, lastTouchDistance]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setLastTouchDistance(0);
  }, []);

  const handleDownload = () => {
    if (onDownload && (photo.id || photo._id)) {
      const photoId = photo.id || photo._id!;
      onDownload(photoId.toString(), photo.original_name);
    }
  };

  const handleDelete = () => {
    if (onDelete && (photo.id || photo._id)) {
      const photoId = photo.id || photo._id!;
      onDelete(photoId.toString(), photo.original_name);
      onClose(); // Close the viewer after delete
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 bg-black z-50 flex flex-col ${isFullscreen ? 'bg-black' : 'bg-black/95'}`}
    >
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white">
          <h3 className="text-lg font-semibold truncate max-w-md">
            {photo.original_name}
          </h3>
          {photo.width && photo.height && (
            <span className="text-sm text-gray-300 bg-black/30 px-2 py-1 rounded">
              {photo.width} × {photo.height}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Photo Info (I)"
          >
            <Info className="h-5 w-5" />
          </button>
          
          {showDownloadButton && onDownload && (
            <button
              onClick={handleDownload}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
          )}

          {showDeleteButton && onDelete && (
            <button
              onClick={handleDelete}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
              title="Delete Photo"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          
          <button
            onClick={toggleFullscreen}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div 
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {photo.downloadUrl && photo.mime_type.startsWith('image/') ? (
          <img
            ref={imageRef}
            src={photo.downloadUrl}
            alt={photo.original_name}
            className="absolute inset-0 m-auto max-w-none"
            style={{
              transform: `scale(${transform.scale}) translate(${transform.translateX / transform.scale}px, ${transform.translateY / transform.scale}px) rotate(${transform.rotate}deg)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
            draggable={false}
            onLoad={fitToScreen}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white">
              <div className="bg-white/10 p-8 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                <Move className="h-12 w-12 text-white/60" />
              </div>
              <p className="text-lg">Preview not available for this file type</p>
              <p className="text-sm text-white/60 mt-2">File format: {photo.mime_type}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-2 p-4 bg-black/50 backdrop-blur-sm">
        <button
          onClick={zoomOut}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        
        <span className="text-white/80 text-sm px-3 py-1 bg-black/30 rounded min-w-16 text-center">
          {Math.round(transform.scale * 100)}%
        </span>
        
        <button
          onClick={zoomIn}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="h-5 w-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-2" />

        <button
          onClick={rotateCounterClockwise}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Rotate Left"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        
        <button
          onClick={rotateClockwise}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Rotate Right (R)"
        >
          <RotateCw className="h-5 w-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-2" />

        <button
          onClick={fitToScreen}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Fit to Screen"
        >
          <Maximize className="h-5 w-5" />
        </button>
        
        <button
          onClick={resetTransform}
          className="px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors text-sm"
          title="Reset View (0)"
        >
          Reset
        </button>
      </div>

      {/* Photo Info Panel */}
      {showInfo && (
        <div className="absolute top-20 right-4 bg-black/80 backdrop-blur-sm text-white p-4 rounded-lg max-w-sm">
          <h4 className="font-semibold mb-2">Photo Information</h4>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-300">Name:</span> {photo.original_name}</div>
            <div><span className="text-gray-300">Size:</span> {formatFileSize(photo.file_size)}</div>
            <div><span className="text-gray-300">Type:</span> {photo.mime_type}</div>
            {photo.width && photo.height && (
              <div><span className="text-gray-300">Dimensions:</span> {photo.width} × {photo.height}</div>
            )}
            <div><span className="text-gray-300">Uploaded:</span> {formatDate(photo.uploaded_at)}</div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-600 text-xs text-gray-400">
            <p>Keyboard shortcuts:</p>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <span>+/- : Zoom</span>
              <span>0 : Reset</span>
              <span>R : Rotate</span>
              <span>F : Fullscreen</span>
              <span>I : Info</span>
              <span>Esc : Close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
