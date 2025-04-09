'use client';
import React, { useState, ChangeEvent, useRef, useEffect } from 'react';
import { getExtractedTexts, saveExtractedText, removeExtractedText } from '../utils/fileStorage';
// Import the modal component (we'll create this next)
// import AddFilesModal from './AddFilesModal';

interface ExtractedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  text: string;
  extractedAt: number;
}

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  input, 
  handleInputChange, 
  handleSubmit,
  isLoading = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [extractedTexts, setExtractedTexts] = useState<Record<string, ExtractedFile>>({});
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  // Load files and texts from localStorage on mount
  useEffect(() => {
    const savedTexts = getExtractedTexts();
    setExtractedTexts(savedTexts);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set to scroll height
    }
  }, [input]); // Re-run effect when input changes

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setViewingFile(null); // Close text viewer when closing modal
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      await processFiles(newFiles);
      event.target.value = ''; 
    }
  };

  const processFiles = async (files: File[]) => {
    setIsFileLoading(true);
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/extract-text', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          throw new Error(`Failed to extract text: ${response.statusText}`);
        }
        const result = await response.json();
        saveExtractedText(
          file.name,
          file.type,
          file.size,
          result.text
        );
        setExtractedTexts(getExtractedTexts());
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }
    setIsFileLoading(false);
  };

  // Handler to set the file to view
  const handleViewText = (fileName: string) => {
    setViewingFile(fileName);
  };

  // Handler to close the text viewer
  const closeTextViewer = () => {
    setViewingFile(null);
  };

  // Handler to delete a file
  const handleDeleteFile = (fileName: string) => {
    removeExtractedText(fileName);
    setExtractedTexts(getExtractedTexts()); // Update state
    // If the deleted file was being viewed, close the viewer
    if (viewingFile === fileName) {
      setViewingFile(null);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="relative w-full">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Do extensive research on python verdict library..."
            rows={3}
            className="box-border w-full p-3 pb-12 border-[1.1px] border-gray-300 rounded-3xl text-lg focus:border-[1.6px] focus:outline-none resize-none overflow-hidden transition-all duration-100 ease-in-out"
          />
          <button
            type="button"
            onClick={openModal}
            className="absolute bottom-4 left-3 px-3 py-1.5 bg-gray-200 rounded-2xl text-md text-gray-700 font-semibold hover:bg-gray-300 transition-colors duration-200 ease-in-out flex items-center space-x-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            <span>add local files (for context)</span>
          </button>
          {/* Submit Button */}
          <button
            type="submit"
            className={`absolute bottom-4 right-3 p-2 ${isLoading ? 'bg-gray-500' : 'bg-[#3C3C3C] hover:bg-gray-800'} rounded-full text-white focus:outline-none focus:ring-2 transition-colors duration-200 ease-in-out`}
            title="Send message"
            disabled={isLoading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" 
              />
            </svg>
          </button>
        </div>
      </form>

      {/* Modal and Text Viewer Container */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-100 ease-in-out ${
          isModalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/10 backdrop-blur-md"
          onClick={closeModal} 
        ></div>

        {/* Centering Container for Modal and Viewer */}
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 gap-4"> 

          {/* Modal Content */}
          <div
            className={`bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg transform transition-all duration-300 ease-in-out ${ 
              isModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it via backdrop
          >
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Add Local Files</h2>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <label className="mb-4 cursor-pointer inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                   <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" />
                </svg>
                Select Files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.md,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
            </label>

            {isFileLoading && (
              <div className="flex items-center justify-center my-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-gray-700">Extracting text...</span>
              </div>
            )}

            {Object.keys(extractedTexts).length > 0 && (
              <div className="my-4 p-3 border border-[#E5E7EB] rounded-lg bg-gray-50">
                <h3 className="text-md font-medium mb-2 text-gray-800">Saved files:</h3>
                <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {Object.keys(extractedTexts).map((fileName) => (
                    <li key={fileName} className="flex justify-between items-center text-sm text-gray-700 bg-white p-2 rounded-lg border border-[#E5E7EB]">
                      {/* Truncated filename */}
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap pr-2" title={fileName}>
                        {fileName}
                      </span>
                      {/* Action Icons */}
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {/* Eye Icon */}
                        <button 
                          onClick={() => handleViewText(fileName)} 
                          className="text-gray-500 transition-transform duration-150 ease-in-out hover:scale-110"
                          title="View Text"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        </button>
                        {/* Garbage Icon */}
                        <button 
                          onClick={() => handleDeleteFile(fileName)} 
                          className="text-gray-500 transition-transform duration-150 ease-in-out hover:scale-110"
                          title="Delete File"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                             <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}            
          </div>

          {/* Text Viewer Panel (Side Window) */}
          {viewingFile && extractedTexts[viewingFile] && (
             <div 
               className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg h-[70vh] flex flex-col transform transition-all duration-300 ease-in-out scale-100 opacity-100"
               onClick={(e) => e.stopPropagation()} // Prevent clicks inside viewer from closing it
             >
               <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200 flex-shrink-0">
                 <h3 className="font-medium text-lg text-gray-800 truncate pr-2" title={viewingFile}>
                   {viewingFile}
                 </h3>
                 <button onClick={closeTextViewer} className="text-gray-500 hover:text-gray-700">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                   </svg>
                 </button>
               </div>
               <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                 <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700">
                   {extractedTexts[viewingFile]?.text || <i>No text available.</i>}
                 </pre>
               </div>
             </div>
          )}

        </div>
      </div>
    </>
  );
};

export default ChatInput; 