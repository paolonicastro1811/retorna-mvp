import { useNavigate } from 'react-router-dom'

const WhatsAppIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const CheckIcon = () => (
  <div className="shrink-0 w-[26px] h-[26px] bg-[#25D366] rounded-full flex items-center justify-center mt-0.5">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </div>
)

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-[#2d2d3a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* HERO */}
      <section className="relative min-h-[60vh] flex items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/hero.png')] bg-center bg-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 max-w-[720px] mx-auto px-6 py-12">
          <p className="text-xs font-bold tracking-widest uppercase text-white/80 mb-3">Para restaurantes</p>
          <h1 className="text-[clamp(1.8rem,5vw,2.6rem)] font-extrabold leading-tight text-white mb-5 [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
            Seus clientes ja existem.<br /><span className="text-[#25D366]">Eles so pararam de voltar.</span>
          </h1>
          <p className="text-lg text-white/90 max-w-[520px] mx-auto mb-9 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
            Recupere clientes inativos via WhatsApp e veja exatamente quanto faturamento eles geram quando voltam.
          </p>
          <button
            onClick={() => navigate('/comecar')}
            className="inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-9 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
          >
            <WhatsAppIcon />
            Quero trazer meus clientes de volta
          </button>
          <span className="block mt-2.5 text-sm text-white/60">Sem setup complicado · Funciona em poucos dias</span>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-12 bg-[#f8f9fb]">
        <div className="max-w-[960px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-[5fr_6fr] gap-7 items-center">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-[#0f9d58] mb-3">O problema</p>
              <h2 className="text-[1.6rem] font-extrabold leading-tight text-[#1a1a2e] mb-7">
                Voce esta perdendo faturamento<br />todos os dias — sem perceber
              </h2>
              <ul className="space-y-4">
                {[
                  'Voce ja investiu para conquistar esses clientes',
                  'Muitos vieram uma ou duas vezes e nunca mais voltaram',
                  'Ninguem faz follow-up com quem sumiu',
                  'Cada cliente inativo e dinheiro que voce deixa na mesa',
                  'Voce nao tem como saber quanto esta perdendo',
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 font-extrabold text-xl leading-6">×</span>
                    <span className="text-[1.05rem]">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <img src="/images/empty.png" alt="Restaurante vazio" className="w-full rounded-xl shadow-lg object-cover" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* SOLUCAO */}
      <section className="py-12">
        <div className="max-w-[720px] mx-auto px-6">
          <p className="text-xs font-bold tracking-widest uppercase text-[#0f9d58] mb-3">A solucao</p>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-[#1a1a2e] mb-7">
            Um sistema simples que traz<br />seus clientes de volta
          </h2>
          <div className="space-y-4">
            {[
              'Ative seu numero de WhatsApp em poucos minutos',
              'Importe seus clientes e historico de visitas',
              'O sistema identifica quem nao voltou ha mais de 30 dias',
              'Envia mensagens WhatsApp automaticamente para eles',
              'Voce ve quem voltou e quanto gastou — em reais',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-3.5 text-[1.05rem]">
                <CheckIcon />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-12 bg-[#f8f9fb]">
        <div className="max-w-[720px] mx-auto px-6 text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-[#0f9d58] mb-3">Como funciona</p>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-[#1a1a2e] mb-7">3 passos. Sem complicacao.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { n: '1', h: 'Conecte seu WhatsApp', p: 'Vincule o numero do seu restaurante em poucos minutos.' },
              { n: '2', h: 'Sistema encontra clientes inativos', p: 'O sistema identifica automaticamente quem parou de voltar.' },
              { n: '3', h: 'Veja quem voltou e quanto gastou', p: 'Acompanhe o retorno e o faturamento gerado.' },
            ].map(s => (
              <div key={s.n} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#1a1a2e] text-white text-xl font-extrabold inline-flex items-center justify-center mb-3.5">{s.n}</div>
                <h3 className="text-[1.05rem] font-bold text-[#1a1a2e] mb-1.5">{s.h}</h3>
                <p className="text-sm text-[#6b7280]">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVA */}
      <section className="py-12 text-center">
        <div className="max-w-[960px] mx-auto px-6">
          <p className="text-xs font-bold tracking-widest uppercase text-[#0f9d58] mb-3">Resultados reais</p>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-[#1a1a2e] mb-3">
            Veja o que acontece quando voce reativa seus clientes
          </h2>
          <p className="text-[#6b7280] mb-6">Exemplo real de campanha de reativacao</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center max-w-[860px] mx-auto text-left">
            <img src="/images/full.png" alt="Restaurante cheio" className="w-full rounded-xl shadow-lg object-cover" loading="lazy" />
            <div className="bg-[#1a1a2e] text-white rounded-xl p-8 md:p-10">
              <p className="text-xs font-bold tracking-wider uppercase text-white/50 mb-7">Exemplo real de campanha</p>
              {[
                { label: 'Clientes contatados', value: '120', highlight: false },
                { label: 'Clientes que voltaram', value: '18', highlight: false },
                { label: 'Faturamento gerado', value: 'R$ 2.350', highlight: true },
              ].map((r, i) => (
                <div key={i} className={`flex justify-between items-baseline py-3.5 ${i < 2 ? 'border-b border-white/10' : ''}`}>
                  <span className="text-[0.95rem] text-white/75">{r.label}</span>
                  <span className={`font-extrabold ${r.highlight ? 'text-[#25D366] text-2xl' : 'text-xl'}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="text-center py-10 pb-14">
        <div className="max-w-[720px] mx-auto px-6">
          <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-extrabold text-[#1a1a2e] mb-3">
            Pare de perder clientes<br />todos os dias
          </h2>
          <p className="text-[#6b7280] mb-8 text-[1.05rem]">Ative o sistema e comece a recuperar faturamento ja.</p>
          <button
            onClick={() => navigate('/comecar')}
            className="inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-9 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
          >
            <WhatsAppIcon />
            Quero trazer meus clientes de volta
          </button>
          <span className="block mt-2.5 text-sm text-[#6b7280]">Teste inicial · Sem compromisso</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-6 text-[0.8rem] text-[#6b7280] border-t border-gray-200">
        <div className="max-w-[720px] mx-auto px-6">
          Reativacao &copy; 2026 · Todos os direitos reservados
          <p className="mt-3 text-[0.68rem] text-gray-400 max-w-[480px] mx-auto leading-relaxed">
            Ao ativar o sistema, voce confirma que possui autorizacao para contatar seus clientes via WhatsApp conforme a LGPD. Todas as mensagens incluem opcao de descadastro.
          </p>
        </div>
      </footer>
    </div>
  )
}
