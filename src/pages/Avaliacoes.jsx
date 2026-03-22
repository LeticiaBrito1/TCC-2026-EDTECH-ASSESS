import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus, Pencil, Trash2, Search, FileText, Sparkles, Loader2, Download, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { generateQuestionsForAssessment } from "@/lib/aiAssessmentGenerator";
import { generateAssessmentPdf } from "@/lib/assessmentPdfGenerator";

const STATUS_MAP = {
  rascunho: { label: "Rascunho", class: "bg-muted text-muted-foreground" },
  publicada: { label: "Publicada", class: "bg-primary/10 text-primary" },
  aplicada: { label: "Aplicada", class: "bg-warning/10 text-warning" },
  corrigida: { label: "Corrigida", class: "bg-success/10 text-success" }
};

const emptyAiForm = {
  titulo: "",
  turma_id: "",
  disciplina_id: "",
  tema: "",
  quantidade: 5,
  nivel: "medio",
  competencia: "",
  contexto: "",
  total_pontos: 10,
  status: "rascunho",
  data_aplicacao: "",
  embaralhar_questoes: true,
  embaralhar_alternativas: false,
  instrucoes: ""
};

const FALLBACK_AI_SOURCES = new Set(["fallback", "mock", "local"]);

export default function Avaliacoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pdfTarget, setPdfTarget] = useState(null);
  const [pdfVersions, setPdfVersions] = useState(1);
  const [pdfIncludeAnswerKey, setPdfIncludeAnswerKey] = useState(true);
  const [pdfIncludeStudents, setPdfIncludeStudents] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncTarget, setSyncTarget] = useState(null);
  const [syncProvider, setSyncProvider] = useState("moodle");
  const [syncIncludeResults, setSyncIncludeResults] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [aiForm, setAiForm] = useState(emptyAiForm);
  const [form, setForm] = useState({
    titulo: "", disciplina_id: "", turma_id: "", data_aplicacao: "", status: "rascunho",
    questoes_ids: [], total_pontos: 10, embaralhar_questoes: false, embaralhar_alternativas: false, instrucoes: ""
  });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });
  const { data: disciplinas = [] } = useQuery({ queryKey: ["disciplinas"], queryFn: () => appClient.entities.Disciplina.list() });
  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });

  const create = useMutation({ mutationFn: (d) => appClient.entities.Avaliacao.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["avaliacoes"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Avaliacao.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["avaliacoes"] }); closeDialog(); } });
  const remove = useMutation({ mutationFn: (id) => appClient.entities.Avaliacao.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["avaliacoes"] }) });
  const generateWithAi = useMutation({
    mutationFn: async () => {
      if (!aiForm.titulo || !aiForm.turma_id || !aiForm.disciplina_id || !aiForm.tema) {
        throw new Error("Preencha título, turma, disciplina e tema para gerar com IA.");
      }

      await appClient.auth.me();

      const { questions, source, reason } = await generateQuestionsForAssessment({
        titulo: aiForm.titulo,
        tema: aiForm.tema,
        quantidade: aiForm.quantidade,
        nivel: aiForm.nivel,
        disciplinaId: aiForm.disciplina_id,
        competencia: aiForm.competencia,
        contexto: aiForm.contexto
      });

      if (questions.length === 0) {
        throw new Error("Nenhuma questão foi retornada para gerar a avaliação.");
      }

      const createdQuestions = await Promise.all(
        questions.map((question) => appClient.entities.Questao.create(question))
      );

      const avaliacaoPayload = {
        titulo: aiForm.titulo,
        disciplina_id: aiForm.disciplina_id,
        turma_id: aiForm.turma_id,
        data_aplicacao: aiForm.data_aplicacao || "",
        status: aiForm.status || "rascunho",
        questoes_ids: createdQuestions.map((question) => question.id),
        total_pontos: Number(aiForm.total_pontos) || 10,
        embaralhar_questoes: Boolean(aiForm.embaralhar_questoes),
        embaralhar_alternativas: Boolean(aiForm.embaralhar_alternativas),
        instrucoes: aiForm.instrucoes || ""
      };

      const createdAssessment = await appClient.entities.Avaliacao.create(avaliacaoPayload);
      return { createdAssessment, createdCount: createdQuestions.length, source, reason };
    },
    onSuccess: ({ createdCount, source, reason }) => {
      qc.invalidateQueries({ queryKey: ["questoes"] });
      qc.invalidateQueries({ queryKey: ["avaliacoes"] });
      closeAiDialog();

      const normalizedSource = String(source || "").trim().toLowerCase();
      const usedFallback = FALLBACK_AI_SOURCES.has(normalizedSource);

      toast({
        title: "Avaliação gerada",
        description: usedFallback
          ? `${createdCount} questão(ões) criadas em modo local. ${reason || "Configure OPENAI_API_KEY no backend para geração real por IA."}`
          : `${createdCount} questão(ões) geradas por IA e vinculadas à avaliação.`
      });
    },
    onError: (error) => {
      toast({
        title: "Falha ao gerar avaliação",
        description: error?.message || "Não foi possível gerar a avaliação agora.",
        variant: "destructive"
      });
    }
  });

  const closeDialog = () => {
    setDialogOpen(false); setEditing(null);
    setForm({ titulo: "", disciplina_id: "", turma_id: "", data_aplicacao: "", status: "rascunho", questoes_ids: [], total_pontos: 10, embaralhar_questoes: false, embaralhar_alternativas: false, instrucoes: "" });
  };

  const closeAiDialog = () => {
    setAiDialogOpen(false);
    setAiForm(emptyAiForm);
  };

  const closePdfDialog = () => {
    setPdfDialogOpen(false);
    setPdfTarget(null);
    setPdfVersions(1);
    setPdfIncludeAnswerKey(true);
    setPdfIncludeStudents(true);
    setIsGeneratingPdf(false);
  };

  const closeSyncDialog = () => {
    setSyncDialogOpen(false);
    setSyncTarget(null);
    setSyncProvider("moodle");
    setSyncIncludeResults(true);
    setIsSyncing(false);
  };

  const openPdfDialog = (assessment) => {
    setPdfTarget(assessment);
    setPdfVersions(1);
    setPdfIncludeAnswerKey(true);
    setPdfIncludeStudents(true);
    setPdfDialogOpen(true);
  };

  const openSyncDialog = (assessment) => {
    setSyncTarget(assessment);
    setSyncProvider("moodle");
    setSyncIncludeResults(true);
    setSyncDialogOpen(true);
  };

  const handleGeneratePdf = async () => {
    if (!pdfTarget) return;
    setIsGeneratingPdf(true);

    try {
      const selectedQuestions = (pdfTarget.questoes_ids || [])
        .map((id) => questoes.find((q) => q.id === id))
        .filter(Boolean);

      if (selectedQuestions.length === 0) {
        throw new Error("Essa avaliação não possui questões vinculadas.");
      }

      const turmaAlunos = alunos.filter((aluno) => aluno.turma_id === pdfTarget.turma_id);

      await generateAssessmentPdf({
        assessment: pdfTarget,
        questions: selectedQuestions,
        alunos: pdfIncludeStudents ? turmaAlunos : [],
        disciplinaNome: getDisciplinaName(pdfTarget.disciplina_id),
        turmaNome: getTurmaName(pdfTarget.turma_id),
        versionsCount: pdfVersions,
        includeAnswerKey: pdfIncludeAnswerKey,
      });

      toast({
        title: "PDF gerado",
        description: "O arquivo da avaliação foi baixado com sucesso.",
      });
      closePdfDialog();
    } catch (error) {
      toast({
        title: "Falha ao gerar PDF",
        description: error?.message || "Não foi possível gerar o PDF da avaliação.",
        variant: "destructive",
      });
      setIsGeneratingPdf(false);
    }
  };

  const handleSyncLms = async () => {
    if (!syncTarget) return;
    setIsSyncing(true);

    try {
      const result = await appClient.integrations.syncLms({
        provider: syncProvider,
        avaliacao_id: syncTarget.id,
        turma_id: syncTarget.turma_id,
        include_resultados: syncIncludeResults,
      });

      toast({
        title: "Sincronização LMS concluída",
        description: result.sent
          ? `Payload enviado ao LMS (${syncProvider}).`
          : `Payload preparado para ${syncProvider}. Configure LMS_WEBHOOK_URL para envio automático.`,
      });
      closeSyncDialog();
    } catch (error) {
      toast({
        title: "Falha na integração LMS",
        description: error?.message || "Não foi possível sincronizar agora.",
        variant: "destructive",
      });
      setIsSyncing(false);
    }
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({
      titulo: a.titulo, disciplina_id: a.disciplina_id || "", turma_id: a.turma_id || "",
      data_aplicacao: a.data_aplicacao || "", status: a.status || "rascunho",
      questoes_ids: a.questoes_ids || [], total_pontos: a.total_pontos || 10,
      embaralhar_questoes: a.embaralhar_questoes || false, embaralhar_alternativas: a.embaralhar_alternativas || false,
      instrucoes: a.instrucoes || ""
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.titulo || !form.disciplina_id || !form.turma_id) return;
    editing ? update.mutate({ id: editing.id, d: form }) : create.mutate(form);
  };

  const toggleQuestao = (qid) => {
    const ids = form.questoes_ids.includes(qid) ? form.questoes_ids.filter(id => id !== qid) : [...form.questoes_ids, qid];
    setForm({ ...form, questoes_ids: ids });
  };

  const getTurmaName = (id) => turmas.find(t => t.id === id)?.nome || "—";
  const getDisciplinaName = (id) => disciplinas.find(d => d.id === id)?.nome || "—";

  const filteredDisc = form.disciplina_id ? questoes.filter(q => q.disciplina_id === form.disciplina_id) : questoes;
  const filtered = avaliacoes.filter(a => a.titulo?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Avaliações" description="Crie e gerencie suas provas" action={() => setDialogOpen(true)} actionLabel="Nova Avaliação" actionIcon={Plus} />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar avaliações..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="mb-6">
        <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setAiDialogOpen(true)}>
          <Sparkles className="w-4 h-4 mr-2" />
          Gerar Avaliação com IA
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma avaliação" description="Crie sua primeira avaliação." actionLabel="Criar Avaliação" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <Card key={a.id} className="hover:shadow-lg transition-shadow duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{a.titulo}</h3>
                      <p className="text-xs text-muted-foreground">{getDisciplinaName(a.disciplina_id)}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${STATUS_MAP[a.status]?.class || ""}`}>{STATUS_MAP[a.status]?.label || a.status}</Badge>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{getTurmaName(a.turma_id)}</Badge>
                    <Badge variant="outline" className="text-xs">{a.questoes_ids?.length || 0} questões</Badge>
                    {a.data_aplicacao && <Badge variant="outline" className="text-xs">{format(new Date(a.data_aplicacao), "dd/MM/yyyy")}</Badge>}
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSyncDialog(a)}>
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPdfDialog(a)}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Prova 1 - Matemática" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Turma *</Label>
                <Select value={form.turma_id} onValueChange={v => setForm({ ...form, turma_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Disciplina *</Label>
                <Select value={form.disciplina_id} onValueChange={v => setForm({ ...form, disciplina_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data de Aplicação</Label><Input type="date" value={form.data_aplicacao} onChange={e => setForm({ ...form, data_aplicacao: e.target.value })} /></div>
              <div className="space-y-2"><Label>Total de Pontos</Label><Input type="number" value={form.total_pontos} onChange={e => setForm({ ...form, total_pontos: Number(e.target.value) })} /></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.embaralhar_questoes} onCheckedChange={v => setForm({ ...form, embaralhar_questoes: v })} /><Label>Embaralhar questões</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.embaralhar_alternativas} onCheckedChange={v => setForm({ ...form, embaralhar_alternativas: v })} /><Label>Embaralhar alternativas</Label></div>
            </div>
            <div className="space-y-2"><Label>Instruções</Label><Textarea value={form.instrucoes} onChange={e => setForm({ ...form, instrucoes: e.target.value })} rows={2} /></div>

            <div className="space-y-3">
              <Label>Selecione as Questões ({form.questoes_ids.length} selecionadas)</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3">
                {filteredDisc.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma questão disponível. Cadastre questões primeiro.</p>
                ) : filteredDisc.map(q => (
                  <label key={q.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                    <Checkbox checked={form.questoes_ids.includes(q.id)} onCheckedChange={() => toggleQuestao(q.id)} className="mt-0.5" />
                    <span className="text-sm text-foreground line-clamp-2">{q.enunciado}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiDialogOpen} onOpenChange={v => { if (!v) closeAiDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Avaliação com IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={aiForm.titulo}
                onChange={e => setAiForm({ ...aiForm, titulo: e.target.value })}
                placeholder="Ex: Avaliação diagnóstica de Matemática"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turma *</Label>
                <Select value={aiForm.turma_id} onValueChange={v => setAiForm({ ...aiForm, turma_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Disciplina *</Label>
                <Select value={aiForm.disciplina_id} onValueChange={v => setAiForm({ ...aiForm, disciplina_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tema *</Label>
                <Input
                  value={aiForm.tema}
                  onChange={e => setAiForm({ ...aiForm, tema: e.target.value })}
                  placeholder="Ex: Equações do 1º grau"
                />
              </div>
              <div className="space-y-2">
                <Label>Competência</Label>
                <Input
                  value={aiForm.competencia}
                  onChange={e => setAiForm({ ...aiForm, competencia: e.target.value })}
                  placeholder="Ex: Resolver problemas matemáticos"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quantidade de Questões</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
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
              <div className="space-y-2">
                <Label>Total de Pontos</Label>
                <Input
                  type="number"
                  min={1}
                  value={aiForm.total_pontos}
                  onChange={e => setAiForm({ ...aiForm, total_pontos: Number(e.target.value || 10) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status da Avaliação</Label>
                <Select value={aiForm.status} onValueChange={v => setAiForm({ ...aiForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="publicada">Publicada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Aplicação</Label>
                <Input
                  type="date"
                  value={aiForm.data_aplicacao}
                  onChange={e => setAiForm({ ...aiForm, data_aplicacao: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={aiForm.embaralhar_questoes}
                  onCheckedChange={v => setAiForm({ ...aiForm, embaralhar_questoes: v })}
                />
                <Label>Embaralhar questões</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={aiForm.embaralhar_alternativas}
                  onCheckedChange={v => setAiForm({ ...aiForm, embaralhar_alternativas: v })}
                />
                <Label>Embaralhar alternativas</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contexto (opcional)</Label>
              <Textarea
                rows={3}
                value={aiForm.contexto}
                onChange={e => setAiForm({ ...aiForm, contexto: e.target.value })}
                placeholder="Informe o contexto da turma, objetivo da prova ou recorte do conteúdo."
              />
            </div>

            <div className="space-y-2">
              <Label>Instruções da Avaliação</Label>
              <Textarea
                rows={2}
                value={aiForm.instrucoes}
                onChange={e => setAiForm({ ...aiForm, instrucoes: e.target.value })}
                placeholder="Ex: não usar calculadora."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAiDialog}>Cancelar</Button>
            <Button onClick={() => generateWithAi.mutate()} disabled={generateWithAi.isPending}>
              {generateWithAi.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {generateWithAi.isPending ? "Gerando..." : "Gerar Avaliação com IA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pdfDialogOpen} onOpenChange={v => { if (!v) closePdfDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar PDF da Avaliação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              {pdfTarget ? (
                <>Avaliação: <span className="font-medium text-foreground">{pdfTarget.titulo}</span></>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Quantidade de versões</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={pdfVersions}
                onChange={(e) => setPdfVersions(Math.max(1, Math.min(10, Number(e.target.value || 1))))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Gerar folhas individualizadas por aluno (QR com aluno_id)</Label>
              <Switch checked={pdfIncludeStudents} onCheckedChange={setPdfIncludeStudents} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Incluir gabarito por versão</Label>
              <Switch checked={pdfIncludeAnswerKey} onCheckedChange={setPdfIncludeAnswerKey} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePdfDialog}>Cancelar</Button>
            <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {isGeneratingPdf ? "Gerando..." : "Gerar PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={syncDialogOpen} onOpenChange={v => { if (!v) closeSyncDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sincronizar com LMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              {syncTarget ? (
                <>Avaliação: <span className="font-medium text-foreground">{syncTarget.titulo}</span></>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Provedor LMS</Label>
              <Select value={syncProvider} onValueChange={setSyncProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moodle">Moodle</SelectItem>
                  <SelectItem value="google_classroom">Google Classroom</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="custom">Custom/Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Enviar resultados junto com avaliação</Label>
              <Switch checked={syncIncludeResults} onCheckedChange={setSyncIncludeResults} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSyncDialog}>Cancelar</Button>
            <Button onClick={handleSyncLms} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
              {isSyncing ? "Sincronizando..." : "Sincronizar LMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
