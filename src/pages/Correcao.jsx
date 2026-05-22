import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScanLine, CheckCircle2, XCircle, Loader2, QrCode, ImageUp, ClipboardPaste, AlertTriangle, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import QrCodeScanner from "@/components/shared/QrCodeScanner";

const stripLeadingNumber = (text) =>
  String(text || "").trim().replace(/^\d+\s*[.)\-]\s*/, "");

const AVALIACAO_KEYS = ["avaliacao_id", "avaliacaoId", "prova_id", "provaId", "avaliacao", "prova"];
const ALUNO_KEYS = ["aluno_id", "alunoId", "student_id", "studentId", "aluno", "student"];
const VERSAO_KEYS = ["versao", "versão", "version", "prova_versao", "provaVersao"];

const getFirstValue = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
};

const parseQrPayload = (rawValue) => {
  // Remove TODO whitespace (espaços, quebras de linha, tabs) que surgem ao copiar texto do PDF.
  // UUIDs e letras de versão nunca contêm espaços, então isso é seguro.
  const raw = String(rawValue || "").replace(/\s/g, "");
  if (!raw) return null;

  const buildResult = (obj) => {
    // Limpa espaços residuais de cada valor individual, por precaução.
    const clean = (v) => String(v || "").replace(/\s/g, "");
    const avaliacaoId = clean(getFirstValue(obj, AVALIACAO_KEYS));
    const alunoId = clean(getFirstValue(obj, ALUNO_KEYS));
    if (!avaliacaoId || !alunoId) return null;
    const versao = getFirstValue(obj, VERSAO_KEYS);
    return { avaliacaoId, alunoId, versao };
  };

  if (raw.startsWith("{")) {
    // Auto-completa `}` se o usuário copiou o JSON incompleto do PDF.
    const jsonStr = raw.endsWith("}") ? raw : raw + "}";
    try {
      const parsedJson = JSON.parse(jsonStr);
      const result = buildResult(parsedJson);
      if (result) return result;
    } catch {
      // Ignora JSON inválido e segue para os outros formatos.
    }
  }

  try {
    const parsedUrl = new URL(raw);
    const urlParams = Object.fromEntries(parsedUrl.searchParams.entries());
    const result = buildResult(urlParams);
    if (result) return result;
  } catch {
    // Não é URL, segue fluxo.
  }

  const normalizedPairs = raw.replace(/[;,|]/g, "&");
  if (normalizedPairs.includes("=")) {
    const params = Object.fromEntries(new URLSearchParams(normalizedPairs).entries());
    const result = buildResult(params);
    if (result) return result;
  }

  return null;
};

export default function Correcao() {
  const [selectedAvaliacao, setSelectedAvaliacao] = useState("");
  const [selectedAluno, setSelectedAluno] = useState("");
  const [respostas, setRespostas] = useState({});
  const [correcting, setCorrecting] = useState(false);
  const [result, setResult] = useState(null);
  const [ocrDetected, setOcrDetected] = useState(null);
  const [ocrPreview, setOcrPreview] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [qrFeedback, setQrFeedback] = useState(null);
  const [qrPasteValue, setQrPasteValue] = useState("");
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrError, setOcrError] = useState(null);
  const [pasteHighlight, setPasteHighlight] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  // Ctrl+V / Cmd+V — cola imagem do clipboard diretamente na área de upload
  useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      setOcrFile(file);
      setResult(null);
      setOcrDetected(null);
      setOcrError(null);
      setPasteHighlight(true);
      setTimeout(() => setPasteHighlight(false), 1200);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const { data: avaliacoes = [] } = useQuery({ queryKey: ["avaliacoes"], queryFn: () => appClient.entities.Avaliacao.list() });
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: () => appClient.entities.Aluno.list() });
  const { data: questoes = [] } = useQuery({ queryKey: ["questoes"], queryFn: () => appClient.entities.Questao.list() });
  const { data: resultados = [] } = useQuery({ queryKey: ["resultados"], queryFn: () => appClient.entities.Resultado.list() });

  const createResult = useMutation({
    mutationFn: (d) => appClient.entities.Resultado.create(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resultados"] })
  });
  const correctByOcr = useMutation({
    mutationFn: (payload) => appClient.corrections.scanOcr(payload),
    onSuccess: (data) => {
      if (data.preview) {
        // Modo revisão: pré-preenche o formulário com as respostas da IA para o professor conferir
        const det = data.detected || {};
        if (det.avaliacao_id) setSelectedAvaliacao(det.avaliacao_id);
        if (det.aluno_id) setSelectedAluno(det.aluno_id);
        // Filtra respostas vazias
        const respostasDetectadas = Object.fromEntries(
          Object.entries(data.respostas_por_questao || {}).filter(([, v]) => v)
        );
        setRespostas(respostasDetectadas);
        setOcrDetected(det);
        setOcrPreview(true);
        setOcrFile(null);
        toast({
          title: "IA detectou as respostas",
          description: "Revise as respostas abaixo antes de confirmar. Corrija qualquer erro e clique em Confirmar.",
        });
      } else {
        qc.invalidateQueries({ queryKey: ["resultados"] });
        setResult(data.resultado);
        setOcrDetected(data.detected || null);
        setOcrFile(null);
      }
    },
    onError: (error) => {
      setOcrError(error?.message || "Não foi possível corrigir pela imagem.");
    },
  });

  const avaliacao = avaliacoes.find(a => a.id === selectedAvaliacao);
  const alunosFiltrados = (avaliacao
    ? (avaliacao.turma_id ? alunos.filter(a => a.turma_id === avaliacao.turma_id) : alunos)
    : []
  ).slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  const questoesAvaliacao = avaliacao?.questoes_ids?.map(id => questoes.find(q => q.id === id)).filter(Boolean) || [];

  // IDs dos alunos que já tiveram essa avaliação corrigida
  const alunosJaCorrigidosIds = new Set(
    resultados.filter(r => r.avaliacao_id === selectedAvaliacao).map(r => r.aluno_id)
  );
  // Resultado existente para a combinação atual
  const jaCorrigida = selectedAvaliacao && selectedAluno
    ? resultados.find(r => r.avaliacao_id === selectedAvaliacao && r.aluno_id === selectedAluno)
    : null;

  const handleCorrigir = async () => {
    if (!selectedAvaliacao || !selectedAluno) return;
    setCorrecting(true);

    const respostasArray = questoesAvaliacao.map(q => ({
      questao_id: q.id,
      resposta: respostas[q.id] || "",
      correta: Boolean(respostas[q.id]) &&
        (respostas[q.id] || "").toUpperCase().trim() === (q.gabarito || "").toUpperCase().trim()
    }));

    const totalAcertos = respostasArray.filter(r => r.correta).length;
    const totalQuestoes = questoesAvaliacao.length;
    const percentual = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;
    const pesos = avaliacao.questoes_pesos || {};
    const temPesos = Object.keys(pesos).length > 0;
    const nota = temPesos
      ? respostasArray.reduce((sum, r) => {
          if (!r.correta) return sum;
          const peso = pesos[r.questao_id];
          return sum + (peso != null ? Number(peso) : (avaliacao.total_pontos || 10) / totalQuestoes);
        }, 0)
      : totalQuestoes > 0 ? ((totalAcertos / totalQuestoes) * (avaliacao.total_pontos || 10)) : 0;

    const resultado = {
      avaliacao_id: selectedAvaliacao,
      aluno_id: selectedAluno,
      turma_id: avaliacao.turma_id,
      respostas: respostasArray,
      nota: Math.round(nota * 100) / 100,
      total_acertos: totalAcertos,
      total_questoes: totalQuestoes,
      percentual_acerto: percentual,
      status: "corrigido"
    };

    await createResult.mutateAsync(resultado);
    setResult(resultado);
    setCorrecting(false);
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo da imagem."));
      reader.readAsDataURL(file);
    });

  const handleOcrCorrection = async () => {
    if (!ocrFile) {
      toast({
        title: "Imagem obrigatória",
        description: "Selecione uma foto do cartão resposta.",
        variant: "destructive",
      });
      return;
    }

    const base64 = await fileToBase64(ocrFile);
    const payload = { image_base64: base64, preview: true };
    if (selectedAvaliacao) payload.avaliacao_id = selectedAvaliacao;
    if (selectedAluno) payload.aluno_id = selectedAluno;

    await correctByOcr.mutateAsync(payload);
  };

  const resetCorrecao = () => {
    setResult(null);
    setOcrDetected(null);
    setOcrError(null);
    setOcrPreview(false);
    setEditingResult(null);
    setRespostas({});
    setSelectedAluno("");
    setOcrFile(null);
  };

  const handleEditResult = () => {
    if (!result) return;
    const respostasExistentes = {};
    result.respostas?.forEach(r => {
      if (r.resposta) respostasExistentes[r.questao_id] = r.resposta;
    });
    setRespostas(respostasExistentes);
    setSelectedAvaliacao(result.avaliacao_id);
    setSelectedAluno(result.aluno_id);
    setEditingResult(result);
    setResult(null);
    setOcrPreview(false);
  };

  const handleQrDecoded = (decodedValue) => {
    const parsed = parseQrPayload(decodedValue);
    if (!parsed) {
      setQrFeedback({
        type: "error",
        message: "QR lido, mas o formato não contém avaliação e aluno.",
      });
      return;
    }

    const avaliacaoEncontrada = avaliacoes.find(a => String(a.id) === parsed.avaliacaoId);
    const alunoEncontrado = alunos.find(a => String(a.id) === parsed.alunoId);

    if (!avaliacaoEncontrada || !alunoEncontrado) {
      setQrFeedback({
        type: "error",
        message: "IDs do QR não encontrados na base atual.",
      });
      return;
    }

    if (
      avaliacaoEncontrada.turma_id &&
      alunoEncontrado.turma_id &&
      avaliacaoEncontrada.turma_id !== alunoEncontrado.turma_id
    ) {
      setQrFeedback({
        type: "error",
        message: "A avaliação e o aluno do QR pertencem a turmas diferentes.",
      });
      return;
    }

    setSelectedAvaliacao(avaliacaoEncontrada.id);
    setSelectedAluno(alunoEncontrado.id);
    setRespostas({});
    setResult(null);
    setQrFeedback({
      type: "success",
      message: `QR validado: ${alunoEncontrado.nome} em ${avaliacaoEncontrada.titulo}${parsed.versao ? ` (versão ${parsed.versao})` : ""}.`,
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <PageHeader title="Correção" description="Corrija as avaliações dos alunos" />

      {!result ? (
        <div className="space-y-6">
          {/* Seleção */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Avaliação</Label>
                  <Select value={selectedAvaliacao} onValueChange={v => { setSelectedAvaliacao(v); setSelectedAluno(""); setRespostas({}); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione a avaliação" /></SelectTrigger>
                    <SelectContent>{avaliacoes.map(a => <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aluno</Label>
                  <Select value={selectedAluno} onValueChange={setSelectedAluno} disabled={!selectedAvaliacao}>
                    <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                    <SelectContent>
                      {alunosFiltrados.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2">
                            {alunosJaCorrigidosIds.has(a.id) && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                            )}
                            {a.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aviso: prova já corrigida */}
          {jaCorrigida && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-warning">Esta prova já foi corrigida</p>
                    <p className="text-sm text-muted-foreground">
                      {alunos.find(a => a.id === selectedAluno)?.nome} obteve{" "}
                      <strong>{jaCorrigida.nota}</strong> pts —{" "}
                      <strong>{jaCorrigida.total_acertos}/{jaCorrigida.total_questoes}</strong> acertos ({jaCorrigida.percentual_acerto}%).
                    </p>
                    <p className="text-xs text-muted-foreground">Você pode corrigir novamente e o resultado anterior será substituído.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Leitura de QR Code (mobile)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR da prova para preencher avaliação e aluno automaticamente.
              </p>
              <QrCodeScanner onDecoded={handleQrDecoded} />
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Ou cole o conteúdo do QR Code
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    className="text-xs font-mono resize-none"
                    placeholder='{"avaliacao_id":"...","aluno_id":"..."}'
                    value={qrPasteValue}
                    onChange={e => setQrPasteValue(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-end"
                    onClick={() => { handleQrDecoded(qrPasteValue); setQrPasteValue(""); }}
                    disabled={!qrPasteValue.trim()}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
              {qrFeedback && (
                <p className={`text-sm ${qrFeedback.type === "success" ? "text-success" : "text-destructive"}`}>
                  {qrFeedback.message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageUp className="w-5 h-5 text-primary" />
                Correção Automática por Foto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tire uma foto do <strong>cartão resposta</strong> do aluno. A IA identifica automaticamente
                a avaliação, o aluno e as respostas marcadas — sem seleção manual.
              </p>

              {/* Área de upload */}
              <label
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
                  ${pasteHighlight
                    ? "border-success bg-success/10 scale-[1.01]"
                    : "border-primary/30 hover:bg-primary/10"
                  }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { setOcrFile(e.target.files?.[0] || null); setResult(null); setOcrDetected(null); setOcrError(null); }}
                />
                {ocrFile ? (
                  <div className="text-center px-4">
                    <ImageUp className="w-6 h-6 text-primary mx-auto mb-1" />
                    <p className="text-sm font-medium text-foreground truncate max-w-[220px]">
                      {ocrFile.name || "Imagem colada"}
                    </p>
                    <p className="text-xs text-muted-foreground">Clique para trocar</p>
                  </div>
                ) : (
                  <div className="text-center space-y-1">
                    <ImageUp className="w-8 h-8 text-primary/50 mx-auto" />
                    <p className="text-sm text-muted-foreground">Clique, arraste ou <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border">Ctrl+V</kbd></p>
                    <p className="text-xs text-muted-foreground">Aceita foto tirada, print ou captura de tela</p>
                  </div>
                )}
              </label>

              {pasteHighlight && (
                <p className="text-xs text-success font-medium text-center">Imagem colada com sucesso!</p>
              )}

              <Button
                onClick={handleOcrCorrection}
                disabled={correctByOcr.isPending || !ocrFile}
                className="w-full"
              >
                {correctByOcr.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando imagem...</>
                  : <><ImageUp className="w-4 h-4 mr-2" />Corrigir automaticamente</>
                }
              </Button>

              {ocrError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive font-medium">{ocrError}</p>
                  </div>
                  {(ocrError.includes("avalia") || ocrError.includes("aluno")) && (
                    <p className="text-xs text-muted-foreground pl-6">
                      Selecione a <strong>avaliação</strong> e o <strong>aluno</strong> nos campos acima
                      (ou escaneie o QR Code da prova) e clique em "Corrigir automaticamente" novamente.
                      Assim a IA foca apenas em ler as marcações do cartão.
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Se a IA não identificar automaticamente a prova ou o aluno, selecione-os acima e tente novamente.
              </p>
            </CardContent>
          </Card>

          {/* Banner de edição de resultado existente */}
          {editingResult && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="p-4 flex items-start gap-3">
                <Pencil className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-warning">Editando correção existente</p>
                  <p className="text-sm text-muted-foreground">
                    Altere as respostas que estão erradas e clique em <strong>Confirmar e Salvar</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Banner de revisão da IA */}
          {ocrPreview && ocrDetected && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-4 flex items-start gap-3">
                <ScanLine className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-primary">Respostas detectadas pela IA</p>
                  <p className="text-sm text-muted-foreground">
                    Aluno: <strong>{ocrDetected.aluno_nome}</strong> · Avaliação: <strong>{ocrDetected.avaliacao_titulo}</strong>
                    {ocrDetected.versao ? ` · Versão ${ocrDetected.versao}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confira cada resposta abaixo e corrija o que estiver errado antes de confirmar.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Marcação de respostas */}
          {questoesAvaliacao.length > 0 && selectedAluno && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ScanLine className="w-5 h-5 text-primary" />
                    Marque as Respostas do Aluno
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {questoesAvaliacao.map((q, idx) => (
                    <div key={q.id} className="p-4 border rounded-xl">
                      <p className="text-sm font-medium text-foreground mb-3">
                        <span className="text-primary font-semibold">Q{idx + 1}.</span> {stripLeadingNumber(q.enunciado).slice(0, 120)}{stripLeadingNumber(q.enunciado).length > 120 ? "..." : ""}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {q.alternativas?.map(a => (
                          <button
                            key={a.letra}
                            onClick={() => setRespostas(prev => ({ ...prev, [q.id]: a.letra }))}
                            className={`
                              w-10 h-10 rounded-full text-sm font-semibold transition-all duration-200
                              ${respostas[q.id] === a.letra
                                ? 'bg-primary text-primary-foreground shadow-md scale-110'
                                : 'bg-muted text-muted-foreground hover:bg-accent'}
                            `}
                          >
                            {a.letra}
                          </button>
                        ))}
                        {respostas[q.id] && (
                          <button onClick={() => setRespostas(prev => { const r = { ...prev }; delete r[q.id]; return r; })} className="text-xs text-muted-foreground hover:text-destructive ml-2">
                            Limpar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button
                onClick={handleCorrigir}
                disabled={correcting || Object.keys(respostas).length === 0}
                className="w-full bg-primary hover:bg-primary/90 h-12 text-base"
              >
                {correcting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                {correcting ? "Salvando..." : (ocrPreview || editingResult) ? "Confirmar e Salvar Correção" : "Corrigir Avaliação"}
              </Button>
            </>
          )}
        </div>
      ) : (
        /* Resultado */
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${result.percentual_acerto >= 60 ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {result.percentual_acerto >= 60 
                ? <CheckCircle2 className="w-10 h-10 text-success" />
                : <XCircle className="w-10 h-10 text-destructive" />
              }
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Correção Concluída</h2>
              {ocrDetected ? (
                <div className="mt-2 inline-flex flex-col items-center gap-0.5">
                  <p className="text-sm font-medium text-foreground">{ocrDetected.aluno_nome}</p>
                  <p className="text-xs text-muted-foreground">{ocrDetected.avaliacao_titulo}{ocrDetected.versao ? ` — Versão ${ocrDetected.versao}` : ""}</p>
                  <span className="text-xs text-primary mt-1">Identificado automaticamente pela IA</span>
                </div>
              ) : (
                <p className="text-muted-foreground mt-1">
                  {alunos.find(a => a.id === selectedAluno)?.nome} — {avaliacao?.titulo}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-xl bg-primary/10">
                <p className="text-2xl font-bold text-primary">{result.nota}</p>
                <p className="text-xs text-muted-foreground">Nota</p>
              </div>
              <div className="p-4 rounded-xl bg-success/10">
                <p className="text-2xl font-bold text-success">{result.total_acertos}/{result.total_questoes}</p>
                <p className="text-xs text-muted-foreground">Acertos</p>
              </div>
              <div className="p-4 rounded-xl bg-warning/10">
                <p className="text-2xl font-bold text-warning">{result.percentual_acerto}%</p>
                <p className="text-xs text-muted-foreground">Aproveitamento</p>
              </div>
            </div>
            <Progress value={result.percentual_acerto} className="max-w-md mx-auto" />

            <div className="text-left max-w-md mx-auto space-y-2">
              {result.respostas?.map((r, idx) => {
                const questao = questoes.find(q => q.id === r.questao_id);
                const gabarito = (questao?.gabarito || "?").toUpperCase().trim();
                const isCorrect = Boolean(r.correta) ||
                  (Boolean(r.resposta) &&
                    (r.resposta || "").toUpperCase().trim() === gabarito);
                return (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${isCorrect ? 'bg-success/5' : 'bg-destructive/5'}`}>
                    <span className="text-sm font-medium">Questão {idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        Marcou: <strong>{(r.resposta || "—").toUpperCase()}</strong>
                      </span>
                      {!isCorrect && (
                        <span className="text-sm text-success">
                          Correto: <strong>{gabarito}</strong>
                        </span>
                      )}
                      {isCorrect
                        ? <CheckCircle2 className="w-4 h-4 text-success" />
                        : <XCircle className="w-4 h-4 text-destructive" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 justify-center mt-4 flex-wrap">
              <Button variant="outline" onClick={handleEditResult}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar Respostas
              </Button>
              <Button onClick={resetCorrecao}>Corrigir Outra Prova</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
