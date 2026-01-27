import { useState, useEffect } from 'react';
import { Client, PlanType, ServiceType, planLabels, planDurations, serviceLabels } from '@/types/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Phone, Mail, CreditCard, CalendarDays, DollarSign, Tv, StickyNote, KeyRound, Smartphone, AppWindow } from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Security: Input validation schemas
const clientSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Nome contém caracteres inválidos'),
  whatsapp: z.string()
    .min(14, 'WhatsApp inválido')
    .max(16, 'WhatsApp inválido'),
  email: z.string()
    .email('Email inválido')
    .max(100, 'Email muito longo')
    .optional()
    .or(z.literal('')),
  notes: z.string()
    .max(500, 'Anotação muito longa')
    .optional()
    .nullable(),
  price: z.number()
    .min(0, 'Preço não pode ser negativo')
    .max(999999, 'Preço muito alto')
    .optional()
    .nullable(),
  serviceUsername: z.string()
    .max(100, 'Usuário muito longo')
    .optional()
    .nullable(),
  servicePassword: z.string()
    .max(100, 'Senha muito longa')
    .optional()
    .nullable(),
  appName: z.string()
    .max(100, 'Nome do app muito longo')
    .optional()
    .nullable(),
  device: z.string()
    .max(100, 'Dispositivo muito longo')
    .optional()
    .nullable(),
});

// Security: Sanitize text input to prevent XSS
const sanitizeText = (text: string): string => {
  return text
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim();
};

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Client, 'id' | 'renewalHistory'>) => void;
  initialData?: Client | null;
}

export function ClientForm({ open, onOpenChange, onSubmit, initialData }: ClientFormProps) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState<ServiceType>('IPTV');
  const [plan, setPlan] = useState<PlanType>('monthly');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  // Service credentials
  const [serviceUsername, setServiceUsername] = useState('');
  const [servicePassword, setServicePassword] = useState('');
  // IPTV specific
  const [appName, setAppName] = useState('');
  const [device, setDevice] = useState('');

  // Helper function to format phone number for form (remove 55 prefix, format as (DD) 9XXXX-XXXX)
  const formatPhoneForForm = (phone: string): string => {
    // Remove all non-digit characters
    let numbers = phone.replace(/\D/g, '');
    
    // Remove 55 prefix if present
    if (numbers.startsWith('55') && numbers.length >= 12) {
      numbers = numbers.slice(2);
    }
    
    // Format as (DD) 9XXXX-XXXX
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setWhatsapp(formatPhoneForForm(initialData.whatsapp));
      setEmail(initialData.email || '');
      setService(initialData.service);
      setPlan(initialData.plan);
      setPrice(initialData.price?.toString() || '');
      setNotes(initialData.notes || '');
      setCreatedAt(format(initialData.createdAt, 'yyyy-MM-dd'));
      setExpiresAt(format(initialData.expiresAt, 'yyyy-MM-dd'));
      setServiceUsername(initialData.serviceUsername || '');
      setServicePassword(initialData.servicePassword || '');
      setAppName(initialData.appName || '');
      setDevice(initialData.device || '');
    } else {
      setName('');
      setWhatsapp('');
      setEmail('');
      setService('IPTV');
      setPlan('monthly');
      setPrice('');
      setNotes('');
      // Always use today's date for new registrations
      setCreatedAt(format(new Date(), 'yyyy-MM-dd'));
      // Calculate expiration based on plan duration from today
      setExpiresAt(format(addMonths(new Date(), planDurations['monthly']), 'yyyy-MM-dd'));
      setServiceUsername('');
      setServicePassword('');
      setAppName('');
      setDevice('');
    }
  }, [initialData, open]);

  // Update expiration date when plan changes (only for new clients)
  useEffect(() => {
    if (!initialData) {
      // Always calculate from today's date
      const today = new Date();
      setCreatedAt(format(today, 'yyyy-MM-dd'));
      setExpiresAt(format(addMonths(today, planDurations[plan]), 'yyyy-MM-dd'));
    }
  }, [plan, initialData]);

  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWhatsapp(formatWhatsapp(e.target.value));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    setPrice(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Security: Validate and sanitize all inputs
    const sanitizedName = sanitizeText(name);
    const sanitizedNotes = notes ? sanitizeText(notes) : null;
    const sanitizedUsername = serviceUsername ? sanitizeText(serviceUsername) : null;
    const sanitizedPassword = servicePassword ? sanitizeText(servicePassword) : null;
    const sanitizedAppName = appName ? sanitizeText(appName) : null;
    const sanitizedDevice = device ? sanitizeText(device) : null;
    
    const validation = clientSchema.safeParse({
      name: sanitizedName,
      whatsapp,
      email: email.trim(),
      notes: sanitizedNotes,
      price: price ? parseFloat(price) : null,
      serviceUsername: sanitizedUsername,
      servicePassword: sanitizedPassword,
      appName: sanitizedAppName,
      device: sanitizedDevice,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    onSubmit({ 
      name: sanitizedName, 
      whatsapp, 
      email: email.trim(),
      service,
      plan,
      price: price ? parseFloat(price) : null,
      notes: sanitizedNotes,
      createdAt: new Date(createdAt + 'T00:00:00'),
      expiresAt: new Date(expiresAt + 'T23:59:59'),
      serviceUsername: sanitizedUsername,
      servicePassword: sanitizedPassword,
      appName: service === 'IPTV' ? sanitizedAppName : null,
      device: service === 'IPTV' ? sanitizedDevice : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-semibold">
            {initialData ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs font-medium">
              Nome completo
            </Label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite o nome"
                className="pl-8 h-9 text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="whatsapp" className="text-xs font-medium">
              WhatsApp
            </Label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={handleWhatsappChange}
                placeholder="(00) 00000-0000"
                className="pl-8 h-9 text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-medium">
              Email (opcional)
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="service" className="text-xs font-medium">
              Serviço
            </Label>
            <div className="relative">
              <Tv className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
              <Select value={service} onValueChange={(v) => setService(v as ServiceType)}>
                <SelectTrigger className="pl-8 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(serviceLabels) as [ServiceType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Service Credentials Section */}
          <AnimatePresence mode="wait">
            <motion.div
              key={service}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 overflow-hidden"
            >
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Credenciais do {service}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="serviceUsername" className="text-xs font-medium">
                      Usuário
                    </Label>
                    <Input
                      id="serviceUsername"
                      value={serviceUsername}
                      onChange={(e) => setServiceUsername(e.target.value)}
                      placeholder="Digite o usuário"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="servicePassword" className="text-xs font-medium">
                      Senha
                    </Label>
                    <Input
                      id="servicePassword"
                      type="password"
                      value={servicePassword}
                      onChange={(e) => setServicePassword(e.target.value)}
                      placeholder="Digite a senha"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* IPTV specific fields */}
                {service === 'IPTV' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50"
                  >
                    <div className="space-y-1">
                      <Label htmlFor="appName" className="text-xs font-medium">
                        Nome do App
                      </Label>
                      <div className="relative">
                        <AppWindow className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="appName"
                          value={appName}
                          onChange={(e) => setAppName(e.target.value)}
                          placeholder="Ex: IPTV Smarters"
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="device" className="text-xs font-medium">
                        Dispositivo
                      </Label>
                      <div className="relative">
                        <Smartphone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="device"
                          value={device}
                          onChange={(e) => setDevice(e.target.value)}
                          placeholder="Ex: Smart TV, Celular"
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="plan" className="text-xs font-medium">
                Plano
              </Label>
              <div className="relative">
                <CreditCard className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
                <Select value={plan} onValueChange={(v) => setPlan(v as PlanType)}>
                  <SelectTrigger className="pl-8 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(planLabels) as [PlanType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="price" className="text-xs font-medium">
                Valor (R$)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={handlePriceChange}
                  placeholder="0.00"
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="createdAt" className="text-xs font-medium">
                Data de Cadastro
              </Label>
              <div className="relative">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="createdAt"
                  type="date"
                  value={createdAt}
                  onChange={(e) => setCreatedAt(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="expiresAt" className="text-xs font-medium">
                Vencimento
              </Label>
              <div className="relative">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs font-medium">
              Anotações (opcional)
            </Label>
            <div className="relative">
              <StickyNote className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações..."
                className="pl-8 min-h-[60px] resize-none text-sm"
                maxLength={500}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">{notes.length}/500</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="flex-1">
              {initialData ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
