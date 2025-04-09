'use client';

import React from 'react';
import { useChat, Message } from '@ai-sdk/react';
import MessageList from '@/app/components/MessageList';
import ChatInput from '@/app/components/ChatInput';
import { getExtractedTexts } from '../utils/fileStorage';

export default function ChatPage() {
  const { messages, input, handleInputChange, status, addToolResult, append, setInput } = useChat({
    api: '/api/chat',
    maxSteps: 5,
    async onToolCall({ toolCall }) {
      if (toolCall.toolName === 'getLocation') {
        await new Promise(resolve => setTimeout(resolve, 500)); 
        const cities = [
          'New York',
          'Los Angeles',
          'Chicago',
          'San Francisco',
        ];
        return cities[Math.floor(Math.random() * cities.length)];
      }
    },
  });

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input || status === 'submitted') return;

    const currentContext = typeof window !== 'undefined' ? getExtractedTexts() : {};

    const messageToSend: Message = {
      id: crypto.randomUUID(),
      role: 'user', 
      content: input,
    };

    append(messageToSend, {
      body: {
        localContext: currentContext
      }
    });

    setInput(''); 
  };

  // Calculate isLoading based on status
  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <MessageList messages={messages} addToolResult={addToolResult} isLoading={isLoading} />
      <ChatInput 
        input={input} 
        handleInputChange={handleInputChange} 
        handleSubmit={handleFormSubmit} 
        isLoading={isLoading}
      />
    </div>
  );
}
