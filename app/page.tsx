'use client';

import { useState, useEffect, useRef } from 'react';
import { Trash2, Send } from 'lucide-react';

interface Note {
  id: number;
  title: string;
  content: string;
}

interface Message {
  text: string;
  isAI: boolean;
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchNotes = async () => {
    try {
      const response = await fetch('/api/notes');
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/notes/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      
      if (response.ok) {
        setTitle('');
        setContent('');
        fetchNotes();
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch('/api/notes/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      
      if (response.ok) {
        fetchNotes();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isSending) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setMessages(prev => [...prev, { text: userMessage, isAI: false }]);
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { text: data.reply, isAI: true }]);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        text: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        isAI: true 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="flex gap-8">
        {/* Sol Taraf - Notlar */}
        <div className="flex-1 max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Not Defteri</h1>
          
          <form onSubmit={handleSubmit} className="mb-8">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Başlık"
              className="w-full p-2 mb-4 bg-transparent border rounded"
              required
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="İçerik"
              className="w-full p-2 mb-4 bg-transparent border rounded h-32"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-accent text-white rounded hover:bg-opacity-90"
            >
              Not Ekle
            </button>
          </form>

          <div className="grid gap-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-4 border rounded hover:border-accent transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-xl font-semibold">{note.title}</h2>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
                <p className="text-secondary whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sağ Taraf - AI Sohbet */}
        <div className="w-96 bg-[#2a3f5f]/20 rounded-lg border border-[#2a3f5f] flex flex-col h-[calc(100vh-4rem)]">
          <div className="p-4 border-b border-[#2a3f5f]">
            <h2 className="text-xl font-semibold">AI Asistan</h2>
          </div>
          
          {/* Mesajlar */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.isAI ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.isAI
                      ? 'bg-[#2a3f5f]/40 text-[#f7f8f8]'
                      : 'bg-[#d45a07] text-white'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          
          {/* Mesaj Gönderme */}
          <div className="p-4 border-t border-[#2a3f5f]">
            <div className="relative">
              <input
                type="text"
                placeholder="Bir mesaj yazın..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="w-full bg-[#070910] border border-[#2a3f5f] rounded-lg p-3 pr-12 text-[#f7f8f8] focus:outline-none focus:border-[#d45a07]"
                disabled={isSending}
              />
              <button
                onClick={sendMessage}
                disabled={isSending}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#94a3b8] hover:text-[#d45a07] transition-colors disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
