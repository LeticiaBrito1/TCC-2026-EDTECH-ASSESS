import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileQuestion, Plus, Pencil, Trash2, Search, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const DIFICULDADES = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
const LETRAS = ["A", "B", "C", "D", "E"];

const emptyForm = () => ({
  enunciado: "", disciplina_id: "", tema: "", nivel_dificuldade: "medio", competencia: "",
  alternativas: LETRAS.map(l => ({ letra: l, texto: "" })),
  gabarito: "A"
});

export default function Questoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [form, setForm] = useState(emptyForm());
  const qc = useQueryClient();

  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });
  const { data: disciplinas = [] } = useQuery({ queryKey: ["disciplinas"], queryFn: () => appClient.entities.Disciplina.list() });

  const create = useMutation({ mutationFn: (d) => appClient.entities.Questao.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["questoes"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Questao.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["questoes"] }); closeDialog(); } });
  const remove = useMutation({ mutationFn: (id) => appClient.entities.Questao.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["questoes"] }) });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm()); };

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
    if (!form.enunciado || !form.gabarito) return;
    const data = { ...form, alternativas: form.alternativas.filter(a => a.texto) };
    editing ? update.mutate({ id: editing.id, d: data }) : create.mutate(data);
  };

  const updateAlt = (idx, text) => {
    const alts = [...form.alternativas];
    alts[idx] = { ...alts[idx], texto: text };
    setForm({ ...form, alternativas: alts });
  };

  const getDisciplinaName = (id) => disciplinas.find(d => d.id === id)?.nome || "";
  const diffColor = { facil: "bg-success/10 text-success", medio: "bg-warning/10 text-warning", dificil: "bg-destructive/10 text-destructive" };

  const filtered = questoes
    .filter(q => filterDifficulty === "all" || q.nivel_dificuldade === filterDifficulty)
    .filter(q => q.enunciado?.toLowerCase().includes(search.toLowerCase()) || q.tema?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Banco de Questões" description="Cadastre e organize suas questões" action={() => setDialogOpen(true)} actionLabel="Nova Questão" actionIcon={Plus} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar questões..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(DIFICULDADES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
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
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(q.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Questão" : "Nova Questão"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Enunciado *</Label><Textarea value={form.enunciado} onChange={e => setForm({ ...form, enunciado: e.target.value })} rows={4} placeholder="Digite o enunciado da questão..." /></div>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
                  <Input value={a.texto} onChange={e => updateAlt(i, e.target.value)} placeholder={`Alternativa ${a.letra}`} className="flex-1" />
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
    </div>
  );
}
