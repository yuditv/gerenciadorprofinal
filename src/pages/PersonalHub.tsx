import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Target, Quote, ExternalLink, Plus, Check, Trash2, ChevronRight, Zap, Star, Trophy, Flame, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ── Motivational quotes ────────────────────────────────
const QUOTES = [
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Não espere por oportunidades extraordinárias. Agarre ocasiões comuns e as torne grandes.", author: "Orison Swett Marden" },
  { text: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
  { text: "O único lugar onde o sucesso vem antes do trabalho é no dicionário.", author: "Albert Einstein" },
  { text: "Acredite que você pode e você já está no meio do caminho.", author: "Theodore Roosevelt" },
  { text: "Grandes coisas nunca vieram de zonas de conforto.", author: "Neil Strauss" },
  { text: "Sua única limitação é você mesmo.", author: "Desconhecido" },
  { text: "Discipline é a ponte entre metas e conquistas.", author: "Jim Rohn" },
  { text: "O futuro pertence àqueles que acreditam na beleza de seus sonhos.", author: "Eleanor Roosevelt" },
  { text: "Não tenha medo de desistir do bom para perseguir o ótimo.", author: "John D. Rockefeller" },
];

// ── Types ──────────────────────────────────────────────
interface Goal {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

interface QuickLink {
  id: string;
  title: string;
  url: string;
  color: string;
}

interface Alarm {
  id: string;
  time: string; // HH:mm
  label: string;
  active: boolean;
}

const COLORS = [
  'from-primary to-accent',
  'from-blue-600 to-cyan-500',
  'from-green-600 to-emerald-400',
  'from-orange-600 to-yellow-500',
  'from-pink-600 to-rose-400',
  'from-violet-600 to-purple-400',
];

// ── Persist helpers ────────────────────────────────────
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Digital Clock ──────────────────────────────────────
function DigitalClock({ alarms, onAlarmTriggered }: { alarms: Alarm[]; onAlarmTriggered: (a: Alarm) => void }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Check alarms
  useEffect(() => {
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const seconds = now.getSeconds();
    if (seconds === 0) {
      alarms.filter(a => a.active && a.time === hhmm).forEach(onAlarmTriggered);
    }
  }, [now, alarms, onAlarmTriggered]);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 font-mono">
        <span className="text-5xl md:text-7xl font-bold text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.6)]">
          {hours}
        </span>
        <motion.span
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-5xl md:text-7xl font-bold text-primary/60"
        >
          :
        </motion.span>
        <span className="text-5xl md:text-7xl font-bold text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.6)]">
          {minutes}
        </span>
        <span className="text-2xl md:text-3xl font-bold text-accent self-end mb-1 ml-1">
          {seconds}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-2 capitalize">{weekday} — {date}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────
export default function PersonalHub() {
  const navigate = useNavigate();
  // State
  const [goals, setGoals] = useState<Goal[]>(() => loadJSON('hub-goals', []));
  const [links, setLinks] = useState<QuickLink[]>(() => loadJSON('hub-links', []));
  const [alarms, setAlarms] = useState<Alarm[]>(() => loadJSON('hub-alarms', []));
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [newGoal, setNewGoal] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newAlarmTime, setNewAlarmTime] = useState('07:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [alarmDialogOpen, setAlarmDialogOpen] = useState(false);

  // Persist
  useEffect(() => saveJSON('hub-goals', goals), [goals]);
  useEffect(() => saveJSON('hub-links', links), [links]);
  useEffect(() => saveJSON('hub-alarms', alarms), [alarms]);

  // Rotate quote every 30s
  useEffect(() => {
    const id = setInterval(() => setQuoteIndex(i => (i + 1) % QUOTES.length), 30000);
    return () => clearInterval(id);
  }, []);

  // Goals
  const addGoal = useCallback(() => {
    if (!newGoal.trim()) return;
    setGoals(prev => [...prev, { id: crypto.randomUUID(), title: newGoal.trim(), completed: false, createdAt: Date.now() }]);
    setNewGoal('');
  }, [newGoal]);

  const toggleGoal = useCallback((id: string) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  }, []);

  const removeGoal = useCallback((id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  }, []);

  // Links
  const addLink = useCallback(() => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    const color = COLORS[links.length % COLORS.length];
    setLinks(prev => [...prev, { id: crypto.randomUUID(), title: newLinkTitle.trim(), url: newLinkUrl.trim(), color }]);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setLinkDialogOpen(false);
  }, [newLinkTitle, newLinkUrl, links.length]);

  const removeLink = useCallback((id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
  }, []);

  // Alarms
  const addAlarm = useCallback(() => {
    if (!newAlarmTime) return;
    setAlarms(prev => [...prev, { id: crypto.randomUUID(), time: newAlarmTime, label: newAlarmLabel.trim() || 'Alarme', active: true }]);
    setNewAlarmLabel('');
    setAlarmDialogOpen(false);
  }, [newAlarmTime, newAlarmLabel]);

  const toggleAlarm = useCallback((id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  }, []);

  const removeAlarm = useCallback((id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
  }, []);

  const onAlarmTriggered = useCallback((alarm: Alarm) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`⏰ ${alarm.label}`, { body: `Alarme: ${alarm.time}` });
    }
    // Play a subtle beep
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // Stats
  const completedGoals = useMemo(() => goals.filter(g => g.completed).length, [goals]);
  const totalGoals = goals.length;
  const progressPercent = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  const quote = QUOTES[quoteIndex];

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-1"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          <span className="text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.5)]">Hub</span> Pessoal
        </h1>
        <p className="text-sm text-muted-foreground">Seu centro de controle</p>
      </motion.div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* ── Clock & Alarms Column ── */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6 bg-card/60 border-border/40 backdrop-blur-sm relative overflow-hidden">
            {/* Subtle glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
            
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Relógio</h2>
            </div>

            <DigitalClock alarms={alarms} onAlarmTriggered={onAlarmTriggered} />

            {/* Alarms */}
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alarmes</span>
                <Dialog open={alarmDialogOpen} onOpenChange={setAlarmDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Novo Alarme</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input type="time" value={newAlarmTime} onChange={e => setNewAlarmTime(e.target.value)} />
                      <Input placeholder="Rótulo (opcional)" value={newAlarmLabel} onChange={e => setNewAlarmLabel(e.target.value)} />
                      <Button onClick={addAlarm} className="w-full">Adicionar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {alarms.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 text-center py-2">Nenhum alarme</p>
              ) : (
                <div className="space-y-1.5">
                  {alarms.map(a => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/30 border border-border/30">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleAlarm(a.id)} className={cn("text-lg font-mono font-bold transition-colors", a.active ? "text-primary" : "text-muted-foreground/40 line-through")}>
                          {a.time}
                        </button>
                        <span className="text-xs text-muted-foreground">{a.label}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeAlarm(a.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── Goals Column ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 bg-card/60 border-border/40 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-accent/5 blur-3xl" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-foreground">Metas</h2>
              </div>
              {totalGoals > 0 && (
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-accent" />
                  <span className="text-xs font-medium text-muted-foreground">{completedGoals}/{totalGoals}</span>
                </div>
              )}
            </div>

            {/* Progress */}
            {totalGoals > 0 && (
              <div className="mb-4">
                <Progress value={progressPercent} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{progressPercent}% concluído</p>
              </div>
            )}

            {/* Add goal */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Nova meta..."
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGoal()}
                className="bg-muted/30 border-border/30"
              />
              <Button size="icon" onClick={addGoal} disabled={!newGoal.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Goals list */}
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {goals.map(g => (
                    <motion.div
                      key={g.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/20 border border-border/20 group"
                    >
                      <button
                        onClick={() => toggleGoal(g.id)}
                        className={cn(
                          "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                          g.completed
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30 hover:border-primary/60"
                        )}
                      >
                        {g.completed && <Check className="h-3 w-3" />}
                      </button>
                      <span className={cn("flex-1 text-sm transition-colors", g.completed && "line-through text-muted-foreground/50")}>
                        {g.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => removeGoal(g.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {goals.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-6">Adicione sua primeira meta ⚡</p>
                )}
              </div>
            </ScrollArea>
          </Card>
        </motion.div>

        {/* ── Quote Column ── */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6 bg-card/60 border-border/40 backdrop-blur-sm relative overflow-hidden flex flex-col justify-between min-h-[280px]">
            <div className="absolute -top-16 -left-16 w-32 h-32 rounded-full bg-primary/5 blur-3xl" />
            
            <div className="flex items-center gap-2 mb-4">
              <Quote className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Motivação</h2>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={quoteIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="flex-1 flex flex-col justify-center"
              >
                <blockquote className="text-lg md:text-xl font-medium text-foreground/90 leading-relaxed italic">
                  "{quote.text}"
                </blockquote>
                <cite className="text-sm text-primary/80 mt-3 not-italic flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {quote.author}
                </cite>
              </motion.div>
            </AnimatePresence>

            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-xs text-muted-foreground self-end"
              onClick={() => setQuoteIndex(i => (i + 1) % QUOTES.length)}
            >
              Próxima frase <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Card>
        </motion.div>
      </div>

      {/* ── Quick Links Section ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="p-6 bg-card/60 border-border/40 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">Links Rápidos</h2>
            </div>
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Novo Link</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Título" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} />
                  <Input placeholder="https://..." value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
                  <Button onClick={addLink} className="w-full" disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}>
                    Adicionar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 text-center py-8">
              Adicione seus painéis e sites favoritos aqui ⚡
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {links.map(link => (
                <motion.div
                  key={link.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative group"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "block rounded-xl p-4 bg-gradient-to-br border border-white/10 text-white shadow-lg transition-shadow hover:shadow-xl",
                      link.color
                    )}
                  >
                    <ExternalLink className="h-4 w-4 mb-2 opacity-60" />
                    <p className="text-sm font-semibold truncate">{link.title}</p>
                    <p className="text-[10px] opacity-50 truncate mt-0.5">{new URL(link.url).hostname}</p>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    onClick={() => removeLink(link.id)}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
