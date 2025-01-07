import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase';
import { NextRequest, NextResponse } from 'next/server';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not defined');
}

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    const supabase = createClient();

    // Notları getir
    const { data: notes } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    // Model yapılandırması
    const model = genAI.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    // Sohbet başlat
    const chat = model.startChat({
      history: [],
    });

    // Sistem talimatlarını ve notları hazırla
    let systemPrompt = `Sen bir not asistanısın. Sana verilen notları analiz edip kullanıcının sorularını cevaplayacaksın.

    SORU: "${message}"
    
    ÖNEMLİ KURALLAR:
    1. SADECE verilen notlardaki bilgileri kullan
    2. Notlarda olmayan hiçbir bilgiyi uydurma
    3. Eğer bir bilgi bulamazsan "Notlarınızda bu konuda bir bilgi bulamadım" de
    4. Cevap verirken notlardaki bilgileri olduğu gibi kullan
    5. Yanıtını şu formatta ver:
       - İlgili notlar: [not başlıkları]
       - Yanıtım: [net ve kısa cevap]`;

    if (notes && notes.length > 0) {
      systemPrompt += "\n\nİLGİLİ NOTLARINIZ:\n";
      notes.forEach((note: Note) => {
        systemPrompt += `\n--- Not Başlangıcı ---\nBaşlık: ${note.title}\nİçerik: ${note.content}\n--- Not Sonu ---\n`;
      });
    } else {
      systemPrompt += "\n\nHenüz hiç not eklenmemiş.";
    }

    // AI'dan yanıt al
    await chat.sendMessage(systemPrompt);
    const result = await chat.sendMessage(message);
    const response = await result.response;
    
    return NextResponse.json({ reply: response.text() });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'AI yanıt üretirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 