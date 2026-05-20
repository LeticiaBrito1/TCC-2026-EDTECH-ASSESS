import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileQuestion, Plus, Pencil, Trash2, Search, CheckCircle2, Sparkles, Loader2, Paperclip, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/AlertDialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { generateQuestionsForAssessment } from "@/lib/aiAssessmentGenerator";
import { extractTextFromFile, ACCEPTED_FILE_TYPES, ACCEPTED_FILE_LABEL } from "@/lib/fileTextExtractor";

const DIFICULDADES = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
const LETRAS = ["A", "B", "C", "D", "E"];
const FALLBACK_AI_SOURCES = new Set(["fallback", "mock", "local"]);

const emptyForm = () => ({
  enunciado: "", disciplina_id: "", tema: "", nivel_dificuldade: "medio", competencia: "",
  alternativas: LETRAS.map(l => ({ letra: l, texto: "" })),
  gabarito: "A"
});

const emptyAiForm = {
  tema: "", quantidade: 5, nivel: "medio", disciplina_id: "", competencia: "", contexto: ""
};


export default function Questoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterTema, setFilterTema] = useState("all");
  const [filterCompetencia, setFilterCompetencia] = useState("all");
  const [form, setForm] = useState(emptyForm());
  const [aiForm, setAiForm] = useState(emptyAiForm);
  const [materialNome, setMaterialNome] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });
  const { data: disciplinas = [] } = useQuery({ queryKey: ["disciplinas"], queryFn: () => appClient.entities.Disciplina.list() });

  const create = useMutation({ mutationFn: (d) => appClient.entities.Questao.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["questoes"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Questao.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["questoes"] }); closeDialog(); } });
  const remove = useMutation({ mutationFn: (id) => appClient.entities.Questao.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["questoes"] }) });

  const generateWithAi = useMutation({
    mutationFn: async () => {
      if (!aiForm.tema) throw new Error("Informe o tema para gerar as questões.");
      await appClient.auth.me();
      const { questions, source, reason } = await generateQuestionsForAssessment({
        titulo: `Questões sobre ${aiForm.tema}`,
        tema: aiForm.tema,
        quantidade: aiForm.quantidade,
        nivel: aiForm.nivel,
        disciplinaId: aiForm.disciplina_id,
        competencia: aiForm.competencia,
        contexto: aiForm.contexto,
      });
      if (questions.length === 0) throw new Error("Nenhuma questão foi retornada pela IA.");
      const created = await Promise.all(questions.map(q => appClient.entities.Questao.create(q)));
      return { count: created.length, source, reason };
    },
    onSuccess: ({ count, source, reason }) => {
      qc.invalidateQueries({ queryKey: ["questoes"] });
      closeAiDialog();
      const normalizedSource = String(source || "").trim().toLowerCase();
      const usedFallback = FALLBACK_AI_SOURCES.has(normalizedSource);
      toast({
        title: usedFallback ? "Questões de exemplo criadas" : "Questões geradas pela IA",
        description: usedFallback
          ? `${count} questão(ões) de placeholder criadas. Configure a chave GROQ_API_KEY no backend para gerar questões reais.`
          : `${count} questão(ões) geradas pela IA (${source}) e adicionadas ao banco.`,
        variant: usedFallback ? "destructive" : "default",
      });
    },
    onError: (error) => {
      toast({ title: "Falha ao gerar", description: error?.message || "Não foi possível gerar as questões.", variant: "destructive" });
    }
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm()); };
  const closeAiDialog = () => { setAiDialogOpen(false); setAiForm(emptyAiForm); setMaterialNome(""); };

  const openEdit = (q) => {
    setEditing(q);
    setForm({
      enunciado: q.enunciado || "",
      disciplina_id: q.disciplina_id || "",
      tema: q.tema || "",
      nivel_dificuldade: q.nivel_dificuldade || "medio",
      competencia: q.competencia || "",
      alternativas: q.alternativas?.length > 0 ? q.alternativas : LETRAS.map(l => ({ letra: l, texto: "" })),
      gabarito: q.gabarito || "A"
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.enunciado.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o enunciado da questão.", variant: "destructive" });
      return;
    }
    const altsPreenchidas = form.alternativas.filter(a => a.texto.trim());
    if (altsPreenchidas.length < 2) {
      toast({ title: "Alternativas insuficientes", description: "Preencha pelo menos 2 alternativas.", variant: "destructive" });
      return;
    }
    if (!altsPreenchidas.find(a => a.letra === form.gabarito)) {
      toast({ title: "Gabarito inválido", description: "O gabarito deve corresponder a uma alternativa preenchida.", variant: "destructive" });
      return;
    }
    const data = { ...form, alternativas: altsPreenchidas };
    editing ? update.mutate({ id: editing.id, d: data }) : create.mutate(data);
  };

  const updateAlt = (idx, text) => {
    const alts = [...form.alternativas];
    alts[idx] = { ...alts[idx], texto: text };
    setForm({ ...form, alternativas: alts });
  };

  const handleMaterialFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const text = await extractTextFromFile(file);
      const truncated = text.trim().slice(0, 4000);
      setAiForm(prev => ({
        ...prev,
        contexto: prev.contexto
          ? `${prev.contexto}\n\n--- ${file.name} ---\n${truncated}`
          : `--- ${file.name} ---\n${truncated}`
      }));
      setMaterialNome(file.name);
    } catch {
      toast({ title: "Erro ao ler arquivo", description: "Não foi possível extrair o conteúdo do arquivo.", variant: "destructive" });
    }
  };

  const getDisciplinaName = (id) => disciplinas.find(d => d.id === id)?.nome || "";
  const diffColor = { facil: "bg-success/10 text-success", medio: "bg-warning/10 text-warning", dificil: "bg-destructive/10 text-destructive" };

  const temas = [...new Set(questoes.map(q => q.tema).filter(Boolean))].sort();
  const competencias = [...new Set(questoes.map(q => q.competencia).filter(Boolean))].sort();
  const hasFilters = filterDifficulty !== "all" || filterTema !== "all" || filterCompetencia !== "all" || search.trim();

  const filtered = questoes
    .filter(q => filterDifficulty === "all" || q.nivel_dificuldade === filterDifficulty)
    .filter(q => filterTema === "all" || q.tema === filterTema)
    .filter(q => filterCompetencia === "all" || q.competencia === filterCompetencia)
    .filter(q => q.enunciado?.toLowerCase().includes(search.toLowerCase()) || q.tema?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Banco de Questões" description="Cadastre e organize suas questões" action={() => setDialogOpen(true)} actionLabel="Nova Questão" actionIcon={Plus} />

      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar questões..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="secondary" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar com IA
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Nível" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os níveis</SelectItem>
              {Object.entries(DIFICULDADES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTema} onValueChange={setFilterTema}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tema" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os temas</SelectItem>
              {temas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCompetencia} onValueChange={setFilterCompetencia}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Competência" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as competências</SelectItem>
              {competencias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <button
              className="text-xs text-primary hover:underline self-center"
              onClick={() => { setSearch(""); setFilterDifficulty("all"); setFilterTema("all"); setFilterCompetencia("all"); }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileQuestion} title="Nenhuma questão" description="Cadastre suas questões para criar avaliações." actionLabel="Criar Questão" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="space-y-3">
          {filtered.map((q, idx) => (
            <Card key={q.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                      <Badge className={`text-xs ${diffColor[q.nivel_dificuldade]}`}>{DIFICULDADES[q.nivel_dificuldade]}</Badge>
                      {q.tema && <Badge variant="outline" className="text-xs">{q.tema}</Badge>}
                      {getDisciplinaName(q.disciplina_id) && <Badge variant="outline" className="text-xs">{getDisciplinaName(q.disciplina_id)}</Badge>}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{q.enunciado}</p>
                    <div className="flex gap-3 mt-2 flex-wrap">
                      {q.alternativas?.map(a => (
                        <span key={a.letra} className={`text-xs px-2 py-1 rounded-md ${a.letra === q.gabarito ? 'bg-success/10 text-success font-semibold' : 'bg-muted text-muted-foreground'}`}>
                          {a.letra === q.gabarito && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                          {a.letra}) {a.texto?.slice(0, 30)}{a.texto?.length > 30 ? "..." : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleteTarget(q); setDeleteDialogOpen(true); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: Nova/Editar questão */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Questão" : "Nova Questão"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Enunciado *</Label>
              <Textarea spellCheck value={form.enunciado} onChange={e => setForm({ ...form, enunciado: e.target.value })} rows={4} placeholder="Digite o enunciado da questão..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Disciplina</Label>
                <Select value={form.disciplina_id} onValueChange={v => setForm({ ...form, disciplina_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Nível *</Label>
                <Select value={form.nivel_dificuldade} onValueChange={v => setForm({ ...form, nivel_dificuldade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(DIFICULDADES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tema</Label><Input value={form.tema} onChange={e => setForm({ ...form, tema: e.target.value })} placeholder="Ex: Equações" /></div>
              <div className="space-y-2"><Label>Competência</Label><Input value={form.competencia} onChange={e => setForm({ ...form, competencia: e.target.value })} /></div>
            </div>
            <div className="space-y-3">
              <Label>Alternativas</Label>
              {form.alternativas.map((a, i) => (
                <div key={a.letra} className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${form.gabarito === a.letra ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {a.letra}
                  </span>
                  <Input spellCheck value={a.texto} onChange={e => updateAlt(i, e.target.value)} placeholder={`Alternativa ${a.letra}`} className="flex-1" />
                </div>
              ))}
            </div>
            <div className="space-y-2"><Label>Gabarito (resposta correta) *</Label>
              <Select value={form.gabarito} onValueChange={v => setForm({ ...form, gabarito: v })}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{LETRAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerar com IA */}
      <Dialog open={aiDialogOpen} onOpenChange={v => { if (!v) closeAiDialog(); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Questões com IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tema *</Label>
                <Input
                  spellCheck
                  value={aiForm.tema}
                  onChange={e => setAiForm({ ...aiForm, tema: e.target.value })}
                  placeholder="Ex: Equações do 1º grau"
                />
              </div>
              <div className="space-y-2">
                <Label>Disciplina</Label>
                <Select value={aiForm.disciplina_id} onValueChange={v => setAiForm({ ...aiForm, disciplina_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number" min={1} max={20}
                  value={aiForm.quantidade}
                  onChange={e => setAiForm({ ...aiForm, quantidade: Number(e.target.value || 1) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nível</Label>
                <Select value={aiForm.nivel} onValueChange={v => setAiForm({ ...aiForm, nivel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facil">Fácil</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="dificil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Competência</Label>
              <Input
                spellCheck
                value={aiForm.competencia}
                onChange={e => setAiForm({ ...aiForm, competencia: e.target.value })}
                placeholder="Ex: Resolver problemas algébricos"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Material Didático (contexto para a IA)</Label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleMaterialFile}
                    className="sr-only"
                  />
                  <span className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                    <Paperclip className="w-3.5 h-3.5" />
                    Anexar material
                  </span>
                </label>
              </div>
              {materialNome && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-1.5">
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{materialNome}</span>
                  <button onClick={() => { setMaterialNome(""); setAiForm(prev => ({ ...prev, contexto: "" })); }}>
                    <X className="w-3.5 h-3.5 hover:text-destructive" />
                  </button>
                </div>
              )}
              <Textarea
                rows={4}
                spellCheck
                value={aiForm.contexto}
                onChange={e => setAiForm({ ...aiForm, contexto: e.target.value })}
                placeholder="Cole aqui o conteúdo do material didático ou descreva o contexto da avaliação..."
              />
              <p className="text-xs text-muted-foreground">Aceita PDF, Word, PowerPoint, Excel, TXT, MD e CSV (até 4 000 caracteres extraídos).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAiDialog}>Cancelar</Button>
            <Button onClick={() => generateWithAi.mutate()} disabled={generateWithAi.isPending}>
              {generateWithAi.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {generateWithAi.isPending ? "Gerando..." : "Gerar Questões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir questão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A questão será removida permanentemente do banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { remove.mutate(deleteTarget.id); setDeleteDialogOpen(false); setDeleteTarget(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
