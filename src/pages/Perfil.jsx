import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { User, Lock, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";

export default function Perfil() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();

  const [dadosForm, setDadosForm] = useState({ full_name: "", email: "" });
  const [senhaForm, setSenhaForm] = useState({ senha_atual: "", nova_senha: "", confirmar_senha: "" });
  const [isSavingDados, setIsSavingDados] = useState(false);
  const [isSavingSenha, setIsSavingSenha] = useState(false);
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);

  useEffect(() => {
    if (authUser) {
      setDadosForm({ full_name: authUser.full_name || "", email: authUser.email || "" });
    }
  }, [authUser]);

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const handleSalvarDados = async () => {
    if (!dadosForm.full_name.trim() || !dadosForm.email.trim()) {
      toast({ title: "Campos obrigatórios", description: "Nome e e-mail são obrigatórios.", variant: "destructive" });
      return;
    }
    setIsSavingDados(true);
    try {
      await appClient.auth.updateProfile({ full_name: dadosForm.full_name.trim(), email: dadosForm.email.trim() });
      toast({ title: "Dados atualizados", description: "Seu perfil foi atualizado com sucesso." });
    } catch (error) {
      toast({ title: "Falha ao atualizar", description: error?.message || "Não foi possível atualizar os dados.", variant: "destructive" });
    } finally {
      setIsSavingDados(false);
    }
  };

  const handleAlterarSenha = async () => {
    if (!senhaForm.senha_atual || !senhaForm.nova_senha || !senhaForm.confirmar_senha) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos de senha.", variant: "destructive" });
      return;
    }
    if (senhaForm.nova_senha !== senhaForm.confirmar_senha) {
      toast({ title: "Senhas divergem", description: "A nova senha e a confirmação não coincidem.", variant: "destructive" });
      return;
    }
    if (senhaForm.nova_senha.length < 8) {
      toast({ title: "Senha fraca", description: "A nova senha deve ter pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (!/[A-Za-z]/.test(senhaForm.nova_senha) || !/[0-9]/.test(senhaForm.nova_senha)) {
      toast({ title: "Senha fraca", description: "A nova senha deve conter letras e números.", variant: "destructive" });
      return;
    }
    setIsSavingSenha(true);
    try {
      await appClient.auth.changePassword({ senha_atual: senhaForm.senha_atual, nova_senha: senhaForm.nova_senha });
      toast({ title: "Senha alterada", description: "Sua senha foi alterada com sucesso." });
      setSenhaForm({ senha_atual: "", nova_senha: "", confirmar_senha: "" });
    } catch (error) {
      toast({ title: "Falha ao alterar senha", description: error?.message || "Senha atual incorreta ou erro interno.", variant: "destructive" });
    } finally {
      setIsSavingSenha(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <PageHeader title="Meu Perfil" description="Gerencie suas informações e acesso" />

      {/* Avatar e nome */}
      <Card>
        <CardContent className="p-6 flex items-center gap-5">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl font-bold text-white bg-primary">
              {getInitials(dadosForm.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold text-foreground">{dadosForm.full_name || "—"}</p>
            <p className="text-sm text-muted-foreground">{dadosForm.email || "—"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Dados pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo *</Label>
            <Input
              spellCheck
              value={dadosForm.full_name}
              onChange={e => setDadosForm({ ...dadosForm, full_name: e.target.value })}
              placeholder="Seu nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail *</Label>
            <Input
              type="email"
              value={dadosForm.email}
              onChange={e => setDadosForm({ ...dadosForm, email: e.target.value })}
              placeholder="seu@email.com"
            />
          </div>
          <Button onClick={handleSalvarDados} disabled={isSavingDados}>
            {isSavingDados ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isSavingDados ? "Salvando..." : "Salvar dados"}
          </Button>
        </CardContent>
      </Card>

      {/* Alterar senha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senha-atual">Senha atual *</Label>
            <div className="relative">
              <Input
                id="senha-atual"
                type={showSenhaAtual ? "text" : "password"}
                value={senhaForm.senha_atual}
                onChange={e => setSenhaForm({ ...senhaForm, senha_atual: e.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={showSenhaAtual ? "Ocultar senha atual" : "Mostrar senha atual"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowSenhaAtual(v => !v)}
              >
                {showSenhaAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha *</Label>
              <div className="relative">
                <Input
                  id="nova-senha"
                  type={showNovaSenha ? "text" : "password"}
                  value={senhaForm.nova_senha}
                  onChange={e => setSenhaForm({ ...senhaForm, nova_senha: e.target.value })}
                  placeholder="Mín. 8 caracteres (letras e números)"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showNovaSenha ? "Ocultar nova senha" : "Mostrar nova senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNovaSenha(v => !v)}
                >
                  {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar nova senha *</Label>
              <Input
                id="confirmar-senha"
                type="password"
                value={senhaForm.confirmar_senha}
                onChange={e => setSenhaForm({ ...senhaForm, confirmar_senha: e.target.value })}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button onClick={handleAlterarSenha} disabled={isSavingSenha} variant="outline">
            {isSavingSenha ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            {isSavingSenha ? "Alterando..." : "Alterar senha"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
