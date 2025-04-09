import { NextRequest, NextResponse } from 'next/server';
import * as officeParser from 'officeparser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Extract text using officeparser with the correct API
    const text = await officeParser.parseOfficeAsync(buffer);
    
    return NextResponse.json({ 
      success: true, 
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      text 
    });
  } catch (error) {
    console.error('Error extracting text:', error);
    return NextResponse.json(
      { error: 'Failed to extract text from file' },
      { status: 500 }
    );
  }
} 