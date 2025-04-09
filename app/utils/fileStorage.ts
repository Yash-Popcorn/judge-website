// fileStorage.ts - Utility functions for handling file storage in localStorage

interface ExtractedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  text: string;
  extractedAt: number; // timestamp
}

const STORAGE_KEY = 'extractedTexts';

/**
 * Save extracted file text to localStorage
 */
export const saveExtractedText = (fileName: string, fileType: string, fileSize: number, text: string): void => {
  try {
    // Get existing data
    const existingData = getExtractedTexts();
    
    // Add or update file data
    existingData[fileName] = {
      fileName,
      fileType,
      fileSize,
      text,
      extractedAt: Date.now()
    };
    
    // Save back to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

/**
 * Get all extracted texts from localStorage
 */
export const getExtractedTexts = (): Record<string, ExtractedFile> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error retrieving from localStorage:', error);
    return {};
  }
};

/**
 * Get extracted text for a specific file
 */
export const getExtractedText = (fileName: string): ExtractedFile | null => {
  const texts = getExtractedTexts();
  return texts[fileName] || null;
};

/**
 * Remove an extracted text from storage
 */
export const removeExtractedText = (fileName: string): void => {
  try {
    const existingData = getExtractedTexts();
    if (existingData[fileName]) {
      delete existingData[fileName];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
    }
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
};

/**
 * Clear all extracted texts from storage
 */
export const clearExtractedTexts = (): void => {
  localStorage.removeItem(STORAGE_KEY);
}; 