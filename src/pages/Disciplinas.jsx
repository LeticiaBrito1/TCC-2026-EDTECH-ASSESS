import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Pencil, Trash2, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/AlertDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { checkContent } from "@/lib/profanityFilter";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export default function Disciplinas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nome: "", codigo: "", turma_id: "", carga_horaria: "", descricao: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: disciplinas = [] } = useQuery({ queryKey: ["disciplinas"], queryFn: () => appClient.entities.Disciplina.list() });
  const { data: turmas = [] } = useQuery({ queryKey: ["turmas"], queryFn: () => appClient.entities.Turma.list() });

  const create = useMutation({ mutationFn: (d) => appClient.entities.Disciplina.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["disciplinas"] }); closeDialog(); } });
  const update = useMutation({ mutationFn: ({ id, d }) => appClient.entities.Disciplina.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["disciplinas"] }); closeDialog(); } });
  const remove = useMutation({ mutationFn: (id) => appClient.entities.Disciplina.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["disciplinas"] }) });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ nome: "", codigo: "", turma_id: "", carga_horaria: "", descricao: "" }); };

  const openEdit = (d) => { setEditing(d); setForm({ nome: d.nome, codigo: d.codigo || "", turma_id: d.turma_id || "", carga_horaria: d.carga_horaria || "", descricao: d.descricao || "" }); setDialogOpen(true); };

  const handleSubmit = () => {
    if (!form.nome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe o nome da disciplina antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    const textoParaVerificar = [form.nome, form.descricao].filter(Boolean).join(" ");
    const check = checkContent(textoParaVerificar);
    if (!check.ok) {
      toast({ title: "Conteúdo inadequado", description: "O texto informado contém palavras inapropriadas.", variant: "destructive" });
      return;
    }

    const data = { ...form, carga_horaria: form.carga_horaria ? Number(form.carga_horaria) : undefined };
    editing ? update.mutate({ id: editing.id, d: data }) : create.mutate(data);
  };

  const getTurmaName = (id) => turmas.find(t => t.id === id)?.nome || "—";
  const filtered = disciplinas.filter(d => d.nome?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Disciplinas" description="Gerencie suas disciplinas" action={() => setDialogOpen(true)} actionLabel="Nova Disciplina" actionIcon={Plus} />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar disciplinas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhuma disciplina" description="Cadastre sua primeira disciplina." actionLabel="Criar Disciplina" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <Card key={d.id} className="hover:shadow-lg transition-shadow duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{d.nome}</h3>
                      {d.codigo && <p className="text-xs text-muted-foreground">{d.codigo}</p>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">{getTurmaName(d.turma_id)}</Badge>
                    {d.carga_horaria && <Badge variant="outline" className="text-xs">{d.carga_horaria}h</Badge>}
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar disciplina ${d.nome}`} onClick={() => openEdit(d)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Excluir disciplina ${d.nome}`} onClick={() => { setDeleteTarget(d); setDeleteDialogOpen(true); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir disciplina?</AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina <strong>{deleteTarget?.nome}</strong> será excluída permanentemente. Esta ação não pode ser desfeita.
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

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Disciplina" : "Nova Disciplina"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value.replace(/[0-9]/g, "") })} placeholder="Ex: Matemática" /></div>
              <div className="space-y-2"><Label>Código</Label><Input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="Ex: MAT101" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Turma</Label>
                <Select value={form.turma_id} onValueChange={v => setForm({ ...form, turma_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Carga Horária (h)</Label><Input type="number" min={0} max={999} step={1} value={form.carga_horaria} onChange={e => setForm({ ...form, carga_horaria: e.target.value.slice(0, 3) })} placeholder="Ex: 80" /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Descrição</Label>
                <span className="text-xs text-muted-foreground">{form.descricao.length}/500</span>
              </div>
              <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value.slice(0, 500) })} rows={3} maxLength={500} />
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
