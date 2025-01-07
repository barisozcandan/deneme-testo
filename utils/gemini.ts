import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';

if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
  throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not defined');
}

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

// Yapay zeka ile içerik oluşturma
async function generateContent(prompt: string) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.9,  // Daha yaratıcı içerik için
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    }
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

// Başlık oluşturma fonksiyonu
async function generateTitle(content: string) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 100,
    }
  });

  const titlePrompt = `Aşağıdaki içerik için 50 karakterden kısa, açıklayıcı bir başlık oluştur.
  Başlık konuyu tam olarak yansıtmalı.
  Sadece başlığı yaz, başka bir şey ekleme.
  
  İçerik:
  ${content.substring(0, 500)}...`;

  const result = await model.generateContent(titlePrompt);
  const response = await result.response;
  return response.text().trim();
}

// Not oluşturma fonksiyonu
async function createNote(content: string) {
  try {
    let finalContent = content;
    let title = '';

    // İçeriğin bir AI talebi olup olmadığını kontrol et
    if (content.toLowerCase().includes('hakkında') && 
        (content.includes('oluştur') || content.includes('yaz') || content.includes('anlat'))) {
      
      // AI'dan içerik iste
      const aiPrompt = `${content}

Lütfen bu bilgileri aşağıdaki formatta ver:

[BAŞLIK]
${content.split('hakkında')[0].trim()} Hakkında Bilgiler

[İÇERİK]
• Maddeler halinde, detaylı ve bilgilendirici bilgiler
• Her madde en az 2-3 cümle içermeli
• Bilimsel ve doğru bilgiler kullan
• Türkçe karakterleri düzgün kullan
• Sonunda bir özet paragraf ekle`;

      finalContent = await generateContent(aiPrompt);
    }

    // AI ile başlık oluştur
    title = await generateTitle(finalContent);
    
    const { data, error } = await supabase
      .from('notes')
      .insert([
        {
          title,
          content: finalContent,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Not oluşturulurken hata:', error);
    throw error;
  }
}

// Yapay zeka ile anahtar kelime çıkarma
async function extractKeywordsWithAI(query: string): Promise<string[]> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.4, // Daha fazla çeşitlilik için biraz artırdık
      maxOutputTokens: 1000,
    }
  });

  const keywordPrompt = `Aşağıdaki soruyla ilgili anahtar kelimeleri ve anlamsal olarak bağlantılı tüm kelimeleri bul.
  Kelimeleri önem sırasına göre sırala.
  Her kelime tek satırda olmalı.
  Sadece kelimeleri listele, başka bir şey yazma.
  Türkçe karakter kullanma.
  En az 20, en fazla 30 kelime olsun.
  Eş anlamlı kelimeleri de ekle.
  Zaman ve tarihle ilgili sorularda: gun, ay, yil, saat, dakika gibi zaman birimleri ekle.
  Yer ve konumla ilgili sorularda: adres, semt, mahalle, cadde, sokak gibi konum birimleri ekle.
  Kişilerle ilgili sorularda: isim, soyisim, unvan, rol gibi tanımlayıcılar ekle.
  
  Soru: "${query}"`;

  try {
    const result = await model.generateContent(keywordPrompt);
    const response = await result.response;
    const keywords = response.text()
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    console.log('AI Anahtar Kelimeler:', keywords);
    return keywords;
  } catch (error) {
    console.error('AI anahtar kelime çıkarma hatası:', error);
    // Hata durumunda basit anahtar kelime çıkarma yöntemine geri dön
    return extractKeywordsSimple(query);
  }
}

// Basit anahtar kelime çıkarma (yedek yöntem)
function extractKeywordsSimple(query: string): string[] {
  const stopWords = [
    'var', 'yok', 'mi', 'ne', 'nedir', 'nasıl', 'nerede', 'hangi',
    'bir', 've', 'veya', 'ile', 'için', 'gibi', 'de', 'da', 'ki',
    'bu', 'şu', 'o', 'ben', 'sen', 'biz', 'siz', 'onlar'
  ];

  return query
    .toLowerCase()
    .replace(/[.,?!]/g, '')
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.includes(word));
}

async function searchInNotes(query: string) {
  try {
    // AI ile anahtar kelimeleri çıkar
    const keywords = await extractKeywordsWithAI(query);
    console.log('Arama kelimeleri:', keywords);

    // Her kelime için ayrı bir koşul oluştur
    const conditions = keywords.map(keyword => 
      `content.ilike.%${keyword}%,title.ilike.%${keyword}%`
    ).join(',');

    // Arama yap
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .or(conditions)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Arama hatası:', error);
      throw error;
    }

    console.log('Bulunan notlar:', data);
    return {
      notes: data || [],
      keywords: keywords // Anahtar kelimeleri de döndür
    };
  } catch (error) {
    console.error('Notlarda arama yapılırken hata oluştu:', error);
    return { notes: [], keywords: [] };
  }
}

export async function chat(prompt: string) {
  try {
    // Not oluşturma ve gösterme komutları aynı kalacak...
    if (prompt.toLowerCase().startsWith('not oluştur:') || prompt.toLowerCase().startsWith('not ekle:')) {
      const content = prompt.split(':')[1].trim();
      await createNote(content);
      return 'Not başarıyla oluşturuldu! İçeriği görmek için "son notumu göster" yazabilirsiniz.';
    }

    if (prompt.toLowerCase().includes('son notumu göster')) {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        return `Son notunuz:\n\nBaşlık: ${data[0].title}\n\nİçerik:\n${data[0].content}`;
      }
      return 'Henüz hiç not oluşturmamışsınız.';
    }

    // Arama ve cevaplama
    const { notes, keywords } = await searchInNotes(prompt);
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'text/plain',
      }
    });

    const chat = model.startChat({
      history: []
    });

    let systemPrompt = `Sen bir not asistanısın. Sana verilen notları analiz edip kullanıcının sorularını cevaplayacaksın.

    SORU: "${prompt}"
    
    ANAHTAR KELİMELER:
    ${keywords.join('\n')}

    ÖNEMLİ KURALLAR:
    1. SADECE verilen notlardaki bilgileri kullan
    2. Notlarda olmayan hiçbir bilgiyi uydurma
    3. Eğer bir bilgi bulamazsan "Notlarınızda bu konuda bir bilgi bulamadım" de
    4. Cevap verirken notlardaki bilgileri olduğu gibi kullan
    5. Tarih ve saat bilgilerini dikkate al
    6. Alışveriş ve market ile ilgili sorularda tüm notları dikkatlice kontrol et
    7. Eğer bir notta alışveriş listesi varsa, içeriğini detaylı olarak paylaş
    8. Yanıtını şu formatta ver:
       - Bulduğum notlar: [not başlıkları]
       - İlgili bilgiler: [notlardaki ilgili içerik]
       - Yanıtım: [net ve kısa cevap]`;

    if (notes.length > 0) {
      systemPrompt += "\n\nİLGİLİ NOTLARINIZ:\n";
      notes.forEach(note => {
        systemPrompt += `\n--- Not Başlangıcı ---\nBaşlık: ${note.title}\nİçerik: ${note.content}\nTarih: ${new Date(note.created_at).toLocaleDateString('tr-TR')}\n--- Not Sonu ---\n`;
      });
    } else {
      systemPrompt += "\n\nAradığınız konuyla ilgili notlarda bir bilgi bulunamadı.";
    }

    await chat.sendMessage(systemPrompt);
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('AI sohbet hatası:', error);
    return 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
  }
} 