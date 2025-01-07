import { supabase } from '@/utils/supabase';
import NotDefteri from '@/components/NotDefteri';

// Server Component
export default async function Home() {
  // Notları server-side'da çek
  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  // Client component'e props olarak geçir
  return <NotDefteri initialNotes={notes || []} />;
}
