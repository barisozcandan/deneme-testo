'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, Send } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { chat } from '@/utils/gemini';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
}

interface Message {
  text: string;
  isAI: boolean;
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchNotes(searchQuery);
    } else {
      fetchNotes();
    }
  }, [searchQuery]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Notlar yüklenirken hata oluştu:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchNotes = async (query: string) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .textSearch('content', query, {
          type: 'plain',
          config: 'turkish'
        })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Arama yapılırken hata oluştu:', error);
    }
  };

  const addNote = async () => {
    if (!title.trim() || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('notes')
        .insert([
          {
            title,
            content,
          },
        ]);

      if (error) throw error;

      setTitle('');
      setContent('');
      fetchNotes();
    } catch (error) {
      console.error('Not eklenirken hata oluştu:', error);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchNotes();
    } catch (error) {
      console.error('Not silinirken hata oluştu:', error);
    }
  };

  // Not içeriğinde aranan kelimeyi vurgulama
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <span key={index} className="bg-[#d45a07]/20 text-[#d45a07]">{part}</span> : 
        part
    );
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isSending) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setMessages(prev => [...prev, { text: userMessage, isAI: false }]);
    setIsSending(true);

    try {
      const response = await chat(userMessage);
      setMessages(prev => [...prev, { text: response, isAI: true }]);
    } catch (error) {
      console.error('Mesaj gönderilirken hata oluştu:', error);
      setMessages(prev => [...prev, { 
        text: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.', 
        isAI: true 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070910] text-[#f7f8f8] p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Yükleniyor...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070910] text-[#f7f8f8] p-8">
      <div className="flex gap-8">
        {/* Sol Taraf - Notlar */}
        <div className="flex-1 max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Not Defterim</h1>
          
          {/* Arama Kutusu */}
          <div className="relative mb-8">
            <input
              type="text"
              placeholder="Notlarda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#070910] border border-[#2a3f5f] rounded-lg p-3 pl-12 text-[#f7f8f8] focus:outline-none focus:border-[#d45a07]"
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#94a3b8]" size={20} />
          </div>
          
          {/* Not Ekleme Formu */}
          <div className="bg-[#2a3f5f]/20 p-6 rounded-lg mb-8 border border-[#2a3f5f]">
            <input
              type="text"
              placeholder="Başlık"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#070910] border border-[#2a3f5f] rounded-lg p-3 mb-4 text-[#f7f8f8] focus:outline-none focus:border-[#d45a07]"
            />
            <textarea
              placeholder="Notunuzu buraya yazın..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-[#070910] border border-[#2a3f5f] rounded-lg p-3 mb-4 h-32 text-[#f7f8f8] focus:outline-none focus:border-[#d45a07]"
            />
            <button
              onClick={addNote}
              className="flex items-center gap-2 bg-[#d45a07] text-white px-6 py-2 rounded-lg hover:bg-[#d45a07]/90 transition-colors"
            >
              <Plus size={20} />
              Not Ekle
            </button>
          </div>

          {/* Notlar Listesi */}
          <div className="grid gap-4">
            {notes.length === 0 && searchQuery && (
              <div className="text-center text-[#94a3b8] py-8">
                Arama sonucu bulunamadı.
              </div>
            )}
            {notes.map((note, index) => (
              <div
                key={note.id}
                className="bg-[#2a3f5f]/20 p-6 rounded-lg border border-[#2a3f5f] relative group"
              >
                <div className="absolute top-4 left-4 bg-[#d45a07] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="absolute top-4 right-4 text-[#94a3b8] hover:text-[#d45a07] transition-colors"
                >
                  <Trash2 size={20} />
                </button>
                <h2 className="text-xl font-semibold mb-2 pl-10">{note.title}</h2>
                <p className="text-[#94a3b8] whitespace-pre-wrap">
                  {searchQuery ? highlightText(note.content, searchQuery) : note.content}
                </p>
                <div className="mt-4 text-sm text-[#94a3b8]">
                  {new Date(note.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
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
