import { useState, useEffect } from 'react';
import { Clock, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInSeconds, startOfDay, endOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';

type PontoTipo = 'entrada' | 'saida';

interface PontoRecord {
  id: string;
  tipo: PontoTipo;
  timestamp: string;
}

export function ClockWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isWorking, setIsWorking] = useState(false);
  const [lastEntry, setLastEntry] = useState<Date | null>(null);
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate working time
  useEffect(() => {
    if (isWorking && lastEntry) {
      const timer = setInterval(() => {
        const now = new Date();
        const elapsed = differenceInSeconds(now, lastEntry);
        setTodaySeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isWorking, lastEntry]);

  // Fetch today's records
  useEffect(() => {
    if (user) {
      fetchTodayRecords();
    }
  }, [user]);

  const fetchTodayRecords = async () => {
    if (!user) return;

    const today = new Date();
    const { data, error } = await supabase
      .from('ponto')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', startOfDay(today).toISOString())
      .lte('timestamp', endOfDay(today).toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching ponto:', error);
      return;
    }

    if (data && data.length > 0) {
      // Calculate total worked time
      let totalSeconds = 0;
      let entryTime: Date | null = null;

      for (const record of data) {
        if (record.tipo === 'entrada') {
          entryTime = new Date(record.timestamp);
        } else if (record.tipo === 'saida' && entryTime) {
          totalSeconds += differenceInSeconds(new Date(record.timestamp), entryTime);
          entryTime = null;
        }
      }

      // Check if currently working
      const lastRecord = data[data.length - 1];
      if (lastRecord.tipo === 'entrada') {
        setIsWorking(true);
        setLastEntry(new Date(lastRecord.timestamp));
        totalSeconds += differenceInSeconds(new Date(), new Date(lastRecord.timestamp));
      } else {
        setIsWorking(false);
        setLastEntry(null);
      }

      setTodaySeconds(totalSeconds);
    }
  };

  const handlePunch = async () => {
    if (!user) {
      console.log('handlePunch: No user found');
      return;
    }

    console.log('handlePunch called, isWorking:', isWorking);
    setLoading(true);
    const tipo: PontoTipo = isWorking ? 'saida' : 'entrada';

    console.log('Inserting ponto:', { user_id: user.id, tipo });
    
    const { data, error } = await supabase.from('ponto').insert({
      user_id: user.id,
      tipo,
      timestamp: new Date().toISOString(),
    }).select();

    console.log('Ponto insert result:', { data, error });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível registar o ponto.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: tipo === 'entrada' ? 'Entrada registada' : 'Saída registada',
        description: `Ponto registado às ${format(new Date(), 'HH:mm')}`,
      });
      
      if (tipo === 'entrada') {
        setIsWorking(true);
        setLastEntry(new Date());
      } else {
        setIsWorking(false);
        setLastEntry(null);
      }
      
      // Refresh today's records
      fetchTodayRecords();
    }

    setLoading(false);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-soft">
      <div className={`absolute inset-0 transition-all duration-500 ${
        isWorking 
          ? 'bg-gradient-to-br from-success/10 to-success/5' 
          : 'bg-gradient-to-br from-muted to-background'
      }`} />
      
      <CardContent className="relative p-8">
        <div className="flex flex-col items-center space-y-6">
          {/* Current Time */}
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {format(currentTime, "EEEE, d 'de' MMMM", { locale: pt })}
            </p>
            <p className="text-5xl font-light tracking-tight mt-1">
              {format(currentTime, 'HH:mm:ss')}
            </p>
          </div>

          {/* Punch Button */}
          <div className="relative">
            {isWorking && (
              <div className="absolute inset-0 rounded-full bg-success/20 animate-pulse-ring" />
            )}
            <Button
              size="lg"
              onClick={handlePunch}
              disabled={loading}
              className={`h-32 w-32 rounded-full text-lg font-medium transition-all duration-300 ${
                isWorking 
                  ? 'bg-destructive hover:bg-destructive/90 shadow-glow-destructive' 
                  : 'bg-success hover:bg-success/90 shadow-glow-success'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                {isWorking ? (
                  <>
                    <Square className="h-8 w-8" />
                    <span>Saída</span>
                  </>
                ) : (
                  <>
                    <Play className="h-8 w-8 ml-1" />
                    <span>Entrada</span>
                  </>
                )}
              </div>
            </Button>
          </div>

          {/* Status */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isWorking ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-sm font-medium">
                {isWorking ? 'A trabalhar' : 'Fora de serviço'}
              </span>
            </div>
            <p className="text-3xl font-semibold tracking-tight">
              {formatDuration(todaySeconds)}
            </p>
            <p className="text-xs text-muted-foreground">Tempo trabalhado hoje</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
