import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus, Pencil, Trash2, Search, FileText, Sparkles, Loader2, Download, Share2, Paperclip, X, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import EmptyState from "@/components/shared/EmptyState";
import { format, isValid, parseISO } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { generateQuestionsForAssessment } from "@/lib/aiAssessmentGenerator";
import { generateAssessmentPdf } from "@/lib/assessmentPdfGenerator";
import { extractTextFromFile, ACCEPTED_FILE_TYPES, ACCEPTED_FILE_LABEL } from "@/lib/fileTextExtractor";

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
  instrucoes: "",
  selectedQuestaoIds: [],
};

const FALLBACK_AI_SOURCES = new Set(["fallback", "mock", "local"]);

export default function Avaliacoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pdfTarget, setPdfTarget] = useState(null);
  const [pdfVersions, setPdfVersions] = useState(1);
  const [pdfIncludeAnswerKey, setPdfIncludeAnswerKey] = useState(false);
  const [pdfIncludeStudents, setPdfIncludeStudents] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncTarget, setSyncTarget] = useState(null);
  const [syncProvider, setSyncProvider] = useState("moodle");
  const [syncIncludeResults, setSyncIncludeResults] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [turmaFilter, setTurmaFilter] = useState("all");
  const [disciplinaFilter, setDisciplinaFilter] = useState("all");
  const [sortBy, setSortBy] = useState("data_desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [aiForm, setAiForm] = useState(emptyAiForm);
  const [materialNome, setMaterialNome] = useState("");
  const [questoesBancoSearch, setQuestoesBancoSearch] = useState("");
  const [bancoSortBy, setBancoSortBy] = useState("az");
  const [bancoNivelFilter, setBancoNivelFilter] = useState("all");
  const [questoesSortBy, setQuestoesSortBy] = useState("az");
  const [questoesNivelFilter, setQuestoesNivelFilter] = useState("all");
  const [questoesSearch, setQuestoesSearch] = useState("");
  const [form, setForm] = useState({
    titulo: "", disciplina_id: "", turma_id: "", data_aplicacao: "", status: "rascunho",
    questoes_ids: [], total_pontos: 10, questoes_pesos: {}, embaralhar_questoes: false, embaralhar_alternativas: false, instrucoes: ""
  });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });
  const { data: disciplinas = [] } = useQuery({ queryKey: ["disciplinas"], queryFn: () => appClient.entities.Disciplina.list() });
  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const hasActiveFilters = Boolean(search.trim() || statusFilter !== "all" || turmaFilter !== "all" || disciplinaFilter !== "all" || sortBy !== "data_desc");

  const create = useMutation({ mutationFn: (d) => appClient.entities.Avaliacao.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["avaliacoes"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Avaliacao.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["avaliacoes"] }); closeDialog(); } });
  const remove = useMutation({
    mutationFn: ({ id }) => appClient.entities.Avaliacao.delete(id),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["avaliacoes"] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      toast({
        title: "Avaliação excluída",
        description: variables?.title ? `"${variables.title}" foi removida.` : "A avaliação foi removida com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Falha ao excluir avaliação",
        description: error?.message || "Não foi possível excluir esta avaliação agora.",
        variant: "destructive",
      });
    },
  });
  const generateWithAi = useMutation({
    mutationFn: async () => {
      const selectedIds = Array.isArray(aiForm.selectedQuestaoIds) ? aiForm.selectedQuestaoIds : [];
      const gerarNovos = Number(aiForm.quantidade) > 0;
      if (!aiForm.titulo) {
        throw new Error("Preencha o título da avaliação.");
      }
      if (gerarNovos && !aiForm.tema) {
        throw new Error("Informe o tema para gerar questões com IA.");
      }
      if (!gerarNovos && selectedIds.length === 0) {
        throw new Error("Selecione ao menos uma questão do banco ou defina uma quantidade para gerar com IA.");
      }

      await appClient.auth.me();

      let questions = [];
      let source = "banco";
      let reason = "";

      if (gerarNovos) {
        const aiResult = await generateQuestionsForAssessment({
          titulo: aiForm.titulo,
          tema: aiForm.tema,
          quantidade: aiForm.quantidade,
          nivel: aiForm.nivel,
          disciplinaId: aiForm.disciplina_id,
          competencia: aiForm.competencia,
          contexto: aiForm.contexto
        });
        questions = aiResult.questions;
        source = aiResult.source;
        reason = aiResult.reason;
      }

      if (questions.length === 0 && selectedIds.length === 0) {
        throw new Error("Nenhuma questão disponível. Gere questões com IA ou selecione do banco.");
      }

      const createdQuestions = questions.length > 0
        ? await Promise.all(questions.map((question) => appClient.entities.Questao.create(question)))
        : [];

      const allQuestoesIds = [...selectedIds, ...createdQuestions.map((q) => q.id)];

      const totalPontos = Math.min(100, Math.max(0, Math.round((Number(aiForm.total_pontos) || 10) * 100) / 100));
      const valorPorQuestao = allQuestoesIds.length > 0
        ? Math.round((totalPontos / allQuestoesIds.length) * 100) / 100
        : 0;
      const questoes_pesos = Object.fromEntries(allQuestoesIds.map(id => [id, valorPorQuestao]));

      const avaliacaoPayload = {
        titulo: aiForm.titulo,
        disciplina_id: aiForm.disciplina_id,
        turma_id: aiForm.turma_id,
        data_aplicacao: aiForm.data_aplicacao || "",
        status: aiForm.status || "rascunho",
        questoes_ids: allQuestoesIds,
        total_pontos: totalPontos,
        questoes_pesos,
        embaralhar_questoes: Boolean(aiForm.embaralhar_questoes),
        embaralhar_alternativas: Boolean(aiForm.embaralhar_alternativas),
        instrucoes: aiForm.instrucoes || ""
      };

      const createdAssessment = await appClient.entities.Avaliacao.create(avaliacaoPayload);
      return { createdAssessment, createdCount: createdQuestions.length, selectedCount: selectedIds.length, source, reason };
    },
    onSuccess: ({ createdCount, selectedCount, source, reason }) => {
      qc.invalidateQueries({ queryKey: ["questoes"] });
      qc.invalidateQueries({ queryKey: ["avaliacoes"] });
      closeAiDialog();

      const normalizedSource = String(source || "").trim().toLowerCase();
      const usedFallback = FALLBACK_AI_SOURCES.has(normalizedSource);
      const total = (createdCount || 0) + (selectedCount || 0);
      const parts = [];
      if (createdCount > 0) parts.push(`${createdCount} gerada(s) pela IA${usedFallback ? " (placeholder)" : ` (${source})`}`);
      if (selectedCount > 0) parts.push(`${selectedCount} do banco`);

      toast({
        title: "Avaliação criada",
        description: `${total} questão(ões) vinculadas: ${parts.join(" + ")}.`,
        variant: usedFallback && selectedCount === 0 ? "destructive" : "default",
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
    setForm({ titulo: "", disciplina_id: "", turma_id: "", data_aplicacao: "", status: "rascunho", questoes_ids: [], total_pontos: 10, questoes_pesos: {}, embaralhar_questoes: false, embaralhar_alternativas: false, instrucoes: "" });
    setQuestoesSortBy("az");
    setQuestoesNivelFilter("all");
    setQuestoesSearch("");
  };

  const closeAiDialog = () => {
    setAiDialogOpen(false);
    setAiForm(emptyAiForm);
    setMaterialNome("");
    setQuestoesBancoSearch("");
    setBancoSortBy("az");
    setBancoNivelFilter("all");
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
      questoes_pesos: a.questoes_pesos || {},
      embaralhar_questoes: a.embaralhar_questoes || false, embaralhar_alternativas: a.embaralhar_alternativas || false,
      instrucoes: a.instrucoes || ""
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.titulo) return;
    const pontos = Math.min(100, Math.max(0, Math.round(Number(form.total_pontos) * 100) / 100));
    editing ? update.mutate({ id: editing.id, d: { ...form, total_pontos: pontos } }) : create.mutate({ ...form, total_pontos: pontos });
  };

  const toggleQuestao = (qid) => {
    const isSelected = form.questoes_ids.includes(qid);
    const ids = isSelected ? form.questoes_ids.filter(id => id !== qid) : [...form.questoes_ids, qid];
    const pesos = { ...form.questoes_pesos };
    if (isSelected) delete pesos[qid];
    setForm({ ...form, questoes_ids: ids, questoes_pesos: pesos });
  };

  const setPeso = (qid, valor) => {
    setForm({ ...form, questoes_pesos: { ...form.questoes_pesos, [qid]: valor } });
  };

  const distribuirPontosIgual = () => {
    const n = form.questoes_ids.length;
    if (n === 0) return;
    const valorPorQuestao = Math.round((Number(form.total_pontos) / n) * 100) / 100;
    const pesos = {};
    form.questoes_ids.forEach(id => { pesos[id] = valorPorQuestao; });
    setForm({ ...form, questoes_pesos: pesos });
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTurmaFilter("all");
    setDisciplinaFilter("all");
    setSortBy("data_desc");
  };

  const openDeleteDialog = (assessment) => {
    setDeleteTarget(assessment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAssessment = () => {
    if (!deleteTarget) return;
    remove.mutate({ id: deleteTarget.id, title: deleteTarget.titulo });
  };

  const getTurmaName = (id) => turmas.find(t => t.id === id)?.nome || "—";
  const getDisciplinaName = (id) => disciplinas.find(d => d.id === id)?.nome || "—";
  const getDateValue = (dateValue) => {
    if (!dateValue) return null;
    const parsedDate = typeof dateValue === "string" ? parseISO(dateValue) : new Date(dateValue);
    return isValid(parsedDate) ? parsedDate.getTime() : null;
  };
  const formatApplicationDate = (dateValue) => {
    if (!dateValue) return "";
    const parsedDate = typeof dateValue === "string" ? parseISO(dateValue) : new Date(dateValue);
    return isValid(parsedDate) ? format(parsedDate, "dd/MM/yyyy") : "";
  };

  const filteredDisc = questoes
    .filter(q => !form.disciplina_id || q.disciplina_id === form.disciplina_id)
    .filter(q => questoesNivelFilter === "all" || q.nivel === questoesNivelFilter)
    .filter(q => {
      const t = questoesSearch.toLowerCase();
      return !t || (q.enunciado || "").toLowerCase().includes(t) || (q.tema || "").toLowerCase().includes(t);
    })
    .sort((a, b) => {
      if (questoesSortBy === "za") return (b.enunciado || "").localeCompare(a.enunciado || "", "pt-BR");
      if (questoesSortBy === "tema") return (a.tema || "").localeCompare(b.tema || "", "pt-BR");
      if (questoesSortBy === "nivel") {
        const order = { facil: 0, medio: 1, dificil: 2 };
        return (order[a.nivel] ?? 1) - (order[b.nivel] ?? 1);
      }
      return (a.enunciado || "").localeCompare(b.enunciado || "", "pt-BR");
    });
  const searchTerm = search.trim().toLowerCase();
  const filtered = avaliacoes
    .filter((a) => {
      const matchesSearch = !searchTerm
        || a.titulo?.toLowerCase().includes(searchTerm)
        || getDisciplinaName(a.disciplina_id).toLowerCase().includes(searchTerm)
        || getTurmaName(a.turma_id).toLowerCase().includes(searchTerm);
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      const matchesTurma = turmaFilter === "all" || a.turma_id === turmaFilter;
      const matchesDisciplina = disciplinaFilter === "all" || a.disciplina_id === disciplinaFilter;
      return matchesSearch && matchesStatus && matchesTurma && matchesDisciplina;
    })
    .sort((a, b) => {
      if (sortBy === "titulo_asc") return (a.titulo || "").localeCompare(b.titulo || "", "pt-BR");
      if (sortBy === "titulo_desc") return (b.titulo || "").localeCompare(a.titulo || "", "pt-BR");
      if (sortBy === "questoes_desc") return (b.questoes_ids?.length || 0) - (a.questoes_ids?.length || 0);
      if (sortBy === "questoes_asc") return (a.questoes_ids?.length || 0) - (b.questoes_ids?.length || 0);

      const aDate = getDateValue(a.data_aplicacao);
      const bDate = getDateValue(b.data_aplicacao);
      if (aDate === null && bDate === null) return 0;
      if (aDate === null) return 1;
      if (bDate === null) return -1;
      return sortBy === "data_asc" ? aDate - bDate : bDate - aDate;
    });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Avaliações</h1>
          <p className="text-muted-foreground mt-1">Crie e gerencie suas provas</p>
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar com IA
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Nova Avaliação
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por título, turma ou disciplina..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_MAP).map(([status, config]) => (
                <SelectItem key={status} value={status}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Turma</Label>
          <Select value={turmaFilter} onValueChange={setTurmaFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {turmas.map((turma) => (
                <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Disciplina</Label>
          <Select value={disciplinaFilter} onValueChange={setDisciplinaFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {disciplinas.map((disciplina) => (
                <SelectItem key={disciplina.id} value={disciplina.id}>{disciplina.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ordenar por</Label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="data_desc">Data (mais recente)</SelectItem>
              <SelectItem value="data_asc">Data (mais antiga)</SelectItem>
              <SelectItem value="titulo_asc">Título (A-Z)</SelectItem>
              <SelectItem value="titulo_desc">Título (Z-A)</SelectItem>
              <SelectItem value="questoes_desc">Mais questões</SelectItem>
              <SelectItem value="questoes_asc">Menos questões</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <Button variant="outline" className="w-full sm:w-auto" onClick={resetFilters} disabled={!hasActiveFilters}>
          Limpar filtros
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma avaliação"
          description={hasActiveFilters ? "Nenhum resultado com os filtros aplicados." : "Crie sua primeira avaliação."}
          actionLabel={hasActiveFilters ? "Limpar filtros" : "Criar Avaliação"}
          onAction={hasActiveFilters ? resetFilters : () => setDialogOpen(true)}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const applicationDate = formatApplicationDate(a.data_aplicacao);

            return (
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
                      {applicationDate && (
                        <Badge variant="outline" className="text-xs">{applicationDate}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSyncDialog(a)}>
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPdfDialog(a)}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDeleteDialog(a)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Prova 1 - Matemática" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Turma</Label>
                <Select value={form.turma_id} onValueChange={v => setForm({ ...form, turma_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Disciplina</Label>
                <Select value={form.disciplina_id} onValueChange={v => setForm({ ...form, disciplina_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data de Aplicação</Label><Input type="date" lang="pt-BR" min={new Date().toISOString().split("T")[0]} value={form.data_aplicacao} onChange={e => setForm({ ...form, data_aplicacao: e.target.value })} /></div>
              <div className="space-y-2"><Label>Total de Pontos (máx. 100)</Label><Input type="number" step="0.01" min={0} max={100} value={form.total_pontos} onChange={e => setForm({ ...form, total_pontos: e.target.value })} /></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.embaralhar_questoes} onCheckedChange={v => setForm({ ...form, embaralhar_questoes: v })} /><Label>Embaralhar questões</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.embaralhar_alternativas} onCheckedChange={v => setForm({ ...form, embaralhar_alternativas: v })} /><Label>Embaralhar alternativas</Label></div>
            </div>
            <div className="space-y-2"><Label>Instruções</Label><Textarea spellCheck value={form.instrucoes} onChange={e => setForm({ ...form, instrucoes: e.target.value })} rows={2} /></div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Selecione as Questões ({form.questoes_ids.length} selecionadas)</Label>
                {form.questoes_ids.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={distribuirPontosIgual}>
                    Distribuir pts igualmente
                  </Button>
                )}
              </div>
              {/* Filtros e busca */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-sm" placeholder="Buscar questão..." value={questoesSearch} onChange={e => setQuestoesSearch(e.target.value)} />
                </div>
                <Select value={questoesNivelFilter} onValueChange={setQuestoesNivelFilter}>
                  <SelectTrigger className="h-8 text-sm w-full sm:w-32"><SelectValue placeholder="Nível" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="facil">Fácil</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="dificil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={questoesSortBy} onValueChange={setQuestoesSortBy}>
                  <SelectTrigger className="h-8 text-sm w-full sm:w-36"><SelectValue placeholder="Ordenar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="az">A → Z</SelectItem>
                    <SelectItem value="za">Z → A</SelectItem>
                    <SelectItem value="tema">Por tema</SelectItem>
                    <SelectItem value="nivel">Por nível</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2 border rounded-lg p-3">
                {filteredDisc.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma questão disponível. Cadastre questões primeiro.</p>
                ) : filteredDisc.map(q => (
                  <div key={q.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent">
                    <Checkbox checked={form.questoes_ids.includes(q.id)} onCheckedChange={() => toggleQuestao(q.id)} className="mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground flex-1 line-clamp-2 cursor-pointer" onClick={() => toggleQuestao(q.id)}>{q.enunciado}</span>
                    {form.questoes_ids.includes(q.id) && (
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        className="w-20 h-7 text-xs shrink-0"
                        placeholder="Pts"
                        value={form.questoes_pesos[q.id] ?? ""}
                        onChange={e => setPeso(q.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    )}
                  </div>
                ))}
              </div>
              {form.questoes_ids.length > 0 && Object.keys(form.questoes_pesos).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total atribuído: {Object.values(form.questoes_pesos).reduce((s, v) => s + (Number(v) || 0), 0).toFixed(2)} pts
                </p>
              )}
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
                spellCheck
                value={aiForm.titulo}
                onChange={e => setAiForm({ ...aiForm, titulo: e.target.value })}
                placeholder="Ex: Avaliação diagnóstica de Matemática"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turma (opcional)</Label>
                <Select value={aiForm.turma_id} onValueChange={v => setAiForm({ ...aiForm, turma_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Disciplina (opcional)</Label>
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
                  spellCheck
                  value={aiForm.tema}
                  onChange={e => setAiForm({ ...aiForm, tema: e.target.value })}
                  placeholder="Ex: Equações do 1º grau"
                />
              </div>
              <div className="space-y-2">
                <Label>Competência</Label>
                <Input
                  spellCheck
                  value={aiForm.competencia}
                  onChange={e => setAiForm({ ...aiForm, competencia: e.target.value })}
                  placeholder="Ex: Resolver problemas matemáticos"
                />
              </div>
            </div>

            {/* Questões do banco */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-muted-foreground" />
                  <Label>Incluir questões do banco (opcional)</Label>
                  {aiForm.selectedQuestaoIds.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{aiForm.selectedQuestaoIds.length} selecionada(s)</Badge>
                  )}
                </div>
                {aiForm.selectedQuestaoIds.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setAiForm(prev => ({ ...prev, selectedQuestaoIds: [] }))}
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-sm"
                    placeholder="Buscar por enunciado ou tema..."
                    value={questoesBancoSearch}
                    onChange={e => setQuestoesBancoSearch(e.target.value)}
                  />
                </div>
                <Select value={bancoNivelFilter} onValueChange={setBancoNivelFilter}>
                  <SelectTrigger className="h-8 text-sm w-full sm:w-32"><SelectValue placeholder="Nível" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="facil">Fácil</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="dificil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bancoSortBy} onValueChange={setBancoSortBy}>
                  <SelectTrigger className="h-8 text-sm w-full sm:w-36"><SelectValue placeholder="Ordenar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="az">A → Z</SelectItem>
                    <SelectItem value="za">Z → A</SelectItem>
                    <SelectItem value="tema">Por tema</SelectItem>
                    <SelectItem value="nivel">Por nível</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {(() => {
                  const term = questoesBancoSearch.toLowerCase();
                  const filtered = questoes
                    .filter(q => !aiForm.disciplina_id || q.disciplina_id === aiForm.disciplina_id)
                    .filter(q => bancoNivelFilter === "all" || q.nivel === bancoNivelFilter)
                    .filter(q => !term || (q.enunciado || "").toLowerCase().includes(term) || (q.tema || "").toLowerCase().includes(term))
                    .sort((a, b) => {
                      if (bancoSortBy === "za") return (b.enunciado || "").localeCompare(a.enunciado || "", "pt-BR");
                      if (bancoSortBy === "tema") return (a.tema || "").localeCompare(b.tema || "", "pt-BR");
                      if (bancoSortBy === "nivel") {
                        const ord = { facil: 0, medio: 1, dificil: 2 };
                        return (ord[a.nivel] ?? 1) - (ord[b.nivel] ?? 1);
                      }
                      return (a.enunciado || "").localeCompare(b.enunciado || "", "pt-BR");
                    });

                  if (filtered.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {questoes.length === 0 ? "Nenhuma questão cadastrada no banco." : "Nenhuma questão encontrada com esses filtros."}
                      </p>
                    );
                  }

                  const allFilteredIds = filtered.map(q => q.id);
                  const allSelected = allFilteredIds.every(id => aiForm.selectedQuestaoIds.includes(id));

                  return (
                    <>
                      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 sticky top-0">
                        <span className="text-xs text-muted-foreground">{filtered.length} questão(ões)</span>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            setAiForm(prev => ({
                              ...prev,
                              selectedQuestaoIds: allSelected
                                ? prev.selectedQuestaoIds.filter(id => !allFilteredIds.includes(id))
                                : [...new Set([...prev.selectedQuestaoIds, ...allFilteredIds])]
                            }));
                          }}
                        >
                          {allSelected ? "Desmarcar todas" : "Selecionar todas"}
                        </button>
                      </div>
                      {filtered.map(q => {
                        const checked = aiForm.selectedQuestaoIds.includes(q.id);
                        const nivelLabel = { facil: "Fácil", medio: "Médio", dificil: "Difícil" }[q.nivel];
                        return (
                          <label key={q.id} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={v => {
                                setAiForm(prev => ({
                                  ...prev,
                                  selectedQuestaoIds: v
                                    ? [...prev.selectedQuestaoIds, q.id]
                                    : prev.selectedQuestaoIds.filter(id => id !== q.id)
                                }));
                              }}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-foreground line-clamp-1">{q.enunciado}</p>
                              <div className="flex gap-2 mt-0.5">
                                {q.tema && <span className="text-xs text-muted-foreground">{q.tema}</span>}
                                {nivelLabel && <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">{nivelLabel}</Badge>}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground">
                {aiForm.disciplina_id ? "Filtrado pela disciplina selecionada." : "Mostrando todas as questões do banco."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Questões a Gerar com IA</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={aiForm.quantidade}
                  onChange={e => setAiForm({ ...aiForm, quantidade: Number(e.target.value ?? 0) })}
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
                <Label>Total de Pontos (máx. 100)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={aiForm.total_pontos}
                  onChange={e => setAiForm({ ...aiForm, total_pontos: e.target.value })}
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
                  lang="pt-BR"
                  min={new Date().toISOString().split("T")[0]}
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
              <div className="flex items-center justify-between">
                <Label>Contexto / Material Didático (opcional)</Label>
                <div className="flex items-center gap-2">
                  {materialNome && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />{materialNome}
                      <button type="button" onClick={() => setMaterialNome("")} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={handleMaterialFile} />
                    <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Paperclip className="w-3 h-3" />Anexar material
                    </span>
                  </label>
                </div>
              </div>
              <Textarea
                rows={3}
                spellCheck
                value={aiForm.contexto}
                onChange={e => setAiForm({ ...aiForm, contexto: e.target.value })}
                placeholder="Informe o contexto da turma, objetivo da prova ou recorte do conteúdo."
              />
              <p className="text-xs text-muted-foreground">
Aceita PDF, Word, PowerPoint, Excel, TXT, MD e CSV (até 4 000 caracteres extraídos).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Instruções da Avaliação</Label>
              <Textarea
                rows={2}
                spellCheck
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
              <div>
                <Label>Incluir cartão resposta do professor</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Página com gabarito visual (círculos preenchidos) ao final do PDF</p>
              </div>
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

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(isOpen) => {
          setDeleteDialogOpen(isOpen);
          if (!isOpen && !remove.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A avaliação "${deleteTarget.titulo}" será removida permanentemente.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssessment} disabled={remove.isPending}>
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
