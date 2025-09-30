import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test-utils';
import PhotoZoomViewer from '../PhotoZoomViewer';
import { mockPhoto } from '../../test-utils';

describe('PhotoZoomViewer', () => {
  const mockOnClose = vi.fn();
  const mockOnDownload = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(mockPhoto.original_name)).not.toBeInTheDocument();
  });

  it('should render photo information when isOpen is true', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(mockPhoto.original_name)).toBeInTheDocument();
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByTitle('Close (Esc)');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('should call onClose when Escape key is pressed', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('should show download button when showDownloadButton is true', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
        onDownload={mockOnDownload}
        showDownloadButton={true}
      />
    );

    expect(screen.getByTitle('Download')).toBeInTheDocument();
  });

  it('should show delete button when showDeleteButton is true', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
        onDelete={mockOnDelete}
        showDeleteButton={true}
      />
    );

    expect(screen.getByTitle('Delete Photo')).toBeInTheDocument();
  });

  it('should call onDownload when download button is clicked', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
        onDownload={mockOnDownload}
        showDownloadButton={true}
      />
    );

    const downloadButton = screen.getByTitle('Download');
    fireEvent.click(downloadButton);

    expect(mockOnDownload).toHaveBeenCalledWith('1', mockPhoto.original_name);
  });

  it('should call onDelete and onClose when delete button is clicked', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
        onDelete={mockOnDelete}
        showDeleteButton={true}
      />
    );

    const deleteButton = screen.getByTitle('Delete Photo');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('1', mockPhoto.original_name);
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('should handle zoom controls', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const zoomInButton = screen.getByTitle('Zoom In (+)');
    const zoomOutButton = screen.getByTitle('Zoom Out (-)');

    expect(zoomInButton).toBeInTheDocument();
    expect(zoomOutButton).toBeInTheDocument();

    // Test zoom functionality
    fireEvent.click(zoomInButton);
    fireEvent.click(zoomOutButton);
  });

  it('should handle rotation controls', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const rotateRightButton = screen.getByTitle('Rotate Right (R)');
    const rotateLeftButton = screen.getByTitle('Rotate Left');

    expect(rotateRightButton).toBeInTheDocument();
    expect(rotateLeftButton).toBeInTheDocument();

    fireEvent.click(rotateRightButton);
    fireEvent.click(rotateLeftButton);
  });

  it('should toggle info panel when info button is clicked', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const infoButton = screen.getByTitle('Photo Info (I)');
    fireEvent.click(infoButton);

    expect(screen.getByText('Photo Information')).toBeInTheDocument();
    expect(screen.getByText('1.00 MB')).toBeInTheDocument();
    expect(screen.getByText('image/jpeg')).toBeInTheDocument();
  });

  it('should handle keyboard shortcuts', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Test zoom shortcuts
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '-' });
    fireEvent.keyDown(window, { key: '0' });

    // Test rotation shortcut
    fireEvent.keyDown(window, { key: 'r' });

    // Test info toggle
    fireEvent.keyDown(window, { key: 'i' });
  });

  it('should handle non-image files', () => {
    const nonImagePhoto = {
      ...mockPhoto,
      mime_type: 'application/pdf',
      downloadUrl: undefined
    };

    render(
      <PhotoZoomViewer
        photo={nonImagePhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Preview not available for this file type')).toBeInTheDocument();
    expect(screen.getByText('File format: application/pdf')).toBeInTheDocument();
  });

  it('should handle photos with _id instead of id', () => {
    const mongoPhoto = {
      ...mockPhoto,
      _id: 'mongo-id-123',
      id: undefined
    };
    delete mongoPhoto.id;

    render(
      <PhotoZoomViewer
        photo={mongoPhoto}
        isOpen={true}
        onClose={mockOnClose}
        onDownload={mockOnDownload}
        showDownloadButton={true}
      />
    );

    const downloadButton = screen.getByTitle('Download');
    fireEvent.click(downloadButton);

    expect(mockOnDownload).toHaveBeenCalledWith('mongo-id-123', mockPhoto.original_name);
  });

  it('should show zoom percentage', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should have fullscreen toggle button', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const fullscreenButton = screen.getByTitle('Toggle Fullscreen (F)');
    expect(fullscreenButton).toBeInTheDocument();
  });

  it('should have reset view button', () => {
    render(
      <PhotoZoomViewer
        photo={mockPhoto}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const resetButton = screen.getByTitle('Reset View (0)');
    expect(resetButton).toBeInTheDocument();
  });
});
