import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Target, Quote, ExternalLink, Plus, Check, Trash2,
  ChevronRight, Zap, Star, Trophy, StickyNote, AlarmClock,
  Users, Bot, Flame, Headset, BarChart3, Smartphone,
  Settings, LogOut, User, Filter, LayoutDashboard, Kanban,
  ChevronLeft, Volume2, VolumeX, Play, Pause, Edit3, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import logoFuturistic from '@/assets/logo-red-futuristic.png';

// ── Motivational quotes ────────────────────────────────
const QUOTES = [
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Não espere por oportunidades extraordinárias. Agarre ocasiões comuns e as torne grandes.", author: "Orison Swett Marden" },
  { text: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
  { text: "O único lugar onde o sucesso vem antes do trabalho é no dicionário.", author: "Albert Einstein" },
  { text: "Acredite que você pode e você já está no meio do caminho.", author: "Theodore Roosevelt" },
  { text: "Grandes coisas nunca vieram de zonas de conforto.", author: "Neil Strauss" },
  { text: "Sua única limitação é você mesmo.", author: "Desconhecido" },
  { text: "Disciplina é a ponte entre metas e conquistas.", author: "Jim Rohn" },
  { text: "O futuro pertence àqueles que acreditam na beleza de seus sonhos.", author: "Eleanor Roosevelt" },
  { text: "Não tenha medo de desistir do bom para perseguir o ótimo.", author: "John D. Rockefeller" },
  { text: "A única forma de fazer um grande trabalho é amar o que você faz.", author: "Steve Jobs" },
  { text: "Cada conquista começa com a decisão de tentar.", author: "John F. Kennedy" },
];

// ── Types ──────────────────────────────────────────────
interface Goal {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

interface Alarm {
  id: string;
  time: string;
  label: string;
  active: boolean;
}

interface NoteEntry {
  id: string;
  content: string;
  updatedAt: number;
}

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

// ── Sidebar nav items ──────────────────────────────────
const navItems = [
  { id: 'clients', label: 'Gerenciador', icon: Users, route: '/?section=clients' },
  { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone, route: '/?section=whatsapp' },
  { id: 'atendimento', label: 'Atendimento', icon: Headset, route: '/?section=atendimento' },
  { id: 'ai-agent', label: 'Agente IA', icon: Bot, route: '/?section=ai-agent' },
  { id: 'warm-chips', label: 'Aquecimento', icon: Flame, route: '/?section=warm-chips' },
  { id: 'crm-kanban', label: 'CRM Kanban', icon: Kanban, route: '/?section=crm-kanban' },
  { id: 'filter-numbers', label: 'Filtrar Números', icon: Filter, route: '/?section=filter-numbers' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, route: '/dashboard' },
  { id: 'settings', label: 'Configurações', icon: Settings, route: '/settings' },
  { id: 'profile', label: 'Perfil', icon: User, route: '/profile' },
];

// ── Digital Clock Widget ───────────────────────────────
function DigitalClock({ alarms, onAlarmTriggered }: { alarms: Alarm[]; onAlarmTriggered: (a: Alarm) => void }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (now.getSeconds() === 0) {
      alarms.filter(a => a.active && a.time === hhmm).forEach(onAlarmTriggered);
    }
  }, [now, alarms, onAlarmTriggered]);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="text-center select-none">
      <div className="flex items-baseline justify-center gap-0.5 font-mono tracking-tighter">
        <span className="text-4xl font-black text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]">{hours}</span>
        <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-4xl font-black text-primary/40">:</motion.span>
        <span className="text-4xl font-black text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]">{minutes}</span>
        <span className="text-lg font-bold text-accent ml-1 self-end">{seconds}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 capitalize">{weekday}, {date}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ── MAIN COMPONENT ───────────────────────────────────
// ══════════════════════════════════════════════════════
export default function PersonalHub() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Widget state
  const [goals, setGoals] = useState<Goal[]>(() => loadJSON('hub-goals', []));
  const [alarms, setAlarms] = useState<Alarm[]>(() => loadJSON('hub-alarms', []));
  const [notes, setNotes] = useState<NoteEntry[]>(() => loadJSON('hub-notes', [{ id: '1', content: '', updatedAt: Date.now() }]));
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [newGoal, setNewGoal] = useState('');
  const [newAlarmTime, setNewAlarmTime] = useState('07:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [alarmDialogOpen, setAlarmDialogOpen] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0]?.id || '');

  // Persist
  useEffect(() => saveJSON('hub-goals', goals), [goals]);
  useEffect(() => saveJSON('hub-alarms', alarms), [alarms]);
  useEffect(() => saveJSON('hub-notes', notes), [notes]);

  // Quote rotation
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

  // Alarms
  const addAlarm = useCallback(() => {
    if (!newAlarmTime) return;
    setAlarms(prev => [...prev, { id: crypto.randomUUID(), time: newAlarmTime, label: newAlarmLabel.trim() || 'Alarme', active: true }]);
    setNewAlarmLabel('');
    setAlarmDialogOpen(false);
    toast.success('Alarme adicionado');
  }, [newAlarmTime, newAlarmLabel]);

  const toggleAlarm = useCallback((id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  }, []);

  const removeAlarm = useCallback((id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
  }, []);

  const onAlarmTriggered = useCallback((alarm: Alarm) => {
    toast.info(`⏰ ${alarm.label}`, { description: `Horário: ${alarm.time}`, duration: 10000 });
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
  }, []);

  // Notes
  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);

  const updateNote = useCallback((content: string) => {
    setNotes(prev => prev.map(n => n.id === activeNoteId ? { ...n, content, updatedAt: Date.now() } : n));
  }, [activeNoteId]);

  const addNote = useCallback(() => {
    const newNote: NoteEntry = { id: crypto.randomUUID(), content: '', updatedAt: Date.now() };
    setNotes(prev => [...prev, newNote]);
    setActiveNoteId(newNote.id);
  }, []);

  const removeNote = useCallback((id: string) => {
    setNotes(prev => {
      const filtered = prev.filter(n => n.id !== id);
      if (filtered.length === 0) {
        const fresh = { id: crypto.randomUUID(), content: '', updatedAt: Date.now() };
        setActiveNoteId(fresh.id);
        return [fresh];
      }
      if (id === activeNoteId) setActiveNoteId(filtered[0].id);
      return filtered;
    });
  }, [activeNoteId]);

  // Stats
  const completedGoals = useMemo(() => goals.filter(g => g.completed).length, [goals]);
  const totalGoals = goals.length;
  const progressPercent = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
  const quote = QUOTES[quoteIndex];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen flex bg-background">
        {/* ═══════════ SIDEBAR ═══════════ */}
        <motion.aside
          animate={{ width: sidebarCollapsed ? 64 : 240 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-screen sticky top-0 flex flex-col border-r border-border/40 bg-card/40 backdrop-blur-sm z-20 overflow-hidden"
        >
          {/* Logo */}
          <div className="h-14 flex items-center justify-between px-3 border-b border-border/30 shrink-0">
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 overflow-hidden">
                <img src={logoFuturistic} alt="Logo" className="h-8 w-8 object-contain" />
                <span className="text-sm font-bold text-primary truncate tracking-tight">ATLAS 2.0</span>
              </motion.div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Nav */}
          <ScrollArea className="flex-1 py-2">
            <nav className="space-y-0.5 px-2">
              {navItems.map(item => (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.route)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                        "text-muted-foreground hover:text-foreground hover:bg-primary/5",
                        sidebarCollapsed && "justify-center px-0"
                      )}
                    >
                      <item.icon className="h-4.5 w-4.5 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
                    <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              ))}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="border-t border-border/30 p-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => signOut()}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    "text-muted-foreground hover:text-destructive hover:bg-destructive/5",
                    sidebarCollapsed && "justify-center px-0"
                  )}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>Sair</span>}
                </button>
              </TooltipTrigger>
              {sidebarCollapsed && <TooltipContent side="right" className="text-xs">Sair</TooltipContent>}
            </Tooltip>
          </div>
        </motion.aside>

        {/* ═══════════ MAIN CONTENT ═══════════ */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">
            
            {/* ── Header ── */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">
                  {greeting}, <span className="text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.4)]">{displayName}</span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">Painel de Controle</p>
              </div>
            </motion.div>

            {/* ── Top Row: Clock + Quote ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Clock & Alarms */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="p-5 bg-card/60 border-border/30 relative overflow-hidden h-full">
                  <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Relógio</h2>
                  </div>

                  <DigitalClock alarms={alarms} onAlarmTriggered={onAlarmTriggered} />

                  {/* Alarms */}
                  <div className="mt-4 pt-3 border-t border-border/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <AlarmClock className="h-3.5 w-3.5 text-accent" />
                        <span className="text-xs font-medium text-muted-foreground">Alarmes</span>
                      </div>
                      <Dialog open={alarmDialogOpen} onOpenChange={setAlarmDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-3 w-3" /></Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xs">
                          <DialogHeader><DialogTitle>Novo Alarme</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <Input type="time" value={newAlarmTime} onChange={e => setNewAlarmTime(e.target.value)} />
                            <Input placeholder="Rótulo (opcional)" value={newAlarmLabel} onChange={e => setNewAlarmLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAlarm()} />
                            <Button onClick={addAlarm} className="w-full" size="sm">Adicionar</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {alarms.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/50 text-center py-1">Nenhum alarme configurado</p>
                    ) : (
                      <div className="space-y-1 max-h-24 overflow-auto">
                        {alarms.map(a => (
                          <div key={a.id} className="flex items-center justify-between rounded-md px-2.5 py-1.5 bg-muted/20 border border-border/20 group">
                            <div className="flex items-center gap-2">
                              <Switch checked={a.active} onCheckedChange={() => toggleAlarm(a.id)} className="scale-75" />
                              <span className={cn("text-xs font-mono font-semibold", !a.active && "text-muted-foreground/40")}>{a.time}</span>
                              <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">{a.label}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => removeAlarm(a.id)}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Motivational Quote */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="p-5 bg-card/60 border-border/30 relative overflow-hidden h-full flex flex-col">
                  <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Quote className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Motivação</h2>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={quoteIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="flex-1 flex flex-col justify-center"
                    >
                      <blockquote className="text-base md:text-lg font-medium text-foreground/90 leading-relaxed italic">
                        "{quote.text}"
                      </blockquote>
                      <cite className="text-xs text-primary/70 mt-2 not-italic flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        {quote.author}
                      </cite>
                    </motion.div>
                  </AnimatePresence>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-[11px] text-muted-foreground self-end h-7"
                    onClick={() => setQuoteIndex(i => (i + 1) % QUOTES.length)}
                  >
                    Próxima <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </Card>
              </motion.div>
            </div>

            {/* ── Bottom Row: Goals + Notes ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Goals / Checklist */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="p-5 bg-card/60 border-border/30 relative overflow-hidden">
                  <div className="absolute -top-12 -left-12 w-28 h-28 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Target className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h2 className="text-sm font-semibold text-foreground">Metas & Tarefas</h2>
                    </div>
                    {totalGoals > 0 && (
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-accent" />
                        {completedGoals}/{totalGoals}
                      </span>
                    )}
                  </div>

                  {totalGoals > 0 && (
                    <div className="mb-3">
                      <Progress value={progressPercent} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">{progressPercent}% concluído</p>
                    </div>
                  )}

                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="Nova meta..."
                      value={newGoal}
                      onChange={e => setNewGoal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addGoal()}
                      className="bg-muted/20 border-border/20 h-9 text-sm"
                    />
                    <Button size="sm" onClick={addGoal} disabled={!newGoal.trim()} className="h-9 px-3">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <ScrollArea className="max-h-[260px]">
                    <div className="space-y-1">
                      <AnimatePresence mode="popLayout">
                        {goals.map(g => (
                          <motion.div
                            key={g.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10, height: 0 }}
                            className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-muted/10 border border-border/15 group hover:bg-muted/20 transition-colors"
                          >
                            <button
                              onClick={() => toggleGoal(g.id)}
                              className={cn(
                                "h-4.5 w-4.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                g.completed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/25 hover:border-primary/50"
                              )}
                            >
                              {g.completed && <Check className="h-2.5 w-2.5" />}
                            </button>
                            <span className={cn("flex-1 text-sm transition-colors", g.completed && "line-through text-muted-foreground/40")}>
                              {g.title}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={() => removeGoal(g.id)}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {goals.length === 0 && (
                        <div className="text-center py-8">
                          <Target className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground/40">Adicione sua primeira meta</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </motion.div>

              {/* Notepad */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="p-5 bg-card/60 border-border/30 relative overflow-hidden">
                  <div className="absolute -bottom-12 -right-12 w-28 h-28 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
                        <StickyNote className="h-3.5 w-3.5 text-accent" />
                      </div>
                      <h2 className="text-sm font-semibold text-foreground">Bloco de Notas</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={addNote} className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" />
                      Nova
                    </Button>
                  </div>

                  {/* Note tabs */}
                  {notes.length > 1 && (
                    <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
                      {notes.map((n, i) => (
                        <button
                          key={n.id}
                          onClick={() => setActiveNoteId(n.id)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all shrink-0",
                            n.id === activeNoteId
                              ? "bg-primary/15 text-primary border border-primary/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          )}
                        >
                          Nota {i + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeNote && (
                    <div className="relative">
                      <Textarea
                        value={activeNote.content}
                        onChange={e => updateNote(e.target.value)}
                        placeholder="Escreva suas anotações aqui..."
                        className="min-h-[200px] max-h-[300px] bg-muted/10 border-border/20 text-sm resize-none focus:ring-1 focus:ring-primary/20"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted-foreground/40">
                          {activeNote.content.length} caracteres
                        </span>
                        {notes.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
                            onClick={() => removeNote(activeNote.id)}
                          >
                            <Trash2 className="h-2.5 w-2.5 mr-1" />
                            Excluir nota
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
