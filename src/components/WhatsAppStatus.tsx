import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Type,
  Image,
  Video,
  Mic,
  Send,
  List,
  Calendar,
  User,
  Settings2,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  Sparkles,
  CircleDot,
  Trash2,
  Plus,
  Eye,
  Smartphone,
  Palette,
  TypeIcon,
} from 'lucide-react';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MediaUploader, MediaType as UploaderMediaType } from '@/components/BulkDispatcher/MediaUploader';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useStatusSchedules } from '@/hooks/useStatusSchedules';
import { StatusScheduleDialog } from '@/components/StatusScheduleDialog';
import { StatusScheduleCard } from '@/components/StatusScheduleCard';

interface WhatsAppStatusProps {
  instances: WhatsAppInstance[];
}

type StatusType = 'text' | 'image' | 'video' | 'audio';
type BalanceMode = 'manual' | 'round-robin' | 'random';

const BACKGROUND_COLORS = [
  // Row 1 - Warm gradients
  { color: '#F7DC6F', gradient: 'linear-gradient(135deg, #F7DC6F 0%, #F39C12 100%)' },
  { color: '#F4D03F', gradient: 'linear-gradient(135deg, #F4D03F 0%, #E67E22 100%)' },
  { color: '#F39C12', gradient: 'linear-gradient(135deg, #F39C12 0%, #D68910 100%)' },
  { color: '#E67E22', gradient: 'linear-gradient(135deg, #E67E22 0%, #CA6F1E 100%)' },
  // Row 2 - Greens
  { color: '#82E0AA', gradient: 'linear-gradient(135deg, #82E0AA 0%, #48C9B0 100%)' },
  { color: '#58D68D', gradient: 'linear-gradient(135deg, #58D68D 0%, #27AE60 100%)' },
  { color: '#48C9B0', gradient: 'linear-gradient(135deg, #48C9B0 0%, #1ABC9C 100%)' },
  { color: '#76D7C4', gradient: 'linear-gradient(135deg, #76D7C4 0%, #45B39D 100%)' },
  // Row 3 - Blues & Purples
  { color: '#85C1E9', gradient: 'linear-gradient(135deg, #85C1E9 0%, #3498DB 100%)' },
  { color: '#7FB3D5', gradient: 'linear-gradient(135deg, #7FB3D5 0%, #2980B9 100%)' },
  { color: '#BB8FCE', gradient: 'linear-gradient(135deg, #BB8FCE 0%, #8E44AD 100%)' },
  { color: '#C39BD3', gradient: 'linear-gradient(135deg, #C39BD3 0%, #9B59B6 100%)' },
  // Row 4 - Reds & Pinks
  { color: '#F1948A', gradient: 'linear-gradient(135deg, #F1948A 0%, #E74C3C 100%)' },
  { color: '#EC7063', gradient: 'linear-gradient(135deg, #EC7063 0%, #C0392B 100%)' },
  { color: '#E74C3C', gradient: 'linear-gradient(135deg, #E74C3C 0%, #922B21 100%)' },
  { color: '#F9E79F', gradient: 'linear-gradient(135deg, #F9E79F 0%, #F4D03F 100%)' },
  // Row 5 - Neutrals & Dark
  { color: '#BDC3C7', gradient: 'linear-gradient(135deg, #BDC3C7 0%, #7F8C8D 100%)' },
  { color: '#ABB2B9', gradient: 'linear-gradient(135deg, #ABB2B9 0%, #5D6D7E 100%)' },
  { color: '#8E44AD', gradient: 'linear-gradient(135deg, #8E44AD 0%, #6C3483 100%)' },
  { color: '#6C3483', gradient: 'linear-gradient(135deg, #6C3483 0%, #4A235A 100%)' },
];

const FONT_STYLES = [
  { id: 0, name: 'Padrão', className: 'font-normal', icon: 'Aa' },
  { id: 1, name: 'Negrito', className: 'font-bold', icon: 'B' },
  { id: 2, name: 'Itálico', className: 'italic', icon: 'I' },
  { id: 3, name: 'Condensado', className: 'font-condensed tracking-tighter', icon: 'Cn' },
  { id: 4, name: 'Largo', className: 'tracking-widest', icon: 'W' },
  { id: 5, name: 'Serif', className: 'font-serif', icon: 'Se' },
  { id: 6, name: 'Mono', className: 'font-mono', icon: 'Mo' },
  { id: 7, name: 'Decorativo', className: 'font-bold italic', icon: 'De' },
  { id: 8, name: 'Personalizado', className: 'font-medium', icon: 'Cu' },
];

const STATUS_TYPES = [
  { id: 'text', icon: Type, label: 'Texto', desc: 'Texto com cor de fundo', color: 'from-blue-500/20 to-cyan-500/20', borderColor: 'border-blue-500/30' },
  { id: 'image', icon: Image, label: 'Imagem', desc: 'Foto com legenda', color: 'from-green-500/20 to-emerald-500/20', borderColor: 'border-green-500/30' },
  { id: 'video', icon: Video, label: 'Vídeo', desc: 'Vídeo com legenda', color: 'from-purple-500/20 to-pink-500/20', borderColor: 'border-purple-500/30' },
  { id: 'audio', icon: Mic, label: 'Áudio', desc: 'Áudio ou voz', color: 'from-orange-500/20 to-red-500/20', borderColor: 'border-orange-500/30' },
];

export function WhatsAppStatus({ instances }: WhatsAppStatusProps) {
  const [activeTab, setActiveTab] = useState('single');
  const [statusType, setStatusType] = useState<StatusType>('text');
  const [text, setText] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(18);
  const [fontStyle, setFontStyle] = useState(0);
  const [balanceMode, setBalanceMode] = useState<BalanceMode>('manual');
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');
  const [mediaMimetype, setMediaMimetype] = useState('');
  const [batchList, setBatchList] = useState<Array<{
    id: string;
    type: StatusType;
    text: string;
    colorIndex: number;
    fontStyle: number;
    mediaUrl?: string;
    mediaFilename?: string;
  }>>([]);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  // Hook for status schedules
  const {
    pendingSchedules,
    sentSchedules,
    failedSchedules,
    cancelledSchedules,
    isLoading: schedulesLoading,
    createSchedule,
    cancelSchedule,
    deleteSchedule,
  } = useStatusSchedules();

  const connectedInstances = useMemo(() => 
    instances.filter(i => i.status === 'connected'),
    [instances]
  );

  const toggleInstance = (instanceId: string) => {
    setSelectedInstances(prev => {
      const newSet = new Set(prev);
      if (newSet.has(instanceId)) {
        newSet.delete(instanceId);
      } else {
        newSet.add(instanceId);
      }
      return newSet;
    });
  };

  const selectAllInstances = () => {
    setSelectedInstances(new Set(connectedInstances.map(i => i.id)));
  };

  const clearInstanceSelection = () => {
    setSelectedInstances(new Set());
  };

  const handleSendStatus = async () => {
    if (selectedInstances.size === 0) {
      toast.error('Selecione pelo menos uma instância');
      return;
    }

    if (statusType === 'text' && !text.trim()) {
      toast.error('Digite o texto do status');
      return;
    }

    if ((statusType === 'image' || statusType === 'video' || statusType === 'audio') && !mediaUrl) {
      const mediaLabel = statusType === 'image' ? 'uma imagem' : statusType === 'video' ? 'um vídeo' : 'um áudio';
      toast.error(`Selecione ${mediaLabel}`);
      return;
    }

    setIsSending(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Fetch instance keys for selected instances
      const { data: instancesData, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_key, instance_name')
        .in('id', Array.from(selectedInstances));

      if (fetchError) {
        console.error('Error fetching instances:', fetchError);
        toast.error('Erro ao buscar instâncias');
        setIsSending(false);
        return;
      }

      if (!instancesData || instancesData.length === 0) {
        toast.error('Nenhuma instância encontrada');
        setIsSending(false);
        return;
      }

      // Send status to each instance
      for (const instance of instancesData) {
        if (!instance.instance_key) {
          console.warn(`Instance ${instance.instance_name} has no instance_key`);
          errorCount++;
          continue;
        }

        // Map color index (0-19) to UAZAPI format (1-19)
        const uazapiBackgroundColor = statusType === 'text' ? (selectedColorIndex % 19) + 1 : undefined;

        const payload = {
          instanceKey: instance.instance_key,
          type: statusType,
          text: statusType === 'text' ? text : undefined,
          backgroundColor: uazapiBackgroundColor,
          font: statusType === 'text' ? fontStyle : undefined,
          file: mediaUrl || undefined,
          mimetype: mediaMimetype || undefined,
          caption: statusType !== 'text' && statusType !== 'audio' ? text : undefined,
        };

        console.log(`Sending status to instance ${instance.instance_name}:`, { type: statusType });

        const { data, error } = await supabase.functions.invoke('send-whatsapp-status', {
          body: payload
        });

        if (error) {
          console.error(`Error sending to ${instance.instance_name}:`, error);
          errorCount++;
        } else if (data?.error) {
          console.error(`API error for ${instance.instance_name}:`, data.error);
          errorCount++;
        } else {
          console.log(`Status sent to ${instance.instance_name}:`, data);
          successCount++;
        }
      }

      // Show feedback
      if (successCount > 0) {
        toast.success(`Status enviado para ${successCount} instância(s)!`);
        // Clear form on success
        if (statusType === 'text') {
          setText('');
        } else {
          handleMediaRemove();
          setText('');
        }
      }
      if (errorCount > 0) {
        toast.error(`Falha em ${errorCount} instância(s)`);
      }
    } catch (error) {
      console.error('Error sending status:', error);
      toast.error('Erro ao enviar status');
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusTypeChange = (newType: StatusType) => {
    setStatusType(newType);
    setMediaUrl('');
    setMediaFilename('');
    setMediaMimetype('');
  };

  const handleMediaUpload = (url: string, filename: string, mimetype: string) => {
    setMediaUrl(url);
    setMediaFilename(filename);
    setMediaMimetype(mimetype);
  };

  const handleMediaRemove = () => {
    setMediaUrl('');
    setMediaFilename('');
    setMediaMimetype('');
  };

  const handleAddToBatch = () => {
    if (statusType === 'text' && !text.trim()) {
      toast.error('Digite o texto do status');
      return;
    }

    if ((statusType === 'image' || statusType === 'video' || statusType === 'audio') && !mediaUrl) {
      const mediaLabel = statusType === 'image' ? 'uma imagem' : statusType === 'video' ? 'um vídeo' : 'um áudio';
      toast.error(`Selecione ${mediaLabel}`);
      return;
    }

    setBatchList(prev => [...prev, {
      id: Date.now().toString(),
      type: statusType,
      text,
      colorIndex: selectedColorIndex,
      fontStyle,
      mediaUrl,
      mediaFilename,
    }]);

    setText('');
    handleMediaRemove();
    toast.success('Adicionado à lista de lote!');
  };

  const selectedFontStyle = FONT_STYLES.find(f => f.id === fontStyle) || FONT_STYLES[0];
  const selectedColor = BACKGROUND_COLORS[selectedColorIndex];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Premium Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="relative">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <CircleDot className="h-6 w-6 text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gradient">Status Automático</h2>
          <p className="text-muted-foreground text-sm">
            Publique stories com texto, imagem, vídeo ou áudio
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary gap-1.5">
            <Sparkles className="h-3 w-3" />
            Premium
          </Badge>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-500/15 ring-1 ring-green-500/30">
            <Wifi className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{connectedInstances.length}</p>
            <p className="text-xs text-muted-foreground">Conectadas</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{selectedInstances.size}</p>
            <p className="text-xs text-muted-foreground">Selecionadas</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/15 ring-1 ring-orange-500/30">
            <List className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{batchList.length}</p>
            <p className="text-xs text-muted-foreground">Na Fila</p>
          </div>
        </div>
      </motion.div>

      {/* Instance Selection - Floating Cards Style */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Instâncias WhatsApp</CardTitle>
                  <CardDescription className="text-xs">{selectedInstances.size} de {connectedInstances.length} selecionadas</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={balanceMode} onValueChange={(v) => setBalanceMode(v as BalanceMode)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="round-robin">Round Robin</SelectItem>
                    <SelectItem value="random">Aleatório</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {connectedInstances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted/30 mb-4">
                  <WifiOff className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground">Nenhuma instância conectada</p>
                <p className="text-sm text-muted-foreground/70">Conecte uma instância na aba "Instâncias"</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllInstances} className="text-xs h-7">
                    Selecionar Todas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearInstanceSelection} className="text-xs h-7">
                    Limpar
                  </Button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  <AnimatePresence>
                    {connectedInstances.map((instance) => (
                      <motion.div
                        key={instance.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleInstance(instance.id)}
                        className={cn(
                          "relative p-3 rounded-xl border cursor-pointer transition-all",
                          selectedInstances.has(instance.id)
                            ? "bg-primary/10 border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                            : "bg-background/40 border-white/10 hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedInstances.has(instance.id)}
                            className="pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{instance.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {instance.phone_connected || 'Conectado'}
                            </p>
                          </div>
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            instance.status === 'connected' ? "bg-green-500 animate-pulse" : "bg-red-500"
                          )} />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Premium Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full grid grid-cols-3 p-1 bg-background/50 backdrop-blur-sm border border-white/10">
            <TabsTrigger value="single" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Status Único</span>
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lote</span>
              {batchList.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-primary text-primary-foreground text-[10px]">
                  {batchList.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Agendar</span>
            </TabsTrigger>
          </TabsList>

          {/* Single Status Tab */}
          <TabsContent value="single" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Left Column - Controls */}
              <div className="xl:col-span-3 space-y-5">
                {/* Status Type Selector - Premium Cards */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Tipo de Status
                  </Label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {STATUS_TYPES.map((type) => (
                      <motion.button
                        key={type.id}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleStatusTypeChange(type.id as StatusType)}
                        className={cn(
                          "relative p-4 rounded-xl border-2 transition-all text-center overflow-hidden group",
                          statusType === type.id
                            ? `bg-gradient-to-br ${type.color} ${type.borderColor} shadow-lg`
                            : "bg-background/40 border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className={cn(
                          "mx-auto mb-2 p-2 rounded-lg w-fit transition-colors",
                          statusType === type.id ? "bg-white/20" : "bg-muted/30 group-hover:bg-muted/50"
                        )}>
                          <type.icon className={cn(
                            "h-6 w-6 transition-colors",
                            statusType === type.id ? "text-foreground" : "text-muted-foreground"
                          )} />
                        </div>
                        <span className={cn(
                          "font-medium text-sm block",
                          statusType === type.id ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {type.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{type.desc}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Content Area */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {statusType === 'text' ? <Type className="h-4 w-4" /> : 
                       statusType === 'image' ? <Image className="h-4 w-4" /> :
                       statusType === 'video' ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      Conteúdo do Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {statusType === 'text' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Texto</Label>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            text.length > 600 ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
                          )}>
                            {text.length}/656
                          </span>
                        </div>
                        <Textarea
                          value={text}
                          onChange={(e) => setText(e.target.value.slice(0, 656))}
                          placeholder="Digite o texto do seu status..."
                          className="min-h-[120px] resize-none bg-background/50 border-white/10 focus:border-primary/50 transition-colors"
                        />
                      </div>
                    )}

                    {statusType === 'image' && (
                      <div className="space-y-4">
                        <MediaUploader
                          type="image"
                          currentUrl={mediaUrl}
                          currentFilename={mediaFilename}
                          onUpload={handleMediaUpload}
                          onRemove={handleMediaRemove}
                        />
                        <div className="space-y-2">
                          <Label className="text-sm">Legenda (opcional)</Label>
                          <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value.slice(0, 656))}
                            placeholder="Digite uma legenda..."
                            className="min-h-[80px] resize-none bg-background/50"
                          />
                        </div>
                      </div>
                    )}

                    {statusType === 'video' && (
                      <div className="space-y-4">
                        <MediaUploader
                          type="video"
                          currentUrl={mediaUrl}
                          currentFilename={mediaFilename}
                          onUpload={handleMediaUpload}
                          onRemove={handleMediaRemove}
                        />
                        <div className="space-y-2">
                          <Label className="text-sm">Legenda (opcional)</Label>
                          <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value.slice(0, 656))}
                            placeholder="Digite uma legenda..."
                            className="min-h-[80px] resize-none bg-background/50"
                          />
                        </div>
                      </div>
                    )}

                    {statusType === 'audio' && (
                      <MediaUploader
                        type="audio"
                        currentUrl={mediaUrl}
                        currentFilename={mediaFilename}
                        onUpload={handleMediaUpload}
                        onRemove={handleMediaRemove}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Color & Font Selectors (Text only) */}
                {statusType === 'text' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Color Picker */}
                    <Card className="glass-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Palette className="h-4 w-4 text-primary" />
                          Cor de Fundo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-5 gap-1.5">
                          {BACKGROUND_COLORS.map((colorObj, index) => (
                            <motion.button
                              key={index}
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setSelectedColorIndex(index)}
                              className={cn(
                                "h-8 w-8 rounded-lg transition-all",
                                selectedColorIndex === index
                                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                                  : ""
                              )}
                              style={{ background: colorObj.gradient }}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Font Style Picker */}
                    <Card className="glass-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-primary" />
                          Estilo da Fonte
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-1.5">
                          {FONT_STYLES.map((style) => (
                            <motion.button
                              key={style.id}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setFontStyle(style.id)}
                              className={cn(
                                "py-2 px-3 rounded-lg text-xs transition-all",
                                style.className,
                                fontStyle === style.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                              )}
                            >
                              {style.name}
                            </motion.button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button 
                    onClick={handleSendStatus}
                    disabled={isSending || selectedInstances.size === 0}
                    className="flex-1 h-12 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Enviar Status
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleAddToBatch}
                    className="h-12 gap-2 border-white/10 hover:bg-primary/10 hover:border-primary/30"
                  >
                    <Plus className="h-5 w-5" />
                    Adicionar ao Lote
                  </Button>
                </div>
              </div>

              {/* Right Column - Preview */}
              <div className="xl:col-span-2">
                <Card className="glass-card sticky top-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </CardTitle>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {STATUS_TYPES.find(t => t.id === statusType)?.label}
                      </Badge>
                      {statusType === 'text' && (
                        <>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Cor: {selectedColorIndex + 1}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Fonte: {fontStyle}
                          </Badge>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Phone Mockup */}
                    <div className="relative mx-auto w-full max-w-[220px]">
                      {/* Phone Frame */}
                      <div className="rounded-[2rem] border-4 border-gray-800 bg-gray-900 p-1 shadow-2xl">
                        {/* Screen */}
                        <div 
                          className="aspect-[9/16] rounded-[1.5rem] overflow-hidden flex items-center justify-center p-4"
                          style={{ background: statusType === 'text' ? selectedColor.gradient : '#374151' }}
                        >
                          {statusType === 'text' ? (
                            <p className={cn(
                              "text-white text-center text-sm leading-relaxed drop-shadow-lg",
                              selectedFontStyle.className
                            )}>
                              {text || 'Seu texto aparecerá aqui...'}
                            </p>
                          ) : statusType === 'image' ? (
                            mediaUrl ? (
                              <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <div className="flex flex-col items-center gap-3 text-white/40">
                                <Image className="h-12 w-12" />
                                <span className="text-xs">Preview da imagem</span>
                              </div>
                            )
                          ) : statusType === 'video' ? (
                            mediaUrl ? (
                              <video src={mediaUrl} className="w-full h-full object-cover rounded-xl" controls />
                            ) : (
                              <div className="flex flex-col items-center gap-3 text-white/40">
                                <Video className="h-12 w-12" />
                                <span className="text-xs">Preview do vídeo</span>
                              </div>
                            )
                          ) : (
                            mediaUrl ? (
                              <div className="flex flex-col items-center gap-3 text-white w-full">
                                <Mic className="h-12 w-12" />
                                <audio src={mediaUrl} controls className="w-full scale-75" />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-3 text-white/40">
                                <Mic className="h-12 w-12" />
                                <span className="text-xs">Preview do áudio</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                      {/* Notch */}
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-900 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Batch Tab */}
          <TabsContent value="batch" className="space-y-6 mt-6">
            <Card className="glass-card">
              <CardHeader className="border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/15">
                      <List className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Lista de Status para Lote</CardTitle>
                      <CardDescription className="text-xs">{batchList.length} status na fila</CardDescription>
                    </div>
                  </div>
                  {batchList.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setBatchList([])}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {batchList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 rounded-full bg-muted/30 mb-4">
                      <List className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <p className="font-medium text-muted-foreground mb-1">Nenhum status na lista</p>
                    <p className="text-sm text-muted-foreground/70">Use a aba "Status Único" para adicionar</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      <AnimatePresence>
                        {batchList.map((item, index) => (
                          <motion.div 
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-background/40 border border-white/10 group hover:border-primary/30 transition-colors"
                          >
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                              style={{ background: BACKGROUND_COLORS[item.colorIndex]?.gradient || '#6B7280' }}
                            >
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.text || `Status de ${item.type}`}</p>
                              <p className="text-xs text-muted-foreground">
                                {STATUS_TYPES.find(t => t.id === item.type)?.label} • Fonte: {item.fontStyle}
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setBatchList(prev => prev.filter(i => i.id !== item.id))}
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                )}

                {batchList.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <Button 
                      onClick={() => {
                        toast.success(`${batchList.length} status enviados!`);
                        setBatchList([]);
                      }}
                      disabled={selectedInstances.size === 0}
                      className="w-full h-12 gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    >
                      <Send className="h-5 w-5" />
                      Enviar {batchList.length} Status em Lote
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6 mt-6">
            <Card className="glass-card">
              <CardHeader className="border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/15">
                      <Calendar className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Agendamentos</CardTitle>
                      <CardDescription className="text-xs">
                        {pendingSchedules.length} pendente(s) • {sentSchedules.length} enviado(s)
                      </CardDescription>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setScheduleDialogOpen(true)}
                    className="gap-2"
                    disabled={connectedInstances.length === 0}
                  >
                    <Plus className="h-4 w-4" />
                    Novo Agendamento
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {schedulesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingSchedules.length === 0 && sentSchedules.length === 0 && failedSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-muted/30 mb-4">
                      <Calendar className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <p className="font-medium text-muted-foreground mb-1">Nenhum agendamento</p>
                    <p className="text-sm text-muted-foreground/70 mb-4">
                      Crie seu primeiro agendamento de status
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => setScheduleDialogOpen(true)}
                      disabled={connectedInstances.length === 0}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Agendamento
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-6">
                      {/* Pending */}
                      {pendingSchedules.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium">Pendentes ({pendingSchedules.length})</span>
                          </div>
                          <div className="space-y-2">
                            {pendingSchedules.map((schedule) => (
                              <StatusScheduleCard
                                key={schedule.id}
                                schedule={schedule}
                                onCancel={cancelSchedule}
                                onDelete={deleteSchedule}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sent */}
                      {sentSchedules.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium">Enviados ({sentSchedules.length})</span>
                          </div>
                          <div className="space-y-2">
                            {sentSchedules.slice(0, 10).map((schedule) => (
                              <StatusScheduleCard
                                key={schedule.id}
                                schedule={schedule}
                                onCancel={cancelSchedule}
                                onDelete={deleteSchedule}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Failed */}
                      {failedSchedules.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-destructive" />
                            <span className="text-sm font-medium">Falharam ({failedSchedules.length})</span>
                          </div>
                          <div className="space-y-2">
                            {failedSchedules.map((schedule) => (
                              <StatusScheduleCard
                                key={schedule.id}
                                schedule={schedule}
                                onCancel={cancelSchedule}
                                onDelete={deleteSchedule}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Dialog */}
          <StatusScheduleDialog
            open={scheduleDialogOpen}
            onOpenChange={setScheduleDialogOpen}
            onSave={createSchedule}
            instances={instances}
          />
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
