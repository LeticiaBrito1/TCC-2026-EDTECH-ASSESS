import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus, Pencil, Trash2, Search, FileText } from "lucide-react";
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

const STATUS_MAP = {
  rascunho: { label: "Rascunho", class: "bg-muted text-muted-foreground" },
  publicada: { label: "Publicada", class: "bg-primary/10 text-primary" },
  aplicada: { label: "Aplicada", class: "bg-warning/10 text-warning" },
  corrigida: { label: "Corrigida", class: "bg-success/10 text-success" }
};

export default function Avaliacoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    titulo: "", disciplina_id: "", turma_id: "", data_aplicacao: "", status: "rascunho",
    questoes_ids: [], total_pontos: 10, embaralhar_questoes: false, embaralhar_alternativas: false, instrucoes: ""
  });
  const qc = useQueryClient();

  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });
  const { data: disciplinas = [] } = useQuery({ queryKey: ["disciplinas"], queryFn: () => appClient.entities.Disciplina.list() });
  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });

  const create = useMutation({ mutationFn: (d) => appClient.entities.Avaliacao.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["avaliacoes"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Avaliacao.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["avaliacoes"] }); closeDialog(); } });
  const remove = useMutation({ mutationFn: (id) => appClient.entities.Avaliacao.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["avaliacoes"] }) });

  const closeDialog = () => {
    setDialogOpen(false); setEditing(null);
    setForm({ titulo: "", disciplina_id: "", turma_id: "", data_aplicacao: "", status: "rascunho", questoes_ids: [], total_pontos: 10, embaralhar_questoes: false, embaralhar_alternativas: false, instrucoes: "" });
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
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data de Aplicação</Label><Input type="date" value={form.data_aplicacao} onChange={e => setForm({ ...form, data_aplicacao: e.target.value })} /></div>
              <div className="space-y-2"><Label>Total de Pontos</Label><Input type="number" value={form.total_pontos} onChange={e => setForm({ ...form, total_pontos: Number(e.target.value) })} /></div>
            </div>
            <div className="flex gap-6">
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
    </div>
  );
}
