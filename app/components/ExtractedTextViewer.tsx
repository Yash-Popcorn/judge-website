'use client';
import React, { useState, useEffect } from 'react';
import { getExtractedTexts } from '../utils/fileStorage';

interface ExtractedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  text: string;
  extractedAt: number;
}

const ExtractedTextViewer = () => {
  const [extractedTexts, setExtractedTexts] = useState<Record<string, ExtractedFile>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    // Load files on component mount
    loadExtractedTexts();
  }, []);

  const loadExtractedTexts = () => {
    const texts = getExtractedTexts();
    setExtractedTexts(texts);
    
    // Auto-select first file if none selected
    if (!selectedFile && Object.keys(texts).length > 0) {
      setSelectedFile(Object.keys(texts)[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleFileSelect = (fileName: string) => {
    setSelectedFile(fileName);
  };

  // Get the selected file data
  const selectedFileData = selectedFile ? extractedTexts[selectedFile] : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 p-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-800">Extracted Text</h2>
      </div>
      
      {Object.keys(extractedTexts).length === 0 ? (
        <div className="p-5 text-center text-gray-500">
          No files have been processed yet
        </div>
      ) : (
        <div className="flex flex-col md:flex-row">
          {/* File list sidebar */}
          <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200">
            <div className="p-3">
              <h3 className="font-medium text-gray-700 text-sm mb-2">Files</h3>
              <ul className="space-y-1">
                {Object.keys(extractedTexts).map(fileName => (
                  <li key={fileName}>
                    <button
                      onClick={() => handleFileSelect(fileName)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedFile === fileName
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {fileName}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Text content panel */}
          <div className="flex-1 overflow-auto">
            {selectedFileData ? (
              <div className="p-4">
                <div className="mb-4 pb-3 border-b border-gray-200">
                  <h3 className="font-medium text-lg text-gray-800 mb-1">
                    {selectedFileData.fileName}
                  </h3>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-x-4">
                    <span>{selectedFileData.fileType}</span>
                    <span>{formatFileSize(selectedFileData.fileSize)}</span>
                    <span>Extracted: {formatDate(selectedFileData.extractedAt)}</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap font-mono text-sm">
                  {selectedFileData.text || <i>No text could be extracted</i>}
                </div>
              </div>
            ) : (
              <div className="p-5 text-center text-gray-500">
                Select a file to view its content
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractedTextViewer; 