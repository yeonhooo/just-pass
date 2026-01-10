import { useCallback } from 'react';

interface Props {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export function PdfUploader({ onFileSelect, isLoading }: Props) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="upload-zone"
    >
      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>PDF 파싱 중...</p>
        </div>
      ) : (
        <>
          <div className="upload-icon">📄</div>
          <h2>PDF 파일을 드래그하거나 클릭하세요</h2>
          <p>자격증 덤프 PDF를 업로드하면 퀴즈가 시작됩니다</p>
          <input
            type="file"
            accept=".pdf"
            onChange={handleChange}
            className="file-input"
          />
        </>
      )}
    </div>
  );
}
