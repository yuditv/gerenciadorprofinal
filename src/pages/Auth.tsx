import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, Mail, Lock, Loader2, Phone, ArrowLeft, Shield, CheckCircle, RefreshCw, Chrome } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

// Gmail-only validation
const gmailSchema = z.string()
  .trim()
  .email('Email inválido')
  .max(255, 'Email muito longo')
  .refine(
    (email) => /^[a-zA-Z0-9._%+-]+@gmail\.com(\.br)?$/i.test(email),
    'Apenas emails do Gmail são aceitos (@gmail.com ou @gmail.com.br)'
  );

const emailSchema = z.string().trim().email('Email inválido').max(255, 'Email muito longo');
const passwordSchema = z.string()
  .min(6, 'A senha deve ter pelo menos 6 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres');

// Security: Rate limiting for login attempts
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60000; // 1 minute in milliseconds

const getLoginAttempts = (): { count: number; lockedUntil: number } => {
  const stored = sessionStorage.getItem('login_attempts');
  if (!stored) return { count: 0, lockedUntil: 0 };
  try {
    return JSON.parse(stored);
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
};

const incrementLoginAttempts = () => {
  const attempts = getLoginAttempts();
  const newAttempts = {
    count: attempts.count + 1,
    lockedUntil: attempts.count + 1 >= MAX_LOGIN_ATTEMPTS 
      ? Date.now() + LOCKOUT_DURATION 
      : attempts.lockedUntil
  };
  sessionStorage.setItem('login_attempts', JSON.stringify(newAttempts));
  return newAttempts;
};

const resetLoginAttempts = () => {
  sessionStorage.removeItem('login_attempts');
};

const isAccountLocked = (): boolean => {
  const attempts = getLoginAttempts();
  if (attempts.lockedUntil > Date.now()) {
    return true;
  }
  if (attempts.lockedUntil > 0 && attempts.lockedUntil <= Date.now()) {
    resetLoginAttempts();
  }
  return false;
};

const getRemainingLockoutTime = (): number => {
  const attempts = getLoginAttempts();
  return Math.max(0, Math.ceil((attempts.lockedUntil - Date.now()) / 1000));
};

const formatWhatsApp = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length === 0) return '';
  if (numbers.length <= 2) return `(${numbers}`;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
};

const unformatWhatsApp = (value: string): string => {
  return value.replace(/\D/g, '');
};
const whatsappSchema = z.string().min(10, 'WhatsApp deve ter pelo menos 10 dígitos').regex(/^[0-9]+$/, 'WhatsApp deve conter apenas números');

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');

  // Check if user just verified their email
  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      toast.success('Email verificado com sucesso! Faça login para continuar.');
    }
  }, [searchParams]);

  const validateLoginForm = () => {
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      return false;
    }
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.errors[0].message);
      return false;
    }
    return true;
  };

  const validateSignUpForm = () => {
    // Gmail-only for signup
    const emailResult = gmailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      return false;
    }
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.errors[0].message);
      return false;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return false;
    }
    const whatsappResult = whatsappSchema.safeParse(whatsapp);
    if (!whatsappResult.success) {
      toast.error(whatsappResult.error.errors[0].message);
      return false;
    }
    return true;
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error('Erro ao fazer login com Google: ' + error.message);
      }
    } catch (err) {
      console.error('Google auth error:', err);
      toast.error('Erro ao conectar com Google. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAccountLocked()) {
      const remaining = getRemainingLockoutTime();
      toast.error(`Muitas tentativas de login. Aguarde ${remaining} segundos.`);
      return;
    }
    
    if (!validateLoginForm()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      if (error) {
        incrementLoginAttempts();
        const attempts = getLoginAttempts();
        
        if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
          toast.error('Conta bloqueada temporariamente. Aguarde 1 minuto.');
        } else if (error.message.includes('Invalid login credentials')) {
          toast.error(`Email ou senha incorretos. ${MAX_LOGIN_ATTEMPTS - attempts.count} tentativas restantes.`);
        } else if (error.message.includes('Email not confirmed')) {
          setPendingVerificationEmail(email.trim());
          toast.error('Email não verificado. Verifique sua caixa de entrada ou reenvie o email de confirmação.');
        } else {
          toast.error(error.message);
        }
      } else {
        // Check if email is confirmed
        if (data.user && !data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setPendingVerificationEmail(email.trim());
          toast.error('Email não verificado. Verifique sua caixa de entrada.');
          setIsLoading(false);
          return;
        }
        
        resetLoginAttempts();
        toast.success('Login realizado com sucesso!');
        navigate('/');
      }
    } catch (err) {
      console.error('Auth error:', err);
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!pendingVerificationEmail) return;
    
    setIsResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingVerificationEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?verified=true`
        }
      });

      if (error) {
        toast.error('Erro ao reenviar email: ' + error.message);
      } else {
        toast.success('Email de verificação reenviado! Verifique sua caixa de entrada.');
      }
    } catch (err) {
      console.error('Resend error:', err);
      toast.error('Erro ao reenviar email de verificação.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignUpForm()) return;

    setIsLoading(true);
    try {
      const { error, data } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/email-confirmed`,
          data: { whatsapp }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este email já está cadastrado. Faça login.');
        } else {
          toast.error(error.message);
        }
      } else {
        // Check if email confirmation is required
        if (data.user && !data.user.email_confirmed_at) {
          setPendingVerificationEmail(email.trim());
          toast.success('Conta criada! Verifique seu email para confirmar.');
          setSignUpSuccess(true);
        } else {
          toast.success('Conta criada com sucesso!');
          setSignUpSuccess(true);
        }
      }
    } catch (err: any) {
      console.error('SignUp error:', err);
      toast.error(err.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      toast.error('Erro ao enviar email: ' + error.message);
    } else {
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setShowForgotPassword(false);
    }
    setIsLoading(false);
  };

  const resetSignUpForm = () => {
    setSignUpSuccess(false);
    setPendingVerificationEmail('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setWhatsapp('');
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
              <Mail className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Recuperar Senha</CardTitle>
            <CardDescription>
              Digite seu email para receber um link de recuperação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Link de Recuperação
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowForgotPassword(false)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Gerenciador de Clientes</CardTitle>
          <CardDescription>
            Faça login ou crie sua conta para gerenciar seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup" onClick={resetSignUpForm}>Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
                
                {pendingVerificationEmail && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                      Email não verificado: <strong>{pendingVerificationEmail}</strong>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerificationEmail}
                      disabled={isResendingEmail}
                      className="w-full"
                    >
                      {isResendingEmail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reenviar Email de Verificação
                    </Button>
                  </div>
                )}
                
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Esqueceu sua senha?
                </Button>

                <div className="relative my-4">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    ou continue com
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Entrar com Google
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              {!signUpSuccess ? (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="bg-muted/50 border rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>Apenas emails do Gmail são aceitos</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email (Gmail)</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-whatsapp">WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-whatsapp"
                        type="tel"
                        placeholder="(91) 98091-0280"
                        value={formatWhatsApp(whatsapp)}
                        onChange={(e) => setWhatsapp(unformatWhatsApp(e.target.value))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="Repita a senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar Conta
                  </Button>
                </form>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Verifique seu Email</h3>
                    <p className="text-sm text-muted-foreground">
                      Enviamos um link de confirmação para:
                    </p>
                    <p className="font-medium text-primary">{pendingVerificationEmail || email}</p>
                    <p className="text-sm text-muted-foreground mt-4">
                      Clique no link do email para ativar sua conta.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <Button 
                      variant="outline"
                      onClick={handleResendVerificationEmail}
                      disabled={isResendingEmail}
                      className="w-full"
                    >
                      {isResendingEmail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reenviar Email de Verificação
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        resetSignUpForm();
                        const loginTab = document.querySelector('[value="login"]') as HTMLElement;
                        loginTab?.click();
                      }} 
                      className="w-full"
                    >
                      Ir para Login
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Não recebeu? Verifique a pasta de spam ou lixo eletrônico.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
