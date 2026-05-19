import React, { useState, useRef } from "react";
import { Check, CreditCard, Lock, Shield, ArrowLeft, CheckCircle2, Loader2, RotateCcw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── helpers ─────────────────────────────────────────────────────────────────

const luhnValid = (num) => {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
};

const detectBrand = (num) => {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011)/.test(n)) return "elo";
  return null;
};

const formatCardNumber = (val) => {
  const digits = val.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
};

const formatExpiry = (val) => {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

const maskCardDisplay = (num) => {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13) return num || "•••• •••• •••• ••••";
  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4}`;
};

const BRAND_COLORS = {
  visa: { bg: "from-blue-700 to-blue-900", label: "VISA", labelClass: "text-white font-bold italic text-xl tracking-widest" },
  mastercard: { bg: "from-red-600 to-orange-500", label: "MC", labelClass: "text-white font-bold text-sm" },
  amex: { bg: "from-green-700 to-teal-800", label: "AMEX", labelClass: "text-white font-bold text-sm tracking-widest" },
  elo: { bg: "from-yellow-600 to-yellow-800", label: "ELO", labelClass: "text-white font-bold text-sm tracking-widest" },
};

const PLANO_FUNDADOR = {
  id: "fundador",
  name: "Plano Fundador",
  price: 4890,
  priceLabel: "R$ 48,90",
  period: "por mês",
  badge: "Oferta especial",
  features: [
    "Turmas ilimitadas",
    "Alunos ilimitados",
    "Questões ilimitadas",
    "Geração com IA (Groq/Llama)",
    "Correção por OCR",
    "Exportação PDF ilimitada",
    "Relatórios completos",
    "Integração com LMS (Moodle)",
  ],
};

// ── Card Visual ──────────────────────────────────────────────────────────────

function CreditCardVisual({ card, flipped, brand }) {
  const b = BRAND_COLORS[brand] || { bg: "from-gray-700 to-gray-900", label: "", labelClass: "" };
  return (
    <div className="w-full max-w-sm mx-auto" style={{ perspective: "1000px", height: "190px" }}>
      <div
        className="relative w-full h-full transition-transform duration-700"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${b.bg} p-5 flex flex-col justify-between shadow-2xl`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex items-start justify-between">
            <Wifi className="w-8 h-8 text-white/60 rotate-90" />
            <span className={b.labelClass}>{b.label}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-8 rounded bg-yellow-400/80" />
              <div className="w-4 h-8 rounded bg-yellow-300/50" />
            </div>
            <p className="text-white font-mono text-lg tracking-widest mb-3 drop-shadow">
              {card.number ? maskCardDisplay(card.number) : "•••• •••• •••• ••••"}
            </p>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-white/50 text-xs uppercase mb-0.5">Titular</p>
                <p className="text-white text-sm font-medium tracking-wide uppercase truncate max-w-[160px]">
                  {card.name || "SEU NOME"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-xs uppercase mb-0.5">Validade</p>
                <p className="text-white text-sm font-medium">{card.expiry || "MM/AA"}</p>
              </div>
            </div>
          </div>
        </div>
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${b.bg} shadow-2xl flex flex-col justify-between`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="h-12 bg-black/60 mt-8" />
          <div className="px-5 pb-5">
            <div className="bg-white/20 rounded px-3 py-2 flex items-center justify-between">
              <span className="text-white/50 text-xs">CVV</span>
              <span className="font-mono text-white tracking-widest">
                {card.cvv ? "•".repeat(card.cvv.length) : "•••"}
              </span>
            </div>
            <p className="text-white/40 text-xs mt-3 text-center">
              Este cartão é de uso exclusivo do titular
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan Step ────────────────────────────────────────────────────────────────

function PlanStep({ onSelect }) {
  const plan = PLANO_FUNDADOR;
  return (
    <div className="max-w-md mx-auto">
      <div
        onClick={() => onSelect(plan)}
        className="relative rounded-2xl border-2 border-primary p-8 cursor-pointer hover:shadow-xl transition-all duration-200 shadow-lg"
      >
        {plan.badge && (
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-3">
            {plan.badge}
          </Badge>
        )}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4 w-20 h-20 flex items-center justify-center">
            <img src="/medalha.png" alt="Plano Fundador" className="w-16 h-16 object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{plan.name}</h2>
          <div className="mt-2">
            <span className="text-4xl font-bold text-foreground">{plan.priceLabel}</span>
            <span className="text-muted-foreground text-sm ml-1">/ {plan.period}</span>
          </div>
        </div>
        <ul className="space-y-2.5 mb-6">
          {plan.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <Button className="w-full h-12 text-base font-semibold" onClick={(e) => { e.stopPropagation(); onSelect(plan); }}>
          Assinar plano
        </Button>
      </div>
    </div>
  );
}

// ── Card Step ────────────────────────────────────────────────────────────────

function CardStep({ plan, onBack, onPay }) {
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [errors, setErrors] = useState({});
  const [flipped, setFlipped] = useState(false);
  const cvvRef = useRef(null);
  const brand = detectBrand(card.number);

  const validate = () => {
    const e = {};
    const digits = card.number.replace(/\D/g, "");
    if (digits.length < 16) e.number = "Número do cartão inválido.";
    else if (!luhnValid(card.number)) e.number = "Número do cartão inválido.";
    if (!card.name.trim() || card.name.trim().length < 3) e.name = "Informe o nome do titular.";
    const [m, y] = card.expiry.split("/");
    const now = new Date();
    const expMonth = parseInt(m, 10);
    const expYear = 2000 + parseInt(y || "0", 10);
    if (!m || !y || expMonth < 1 || expMonth > 12) e.expiry = "Data inválida.";
    else if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1))
      e.expiry = "Cartão vencido.";
    if (card.cvv.length < 3) e.cvv = "CVV inválido.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onPay(card);
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Plano selecionado</p>
            <p className="font-bold text-lg">{plan.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{plan.priceLabel}</p>
            <p className="text-xs text-muted-foreground">/ {plan.period}</p>
          </div>
        </CardContent>
      </Card>

      <CreditCardVisual card={card} flipped={flipped} brand={brand} />

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Número do cartão</Label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className={`pl-9 font-mono tracking-widest ${errors.number ? "border-destructive" : ""}`}
              placeholder="0000 0000 0000 0000"
              value={card.number}
              onChange={e => setCard(c => ({ ...c, number: formatCardNumber(e.target.value) }))}
              maxLength={19}
            />
          </div>
          {errors.number && <p className="text-xs text-destructive">{errors.number}</p>}
        </div>

        <div className="space-y-1">
          <Label>Nome do titular</Label>
          <Input
            className={errors.name ? "border-destructive" : ""}
            placeholder="Como está no cartão"
            value={card.name}
            onChange={e => setCard(c => ({ ...c, name: e.target.value.toUpperCase() }))}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Validade</Label>
            <Input
              className={errors.expiry ? "border-destructive" : ""}
              placeholder="MM/AA"
              value={card.expiry}
              maxLength={5}
              onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
            />
            {errors.expiry && <p className="text-xs text-destructive">{errors.expiry}</p>}
          </div>
          <div className="space-y-1">
            <Label>CVV</Label>
            <Input
              ref={cvvRef}
              className={`font-mono ${errors.cvv ? "border-destructive" : ""}`}
              placeholder="•••"
              type="password"
              maxLength={4}
              value={card.cvv}
              onFocus={() => setFlipped(true)}
              onBlur={() => setFlipped(false)}
              onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "") }))}
            />
            {errors.cvv && <p className="text-xs text-destructive">{errors.cvv}</p>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-4 py-3">
        <Lock className="w-4 h-4 shrink-0 text-green-600" />
        Dados protegidos com criptografia SSL de 256 bits. Nenhuma informação é armazenada externamente.
      </div>

      <Button className="w-full h-12 text-base font-semibold" onClick={handleSubmit}>
        <Shield className="w-5 h-5 mr-2" />
        Pagar {plan.priceLabel}
      </Button>
    </div>
  );
}

// ── Processing ───────────────────────────────────────────────────────────────

function ProcessingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <CreditCard className="absolute inset-0 m-auto w-8 h-8 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold">Processando pagamento...</p>
        <p className="text-muted-foreground text-sm mt-1">Por favor, aguarde. Não feche esta janela.</p>
      </div>
      <div className="flex gap-2">
        {["Validando cartão", "Processando", "Confirmando"].map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            {s}
            {i < 2 && <span className="ml-1">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Success ──────────────────────────────────────────────────────────────────

function SuccessStep({ plan, card, onReset, onManage }) {
  const last4 = (card?.number || "").replace(/\D/g, "").slice(-4);
  const now = new Date();
  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  return (
    <div className="max-w-md mx-auto space-y-6 py-8">
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Pagamento confirmado!</h2>
        <p className="text-muted-foreground">Seu <strong>{plan.name}</strong> foi ativado com sucesso.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">Comprovante de pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { label: "Plano", value: plan.name },
            { label: "Valor", value: plan.priceLabel + "/mês" },
            { label: "Data", value: now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) },
            { label: "Cartão", value: last4 ? `•••• •••• •••• ${last4}` : "—" },
            { label: "Próxima cobrança", value: nextBilling.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) },
            { label: "Status", value: "✓ Aprovado", className: "text-green-600 font-medium" },
          ].map(({ label, value, className }) => (
            <div key={label} className="flex justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className={className || "font-medium"}>{value}</span>
            </div>
          ))}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Número do pedido: <span className="font-mono">#EDG-{Math.random().toString(36).slice(2,10).toUpperCase()}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onReset}>
          <RotateCcw className="w-4 h-4 mr-2" /> Alterar plano
        </Button>
        <Button className="flex-1" onClick={onManage}>
          Gerenciar assinatura
        </Button>
      </div>
    </div>
  );
}

// ── Manage ───────────────────────────────────────────────────────────────────

function ManageStep({ plan, card, onChangePlan }) {
  const last4 = (card?.number || "").replace(/\D/g, "").slice(-4);
  const now = new Date();
  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  const fakeInvoices = [
    { date: now, desc: plan.name, value: plan.priceLabel, status: "Pago" },
    { date: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()), desc: plan.name, value: plan.priceLabel, status: "Pago" },
    { date: new Date(now.getFullYear(), now.getMonth() - 2, now.getDate()), desc: plan.name, value: plan.priceLabel, status: "Pago" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Plano atual</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <img src="/medalha.png" alt="plano" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <p className="font-semibold">{plan.name}</p>
                <p className="text-sm text-muted-foreground">{plan.priceLabel}/mês</p>
              </div>
              <Badge className="ml-auto bg-green-100 text-green-700">Ativo</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Próxima cobrança: {nextBilling.toLocaleDateString("pt-BR")}
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={onChangePlan}>
              Alterar plano
            </Button>
          </CardContent>
        </Card>

        {card && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Forma de pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">•••• •••• •••• {last4}</p>
                  <p className="text-xs text-muted-foreground">Validade: {card.expiry}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={onChangePlan}>
                Atualizar cartão
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Histórico de faturas</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {fakeInvoices.map((inv, i) => (
              <div key={i} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{inv.desc}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="font-medium">{inv.value}</span>
                  <Badge variant="outline" className="text-green-600 border-green-200 text-xs">{inv.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Para cancelar sua assinatura, entre em contato com o suporte em{" "}
        <span className="text-primary">suporte@edtechassess.com.br</span>
      </p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Pagamento() {
  const [step, setStep] = useState("plan");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [cardData, setCardData] = useState(null);

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setStep("card");
  };

  const handlePay = (card) => {
    setCardData(card);
    setStep("processing");
    setTimeout(() => setStep("success"), 3000);
  };

  const handleReset = () => {
    setSelectedPlan(null);
    setCardData(null);
    setStep("plan");
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header personalizado */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Plano e Pagamentos</h1>
        <p className="text-primary mt-1 font-medium">Assine o Plano Fundador e tenha acesso completo à plataforma</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
        {["plan", "card", "success"].map((s, i) => {
          const labels = ["Plano", "Pagamento", "Confirmação"];
          const idx = ["plan", "card", "processing", "success", "manage"].indexOf(step);
          const stepIdx = ["plan", "card", "success"].indexOf(s);
          const done = idx > stepIdx;
          const active = (step === s) || (step === "processing" && s === "card") || (step === "manage" && s === "success");
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 shrink-0 ${active || done ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                  ${done || step === "manage" ? "bg-primary border-primary text-white"
                    : active ? "border-primary text-primary"
                    : "border-muted-foreground/30"}`}>
                  {done || step === "manage" ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${active ? "text-primary" : ""}`}>{labels[i]}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px min-w-[24px] ${done || step === "manage" ? "bg-primary" : "bg-border"}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {step === "plan" && <PlanStep onSelect={handleSelectPlan} />}
      {step === "card" && <CardStep plan={selectedPlan} onBack={() => setStep("plan")} onPay={handlePay} />}
      {step === "processing" && <ProcessingStep />}
      {step === "success" && (
        <SuccessStep
          plan={selectedPlan}
          card={cardData}
          onReset={handleReset}
          onManage={() => setStep("manage")}
        />
      )}
      {step === "manage" && (
        <ManageStep plan={selectedPlan} card={cardData} onChangePlan={handleReset} />
      )}
    </div>
  );
}
