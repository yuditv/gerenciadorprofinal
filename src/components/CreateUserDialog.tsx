import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Eye, EyeOff, Loader2, Mail, User, Phone, Lock, Shield, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onUserCreated: () => Promise<void>;
  createUser: (userData: {
    email: string;
    password: string;
    whatsapp?: string;
    displayName?: string;
  }) => Promise<void>;
}

export function CreateUserDialog({
  open,
  onClose,
  onUserCreated,
  createUser,
}: CreateUserDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWhatsapp(formatWhatsApp(e.target.value));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email inválido";
    }

    if (!password) {
      newErrors.password = "Senha é obrigatória";
    } else if (password.length < 6) {
      newErrors.password = "Senha deve ter no mínimo 6 caracteres";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirmação de senha é obrigatória";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await createUser({
        email,
        password,
        whatsapp: whatsapp.replace(/\D/g, "") || undefined,
        displayName: displayName || undefined,
      });
      
      await onUserCreated();
      handleClose();
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Ocorreu um erro ao criar o usuário",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setWhatsapp("");
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.2 } },
    blur: { scale: 1 }
  };

  const formItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.1, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const }
    })
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="glass-card border-primary/30 sm:max-w-lg p-0 overflow-hidden">
        {/* Animated background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        </div>
        
        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--primary)/0.03)_2px,hsl(var(--primary)/0.03)_4px)]" />
        </div>

        {/* Top glowing line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        <div className="relative z-10 p-6">
          <DialogHeader className="space-y-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, type: "spring" }}
              className="flex items-center gap-3"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/40 rounded-xl blur-lg animate-pulse" />
                <div className="relative p-3 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 glow-border">
                  <UserPlus className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  Adicionar Novo Usuário
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm mt-1">
                  Crie um novo usuário com acesso ao sistema
                </DialogDescription>
              </div>
            </motion.div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <AnimatePresence>
              {/* Email Field */}
              <motion.div 
                custom={0}
                variants={formItemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  Email <span className="text-primary">*</span>
                </Label>
                <motion.div whileFocus="focus" variants={inputVariants} className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-accent/50 rounded-lg opacity-0 group-focus-within:opacity-100 blur transition-opacity duration-300" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`relative bg-background/80 backdrop-blur-sm border-primary/20 focus:border-primary/50 transition-all duration-300 ${errors.email ? "border-destructive" : ""}`}
                    disabled={isLoading}
                  />
                </motion.div>
                {errors.email && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive flex items-center gap-1"
                  >
                    <Shield className="h-3 w-3" />
                    {errors.email}
                  </motion.p>
                )}
              </motion.div>

              {/* Display Name Field */}
              <motion.div 
                custom={1}
                variants={formItemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label htmlFor="displayName" className="text-sm font-medium flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Nome de Exibição
                </Label>
                <motion.div whileFocus="focus" variants={inputVariants} className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-accent/50 rounded-lg opacity-0 group-focus-within:opacity-100 blur transition-opacity duration-300" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Nome do usuário"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="relative bg-background/80 backdrop-blur-sm border-primary/20 focus:border-primary/50 transition-all duration-300"
                    disabled={isLoading}
                  />
                </motion.div>
              </motion.div>

              {/* WhatsApp Field */}
              <motion.div 
                custom={2}
                variants={formItemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label htmlFor="whatsapp" className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-accent" />
                  WhatsApp
                </Label>
                <motion.div whileFocus="focus" variants={inputVariants} className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-accent/50 to-accent/30 rounded-lg opacity-0 group-focus-within:opacity-100 blur transition-opacity duration-300" />
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={whatsapp}
                    onChange={handleWhatsAppChange}
                    className="relative bg-background/80 backdrop-blur-sm border-primary/20 focus:border-accent/50 transition-all duration-300"
                    disabled={isLoading}
                    maxLength={16}
                  />
                </motion.div>
              </motion.div>

              {/* Password Fields in a grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Password Field */}
                <motion.div 
                  custom={3}
                  variants={formItemVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    Senha <span className="text-primary">*</span>
                  </Label>
                  <motion.div whileFocus="focus" variants={inputVariants} className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-accent/50 rounded-lg opacity-0 group-focus-within:opacity-100 blur transition-opacity duration-300" />
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`relative bg-background/80 backdrop-blur-sm border-primary/20 focus:border-primary/50 pr-10 transition-all duration-300 ${errors.password ? "border-destructive" : ""}`}
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </motion.div>
                  {errors.password && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <Shield className="h-3 w-3" />
                      {errors.password}
                    </motion.p>
                  )}
                </motion.div>

                {/* Confirm Password Field */}
                <motion.div 
                  custom={4}
                  variants={formItemVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  <Label htmlFor="confirmPassword" className="text-sm font-medium flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    Confirmar <span className="text-primary">*</span>
                  </Label>
                  <motion.div whileFocus="focus" variants={inputVariants} className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-accent/50 rounded-lg opacity-0 group-focus-within:opacity-100 blur transition-opacity duration-300" />
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repita a senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`relative bg-background/80 backdrop-blur-sm border-primary/20 focus:border-primary/50 pr-10 transition-all duration-300 ${errors.confirmPassword ? "border-destructive" : ""}`}
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </motion.div>
                  {errors.confirmPassword && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <Shield className="h-3 w-3" />
                      {errors.confirmPassword}
                    </motion.p>
                  )}
                </motion.div>
              </div>
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <DialogFooter className="gap-3 sm:gap-3 mt-6 pt-4 border-t border-primary/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all duration-300"
                >
                  Cancelar
                </Button>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="btn-futuristic relative overflow-hidden group"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Criar Usuário
                        </>
                      )}
                    </span>
                  </Button>
                </motion.div>
              </DialogFooter>
            </motion.div>
          </form>
        </div>
        
        {/* Bottom glowing line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      </DialogContent>
    </Dialog>
  );
}