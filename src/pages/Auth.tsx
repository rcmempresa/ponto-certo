import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ nome: '', email: '', password: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    });

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Bem-vindo!',
        description: 'Login efetuado com sucesso.',
      });
      navigate('/dashboard');
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!loginData.email) {
      toast({
        title: 'Introduza o seu email',
        description: 'Escreva o email da sua conta e clique novamente.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(loginData.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Email enviado',
      description: 'Verifique o seu email para definir uma nova palavra-passe.',
    });
  };

  const handleRegister = async (e: React.FormEvent) => {

    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: registerData.email,
      password: registerData.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          nome: registerData.nome,
        },
      },
    });

    if (error) {
      toast({
        title: 'Erro ao registar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Pode agora entrar na sua conta.',
      });
      navigate('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary mb-4">
            <Clock className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Pica-Ponto Pro</h1>
          <p className="text-muted-foreground mt-2">
            Gestão de Assiduidade e RH
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-0 shadow-soft">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Registar</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              {/* Login Form */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="email@empresa.pt"
                        className="pl-10"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Palavra-passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'A entrar...' : 'Entrar'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                    onClick={handleForgotPassword}
                    disabled={loading}
                  >
                    Esqueci-me da palavra-passe
                  </button>
                </form>
              </TabsContent>


              {/* Register Form */}
              <TabsContent value="register" className="mt-0">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-nome">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-nome"
                        type="text"
                        placeholder="João Silva"
                        className="pl-10"
                        value={registerData.nome}
                        onChange={(e) => setRegisterData({ ...registerData, nome: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="email@empresa.pt"
                        className="pl-10"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Palavra-passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'A criar conta...' : 'Criar conta'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Ao continuar, aceita os nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
